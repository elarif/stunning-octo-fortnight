# Got Five ! — Plan d'ajout des IA

> Statut : première version solo 1 contre 1 implémentée (solveur local, tours automatiques, écran de tour public). Les parties mixtes humains + IA, le solo à 3 IA et le multijoueur en ligne restent à faire.
> Périmètre : IA locale, d'abord en solo, puis en parties mixtes humains + IA. Le multijoueur en ligne reste hors périmètre.

## 1. Décision de périmètre

- **IA locale, pas d'API ni de LLM.** Le jeu est un problème de déduction fermé : un solveur déterministe est plus rapide, plus fiable, reproductible et compatible avec l'architecture hors ligne.
- **Solo :** 1 humain contre 1 à 3 IA.
- **Mixte local :** 2 à 4 joueurs, avec au moins un humain et au moins une IA. Les humains continuent de se passer l'appareil ; les tours d'IA sont automatiques.
- **Multijoueur en ligne :** hors périmètre. Il demanderait un serveur de salons ou du signaling WebRTC, une synchronisation d'état et une gestion de la reconnexion, ce qui contredit l'architecture statique et offline-first actuelle.
- **Les IA ne trichent pas.** Elles ne lisent jamais leurs propres numéros cachés. Elles déduisent à partir de ce qu'un joueur voit : supports adverses, tuiles publiques, tuiles d'indices et résultats de leurs propres indices.

Ordre recommandé : **solo d'abord**, car il valide le moteur d'IA avec l'interface la plus simple. Le mode mixte réutilise ensuite exactement le même bot.

## 2. Ce qui existe déjà

Le moteur `js/engine.js` est pur et contient déjà :

- `createGame`, `reveal`, `skipReveal`, `chooseTile`, `chooseClue`, `chooseCompareSlot`, `endTurn`, `claim` ;
- `visibleNumbersFor(state, playerId)`, qui donne exactement les numéros visibles par un joueur, en excluant son propre support ;
- les phases `reveal`, `chooseTile`, `chooseClue`, `compareSlot`, `end`, `gameOver` ;
- l'annonce unique, l'élimination et la victoire du dernier joueur en lice.

L'interface `js/app.js` gère déjà le pass-and-play, la fiche, la sauvegarde et les écrans de passage. L'IA doit s'insérer dans ce moteur sans dupliquer les règles.

## 3. Modifications du moteur et des données

### Type de joueur

Ajouter `kind: 'human' | 'bot'` sur chaque joueur.

- `createGame({ names, kinds, seed, startingPlayer })` ;
- `kinds` est optionnel et vaut `'human'` par défaut, pour ne pas casser les tests existants ;
- le moteur accepte une partie 100 % IA pour les simulations de test ; l'interface exigera au moins un humain.

### Couleurs du support

Ajouter `standColors` sur chaque joueur : la suite des couleurs des 5 tuiles, dans l'ordre croissant des numéros.

- Cette information est visible par le propriétaire du support (le dos des tuiles) ;
- l'IA utilise `standColors`, jamais `stand`, pour connaître ses couleurs ;
- l'interface peut aussi utiliser `standColors` pour dessiner les dos, ce qui évite de lire les numéros cachés dans le rendu.

### Sauvegarde

Le schéma de sauvegarde doit être migré :

- ancienne sauvegarde sans `kind` : considérer `'human'` ;
- ancienne sauvegarde sans `standColors` : les recalculer depuis le support ;
- versionner la sauvegarde et conserver la reprise des parties existantes.

### Service worker

Ajouter `js/bot.js` à la liste des assets et incrémenter `CACHE_NAME` dans `sw.js`.

## 4. Connaissance de l'IA

L'IA reçoit une vue publique, jamais l'état complet. C'est la garantie anti-triche.

