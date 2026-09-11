import { showResult } from "../app.js";

const COLS = 14;
const ROWS = 15;
const CELL = 20;
const LOGICAL_W = COLS * CELL;
const LOGICAL_H = ROWS * CELL;
const START_INTERVAL = 165;
const MIN_INTERVAL = 80;

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let snake = [];
  let dir = { x: 1, y: 0 };
  let pendingDir = { x: 1, y: 0 };
  let food = null;
  let score = 0;
  let intervalId = null;
  let canvas, cx;
  let touchStart = null;

  const onKey = (e) => {
    if (!running) return;
    if (e.key === "ArrowUp") queueDir(0, -1);
    if (e.key === "ArrowDown") queueDir(0, 1);
    if (e.key === "ArrowLeft") queueDir(-1, 0);
    if (e.key === "ArrowRight") queueDir(1, 0);
  };

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">Snake</div>
        <div class="stage-sub">Mange les points pour grandir, évite les murs et ta propre queue. Ça accélère à chaque bouchée.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startRun);
  }

  function queueDir(x, y) {
    if (x === -dir.x && y === -dir.y) return; // pas de demi-tour direct
    pendingDir = { x, y };
  }

  function startRun() {
    const midY = Math.floor(ROWS / 2);
    snake = [
      { x: 6, y: midY },
      { x: 5, y: midY },
      { x: 4, y: midY },
    ];
    dir = { x: 1, y: 0 };
    pendingDir = { x: 1, y: 0 };
    score = 0;
    running = true;
    placeFood();

    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Score</div><div class="value mono" id="score">0</div></div>
        <div class="hud-stat"><div class="label">Longueur</div><div class="value mono" id="len">3</div></div>
      </div>
      <div class="stage">
        <canvas id="sn" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        <div class="dpad">
          <button type="button" class="dpad-up" aria-label="Haut"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
          <button type="button" class="dpad-left" aria-label="Gauche"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
          <button type="button" class="dpad-down" aria-label="Bas"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
          <button type="button" class="dpad-right" aria-label="Droite"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
        </div>
      </div>
    `;
    canvas = document.getElementById("sn");
    cx = canvas.getContext("2d");
    container.querySelector(".dpad-up").addEventListener("click", () => queueDir(0, -1));
    container.querySelector(".dpad-down").addEventListener("click", () => queueDir(0, 1));
    container.querySelector(".dpad-left").addEventListener("click", () => queueDir(-1, 0));
    container.querySelector(".dpad-right").addEventListener("click", () => queueDir(1, 0));
    canvas.addEventListener("pointerdown", (e) => {
      touchStart = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 1 : -1, 0);
      else queueDir(0, dy > 0 ? 1 : -1);
    });
    window.addEventListener("keydown", onKey);

    draw();
    scheduleTick(START_INTERVAL);
  }

  function scheduleTick(interval) {
    clearInterval(intervalId);
    intervalId = setInterval(step, interval);
  }

  function placeFood() {
    let cell;
    do {
      cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
    food = cell;
  }

  function step() {
    if (!running || cancelled) return;
    dir = pendingDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
    if (snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);
    if (food && head.x === food.x && head.y === food.y) {
      score += 1;
      document.getElementById("score").textContent = String(score);
      document.getElementById("len").textContent = String(snake.length);
      placeFood();
      const nextInterval = Math.max(MIN_INTERVAL, START_INTERVAL - score * 5);
      scheduleTick(nextInterval);
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    cx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    cx.fillStyle = "#1f2230";
    cx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (food) {
      cx.fillStyle = "#c8e05c";
      cx.beginPath();
      cx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
      cx.fill();
    }

    snake.forEach((s, i) => {
      cx.fillStyle = i === 0 ? "#eaf5c8" : "#a9c94a";
      const pad = 2;
      cx.beginPath();
      const r = 5;
      const x = s.x * CELL + pad;
      const y = s.y * CELL + pad;
      const w = CELL - pad * 2;
      const h = CELL - pad * 2;
      cx.moveTo(x + r, y);
      cx.arcTo(x + w, y, x + w, y + h, r);
      cx.arcTo(x + w, y + h, x, y + h, r);
      cx.arcTo(x, y + h, x, y, r);
      cx.arcTo(x, y, x + w, y, r);
      cx.closePath();
      cx.fill();
    });
  }

  async function gameOver() {
    running = false;
    clearInterval(intervalId);
    window.removeEventListener("keydown", onKey);
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    clearInterval(intervalId);
    window.removeEventListener("keydown", onKey);
  };
}
