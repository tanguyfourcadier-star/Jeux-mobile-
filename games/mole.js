import { showResult } from "../app.js";

const HOLE_COUNT = 9;
const DURATION_MS = 30000;

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let score = 0;
  let endAt = 0;
  let spawnTimeout = null;
  let hideTimeout = null;
  let hudRaf = null;
  let activeHole = -1;

  renderIntro();

  function renderIntro() {
    container.innerHTML = "";
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">30 secondes de taupes</div>
        <div class="stage-sub">Une taupe sort au hasard, tape-la avant qu'elle ne redescende. Ça accélère au fil du temps.</div>
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
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">30.0s</div></div>
        <div class="hud-stat"><div class="label">Taupes</div><div class="value mono" id="score">0</div></div>
      </div>
      <div class="stage">
        <div class="mole-grid" id="grid">
          ${Array.from({ length: HOLE_COUNT })
            .map((_, i) => `<button class="mole-hole" type="button" data-i="${i}"></button>`)
            .join("")}
        </div>
      </div>
    `;
    container.querySelectorAll(".mole-hole").forEach((hole) => {
      hole.addEventListener("pointerdown", () => onHoleTap(Number(hole.dataset.i)));
    });
    scheduleSpawn(600);
    hudTick();
  }

  function elapsedRatio() {
    return 1 - Math.max(0, endAt - performance.now()) / DURATION_MS;
  }

  function scheduleSpawn(delay) {
    if (cancelled || !running) return;
    spawnTimeout = setTimeout(spawnMole, delay);
  }

  function spawnMole() {
    if (cancelled || !running) return;
    if (performance.now() >= endAt) return finish();
    const holes = container.querySelectorAll(".mole-hole");
    if (!holes.length) return;
    activeHole = Math.floor(Math.random() * holes.length);
    holes[activeHole].classList.add("up");
    const visible = Math.max(420, 950 - elapsedRatio() * 500);
    hideTimeout = setTimeout(() => {
      if (holes[activeHole]) holes[activeHole].classList.remove("up");
      activeHole = -1;
      const gap = Math.max(220, 500 - elapsedRatio() * 300);
      scheduleSpawn(gap);
    }, visible);
  }

  function onHoleTap(i) {
    if (!running || cancelled) return;
    const hole = container.querySelector(`.mole-hole[data-i="${i}"]`);
    if (i === activeHole && hole.classList.contains("up")) {
      score += 1;
      hole.classList.remove("up");
      activeHole = -1;
      const scoreEl = document.getElementById("score");
      if (scoreEl) scoreEl.textContent = String(score);
      clearTimeout(hideTimeout);
      scheduleSpawn(150);
    }
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
    clearTimeout(hideTimeout);
    if (hudRaf) cancelAnimationFrame(hudRaf);
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    clearTimeout(spawnTimeout);
    clearTimeout(hideTimeout);
    if (hudRaf) cancelAnimationFrame(hudRaf);
  };
}
