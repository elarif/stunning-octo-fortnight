# Got Five ! — Plan d'une version HTML jouable offline first

> Statut : version locale 2 à 4 joueurs et solo 1v1 contre IA implémentée, hors ligne. Les parties mixtes humains + IA et le multijoueur en ligne restent en phase 2.

## Résumé

Construire une **PWA statique en français**, jouable **hors ligne après le premier chargement**, pour **2 à 4 joueurs sur un seul appareil** (pass-and-play) et en **solo 1v1 contre une IA locale**. L'application tient le rôle du voisin pour répondre aux indices. Le mode mixte humains + IA et le multijoueur en ligne restent en phase 2. Pas de serveur, pas de compte, pas de dépendance réseau.

Pourquoi ce choix : le jeu est conçu pour 2 à 4 joueurs ; le mode local est la seule adaptation fidèle sans serveur. L'IA est un ajout, pas le jeu de base. La limite assumée est la confidentialité sur écran partagé : chaque joueur doit détourner le regard quand ce n'est pas son tour.

## 1. Périmètre

### MVP

- Nouvelle partie 2 à 4 joueurs, saisie des noms, choix du premier joueur.
- Mise en place automatique : 5 tuiles par joueur (une par couleur), classées par ordre croissant, plus 5 tuiles publiques près de la réserve.
- Tour complet : révéler une tuile de la couleur choisie, puis demander un indice « classer » ou « comparer » sur l'une des 6 tuiles visibles.
- Fiche de déduction : 60 cases (couleur, numéro, points), croix manuelles, croix automatiques des numéros publics, 5 cases pour les réponses.
- Annonce « GOT FIVE ! » : une seule tentative par joueur, validation, élimination, règle du dernier joueur restant.
- Écrans de passage privés, consultation des notes, annonce « GOT FIVE ! » pendant le tour du joueur uniquement.
- Reprise de partie, règles intégrées, interface mobile, PWA installable.

### Phase 2

- Solo contre 1 à 3 IA, avec le même moteur. Détail dans `PLAN-IA.md`.
- Mode « voisin humain » optionnel : passation de l'appareil pour chaque indice.
- Statistiques locales, partage de graine, animations et sons, version anglaise.

### Hors périmètre

- Multijoueur en réseau ou en ligne : incompatible avec l'absence de serveur.
- Comptes, classements, synchronisation entre appareils.
- Visuels, logo ou police officiels de Blue Orange.

## 2. Fidélité aux règles

| Règle officielle | Implémentation |
|---|---|
| Ne jamais regarder ses propres numéros | Le support du joueur actif affiche uniquement les couleurs et les positions ; les numéros ne sont jamais rendus dans son DOM. |
| Les adversaires voient vos tuiles | Les supports adverses sont affichés avec numéros et points au joueur actif. |
| Deux actions par tour | Révéler, puis demander un indice. |
| Classer | L'application calcule l'encoche correcte parmi les 6 et y place la tuile. |
| Comparer | L'application répond « Oui » ou « Non » sur l'égalité des points. |
| Une seule tentative | Après une annonce, le joueur ne peut plus annoncer. |
| Mauvaise annonce | Le joueur perd et attend la fin ; son tour est sauté. |
| Tous sauf un se trompent | Le dernier joueur qui n'a pas annoncé gagne automatiquement. |
| Effacer et refaire ses déductions | Bouton de réinitialisation de la fiche ; les tuiles publiques restent visibles. |

### Adaptations assumées

- **L'application est l'arbitre.** Elle remplace le voisin humain pour classer et comparer. L'information transmise est identique, mais l'échange social autour de la table disparaît.
- **Pass-and-play.** Les joueurs se passent l'appareil ; les autres détournent le regard. La confidentialité repose sur cette discipline, pas sur la technique.
- **Annonce pendant le tour uniquement.** Décision produit : un joueur ne peut annoncer « GOT FIVE ! » que pendant son propre tour. L'écran de passage ne propose pas d'annonce hors tour.
- **Premier joueur.** Choisi à la mise en place (par défaut, le plus jeune).

### Points que les règles officielles ne tranchent pas

À décider et à documenter dans l'application :

1. **Réserve vide.** Si plus aucune tuile ne reste, l'action « révéler » est sautée et le joueur demande un indice sur les tuiles visibles restantes.
2. **Couleur épuisée.** La couleur est grisée ; si toutes les couleurs sont épuisées, l'action « révéler » est sautée.
3. **Tous les joueurs se trompent.** Aucun vainqueur ; proposer une nouvelle partie. (La règle officielle ne couvre que « tous sauf un ».)
4. **Fin de partie.** Les supports restent visibles ; on n'affiche pas les numéros non révélés des perdants, sauf demande explicite.

## 3. Données du jeu

