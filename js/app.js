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
  reveal,
  skipReveal,
  visibleNumbersFor,
} from './engine.js';
import { buildBotView, chooseBotAction } from './bot.js';
import {
  colorName,
  formatLog,
  getLanguage,
  initLanguage,
  ordinal,
  positionLabel,
  setLanguage,
  t,
} from './i18n.js';
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
  const data = tile(n);
  const classes = ['tile', `tile--${data.color.id}`, `tile--${size}`];
  if (selected) classes.push('is-selected');
  if (highlight) classes.push('is-highlight');
  if (tilt) classes.push('is-tilted');

  const content = [
    h('span', { class: 'tile-glyph', 'aria-hidden': 'true', text: data.color.symbol }),
    h('span', { class: 'tile-num', text: String(data.n) }),
    dotsEl(data.dots),
  ];
  if (badge) content.push(h('span', { class: 'tile-badge', text: badge }));

  const attrs = {
    class: classes.join(' '),
    style: { '--tile-bg': data.color.hex, '--tile-ink': data.color.ink },
    'aria-label': t('common.tileAria', {
      n: data.n,
      color: colorName(data.color),
      dots: data.dots,
      s: data.dots > 1 ? 's' : '',
    }),
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

function renderLangSwitcher() {
  const language = getLanguage();
  const option = (code) =>
    h(
      'button',
      {
        class: `lang-btn${language === code ? ' is-active' : ''}`,
        type: 'button',
        'aria-pressed': String(language === code),
        'aria-label': `${t('common.language')} : ${t(`language.${code}`)}`,
        title: t(`language.${code}`),
        onclick: () => {
          if (getLanguage() === code) return;
          setLanguage(code);
          render();
        },
      },
      h('img', {
        class: 'flag-icon',
        src: `./icons/flag-${code}.svg`,
        alt: '',
        'aria-hidden': 'true',
      }),
      h('span', { class: 'lang-code', text: code.toUpperCase() }),
    );
  return h(
    'div',
    { class: 'lang-switch', role: 'group', 'aria-label': t('common.language') },
    option('fr'),
    option('en'),
  );
}

function topBar(title, onBack, extra = null) {
  return h(
    'header',
    { class: 'topbar' },
    h('button', { class: 'btn btn--icon', type: 'button', onclick: onBack, 'aria-label': t('common.back') }, '←'),
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
  if (action.type === 'reveal') return t('bot.reveal');
  if (action.type === 'skipReveal') return t('bot.skip');
  if (action.type === 'chooseTile') return t('bot.chooseTile', { tile: action.tile });
  if (action.type === 'chooseClue') {
    return action.clue === 'sort' ? t('bot.sort') : t('bot.compare');
  }
  if (action.type === 'compareSlot') return t('bot.comparePoints');
  if (action.type === 'endTurn') return t('bot.end');
  if (action.type === 'claim') return t('bot.claim');
  return t('bot.thinking');
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
    app.botMessage = t('bot.error', { message: error.message });
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
    app.botMessage = t('bot.error', { message: error.message });
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
    app.botMessage = t('bot.thinking');
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
    app.notice = t('home.corrupted');
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
    ? [
        app.setup.names[0]?.trim() || t('setup.player', { n: 1 }),
        t('setup.botName'),
      ]
    : app.setup.names
        .slice(0, count)
        .map((name, index) => name?.trim() || t('setup.player', { n: index + 1 }));
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
    h('div', { class: 'home-top' }, renderLangSwitcher()),
    h(
      'div',
      { class: 'home-hero' },
      h('p', { class: 'eyebrow', text: t('home.eyebrow') }),
      h('h1', { class: 'wordmark' }, 'GOT ', h('span', { class: 'wordmark-accent' }, 'FIVE'), ' !'),
      h('p', { class: 'tagline', text: t('home.tagline') }),
    ),
    h(
      'div',
      { class: 'home-actions' },
      h('button', { class: 'btn btn--primary btn--wide', type: 'button', onclick: requestNewGame }, t('home.newGame')),
      app.saved
        ? h(
            'button',
            { class: 'btn btn--secondary btn--wide', type: 'button', onclick: continueGame },
            app.saved.phase === PHASES.GAME_OVER ? t('home.lastGame') : t('home.continue'),
          )
        : null,
      h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: openRules }, t('home.rules')),
    ),
    app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
    h('p', { class: 'fineprint' }, t('home.fineprint')),
  );
}

