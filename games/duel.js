const WIN_AT = 3;

export default function mount(container, ctx) {
  let cancelled = false;
  let phase = "idle"; // idle | waiting | go | roundover
  let timeoutId = null;
  let goAt = 0;
  const scores = { top: 0, bottom: 0 };

  render();

  function render() {
    container.innerHTML = `
      <div class="duel-score mono" id="score">${scores.top} — ${scores.bottom}</div>
      <div class="duel-stack">
        <button type="button" class="duel-half duel-top ${visualState()}" id="half-top">
          <span class="msg">${message()}</span>
          <span class="sub">${sub()}</span>
        </button>
        <button type="button" class="duel-half duel-bottom ${visualState()}" id="half-bottom">
          <span class="msg">${message()}</span>
          <span class="sub">${sub()}</span>
        </button>
      </div>
    `;
    container.querySelector("#half-top").addEventListener("click", () => onTap("top"));
    container.querySelector("#half-bottom").addEventListener("click", () => onTap("bottom"));
  }

  function visualState() {
    if (phase === "waiting") return "state-armed";
    if (phase === "go") return "state-go";
    return "state-wait";
  }
  function message() {
    if (phase === "idle") return "Prêts ?";
    if (phase === "waiting") return "Attendez…";
    if (phase === "go") return "MAINTENANT !";
    return "";
  }
  function sub() {
    if (phase === "idle") return "Touchez votre côté pour lancer la manche";
    if (phase === "waiting") return "Celui qui touche trop tôt perd la manche";
    if (phase === "go") return "Touchez, le plus rapide gagne !";
    return "";
  }

  function onTap(who) {
    if (cancelled) return;
    if (phase === "idle") {
      phase = "waiting";
      render();
      const delay = 1000 + Math.random() * 2600;
      timeoutId = setTimeout(() => {
        phase = "go";
        goAt = performance.now();
        render();
      }, delay);
      return;
    }
    if (phase === "waiting") {
      clearTimeout(timeoutId);
      endRound(who === "top" ? "bottom" : "top", true);
      return;
    }
    if (phase === "go") {
      endRound(who, false);
    }
  }

  function endRound(winner, falseStart) {
    phase = "roundover";
    scores[winner] += 1;
    render();
    const label = winner === "top" ? "Haut" : "Bas";
    ctx.toast(falseStart ? `Faux départ ! Point pour ${label}` : `${label} le plus rapide !`);
    if (scores.top >= WIN_AT || scores.bottom >= WIN_AT) {
      setTimeout(() => finishMatch(scores.top >= WIN_AT ? "top" : "bottom"), 900);
    } else {
      setTimeout(() => {
        if (cancelled) return;
        phase = "idle";
        render();
      }, 1100);
    }
  }

  function finishMatch(winner) {
    const label = winner === "top" ? "Haut" : "Bas";
    container.innerHTML = `
      <div class="result-card">
        <div class="result-label">Duel terminé</div>
        <div class="result-value mono">${scores.top} — ${scores.bottom}</div>
        <div class="result-badge">${label} remporte le duel \u{1F3C6}</div>
        <div class="result-actions">
          <button class="btn btn-ghost" id="res-home" type="button">Accueil</button>
          <button class="btn btn-primary" id="res-again" type="button">Rejouer</button>
        </div>
      </div>
    `;
    container.querySelector("#res-home").addEventListener("click", ctx.goHome);
    container.querySelector("#res-again").addEventListener("click", () => {
      scores.top = 0;
      scores.bottom = 0;
      phase = "idle";
      render();
    });
  }

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}
