import { COLORS, TILES, isTileNumber, tile } from './tiles.js';
import { mulberry32, shuffle } from './rng.js';

export const PHASES = Object.freeze({
  REVEAL: 'reveal',
  CHOOSE_TILE: 'chooseTile',
  CHOOSE_CLUE: 'chooseClue',
  COMPARE_SLOT: 'compareSlot',
  END: 'end',
  GAME_OVER: 'gameOver',
});

function clone(state) {
  return structuredClone(state);
}

function addLog(state, key, params = {}, type = 'info') {
  state.log.push({ turn: state.turn, key, params, type });
}

function resetTurnFields(state) {
  state.revealed = null;
  state.lastRevealed = null;
  state.chosenTile = null;
  state.clue = null;
}

function nextActiveIndex(state, from) {
  const count = state.players.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (from + step) % count;
    if (!state.players[index].eliminated) return index;
  }
  return from;
}

export function currentPlayer(state) {
  return state.players[state.currentPlayer];
}

export function activePlayers(state) {
  return state.players.filter((player) => !player.eliminated);
}

export function canRevealColors(state) {
  return COLORS.map((_, colorIndex) =>
    state.supply.some((n) => tile(n).colorIndex === colorIndex),
  );
}

export function visibleNumbersFor(state, playerId) {
  const visible = new Set();
  for (const player of state.players) {
    if (player.id !== playerId) {
      for (const n of player.stand) visible.add(n);
    }
    for (const group of player.sorting) {
      for (const n of group) visible.add(n);
    }
    for (const group of player.comparisons) {
      for (const clue of group) visible.add(clue.n);
    }
  }
  for (const n of state.publicTiles) visible.add(n);
  return visible;
}

export function isValidClaimNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== 5) return false;
  if (!numbers.every((n) => isTileNumber(n))) return false;
  if (new Set(numbers).size !== 5) return false;
  return numbers.every((n, index) => index === 0 || numbers[index - 1] < n);
}

function normalizeNames(names) {
  if (!Array.isArray(names) || names.length < 2 || names.length > 4) {
    throw new Error('Il faut entre 2 et 4 joueurs.');
  }
  return names.map((name, index) => {
    const clean = String(name ?? '').trim().slice(0, 20);
    return clean || `Joueur ${index + 1}`;
  });
}

function normalizeKinds(kinds, count) {
  if (kinds === undefined || kinds === null) return Array(count).fill('human');
  if (!Array.isArray(kinds) || kinds.length !== count) {
    throw new Error('Types de joueurs invalides.');
  }
  return kinds.map((kind) => (kind === 'bot' ? 'bot' : 'human'));
}

export function createGame({ names, kinds, seed = 0, startingPlayer = 0 }) {
  const playerNames = normalizeNames(names);
  const playerKinds = normalizeKinds(kinds, playerNames.length);
  const safeSeed = Number(seed) >>> 0;
  const rand = mulberry32(safeSeed);
  const shuffled = shuffle(
    TILES.map((t) => t.n),
    rand,
  );
  const used = new Set();

  const players = playerNames.map((name, id) => ({
    id,
    name,
    kind: playerKinds[id],
    stand: [],
    standColors: [],
    sorting: Array.from({ length: 6 }, () => []),
    comparisons: Array.from({ length: 5 }, () => []),
    manual: [],
    draft: ['', '', '', '', ''],
    eliminated: false,
    hasClaimed: false,
  }));

  for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex += 1) {
    for (const player of players) {
      const n = shuffled.find(
        (candidate) => !used.has(candidate) && tile(candidate).colorIndex === colorIndex,
      );
      if (n === undefined) throw new Error('Distribution impossible.');
      used.add(n);
      player.stand.push(n);
    }
  }
  for (const player of players) {
    player.stand.sort((a, b) => a - b);
    player.standColors = player.stand.map((n) => tile(n).colorIndex);
  }

  const publicTiles = [];
  for (let colorIndex = 0; colorIndex < COLORS.length; colorIndex += 1) {
    const n = shuffled.find(
      (candidate) => !used.has(candidate) && tile(candidate).colorIndex === colorIndex,
    );
    if (n === undefined) throw new Error('Distribution publique impossible.');
    used.add(n);
    publicTiles.push(n);
  }
  publicTiles.sort((a, b) => a - b);

  const supply = shuffled.filter((n) => !used.has(n));
  const safeStart = Math.max(0, Math.min(players.length - 1, Number(startingPlayer) | 0));

  const state = {
    seed: safeSeed,
    startingPlayer: safeStart,
    players,
    supply,
    publicTiles,
    currentPlayer: safeStart,
    phase: PHASES.REVEAL,
    turn: 1,
    revealed: null,
    lastRevealed: null,
    chosenTile: null,
    clue: null,
    winner: null,
    winReason: null,
    claims: [],
    log: [],
  };
  addLog(state, 'setup', { player: players[safeStart].name }, 'setup');
  return state;
}

export function reveal(state, colorIndex) {
  if (state.phase !== PHASES.REVEAL) throw new Error('Action impossible maintenant.');
  if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= COLORS.length) {
    throw new Error('Couleur invalide.');
  }
  const next = clone(state);
  const index = next.supply.findIndex((n) => tile(n).colorIndex === colorIndex);
  if (index === -1) throw new Error('Plus de tuile de cette couleur dans la réserve.');
  const [n] = next.supply.splice(index, 1);
  next.publicTiles.push(n);
  next.publicTiles.sort((a, b) => a - b);
  next.revealed = n;
  next.lastRevealed = n;
  next.phase = PHASES.CHOOSE_TILE;
  addLog(next, 'reveal', { player: currentPlayer(next).name, tile: n }, 'reveal');
  return next;
}