function renderSetup() {
  const solo = app.setup.mode === 'solo';
  const modeButtons = [
    ['local', t('setup.modeLocal')],
    ['solo', t('setup.modeSolo')],
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
          h('span', { class: 'field-label', text: t('setup.you') }),
          h('input', {
            class: 'text-input',
            type: 'text',
            maxlength: '20',
            autocomplete: 'off',
            placeholder: t('setup.yourName'),
            value: app.setup.names[0] ?? '',
            oninput: (event) => {
              app.setup.names[0] = event.target.value;
              const option = document.querySelector('#start-player option[value="0"]');
              if (option) {
                option.textContent = event.target.value.trim() || t('setup.you');
              }
            },
          }),
        ),
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'field-label', text: t('setup.opponent') }),
          h(
            'div',
            { class: 'bot-player-row' },
            h('strong', { text: t('setup.botName') }),
            h('span', { class: 'muted small', text: t('setup.botHint') }),
          ),
        ),
      ]
    : Array.from({ length: app.setup.count }, (_, index) =>
        h(
          'label',
          { class: 'field' },
          h('span', { class: 'field-label', text: t('setup.player', { n: index + 1 }) }),
          h('input', {
            class: 'text-input',
            type: 'text',
            maxlength: '20',
            autocomplete: 'off',
            placeholder: t('setup.player', { n: index + 1 }),
            value: app.setup.names[index] ?? '',
            oninput: (event) => {
              app.setup.names[index] = event.target.value;
              const option = document.querySelector(`#start-player option[value="${index}"]`);
              if (option) {
                option.textContent = event.target.value.trim() || t('setup.player', { n: index + 1 });
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
          ? app.setup.names[0]?.trim() || t('setup.you')
          : t('setup.botName')
        : app.setup.names[index]?.trim() || t('setup.player', { n: index + 1 }),
    ),
  );

  return h(
    'main',
    { class: 'screen screen--setup' },
    topBar(t('setup.title'), goHome, renderLangSwitcher()),
    h(
      'section',
      { class: 'card setup-card' },
      h('h2', { text: t('setup.who') }),
      h('p', { class: 'muted', text: solo ? t('setup.soloIntro') : t('setup.localIntro') }),
      h('div', { class: 'segments', role: 'group', 'aria-label': t('setup.modeLabel') }, modeButtons),
      solo
        ? h('p', { class: 'phase-note', text: t('setup.soloNote') })
        : h('div', { class: 'segments', role: 'group', 'aria-label': t('setup.countLabel') }, countButtons),
      h('div', { class: 'player-fields' }, nameFields),
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field-label', text: solo ? t('setup.firstSolo') : t('setup.firstLocal') }),
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
      h('button', { class: 'btn btn--primary btn--wide', type: 'button', onclick: startGame }, t('setup.start')),
      h(
        'p',
        { class: 'fineprint' },
        solo ? t('setup.noteSolo') : t('setup.noteLocal'),
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
      h('div', { class: 'pass-top' }, renderLangSwitcher()),
      h('p', { class: 'eyebrow', text: t('pass.turn', { n: game.turn }) }),
      h('h1', { class: 'pass-title', text: t('pass.title') }),
      h('div', { class: 'pass-name', text: player.name }),
      h('p', { class: 'pass-warning' }, t('pass.warning')),
      app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
      h(
        'button',
        { class: 'btn btn--primary btn--wide', type: 'button', onclick: startTurn },
        t('pass.start', { name: player.name }),
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
        t('pass.notes'),
      ),
      h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: openRules }, t('pass.rules')),
    ),
    h('p', { class: 'fineprint', text: t('pass.fineprint') }),
  );
}

function renderNotes() {
  const game = app.game;
  if (!game) return renderHome();
  const player = currentPlayer(game);
  return h(
    'main',
    { class: 'screen screen--notes' },
    topBar(t('notes.title'), () => {
      app.screen = 'pass';
      render();
    }, renderLangSwitcher()),
    renderSheet(player),
    h('p', { class: 'fineprint' }, t('notes.fineprint')),
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
          h('span', { class: 'eyebrow', text: t('turn.turn', { n: game.turn }) }),
          h('h1', { class: 'turn-player', text: bot.name }),
        ),
        h('div', { class: 'turn-meta' },
          h('span', { class: 'pill', text: t('bot.badge') }),
          h('span', { class: 'pill', text: t('turn.reserve', { n: game.supply.length }) }),
          renderLangSwitcher(),
        ),
      ),
      h('p', { class: 'bot-status' }, h('span', { class: 'bot-pulse', 'aria-hidden': 'true' }), app.botMessage ?? t('bot.thinking')),
      app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
    ),
    h(
      'div',
      { class: 'bot-layout' },
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'section-head' },
          h('h2', { text: t('bot.support') }),
          h('span', { class: 'pill', text: t('bot.visible') }),
        ),
        h('p', { class: 'muted small', text: t('bot.note') }),
        h('div', { class: 'tile-row' }, bot.stand.map((n) => tileEl(n, { size: 'md' }))),
      ),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'section-head' },
          h('h2', { text: t('bot.visibleTiles') }),
          h('span', { class: 'pill', text: t('table.count', { count: game.publicTiles.length, s: game.publicTiles.length > 1 ? 's' : '' }) }),
        ),
        h('div', { class: 'tile-row' }, game.publicTiles.map((n) => tileEl(n, { size: 'md' }))),
      ),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'section-head' },
          h('h2', { text: t('bot.clues') }),
          h('span', { class: 'pill', text: `${clueCount}` }),
        ),
        clueCount
          ? h('div', {},
              h('p', { class: 'mini-label', text: t('table.sorting') }),
              renderSortingZone(bot, false, game.clue),
              h('p', { class: 'mini-label', text: t('table.comparisons') }),
              renderComparisonRow(bot, false, game.clue),
            )
          : h('p', { class: 'muted small', text: t('bot.noClues') }),
      ),
      h(
        'section',
        { class: 'card bot-log-card' },
        h('div', { class: 'section-head' }, h('h2', { text: t('bot.recent') })),
        entries.length
          ? h('ol', { class: 'log-list' },
              entries.map((entry) =>
                h('li', { class: `log-entry log-entry--${entry.type}` },
                  h('span', { class: 'log-turn', text: t('turn.turn', { n: entry.turn }) }),
                  h('span', { text: formatLog(entry) }),
                ),
              ),
            )
          : h('p', { class: 'muted small', text: t('bot.noEvents') }),
      ),
    ),
    h('p', { class: 'fineprint' }, t('bot.fineprint')),
  );
}

