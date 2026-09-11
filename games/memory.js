import { showResult } from "../app.js";

const PAD_COUNT = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function mount(container, ctx) {
  let cancelled = false;
  let sequence = [];
  let playerIndex = 0;
  let accepting = false;

  renderIdle();

  function renderShell() {
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Niveau</div><div class="value mono" id="lvl">0</div></div>
        <div class="hud-stat"><div class="label">Statut</div><div class="value" id="status" style="font-size:.95rem">—</div></div>
      </div>
      <div class="stage">
        <div class="simon-grid" id="grid">
          ${Array.from({ length: PAD_COUNT })
            .map((_, i) => `<button class="simon-pad" type="button" data-i="${i}"></button>`)
            .join("")}
        </div>
      </div>
    `;
    container.querySelectorAll(".simon-pad").forEach((pad) => {
      pad.addEventListener("click", () => onPad(Number(pad.dataset.i)));
    });
  }

  function renderIdle() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "stage";
    wrap.innerHTML = `
      <div class="stage-msg">Prêt à mémoriser ?</div>
      <div class="stage-sub">Regarde la séquence de couleurs, puis reproduis-la. Elle s'allonge à chaque tour.</div>
      <button class="btn btn-primary" type="button" id="start">Commencer</button>
    `;
    container.appendChild(wrap);
    wrap.querySelector("#start").addEventListener("click", () => {
      sequence = [];
      startRound();
    });
  }

  async function startRound() {
    sequence.push(Math.floor(Math.random() * PAD_COUNT));
    playerIndex = 0;
    renderShell();
    setStatus(`Regarde bien…`);
    document.getElementById("lvl").textContent = String(sequence.length);
    accepting = false;
    await sleep(500);
    for (const i of sequence) {
      if (cancelled) return;
      await lightPad(i);
      if (cancelled) return;
      await sleep(180);
    }
    if (cancelled) return;
    accepting = true;
    setStatus("À toi de jouer");
  }

  async function lightPad(i) {
    const pad = container.querySelector(`.simon-pad[data-i="${i}"]`);
    if (!pad) return;
    pad.classList.add("lit");
    await sleep(360);
    if (cancelled) return;
    pad.classList.remove("lit");
  }

  function setStatus(msg) {
    const s = document.getElementById("status");
    if (s) s.textContent = msg;
  }

  async function onPad(i) {
    if (!accepting || cancelled) return;
    const pad = container.querySelector(`.simon-pad[data-i="${i}"]`);
    pad.classList.add("lit");
    setTimeout(() => pad.classList.remove("lit"), 160);

    if (i === sequence[playerIndex]) {
      playerIndex++;
      if (playerIndex === sequence.length) {
        accepting = false;
        setStatus("Bravo, tour suivant…");
        await sleep(650);
        if (cancelled) return;
        startRound();
      }
      return;
    }
    // erreur -> fin de partie
    accepting = false;
    const score = sequence.length - 1;
    finishRun(score);
  }

  async function finishRun(score) {
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, {
      onReplay: () => {
        sequence = [];
        startRound();
      },
    });
  }

  return () => {
    cancelled = true;
  };
}
