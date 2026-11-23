import { COLORS, tile, tilesForColor } from './tiles.js';
import {
  PHASES,
  canRevealColors,
  cancelClue,
  chooseClue,
  chooseCompareSlot,
  chooseTile,
  claim,
  createGame,
  currentPlayer,
  endTurn,
  isValidClaimNumbers,
  ordinal,
  positionLabel,
  reveal,
  skipReveal,
  visibleNumbersFor,
} from './engine.js';
import { buildBotView, chooseBotAction } from './bot.js';
import { randomSeed } from './rng.js';
import { clearSave, loadGame, readSaveMeta, saveGame } from './storage.js';

const root = document.getElementById('app');

const app = {
  game: null,
  screen: 'home',
  privacy: true,
  notice: null,
  saved: null,
  setup: { mode: 'local', count: 2, names: ['', '', '', ''], starting: 0 },
  selectedTile: null,
  claimOpen: false,
  ficheOpen: false,
  rulesReturn: null,
  botPlayerId: null,
  botTimer: null,
  botMessage: null,
};

const TITLES = {
  home: 'Got Five ! — version locale',
  setup: 'Nouvelle partie — Got Five !',
  pass: 'Passage — Got Five !',
  notes: 'Mes notes — Got Five !',
  turn: 'Tour — Got Five !',
  bot: 'Tour de l’IA — Got Five !',
  gameover: 'Partie terminée — Got Five !',
  review: 'Table finale — Got Five !',
  rules: 'Règles — Got Five !',
};

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') {
      for (const [property, propertyValue] of Object.entries(value)) {
        if (property.startsWith('--')) node.style.setProperty(property, propertyValue);
        else node.style[property] = propertyValue;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (['disabled', 'checked', 'selected', 'value'].includes(key)) {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  appendChildren(node, children);
  return node;
}

function dotsEl(count) {
  return h(
    'span',
    { class: 'dots', 'aria-hidden': 'true' },
    Array.from({ length: count }, () => h('span', { class: 'dot' })),
  );
}

function tileEl(n, options = {}) {
  const { size = 'md', onclick = null, selected = false, highlight = false, tilt = false, badge = null, disabled = false } = options;
  const t = tile(n);
  const classes = ['tile', `tile--${t.color.id}`, `tile--${size}`];
  if (selected) classes.push('is-selected');
  if (highlight) classes.push('is-highlight');
  if (tilt) classes.push('is-tilted');

  const content = [
    h('span', { class: 'tile-glyph', 'aria-hidden': 'true', text: t.color.symbol }),
    h('span', { class: 'tile-num', text: String(t.n) }),
    dotsEl(t.dots),
  ];
  if (badge) content.push(h('span', { class: 'tile-badge', text: badge }));

  const attrs = {
    class: classes.join(' '),
    style: { '--tile-bg': t.color.hex, '--tile-ink': t.color.ink },
    'aria-label': `Tuile ${t.n}, ${t.color.name}, ${t.dots} point${t.dots > 1 ? 's' : ''}`,
  };
  if (onclick && !disabled) {
    return h('button', { ...attrs, type: 'button', onclick }, ...content);
  }
  return h('div', { ...attrs, ...(disabled ? { 'aria-disabled': 'true' } : {}) }, ...content);
}

function backTile(tileData) {
  return h(
    'div',
    {
      class: 'tile tile--back',
      style: { '--tile-bg': tileData.hex, '--tile-ink': tileData.ink },
      'aria-hidden': 'true',
    },
    h('span', { class: 'tile-glyph', text: tileData.symbol }),
    h('span', { class: 'tile-question', text: '?' }),
  );
}

function topBar(title, onBack, extra = null) {
  return h(
    'header',
    { class: 'topbar' },
    h('button', { class: 'btn btn--icon', type: 'button', onclick: onBack, 'aria-label': 'Retour' }, '←'),
    h('h1', { class: 'topbar-title', text: title }),
    extra ?? h('span', { class: 'topbar-spacer' }),
  );
}

function persist() {
  if (!app.game) return;
  const ok = saveGame(app.game);
  if (!ok) console.warn('Sauvegarde locale indisponible.');
}

function clearBotTimer() {
  if (app.botTimer) {
    clearTimeout(app.botTimer);
    app.botTimer = null;
  }
}

function humanCount(game) {
  return game.players.filter((player) => player.kind !== 'bot').length;
}

function botActionMessage(action) {
  if (action.type === 'reveal') return 'L’IA révèle une tuile.';
  if (action.type === 'skipReveal') return 'L’IA passe la révélation.';
  if (action.type === 'chooseTile') return `L’IA choisit le ${action.tile}.`;
  if (action.type === 'chooseClue') {
    return action.clue === 'sort'
      ? 'L’IA demande un classement.'
      : 'L’IA demande une comparaison.';
  }
  if (action.type === 'compareSlot') return 'L’IA compare les points.';
  if (action.type === 'endTurn') return 'L’IA termine son tour.';
  if (action.type === 'claim') return 'L’IA annonce GOT FIVE !';
  return 'L’IA réfléchit…';
}

function applyBotAction(game, action) {
  if (action.type === 'claim') return claim(game, action.numbers);
  if (action.type === 'reveal') return reveal(game, action.colorIndex);
  if (action.type === 'skipReveal') return skipReveal(game);
  if (action.type === 'chooseTile') return chooseTile(game, action.tile);
  if (action.type === 'chooseClue') return chooseClue(game, action.clue);
  if (action.type === 'compareSlot') return chooseCompareSlot(game, action.slot);
  if (action.type === 'endTurn') return endTurn(game);
  throw new Error(`Action IA inconnue : ${action.type}`);
}

function runBotStep() {
  app.botTimer = null;
  if (!app.game || app.screen !== 'bot') return;
  if (app.game.phase === PHASES.GAME_OVER) {
    enterCurrentTurn();
    return;
  }

  const player = app.game.players[app.botPlayerId] ?? currentPlayer(app.game);
  if (!player || player.kind !== 'bot') {
    enterCurrentTurn();
    return;
  }

  let action;
  try {
    action = chooseBotAction(buildBotView(app.game, player.id));
  } catch (error) {
    app.botMessage = `Erreur IA : ${error.message}`;
    render();
    return;
  }

  try {
    app.game = applyBotAction(app.game, action);
    app.botMessage = botActionMessage(action);
    persist();

    if (app.game.phase === PHASES.GAME_OVER) {
      app.screen = 'gameover';
      app.privacy = false;
      app.botPlayerId = null;
      app.notice = null;
      render();
      return;
    }

    const stillBotTurn =
      currentPlayer(app.game).id === player.id && !app.game.players[player.id].eliminated;
    render();
    if (stillBotTurn) {
      scheduleBotStep(700);
    } else {
      app.botTimer = setTimeout(enterCurrentTurn, 700);
    }
  } catch (error) {
    app.botMessage = `Erreur IA : ${error.message}`;
    render();
  }
}

function scheduleBotStep(delay = 700) {
  clearBotTimer();
  app.botTimer = setTimeout(runBotStep, delay);
}

function enterCurrentTurn() {
  clearBotTimer();
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;

  if (!app.game) {
    app.screen = 'home';
    app.privacy = true;
    app.botPlayerId = null;
    render();
    return;
  }

  if (app.game.phase === PHASES.GAME_OVER) {
    app.screen = 'gameover';
    app.privacy = false;
    app.botPlayerId = null;
    app.notice = null;
    render();
    return;
  }

  const player = currentPlayer(app.game);
  if (player.kind === 'bot') {
    app.botPlayerId = player.id;
    app.botMessage = 'L’IA réfléchit…';
    app.screen = 'bot';
    app.privacy = true;
    render();
    scheduleBotStep(700);
    return;
  }

  app.botPlayerId = null;
  app.botMessage = null;
  if (humanCount(app.game) > 1) {
    app.screen = 'pass';
    app.privacy = true;
  } else {
    app.screen = 'turn';
    app.privacy = false;
    app.notice = null;
  }
  render();
}

function goHome() {
  clearBotTimer();
  app.game = null;
  app.screen = 'home';
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;
  app.notice = null;
  app.botPlayerId = null;
  app.botMessage = null;
  render();
}

function requestNewGame() {
  const inProgress = app.game
    ? app.game.phase !== PHASES.GAME_OVER
    : app.saved && app.saved.phase !== PHASES.GAME_OVER;
  if (inProgress && !window.confirm('Une partie est en cours. La remplacer ?')) return;
  clearBotTimer();
  clearSave();
  app.game = null;
  app.saved = null;
  app.screen = 'setup';
  app.privacy = true;
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;
  app.notice = null;
  app.botPlayerId = null;
  app.botMessage = null;
  render();
}

function continueGame() {
  clearBotTimer();
  const game = loadGame();
  if (!game) {
    app.saved = null;
    app.screen = 'home';
    app.notice = 'Sauvegarde illisible. Lance une nouvelle partie.';
    render();
    return;
  }
  app.game = game;
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;
  app.notice = null;
  app.botPlayerId = null;
  app.botMessage = null;
  enterCurrentTurn();
}

function startGame() {
  const solo = app.setup.mode === 'solo';
  const count = solo ? 2 : app.setup.count;
  const names = solo
    ? [app.setup.names[0] || 'Joueur 1', 'IA 1']
    : app.setup.names.slice(0, count);
  const kinds = solo ? ['human', 'bot'] : names.map(() => 'human');
  const game = createGame({
    names,
    kinds,
    seed: randomSeed(),
    startingPlayer: solo
      ? Math.min(app.setup.starting, 1)
      : app.setup.starting,
  });
  app.game = game;
  app.notice = null;
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;
  app.botPlayerId = null;
  app.botMessage = null;
  persist();
  enterCurrentTurn();
}

function startTurn() {
  clearBotTimer();
  app.botPlayerId = null;
  app.botMessage = null;
  app.screen = 'turn';
  app.privacy = false;
  app.notice = null;
  app.selectedTile = null;
  app.ficheOpen = false;
  render();
}

function openRules() {
  clearBotTimer();
  app.rulesReturn = { screen: app.screen };
  app.screen = 'rules';
  app.claimOpen = false;
  app.ficheOpen = false;
  render();
}

function closeRules() {
  const returnTo = app.rulesReturn ?? { screen: 'home' };
  app.screen = returnTo.screen;
  app.rulesReturn = null;
  if (app.screen === 'turn' && app.privacy) app.screen = 'pass';
  render();
}

function runAction(action) {
  try {
    app.game = action(app.game);
    app.notice = null;
    persist();
    render();
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function doReveal(colorIndex) {
  runAction((game) => reveal(game, colorIndex));
}

function doSkipReveal() {
  runAction((game) => skipReveal(game));
}

function selectPublicTile(n) {
  if (!app.game || app.game.phase !== PHASES.CHOOSE_TILE) return;
  app.selectedTile = app.selectedTile === n ? null : n;
  render();
}

function clearSelectedTile() {
  app.selectedTile = null;
  render();
}

function doChooseClue(type) {
  try {
    let game = app.game;
    if (game.phase === PHASES.CHOOSE_TILE) {
      if (app.selectedTile === null) return;
      game = chooseTile(game, app.selectedTile);
    }
    game = chooseClue(game, type);
    app.game = game;
    app.selectedTile = null;
    app.notice = null;
    persist();
    render();
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function doCancelClue() {
  try {
    app.game = cancelClue(app.game);
    app.selectedTile = null;
    app.notice = null;
    persist();
    render();
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function doChooseCompareSlot(slot) {
  runAction((game) => chooseCompareSlot(game, slot));
}

function openFiche() {
  app.ficheOpen = true;
  render();
}

function closeFiche() {
  app.ficheOpen = false;
  render();
}

function doEndTurn() {
  try {
    app.game = endTurn(app.game);
    app.notice = null;
    persist();
    enterCurrentTurn();
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function openClaim() {
  if (!app.game || app.game.phase === PHASES.GAME_OVER) return;
  const player = currentPlayer(app.game);
  if (player.eliminated || player.hasClaimed) return;
  app.ficheOpen = false;
  app.claimOpen = true;
  render();
}

function closeClaim() {
  app.claimOpen = false;
  render();
}

function renderHome() {
  app.saved = readSaveMeta();
  return h(
    'main',
    { class: 'screen screen--home' },
    h(
      'div',
      { class: 'home-hero' },
      h('p', { class: 'eyebrow', text: 'Jeu de déduction — version locale' }),
      h('h1', { class: 'wordmark' }, 'GOT ', h('span', { class: 'wordmark-accent' }, 'FIVE'), ' !'),
      h('p', { class: 'tagline', text: 'Solo vs IA · 2 à 4 joueurs · hors ligne' }),
    ),
    h(
      'div',
      { class: 'home-actions' },
      h('button', { class: 'btn btn--primary btn--wide', type: 'button', onclick: requestNewGame }, 'Nouvelle partie'),
      app.saved
        ? h(
            'button',
            { class: 'btn btn--secondary btn--wide', type: 'button', onclick: continueGame },
            app.saved.phase === PHASES.GAME_OVER ? 'Voir la dernière partie' : 'Continuer la partie',
          )
        : null,
      h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: openRules }, 'Règles'),
    ),
    app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
    h(
      'p',
      { class: 'fineprint' },
      'Version non officielle, à usage personnel. Inspirée du jeu Got Five ! de Blue Orange.',
    ),
  );
}

function renderSetup() {
  const solo = app.setup.mode === 'solo';
  const modeButtons = [
    ['local', 'Local'],
    ['solo', 'Solo vs IA'],
  ].map(([mode, label]) =>
    h(
      'button',
      {
        class: `segment${app.setup.mode === mode ? ' is-active' : ''}`,
        type: 'button',
        'aria-pressed': String(app.setup.mode === mode),
        onclick: () => {
          app.setup.mode = mode;
          if (mode === 'solo') {
            app.setup.count = 2;
            app.setup.starting = 0;
          } else {
            app.setup.count = Math.max(2, Math.min(app.setup.count, 4));
            app.setup.starting = Math.min(app.setup.starting, app.setup.count - 1);
          }
          render();
        },
      },
      label,
    ),
  );

  const countButtons = [2, 3, 4].map((count) =>
    h(
      'button',
      {
        class: `segment${app.setup.count === count ? ' is-active' : ''}`,
        type: 'button',
        'aria-pressed': String(app.setup.count === count),
        onclick: () => {
          app.setup.count = count;
          app.setup.starting = Math.min(app.setup.starting, count - 1);
          render();
        },
      },
      String(count),
    ),
  );

  const nameFields = solo
    ? [
        h(
          'label',
          { class: 'field' },
          h('span', { class: 'field-label', text: 'Toi' }),
          h('input', {
            class: 'text-input',
            type: 'text',
            maxlength: '20',
            autocomplete: 'off',
            placeholder: 'Ton nom',
            value: app.setup.names[0] ?? '',
            oninput: (event) => {
              app.setup.names[0] = event.target.value;
              const option = document.querySelector('#start-player option[value="0"]');
              if (option) {
                option.textContent = event.target.value.trim() || 'Toi';
              }
            },
          }),
        ),
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'field-label', text: 'Adversaire' }),
          h(
            'div',
            { class: 'bot-player-row' },
            h('strong', { text: 'IA 1' }),
            h('span', { class: 'muted small', text: 'Joue automatiquement' }),
          ),
        ),
      ]
    : Array.from({ length: app.setup.count }, (_, index) =>
        h(
          'label',
          { class: 'field' },
          h('span', { class: 'field-label', text: `Joueur ${index + 1}` }),
          h('input', {
            class: 'text-input',
            type: 'text',
            maxlength: '20',
            autocomplete: 'off',
            placeholder: `Joueur ${index + 1}`,
            value: app.setup.names[index] ?? '',
            oninput: (event) => {
              app.setup.names[index] = event.target.value;
              const option = document.querySelector(`#start-player option[value="${index}"]`);
              if (option) {
                option.textContent = event.target.value.trim() || `Joueur ${index + 1}`;
              }
            },
          }),
        ),
      );

  const startOptions = Array.from({ length: solo ? 2 : app.setup.count }, (_, index) =>
    h(
      'option',
      { value: String(index), selected: app.setup.starting === index },
      solo
        ? index === 0
          ? app.setup.names[0]?.trim() || 'Toi'
          : 'IA 1'
        : app.setup.names[index]?.trim() || `Joueur ${index + 1}`,
    ),
  );

  return h(
    'main',
    { class: 'screen screen--setup' },
    topBar('Nouvelle partie', goHome),
    h(
      'section',
      { class: 'card setup-card' },
      h('h2', { text: 'Qui joue ?' }),
      h('p', { class: 'muted', text: solo ? 'Toi contre une IA locale.' : 'Choisis le nombre de joueurs, puis leurs noms.' }),
      h('div', { class: 'segments', role: 'group', 'aria-label': 'Mode de partie' }, modeButtons),
      solo
        ? h('p', { class: 'phase-note', text: '2 joueurs : toi et l’IA. L’IA joue automatiquement, sans écran de passage.' })
        : h('div', { class: 'segments', role: 'group', 'aria-label': 'Nombre de joueurs' }, countButtons),
      h('div', { class: 'player-fields' }, nameFields),
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field-label', text: solo ? 'Qui commence ?' : 'Premier joueur (le plus jeune)' }),
        h(
          'select',
          {
            class: 'text-input',
            id: 'start-player',
            onchange: (event) => {
              app.setup.starting = Number(event.target.value);
            },
          },
          startOptions,
        ),
      ),
      h('button', { class: 'btn btn--primary btn--wide', type: 'button', onclick: startGame }, 'Commencer la partie'),
      h(
        'p',
        { class: 'fineprint' },
        solo
          ? 'L’IA déduit à partir des informations publiques. Son écran de tour ne montre jamais ton support. Annonce GOT FIVE ! uniquement pendant ton tour.'
          : 'Sur un seul appareil, les joueurs se passent l’écran. L’annonce GOT FIVE ! se fait uniquement pendant ton tour.',
      ),
    ),
  );
}

function renderPass() {
  const game = app.game;
  if (!game) return renderHome();
  if (game.phase === PHASES.GAME_OVER) {
    app.screen = 'gameover';
    return renderGameOver();
  }
  const player = currentPlayer(game);
  return h(
    'main',
    { class: 'screen screen--pass' },
    h(
      'div',
      { class: 'pass-card' },
      h('p', { class: 'eyebrow', text: `Tour ${game.turn}` }),
      h('h1', { class: 'pass-title', text: 'Passe l’appareil à' }),
      h('div', { class: 'pass-name', text: player.name }),
      h(
        'p',
        { class: 'pass-warning' },
        'Les autres joueurs détournent le regard. Cet écran ne doit être vu que par ce joueur.',
      ),
      app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
      h(
        'button',
        { class: 'btn btn--primary btn--wide', type: 'button', onclick: startTurn },
        `Je suis ${player.name} — afficher mon tour`,
      ),
      h(
        'button',
        {
          class: 'btn btn--ghost btn--wide',
          type: 'button',
          onclick: () => {
            app.screen = 'notes';
            render();
          },
        },
        'Consulter mes notes',
      ),
      h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: openRules }, 'Règles'),
    ),
    h('p', { class: 'fineprint', text: 'Annonce GOT FIVE ! uniquement pendant ton tour.' }),
  );
}

function renderNotes() {
  const game = app.game;
  if (!game) return renderHome();
  const player = currentPlayer(game);
  return h(
    'main',
    { class: 'screen screen--notes' },
    topBar('Mes notes', () => {
      app.screen = 'pass';
      render();
    }),
    renderSheet(player),
    h(
      'p',
      { class: 'fineprint' },
      'Les autres joueurs détournent le regard. L’annonce GOT FIVE ! se fait uniquement pendant ton tour.',
    ),
  );
}

function renderBotTurn() {
  const game = app.game;
  if (!game) return renderHome();
  if (game.phase === PHASES.GAME_OVER) {
    app.screen = 'gameover';
    return renderGameOver();
  }

  const bot = game.players[app.botPlayerId];
  if (!bot || bot.kind !== 'bot') {
    app.screen = 'pass';
    return renderPass();
  }

  const clueCount = bot.sorting.flat().length + bot.comparisons.flat().length;
  const entries = game.log.slice(-5).reverse();

  return h(
    'main',
    { class: 'screen screen--bot' },
    h(
      'header',
      { class: 'turn-header' },
      h('div', { class: 'turn-header-main' },
        h('div', { class: 'turn-title' },
          h('span', { class: 'eyebrow', text: `Tour ${game.turn}` }),
          h('h1', { class: 'turn-player', text: bot.name }),
        ),
        h('div', { class: 'turn-meta' },
          h('span', { class: 'pill', text: 'IA' }),
          h('span', { class: 'pill', text: `Réserve : ${game.supply.length}` }),
        ),
      ),
      h('p', { class: 'bot-status' }, h('span', { class: 'bot-pulse', 'aria-hidden': 'true' }), app.botMessage ?? 'L’IA réfléchit…'),
      app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
    ),
    h(
      'div',
      { class: 'bot-layout' },
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'section-head' },
          h('h2', { text: 'Support de l’IA' }),
          h('span', { class: 'pill', text: 'Visible par tous' }),
        ),
        h('p', { class: 'muted small', text: 'Son écran de tour ne montre jamais les supports humains.' }),
        h('div', { class: 'tile-row' }, bot.stand.map((n) => tileEl(n, { size: 'md' }))),
      ),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'section-head' },
          h('h2', { text: 'Tuiles visibles' }),
          h('span', { class: 'pill', text: `${game.publicTiles.length} tuile${game.publicTiles.length > 1 ? 's' : ''}` }),
        ),
        h('div', { class: 'tile-row' }, game.publicTiles.map((n) => tileEl(n, { size: 'md' }))),
      ),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'section-head' },
          h('h2', { text: 'Indices posés par l’IA' }),
          h('span', { class: 'pill', text: `${clueCount}` }),
        ),
        clueCount
          ? h('div', {},
              h('p', { class: 'mini-label', text: 'Zone de classement' }),
              renderSortingZone(bot, false, game.clue),
              h('p', { class: 'mini-label', text: 'Comparaisons' }),
              renderComparisonRow(bot, false, game.clue),
            )
          : h('p', { class: 'muted small', text: 'Aucun indice posé.' }),
      ),
      h(
        'section',
        { class: 'card bot-log-card' },
        h('div', { class: 'section-head' }, h('h2', { text: 'Derniers événements' })),
        entries.length
          ? h('ol', { class: 'log-list' },
              entries.map((entry) =>
                h('li', { class: `log-entry log-entry--${entry.type}` },
                  h('span', { class: 'log-turn', text: `Tour ${entry.turn}` }),
                  h('span', { text: entry.text }),
                ),
              ),
            )
          : h('p', { class: 'muted small', text: 'Aucun événement.' }),
      ),
    ),
    h('p', { class: 'fineprint' }, 'Écran public du tour de l’IA. Aucun support humain n’est affiché.'),
  );
}

