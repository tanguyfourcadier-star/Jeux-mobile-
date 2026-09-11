import { showResult } from "../app.js";

const TARGET_COUNT = 8;
const MISS_PENALTY_MS = 300;
const RADIUS_PX = 30;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTargets(seed) {
  const rand = mulberry32(seed);
  const targets = [];
  for (let i = 0; i < TARGET_COUNT; i++) {
    targets.push({
      x: 14 + rand() * 72, // %
      y: 14 + rand() * 72, // %
    });
  }
  return targets;
}

export default function mount(container, ctx) {
  let misses = 0;
  let idx = 0;
  let startAt = 0;
  let targets = [];
  let cancelled = false;

  if (ctx.dailyAlreadyPlayed()) {
    renderAlreadyDone();
  } else {
    renderIntro();
  }

  function renderAlreadyDone() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "stage";
    wrap.innerHTML = `
      <div class="stage-msg">Déjà joué aujourd'hui</div>
      <div class="stage-sub">Ton temps du jour : <b>${ctx.formatValue(ctx.dailyResult())}</b>. Reviens demain pour un nouveau défi, même heure pour tout le monde.</div>
      <button class="btn btn-ghost" type="button" id="home">Retour</button>
    `;
    container.appendChild(wrap);
    wrap.querySelector("#home").addEventListener("click", ctx.goHome);
  }

  function renderIntro() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "stage";
    wrap.innerHTML = `
      <div class="stage-msg">${TARGET_COUNT} cibles, un seul essai</div>
      <div class="stage-sub">Les cibles apparaissent au même endroit pour tout le monde aujourd'hui. Touche-les le plus vite possible — une cible ratée ajoute une pénalité de ${MISS_PENALTY_MS} ms.</div>
      <button class="btn btn-primary" type="button" id="start">Commencer le défi</button>
    `;
    container.appendChild(wrap);
    wrap.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    targets = buildTargets(ctx.dailySeed());
    idx = 0;
    misses = 0;
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Cible</div><div class="value mono" id="idx">1 / ${TARGET_COUNT}</div></div>
        <div class="hud-stat"><div class="label">Ratés</div><div class="value mono" id="miss">0</div></div>
      </div>
      <div class="stage" id="field" style="min-height:280px;max-height:42vh;touch-action:none;"></div>
    `;
    const field = document.getElementById("field");
    field.addEventListener("pointerdown", onFieldTap);
    startAt = performance.now();
    placeTarget();
  }

  function placeTarget() {
    const field = document.getElementById("field");
    field.querySelectorAll(".daily-target").forEach((n) => n.remove());
    const t = targets[idx];
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "daily-target";
    dot.style.cssText = `
      position:absolute;left:${t.x}%;top:${t.y}%;transform:translate(-50%,-50%);
      width:${RADIUS_PX * 2}px;height:${RADIUS_PX * 2}px;border-radius:50%;
      background:var(--violet);border:none;box-shadow:0 0 0 6px var(--violet-dim);
    `;
    dot.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      onHit();
    });
    field.appendChild(dot);
  }

  function onFieldTap() {
    if (cancelled) return;
    misses += 1;
    const missEl = document.getElementById("miss");
    if (missEl) missEl.textContent = String(misses);
  }

  function onHit() {
    if (cancelled) return;
    idx += 1;
    if (idx >= TARGET_COUNT) {
      const elapsed = performance.now() - startAt;
      const score = Math.round(elapsed + misses * MISS_PENALTY_MS);
      finishRun(score);
      return;
    }
    document.getElementById("idx").textContent = `${idx + 1} / ${TARGET_COUNT}`;
    placeTarget();
  }

  async function finishRun(score) {
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, {
      note: "Prochain défi demain",
    });
  }

  return () => {
    cancelled = true;
  };
}
