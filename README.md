# Got Five ! — version locale

Version web non officielle du jeu de déduction **Got Five !**, jouable **hors ligne**, pour **2 à 4 joueurs sur un seul appareil**, ou en **solo 1 contre 1 face à une IA locale**.

## Jouer en ligne

**<https://elarif.github.io/stunning-octo-fortnight/>**

Le site est publié par GitHub Pages via GitHub Actions à chaque push sur `main`. Il est installable comme PWA et fonctionne hors ligne après le premier chargement.

L'application tient le rôle du voisin pour répondre aux indices. Les joueurs se passent l'appareil ; les autres détournent le regard. L'annonce « GOT FIVE ! » se fait **uniquement pendant le tour du joueur**.

Le plateau et la fiche ne sont plus des onglets séparés : la fiche reste visible dans un panneau latéral sur desktop et s'ouvre en tiroir sur mobile. Les tuiles visibles et les supports adverses sont regroupés dans une table publique. Les actions apparaissent dans un dock contextuel près de la tuile sélectionnée, et le résultat d'un indice met en évidence l'encoche, la comparaison et la rangée de fiche concernée. Les cinq sélecteurs du brouillon ne proposent que les numéros encore possibles de chaque couleur et se remplissent seuls quand il n'en reste qu'un. Les boutons de révélation affichent le nombre de tuiles restantes par couleur.

En mode **Solo vs IA**, l'IA joue automatiquement ses tours. C'est un solveur local, sans réseau ni LLM : elle ne voit pas ses propres numéros, entretient des candidats par couleur et annonce seulement quand une solution unique est cohérente avec ses indices. Son écran de tour est public et n'affiche aucun support humain.

L'interface, les règles et le journal sont disponibles en **français et en anglais**. La langue du navigateur est utilisée au premier lancement, puis le choix est mémorisé. Le sélecteur à drapeaux FR/EN reste accessible sur chaque écran.

À la fin de la partie, le bouton **Voir la table finale** révèle tous les supports, les annonces de chaque joueur et le journal complet des actions pour comparer les erreurs.

## Lancer le jeu

Le service worker et les modules ES demandent un serveur HTTP (pas de double-clic sur `index.html`) :

```bash
# depuis le dossier du projet
python3 -m http.server 8000
```

Ouvrir <http://localhost:8000/>. Pour installer la PWA, utiliser le bouton d'installation du navigateur.

## Tester le moteur

```bash
npm test
```

Les tests couvrent les 60 tuiles, la distribution, les indices, les annonces, les éliminations, la règle du dernier joueur et les décisions de l'IA.

## Contenu

- `index.html` : point d'entrée.
- `styles.css` : interface responsive.
- `js/tiles.js` : les 60 tuiles (couleur, numéro, points).
- `js/engine.js` : moteur de règles pur, testable sans navigateur.
- `js/bot.js` : solveur de déduction local de l'IA, sans accès à son propre support.
- `js/i18n.js` : traductions françaises et anglaises, détection de langue et journal localisé.
- `js/app.js` : écrans, interactions, tours d'IA et sauvegarde.
- `js/storage.js` : sauvegarde locale versionnée.
- `sw.js` + `manifest.webmanifest` + `icons/` : fonctionnement hors ligne et installation.
- `tests/engine.test.js` et `tests/bot.test.js` : tests du moteur et de l'IA.
- `regles-got-five-simplifiees.md` : règles simplifiées.
- `PLAN.md` et `PLAN-IA.md` : plans de la version HTML et de l'IA.

## Hors ligne

Après un premier chargement en ligne, l'application est mise en cache et fonctionne sans réseau. Un rechargement normal en mode avion fonctionne ; un rechargement forcé qui contourne le cache du navigateur peut échouer, c'est normal.

Lors d'une mise à jour des fichiers, changer `CACHE_NAME` dans `sw.js` pour forcer le renouvellement du cache.

## Limites connues

- **Confidentialité.** Sur un écran partagé, elle repose sur les joueurs qui détournent le regard. L'état complet de la partie est stocké dans le navigateur : un joueur curieux peut l'inspecter avec les outils de développement.
- **Annonce hors tour.** Volontairement non implémentée : l'annonce se fait seulement pendant le tour du joueur.
- **IA.** Le mode solo 1 contre 1 est implémenté. Les parties mixtes humains + IA et les parties à 3 ou 4 joueurs avec IA ne sont pas encore proposées.
- **Multijoueur réseau.** Non inclus.
- **Visuels.** Aucun élément graphique officiel de Blue Orange n'est réutilisé. Version non officielle, à usage personnel.

## Source des règles

Règles officielles Blue Orange, édition 2026 :
<https://blueorangegames.eu/wp-content/uploads/2026/02/GOT-FIVE_RULES-FR.pdf>