function getFicheFocus(game, player) {
  const clue = game.clue;
  if (!clue) return null;
  if (clue.type === 'sort') {
    return {
      colorIndex: null,
      label: 'Classé',
      tone: 'sort',
      text: `Le ${clue.tile} se place ${positionLabel(clue.notch)} de ton support.`,
    };
  }
  const target = tile(player.stand[clue.slot]);
  return {
    colorIndex: target.colorIndex,
    label: clue.same ? 'OUI' : 'NON',
    tone: clue.same ? 'yes' : 'no',
    text: clue.same
      ? `Le ${clue.tile} a le même nombre de points que ta ${ordinal(clue.slot + 1)} tuile.`
      : `Le ${clue.tile} n’a pas le même nombre de points que ta ${ordinal(clue.slot + 1)} tuile.`,
  };
}

function renderTurn() {
  const game = app.game;
  if (!game) return renderHome();
  if (game.phase === PHASES.GAME_OVER) {
    app.screen = 'gameover';
    return renderGameOver();
  }
  const player = currentPlayer(game);
  const focus = getFicheFocus(game, player);

  const header = h(
    'header',
    { class: 'turn-header' },
    h('div', { class: 'turn-header-main' },
      h('div', { class: 'turn-title' },
        h('span', { class: 'eyebrow', text: `Tour ${game.turn}` }),
        h('h1', { class: 'turn-player', text: player.name }),
      ),
      h('div', { class: 'turn-meta' },
        h('span', { class: 'pill', text: `Réserve : ${game.supply.length}` }),
        h('button', { class: 'btn btn--claim', type: 'button', onclick: openClaim }, 'GOT FIVE !'),
        h('button', { class: 'btn btn--icon', type: 'button', onclick: openRules, 'aria-label': 'Règles' }, '?'),
      ),
    ),
    app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
  );

  return h(
    'main',
    { class: 'screen screen--turn' },
    header,
    h(
      'div',
      { class: 'turn-layout' },
      h(
        'div',
        { class: 'turn-main' },
        renderPublicTable(player),
        renderActionDock(player),
        renderOwnStand(player),
      ),
      h('aside', { class: 'fiche-sidebar' }, renderSheet(player, { focus })),
    ),
    h(
      'p',
      { class: 'fineprint' },
      'Version non officielle, à usage personnel. Les numéros de ton support restent cachés jusqu’à la fin.',
    ),
  );
}