function getFicheFocus(game, player) {
  const clue = game.clue;
  if (!clue) return null;
  if (clue.type === 'sort') {
    return {
      colorIndex: null,
      label: t('sheet.focusSorted'),
      tone: 'sort',
      text: t('clue.sortedText', {
        tile: clue.tile,
        position: positionLabel(clue.notch),
      }),
    };
  }
  const target = tile(player.stand[clue.slot]);
  return {
    colorIndex: target.colorIndex,
    label: clue.same ? t('common.yes') : t('common.no'),
    tone: clue.same ? 'yes' : 'no',
    text: t(clue.same ? 'sheet.focusSame' : 'sheet.focusDifferent', {
      tile: clue.tile,
      ordinal: ordinal(clue.slot + 1),
    }),
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
        h('span', { class: 'eyebrow', text: t('turn.turn', { n: game.turn }) }),
        h('h1', { class: 'turn-player', text: player.name }),
      ),
      h('div', { class: 'turn-meta' },
        h('span', { class: 'pill', text: t('turn.reserve', { n: game.supply.length }) }),
        h('button', { class: 'btn btn--claim', type: 'button', onclick: openClaim }, t('common.gotFive')),
        renderLangSwitcher(),
        h('button', { class: 'btn btn--icon', type: 'button', onclick: openRules, 'aria-label': t('turn.rules') }, '?'),
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
    h('p', { class: 'fineprint' }, t('turn.fineprint')),
  );
}

