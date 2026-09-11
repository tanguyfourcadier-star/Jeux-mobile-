import { submitScore, getLeaderboard, backendMode } from "./firebase-config.js";

// ---------------------------------------------------------------------------
// Registre des jeux
// ---------------------------------------------------------------------------

const ICONS = {
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  tap: '<circle cx="12" cy="12" r="3.2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  car: '<path d="M4 16 6 9h12l2 7"/><rect x="2.5" y="16" width="19" height="4.5" rx="1.6"/><circle cx="7.5" cy="20.5" r="1.6"/><circle cx="16.5" cy="20.5" r="1.6"/>',
};

export const GAMES = [
  {
    id: "reflex",
    name: "Réflexes",
    tagline: "Tape dès que ça devient vert",
    accent: "coral",
    unit: "ms",
    better: "low",
    icon: ICONS.bolt,
  },
  {
    id: "memory",
    name: "Mémoire",
    tagline: "Retiens la séquence, elle s'allonge à chaque tour",
    accent: "cyan",
    unit: "niveau",
    better: "high",
    icon: ICONS.grid,
  },
  {
    id: "taprush",
    name: "Tap Rush",
    tagline: "Un maximum de taps en 10 secondes",
    accent: "gold",
    unit: "taps",
    better: "high",
    icon: ICONS.tap,
  },
  {
    id: "daily",
    name: "Défi du jour",
    tagline: "Le même défi pour tout le monde, 1 essai par jour",
    accent: "violet",
    unit: "ms",
    better: "low",
    icon: ICONS.target,
    daily: true,
  },
  {
    id: "runner",
    name: "Course",
    tagline: "Évite les obstacles le plus longtemps possible",
    accent: "mint",
    unit: "s",
    better: "high",
    icon: ICONS.car,
  },
];

export function gameById(id) {
  return GAMES.find((g) => g.id === id);
}

export function formatValue(game, value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (game.unit === "ms") return `${Math.round(value)} ms`;
  if (game.unit === "s") return `${value.toFixed(1)} s`;
  if (game.unit === "niveau") return `niveau ${Math.round(value)}`;
  return `${Math.round(value)} ${game.unit}`;
}

// ---------------------------------------------------------------------------
// État local (joueur, records perso, cache de noms connus)
// ---------------------------------------------------------------------------

const LS_PLAYER = "recre.player";
const LS_BESTS = "recre.bests.v1";
const LS_KNOWN = "recre.knownPlayers.v1";
const LS_DAILY_PREFIX = "recre.daily.";

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPlayer() {
  return localStorage.getItem(LS_PLAYER) || "";
}
function setPlayer(name) {
  localStorage.setItem(LS_PLAYER, name);
}

function getBests() {
  try {
    return JSON.parse(localStorage.getItem(LS_BESTS) || "{}");
  } catch {
    return {};
  }
}
function setBestIfBetter(gameId, value) {
  const bests = getBests();
  const current = bests[gameId];
  const game = gameById(gameId);
  const isBetter =
    current == null || (game.better === "low" ? value < current : value > current);
  if (isBetter) {
    bests[gameId] = value;
    localStorage.setItem(LS_BESTS, JSON.stringify(bests));
  }
  return isBetter;
}

function getKnownPlayers() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KNOWN) || "[]"));
  } catch {
    return new Set();
  }
}
function rememberPlayers(names) {
  const set = getKnownPlayers();
  names.forEach((n) => n && set.add(n));
  localStorage.setItem(LS_KNOWN, JSON.stringify([...set].slice(0, 40)));
}

export function dailyAlreadyPlayed() {
  return localStorage.getItem(LS_DAILY_PREFIX + todayKey()) != null;
}
export function dailyResult() {
  const raw = localStorage.getItem(LS_DAILY_PREFIX + todayKey());
  return raw == null ? null : Number(raw);
}
export function markDailyPlayed(value) {
  localStorage.setItem(LS_DAILY_PREFIX + todayKey(), String(value));
}
export function dailySeed() {
  // entier stable pour la journée en cours -> même défi pour tout le monde
  const k = todayKey();
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h;
}

// ---------------------------------------------------------------------------
// Petit utilitaire DOM
// ---------------------------------------------------------------------------

const view = document.getElementById("view");
const tabbar = document.getElementById("tabbar");
const playerLabel = document.getElementById("player-label");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let toastTimer = null;
export function toast(msg, ms = 1800) {
  const tpl = document.getElementById("tpl-toast");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.textContent = msg;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("is-visible"));
  clearTimeout(toastTimer);
  setTimeout(() => {
    node.classList.remove("is-visible");
    setTimeout(() => node.remove(), 250);
  }, ms);
}