function renderActionDock(player) {
  const game = app.game;
  const phase = game.phase;
  const selected = app.selectedTile ?? game.chosenTile;
  let prompt = '';
  let content = [];

  if (phase === PHASES.REVEAL) {
    prompt = 'Révéler une tuile';
    if (game.supply.length === 0) {
      content = [
        h('p', { class: 'dock-hint', text: 'La réserve est vide. Passe directement à l’indice.' }),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: doSkipReveal }, 'Continuer sans révéler'),
      ];
    } else {
      const available = canRevealColors(game);
      content = [
        h('p', { class: 'dock-hint', text: 'Choisis une couleur. La tuile piochée sera révélée à tout le monde.' }),
        h(
          'div',
          { class: 'color-grid dock-colors' },
          COLORS.map((color, index) =>
            h(
              'button',
              {
                class: 'color-choice',
                type: 'button',
                disabled: !available[index],
                style: { '--color-bg': color.hex, '--color-ink': color.ink },
                onclick: () => doReveal(index),
              },
              h('span', { class: 'color-symbol', text: color.symbol }),
              h('span', { class: 'color-name', text: color.name }),
              h('span', { class: 'color-hint', text: available[index] ? 'Révéler' : 'Épuisée' }),
            ),
          ),
        ),
      ];
    }
  } else if (phase === PHASES.CHOOSE_TILE) {
    if (selected === null) {
      prompt = 'Choisis une tuile visible';
      content = [
        h('p', { class: 'dock-hint', text: 'Touche une tuile du plateau. Les actions apparaîtront ici.' }),
      ];
    } else {
      prompt = 'Que faire de cette tuile ?';
      content = [
        h(
          'div',
          { class: 'dock-choice-row' },
          tileEl(selected, { size: 'sm' }),
          h(
            'div',
            { class: 'dock-actions' },
            h(
              'button',
              { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('sort') },
              h('strong', { text: 'Classer' }),
              h('span', { text: 'Placer dans ton ordre croissant.' }),
            ),
            h(
              'button',
              { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('compare') },
              h('strong', { text: 'Comparer' }),
              h('span', { text: 'Comparer ses points à une de tes tuiles.' }),
            ),
          ),
          h('button', { class: 'btn btn--ghost dock-change', type: 'button', onclick: clearSelectedTile }, 'Changer'),
        ),
      ];
    }
  } else if (phase === PHASES.CHOOSE_CLUE) {
    prompt = 'Choisis un indice';
    content = [
      h(
        'div',
        { class: 'dock-choice-row' },
        tileEl(game.chosenTile, { size: 'sm' }),
        h(
          'div',
          { class: 'dock-actions' },
          h(
            'button',
            { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('sort') },
            h('strong', { text: 'Classer' }),
            h('span', { text: 'Placer dans ton ordre croissant.' }),
          ),
          h(
            'button',
            { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('compare') },
            h('strong', { text: 'Comparer' }),
            h('span', { text: 'Comparer ses points à une de tes tuiles.' }),
          ),
        ),
        h('button', { class: 'btn btn--ghost dock-change', type: 'button', onclick: doCancelClue }, 'Changer'),
      ),
    ];
  } else if (phase === PHASES.COMPARE_SLOT) {
    prompt = 'Choisis ta tuile à comparer';
    content = [
      h(
        'div',
        { class: 'dock-choice-row' },
        tileEl(game.chosenTile, { size: 'sm' }),
        h('span', { class: 'dock-hint dock-inline-hint', text: 'Touche une tuile de ton support.' }),
        h('button', { class: 'btn btn--ghost dock-change', type: 'button', onclick: doCancelClue }, 'Changer'),
      ),
    ];
  } else if (phase === PHASES.END) {
    prompt = 'Indice obtenu';
    content = [
      h('div', { class: 'clue-result dock-result' }, renderClueResult()),
      h(
        'div',
        { class: 'dock-actions dock-actions--end' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: doEndTurn }, 'Fin du tour'),
      ),
    ];
  }

  return h(
    'section',
    { class: 'action-dock', 'aria-label': 'Actions du tour' },
    h(
      'div',
      { class: 'dock-head' },
      h(
        'div',
        { class: 'dock-title' },
        h('span', { class: 'dock-kicker', text: `À toi de jouer · ${player.name}` }),
        h('strong', { text: prompt }),
      ),
      h('button', { class: 'btn btn--ghost dock-fiche', type: 'button', onclick: openFiche }, 'Ma fiche'),
    ),
    ...content,
  );
}

