# Récré

Une mini appli web (installable sur l'écran d'accueil du téléphone) avec 13 jeux courts et un classement partagé entre amis. Gratuite à héberger, aucune app store, aucun serveur à maintenir.

Chaque classement affiche le **top 5**, un seul résultat par pseudo (le meilleur de chacun — pas un historique de toutes les parties jouées).

## Contenu du dossier

```
index.html            page unique de l'appli
style.css              tout le design
app.js                  hub, navigation, pseudo, classements
firebase-config.js      logique de connexion au classement partagé (réécrit à chaque mise à jour de l'appli)
firebase-keys.js        tes identifiants Firebase perso — À NE JAMAIS ÉCRASER une fois configuré (voir plus bas)
tilt-input.js           entrée "inclinaison" partagée (+ repli clavier/tactile)
firestore.rules.txt     règles de sécurité à coller dans Firebase
manifest.webmanifest    permet d'installer l'appli sur l'écran d'accueil
version.json            numéro de version publié, utilisé pour détecter les mises à jour (voir plus bas)
icon-192.png / icon-512.png / icon-512-maskable.png
games/
  reflex.js    Réflexes — temps de réaction
  memory.js    Mémoire — façon Simon, la séquence s'allonge
  taprush.js   Tap Rush — un max de taps en 10 secondes
  daily.js     Défi du jour — même défi pour tous, seedé sur la date, 1 essai/jour
  runner.js    Course — évite les obstacles le plus longtemps possible
  mole.js      Tape-taupe — 40 secondes, 3 couleurs de taupe (rouge/doré à taper, bleu à éviter), plusieurs à la fois, cadence croissante
  math.js      Calcul Éclair — 45 secondes de calcul mental à choix multiple, -1 si mauvaise réponse
  snake.js     Snake — grandis sans toucher les murs ni ta queue
  aim.js       Visée Express — 20 secondes de cibles, -2 si tu tapes à côté
  duel.js      Duel local — 2 joueurs sur le même téléphone, meilleur des 5 (pas de classement partagé)
  chrono.js    Chrono Piste — pilote un véhicule à l'inclinaison sur un parcours fixe, long et difficile, boosts permanents cumulables jusqu'à 4 (-2 au moindre choc), meilleur temps
  marches.js   30 Marches — gros boutons, barre verticale d'évolution sur le côté, erreur = -2 marches
  bille.js     Bille Folle — guide une bille à l'inclinaison (calibrée à plat) dans des zones qui changent, 60s, score max
```

Un troisième onglet **Avis** (à côté de Jeux et Classements) permet à chacun de laisser un commentaire public (240 caractères max) sous son pseudo — un mur partagé, pas de jeu ni de score associé. Même mécanique que les classements : partagé en direct si Firebase est configuré, gardé en local sinon.

**Jeux à inclinaison** (Chrono Piste, Bille Folle) : sur iPhone, Safari demande la permission d'accéder aux capteurs de mouvement au premier lancement de ces jeux (normal, propre à iOS 13+). Si elle est refusée ou indisponible (ordinateur, certains Android), ces jeux restent jouables au doigt (glisser sur l'écran) ou au clavier (flèches) — aucun blocage.

Pas de build, pas de dépendances à installer : ce sont des fichiers statiques (HTML/CSS/JS modules). GitHub Pages les sert tels quels.

## 1. Tester en local (optionnel)

Les modules JS ont besoin d'être servis en `http://`, pas ouverts directement en double-clic (`file://` bloque les imports). Depuis ce dossier :

```bash
python3 -m http.server 8000
```

puis ouvre `http://localhost:8000`. Sans configuration Firebase, l'appli fonctionne déjà en **mode local** (les scores restent sur l'appareil), ce qui permet de tout tester avant de brancher le classement partagé.

## 2. Mettre en ligne sur GitHub Pages

Tu as déjà un compte GitHub et des Pages actives, donc :

1. Copie tout le contenu de ce dossier à la racine du dépôt que tu utilises pour tes Pages (ou dans un nouveau dépôt dédié, ex. `recre`).
2. `git add . && git commit -m "Récré" && git push`.
3. Si ce n'est pas déjà fait : Settings → Pages → Source = la branche/dossier que tu viens de pousser.
4. Ton appli est en ligne sur `https://<ton-user>.github.io/<repo>/` — c'est ce lien que tu partages à tes amis.

## 3. Brancher le classement partagé (Firebase, gratuit)

