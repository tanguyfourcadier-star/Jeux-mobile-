import { showResult } from "../app.js";

const DURATION_MS = 10000;

export default function mount(container, ctx) {
  let raf = null;
  let running = false;
  let taps = 0;
  let endAt = 0;

  renderIdle();

  function renderIdle() {
    container.innerHTML = "";
    container.innerHTML = `
      <div class="stage">
        <div class="stage-msg">10 secondes, un maximum de taps</div>
        <div class="stage-sub">Le bouton doré apparaît, tape dedans aussi vite que possible jusqu'à la fin du chrono.</div>
        <button class="btn btn-primary" type="button" id="start">Commencer</button>
      </div>
    `;
    container.querySelector("#start").addEventListener("click", startCountdown);
  }

  function startCountdown() {
    let n = 3;
    container.innerHTML = `<div class="stage"><div class="stage-msg mono" id="cd">${n}</div></div>`;
    const cd = document.getElementById("cd");
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(iv);
        startRun();
      } else {
        cd.textContent = String(n);
      }
    }, 700);
  }

  function startRun() {
    taps = 0;
    running = true;
    endAt = performance.now() + DURATION_MS;
    container.innerHTML = `
      <div class="hud">
        <div class="hud-stat"><div class="label">Temps</div><div class="value mono" id="time">10.0s</div></div>
        <div class="hud-stat"><div class="label">Taps</div><div class="value mono" id="count">0</div></div>
      </div>
      <div class="stage">
        <button class="rush-tap" type="button" id="tap">TAPE</button>
      </div>
    `;
    const btn = document.getElementById("tap");
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!running) return;
      taps += 1;
      document.getElementById("count").textContent = String(taps);
    });
    tick();
  }

  function tick() {
    if (!running) return;
    const remaining = Math.max(0, endAt - performance.now());
    const timeEl = document.getElementById("time");
    if (timeEl) timeEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
    if (remaining <= 0) {
      running = false;
      finishRun(taps);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  async function finishRun(score) {
    const outcome = await ctx.finish(score);
    showResult(container, ctx, score, outcome, {
      onReplay: renderIdle,
    });
  }

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  };
}