function renderClueResult() {
  const game = app.game;
  const clue = game.clue;
  if (!clue) return h('p', { class: 'muted', text: 'Aucun indice possible : termine ton tour.' });
  if (clue.type === 'sort') {
    return h(
      'div',
      { class: 'result-line' },
      h('span', { class: 'result-badge', text: 'Classé' }),
      h('p', {}, `Le ${clue.tile} se place `, h('strong', { text: positionLabel(clue.notch) }), ' de ton support.'),
    );
  }
  const player = currentPlayer(game);
  const targetColor = tile(player.stand[clue.slot]).color;
  return h(
    'div',
    { class: 'result-line' },
    h('span', { class: `result-badge ${clue.same ? 'result-badge--yes' : 'result-badge--no'}`, text: clue.same ? 'OUI' : 'NON' }),
    h(
      'p',
      {},
      clue.same
        ? `Le ${clue.tile} a le même nombre de points que ta ${ordinal(clue.slot + 1)} tuile (${targetColor.name}).`
        : `Le ${clue.tile} n’a pas le même nombre de points que ta ${ordinal(clue.slot + 1)} tuile (${targetColor.name}).`,
    ),
  );
}

function renderPublicTable(player) {
  const game = app.game;
  const opponents = game.players.filter((other) => other.id !== player.id);
  return h(
    'section',
    { class: 'card public-table' },
    h('div', { class: 'section-head' },
      h('h2', { text: 'Table publique' }),
      h('span', { class: 'pill', text: 'Visible par tous' }),
    ),
    renderVisibleTiles(),
    h(
      'div',
      { class: 'public-block public-block--opponents' },
      h('div', { class: 'public-block-head' },
        h('h3', { text: 'Adversaires' }),
        h('span', { class: 'pill', text: `${opponents.length}` }),
      ),
      h('p', { class: 'muted small', text: 'Tu vois leurs numéros. Ne les prononce pas à voix haute.' }),
      h(
        'div',
        { class: 'opponent-list' },
        opponents.map((opponent) => renderOpponent(opponent)),
      ),
    ),
    colorLegend(),
  );
}

