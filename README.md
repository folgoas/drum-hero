# Drum Hero

Mini jeu web inspiré de Guitar Hero. Utilise un canvas pour afficher quatre pistes et des notes défilantes. Le code JavaScript gère la génération des notes, le timing, le scoring et les retours visuels.

## Démarrer

1. Ouvre `index.html` dans un navigateur moderne (Chrome, Edge, Firefox).
2. (Facultatif) Utilise le bouton **Charger un MP3** pour sélectionner un fichier audio local qui sera lu pendant la partie.
3. Clique sur **Démarrer** puis utilise les touches `D`, `F`, `J` et `K` pour frapper les notes au bon moment.

## Fonctionnalités

- **Loop d'animation** fluide (requestAnimationFrame) avec un système de fenêtres de timing (Parfait, Super, Bien, Raté).
- **Piste réactive** : flash sur la zone d'impact, affichage du combo et de la précision en temps réel.
- **Chart de démonstration** généré procéduralement pour tester le jeu.
- **Fenêtre de résultat** récapitulative (score, précision, meilleur combo).
- **Lecture audio** : support du chargement de fichiers MP3 locaux via l'API Web Audio.

Le code est pensé pour être facilement extensible : il suffit d'adapter `createDemoChart()` pour charger une partition depuis un fichier JSON ou un backend.
