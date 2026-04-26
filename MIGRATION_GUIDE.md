# Guide de Migration : De Google AI Studio vers Cursor

Ce guide contient tout ce dont tu as besoin pour continuer à développer cette application sur ton ordinateur avec Cursor.

## 1. Installation des outils
- **Cursor** : Télécharge-le sur [cursor.com](https://cursor.com).
- **Node.js** : Installe la version LTS sur [nodejs.org](https://nodejs.org) (indispensable pour faire tourner l'app localement).

## 2. Récupérer le code
Puisque ton projet est sur GitHub :
1. Ouvre un terminal sur ton PC.
2. Tape : `git clone https://github.com/TON_NOM_UTILISATEUR/TON_DEPOT.git`
3. Entre dans le dossier : `cd TON_NOM_DU_PROJET`

## 3. Lancer l'app sur ton PC
Une fois dans le dossier avec ton terminal :
1. Installe les dépendances : `npm install`
2. Crée un fichier `.env` à la racine et ajoute tes clés :
   ```env
   GEMINI_API_KEY=ta_cle_ici
   VITE_FIREBASE_API_KEY=ta_cle_firebase
   ```
3. Lance le serveur de test : `npm run dev`
4. Ouvre `http://localhost:3000` dans ton navigateur.

## 4. Utiliser Cursor (Vibe Coding)
- Ouvre le dossier dans Cursor.
- `Ctrl + L` : Pour poser des questions sur le code.
- `Ctrl + I` (Composer) : Le mode le plus puissant. Dis-lui "Ajoute une page de profil" ou "Change le design en mode sombre", et il le fera sur tout le projet.
- Assure-toi de choisir **Claude 3.5 Sonnet** dans les réglages du modèle.

## 5. Hébergement (Vercel)
1. Connecte-toi sur [Vercel.com](https://vercel.com).
2. Importe ton projet GitHub.
3. Ajoute tes variables d'environnement dans l'interface Vercel (Parameters > Environment Variables).
4. Ton app sera en ligne avec une adresse type `mon-app.vercel.app`.

## 6. Variables d'Environnement nécessaires
Voici les clés que tu devras configurer sur ton PC et sur Vercel :
- `GEMINI_API_KEY` (pour l'analyse boxe)
- Les configs Firebase (voir ton fichier `firebase-applet-config.json`)
