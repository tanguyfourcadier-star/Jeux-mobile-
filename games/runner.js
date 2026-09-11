import { showResult } from "../app.js";

const LOGICAL_W = 320;
const LOGICAL_H = 360;
const LANES = 3;
const LANE_W = LOGICAL_W / LANES;
const CAR_W = 42;
const CAR_H = 62;
const BASE_SPEED = 210; // px/s
const PLAYER_Y = LOGICAL_H - 70;

export default function mount(container, ctx) {
  let running = false;
  let animId = null;
  let lastTime = 0;
  let elapsed = 0;
  let spawnAcc = 0;
  let playerLane = 1;
  let obstacles = [];
  let cancelled = false;
  let canvas, cx;

  const onKey = (e) => {
    if (!running) return;
    if (e.key === "ArrowLeft") moveLane(-1);
    if (e.key === "ArrowRight") moveLane(1);
  };

  renderIntro();

  function renderIntro() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "stage";
    wrap.innerHTML = `
      <div class="stage-msg">Évite les obstacles</div>
      <div class="stage-sub">Trois voies. Glisse ou touche à gauche / droite pour changer de voie. Ça accélère avec le temps.</div>
      <button class="btn btn-primary" type="button" id="start">Démarrer</button>
    `;
    container.appendChild(wrap);
    wrap.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    elapsed = 0;
    spawnAcc = 0;
    obstacles = [];
    playerLane = 1;
    running = true;

    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">0.0s</div></div>
        <div class="hud-stat"><div class="label">Vitesse</div><div class="value mono" id="spd">1.0x</div></div>
      </div>
      <div class="stage">
        <canvas id="rn" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        <div class="runner-controls">
          <button type="button" id="left" aria-label="Voie de gauche"><svg viewBox="0 0 24 24"><path d="M15 19 6 12l9-7"/></svg></button>
          <button type="button" id="right" aria-label="Voie de droite"><svg viewBox="0 0 24 24"><path d="M9 5l9 7-9 7"/></svg></button>
        </div>
      </div>
    `;
    canvas = document.getElementById("rn");
    cx = canvas.getContext("2d");
    document.getElementById("left").addEventListener("click", () => moveLane(-1));
    document.getElementById("right").addEventListener("click", () => moveLane(1));
    canvas.addEventListener("pointerdown", onCanvasTap);
    window.addEventListener("keydown", onKey);

    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function onCanvasTap(e) {
    const rect = canvas.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    moveLane(rel < 0.5 ? -1 : 1);
  }

  function moveLane(dir) {
    playerLane = Math.min(LANES - 1, Math.max(0, playerLane + dir));
  }

  function loop(now) {
    if (!running || cancelled) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;
    update(dt);
    draw();
    const timeEl = document.getElementById("time");
    const spdEl = document.getElementById("spd");
    if (timeEl) timeEl.textContent = `${elapsed.toFixed(1)}s`;
    if (spdEl) spdEl.textContent = `${(currentSpeed() / BASE_SPEED).toFixed(1)}x`;
    animId = requestAnimationFrame(loop);
  }

  function currentSpeed() {
    return Math.min(BASE_SPEED * 2.6, BASE_SPEED + elapsed * 20);
  }

  function update(dt) {
    const speed = currentSpeed();
    spawnAcc += dt * 1000;
    const spawnEvery = Math.max(420, 950 - elapsed * 35);
    if (spawnAcc >= spawnEvery) {
      spawnAcc = 0;
      obstacles.push({ lane: Math.floor(Math.random() * LANES), y: -CAR_H });
    }
    obstacles.forEach((o) => (o.y += speed * dt));
    obstacles = obstacles.filter((o) => o.y < LOGICAL_H + 60);

    for (const o of obstacles) {
      if (o.lane !== playerLane) continue;
      const overlap = o.y + CAR_H * 0.5 > PLAYER_Y - CAR_H * 0.5 && o.y - CAR_H * 0.5 < PLAYER_Y + CAR_H * 0.5;
      if (overlap) {
        running = false;
        gameOver();
        return;
      }
    }
  }

  function laneX(lane) {
    return lane * LANE_W + LANE_W / 2;
  }

  function draw() {
    cx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    cx.fillStyle = "#1f2230";
    cx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    cx.strokeStyle = "rgba(244,245,248,0.12)";
    cx.lineWidth = 2;
    cx.setLineDash([14, 16]);
    for (let i = 1; i < LANES; i++) {
      cx.beginPath();
      cx.moveTo(i * LANE_W, 0);
      cx.lineTo(i * LANE_W, LOGICAL_H);
      cx.stroke();
    }
    cx.setLineDash([]);

    obstacles.forEach((o) => drawCar(laneX(o.lane), o.y, "#ff5d5d"));
    drawCar(laneX(playerLane), PLAYER_Y, "#6bcf9c");
  }

  function drawCar(x, y, color) {
    const w = CAR_W;
    const h = CAR_H;
    cx.save();
    cx.translate(x, y);
    cx.fillStyle = color;
    roundRect(-w / 2, -h / 2, w, h, 10);
    cx.fill();
    cx.fillStyle = "rgba(13,14,20,0.35)";
    roundRect(-w / 2 + 7, -h / 2 + 10, w - 14, h * 0.32, 5);
    cx.fill();
    roundRect(-w / 2 + 7, h * 0.06, w - 14, h * 0.28, 5);
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

  async function gameOver() {
    window.removeEventListener("keydown", onKey);
    const score = Math.round(elapsed * 10) / 10;
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener("keydown", onKey);
  };
}