function renderVisibleTiles() {
  const game = app.game;
  const canPick = game.phase === PHASES.CHOOSE_TILE;
  const selected = app.selectedTile ?? game.chosenTile;
  const tiles = game.publicTiles;
  return h(
    'div',
    { class: 'public-block public-block--visible' },
    h('div', { class: 'public-block-head' },
      h('h3', { text: 'Tuiles visibles' }),
      h('span', { class: 'pill', text: `${tiles.length} tuile${tiles.length > 1 ? 's' : ''}` }),
    ),
    h('p', { class: 'muted small', text: canPick ? 'Touche une tuile pour la sélectionner.' : 'Elles restent visibles jusqu’à la fin de la partie.' }),
    tiles.length
      ? h(
          'div',
          { class: 'tile-row public-row' },
          tiles.map((n) =>
            tileEl(n, {
              size: 'lg',
              onclick: canPick ? () => selectPublicTile(n) : null,
              selected: selected === n,
              highlight: game.lastRevealed === n && game.revealed !== null,
            }),
          ),
        )
      : h('p', { class: 'muted', text: 'Aucune tuile visible.' }),
  );
}

function notchLabel(notch) {
  return ['avant', '1–2', '2–3', '3–4', '4–5', 'après'][notch] ?? String(notch);
}

function renderSortingZone(player, compact = false, current = null) {
  return h(
    'div',
    { class: `sorting-zone${compact ? ' sorting-zone--compact' : ''}` },
    player.sorting.map((group, notch) => {
      const isCurrent = current?.type === 'sort' && current.notch === notch;
      return h(
        'div',
        { class: `notch${isCurrent ? ' is-current' : ''}` },
        h('span', { class: 'notch-label', text: notchLabel(notch) }),
        h(
          'div',
          { class: 'notch-tiles' },
          group.length
            ? group.map((n) =>
                tileEl(n, {
                  size: 'xs',
                  selected: isCurrent && n === current.tile,
                }),
              )
            : h('span', { class: 'empty', text: '·' }),
        ),
      );
    }),
  );
}

function renderComparisonRow(player, compact = false, current = null) {
  return h(
    'div',
    { class: `comparison-row${compact ? ' comparison-row--compact' : ''}` },
    player.comparisons.map((group, slot) => {
      const isCurrent = current?.type === 'compare' && current.slot === slot;
      return h(
        'div',
        { class: `compare-slot${isCurrent ? ' is-current' : ''}` },
        h('span', { class: 'notch-label', text: ordinal(slot + 1) }),
        h(
          'div',
          { class: 'compare-tiles' },
          group.length
            ? group.map((clue) =>
                tileEl(clue.n, {
                  size: 'xs',
                  tilt: !clue.same,
                  badge: clue.same ? '=' : '≠',
                  selected: isCurrent && clue.n === current.tile,
                }),
              )
            : h('span', { class: 'empty', text: '·' }),
        ),
      );
    }),
  );
}