// ---------------------------------------------------------------------------
// Modale identité joueur
// ---------------------------------------------------------------------------

function openPlayerModal({ forceChoice = false } = {}) {
  const known = [...getKnownPlayers()].filter((n) => n !== getPlayer());
  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal-card">
        <h2>${forceChoice ? "Comment tu t'appelles ?" : "Changer de pseudo"}</h2>
        <p>Ce nom sert à te reconnaître dans les classements partagés avec tes amis.</p>
        <input type="text" maxlength="18" placeholder="Ton pseudo" autocomplete="off" />
        ${
          known.length
            ? `<div class="known-players">${known
                .map((n) => `<button class="known-chip" type="button" data-name="${n}">${n}</button>`)
                .join("")}</div>`
            : ""
        }
        <button class="btn btn-primary btn-block" type="button" id="modal-save">C'est parti</button>
      </div>
    </div>
  `);
  const input = backdrop.querySelector("input");
  input.value = getPlayer();
  backdrop.querySelectorAll(".known-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.name;
      input.focus();
    });
  });
  function commit() {
    const name = input.value.trim().slice(0, 18);
    if (!name) {
      input.focus();
      return;
    }
    setPlayer(name);
    rememberPlayers([name]);
    playerLabel.textContent = name;
    backdrop.remove();
    renderCurrentView();
  }
  backdrop.querySelector("#modal-save").addEventListener("click", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit();
  });
  if (!forceChoice) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
  }
  document.body.appendChild(backdrop);
  setTimeout(() => input.focus(), 50);
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

function renderHub() {
  tabbar.hidden = false;
  setActiveTab("hub");
  const bests = getBests();
  view.innerHTML = "";
  view.appendChild(
    el(`
      <section>
        <div class="hub-head">
          <div class="eyebrow">Salut ${getPlayer() || "toi"} 👋</div>
          <h1>Choisis ton jeu</h1>
          <p>Chaque partie enregistre ton score dans le classement commun. Défie tes amis, bats tes records.</p>
        </div>
      </section>
    `)
  );
  const grid = el('<div class="tile-grid"></div>');
  GAMES.forEach((g) => {
    const isDone = g.daily && dailyAlreadyPlayed();
    const bestLine = g.daily
      ? isDone
        ? `Fait aujourd'hui : <b>${formatValue(g, dailyResult())}</b>`
        : "Pas encore joué aujourd'hui"
      : bests[g.id] != null
      ? `Ton record : <b>${formatValue(g, bests[g.id])}</b>`
      : "Pas encore de record";
    const tile = el(`
      <button class="tile ${isDone ? "is-daily-done" : ""}" style="--tile-accent:var(--${g.accent});--tile-accent-dim:var(--${g.accent}-dim);" type="button">
        <span class="tile-icon"><svg viewBox="0 0 24 24">${isDone ? '<path d="M5 13l4 4L19 7"/>' : g.icon}</svg></span>
        <span class="tile-body">
          <h3>${g.name}</h3>
          <div class="tile-best">${bestLine}</div>
        </span>
      </button>
    `);
    tile.addEventListener("click", () => openGame(g.id));
    grid.appendChild(tile);
  });
  view.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Classements
// ---------------------------------------------------------------------------