```text
BotView {
  phase,
  slotColors: [c0, c1, c2, c3, c4],
  visibleNumbers: Set<number>,
  sorting: [[n, ...] x 6],       // indices posés par l'IA, par encoche
  comparisons: [[{n, same}] x 5], // comparaisons de l'IA, par emplacement
  publicTiles: [n, ...],
  chosenTile: n | null,
  availableColors: [bool x 5],
  supplyEmpty: bool
}
```

`buildBotView(game, playerId)` lit :

- `player.standColors` ;
- `visibleNumbersFor(game, playerId)` ;
- les indices que l'IA a elle-même posés (`sorting`, `comparisons`) ;
- les tuiles publiques et la phase.

Elle ne lit jamais `player.stand`.

### Candidats

Pour chaque emplacement `i` :

```text
C[i] = { numéros de la couleur slotColors[i] }
       - visibleNumbers
```

Le vrai numéro de l'IA est donc inclus dans ses candidats, puisqu'il n'est visible ni chez les adversaires, ni dans les tuiles publiques, ni dans les indices posés.

### Contraintes

- **Ordre croissant :** `x0 < x1 < x2 < x3 < x4`.
- **Classer :** une tuile publique `n` placée dans l'encoche `k` donne, pour tout `i < k`, `x_i < n`, et pour tout `i >= k`, `x_i > n`.
- **Comparer :** une tuile publique `n` comparée à l'emplacement `i` avec `same = true` donne `points(x_i) = points(n)` ; avec `same = false`, l'inverse.
- Une couleur par emplacement, donc pas de doublon possible entre emplacements.

### Solveur

Un module pur `js/bot.js` :

- filtre les candidats avec les contraintes ;
- énumère les affectations cohérentes `(x0..x4)` par backtracking avec élagage par ordre croissant ;
- renvoie le nombre de solutions et la première solution ;
- s'arrête à 2 solutions pour le test d'unicité ;
- pour l'évaluation des indices, utilise une énumération exacte plafonnée, puis un échantillonnage déterministe si l'espace est trop grand.

L'IA ne réclame que lorsqu'il existe **exactement une solution cohérente**. Toute solution unique doit être égale au vrai support ; c'est un test de correction du solveur.

## 5. Choix des actions

À chaque étape de son tour, l'IA vérifie d'abord si elle a une solution unique. Si oui, elle annonce immédiatement « GOT FIVE ! », même avant de révéler. Sinon, elle joue l'action légale correspondant à la phase.

### Révéler

- Si la réserve est vide : `skipReveal`.
- Sinon, choisir une couleur disponible, de préférence celle dont le total de candidats est le plus élevé. Départage déterministe par index de couleur.
- L'IA ne connaît pas la composition exacte de la réserve ; elle n'utilise que les couleurs encore disponibles.

### Choisir une tuile et un indice

Pour chaque tuile publique `x`, évaluer :

- **Classer :** regrouper les solutions par nombre de numéros inférieurs à `x` (encoche 0 à 5) ;
- **Comparer :** pour chaque emplacement `i`, regrouper les solutions selon l'égalité des points entre `x_i` et `x`.

Score d'une action : nombre attendu de solutions restantes.

```text
E(action) = somme(taille_groupe²) / nombre_total_de_solutions
```

Choisir l'action qui minimise `E`. En cas d'égalité : privilégier `Classer`, puis la plus petite tuile, puis le plus petit emplacement. L'IA choisit d'abord la tuile qui offre le meilleur indice, puis le type d'indice, puis l'emplacement de comparaison.

### Fin de tour

- Si solution unique : annoncer.
- Sinon : terminer le tour.

### Performance

- 5 emplacements, 12 candidats maximum par couleur : l'énumération reste petite.
- Objectif : moins de 200 ms par décision sur un téléphone courant.
- Calcul synchrone dans un premier temps ; un Web Worker ne sera ajouté que si les mesures l'exigent.

### Difficulté

Première version : un seul niveau « Normale », solveur complet et annonce prudente. Les niveaux suivants pourront varier sur le choix des indices et la prise de risque à l'annonce, jamais en trichant.

