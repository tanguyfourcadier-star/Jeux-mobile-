import { showResult } from "../app.js";

const DURATION_MS = 20000;
const START_VISIBLE = 900;
const MIN_VISIBLE = 480;
const RADIUS_PX = 26;

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let score = 0;
  let endAt = 0;
  let spawnTimeout = null;
  let hudRaf = null;

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">Visée Express</div>
        <div class="stage-sub">20 secondes, des cibles apparaissent au hasard. +1 par cible touchée, -2 si tu tapes à côté. Rejouable à volonté pour t'entraîner.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    score = 0;
    running = true;
    endAt = performance.now() + DURATION_MS;
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">20.0s</div></div>
        <div class="hud-stat"><div class="label">Score</div><div class="value mono" id="hits">0</div></div>
      </div>
      <div class="stage" id="field" style="min-height:280px;max-height:42vh;touch-action:none;"></div>
    `;
    document.getElementById("field").addEventListener("pointerdown", onFieldMiss);
    spawnTarget();
    hudTick();
  }

  function onFieldMiss() {
    if (!running || cancelled) return;
    score = Math.max(0, score - 2);
    const hitsEl = document.getElementById("hits");
    if (hitsEl) hitsEl.textContent = String(score);
    ctx.toast("-2");
  }

  function elapsedRatio() {
    return 1 - Math.max(0, endAt - performance.now()) / DURATION_MS;
  }

  function spawnTarget() {
    if (!running || cancelled) return;
    if (performance.now() >= endAt) return finish();
    const field = document.getElementById("field");
    if (!field) return;
    field.querySelectorAll(".aim-target").forEach((n) => n.remove());
    const x = 12 + Math.random() * 76;
    const y = 12 + Math.random() * 76;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "aim-target";
    dot.style.cssText = `left:${x}%;top:${y}%;transform:translate(-50%,-50%);width:${RADIUS_PX * 2}px;height:${RADIUS_PX * 2}px;`;
    dot.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      onHit(dot);
    });
    field.appendChild(dot);
    const visible = Math.max(MIN_VISIBLE, START_VISIBLE - elapsedRatio() * (START_VISIBLE - MIN_VISIBLE));
    spawnTimeout = setTimeout(() => {
      if (dot.isConnected) {
        spawnTarget();
      }
    }, visible);
  }

  function onHit(dot) {
    if (!running || cancelled) return;
    clearTimeout(spawnTimeout);
    score += 1;
    dot.remove();
    const hitsEl = document.getElementById("hits");
    if (hitsEl) hitsEl.textContent = String(score);
    spawnTarget();
  }

  function hudTick() {
    if (!running || cancelled) return;
    const remaining = Math.max(0, endAt - performance.now());
    const timeEl = document.getElementById("time");
    if (timeEl) timeEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
    if (remaining <= 0) {
      finish();
      return;
    }
    hudRaf = requestAnimationFrame(hudTick);
  }

  async function finish() {
    if (!running) return;
    running = false;
    clearTimeout(spawnTimeout);
    if (hudRaf) cancelAnimationFrame(hudRaf);
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    clearTimeout(spawnTimeout);
    if (hudRaf) cancelAnimationFrame(hudRaf);
  };
}