function renderActionDock(player) {
  const game = app.game;
  const phase = game.phase;
  const selected = app.selectedTile ?? game.chosenTile;
  let prompt = '';
  let content = [];

  if (phase === PHASES.REVEAL) {
    prompt = t('dock.reveal');
    if (game.supply.length === 0) {
      content = [
        h('p', { class: 'dock-hint', text: t('dock.emptySupply') }),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: doSkipReveal }, t('dock.skip')),
      ];
    } else {
      const available = canRevealColors(game);
      content = [
        h('p', { class: 'dock-hint', text: t('dock.revealHint') }),
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
              h('span', { class: 'color-name', text: colorName(color) }),
              h('span', { class: 'color-hint', text: available[index] ? t('common.reveal') : t('common.exhausted') }),
            ),
          ),
        ),
      ];
    }
  } else if (phase === PHASES.CHOOSE_TILE) {
    if (selected === null) {
      prompt = t('dock.chooseTile');
      content = [
        h('p', { class: 'dock-hint', text: t('dock.chooseTileHint') }),
      ];
    } else {
      prompt = t('dock.what');
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
              h('strong', { text: t('dock.sort') }),
              h('span', { text: t('dock.sortHint') }),
            ),
            h(
              'button',
              { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('compare') },
              h('strong', { text: t('dock.compare') }),
              h('span', { text: t('dock.compareHint') }),
            ),
          ),
          h('button', { class: 'btn btn--ghost dock-change', type: 'button', onclick: clearSelectedTile }, t('dock.change')),
        ),
      ];
    }
  } else if (phase === PHASES.CHOOSE_CLUE) {
    prompt = t('dock.chooseClue');
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
            h('strong', { text: t('dock.sort') }),
            h('span', { text: t('dock.sortHint') }),
          ),
          h(
            'button',
            { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('compare') },
            h('strong', { text: t('dock.compare') }),
            h('span', { text: t('dock.compareHint') }),
          ),
        ),
        h('button', { class: 'btn btn--ghost dock-change', type: 'button', onclick: doCancelClue }, t('dock.change')),
      ),
    ];
  } else if (phase === PHASES.COMPARE_SLOT) {
    prompt = t('dock.chooseCompare');
    content = [
      h(
        'div',
        { class: 'dock-choice-row' },
        tileEl(game.chosenTile, { size: 'sm' }),
        h('span', { class: 'dock-hint dock-inline-hint', text: t('dock.compareTouch') }),
        h('button', { class: 'btn btn--ghost dock-change', type: 'button', onclick: doCancelClue }, t('dock.change')),
      ),
    ];
  } else if (phase === PHASES.END) {
    prompt = t('dock.result');
    content = [
      h('div', { class: 'clue-result dock-result' }, renderClueResult()),
      h(
        'div',
        { class: 'dock-actions dock-actions--end' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: doEndTurn }, t('dock.finish')),
      ),
    ];
  }

  return h(
    'section',
    { class: 'action-dock', 'aria-label': t('dock.aria') },
    h(
      'div',
      { class: 'dock-head' },
      h(
        'div',
        { class: 'dock-title' },
        h('span', { class: 'dock-kicker', text: t('dock.kicker', { name: player.name }) }),
        h('strong', { text: prompt }),
      ),
      h('button', { class: 'btn btn--ghost dock-fiche', type: 'button', onclick: openFiche }, t('dock.fiche')),
    ),
    ...content,
  );
}

function renderClueResult() {
  const game = app.game;
  const clue = game.clue;
  if (!clue) return h('p', { class: 'muted', text: t('dock.noClue') });
  if (clue.type === 'sort') {
    return h(
      'div',
      { class: 'result-line' },
      h('span', { class: 'result-badge', text: t('clue.sorted') }),
      h('p', {}, t('clue.sortedText', { tile: clue.tile, position: positionLabel(clue.notch) })),
    );
  }
  const player = currentPlayer(game);
  const targetColor = tile(player.stand[clue.slot]).color;
  return h(
    'div',
    { class: 'result-line' },
    h('span', { class: `result-badge ${clue.same ? 'result-badge--yes' : 'result-badge--no'}`, text: clue.same ? t('common.yes') : t('common.no') }),
    h(
      'p',
      {},
      t(clue.same ? 'clue.same' : 'clue.different', {
        tile: clue.tile,
        ordinal: ordinal(clue.slot + 1),
        color: colorName(targetColor),
      }),
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
      h('h2', { text: t('table.title') }),
      h('span', { class: 'pill', text: t('table.visible') }),
    ),
    renderVisibleTiles(),
    h(
      'div',
      { class: 'public-block public-block--opponents' },
      h('div', { class: 'public-block-head' },
        h('h3', { text: t('table.opponents') }),
        h('span', { class: 'pill', text: `${opponents.length}` }),
      ),
      h('p', { class: 'muted small', text: t('table.opponentsNote') }),
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
      h('h3', { text: t('table.visibleTiles') }),
      h('span', { class: 'pill', text: t('table.count', { count: tiles.length, s: tiles.length > 1 ? 's' : '' }) }),
    ),
    h('p', { class: 'muted small', text: canPick ? t('table.selectHint') : t('table.remainHint') }),
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
      : h('p', { class: 'muted', text: t('table.noTiles') }),
  );
}