## 6. Intégration dans l'interface

### Mise en place

Ajouter dans l'écran de configuration :

- un choix **Humain / IA** par joueur ;
- des noms automatiques « IA 1 », « IA 2 » pour les bots ;
- le premier joueur peut être un humain ou une IA ;
- validation : au moins un humain dans la partie ;
- conservation des 2 à 4 joueurs.

L'utilisateur peut donc créer :
- 2 humains : comportement actuel ;
- 1 humain + 1 à 3 IA : solo ;
- 2 ou 3 humains + 1 ou 2 IA : mode mixte local.

### Orchestration des tours

Ajouter `humanCount(game)` et une fonction unique `enterCurrentTurn()` :

- partie terminée → écran de fin ;
- joueur courant IA → écran de tour d'IA, exécution automatique ;
- joueur courant humain et plusieurs humains → écran de passage, puis tour humain ;
- joueur courant humain et un seul humain → tour humain direct, sans écran de passage.

Cette fonction remplace les transitions actuelles de `startGame`, `continueGame`, `replay`, `doEndTurn` et de l'annonce ratée.

### Écran de tour d'IA

Un rendu dédié, **public**, sans réutiliser `renderTable` :

- nom de l'IA, tour, réserve ;
- support de l'IA face visible (ces numéros sont publics) ;
- tuiles publiques ;
- zone de classement et comparaisons de l'IA ;
- statut de l'action en cours et derniers événements du journal ;
- aucune tuile d'un support humain, aucune fiche, aucune note, aucun brouillon humain.

L'écran avance par étapes, avec un délai court (environ 600 ms), pour que les humains puissent suivre : révélation, choix de tuile, indice, résultat, annonce éventuelle.

### Annonce d'une IA

- L'IA annonce ses 5 numéros ; ils sont publics ;
- si c'est correct, écran de fin ;
- si c'est faux, l'IA est éliminée, la partie continue, et l'écran suivant affiche l'élimination ;
- une IA n'annonce jamais hors de son tour.

### Reprise et sauvegarde

- Chaque action d'IA est sauvegardée ;
- si la page est rechargée pendant un tour d'IA, `enterCurrentTurn()` reprend le tour à la phase courante ;
- les décisions sont déterministes : une reprise ne change pas le choix de l'IA ;
- `replay` conserve les types humain/IA et le premier joueur.

### Règles et aide

Ajouter une section « Mode IA » dans l'écran de règles :

- les IA jouent automatiquement ;
- elles ne voient pas leurs propres numéros ;
- leur écran de tour ne montre aucun support humain ;
- l'IA est locale, sans réseau ;
- l'annonce reste limitée au tour du joueur.

### Confidentialité pendant les tours d'IA

C'est le point le plus sensible.

- En solo, l'écran de tour d'IA ne doit jamais afficher le support de l'humain.
- En mode mixte, il ne doit afficher le support d'aucun humain.
- Le support de l'IA est public et peut être affiché.
- Le journal et les tuiles publiques sont publics.
- Aucune fiche, note ou brouillon humain n'est rendu pendant le tour d'IA.
- Le rendu du tour d'IA ne doit pas réutiliser les composants qui parcourent tous les joueurs.

## 7. Tests et critères d'acceptation

### Tests du bot

- Initialisation des candidats : exclut les numéros visibles, inclut le vrai numéro.
- Application correcte des contraintes de classement, comparaison et ordre.
- Détection d'unicité.
- **Test anti-triche :** deux vues identiques provenant de supports réels différents doivent produire les mêmes candidats et la même action. L'API `BotView` ne contient pas le support.
- Toute annonce d'IA sur solution unique est correcte sur plusieurs graines.
- Toutes les actions retournées sont légales pour la phase.
- Une partie 100 % IA se termine ou atteint une limite de tours sans blocage.
- Performance sous le seuil fixé.