- 60 tuiles, 5 couleurs : vert, rose, bleu, rouge, orange. 12 tuiles par couleur, numéros uniques de 1 à 60.
- Couleur : `COLORS[(n - 1) % 5]`.
- Points : `(Math.floor((n - 1) / 5) % 3) + 1`.
- Cette formule reproduit la fiche officielle : chaque couleur a 4 tuiles à 1 point, 4 à 2 points et 4 à 3 points.
- **Vérifier les 60 tuiles contre la fiche officielle**, puis figer un tableau `TILES` plutôt que de dépendre de la formule à l'exécution. Test : 60 numéros uniques, 12 par couleur, 20 par valeur de points.
- **Propriété intellectuelle.** Ne pas réutiliser les illustrations, le logo ou la typographie du jeu. Créer un habillage original (formes colorées, chiffres et points) et indiquer « version non officielle, à usage personnel ». Pour une diffusion publique, demander l'autorisation à Blue Orange.

## 4. Architecture technique

- **PWA statique**, sans build, en HTML/CSS/JavaScript.
- Modules ES pour séparer moteur, interface et stockage. Servir en HTTP pour le service worker ; si le double-clic sur `index.html` est requis, produire plus tard un fichier unique.
- Aucune dépendance externe : polices système, icônes SVG inline, pas de CDN.

```
index.html
styles.css
js/
  tiles.js       # les 60 tuiles, couleurs, points
  rng.js         # mélange reproductible
  engine.js      # moteur pur, sans DOM ni stockage
  ui.js          # rendu, écrans, interactions
  storage.js     # sauvegarde locale versionnée
  ai.js          # phase 2
sw.js
manifest.webmanifest
icons/
tests/
  engine.test.js
```

### Principes

- `engine.js` est pur : un état + une action donnent un nouvel état. Facile à tester avec `node --test`, sans navigateur.
- `ui.js` ne rend que ce que le spectateur a le droit de voir. Les numéros du joueur actif ne sont jamais dans le DOM, même cachés en CSS.
- `storage.js` sauvegarde après chaque action dans `localStorage` (état petit, moins de 100 Ko). Schéma versionné ; état invalide = nouvelle partie.
- `sw.js` met en cache l'application complète ; pas d'appel réseau à l'exécution.
- Pas de drag-and-drop obligatoire : tout se fait au clic ou au toucher.

## 5. Modèle d'état

```text
Tile   { id, n, color, dots }
Player { id, name, stand: Tile[5], notes: bool[60], eliminated, hasClaimed }
Game   { seed, players, supply: Tile[], publicTiles: Tile[],
         currentPlayer, phase, clueHistory, winner, log }
```

Phases :

```text
setup → turn:reveal → turn:chooseTile → turn:chooseClue
      → turn:compareSlot → turn:end → joueur suivant
      → claim → gameOver
```

Invariants à tester :

- Chaque support contient exactement une tuile de chaque couleur, en ordre croissant.
- `supply + publicTiles + supports + tuiles d'indices = 60`.
- Le pool public contient 5 tuiles au début d'un tour normal, 6 après la révélation, 5 après l'indice. Une annonce ratée en cours de tour peut laisser la tuile révélée supplémentaire visible pour le tour suivant.
- Une annonce contient 5 entiers distincts de 1 à 60, strictement croissants.
- Un joueur éliminé ne joue plus ; si un seul joueur actif reste, il gagne.

## 6. Interface

### Écrans

1. **Accueil** : Nouvelle partie, Continuer, Règles, Options.
2. **Mise en place** : nombre de joueurs, noms, premier joueur.
3. **Passage** : « Passe l'appareil à X. Les autres détournent le regard. » Boutons : commencer mon tour, consulter mes notes, revendiquer.
4. **Tour** : en-tête sticky (joueur, tour, réserve, annonce), table publique regroupant tuiles visibles et supports adverses, dock d'actions contextuel, support personnel (dos colorés), et fiche de déduction en panneau permanent sur desktop ou en tiroir sur mobile. Le journal est intégré à la fiche, plus d'onglets séparés.
5. **Annonce** : saisie privée des 5 numéros, confirmation, résultat public.
6. **Fin** : vainqueur, supports révélés, rejouer.
7. **Table finale** : accessible depuis la fin, avec tous les supports, les annonces de chaque joueur et le journal complet des actions.

### Disposition de la table

```text
[Tour d'Alice] [Réserve : 34 tuiles] [GOT FIVE !] [Règles]   (sticky)

Table publique
  Tuiles visibles : 8 14 21 29 36 52
  Adversaires     : Adrien  12 23 37 41 58
                    Léo      6 17 24 30 45
  Légende des couleurs

[tuile sélectionnée] [Classer] [Comparer] [Changer]          (dock contextuel)

Ton support : [rose] [bleu] [vert] [rouge] [orange]   (dos, ordre croissant)
Comparaisons / Zone de classement

Fiche de déduction + journal                                  (panneau / tiroir)
```

### Fiche de déduction