function renderOwnStand(player) {
  const game = app.game;
  const clue = game.clue;
  const compareMode = game.phase === PHASES.COMPARE_SLOT;
  const targetSlot = clue?.type === 'compare' ? clue.slot : null;

  const slots = player.stand.map((n, index) => {
    const color = tile(n).color;
    const body = h(
      'div',
      { class: 'own-slot-body' },
      h('span', { class: 'slot-index', text: ordinal(index + 1) }),
      backTile(color),
      h('span', { class: 'slot-color' }, h('span', { text: color.symbol }), ` ${color.name}`),
    );
    if (compareMode) {
      return h(
        'button',
        {
          class: 'own-slot is-clickable',
          type: 'button',
          'aria-label': `Comparer avec ta ${ordinal(index + 1)} tuile, ${color.name}`,
          onclick: () => doChooseCompareSlot(index),
        },
        body,
      );
    }
    return h(
      'div',
      { class: `own-slot${targetSlot === index ? ' is-target' : ''}` },
      body,
    );
  });

  return h(
    'section',
    { class: `card own-stand-card${compareMode ? ' is-choosing' : ''}` },
    h('div', { class: 'section-head' },
      h('div', { class: 'section-title' }, h('h2', { text: 'Ton support' }), h('span', { class: 'pill', text: compareMode ? 'Choisis une tuile' : 'Numéros cachés' })),
      h('span', { class: 'arrow-note', text: 'ordre croissant →' }),
    ),
    h('p', { class: 'muted small', text: compareMode ? 'Touche la tuile à comparer avec la tuile sélectionnée.' : 'Tu connais les couleurs et les positions, pas les numéros.' }),
    h('div', { class: 'own-stand' }, slots),
    h('div', { class: 'own-section' },
      h('h3', { class: 'subtitle', text: 'Comparaisons' }),
      renderComparisonRow(player, false, clue),
    ),
    h('div', { class: 'own-section' },
      h('h3', { class: 'subtitle', text: 'Zone de classement' }),
      renderSortingZone(player, false, clue),
    ),
  );
}

function renderOpponent(opponent) {
  const clueCount =
    opponent.sorting.flat().length + opponent.comparisons.flat().length;
  return h(
    'article',
    { class: `opponent${opponent.eliminated ? ' is-out' : ''}` },
    h('div', { class: 'opponent-head' },
      h('h4', { text: opponent.name }),
      opponent.eliminated ? h('span', { class: 'badge badge--out', text: 'Éliminé' }) : null,
    ),
    h('div', { class: 'tile-row' }, opponent.stand.map((n) => tileEl(n, { size: 'sm' }))),
    clueCount
      ? h(
          'details',
          { class: 'clue-details' },
          h('summary', { text: `Indices posés (${clueCount})` }),
          h('div', { class: 'clue-details-body' },
            h('p', { class: 'mini-label', text: 'Zone de classement' }),
            renderSortingZone(opponent, true),
            h('p', { class: 'mini-label', text: 'Comparaisons' }),
            renderComparisonRow(opponent, true),
          ),
        )
      : h('p', { class: 'muted small', text: 'Aucun indice posé.' }),
  );
}

function colorLegend() {
  return h(
    'div',
    { class: 'color-legend', 'aria-label': 'Légende des couleurs' },
    COLORS.map((color) =>
      h('span', { class: 'legend-item' },
        h('span', { class: 'legend-swatch', style: { background: color.hex, color: color.ink }, text: color.symbol }),
        color.name,
      ),
    ),
  );
}

function renderSheet(player, options = {}) {
  const { focus = null, embedded = false } = options;
  const game = app.game;
  const visible = visibleNumbersFor(game, player.id);
  const draft = h(
    'div',
    { class: 'draft-row' },
    Array.from({ length: 5 }, (_, index) => {
      const color = tile(player.stand[index]).color;
      return h('input', {
        class: 'draft-input',
        type: 'text',
        inputmode: 'numeric',
        maxlength: '2',
        value: player.draft[index] ?? '',
        style: { '--draft-color': color.hex },
        'aria-label': `Brouillon, ${ordinal(index + 1)} tuile, ${color.name}`,
        title: `${ordinal(index + 1)} tuile : ${color.name}`,
        oninput: (event) => {
          const value = event.target.value.replace(/\D/g, '').slice(0, 2);
          event.target.value = value;
          player.draft[index] = value;
          persist();
        },
      });
    }),
  );

  const rows = COLORS.map((color, colorIndex) => {
    const isFocus = focus?.colorIndex === colorIndex;
    return h(
      'div',
      { class: `sheet-row${isFocus ? ' is-focus' : ''}` },
      h('div', { class: 'sheet-row-label', 'aria-label': color.name, title: color.name },
        h('span', { class: 'row-swatch', style: { background: color.hex, color: color.ink }, text: color.symbol }),
      ),
      h(
        'div',
        { class: 'sheet-cells' },
        tilesForColor(colorIndex).map((t) => {
          const auto = visible.has(t.n);
          const manual = player.manual.includes(t.n);
          const classes = `cell${auto ? ' is-auto' : ''}${manual ? ' is-manual' : ''}`;
          const attrs = {
            class: classes,
            type: 'button',
            'aria-label': `${t.n}, ${color.name}, ${t.dots} point${t.dots > 1 ? 's' : ''}${auto ? ' — visible, barré automatiquement' : ''}`,
            'aria-pressed': auto ? 'true' : String(manual),
            style: { '--cell-bg': color.hex, '--cell-ink': color.ink },
          };
          if (!auto) {
            attrs.onclick = (event) => toggleManual(t.n, event.currentTarget, player);
          } else {
            attrs.disabled = true;
          }
          return h('button', attrs, h('span', { class: 'cell-num', text: String(t.n) }), dotsEl(t.dots));
        }),
      ),
    );
  });

  const context = focus
    ? h(
        'div',
        { class: `fiche-context fiche-context--${focus.tone}` },
        h(
          'span',
          {
            class: `result-badge${focus.tone === 'yes' ? ' result-badge--yes' : focus.tone === 'no' ? ' result-badge--no' : ''}`,
            text: focus.label,
          },
        ),
        h('span', { text: focus.text }),
      )
    : null;

  return h(
    'section',
    { class: `card sheet-card${embedded ? ' sheet-card--embedded' : ''}` },
    embedded
      ? null
      : h('div', { class: 'section-head' },
          h('h2', { text: 'Ma fiche de déduction' }),
          h('span', { class: 'pill', text: player.name }),
        ),
    h('p', { class: 'muted small' },
      'Les numéros visibles sur la table sont barrés automatiquement. Barre les autres au fur et à mesure de tes déductions.',
    ),
    context,
    h('div', { class: 'draft-block' },
      h('h3', { class: 'subtitle', text: 'Mes 5 numéros (brouillon)' }),
      draft,
      h('p', { class: 'muted small', text: 'Les contours reprennent les couleurs de ton support, dans l’ordre croissant. Une seule annonce, et seulement pendant ton tour.' }),
    ),
    h('div', { class: 'sheet-grid' }, rows),
    h('div', { class: 'sheet-actions' },
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        onclick: () => {
          player.manual = [];
          persist();
          render();
        },
      }, 'Effacer mes croix manuelles'),
      h('span', { class: 'muted small', text: 'Les croix automatiques ne s’effacent pas.' }),
    ),
    renderJournalDetails(),
  );
}

function toggleManual(n, cell, player) {
  const set = new Set(player.manual);
  if (set.has(n)) set.delete(n);
  else set.add(n);
  player.manual = [...set].sort((a, b) => a - b);
  cell.classList.toggle('is-manual', set.has(n));
  cell.setAttribute('aria-pressed', String(set.has(n)));
  persist();
}

