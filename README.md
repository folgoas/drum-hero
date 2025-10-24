# Drum Hero

Mini jeu web inspiré de Guitar Hero. Utilise un canvas pour afficher quatre pistes et des notes défilantes. Le code JavaScript gère la génération des notes, le timing, le scoring et les retours visuels.

## Démarrer

1. Ouvre `index.html` dans un navigateur moderne (Chrome, Edge, Firefox).
2. Choisis une difficulté dans le menu (Facile, Normale ou Difficile) selon ton niveau.
3. (Facultatif) Utilise le bouton **Charger un MP3** pour sélectionner un fichier audio local qui sera lu pendant la partie.
4. Clique sur **Démarrer** puis utilise les touches `D`, `F`, `J` et `K` pour frapper les notes au bon moment.

## Mettre en ligne

Le projet est entièrement statique (HTML/CSS/JS), tu peux donc le publier sur n'importe quel hébergeur de fichiers statiques :

### GitHub Pages
1. Crée un dépôt GitHub et pousse les fichiers du dossier.
2. Dans les paramètres du dépôt, active **Pages** et choisis la branche (généralement `main`) et le dossier racine (`/`).
3. Patiente quelques minutes : ton jeu sera disponible à l'URL `https://<ton-compte>.github.io/<nom-du-depot>/`.

### Netlify (drag & drop)
1. Connecte-toi sur [https://app.netlify.com/drop](https://app.netlify.com/drop).
2. Glisse le dossier `drum-hero` complet dans la zone prévue.
3. Netlify déploie automatiquement ton site et te fournit une URL que tu peux partager.

### Serveur statique maison
1. Lance un petit serveur HTTP local, par exemple :
   ```bash
   npx serve .
   ```
2. Mets en ligne le contenu généré (`index.html`, `styles.css`, `script.js`) sur ton hébergement.

## Fonctionnalités

- **Loop d'animation** fluide (requestAnimationFrame) avec un système de fenêtres de timing (Parfait, Super, Bien, Raté).
- **Piste réactive** : flash sur la zone d'impact, affichage du combo et de la précision en temps réel.
- **Trois niveaux de difficulté** calibrés (Facile, Normale, Difficile) pour progresser en douceur.
- **Chart de démonstration** généré procéduralement pour tester le jeu.
- **Fenêtre de résultat** récapitulative (score, précision, meilleur combo).
- **Lecture audio** : support du chargement de fichiers MP3 locaux via l'API Web Audio.

Le code est pensé pour être facilement extensible : il suffit d'adapter `createChart()` pour charger une partition depuis un fichier JSON ou un backend.
