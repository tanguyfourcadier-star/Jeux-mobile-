import { showResult } from "../app.js";
import { requestTiltPermission, createSteering } from "../tilt-input.js";

const LOGICAL_W = 300;
const LOGICAL_H = 460;
const TRACK_MARGIN = 26;
const CAR_W = 34;
const CAR_H = 54;
const PLAYER_Y = LOGICAL_H - 78;
const BASE_SPEED = 180; // unités de progression / seconde
const DISTANCE_TOTAL = 10800; // ~60s à vitesse de base
const PIXELS_PER_UNIT = 0.85;
const STEER_RATE = 1.7; // vitesse de déplacement latéral (0..1 / s) à inclinaison max

// Parcours fixe (toujours le même, pour comparer les temps équitablement).
// p = fraction de la distance totale, x = position normalisée sur la piste (0 = gauche, 1 = droite)
const LEVEL = [
  { p: 0.06, type: "boost", x: 0.5 },
  { p: 0.14, type: "obstacle", x: 0.25 },
  { p: 0.14, type: "obstacle", x: 0.75 },
  { p: 0.22, type: "boost", x: 0.18 },
  { p: 0.3, type: "obstacle", x: 0.5 },
  { p: 0.38, type: "boost", x: 0.82 },
  { p: 0.46, type: "obstacle", x: 0.3 },
  { p: 0.46, type: "obstacle", x: 0.62 },
  { p: 0.54, type: "boost", x: 0.5 },
  { p: 0.62, type: "obstacle", x: 0.72 },
  { p: 0.7, type: "obstacle", x: 0.2 },
  { p: 0.7, type: "obstacle", x: 0.48 },
  { p: 0.78, type: "boost", x: 0.28 },
  { p: 0.86, type: "obstacle", x: 0.6 },
  { p: 0.93, type: "boost", x: 0.5 },
].map((w) => ({ ...w, d: w.p * DISTANCE_TOTAL, done: false }));

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let raf = null;
  let lastTime = 0;
  let progress = 0;
  let carXNorm = 0.5;
  let speedMult = 1;
  let effectUntil = 0;
  let effectValue = 1;
  let startTime = 0;
  let steering = null;
  let level = [];
  let canvas, cx;

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">Chrono Piste</div>
        <div class="stage-sub">Toujours le même parcours. Incline le téléphone à gauche/droite pour te diriger, passe sur les zones dorées pour accélérer, évite les plots. Termine le plus vite possible.</div>
        <button class="btn btn-primary" type="button" id="start">Démarrer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", async () => {
      await requestTiltPermission();
      startRun();
    });
  }

  function startRun() {
    progress = 0;
    carXNorm = 0.5;
    speedMult = 1;
    effectUntil = 0;
    effectValue = 1;
    running = true;
    level = LEVEL.map((w) => ({ ...w, done: false }));

    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">0.0s</div></div>
        <div class="hud-stat"><div class="label">Parcours</div><div class="value mono" id="pct">0%</div></div>
      </div>
      <div class="stage">
        <canvas id="cv" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        <div class="stage-sub">Incline le téléphone (ou glisse le doigt / flèches ← →)</div>
      </div>
    `;
    canvas = document.getElementById("cv");
    cx = canvas.getContext("2d");
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
    draw();
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

  function update(dt, now) {
    if (now > effectUntil) effectValue = 1;
    speedMult = effectValue;
    progress += BASE_SPEED * speedMult * dt;

    const steerX = steering ? steering.x : 0;
    carXNorm = Math.max(0, Math.min(1, carXNorm + steerX * STEER_RATE * dt));

    for (const w of level) {
      if (w.done) continue;
      if (Math.abs(progress - w.d) < 26) {
        const dx = Math.abs(carXNorm - w.x);
        if (dx < 0.14) {
          w.done = true;
          if (w.type === "obstacle") {
            effectValue = 0.35;
            effectUntil = now + 550;
            ctx.toast("Touché ! ralenti");
          } else {
            effectValue = 1.8;
            effectUntil = now + 1300;
            ctx.toast("Boost !");
          }
        }
      }
    }
  }

  function trackX(norm) {
    return TRACK_MARGIN + norm * (LOGICAL_W - TRACK_MARGIN * 2);
  }

  function draw() {
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

    drawCar(trackX(carXNorm), PLAYER_Y, speedMult > 1 ? "#ffe08a" : speedMult < 1 ? "#ff9a9a" : "#6bcf9c");
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