Sans cette étape, chaque ami ne voit que ses propres scores (mode local). Pour un vrai classement commun :

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) → **Ajouter un projet**. Gratuit, aucune carte bancaire demandée sur le plan par défaut ("Spark").
2. Dans le projet : **Build → Firestore Database → Créer une base de données**, mode **production**, région au choix (ex. `eur3` pour l'Europe).
3. Onglet **Règles** de Firestore : colle le contenu de `firestore.rules.txt`, puis **Publier**.
4. Roue crantée (Paramètres du projet) → tout en bas, section "Vos applications" → icône `</>` (Web) → donne un nom à l'appli → Firebase affiche un objet `firebaseConfig`.
5. Ouvre **`firebase-keys.js`** (pas `firebase-config.js`) dans ce dossier, remplace l'objet `REMPLACE_MOI` par celui copié, et repousse (`git commit` + `git push`).

C'est tout : l'appli détecte automatiquement qu'elle est configurée et passe en mode partagé.

**Limite gratuite Firestore (plan Spark)** : 50 000 lectures et 20 000 écritures par jour. Pour 2 à 10 amis qui jouent régulièrement, c'est très largement suffisant — tu ne paieras jamais rien pour cet usage.

La première fois que le classement du **Défi du jour** est consulté, ou que tu joues et rejoues à un jeu (l'appli vérifie ton record existant avant chaque envoi), Firestore peut demander la création d'un index composite (il te donne un lien direct dans la console/les logs pour le créer en un clic, ~1 minute). C'est normal, ça n'arrive qu'une fois par cas d'usage.

## 4. Utiliser l'appli

- Premier lancement : demande un pseudo (visible dans les classements).
- **iPhone (Safari)** : ouvrir le lien → bouton Partager → "Sur l'écran d'accueil". L'icône Récré apparaît comme une vraie appli.
- **Android (Chrome)** : menu ⋮ → "Ajouter à l'écran d'accueil".
- Chaque partie enregistre automatiquement le score dans le classement partagé sous le pseudo choisi.

## 5. Mettre à jour une installation existante

Si tu as déjà déployé une version précédente de Récré :

1. **⚠️ Ne remplace PAS `firebase-keys.js`** si tu l'avais déjà configuré (si ton fichier actuel contient encore `REMPLACE_MOI`, tu peux l'écraser sans souci). C'est le seul fichier à traiter à part — tous les autres se remplacent sans réfléchir.
2. Remplace tous les autres fichiers de ton dépôt par ceux de ce dossier — y compris `tilt-input.js` et `firebase-config.js` à la racine. `git add . && git commit && git push`.
3. Si `games/decoupe.js` existe encore dans ton dépôt (ancienne version), supprime-le manuellement — ce jeu a été retiré et n'est plus référencé par l'appli, mais le fichier orphelin ne partira pas tout seul.
4. **Republie les règles Firestore, cette fois c'est important** : retourne dans Firebase Console → Firestore Database → **Règles**, colle le contenu à jour de `firestore.rules.txt`, **Publier**. Depuis cette version, l'appli met à jour un score existant (pour ne garder qu'un seul record par pseudo) au lieu de se contenter d'en ajouter — sans les nouvelles règles, ces mises à jour seront refusées par Firestore et l'appli basculera en sauvegarde locale à la place (pas de plantage, mais les scores ne se partageront plus tant que ce n'est pas fait).

**Si tu vois "Sauvé en local (Firebase non configuré)" alors que tu avais déjà branché Firebase** : c'est très probablement que `firebase-keys.js` a été écrasé lors d'une mise à jour précédente (avant que ce fichier existe séparément). Il suffit de refaire l'étape 5 de la section 3 ci-dessus — pas besoin de recréer un projet Firebase, tes identifiants sont toujours visibles dans Firebase Console (roue crantée → Vos applications).

## 6. Détection automatique des mises à jour

L'appli sait détecter quand une nouvelle version a été publiée pendant qu'elle est déjà ouverte (onglet resté ouvert, icône sur l'écran d'accueil) : un bandeau "Nouvelle version de Récré disponible" apparaît en haut de l'écran, avec un bouton **Mettre à jour** qui vide le cache local puis recharge la page.

Comment ça marche : `app.js` lit `version.json` une fois au chargement (sa "version en cours"), puis revérifie ce même fichier toutes les 5 minutes et à chaque fois que l'appli revient au premier plan (`version.json?t=...`, sans cache). Si le numéro a changé entre-temps, c'est qu'une nouvelle version a été poussée sur GitHub Pages → le bandeau apparaît.

**Important si tu modifies le code toi-même** : pense à changer le numéro dans `version.json` (une simple chaîne, ex. `"2026.09.12-1"`) à chaque fois que tu republies l'appli. Sans ça, personne ne sera prévenu qu'une nouvelle version existe. Si tu utilises les zips que je te fournis, c'est déjà fait à chaque livraison.

## 7. Limites à connaître

- Pas de compte/mot de passe : n'importe qui avec le lien peut jouer et écrire un score sous n'importe quel pseudo. Pensé pour un petit groupe de confiance, pas pour du public large.
- Le **Défi du jour** empêche de rejouer via une mémoire locale à l'appareil (`localStorage`) — pas une vraie authentification, donc contournable en théorie (nouvel appareil/navigateur), suffisant pour jouer entre amis.

## 8. Pour aller plus loin (pistes)

- **Duels en temps réel entre deux téléphones** : Firestore permet d'écouter les changements en direct (`onSnapshot`) — on peut ajouter un mode où deux amis, chacun sur son appareil, voient leurs scores évoluer l'un en face de l'autre pendant la partie (le **Duel local** actuel se joue à deux sur un seul téléphone, sans réseau).
- **Groupes/équipes**, **historique par semaine**, **avatars**, **nouveaux mini-jeux** (le hub dans `app.js` + un fichier dans `games/` suffit à en ajouter un).