### Tests d'interface

- Solo 1 humain + 1 IA : l'IA joue, l'humain joue, pas d'écran de passage.
- Solo 1 humain + 3 IA : tours d'IA consécutifs.
- Mixte 2 humains + 1 IA : passages uniquement entre humains, tours d'IA sans passage.
- Pendant un tour d'IA, aucun numéro d'un support humain n'est présent dans le DOM.
- Pendant un tour humain, le support du joueur actif reste caché.
- Annonce correcte et incorrecte d'une IA.
- Rechargement pendant un tour d'IA, puis reprise.
- Rejouer conserve les types.
- Mode hors ligne avec `bot.js` en cache.
- Aucune erreur console.

### Cas limites

- Réserve vide : l'IA saute la révélation.
- Plus de tuile publique : l'IA termine son tour.
- **Blocage possible :** si la réserve et les tuiles publiques sont épuisées et qu'aucune IA n'a de solution unique, les tours peuvent boucler. Prévoir une règle de sortie : l'IA annonce sa meilleure hypothèse quand plus aucun indice n'est possible, ou la partie s'arrête sans vainqueur. À trancher avant l'implémentation.
- Sauvegarde ancienne sans `kind` ou `standColors`.
- Partie avec un seul humain : pas d'écran de passage.
- Partie 100 % IA : autorisée pour les tests, interdite dans l'interface.

## 8. Jalons

| Jalon | Contenu | Critère de fin | Estimation |
|---|---|---|---|
| A0 | `kind`, `standColors`, migration de sauvegarde, `BotView` | Moteur et sauvegardes compatibles, tests | 0,5 j |
| A1 | Candidats, contraintes, solveur, unicité | Tests du solveur et anti-triche | 1 j |
| A2 | Choix d'actions, partie IA contre IA | IA légale, compétitive, performante | 1 j |
| A3 | Écran de configuration humain/IA, orchestration solo, écran de tour d'IA | Solo jouable de bout en bout, sans fuite | 1,5 j |
| A4 | Mode mixte local, passages conditionnels | Humains + IA jouables, confidentialité vérifiée | 1 j |
| A5 | Finition, règles, README, cache PWA, QA | Tests complets et documentation | 1 j |

Total indicatif : environ 6 jours.

## 9. Risques et décisions ouvertes

1. **Fuite de confidentialité pendant les tours d'IA.** Risque principal. Rendu dédié obligatoire, test DOM.
2. **Triche involontaire du bot.** Le bot ne doit recevoir que `BotView`, jamais le support complet. Test anti-triche.
3. **Performance du solveur.** Énumération plafonnée et échantillonnage si nécessaire.
4. **Force de l'IA.** Trop faible, elle ne crée pas de tension ; trop forte, elle gagne toujours. Un seul niveau au départ, puis playtests.
5. **Blocage de fin de partie.** Prévoir une règle de sortie quand plus aucun indice n'est possible.
6. **Complexité de l'orchestration.** Passages entre humains, tours d'IA, reprise et rejouer doivent partager une seule fonction de transition.
7. **Migration des sauvegardes.** Les parties existantes ne doivent pas être perdues.
8. **Attente utilisateur.** « IA » signifie ici solveur local, pas LLM. Un LLM serait lent, non déterministe, dépendant du réseau et moins fiable pour ce jeu.
9. **Multijoueur en ligne.** Si « multi joueur » signifie en ligne, c'est un projet séparé, avec serveur et synchronisation.
10. **Propriété intellectuelle.** Noms et visuels des IA originaux, pas d'éléments officiels Blue Orange.

## 10. Prochaine étape

Valider le périmètre :

- solo d'abord, puis mixte local ;
- IA locale déterministe, sans LLM ni réseau ;
- multijoueur en ligne exclu.

Ensuite, commencer par A0 et A1 : métadonnées moteur, `BotView`, solveur et tests anti-triche.
