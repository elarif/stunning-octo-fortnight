import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORS, TILES, tile } from '../js/tiles.js';
import {
  PHASES,
  activePlayers,
  canRevealColors,
  cancelClue,
  chooseClue,
  chooseCompareSlot,
  chooseTile,
  claim,
  createGame,
  endTurn,
  isValidClaimNumbers,
  reveal,
  skipReveal,
  visibleNumbersFor,
} from '../js/engine.js';

function makeGame(count = 3, seed = 12345, startingPlayer = 0) {
  return createGame({
    names: Array.from({ length: count }, (_, index) => `Joueur ${index + 1}`),
    seed,
    startingPlayer,
  });
}

function wrongClaim(stand) {
  return Array.from({ length: 60 }, (_, index) => index + 1)
    .filter((n) => !stand.includes(n))
    .slice(0, 5);
}

function numericTokens(text) {
  return text.match(/\b\d{1,2}\b/g) ?? [];
}

test('les 60 tuiles suivent la fiche officielle', () => {
  assert.equal(TILES.length, 60);
  assert.equal(new Set(TILES.map((t) => t.n)).size, 60);

  for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex += 1) {
    assert.equal(TILES.filter((t) => t.colorIndex === colorIndex).length, 12);
  }
  for (const dots of [1, 2, 3]) {
    assert.equal(TILES.filter((t) => t.dots === dots).length, 20);
  }

  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 11, 16, 56, 60].map((n) => [tile(n).colorIndex, tile(n).dots]),
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [0, 2],
      [0, 3],
      [0, 1],
      [0, 3],
      [4, 3],
    ],
  );
});

test('mise en place : 5 tuiles par joueur, une par couleur, 5 tuiles publiques', () => {
  const game = makeGame(3, 12345, 1);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.phase, PHASES.REVEAL);
  assert.equal(game.publicTiles.length, 5);
  assert.equal(game.publicTiles.length, new Set(game.publicTiles).size);
  assert.equal(new Set(game.publicTiles.map((n) => tile(n).colorIndex)).size, 5);
  assert.equal(game.supply.length, 60 - 15 - 5);

  for (const player of game.players) {
    assert.equal(player.stand.length, 5);
    assert.deepEqual(player.stand, [...player.stand].sort((a, b) => a - b));
    assert.equal(new Set(player.stand.map((n) => tile(n).colorIndex)).size, 5);
  }

  const allTiles = [
    ...game.publicTiles,
    ...game.supply,
    ...game.players.flatMap((player) => player.stand),
  ];
  assert.equal(allTiles.length, 60);
  assert.equal(new Set(allTiles).size, 60);

  for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex += 1) {
    assert.equal(
      game.supply.filter((n) => tile(n).colorIndex === colorIndex).length,
      12 - 3 - 1,
    );
  }
});

test('types de joueurs et couleurs du support', () => {
  const game = createGame({
    names: ['Alice', 'IA 1'],
    kinds: ['human', 'bot'],
    seed: 42,
  });

  assert.equal(game.players[0].kind, 'human');
  assert.equal(game.players[1].kind, 'bot');
  for (const player of game.players) {
    assert.deepEqual(player.standColors, player.stand.map((n) => tile(n).colorIndex));
    assert.equal(player.standColors.length, 5);
    assert.equal(new Set(player.standColors).size, 5);
  }

  assert.throws(() => createGame({ names: ['A', 'B'], kinds: ['human'] }));
});

test('mise en place à 4 joueurs : 35 tuiles en réserve et 60 tuiles réparties', () => {
  const game = makeGame(4, 99, 2);
  assert.equal(game.players.length, 4);
  assert.equal(game.currentPlayer, 2);
  assert.equal(game.publicTiles.length, 5);
  assert.equal(game.supply.length, 35);

  const allTiles = [
    ...game.publicTiles,
    ...game.supply,
    ...game.players.flatMap((player) => player.stand),
  ];
  assert.equal(allTiles.length, 60);
  assert.equal(new Set(allTiles).size, 60);
  for (const player of game.players) {
    assert.equal(player.stand.length, 5);
    assert.equal(new Set(player.stand.map((n) => tile(n).colorIndex)).size, 5);
  }
});

