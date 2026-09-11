import { showResult } from "../app.js";
import { requestTiltPermission, createSteering } from "../tilt-input.js";

const LOGICAL_W = 300;
const LOGICAL_H = 460;
const TRACK_MARGIN = 34; // piste resserrée = plus difficile à garder
const CAR_W = 30;
const CAR_H = 52;
const PLAYER_Y = LOGICAL_H - 78;
const STEER_RATE = 1.8; // vitesse de déplacement latéral (0..1 / s) à inclinaison max

const BASE_SPEED_START = 135; // unités / s en début de course
const BASE_SPEED_END = 245; // unités / s en fin de course : la vitesse de base monte tout au long
const DISTANCE_TOTAL = 18000; // ~1min30 pour un rythme de jeu typique (plus vite si boosts enchaînés)
const PIXELS_PER_UNIT = 0.85;

const MAX_STACK = 4;
const STACK_BONUS = 0.3; // +30% de vitesse par boost empilé (permanent tant qu'on ne percute rien)
const HIT_STUN_MS = 420; // court ralentissement "choc" après un obstacle, indépendant des boosts

// Parcours fixe (toujours le même, pour comparer les temps équitablement).
// p = fraction de la distance totale, x = position normalisée sur la piste (0 = gauche, 1 = droite)
const LEVEL = [
  { p: 0.04, type: "boost", x: 0.5 },
  { p: 0.09, type: "obstacle", x: 0.28 },
  { p: 0.09, type: "obstacle", x: 0.72 },
  { p: 0.14, type: "boost", x: 0.2 },
  { p: 0.18, type: "obstacle", x: 0.5 },
  { p: 0.22, type: "obstacle", x: 0.35 },
  { p: 0.22, type: "obstacle", x: 0.65 },
  { p: 0.27, type: "boost", x: 0.82 },
  { p: 0.31, type: "obstacle", x: 0.55 },
  { p: 0.35, type: "obstacle", x: 0.22 },
  { p: 0.35, type: "obstacle", x: 0.78 },
  { p: 0.39, type: "boost", x: 0.5 },
  { p: 0.43, type: "obstacle", x: 0.3 },
  { p: 0.43, type: "obstacle", x: 0.7 },
  { p: 0.48, type: "boost", x: 0.18 },
  { p: 0.52, type: "obstacle", x: 0.45 },
  { p: 0.52, type: "obstacle", x: 0.65 },
  { p: 0.57, type: "obstacle", x: 0.25 },
  { p: 0.61, type: "boost", x: 0.5 },
  { p: 0.65, type: "obstacle", x: 0.35 },
  { p: 0.65, type: "obstacle", x: 0.75 },
  { p: 0.7, type: "boost", x: 0.85 },
  { p: 0.74, type: "obstacle", x: 0.5 },
  { p: 0.78, type: "obstacle", x: 0.2 },
  { p: 0.78, type: "obstacle", x: 0.6 },
  { p: 0.83, type: "boost", x: 0.4 },
  { p: 0.87, type: "obstacle", x: 0.6 },
  { p: 0.87, type: "obstacle", x: 0.3 },
  { p: 0.91, type: "boost", x: 0.5 },
  { p: 0.95, type: "obstacle", x: 0.45 },
  { p: 0.95, type: "obstacle", x: 0.65 },
].map((w) => ({ ...w, d: w.p * DISTANCE_TOTAL, done: false }));

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let raf = null;
  let lastTime = 0;
  let progress = 0;
  let carXNorm = 0.5;
  let boostStack = 0;
  let hitStunUntil = 0;
  let startTime = 0;
  let steering = null;
  let level = [];
  let canvas, cx;

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">Chrono Piste</div>
        <div class="stage-sub">Toujours le même parcours, ~1min30 à rythme normal. Incline le téléphone à gauche/droite pour te diriger. Les zones dorées donnent un boost permanent, cumulable jusqu'à 4 — mais toucher un bord de piste ou un plot te fait tout perdre d'un coup. La vitesse de base augmente au fil de la course.</div>
        <button class="btn btn-primary" type="button" id="start">Démarrer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", async () => {
      await requestTiltPermission();
      if (cancelled) return;
      startRun();
    });
  }

  function startRun() {
    progress = 0;
    carXNorm = 0.5;
    boostStack = 0;
    hitStunUntil = 0;
    running = true;
    level = LEVEL.map((w) => ({ ...w, done: false }));

    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">0.0s</div></div>
        <div class="hud-stat"><div class="label">Parcours</div><div class="value mono" id="pct">0%</div></div>
        <div class="hud-stat"><div class="label">Boosts</div><div class="value mono" id="boosts">0/4</div></div>
      </div>
      <div class="stage">
        <canvas id="cv" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        <div class="stage-sub">Incline le téléphone (ou glisse le doigt / flèches ← →)</div>
      </div>
    `;
    canvas = document.getElementById("cv");
    cx = canvas.getContext("2d");
    if (steering) steering.destroy();
    steering = createSteering(canvas);

    startTime = performance.now();
    lastTime = startTime;
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!running || cancelled) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt, now);
    draw(now);
    const timeEl = document.getElementById("time");
    const pctEl = document.getElementById("pct");
    if (timeEl) timeEl.textContent = `${((now - startTime) / 1000).toFixed(1)}s`;
    if (pctEl) pctEl.textContent = `${Math.min(100, Math.round((progress / DISTANCE_TOTAL) * 100))}%`;
    if (progress >= DISTANCE_TOTAL) {
      finish(now - startTime);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function loseBoosts(reason, now) {
    if (boostStack > 0) {
      boostStack = 0;
      ctx.toast(reason);
      updateBoostHud();
    }
    hitStunUntil = now + HIT_STUN_MS;
  }

  function updateBoostHud() {
    const el = document.getElementById("boosts");
    if (el) el.textContent = `${boostStack}/${MAX_STACK}`;
  }

  function update(dt, now) {
    const ratio = Math.min(1, progress / DISTANCE_TOTAL);
    const baseSpeed = BASE_SPEED_START + (BASE_SPEED_END - BASE_SPEED_START) * ratio;
    let mult = 1 + boostStack * STACK_BONUS;
    if (now < hitStunUntil) mult *= 0.4;
    progress += baseSpeed * mult * dt;

    const steerX = steering ? steering.x : 0;
    const nextX = carXNorm + steerX * STEER_RATE * dt;
    const clamped = Math.max(0, Math.min(1, nextX));
    if ((nextX <= 0 || nextX >= 1) && Math.abs(steerX) > 0.05) {
      loseBoosts("Mur touché ! Boosts perdus", now);
    }
    carXNorm = clamped;

    for (const w of level) {
      if (w.done) continue;
      if (Math.abs(progress - w.d) < 26) {
        const dx = Math.abs(carXNorm - w.x);
        if (dx < 0.13) {
          w.done = true;
          if (w.type === "obstacle") {
            loseBoosts("Touché ! Boosts perdus", now);
          } else {
            boostStack = Math.min(MAX_STACK, boostStack + 1);
            ctx.toast(`Boost x${boostStack} !`);
            updateBoostHud();
          }
        }
      }
    }
  }

  function trackX(norm) {
    return TRACK_MARGIN + norm * (LOGICAL_W - TRACK_MARGIN * 2);
  }

  function draw(now) {
    cx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    cx.fillStyle = "#1f2230";
    cx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    cx.strokeStyle = "rgba(244,245,248,0.18)";
    cx.lineWidth = 3;
    cx.beginPath();
    cx.moveTo(TRACK_MARGIN, 0);
    cx.lineTo(TRACK_MARGIN, LOGICAL_H);
    cx.moveTo(LOGICAL_W - TRACK_MARGIN, 0);
    cx.lineTo(LOGICAL_W - TRACK_MARGIN, LOGICAL_H);
    cx.stroke();

    level.forEach((w) => {
      const y = PLAYER_Y - (w.d - progress) * PIXELS_PER_UNIT;
      if (y < -30 || y > LOGICAL_H + 30) return;
      const x = trackX(w.x);
      if (w.type === "obstacle") {
        cx.fillStyle = w.done ? "rgba(255,93,93,0.35)" : "#ff5d5d";
        cx.beginPath();
        cx.moveTo(x, y - 14);
        cx.lineTo(x + 13, y + 12);
        cx.lineTo(x - 13, y + 12);
        cx.closePath();
        cx.fill();
      } else {
        cx.fillStyle = w.done ? "rgba(255,200,87,0.3)" : "#ffc857";
        roundRect(x - 20, y - 8, 40, 16, 7);
        cx.fill();
      }
    });

    const carColor = now < hitStunUntil ? "#ff9a9a" : boostStack > 0 ? "#ffe08a" : "#6bcf9c";
    drawCar(trackX(carXNorm), PLAYER_Y, carColor);
  }

  function drawCar(x, y, color) {
    cx.save();
    cx.translate(x, y);
    cx.fillStyle = color;
    roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 9);
    cx.fill();
    cx.fillStyle = "rgba(13,14,20,0.35)";
    roundRect(-CAR_W / 2 + 5, -CAR_H / 2 + 8, CAR_W - 10, CAR_H * 0.3, 4);
    cx.fill();
    roundRect(-CAR_W / 2 + 5, CAR_H * 0.06, CAR_W - 10, CAR_H * 0.26, 4);
    cx.fill();
    cx.restore();
  }

  function roundRect(x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r);
    cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r);
    cx.arcTo(x, y, x + w, y, r);
    cx.closePath();
  }

  async function finish(ms) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    const rounded = Math.round(ms);
    const outcome = await ctx.finish(rounded);
    showResult(container, ctx, rounded, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (steering) steering.destroy();
  };
}
