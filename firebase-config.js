// ============================================================================
// Récré — connexion au classement partagé (Firebase Firestore, gratuit)
//
// Les identifiants Firebase eux-mêmes vivent dans firebase-keys.js (à côté de
// ce fichier), volontairement séparés : ce fichier-ci (firebase-config.js)
// est réécrit à chaque mise à jour de l'appli, alors que firebase-keys.js ne
// doit JAMAIS être remplacé une fois configuré. Voir firebase-keys.js pour
// la marche à suivre.
//
// Tant que firebase-keys.js n'est pas configuré, Récré fonctionne quand
// même : les scores sont juste gardés en local sur l'appareil (mode solo),
// le temps que tu branches Firebase pour un vrai classement entre amis.
// ============================================================================

import { firebaseConfig } from "./firebase-keys.js";

const CONFIG = firebaseConfig;

const SDK_APP = "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
const SDK_FIRESTORE = "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const backendMode = CONFIG.apiKey === "REMPLACE_MOI" ? "local" : "cloud";

let cloudPromise = null;
async function cloud() {
  if (!cloudPromise) {
    cloudPromise = (async () => {
      const [{ initializeApp }, fs] = await Promise.all([
        import(SDK_APP),
        import(SDK_FIRESTORE),
      ]);
      const app = initializeApp(CONFIG);
      const db = fs.getFirestore(app);
      return { db, fs };
    })();
  }
  return cloudPromise;
}

// ---------- API publique ----------

// Un seul score conservé par (jeu, joueur [, jour pour le Défi du jour]) : on
// ne garde que le meilleur — pas un historique de toutes les parties jouées.
// `better` indique le sens de comparaison ("low" = un temps par ex., "high"
// = un score classique).
function isImprovement(better, newValue, oldValue) {
  return better === "low" ? newValue < oldValue : newValue > oldValue;
}

export async function submitScore({ game, player, value, meta = {}, date = null, better = "high" }) {
  const row = { game, player, value, meta, date, createdAt: Date.now() };
  if (backendMode === "cloud") {
    try {
      const { db, fs } = await cloud();
      const clauses = [fs.where("game", "==", game), fs.where("player", "==", player)];
      if (date) clauses.push(fs.where("date", "==", date));
      const existing = await fs.getDocs(fs.query(fs.collection(db, "scores"), ...clauses, fs.limit(1)));
      if (existing.empty) {
        await fs.addDoc(fs.collection(db, "scores"), { ...row, createdAt: fs.serverTimestamp() });
      } else if (isImprovement(better, value, existing.docs[0].data().value)) {
        await fs.setDoc(existing.docs[0].ref, { ...row, createdAt: fs.serverTimestamp() });
      }
      // sinon : pas une amélioration, on ne réécrit rien (le meilleur score reste en place)
      return "cloud";
    } catch (err) {
      console.error("[Récré] envoi cloud impossible, sauvegarde locale à la place :", err);
    }
  }
  submitScoreLocal(row, better);
  return "local";
}

export async function getLeaderboard(game, order = "asc", limitN = 10, dateEq = null) {
  if (backendMode === "cloud") {
    try {
      const { db, fs } = await cloud();
      const clauses = [fs.where("game", "==", game)];
      if (dateEq) clauses.push(fs.where("date", "==", dateEq));
      const q = fs.query(
        fs.collection(db, "scores"),
        ...clauses,
        fs.orderBy("value", order),
        fs.limit(limitN)
      );
      const snap = await fs.getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (err) {
      console.error("[Récré] lecture cloud impossible, classement local à la place :", err);
    }
  }
  return getLeaderboardLocal(game, order, limitN, dateEq);
}

// ---------- Commentaires (livre d'or partagé) ----------

export async function submitComment({ player, text }) {
  const row = { player, text, createdAt: Date.now() };
  if (backendMode === "cloud") {
    try {
      const { db, fs } = await cloud();
      await fs.addDoc(fs.collection(db, "comments"), {
        ...row,
        createdAt: fs.serverTimestamp(),
      });
      return "cloud";
    } catch (err) {
      console.error("[Récré] envoi du commentaire impossible en cloud, sauvegarde locale à la place :", err);
    }
  }
  submitCommentLocal(row);
  return "local";
}

export async function getComments(limitN = 50) {
  if (backendMode === "cloud") {
    try {
      const { db, fs } = await cloud();
      const q = fs.query(fs.collection(db, "comments"), fs.orderBy("createdAt", "desc"), fs.limit(limitN));
      const snap = await fs.getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (err) {
      console.error("[Récré] lecture cloud des commentaires impossible, liste locale à la place :", err);
    }
  }
  return getCommentsLocal(limitN);
}

// ---------- Repli local (localStorage) ----------

const LOCAL_KEY = "recre.scores.v1";
const LOCAL_COMMENTS_KEY = "recre.comments.v1";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function submitScoreLocal(row, better = "high") {
  const rows = readLocal();
  const idx = rows.findIndex(
    (r) => r.game === row.game && r.player === row.player && (row.date ? r.date === row.date : !r.date)
  );
  if (idx === -1) {
    rows.push(row);
  } else if (isImprovement(better, row.value, rows[idx].value)) {
    rows[idx] = row;
  }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
  } catch (err) {
    console.error("[Récré] impossible d'écrire dans localStorage", err);
  }
}

function getLeaderboardLocal(game, order, limitN, dateEq) {
  const rows = readLocal().filter((r) => r.game === game && (!dateEq || r.date === dateEq));
  rows.sort((a, b) => (order === "asc" ? a.value - b.value : b.value - a.value));
  return rows.slice(0, limitN);
}

function readLocalComments() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_COMMENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function submitCommentLocal(row) {
  const rows = readLocalComments();
  rows.push(row);
  try {
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(rows));
  } catch (err) {
    console.error("[Récré] impossible d'écrire le commentaire dans localStorage", err);
  }
}

function getCommentsLocal(limitN) {
  const rows = readLocalComments().slice();
  rows.sort((a, b) => b.createdAt - a.createdAt);
  return rows.slice(0, limitN);
}