test('révéler une tuile ajoute une tuile publique et passe au choix', () => {
  const game = makeGame(2, 999);
  const colorIndex = canRevealColors(game).findIndex(Boolean);
  const beforeSupply = game.supply.length;
  const next = reveal(game, colorIndex);

  assert.equal(game.supply.length, beforeSupply, 'le moteur ne doit pas muter l’état d’entrée');
  assert.equal(next.supply.length, beforeSupply - 1);
  assert.equal(next.publicTiles.length, 6);
  assert.equal(next.phase, PHASES.CHOOSE_TILE);
  assert.equal(tile(next.revealed).colorIndex, colorIndex);
  assert.ok(next.publicTiles.includes(next.revealed));
  assert.match(next.log.at(-1).text, new RegExp(`révèle le ${next.revealed}`));
});

test('classer place la tuile dans la bonne encoche sans révéler les numéros cachés', () => {
  let game = makeGame(2, 42);
  const colorIndex = canRevealColors(game).findIndex(Boolean);
  game = reveal(game, colorIndex);
  const n = game.publicTiles[0];
  game = chooseTile(game, n);
  assert.equal(game.phase, PHASES.CHOOSE_CLUE);

  const player = game.players[game.currentPlayer];
  const expectedNotch = player.stand.filter((value) => value < n).length;
  const logIndex = game.log.length;
  game = chooseClue(game, 'sort');

  assert.equal(game.phase, PHASES.END);
  assert.deepEqual(game.clue, { type: 'sort', tile: n, notch: expectedNotch });
  assert.ok(game.players[game.currentPlayer].sorting[expectedNotch].includes(n));
  assert.equal(game.publicTiles.length, 5);

  const text = game.log[logIndex].text;
  const tokens = new Set(numericTokens(text));
  for (const hidden of player.stand) {
    assert.equal(tokens.has(String(hidden)), false, `le journal ne doit pas révéler ${hidden}`);
  }
});

test('comparer répond Oui ou Non et place la tuile devant la bonne tuile', () => {
  let game = makeGame(2, 77);
  const colorIndex = canRevealColors(game).findIndex(Boolean);
  game = reveal(game, colorIndex);
  const n = game.publicTiles[0];
  game = chooseTile(game, n);
  game = chooseClue(game, 'compare');
  assert.equal(game.phase, PHASES.COMPARE_SLOT);

  const player = game.players[game.currentPlayer];
  const target = player.stand[0];
  const expectedSame = tile(n).dots === tile(target).dots;
  const logIndex = game.log.length;
  game = chooseCompareSlot(game, 0);

  assert.equal(game.phase, PHASES.END);
  assert.deepEqual(game.clue, { type: 'compare', tile: n, slot: 0, same: expectedSame });
  assert.deepEqual(game.players[game.currentPlayer].comparisons[0], [
    { n, same: expectedSame },
  ]);
  assert.equal(game.publicTiles.length, 5);

  const tokens = new Set(numericTokens(game.log[logIndex].text));
  for (const hidden of player.stand) {
    assert.equal(tokens.has(String(hidden)), false, `le journal ne doit pas révéler ${hidden}`);
  }
});

test('annuler une comparaison revient au choix de la tuile publique', () => {
  let game = makeGame(2, 78);
  const colorIndex = canRevealColors(game).findIndex(Boolean);
  game = reveal(game, colorIndex);
  const n = game.publicTiles[0];
  const publicBefore = game.publicTiles.slice();
  game = chooseTile(game, n);
  game = chooseClue(game, 'compare');
  game = cancelClue(game);

  assert.equal(game.phase, PHASES.CHOOSE_TILE);
  assert.equal(game.chosenTile, null);
  assert.equal(game.clue, null);
  assert.deepEqual(game.publicTiles, publicBefore);
});

test('annuler un classement déjà appliqué est refusé', () => {
  let game = makeGame(2, 79);
  const colorIndex = canRevealColors(game).findIndex(Boolean);
  game = reveal(game, colorIndex);
  game = chooseTile(game, game.publicTiles[0]);
  game = chooseClue(game, 'sort');
  assert.throws(() => cancelClue(game));
});

test('fin de tour : joueur suivant, nouveau tour, phase de révélation', () => {
  let game = makeGame(3, 10);
  const colorIndex = canRevealColors(game).findIndex(Boolean);
  game = reveal(game, colorIndex);
  game = chooseTile(game, game.publicTiles[0]);
  game = chooseClue(game, 'sort');
  game = endTurn(game);

  assert.equal(game.currentPlayer, 1);
  assert.equal(game.turn, 2);
  assert.equal(game.phase, PHASES.REVEAL);
  assert.equal(game.publicTiles.length, 5);
  assert.equal(game.chosenTile, null);
});

