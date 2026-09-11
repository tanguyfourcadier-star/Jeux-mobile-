import { showResult } from "../app.js";

const DURATION_MS = 45000;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeQuestion() {
  const op = ["+", "−", "×"][randInt(0, 2)];
  let a, b, answer;
  if (op === "+") {
    a = randInt(3, 40);
    b = randInt(3, 40);
    answer = a + b;
  } else if (op === "−") {
    a = randInt(5, 50);
    b = randInt(1, a);
    answer = a - b;
  } else {
    a = randInt(2, 12);
    b = randInt(2, 12);
    answer = a * b;
  }
  const choices = new Set([answer]);
  while (choices.size < 4) {
    const spread = Math.max(2, Math.round(Math.abs(answer) * 0.25)) || 3;
    const decoy = answer + randInt(-spread, spread) * (randInt(0, 1) ? 1 : -1) + randInt(1, 3);
    if (decoy !== answer && decoy >= 0) choices.add(decoy);
  }
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { text: `${a} ${op} ${b}`, answer, choices: arr };
}

export default function mount(container, ctx) {
  let running = false;
  let cancelled = false;
  let score = 0;
  let endAt = 0;
  let raf = null;
  let locked = false;

  renderIntro();

  function renderIntro() {
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">45 secondes de calcul mental</div>
        <div class="stage-sub">Additions, soustractions, multiplications. Touche la bonne réponse le plus vite possible, aucune pénalité si tu te trompes.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startRun);
  }

  function startRun() {
    score = 0;
    running = true;
    locked = false;
    endAt = performance.now() + DURATION_MS;
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">45.0s</div></div>
        <div class="hud-stat"><div class="label">Score</div><div class="value mono" id="score">0</div></div>
      </div>
      <div class="stage" id="stage"></div>
    `;
    nextQuestion();
    raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (!running || cancelled) return;
    const remaining = Math.max(0, endAt - performance.now());
    const timeEl = document.getElementById("time");
    if (timeEl) timeEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
    if (remaining <= 0) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function nextQuestion() {
    if (!running || cancelled) return;
    locked = false;
    const q = makeQuestion();
    const stage = document.getElementById("stage");
    if (!stage) return;
    stage.innerHTML = `
      <div class="choice-question mono">${q.text}</div>
      <div class="choice-grid">
        ${q.choices.map((c) => `<button class="choice-btn" type="button" data-v="${c}">${c}</button>`).join("")}
      </div>
    `;
    stage.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => onAnswer(btn, Number(btn.dataset.v), q.answer));
    });
  }

  function onAnswer(btn, value, answer) {
    if (locked || !running) return;
    locked = true;
    const stage = document.getElementById("stage");
    stage.querySelectorAll(".choice-btn").forEach((b) => {
      if (Number(b.dataset.v) === answer) b.classList.add("is-correct");
      else if (b === btn) b.classList.add("is-wrong");
    });
    if (value === answer) {
      score += 1;
      const scoreEl = document.getElementById("score");
      if (scoreEl) scoreEl.textContent = String(score);
    }
    setTimeout(nextQuestion, 380);
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
  };
}
