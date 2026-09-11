import { showResult } from "../app.js";

const TOTAL_STEPS = 30;
const START_WINDOW = 1000;
const MIN_WINDOW = 420;

const ARROWS = {
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  left: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
  right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
};
const DIRS = ["up", "down", "left", "right"];

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let progress = 0;
  let current = "up";
  let startTime = 0;
  let stepTimeout = null;

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">30 marches</div>
        <div class="stage-sub">Une flèche s'affiche : appuie sur le bon bouton pour avancer d'une marche. Une erreur (ou trop lent) te fait redescendre de 2. Ça accélère au fil de la montée.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    progress = 0;
    running = true;
    startTime = performance.now();
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">0.0s</div></div>
        <div class="hud-stat"><div class="label">Marche</div><div class="value mono" id="step">0 / ${TOTAL_STEPS}</div></div>
      </div>
      <div class="stage">
        <div class="progress-bar"><div class="progress-fill" id="fill" style="width:0%"></div></div>
        <div class="qte-prompt" id="prompt"><svg viewBox="0 0 24 24"></svg></div>
        <div class="dpad">
          <button type="button" class="dpad-up" data-dir="up"><svg viewBox="0 0 24 24">${ARROWS.up}</svg></button>
          <button type="button" class="dpad-left" data-dir="left"><svg viewBox="0 0 24 24">${ARROWS.left}</svg></button>
          <button type="button" class="dpad-down" data-dir="down"><svg viewBox="0 0 24 24">${ARROWS.down}</svg></button>
          <button type="button" class="dpad-right" data-dir="right"><svg viewBox="0 0 24 24">${ARROWS.right}</svg></button>
        </div>
      </div>
    `;
    container.querySelectorAll(".dpad button").forEach((btn) => {
      btn.addEventListener("click", () => onPress(btn.dataset.dir));
    });
    tickTime();
    nextPrompt();
  }

  function tickTime() {
    if (!running || cancelled) return;
    const timeEl = document.getElementById("time");
    if (timeEl) timeEl.textContent = `${((performance.now() - startTime) / 1000).toFixed(1)}s`;
    requestAnimationFrame(tickTime);
  }

  function windowForProgress() {
    const ratio = Math.min(1, progress / TOTAL_STEPS);
    return START_WINDOW - ratio * (START_WINDOW - MIN_WINDOW);
  }

  function nextPrompt() {
    if (!running || cancelled) return;
    current = DIRS[Math.floor(Math.random() * DIRS.length)];
    const prompt = document.getElementById("prompt");
    if (prompt) {
      prompt.innerHTML = `<svg viewBox="0 0 24 24">${ARROWS[current]}</svg>`;
      prompt.classList.remove("is-wrong");
      prompt.dataset.dir = current;
    }
    clearTimeout(stepTimeout);
    stepTimeout = setTimeout(() => onMiss(), windowForProgress());
  }

  function onPress(dir) {
    if (!running || cancelled) return;
    if (dir === current) {
      clearTimeout(stepTimeout);
      progress = Math.min(TOTAL_STEPS, progress + 1);
      updateHud();
      if (progress >= TOTAL_STEPS) {
        finish();
        return;
      }
      nextPrompt();
    } else {
      onMiss();
    }
  }

  function onMiss() {
    if (!running || cancelled) return;
    clearTimeout(stepTimeout);
    progress = Math.max(0, progress - 2);
    updateHud();
    const prompt = document.getElementById("prompt");
    if (prompt) prompt.classList.add("is-wrong");
    setTimeout(() => {
      if (running && !cancelled) nextPrompt();
    }, 260);
  }

  function updateHud() {
    const stepEl = document.getElementById("step");
    const fillEl = document.getElementById("fill");
    if (stepEl) stepEl.textContent = `${progress} / ${TOTAL_STEPS}`;
    if (fillEl) fillEl.style.width = `${(progress / TOTAL_STEPS) * 100}%`;
  }

  async function finish() {
    running = false;
    clearTimeout(stepTimeout);
    const ms = Math.round(performance.now() - startTime);
    const outcome = await ctx.finish(ms);
    showResult(container, ctx, ms, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    clearTimeout(stepTimeout);
  };
}
