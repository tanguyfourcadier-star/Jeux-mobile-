import { showResult } from "../app.js";

export default function mount(container, ctx) {
  let phase = "idle"; // idle | waiting | go | done
  let timeoutId = null;
  let goAt = 0;

  render();

  function render() {
    container.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "big-tap state-wait";
    btn.innerHTML = `
      <span class="msg">${label()}</span>
      <span class="sub">${sub()}</span>
    `;
    btn.addEventListener("click", onTap);
    container.appendChild(btn);
    updateVisual(btn);
  }

  function label() {
    if (phase === "idle") return "Touche pour commencer";
    if (phase === "waiting") return "Attends…";
    if (phase === "go") return "MAINTENANT !";
    return "";
  }
  function sub() {
    if (phase === "idle") return "Tape dès que le fond devient vert";
    if (phase === "waiting") return "Ne tape pas trop tôt";
    if (phase === "go") return "Tape !";
    return "";
  }
  function updateVisual(btn) {
    btn.classList.remove("state-wait", "state-armed", "state-go", "state-early");
    btn.classList.add(phase === "go" ? "state-go" : phase === "waiting" ? "state-armed" : "state-wait");
  }

  function onTap() {
    if (phase === "idle") {
      phase = "waiting";
      render();
      const delay = 1200 + Math.random() * 2600;
      timeoutId = setTimeout(() => {
        phase = "go";
        goAt = performance.now();
        render();
      }, delay);
      return;
    }
    if (phase === "waiting") {
      clearTimeout(timeoutId);
      phase = "idle";
      container.innerHTML = "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "big-tap state-early";
      btn.innerHTML = `<span class="msg">Trop tôt !</span><span class="sub">Retape pour réessayer</span>`;
      btn.addEventListener("click", () => {
        phase = "idle";
        render();
      });
      container.appendChild(btn);
      return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - goAt);
      phase = "done";
      finishRun(ms);
    }
  }

  async function finishRun(ms) {
    const outcome = await ctx.finish(ms);
    showResult(container, ctx, ms, outcome, {
      onReplay: () => {
        phase = "idle";
        render();
      },
    });
  }

  return () => clearTimeout(timeoutId);
}