function renderJournalDetails() {
  const game = app.game;
  const entries = game.log.slice().reverse();
  return h(
    'details',
    { class: 'journal-details' },
    h('summary', { text: `Journal de la partie (${entries.length})` }),
    h('p', { class: 'muted small', text: 'Journal public. Il ne contient aucun numéro caché.' }),
    entries.length
      ? h(
          'ol',
          { class: 'log-list' },
          entries.map((entry) =>
            h(
              'li',
              { class: `log-entry log-entry--${entry.type}` },
              h('span', { class: 'log-turn', text: `Tour ${entry.turn}` }),
              h('span', { text: entry.text }),
            ),
          ),
        )
      : h('p', { class: 'muted', text: 'Aucun événement.' }),
  );
}

function gameOverSummary(game) {
  const winner = game.winner === null ? null : game.players[game.winner];
  const title = winner ? `${winner.name} gagne !` : 'Aucun vainqueur';
  let subtitle = '';
  if (winner && game.winReason === 'claim') subtitle = 'Annonce GOT FIVE ! réussie.';
  else if (winner && game.winReason === 'lastActive') subtitle = 'Dernier joueur en lice.';
  else if (!winner) subtitle = 'Tous les joueurs se sont trompés.';
  return { winner, title, subtitle };
}

function renderGameOver() {
  const game = app.game;
  if (!game) return renderHome();
  const { winner, title, subtitle } = gameOverSummary(game);

  const actions = [
    h('button', { class: 'btn btn--primary btn--wide', type: 'button', onclick: openReview }, 'Voir la table finale'),
    h('button', { class: 'btn btn--secondary btn--wide', type: 'button', onclick: replay }, 'Rejouer avec les mêmes joueurs'),
    h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: requestNewGame }, 'Nouvelle partie'),
    h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: goHome }, 'Accueil'),
  ];

  return h(
    'main',
    { class: 'screen screen--over' },
    h(
      'div',
      { class: 'card over-card' },
      h('p', { class: 'eyebrow', text: 'Partie terminée' }),
      h('h1', { class: 'over-title', text: title }),
      subtitle ? h('p', { class: 'muted', text: subtitle }) : null,
      winner
        ? h('div', { class: 'winner-stand' },
            h('p', { class: 'mini-label', text: 'Ses 5 numéros, dans l’ordre croissant' }),
            h('div', { class: 'tile-row' }, winner.stand.map((n) => tileEl(n, { size: 'lg' }))),
          )
        : null,
      h('div', { class: 'over-actions' }, actions),
    ),
  );
}

function openReview() {
  if (!app.game || app.game.phase !== PHASES.GAME_OVER) return;
  clearBotTimer();
  app.screen = 'review';
  app.privacy = false;
  app.claimOpen = false;
  app.ficheOpen = false;
  render();
}

function renderReviewPlayer(game, player) {
  const claim = game.claims.find((entry) => entry.playerId === player.id);
  const clueCount = player.sorting.flat().length + player.comparisons.flat().length;
  const isWinner = game.winner === player.id;

  return h(
    'article',
    { class: `card review-player${isWinner ? ' is-winner' : ''}` },
    h('div', { class: 'review-player-head' },
      h('h3', { text: player.name }),
      h('div', { class: 'badges' },
        isWinner ? h('span', { class: 'badge badge--win', text: 'Gagnant' }) : null,
        player.eliminated ? h('span', { class: 'badge badge--out', text: 'Éliminé' }) : null,
        player.kind === 'bot' ? h('span', { class: 'badge badge--bot', text: 'IA' }) : null,
      ),
    ),
    h('p', { class: 'mini-label', text: 'Support réel' }),
    h('div', { class: 'tile-row' }, player.stand.map((n) => tileEl(n, { size: 'md' }))),
    h(
      'p',
      { class: `review-claim${claim ? (claim.correct ? ' review-claim--yes' : ' review-claim--no') : ''}` },
      claim
        ? h('span', { class: `result-badge ${claim.correct ? 'result-badge--yes' : 'result-badge--no'}`, text: claim.correct ? 'Correcte' : 'Incorrecte' })
        : h('span', { class: 'result-badge', text: 'Aucune annonce' }),
      claim ? `Annonce : ${claim.numbers.join(' · ')}` : null,
    ),
    clueCount
      ? h('div', { class: 'review-clues' },
          h('p', { class: 'mini-label', text: 'Indices posés' }),
          renderSortingZone(player),
          renderComparisonRow(player),
        )
      : h('p', { class: 'muted small', text: 'Aucun indice posé.' }),
  );
}

function renderReview() {
  const game = app.game;
  if (!game) return renderHome();
  const { winner, title, subtitle } = gameOverSummary(game);

  return h(
    'main',
    { class: 'screen screen--review' },
    topBar('Table finale', () => {
      app.screen = 'gameover';
      render();
    }),
    h(
      'section',
      { class: 'card review-summary' },
      h('p', { class: 'eyebrow', text: 'Partie terminée' }),
      h('h1', { class: 'over-title', text: title }),
      subtitle ? h('p', { class: 'muted', text: subtitle }) : null,
      h('p', { class: 'muted small' }, 'Tous les supports sont révélés. Comparez les annonces avec les numéros réels et le journal des actions.'),
    ),
    h(
      'section',
      { class: 'review-section' },
      h('div', { class: 'section-head' }, h('h2', { text: 'Supports finaux' })),
      h('div', { class: 'review-players' }, game.players.map((player) => renderReviewPlayer(game, player))),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'section-head' },
        h('h2', { text: 'Table publique finale' }),
        h('span', { class: 'pill', text: `Réserve : ${game.supply.length}` }),
      ),
      game.publicTiles.length
        ? h('div', { class: 'tile-row' }, game.publicTiles.map((n) => tileEl(n, { size: 'md' })))
        : h('p', { class: 'muted small', text: 'Aucune tuile visible.' }),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'section-head' },
        h('h2', { text: 'Journal des actions' }),
        h('span', { class: 'pill', text: `${game.log.length} événement${game.log.length > 1 ? 's' : ''}` }),
      ),
      h(
        'ol',
        { class: 'log-list review-log' },
        game.log.map((entry) =>
          h('li', { class: `log-entry log-entry--${entry.type}` },
            h('span', { class: 'log-turn', text: `Tour ${entry.turn}` }),
            h('span', { text: entry.text }),
          ),
        ),
      ),
    ),
    h('p', { class: 'fineprint' }, 'Table finale et journal publics. La partie est terminée.'),
  );
}

function replay() {
  if (!app.game) return;
  clearBotTimer();
  const names = app.game.players.map((player) => player.name);
  const kinds = app.game.players.map((player) => player.kind ?? 'human');
  const startingPlayer = app.game.startingPlayer ?? 0;
  const game = createGame({ names, kinds, seed: randomSeed(), startingPlayer });
  app.game = game;
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;
  app.notice = null;
  app.botPlayerId = null;
  app.botMessage = null;
  persist();
  enterCurrentTurn();
}

