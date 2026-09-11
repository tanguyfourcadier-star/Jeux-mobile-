// ============================================================================
// Récré — connexion au classement partagé (Firebase Firestore, gratuit)
//
// 1. Va sur https://console.firebase.google.com → "Ajouter un projet" (gratuit,
//    pas de carte bancaire demandée sur le plan Spark).
// 2. Dans le projet : Build → Firestore Database → "Créer une base de données"
//    (mode production), région au choix (ex: eur3).
// 3. Dans Firestore → onglet "Règles", colle le contenu de firestore.rules.txt
//    (fourni à côté de ce fichier) puis "Publier".
// 4. Paramètres du projet (roue crantée) → tout en bas → "Vos applications" →
//    icône "</>" → donne-lui un nom → copie l'objet firebaseConfig affiché.
// 5. Colle-le ci-dessous à la place de CONFIG_PLACEHOLDER.
//
// Tant que ce fichier n'est pas configuré, Récré fonctionne quand même : les
// scores sont juste gardés en local sur l'appareil (mode solo), le temps que
// tu branches Firebase pour un vrai classement entre amis.
// ============================================================================

const CONFIG_PLACEHOLDER = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI",
};

const CONFIG = CONFIG_PLACEHOLDER;

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

export async function submitScore({ game, player, value, meta = {}, date = null }) {
  const row = { game, player, value, meta, date, createdAt: Date.now() };
  if (backendMode === "cloud") {
    try {
      const { db, fs } = await cloud();
      await fs.addDoc(fs.collection(db, "scores"), {
        ...row,
        createdAt: fs.serverTimestamp(),
      });
      return "cloud";
    } catch (err) {
      console.error("[Récré] envoi cloud impossible, sauvegarde locale à la place :", err);
    }
  }
  submitScoreLocal(row);
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

function submitScoreLocal(row) {
  const rows = readLocal();
  rows.push(row);
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