function notchLabel(notch) {
  if (notch === 0) return t('table.before');
  if (notch === 5) return t('table.after');
  return ['1–2', '2–3', '3–4', '4–5'][notch - 1] ?? String(notch);
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
      h('span', { class: 'slot-color' }, h('span', { text: color.symbol }), ` ${colorName(color)}`),
    );
    if (compareMode) {
      return h(
        'button',
        {
          class: 'own-slot is-clickable',
          type: 'button',
          'aria-label': t('stand.compareAria', {
            ordinal: ordinal(index + 1),
            color: colorName(color),
          }),
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
      h('div', { class: 'section-title' }, h('h2', { text: t('stand.title') }), h('span', { class: 'pill', text: compareMode ? t('stand.choose') : t('stand.hidden') })),
      h('span', { class: 'arrow-note', text: t('stand.order') }),
    ),
    h('p', { class: 'muted small', text: compareMode ? t('stand.compareHint') : t('stand.hint') }),
    h('div', { class: 'own-stand' }, slots),
    h('div', { class: 'own-section' },
      h('h3', { class: 'subtitle', text: t('stand.comparisons') }),
      renderComparisonRow(player, false, clue),
    ),
    h('div', { class: 'own-section' },
      h('h3', { class: 'subtitle', text: t('stand.sorting') }),
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
      opponent.eliminated ? h('span', { class: 'badge badge--out', text: t('common.eliminated') }) : null,
    ),
    h('div', { class: 'tile-row' }, opponent.stand.map((n) => tileEl(n, { size: 'sm' }))),
    clueCount
      ? h(
          'details',
          { class: 'clue-details' },
          h('summary', { text: t('table.clues', { count: clueCount }) }),
          h('div', { class: 'clue-details-body' },
            h('p', { class: 'mini-label', text: t('table.sorting') }),
            renderSortingZone(opponent, true),
            h('p', { class: 'mini-label', text: t('table.comparisons') }),
            renderComparisonRow(opponent, true),
          ),
        )
      : h('p', { class: 'muted small', text: t('table.noClues') }),
  );
}

