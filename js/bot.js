import { COLORS, TILES, tile } from './tiles.js';
import { PHASES, canRevealColors, visibleNumbersFor } from './engine.js';

const ACTION_LIMIT = 2000;

export function buildBotView(game, playerId) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Joueur IA introuvable.');
  return {
    playerId,
    phase: game.phase,
    slotColors: player.standColors ?? player.stand.map((n) => (n - 1) % 5),
    visibleNumbers: visibleNumbersFor(game, playerId),
    sorting: player.sorting,
    comparisons: player.comparisons,
    publicTiles: game.publicTiles.slice(),
    chosenTile: game.chosenTile,
    availableColors: canRevealColors(game),
    supplyEmpty: game.supply.length === 0,
  };
}

export function computeCandidates(view) {
  const candidates = view.slotColors.map((colorIndex) =>
    TILES.filter(
      (candidate) =>
        candidate.colorIndex === colorIndex && !view.visibleNumbers.has(candidate.n),
    ).map((candidate) => candidate.n),
  );

  for (let notch = 0; notch < 6; notch += 1) {
    for (const clueTile of view.sorting[notch]) {
      for (let slot = 0; slot < 5; slot += 1) {
        candidates[slot] = candidates[slot].filter((n) =>
          slot < notch ? n < clueTile : n > clueTile,
        );
      }
    }
  }

  for (let slot = 0; slot < 5; slot += 1) {
    for (const clue of view.comparisons[slot]) {
      const dots = tile(clue.n).dots;
      candidates[slot] = candidates[slot].filter(
        (n) => (tile(n).dots === dots) === clue.same,
      );
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let slot = 0; slot < 5; slot += 1) {
      for (const n of [...candidates[slot]]) {
        const hasPrevious = slot === 0 || candidates[slot - 1].some((value) => value < n);
        const hasNext = slot === 4 || candidates[slot + 1].some((value) => value > n);
        if (!hasPrevious || !hasNext) {
          candidates[slot] = candidates[slot].filter((value) => value !== n);
          changed = true;
        }
      }
    }
  }

  return candidates;
}

export function enumerateSolutions(view, limit = ACTION_LIMIT) {
  const candidates = computeCandidates(view);
  const solutions = [];
  const current = [];

  function backtrack(slot) {
    if (solutions.length >= limit) return;
    if (slot === 5) {
      solutions.push(current.slice());
      return;
    }
    for (const n of candidates[slot]) {
      if (slot > 0 && n <= current[slot - 1]) continue;
      current.push(n);
      backtrack(slot + 1);
      current.pop();
      if (solutions.length >= limit) return;
    }
  }

  backtrack(0);
  return solutions;
}

function expectedRemaining(solutions, outcomeFor) {
  if (solutions.length === 0) return Number.POSITIVE_INFINITY;
  const groups = new Map();
  for (const solution of solutions) {
    const key = outcomeFor(solution);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let total = 0;
  for (const count of groups.values()) total += count * count;
  return total / solutions.length;
}

function sortOutcome(solution, tileNumber) {
  return solution.filter((n) => n < tileNumber).length;
}

function compareOutcome(solution, slot, tileNumber) {
  return tile(solution[slot]).dots === tile(tileNumber).dots;
}

function chooseRevealColor(view) {
  const candidates = computeCandidates(view);
  const counts = new Array(COLORS.length).fill(0);
  view.slotColors.forEach((colorIndex, slot) => {
    counts[colorIndex] += candidates[slot].length;
  });
  let best = -1;
  let bestCount = -1;
  for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex += 1) {
    if (!view.availableColors[colorIndex]) continue;
    if (counts[colorIndex] > bestCount) {
      best = colorIndex;
      bestCount = counts[colorIndex];
    }
  }
  return best;
}

function chooseTile(view, solutions) {
  if (view.publicTiles.length === 0) return null;
  if (solutions.length === 0) return view.publicTiles[0];

  let bestTile = view.publicTiles[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const tileNumber of view.publicTiles) {
    const sortScore = expectedRemaining(solutions, (solution) =>
      sortOutcome(solution, tileNumber),
    );
    let compareScore = Number.POSITIVE_INFINITY;
    for (let slot = 0; slot < 5; slot += 1) {
      compareScore = Math.min(
        compareScore,
        expectedRemaining(solutions, (solution) =>
          compareOutcome(solution, slot, tileNumber),
        ),
      );
    }
    const score = Math.min(sortScore, compareScore);
    if (score < bestScore || (score === bestScore && tileNumber < bestTile)) {
      bestScore = score;
      bestTile = tileNumber;
    }
  }
  return bestTile;
}

function chooseClue(view, solutions) {
  const tileNumber = view.chosenTile;
  if (tileNumber === null) return 'sort';
  const sortScore = expectedRemaining(solutions, (solution) =>
    sortOutcome(solution, tileNumber),
  );
  let compareScore = Number.POSITIVE_INFINITY;
  for (let slot = 0; slot < 5; slot += 1) {
    compareScore = Math.min(
      compareScore,
      expectedRemaining(solutions, (solution) =>
        compareOutcome(solution, slot, tileNumber),
      ),
    );
  }
  return sortScore <= compareScore ? 'sort' : 'compare';
}

function chooseCompareSlot(view, solutions) {
  const tileNumber = view.chosenTile;
  if (tileNumber === null) return 0;
  let bestSlot = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let slot = 0; slot < 5; slot += 1) {
    const score = expectedRemaining(solutions, (solution) =>
      compareOutcome(solution, slot, tileNumber),
    );
    if (score < bestScore) {
      bestScore = score;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

export function chooseBotAction(view) {
  const unique = enumerateSolutions(view, 2);
  if (unique.length === 1) {
    return { type: 'claim', numbers: unique[0] };
  }

  const solutions = enumerateSolutions(view, ACTION_LIMIT);
  const noMoreInformation = view.supplyEmpty && view.publicTiles.length === 0;
  if (noMoreInformation && solutions.length > 0) {
    return { type: 'claim', numbers: solutions[0] };
  }

  if (view.phase === PHASES.REVEAL) {
    if (view.supplyEmpty) return { type: 'skipReveal' };
    const colorIndex = chooseRevealColor(view);
    if (colorIndex === -1) return { type: 'skipReveal' };
    return { type: 'reveal', colorIndex };
  }

  if (view.phase === PHASES.CHOOSE_TILE) {
    const tileNumber = chooseTile(view, solutions);
    if (tileNumber === null) return { type: 'endTurn' };
    return { type: 'chooseTile', tile: tileNumber };
  }

  if (view.phase === PHASES.CHOOSE_CLUE) {
    return { type: 'chooseClue', clue: chooseClue(view, solutions) };
  }

  if (view.phase === PHASES.COMPARE_SLOT) {
    return { type: 'compareSlot', slot: chooseCompareSlot(view, solutions) };
  }

  if (view.phase === PHASES.END) {
    return { type: 'endTurn' };
  }

  throw new Error(`Phase IA inconnue : ${view.phase}`);
}
