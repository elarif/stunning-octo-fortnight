import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORS, tile } from '../js/tiles.js';
import {
  PHASES,
  chooseClue,
  chooseCompareSlot,
  chooseTile,
  claim,
  createGame,
  currentPlayer,
  endTurn,
  reveal,
  skipReveal,
} from '../js/engine.js';
import {
  buildBotView,
  chooseBotAction,
  computeCandidates,
  enumerateSolutions,
} from '../js/bot.js';

function applyAction(game, action) {
  switch (action.type) {
    case 'claim':
      return claim(game, action.numbers);
    case 'reveal':
      return reveal(game, action.colorIndex);
    case 'skipReveal':
      return skipReveal(game);
    case 'chooseTile':
      return chooseTile(game, action.tile);
    case 'chooseClue':
      return chooseClue(game, action.clue);
    case 'compareSlot':
      return chooseCompareSlot(game, action.slot);
    case 'endTurn':
      return endTurn(game);
    default:
      throw new Error(`Action IA inconnue : ${action.type}`);
  }
}

test('la vue IA ne contient pas le support caché', () => {
  const game = createGame({
    names: ['Alice', 'IA 1'],
    kinds: ['human', 'bot'],
    seed: 12,
  });
  const bot = game.players[1];
  const view = buildBotView(game, bot.id);

  assert.equal(Object.hasOwn(view, 'stand'), false);
  assert.equal(Object.hasOwn(view, 'ownStand'), false);
  assert.equal(view.slotColors.length, 5);
  assert.equal(new Set(view.slotColors).size, 5);
  for (const n of bot.stand) {
    assert.equal(view.slotColors.includes((n - 1) % 5), true);
  }
});

test('les candidats respectent les couleurs, les numéros visibles et le vrai support', () => {
  const game = createGame({
    names: ['Alice', 'IA 1'],
    kinds: ['human', 'bot'],
    seed: 21,
  });
  const bot = game.players[1];
  const view = buildBotView(game, bot.id);
  const candidates = computeCandidates(view);

  for (let slot = 0; slot < 5; slot += 1) {
    for (const n of candidates[slot]) {
      assert.equal(tile(n).colorIndex, view.slotColors[slot]);
      assert.equal(view.visibleNumbers.has(n), false);
    }
    assert.equal(candidates[slot].includes(bot.stand[slot]), true);
  }
});

test('une solution unique est le vrai support', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    let game = createGame({
      names: ['IA 1', 'IA 2'],
      kinds: ['bot', 'bot'],
      seed,
      startingPlayer: 0,
    });
    let steps = 0;
    while (game.phase !== PHASES.GAME_OVER && steps < 600) {
      const player = currentPlayer(game);
      const view = buildBotView(game, player.id);
      const action = chooseBotAction(view);
      const unique = enumerateSolutions(view, 2);
      if (action.type === 'claim' && unique.length === 1) {
        assert.deepEqual(action.numbers, player.stand);
      }
      game = applyAction(game, action);
      steps += 1;
    }
    assert.equal(game.phase, PHASES.GAME_OVER, `partie non terminée pour la graine ${seed}`);
    assert.notEqual(game.winner, null, `aucun vainqueur pour la graine ${seed}`);
  }
});

test('l’IA joue des actions légales et termine son tour', () => {
  let game = createGame({
    names: ['Alice', 'IA 1'],
    kinds: ['human', 'bot'],
    seed: 7,
    startingPlayer: 1,
  });
  let steps = 0;
  while (game.phase !== PHASES.GAME_OVER && steps < 600) {
    const player = currentPlayer(game);
    const action = chooseBotAction(buildBotView(game, player.id));
    game = applyAction(game, action);
    steps += 1;
  }
  assert.equal(game.phase, PHASES.GAME_OVER);
  assert.notEqual(game.winner, null);
});

test('les candidats excluent les numéros visibles et les indices posés', () => {
  const game = createGame({
    names: ['Alice', 'IA 1'],
    kinds: ['human', 'bot'],
    seed: 33,
  });
  const bot = game.players[1];
  const view = buildBotView(game, bot.id);
  const candidates = computeCandidates(view);

  for (const n of view.visibleNumbers) {
    for (const slotCandidates of candidates) {
      assert.equal(slotCandidates.includes(n), false);
    }
  }
  for (let slot = 0; slot < 5; slot += 1) {
    assert.equal(
      candidates[slot].every((n) => tile(n).colorIndex === view.slotColors[slot]),
      true,
    );
  }
});
