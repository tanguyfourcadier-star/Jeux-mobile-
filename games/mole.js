import { showResult } from "../app.js";

const HOLE_COUNT = 15; // 3 colonnes x 5 lignes
const DURATION_MS = 40000;
const MIN_LIFE = 600;
const MAX_LIFE = 1300;

const COLORS = [
  { key: "red", css: "var(--coral)", points: 1, must: true },
  { key: "blue", css: "var(--sky)", points: -2, must: false },
  { key: "gold", css: "var(--gold)", points: 3, must: true },
];
// poids de tirage : rouge fréquente, doré rare, bleu (piège) assez présent
const WEIGHTS = [0.55, 0.28, 0.17];

function pickColor() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < COLORS.length; i++) {
    acc += WEIGHTS[i];
    if (r <= acc) return COLORS[i];
  }
  return COLORS[0];
}

export default function mount(container, ctx) {
  let cancelled = false;
  let running = false;
  let score = 0;
  let endAt = 0;
  let spawnTimeout = null;
  let hudRaf = null;
  const holes = new Array(HOLE_COUNT).fill(null); // { color, hideTimeout } | null

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">40 secondes de taupes</div>
        <div class="stage-sub">Rouge = tape (+1), Doré = tape (+3), Bleu = ne tape pas (-2). Plusieurs taupes peuvent sortir en même temps, de plus en plus vite.</div>
        <div class="mole-legend">
          <span><i style="background:var(--coral)"></i>+1</span>
          <span><i style="background:var(--gold)"></i>+3</span>
          <span><i style="background:var(--sky)"></i>-2</span>
        </div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    score = 0;
    running = true;
    endAt = performance.now() + DURATION_MS;
    holes.fill(null);
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">40.0s</div></div>
        <div class="hud-stat"><div class="label">Score</div><div class="value mono" id="score">0</div></div>
      </div>
      <div class="stage">
        <div class="mole-grid" id="grid">
          ${Array.from({ length: HOLE_COUNT })
            .map((_, i) => `<button class="mole-hole" type="button" data-i="${i}"></button>`)
            .join("")}
        </div>
        <div class="mole-legend">
          <span><i style="background:var(--coral)"></i>+1</span>
          <span><i style="background:var(--gold)"></i>+3</span>
          <span><i style="background:var(--sky)"></i>-2 évite</span>
        </div>
      </div>
    `;
    container.querySelectorAll(".mole-hole").forEach((hole) => {
      hole.addEventListener("pointerdown", () => onHoleTap(Number(hole.dataset.i)));
    });
    scheduleSpawn(300);
    hudTick();
  }

  function elapsedRatio() {
    return 1 - Math.max(0, endAt - performance.now()) / DURATION_MS;
  }

  function scheduleSpawn(delay) {
    if (cancelled || !running) return;
    spawnTimeout = setTimeout(trySpawn, delay);
  }

  function spawnOne() {
    const emptyIdx = holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
    if (!emptyIdx.length) return false;
    const i = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
    const color = pickColor();
    const life = MIN_LIFE + Math.random() * (MAX_LIFE - MIN_LIFE);
    const holeEl = container.querySelector(`.mole-hole[data-i="${i}"]`);
    if (holeEl) {
      holeEl.style.setProperty("--mole-color", color.css);
      holeEl.classList.add("up");
    }
    const hideTimeout = setTimeout(() => {
      if (holes[i] && holes[i].color === color) {
        holes[i] = null;
        if (holeEl) holeEl.classList.remove("up");
      }
    }, life);
    holes[i] = { color, hideTimeout };
    return true;
  }

  function trySpawn() {
    if (cancelled || !running) return;
    if (performance.now() >= endAt) return finish();

    // plus la partie avance, plus on tente de faire sortir de taupes à la fois
    const ratio = elapsedRatio();
    const attempts = 1 + Math.floor(ratio * 2.6); // 1 à 3 tentatives
    for (let a = 0; a < attempts; a++) {
      if (!spawnOne()) break;
    }

    // cadence qui accélère avec le temps écoulé
    const nextDelay = Math.max(170, 520 - ratio * 350);
    scheduleSpawn(nextDelay);
  }

  function onHoleTap(i) {
    if (!running || cancelled) return;
    const entry = holes[i];
    if (!entry) return;
    clearTimeout(entry.hideTimeout);
    holes[i] = null;
    const holeEl = container.querySelector(`.mole-hole[data-i="${i}"]`);
    if (holeEl) holeEl.classList.remove("up");

    score = Math.max(0, score + entry.color.points);
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = String(score);
    ctx.toast(entry.color.points > 0 ? `+${entry.color.points}` : `${entry.color.points}`);
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
    holes.forEach((h) => h && clearTimeout(h.hideTimeout));
    if (hudRaf) cancelAnimationFrame(hudRaf);
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, { onReplay: startRun });
  }

  return () => {
    cancelled = true;
    running = false;
    clearTimeout(spawnTimeout);
    holes.forEach((h) => h && clearTimeout(h.hideTimeout));
    if (hudRaf) cancelAnimationFrame(hudRaf);
  };
}
