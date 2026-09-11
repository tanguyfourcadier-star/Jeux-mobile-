import { showResult } from "../app.js";

const SLICES_NEEDED = 12;
const LOGICAL_W = 320;
const LOGICAL_H = 220;
const MIN_SWIPE = 34;

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let cuts = [];
  let crumbs = [];
  let startTime = 0;
  let raf = null;
  let canvas, cx;
  let pointerStart = null;

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">Découpe Express</div>
        <div class="stage-sub">Glisse le doigt de haut en bas sur le cornichon pour le trancher. ${SLICES_NEEDED} tranches, le plus vite possible.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    cuts = [];
    crumbs = [];
    running = true;
    startTime = performance.now();
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">0.0s</div></div>
        <div class="hud-stat"><div class="label">Tranches</div><div class="value mono" id="count">0 / ${SLICES_NEEDED}</div></div>
      </div>
      <div class="stage">
        <canvas id="cv" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
      </div>
    `;
    canvas = document.getElementById("cv");
    cx = canvas.getContext("2d");
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_W / rect.width;
    const scaleY = LOGICAL_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onDown(e) {
    pointerStart = canvasPoint(e);
  }

  function onUp(e) {
    if (!pointerStart || !running) return;
    const end = canvasPoint(e);
    const dx = end.x - pointerStart.x;
    const dy = end.y - pointerStart.y;
    const start = pointerStart;
    pointerStart = null;
    if (Math.abs(dy) < MIN_SWIPE || Math.abs(dy) <= Math.abs(dx)) return;

    const bandTop = LOGICAL_H * 0.32;
    const bandBottom = LOGICAL_H * 0.68;
    const midY = (start.y + end.y) / 2;
    if (midY < bandTop - 20 || midY > bandBottom + 20) return;
    const midX = (start.x + end.x) / 2;
    if (midX < LOGICAL_W * 0.1 || midX > LOGICAL_W * 0.9) return;

    cuts.push(midX);
    crumbs.push({ x: midX, y: (bandTop + bandBottom) / 2, born: performance.now() });
    const countEl = document.getElementById("count");
    if (countEl) countEl.textContent = `${cuts.length} / ${SLICES_NEEDED}`;
    if (cuts.length >= SLICES_NEEDED) finish();
  }

  function loop(now) {
    if (!running || cancelled) return;
    const timeEl = document.getElementById("time");
    if (timeEl) timeEl.textContent = `${((now - startTime) / 1000).toFixed(1)}s`;
    crumbs = crumbs.filter((c) => now - c.born < 500);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    cx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    cx.fillStyle = "#1f2230";
    cx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    const left = LOGICAL_W * 0.12;
    const right = LOGICAL_W * 0.88;
    const top = LOGICAL_H * 0.32;
    const bottom = LOGICAL_H * 0.68;
    const midY = (top + bottom) / 2;

    // corps du cornichon
    cx.fillStyle = "#8fae3f";
    cx.beginPath();
    cx.moveTo(left + 14, top);
    for (let x = left; x <= right; x += 18) {
      const bump = Math.sin(x * 0.6) * 3;
      cx.lineTo(x, top + bump + 4);
    }
    cx.quadraticCurveTo(right + 10, midY, right - 6, bottom - 4);
    for (let x = right; x >= left; x -= 18) {
      const bump = Math.cos(x * 0.6) * 3;
      cx.lineTo(x, bottom - bump - 4);
    }
    cx.quadraticCurveTo(left - 10, midY, left + 14, top);
    cx.closePath();
    cx.fill();

    // reflet
    cx.fillStyle = "rgba(255,255,255,0.12)";
    cx.beginPath();
    cx.ellipse(LOGICAL_W / 2, top + 14, (right - left) / 2.4, 6, 0, 0, Math.PI * 2);
    cx.fill();

    // graines
    cx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 14; i++) {
      const sx = left + 24 + ((i * 37) % (right - left - 48));
      const sy = midY + Math.sin(i * 1.7) * 10;
      cx.beginPath();
      cx.arc(sx, sy, 1.6, 0, Math.PI * 2);
      cx.fill();
    }

    // découpes
    cx.strokeStyle = "#f4f5f8";
    cx.lineWidth = 2.5;
    cuts.forEach((cutX) => {
      cx.beginPath();
      cx.moveTo(cutX, top - 6);
      cx.lineTo(cutX, bottom + 6);
      cx.stroke();
    });

    // petites étincelles de découpe
    const now = performance.now();
    crumbs.forEach((c) => {
      const age = now - c.born;
      const alpha = Math.max(0, 1 - age / 500);
      cx.fillStyle = `rgba(244,245,248,${alpha})`;
      cx.beginPath();
      cx.arc(c.x + 8, c.y - 10 - age * 0.04, 2, 0, Math.PI * 2);
      cx.arc(c.x - 7, c.y - 6 - age * 0.03, 1.6, 0, Math.PI * 2);
      cx.fill();
    });
  }

  async function finish() {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    const ms = Math.round(performance.now() - startTime);
    const outcome = await ctx.finish(ms);
    showResult(container, ctx, ms, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
  };
}