export function skipReveal(state) {
  if (state.phase !== PHASES.REVEAL) throw new Error('Action impossible maintenant.');
  if (state.supply.length !== 0) throw new Error('La réserve n’est pas vide.');
  const next = clone(state);
  next.revealed = null;
  next.lastRevealed = null;
  if (next.publicTiles.length === 0) {
    next.phase = PHASES.END;
    next.clue = null;
    addLog(next, 'skipNoTiles', {}, 'info');
  } else {
    next.phase = PHASES.CHOOSE_TILE;
    addLog(next, 'skipEmpty', {}, 'info');
  }
  return next;
}

export function chooseTile(state, n) {
  if (state.phase !== PHASES.CHOOSE_TILE) throw new Error('Action impossible maintenant.');
  if (!state.publicTiles.includes(n)) throw new Error('Cette tuile n’est pas visible.');
  const next = clone(state);
  next.chosenTile = n;
  next.phase = PHASES.CHOOSE_CLUE;
  return next;
}

export function chooseClue(state, type) {
  if (state.phase !== PHASES.CHOOSE_CLUE) throw new Error('Action impossible maintenant.');
  if (type !== 'sort' && type !== 'compare') throw new Error('Indice inconnu.');
  if (state.chosenTile === null) throw new Error('Aucune tuile choisie.');

  const next = clone(state);
  const player = currentPlayer(next);
  const n = next.chosenTile;

  if (type === 'sort') {
    const notch = player.stand.filter((value) => value < n).length;
    player.sorting[notch].push(n);
    next.publicTiles = next.publicTiles.filter((value) => value !== n);
    next.clue = { type: 'sort', tile: n, notch };
    next.phase = PHASES.END;
    addLog(next, 'sort', { player: player.name, tile: n, notch }, 'clue');
  } else {
    next.phase = PHASES.COMPARE_SLOT;
  }
  return next;
}

export function cancelClue(state) {
  if (state.phase !== PHASES.CHOOSE_CLUE && state.phase !== PHASES.COMPARE_SLOT) {
    throw new Error('Aucun indice à annuler.');
  }
  const next = clone(state);
  next.phase = PHASES.CHOOSE_TILE;
  next.chosenTile = null;
  next.clue = null;
  return next;
}

export function chooseCompareSlot(state, slotIndex) {
  if (state.phase !== PHASES.COMPARE_SLOT) throw new Error('Action impossible maintenant.');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 4) {
    throw new Error('Emplacement invalide.');
  }
  if (state.chosenTile === null) throw new Error('Aucune tuile choisie.');

  const next = clone(state);
  const player = currentPlayer(next);
  const n = next.chosenTile;
  const target = player.stand[slotIndex];
  const targetTile = tile(target);
  const same = tile(n).dots === targetTile.dots;
  player.comparisons[slotIndex].push({ n, same });
  next.publicTiles = next.publicTiles.filter((value) => value !== n);
  next.clue = { type: 'compare', tile: n, slot: slotIndex, same };
  next.phase = PHASES.END;
  addLog(
    next,
    'compare',
    {
      player: player.name,
      tile: n,
      slot: slotIndex,
      colorIndex: targetTile.colorIndex,
      same,
    },
    'clue',
  );
  return next;
}

export function endTurn(state) {
  if (state.phase !== PHASES.END) throw new Error('Le tour ne peut pas encore se terminer.');
  const next = clone(state);
  resetTurnFields(next);
  next.currentPlayer = nextActiveIndex(next, next.currentPlayer);
  next.turn += 1;
  next.phase = PHASES.REVEAL;
  return next;
}

export function claim(state, numbers) {
  if (state.phase === PHASES.GAME_OVER) throw new Error('La partie est terminée.');
  if (!isValidClaimNumbers(numbers)) {
    throw new Error('Annonce invalide : 5 numéros distincts, dans l’ordre croissant, entre 1 et 60.');
  }
  const player = currentPlayer(state);
  if (player.eliminated || player.hasClaimed) throw new Error('Ce joueur ne peut plus annoncer.');

  const next = clone(state);
  const claimant = currentPlayer(next);
  claimant.hasClaimed = true;

  const correct = claimant.stand.every((n, index) => n === numbers[index]);
  next.claims.push({
    playerId: claimant.id,
    numbers: numbers.slice(),
    correct,
    turn: next.turn,
  });

  if (correct) {
    next.winner = claimant.id;
    next.winReason = 'claim';
    next.phase = PHASES.GAME_OVER;
    addLog(next, 'claimWin', { player: claimant.name }, 'win');
    return next;
  }

  claimant.eliminated = true;
  addLog(next, 'claimLose', { player: claimant.name }, 'elimination');

  const remaining = activePlayers(next);
  if (remaining.length === 1) {
    next.winner = remaining[0].id;
    next.winReason = 'lastActive';
    next.phase = PHASES.GAME_OVER;
    addLog(next, 'lastActive', { player: remaining[0].name }, 'win');
    return next;
  }
  if (remaining.length === 0) {
    next.winner = null;
    next.winReason = 'draw';
    next.phase = PHASES.GAME_OVER;
    addLog(next, 'draw', {}, 'win');
    return next;
  }

  resetTurnFields(next);
  next.currentPlayer = nextActiveIndex(next, next.currentPlayer);
  next.turn += 1;
  next.phase = PHASES.REVEAL;
  return next;
}