- 5 rangées (une par couleur), 12 colonnes, chaque case affiche le numéro et ses points.
- Croix automatiques pour les numéros visibles par le joueur : supports adverses, tuiles publiques, tuiles d'indices. Jamais de croix basée sur ses propres numéros cachés.
- Croix manuelles au clic ; bouton « Tout effacer ».
- 5 cases de brouillon pour écrire les numéros trouvés ; leur contour reprend la couleur de la position correspondante du support.
- Les notes de chaque joueur sont privées et restaurées à son tour.
- La fiche est toujours visible sur desktop, dans un tiroir sur mobile ; le journal est replié dans la fiche.
- Après une comparaison, la rangée de couleur concernée est mise en évidence ; après un classement, l'encoche et la tuile sont mises en évidence.

### Accessibilité

- La couleur ne doit jamais être le seul indice : nom de couleur, symbole ou motif sur chaque tuile et chaque rangée.
- Contraste suffisant, cibles tactiles de 44 px minimum, navigation clavier, focus visible.
- `aria-live` pour les numéros révélés et les résultats, mais **jamais de synthèse vocale des numéros des adversaires** : cela violerait la règle « ne pas prononcer leurs numéros ». Le lecteur d'écran doit être utilisé avec écouteurs en mode passage.
- Respect de `prefers-reduced-motion`.

## 7. Offline first

- `manifest.webmanifest` : nom, icônes 192/512, affichage `standalone`, couleurs de thème.
- `sw.js` : cache versionné de l'application complète ; stratégie cache d'abord ; mise à jour proposée, jamais imposée en pleine partie.
- Sauvegarde automatique dans `localStorage`, reprise après fermeture ou rechargement.
- Aucun appel réseau : ni police, ni image, ni analytics.
- Test d'acceptation : charger une fois, passer en mode avion, recharger, jouer une partie complète ; vérifier l'absence de requêtes échouées et l'installabilité.

## 8. Tests

### Moteur

- Données : 60 tuiles, 12 par couleur, 20 par valeur de points, numéros 1 à 60.
- Mise en place : une tuile de chaque couleur par joueur, support trié.
- Révélation : retrait de la réserve, ajout au pool, annonce du numéro.
- Classement : les 6 encoches possibles, y compris avant la première et après la dernière.
- Comparaison : « Oui » et « Non », placement et inclinaison.
- Fin de tour : joueur suivant, joueurs éliminés sautés.
- Annonce : correcte, incorrecte, doublon, ordre non croissant, joueur déjà éliminé.
- Règle « tous sauf un » et cas « tous se trompent ».
- Réserve vide et couleur épuisée.
- Sauvegarde/rechargement : état identique.

### Interface

- Partie complète à 2 joueurs et à 4 joueurs sur un seul appareil.
- Vérifier qu'aucun numéro du joueur actif n'apparaît dans le DOM, les attributs ARIA ou le journal.
- Écrans de passage : la table est masquée avant le changement de joueur.
- Annonce uniquement pendant le tour.
- Mode avion, installation, reprise.
- Clavier seul, lecteur d'écran, simulation de daltonisme.

## 9. Jalons

| Jalon | Contenu | Critère de fin | Estimation |
|---|---|---|---|
| M0 | Figer les 60 tuiles, vérifier la fiche, trancher les cas limites | Table de données validée, décisions écrites | 0,5 j |
| M1 | Moteur pur + tests | Tous les tests passent, une partie scriptée se termine correctement | 1 j |
| M2 | Interface locale 2–4 joueurs | Partie complète jouable, écrans de passage, fiche, annonce | 1,5–2 j |
| M3 | PWA et offline | Mode avion, installation, reprise | 0,5 j |
| M4 | Finition et QA | Accessibilité, responsive, règles, cas limites | 1 j |
| M5 | Solo contre IA (option) | 1 humain + 1 à 3 bots, indices et annonces | 1,5–2 j |

## 10. Risques et décisions ouvertes

1. **Confidentialité sur écran partagé.** Impossible à garantir techniquement ; dépend des joueurs. Les écrans de passage réduisent le risque.
2. **Propriété intellectuelle.** Visuels originaux obligatoires ; le nom et les règles restent liés à Blue Orange. Diffusion publique à valider.
3. **Annonce hors tour.** Décidé : restreinte au tour du joueur (écart assumé avec la règle officielle).
4. **Réserve vide, couleur épuisée, tous se trompent.** Cas non couverts par les règles ; choisir des règles maison explicites.
5. **Mode prioritaire.** Local 2–4 joueurs ou solo contre IA ? Le moteur est commun, l'interface diffère.
6. **Ouverture en double-clic.** Les modules ES demandent un serveur local ; prévoir un fichier unique si nécessaire.
7. **Triche locale.** L'état complet est dans le navigateur ; un joueur curieux peut inspecter le stockage. C'est un jeu de salon, pas une compétition en ligne.
8. **Accessibilité et secret.** Le lecteur d'écran peut vocaliser les numéros des adversaires ; prévoir écouteurs et ne jamais les annoncer automatiquement.

## 11. Prochaine étape

Valider le mode prioritaire (local ou solo) et les règles maison, puis démarrer M0 et M1. Le moteur et les données sont communs aux deux modes.
