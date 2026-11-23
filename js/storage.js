const KEY = 'gotfive.save.v1';
const VERSION = 1;

function validGame(game) {
  if (!game || !Array.isArray(game.players)) return false;
  if (game.players.length < 2 || game.players.length > 4) return false;
  if (!Array.isArray(game.supply) || !Array.isArray(game.publicTiles)) return false;
  if (!game.players.every((player) => Array.isArray(player.stand) && player.stand.length === 5)) {
    return false;
  }
  return true;
}

export function saveGame(game) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, game, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

function normalizeGame(game) {
  if (!Array.isArray(game.claims)) game.claims = [];
  for (const player of game.players) {
    if (!player.kind) player.kind = 'human';
    if (!Array.isArray(player.standColors) && Array.isArray(player.stand)) {
      player.standColors = player.stand.map((n) => (n - 1) % 5);
    }
  }
  return game;
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== VERSION || !validGame(parsed.game)) return null;
    return normalizeGame(parsed.game);
  } catch {
    return null;
  }
}

export function readSaveMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== VERSION || !validGame(parsed.game)) return null;
    return {
      playerNames: parsed.game.players.map((player) => player.name),
      turn: parsed.game.turn,
      phase: parsed.game.phase,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Le jeu continue sans sauvegarde si le stockage est indisponible.
  }
}