function colorLegend() {
  return h(
    'div',
    { class: 'color-legend', 'aria-label': t('table.legend') },
    COLORS.map((color) =>
      h('span', { class: 'legend-item' },
        h('span', { class: 'legend-swatch', style: { background: color.hex, color: color.ink }, text: color.symbol }),
        colorName(color),
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
        'aria-label': t('sheet.draftAria', {
          ordinal: ordinal(index + 1),
          color: colorName(color),
        }),
        title: t('sheet.draftTitle', {
          ordinal: ordinal(index + 1),
          color: colorName(color),
        }),
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
      h('div', { class: 'sheet-row-label', 'aria-label': colorName(color), title: colorName(color) },
        h('span', { class: 'row-swatch', style: { background: color.hex, color: color.ink }, text: color.symbol }),
      ),
      h(
        'div',
        { class: 'sheet-cells' },
        tilesForColor(colorIndex).map((cellTile) => {
          const auto = visible.has(cellTile.n);
          const manual = player.manual.includes(cellTile.n);
          const classes = `cell${auto ? ' is-auto' : ''}${manual ? ' is-manual' : ''}`;
          const attrs = {
            class: classes,
            type: 'button',
            'aria-label': t('sheet.cellAria', {
              n: cellTile.n,
              color: colorName(color),
              dots: cellTile.dots,
              s: cellTile.dots > 1 ? 's' : '',
              auto: auto ? t('sheet.auto') : '',
            }),
            'aria-pressed': auto ? 'true' : String(manual),
            style: { '--cell-bg': color.hex, '--cell-ink': color.ink },
          };
          if (!auto) {
            attrs.onclick = (event) => toggleManual(cellTile.n, event.currentTarget, player);
          } else {
            attrs.disabled = true;
          }
          return h('button', attrs, h('span', { class: 'cell-num', text: String(cellTile.n) }), dotsEl(cellTile.dots));
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
          h('h2', { text: t('sheet.title') }),
          h('span', { class: 'pill', text: player.name }),
        ),
    h('p', { class: 'muted small' }, t('sheet.intro')),
    context,
    h('div', { class: 'draft-block' },
      h('h3', { class: 'subtitle', text: t('sheet.draft') }),
      draft,
      h('p', { class: 'muted small', text: t('sheet.draftNote') }),
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
      }, t('sheet.clear')),
      h('span', { class: 'muted small', text: t('sheet.clearNote') }),
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
    h('summary', { text: t('sheet.journal', { count: entries.length }) }),
    h('p', { class: 'muted small', text: t('sheet.journalNote') }),
    entries.length
      ? h(
          'ol',
          { class: 'log-list' },
          entries.map((entry) =>
            h(
              'li',
              { class: `log-entry log-entry--${entry.type}` },
              h('span', { class: 'log-turn', text: t('turn.turn', { n: entry.turn }) }),
              h('span', { text: formatLog(entry) }),
            ),
          ),
        )
      : h('p', { class: 'muted', text: t('sheet.noEvents') }),
  );
}

function gameOverSummary(game) {
  const winner = game.winner === null ? null : game.players[game.winner];
  const title = winner ? t('gameover.win', { name: winner.name }) : t('gameover.noWinner');
  let subtitle = '';
  if (winner && game.winReason === 'claim') subtitle = t('gameover.claim');
  else if (winner && game.winReason === 'lastActive') subtitle = t('gameover.lastActive');
  else if (!winner) subtitle = t('gameover.allWrong');
  return { winner, title, subtitle };
}

function renderGameOver() {
  const game = app.game;
  if (!game) return renderHome();
  const { winner, title, subtitle } = gameOverSummary(game);

  const actions = [
    h('button', { class: 'btn btn--primary btn--wide', type: 'button', onclick: openReview }, t('gameover.review')),
    h('button', { class: 'btn btn--secondary btn--wide', type: 'button', onclick: replay }, t('gameover.replay')),
    h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: requestNewGame }, t('gameover.newGame')),
    h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: goHome }, t('gameover.home')),
  ];

  return h(
    'main',
    { class: 'screen screen--over' },
    h('div', { class: 'over-top' }, renderLangSwitcher()),
    h(
      'div',
      { class: 'card over-card' },
      h('p', { class: 'eyebrow', text: t('gameover.eyebrow') }),
      h('h1', { class: 'over-title', text: title }),
      subtitle ? h('p', { class: 'muted', text: subtitle }) : null,
      winner
        ? h('div', { class: 'winner-stand' },
            h('p', { class: 'mini-label', text: t('gameover.numbers') }),
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
        isWinner ? h('span', { class: 'badge badge--win', text: t('common.winner') }) : null,
        player.eliminated ? h('span', { class: 'badge badge--out', text: t('common.eliminated') }) : null,
        player.kind === 'bot' ? h('span', { class: 'badge badge--bot', text: t('common.ai') }) : null,
      ),
    ),
    h('p', { class: 'mini-label', text: t('review.real') }),
    h('div', { class: 'tile-row' }, player.stand.map((n) => tileEl(n, { size: 'md' }))),
    h(
      'p',
      { class: `review-claim${claim ? (claim.correct ? ' review-claim--yes' : ' review-claim--no') : ''}` },
      claim
        ? h('span', { class: `result-badge ${claim.correct ? 'result-badge--yes' : 'result-badge--no'}`, text: claim.correct ? t('review.correct') : t('review.wrong') })
        : h('span', { class: 'result-badge', text: t('review.noClaim') }),
      claim ? t('review.claim', { numbers: claim.numbers.join(' · ') }) : null,
    ),
    clueCount
      ? h('div', { class: 'review-clues' },
          h('p', { class: 'mini-label', text: t('review.clues') }),
          renderSortingZone(player),
          renderComparisonRow(player),
        )
      : h('p', { class: 'muted small', text: t('review.noClues') }),
  );
}

