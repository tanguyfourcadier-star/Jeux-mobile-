// ============================================================================
// Tes identifiants Firebase personnels — RIEN D'AUTRE que ça dans ce fichier.
//
// IMPORTANT : quand tu mets à jour Récré avec une nouvelle version que je te
// donne, NE REMPLACE PAS ce fichier par celui du nouveau dossier si tu l'as
// déjà configuré. Copie tous les autres fichiers, mais garde CELUI-CI tel
// quel — sinon ta config Firebase revient à zéro et l'appli repasse en mode
// local (scores non partagés) sans prévenir. C'est fait exprès : en séparant
// tes identifiants dans leur propre fichier, une mise à jour de l'appli ne
// peut plus jamais les écraser par erreur.
//
// Comment le remplir (une seule fois) :
// 1. https://console.firebase.google.com → "Ajouter un projet" (gratuit).
// 2. Dans le projet : Build → Firestore Database → "Créer une base de données"
//    (mode production), région au choix (ex: eur3).
// 3. Onglet "Règles" de Firestore → colle le contenu de firestore.rules.txt →
//    "Publier".
// 4. Roue crantée (Paramètres du projet) → tout en bas → "Vos applications" →
//    icône "</>" → donne-lui un nom → copie l'objet affiché.
// 5. Colle-le ci-dessous à la place de l'objet REMPLACE_MOI.
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCJ6yG0la50nDwD8Ufuq-3nc8liO8-rfHw",
  authDomain: "jeux-d56af.firebaseapp.com",
  projectId: "jeux-d56af",
  storageBucket: "jeux-d56af.firebasestorage.app",
  messagingSenderId: "379516167783",
  appId: "1:379516167783:web:5651d121b3eb2b493796c2",
};