async function renderRanks() {
  tabbar.hidden = false;
  setActiveTab("ranks");
  view.innerHTML = "";
  view.appendChild(
    el(`
      <section class="ranks-head">
        <h1>Classements</h1>
        <p>${
          backendMode === "cloud"
            ? "Partagés en direct avec tous ceux qui ont le lien."
            : "Mode local : configure Firebase (voir README) pour les partager avec tes amis."
        }</p>
      </section>
    `)
  );
  const me = getPlayer();
  const namesSeen = new Set();
  for (const g of GAMES) {
    const section = el(`
      <section class="leader-section">
        <div class="leader-section-head">
          <span class="tile-icon" style="--tile-accent:var(--${g.accent});background:var(--${g.accent}-dim);"><svg viewBox="0 0 24 24" style="stroke:var(--${g.accent})">${g.icon}</svg></span>
          <h3>${g.name}</h3>
          <span class="unit">${g.daily ? "aujourd'hui" : g.better === "low" ? "moins = mieux" : "plus = mieux"}</span>
        </div>
        <div class="leader-body"><div class="leader-loading">Chargement…</div></div>
      </section>
    `);
    view.appendChild(section);
    const body = section.querySelector(".leader-body");
    const dateFilter = g.daily ? todayKey() : null;
    getLeaderboard(g.id, g.better === "low" ? "asc" : "desc", 5, dateFilter).then((rows) => {
      rows.forEach((r) => namesSeen.add(r.player));
      if (namesSeen.size) rememberPlayers([...namesSeen]);
      body.innerHTML = "";
      if (!rows.length) {
        body.appendChild(el('<div class="leader-empty">Aucun score pour l\'instant — sois le premier !</div>'));
        return;
      }
      rows.forEach((r, i) => {
        body.appendChild(
          el(`
            <div class="leader-row rank-${i + 1}">
              <span class="leader-rank">${i + 1}</span>
              <span class="leader-name ${r.player === me ? "is-me" : ""}">${r.player}</span>
              <span class="leader-value mono">${formatValue(g, r.value)}</span>
            </div>
          `)
        );
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Carte de résultat partagée entre les jeux
// ---------------------------------------------------------------------------

export function showResult(container, ctx, value, outcome, { onReplay = null, note = null } = {}) {
  container.innerHTML = "";
  const card = el(`
    <div class="result-card">
      <div class="result-label">Ton score</div>
      <div class="result-value mono">${ctx.formatValue(value)}</div>
      ${outcome.isNewBest ? '<div class="result-badge">Nouveau record perso \u{1F389}</div>' : ""}
      ${note ? `<div class="result-badge" style="color:var(--mist);background:var(--panel)">${note}</div>` : ""}
      ${
        outcome.mode === "local"
          ? '<div class="result-badge" style="color:var(--mist);background:var(--panel)">Sauvé en local (Firebase non configuré)</div>'
          : ""
      }
      <div class="result-actions">
        <button class="btn btn-ghost" id="res-home" type="button">Accueil</button>
        ${onReplay ? '<button class="btn btn-primary" id="res-again" type="button">Rejouer</button>' : ""}
      </div>
    </div>
  `);
  container.appendChild(card);
  card.querySelector("#res-home").addEventListener("click", ctx.goHome);
  if (onReplay) card.querySelector("#res-again").addEventListener("click", onReplay);
  return card;
}

// ---------------------------------------------------------------------------
// Vue jeu
// ---------------------------------------------------------------------------

let activeCleanup = null;

async function openGame(gameId) {
  const g = gameById(gameId);
  if (!g) return renderHub();
  tabbar.hidden = true;
  view.innerHTML = "";
  view.appendChild(
    el(`
      <div class="game-head">
        <button class="back-btn" id="game-back" type="button" aria-label="Retour">
          <svg viewBox="0 0 24 24"><path d="M15 19 6 12l9-7"/></svg>
        </button>
        <div>
          <h2>${g.name}</h2>
          <div class="game-tagline">${g.tagline}</div>
        </div>
      </div>
    `)
  );
  const body = el('<div id="game-body"></div>');
  view.appendChild(body);
  document.getElementById("game-back").addEventListener("click", () => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    renderHub();
  });

  const ctx = {
    player: getPlayer(),
    game: g,
    formatValue: (v) => formatValue(g, v),
    dailyAlreadyPlayed,
    dailyResult,
    markDailyPlayed,
    dailySeed,
    toast,
    goHome: () => {
      if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
      }
      renderHub();
    },
    async finish(value, meta = {}) {
      const isNewBest = !g.daily && setBestIfBetter(g.id, value);
      if (g.daily) markDailyPlayed(value);
      const mode = await submitScore({
        game: g.id,
        player: ctx.player,
        value,
        meta,
        date: g.daily ? todayKey() : null,
      });
      return { isNewBest, mode };
    },
  };

  try {
    const mod = await import(`./games/${gameId}.js`);
    const cleanup = await mod.default(body, ctx);
    activeCleanup = typeof cleanup === "function" ? cleanup : null;
  } catch (err) {
    console.error(err);
    body.appendChild(el('<p class="stage-sub">Ce jeu n\'a pas pu se charger.</p>'));
  }
}

// ---------------------------------------------------------------------------
// Navigation générale
// ---------------------------------------------------------------------------

function setActiveTab(name) {
  tabbar.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.tab === name);
  });
}

let current = "hub";
function renderCurrentView() {
  if (current === "hub") renderHub();
  else if (current === "ranks") renderRanks();
}

tabbar.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    current = btn.dataset.tab;
    renderCurrentView();
  });
});

document.getElementById("btn-home").addEventListener("click", () => {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  current = "hub";
  renderCurrentView();
});

document.getElementById("btn-player").addEventListener("click", () => openPlayerModal());

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

if (getPlayer()) {
  playerLabel.textContent = getPlayer();
  renderHub();
} else {
  playerLabel.textContent = "Choisir un pseudo";
  renderHub();
  openPlayerModal({ forceChoice: true });
}