function renderReview() {
  const game = app.game;
  if (!game) return renderHome();
  const { winner, title, subtitle } = gameOverSummary(game);

  return h(
    'main',
    { class: 'screen screen--review' },
    topBar(t('review.title'), () => {
      app.screen = 'gameover';
      render();
    }, renderLangSwitcher()),
    h(
      'section',
      { class: 'card review-summary' },
      h('p', { class: 'eyebrow', text: t('gameover.eyebrow') }),
      h('h1', { class: 'over-title', text: title }),
      subtitle ? h('p', { class: 'muted', text: subtitle }) : null,
      h('p', { class: 'muted small' }, t('review.note')),
    ),
    h(
      'section',
      { class: 'review-section' },
      h('div', { class: 'section-head' }, h('h2', { text: t('review.supports') })),
      h('div', { class: 'review-players' }, game.players.map((player) => renderReviewPlayer(game, player))),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'section-head' },
        h('h2', { text: t('review.public') }),
        h('span', { class: 'pill', text: t('review.reserve', { count: game.supply.length }) }),
      ),
      game.publicTiles.length
        ? h('div', { class: 'tile-row' }, game.publicTiles.map((n) => tileEl(n, { size: 'md' })))
        : h('p', { class: 'muted small', text: t('review.noTiles') }),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'section-head' },
        h('h2', { text: t('review.journal') }),
        h('span', { class: 'pill', text: t('review.events', { count: game.log.length, s: game.log.length > 1 ? 's' : '' }) }),
      ),
      h(
        'ol',
        { class: 'log-list review-log' },
        game.log.map((entry) =>
          h('li', { class: `log-entry log-entry--${entry.type}` },
            h('span', { class: 'log-turn', text: t('turn.turn', { n: entry.turn }) }),
            h('span', { text: formatLog(entry) }),
          ),
        ),
      ),
    ),
    h('p', { class: 'fineprint' }, t('review.fineprint')),
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
    topBar(t('rules.title'), closeRules, renderLangSwitcher()),
    h(
      'article',
      { class: 'card rules-card' },
      h('h2', { text: t('rules.goalTitle') }),
      h('p', {}, t('rules.goal')),
      h('h2', { text: t('rules.principleTitle') }),
      h('p', {}, t('rules.principle')),
      h('h2', { text: t('rules.turnTitle') }),
      h('ol', {},
        h('li', {}, t('rules.reveal')),
        h('li', {}, t('rules.clue')),
      ),
      h('h2', { text: t('rules.sheetTitle') }),
      h('p', {}, t('rules.sheet')),
      h('h2', { text: t('rules.endTitle') }),
      h('p', {}, t('rules.end')),
      h('p', { class: 'phase-note' }, t('rules.adaptation')),
      h('h2', { text: t('rules.aiTitle') }),
      h('p', {}, t('rules.ai')),
      h('h2', { text: t('rules.privacyTitle') }),
      h('p', {}, t('rules.privacy')),
      h('p', { class: 'fineprint' }, t('rules.fineprint')),
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
      'aria-label': t('claim.input', { n: index + 1 }),
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
            error.textContent = t('claim.invalid');
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
              app.notice = t('pass.eliminatedNotice', { name: player.name });
              enterCurrentTurn();
            }
          } catch (err) {
            error.hidden = false;
            error.textContent = err.message;
          }
        },
      },
      h('h2', { id: 'claim-title', text: t('claim.title') }),
      h('p', { class: 'muted', text: t('claim.hint') }),
      h('button', { class: 'btn btn--ghost claim-fiche', type: 'button', onclick: openFiche }, t('claim.fiche')),
      h('div', { class: 'claim-inputs' }, inputs),
      error,
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: closeClaim }, t('claim.cancel')),
        h('button', { class: 'btn btn--primary', type: 'submit' }, t('claim.submit')),
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
        h('h2', { id: 'fiche-title', text: t('dock.fiche') }),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: closeFiche }, t('common.close')),
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
  document.documentElement.lang = getLanguage();
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
  document.title = t(`titles.${app.screen}`);

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

initLanguage();
app.saved = readSaveMeta();
registerServiceWorker();
render();
