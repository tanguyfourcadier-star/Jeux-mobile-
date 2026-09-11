# Récré

Une mini appli web (installable sur l'écran d'accueil du téléphone) avec 5 jeux courts et un classement partagé entre amis. Gratuite à héberger, aucune app store, aucun serveur à maintenir.

## Contenu du dossier

```
index.html            page unique de l'appli
style.css              tout le design
app.js                  hub, navigation, pseudo, classements
firebase-config.js      connexion au classement partagé (à configurer, voir plus bas)
firestore.rules.txt     règles de sécurité à coller dans Firebase
manifest.webmanifest    permet d'installer l'appli sur l'écran d'accueil
icon-192.png / icon-512.png / icon-512-maskable.png
games/
  reflex.js    Réflexes — temps de réaction
  memory.js    Mémoire — façon Simon, la séquence s'allonge
  taprush.js   Tap Rush — un max de taps en 10 secondes
  daily.js     Défi du jour — même défi pour tous, seedé sur la date, 1 essai/jour
  runner.js    Course — évite les obstacles le plus longtemps possible
```

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
5. Ouvre `firebase-config.js` dans ce dossier, remplace l'objet `CONFIG_PLACEHOLDER` par celui copié, et repousse (`git commit` + `git push`).

C'est tout : l'appli détecte automatiquement qu'elle est configurée et passe en mode partagé.

**Limite gratuite Firestore (plan Spark)** : 50 000 lectures et 20 000 écritures par jour. Pour 2 à 10 amis qui jouent régulièrement, c'est très largement suffisant — tu ne paieras jamais rien pour cet usage.

La première fois que le classement du **Défi du jour** est consulté, Firestore peut demander la création d'un index composite (il te donne un lien direct dans la console/les logs pour le créer en un clic, ~1 minute). C'est normal, ça n'arrive qu'une fois.

## 4. Utiliser l'appli

- Premier lancement : demande un pseudo (visible dans les classements).
- **iPhone (Safari)** : ouvrir le lien → bouton Partager → "Sur l'écran d'accueil". L'icône Récré apparaît comme une vraie appli.
- **Android (Chrome)** : menu ⋮ → "Ajouter à l'écran d'accueil".
- Chaque partie enregistre automatiquement le score dans le classement partagé sous le pseudo choisi.

## 5. Limites à connaître

- Pas de compte/mot de passe : n'importe qui avec le lien peut jouer et écrire un score sous n'importe quel pseudo. Pensé pour un petit groupe de confiance, pas pour du public large.
- Le **Défi du jour** empêche de rejouer via une mémoire locale à l'appareil (`localStorage`) — pas une vraie authentification, donc contournable en théorie (nouvel appareil/navigateur), suffisant pour jouer entre amis.

## 6. Pour aller plus loin (pistes)

- **Duels en temps réel** : Firestore permet d'écouter les changements en direct (`onSnapshot`) — on peut ajouter un mode où deux amis voient leurs scores évoluer l'un en face de l'autre pendant la partie.
- **Groupes/équipes**, **historique par semaine**, **avatars**, **nouveaux mini-jeux** (le hub dans `app.js` + un fichier dans `games/` suffit à en ajouter un).