test('annonce correcte : victoire immédiate', () => {
  const game = makeGame(3, 5);
  const player = game.players[game.currentPlayer];
  const next = claim(game, player.stand);

  assert.equal(next.phase, PHASES.GAME_OVER);
  assert.equal(next.winner, player.id);
  assert.equal(next.winReason, 'claim');
  assert.equal(next.players[player.id].hasClaimed, true);
  assert.deepEqual(next.claims, [
    { playerId: player.id, numbers: player.stand, correct: true, turn: 1 },
  ]);
});

test('annonce incorrecte à 2 joueurs : le dernier joueur en lice gagne', () => {
  const game = makeGame(2, 11);
  const player = game.players[game.currentPlayer];
  const next = claim(game, wrongClaim(player.stand));

  assert.equal(next.phase, PHASES.GAME_OVER);
  assert.equal(next.winner, 1 - player.id);
  assert.equal(next.winReason, 'lastActive');
  assert.equal(next.players[player.id].eliminated, true);
  assert.equal(next.claims.length, 1);
  assert.equal(next.claims[0].playerId, player.id);
  assert.equal(next.claims[0].correct, false);
  assert.deepEqual(next.claims[0].numbers, wrongClaim(player.stand));
});

test('annonce incorrecte à 3 joueurs : la partie continue puis le dernier gagne', () => {
  let game = makeGame(3, 12);
  const first = game.players[0];
  game = claim(game, wrongClaim(first.stand));

  assert.equal(game.phase, PHASES.REVEAL);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.turn, 2);
  assert.equal(game.players[0].eliminated, true);
  assert.equal(activePlayers(game).length, 2);

  const second = game.players[1];
  game = claim(game, wrongClaim(second.stand));

  assert.equal(game.phase, PHASES.GAME_OVER);
  assert.equal(game.winner, 2);
  assert.equal(game.winReason, 'lastActive');
  assert.equal(game.players[1].eliminated, true);
});

test('une annonce invalide est refusée sans consommer la tentative', () => {
  const game = makeGame(2, 1);
  assert.equal(isValidClaimNumbers([1, 2, 3, 4, 5]), true);
  assert.equal(isValidClaimNumbers([1, 2, 3, 4, 4]), false);
  assert.equal(isValidClaimNumbers([5, 4, 3, 2, 1]), false);
  assert.equal(isValidClaimNumbers([1, 2, 3, 4, 61]), false);
  assert.equal(isValidClaimNumbers([1, 2, 3, 4]), false);

  assert.throws(() => claim(game, [1, 2, 3, 4, 4]));
  assert.throws(() => claim(game, [5, 4, 3, 2, 1]));
  assert.equal(game.players[0].hasClaimed, false);
});

test('les numéros visibles excluent le support du joueur et incluent les indices posés', () => {
  let game = makeGame(3, 8);
  const viewer = game.players[0];
  let visible = visibleNumbersFor(game, viewer.id);

  for (const n of viewer.stand) assert.equal(visible.has(n), false);
  for (const other of game.players.slice(1)) {
    for (const n of other.stand) assert.equal(visible.has(n), true);
  }
  for (const n of game.publicTiles) assert.equal(visible.has(n), true);

  const colorIndex = canRevealColors(game).findIndex(Boolean);
  game = reveal(game, colorIndex);
  const clueTile = game.publicTiles[0];
  game = chooseTile(game, clueTile);
  game = chooseClue(game, 'sort');

  visible = visibleNumbersFor(game, viewer.id);
  assert.equal(visible.has(clueTile), true);
  for (const n of viewer.stand) assert.equal(visible.has(n), false);
});

test('réserve vide : on saute la révélation', () => {
  const game = makeGame(2, 3);
  const emptySupply = { ...game, supply: [], phase: PHASES.REVEAL };
  const next = skipReveal(emptySupply);

  assert.equal(next.phase, PHASES.CHOOSE_TILE);
  assert.equal(next.publicTiles.length, 5);
  assert.equal(next.revealed, null);
});

test('réserve et tuiles visibles vides : le tour peut se terminer', () => {
  const game = makeGame(2, 3);
  const empty = {
    ...game,
    supply: [],
    publicTiles: [],
    phase: PHASES.REVEAL,
  };
  const next = skipReveal(empty);

  assert.equal(next.phase, PHASES.END);
  assert.equal(next.clue, null);
  assert.throws(() => endTurn({ ...game, phase: PHASES.REVEAL }));
  assert.equal(endTurn(next).phase, PHASES.REVEAL);
});
