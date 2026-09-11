import { showResult } from "../app.js";
import { requestTiltPermission, createSteering } from "../tilt-input.js";

const LOGICAL_W = 300;
const LOGICAL_H = 300;
const MARGIN = 18;
const BALL_R = 10;
const ZONE_R = 26;
const FRICTION = 0.985;
const ACCEL = 460;
const MAX_SPEED = 280;
const DURATION_MS = 60000;

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let raf = null;
  let lastTime = 0;
  let endAt = 0;
  let steering = null;
  let canvas, cx;

  let ball = { x: LOGICAL_W / 2, y: LOGICAL_H / 2, vx: 0, vy: 0 };
  let zone = { x: 0, y: 0 };
  let score = 0;
  let combo = 0;
  let floaters = [];

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">Bille Folle</div>
        <div class="stage-sub">Incline le téléphone pour rouler la bille jusqu'à la zone en surbrillance. Chaque zone atteinte en fait apparaître une nouvelle ailleurs, et rapporte plus de points si tu enchaînes sans tomber. 60 secondes, un maximum de points.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", async () => {
      await requestTiltPermission();
      startRun();
    });
  }

  function startRun() {
    ball = { x: LOGICAL_W / 2, y: LOGICAL_H / 2, vx: 0, vy: 0 };
    score = 0;
    combo = 0;
    floaters = [];
    running = true;
    endAt = performance.now() + DURATION_MS;
    placeZone();

    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">60.0s</div></div>
        <div class="hud-stat"><div class="label">Score</div><div class="value mono" id="score">0</div></div>
      </div>
      <div class="stage">
        <canvas id="cv" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        <div class="stage-sub">Incline le téléphone (ou glisse le doigt / flèches)</div>
      </div>
    `;
    canvas = document.getElementById("cv");
    cx = canvas.getContext("2d");
    steering = createSteering(canvas);

    lastTime = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function placeZone() {
    zone = {
      x: MARGIN + 40 + Math.random() * (LOGICAL_W - 2 * (MARGIN + 40)),
      y: MARGIN + 40 + Math.random() * (LOGICAL_H - 2 * (MARGIN + 40)),
    };
  }

  function loop(now) {
    if (!running || cancelled) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt, now);
    draw(now);
    const remaining = Math.max(0, endAt - now);
    const timeEl = document.getElementById("time");
    if (timeEl) timeEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
    if (remaining <= 0) {
      finish();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function update(dt, now) {
    const sx = steering ? steering.x : 0;
    const sy = steering ? steering.y : 0;
    ball.vx += sx * ACCEL * dt;
    ball.vy += sy * ACCEL * dt;
    const damp = Math.pow(FRICTION, dt * 60);
    ball.vx *= damp;
    ball.vy *= damp;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > MAX_SPEED) {
      ball.vx = (ball.vx / speed) * MAX_SPEED;
      ball.vy = (ball.vy / speed) * MAX_SPEED;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < MARGIN || ball.x > LOGICAL_W - MARGIN || ball.y < MARGIN || ball.y > LOGICAL_H - MARGIN) {
      combo = 0;
      ctx.toast("Bille tombée !");
      ball = { x: LOGICAL_W / 2, y: LOGICAL_H / 2, vx: 0, vy: 0 };
      return;
    }

    const dz = Math.hypot(ball.x - zone.x, ball.y - zone.y);
    if (dz < ZONE_R - BALL_R * 0.4) {
      combo += 1;
      const gained = 10 + (combo - 1) * 5;
      score += gained;
      floaters.push({ text: `+${gained}`, x: zone.x, y: zone.y, born: now });
      const scoreEl = document.getElementById("score");
      if (scoreEl) scoreEl.textContent = String(score);
      placeZone();
    }
  }

  function draw(now) {
    cx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    cx.fillStyle = "#1f2230";
    roundRect(MARGIN - 6, MARGIN - 6, LOGICAL_W - (MARGIN - 6) * 2, LOGICAL_H - (MARGIN - 6) * 2, 14);
    cx.fill();
    cx.strokeStyle = "rgba(255,93,93,0.5)";
    cx.lineWidth = 3;
    cx.setLineDash([8, 6]);
    roundRect(MARGIN, MARGIN, LOGICAL_W - MARGIN * 2, LOGICAL_H - MARGIN * 2, 10);
    cx.stroke();
    cx.setLineDash([]);

    const pulse = 1 + Math.sin(now / 180) * 0.08;
    cx.fillStyle = "rgba(255,171,115,0.18)";
    cx.beginPath();
    cx.arc(zone.x, zone.y, ZONE_R * pulse, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "#ffab73";
    cx.lineWidth = 2.5;
    cx.beginPath();
    cx.arc(zone.x, zone.y, ZONE_R * 0.72, 0, Math.PI * 2);
    cx.stroke();

    const grad = cx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, BALL_R);
    grad.addColorStop(0, "#eaf2ff");
    grad.addColorStop(1, "#7c93ff");
    cx.fillStyle = grad;
    cx.beginPath();
    cx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    cx.fill();

    floaters = floaters.filter((f) => now - f.born < 650);
    floaters.forEach((f) => {
      const age = now - f.born;
      const alpha = Math.max(0, 1 - age / 650);
      cx.fillStyle = `rgba(255,200,87,${alpha})`;
      cx.font = "bold 16px monospace";
      cx.textAlign = "center";
      cx.fillText(f.text, f.x, f.y - 20 - age * 0.05);
    });
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

  async function finish() {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (steering) steering.destroy();
  };
}