function renderRules() {
  return h(
    'main',
    { class: 'screen screen--rules' },
    topBar('Règles', closeRules),
    h(
      'article',
      { class: 'card rules-card' },
      h('h2', { text: 'Le but' }),
      h('p', {}, 'Être le premier à retrouver les 5 numéros cachés sur son support, en s’aidant des indices révélés pendant la partie.'),
      h('h2', { text: 'Le principe' }),
      h('p', {}, 'Tu vois les numéros de tous les autres joueurs, mais jamais les tiens. Chaque joueur a 5 tuiles, une de chaque couleur, rangées dans l’ordre croissant. Tu connais leurs couleurs et leurs positions, pas leurs numéros.'),
      h('h2', { text: 'Un tour, deux actions' }),
      h('ol', {},
        h('li', {}, h('strong', { text: 'Révéler' }), ' une tuile de la couleur de ton choix. Son numéro est annoncé et elle reste visible.'),
        h('li', {}, h('strong', { text: 'Demander un indice' }), ' sur l’une des tuiles visibles : ',
          h('strong', { text: 'classer' }), ' (l’app la place dans ton ordre croissant) ou ',
          h('strong', { text: 'comparer' }), ' (l’app répond Oui ou Non sur l’égalité des points avec l’une de tes tuiles).'),
      ),
      h('h2', { text: 'La fiche' }),
      h('p', {}, 'La fiche liste les 60 tuiles par couleur, numéro et points. Les numéros visibles sur la table sont barrés automatiquement ; tu peux barrer les autres à la main. En cas d’erreur, efface tes croix manuelles et recommence.'),
      h('h2', { text: 'Annonce et fin' }),
      h('p', {}, 'Pendant ton tour, tu peux annoncer « GOT FIVE ! » une seule fois : donne tes 5 numéros dans l’ordre croissant. Si tout est juste, tu gagnes. Si tu te trompes, tu es éliminé et la partie continue. Si tous les autres se trompent, le dernier joueur en lice gagne automatiquement.'),
      h('p', { class: 'phase-note' }, 'Adaptation locale : l’annonce se fait uniquement pendant ton tour, l’application répond aux indices à la place du voisin, et les joueurs se passent l’appareil.'),
      h('h2', { text: 'Mode solo contre l’IA' }),
      h('p', {}, 'L’IA joue automatiquement. Elle ne voit pas ses propres numéros : elle déduit à partir des informations publiques et de ses propres indices. Son écran de tour ne montre aucun support humain. L’annonce reste limitée à son tour.'),
      h('h2', { text: 'Confidentialité' }),
      h('p', {}, 'Sur un seul appareil, chaque joueur ne regarde l’écran que pendant son tour. Les autres détournent le regard. Ne prononce jamais les numéros des tuiles de tes adversaires : ils pourraient entendre les leurs.'),
      h('p', { class: 'fineprint' }, 'Version non officielle, à usage personnel. Règles inspirées du jeu Got Five ! de Blue Orange.'),
    ),
  );
}

function buildClaimDialog() {
  const game = app.game;
  const player = currentPlayer(game);
  const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const inputs = Array.from({ length: 5 }, (_, index) =>
    h('input', {
      class: 'claim-input',
      type: 'text',
      inputmode: 'numeric',
      maxlength: '2',
      value: player.draft[index] ?? '',
      'aria-label': `Numéro ${index + 1}`,
      required: true,
      oninput: (event) => {
        const value = event.target.value.replace(/\D/g, '').slice(0, 2);
        event.target.value = value;
        player.draft[index] = value;
        persist();
      },
    }),
  );

  const dialog = h(
    'dialog',
    { class: 'modal', 'aria-labelledby': 'claim-title' },
    h(
      'form',
      {
        class: 'claim-form',
        onsubmit: (event) => {
          event.preventDefault();
          const numbers = inputs.map((input) => Number(input.value.trim()));
          if (!isValidClaimNumbers(numbers)) {
            error.hidden = false;
            error.textContent = 'Il faut 5 numéros distincts, dans l’ordre croissant, entre 1 et 60.';
            return;
          }
          player.draft = numbers.map(String);
          try {
            const next = claim(game, numbers);
            app.game = next;
            app.claimOpen = false;
            persist();
            if (next.phase === PHASES.GAME_OVER) {
              app.screen = 'gameover';
              app.privacy = false;
              app.notice = null;
              app.botPlayerId = null;
              render();
            } else {
              app.selectedTile = null;
              app.ficheOpen = false;
              app.notice = `${player.name} a annoncé GOT FIVE ! mais s’est trompé(e) : éliminé(e).`;
              enterCurrentTurn();
            }
          } catch (err) {
            error.hidden = false;
            error.textContent = err.message;
          }
        },
      },
      h('h2', { id: 'claim-title', text: 'GOT FIVE !' }),
      h('p', { class: 'muted', text: 'Annonce tes 5 numéros dans l’ordre croissant. Une seule tentative.' }),
      h('button', { class: 'btn btn--ghost claim-fiche', type: 'button', onclick: openFiche }, 'Voir ma fiche'),
      h('div', { class: 'claim-inputs' }, inputs),
      error,
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: closeClaim }, 'Annuler'),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Annoncer'),
      ),
    ),
  );

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeClaim();
  });

  return dialog;
}

function buildFicheDialog() {
  const game = app.game;
  const player = currentPlayer(game);
  const focus = getFicheFocus(game, player);
  const dialog = h(
    'dialog',
    { class: 'fiche-modal', 'aria-labelledby': 'fiche-title' },
    h(
      'div',
      { class: 'fiche-modal-inner' },
      h(
        'div',
        { class: 'fiche-modal-head' },
        h('h2', { id: 'fiche-title', text: 'Ma fiche' }),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: closeFiche }, 'Fermer'),
      ),
      renderSheet(player, { focus, embedded: true }),
    ),
  );
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeFiche();
  });
  return dialog;
}

function render() {
  if (app.screen === 'turn' && app.privacy) app.screen = 'pass';
  if (app.screen === 'pass' && app.game?.phase === PHASES.GAME_OVER) app.screen = 'gameover';
  if (app.screen === 'turn' && app.game?.phase === PHASES.GAME_OVER) app.screen = 'gameover';
  if (app.screen === 'bot' && app.game?.phase === PHASES.GAME_OVER) app.screen = 'gameover';
  if (!app.game && !['home', 'setup', 'rules'].includes(app.screen)) app.screen = 'home';

  root.replaceChildren();

  let view;
  if (app.screen === 'home') view = renderHome();
  else if (app.screen === 'setup') view = renderSetup();
  else if (app.screen === 'pass') view = renderPass();
  else if (app.screen === 'notes') view = renderNotes();
  else if (app.screen === 'turn') view = renderTurn();
  else if (app.screen === 'bot') view = renderBotTurn();
  else if (app.screen === 'gameover') view = renderGameOver();
  else if (app.screen === 'review') view = renderReview();
  else if (app.screen === 'rules') view = renderRules();
  else view = renderHome();

  root.append(view);
  document.title = TITLES[app.screen] ?? TITLES.home;

  if (app.claimOpen && app.screen === 'turn') {
    const dialog = buildClaimDialog();
    root.append(dialog);
    dialog.showModal();
    dialog.querySelector('input')?.focus();
  }
  if (app.ficheOpen && app.screen === 'turn') {
    const dialog = buildFicheDialog();
    root.append(dialog);
    dialog.showModal();
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('Service worker non enregistré :', error);
      });
    });
  }
}

app.saved = readSaveMeta();
registerServiceWorker();
render();
