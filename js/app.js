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
import { buildBotView, chooseBotAction, explainDeductions } from './bot.js';
import {
  LANGUAGES,
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
import { COMMIT } from './version.js';

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
  menuOpen: false,
  revealOpen: false,
  draftSlot: null,
  draftError: null,
  fichePage: 0,
  ficheOrder: readFicheOrder(),
  rulesReturn: null,
  botPlayerId: null,
  botTimer: null,
  botMessage: null,
  langOpen: false,
  langScreen: null,
  updating: false,
  updateMessage: null,
  updateTimer: null,
  reviewPov: null,
  reviewStep: 0,
  tutorialStep: 0,
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
  const label = t('common.language');
  return h(
    'div',
    { class: 'lang-dropdown' },
    h(
      'button',
      {
        class: 'lang-trigger',
        type: 'button',
        'aria-haspopup': 'true',
        'aria-expanded': String(app.langOpen),
        'aria-controls': app.langOpen ? 'lang-menu' : null,
        'aria-label': `${label}: ${t(`language.${language}`)}`,
        title: label,
        onclick: () => {
          app.langOpen = !app.langOpen;
          app.langScreen = app.screen;
          render();
          requestAnimationFrame(() => document.querySelector('.lang-trigger')?.focus());
        },
      },
      h('img', {
        class: 'flag-icon',
        src: `./icons/flag-${language}.svg`,
        alt: '',
        'aria-hidden': 'true',
      }),
      h('span', { class: 'lang-code', text: language.toUpperCase() }),
      h('span', { class: 'lang-caret', 'aria-hidden': 'true', text: '▾' }),
    ),
    app.langOpen
      ? h(
          'div',
          { class: 'lang-menu', id: 'lang-menu', role: 'group', 'aria-label': label },
          LANGUAGES.map((code) =>
            h(
              'button',
              {
                class: `lang-option${code === language ? ' is-active' : ''}`,
                type: 'button',
                'aria-pressed': String(code === language),
                onclick: () => {
                  app.langOpen = false;
                  if (getLanguage() !== code) setLanguage(code);
                  render();
                  requestAnimationFrame(() => document.querySelector('.lang-trigger')?.focus());
                },
              },
              h('img', {
                class: 'flag-icon',
                src: `./icons/flag-${code}.svg`,
                alt: '',
                'aria-hidden': 'true',
              }),
              h('span', { class: 'lang-option-name', text: t(`language.${code}`) }),
              h('span', { class: 'lang-option-code', text: code.toUpperCase() }),
            ),
          ),
        )
      : null,
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

function resetTurnUi() {
  app.menuOpen = false;
  app.revealOpen = false;
  app.draftSlot = null;
  app.draftError = null;
  app.fichePage = 0;
}

function enterCurrentTurn() {
  clearBotTimer();
  app.claimOpen = false;
  app.ficheOpen = false;
  app.selectedTile = null;
  resetTurnUi();

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
  resetTurnUi();
  app.notice = null;
  app.botPlayerId = null;
  app.botMessage = null;
  render();
}

function openTutorial() {
  app.tutorialStep = 0;
  app.screen = 'tutorial';
  app.langOpen = false;
  render();
}

function closeTutorial() {
  app.screen = 'home';
  app.tutorialStep = 0;
  render();
}

function tutorialGo(delta) {
  app.tutorialStep = Math.max(0, Math.min(5, app.tutorialStep + delta));
  render();
  focusSelector('.tutorial-next, .tutorial-play');
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
  resetTurnUi();
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
  resetTurnUi();
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
  resetTurnUi();
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
  resetTurnUi();
  render();
}

function openRules() {
  clearBotTimer();
  app.rulesReturn = { screen: app.screen };
  app.screen = 'rules';
  app.claimOpen = false;
  app.ficheOpen = false;
  app.menuOpen = false;
  app.revealOpen = false;
  app.draftSlot = null;
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
  app.revealOpen = false;
  app.menuOpen = false;
  app.draftSlot = null;
  runAction((game) => reveal(game, colorIndex));
  focusSelector('.gf-visible-row .tile');
}

function doSkipReveal() {
  runAction((game) => skipReveal(game));
}

function selectPublicTile(n) {
  if (!app.game || app.game.phase !== PHASES.CHOOSE_TILE) return;
  app.selectedTile = app.selectedTile === n ? null : n;
  app.draftSlot = null;
  app.menuOpen = false;
  app.draftError = null;
  render();
}

function clearSelectedTile() {
  app.selectedTile = null;
  render();
  focusSelector('.gf-visible-row .tile');
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
    app.menuOpen = false;
    app.revealOpen = false;
    app.draftSlot = null;
    app.draftError = null;
    app.notice = null;
    persist();
    render();
    focusSelector('.gf-end-turn, .gf-gotfive');
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function doCancelClue() {
  try {
    app.game = cancelClue(app.game);
    app.selectedTile = null;
    app.menuOpen = false;
    app.revealOpen = false;
    app.draftSlot = null;
    app.draftError = null;
    app.notice = null;
    persist();
    render();
    focusSelector('.gf-visible-row .tile');
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function doChooseCompareSlot(slot) {
  app.menuOpen = false;
  app.revealOpen = false;
  app.draftSlot = null;
  runAction((game) => chooseCompareSlot(game, slot));
  focusSelector('.gf-end-turn, .gf-gotfive');
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
    app.menuOpen = false;
    app.revealOpen = false;
    app.draftSlot = null;
    app.draftError = null;
    persist();
    enterCurrentTurn();
  } catch (error) {
    app.notice = error.message;
    render();
  }
}

function focusSelector(selector) {
  requestAnimationFrame(() => document.querySelector(selector)?.focus());
}

function readFicheOrder() {
  try {
    return localStorage.getItem('gotfive.ficheOrder') === 'hand' ? 'hand' : 'color';
  } catch {
    return 'color';
  }
}

function toggleFicheOrder() {
  app.ficheOrder = app.ficheOrder === 'hand' ? 'color' : 'hand';
  try {
    localStorage.setItem('gotfive.ficheOrder', app.ficheOrder);
  } catch {
    // Le choix reste valable pour la session si le stockage est indisponible.
  }
  render();
  focusSelector('.gf-order-btn');
}

function openMenu() {
  app.menuOpen = true;
  app.revealOpen = false;
  app.draftSlot = null;
  render();
}

function closeMenu() {
  app.menuOpen = false;
  render();
  focusSelector('.gf-menu-btn');
}

function openReveal() {
  if (!app.game || app.game.phase !== PHASES.REVEAL) return;
  app.revealOpen = true;
  app.menuOpen = false;
  app.draftSlot = null;
  render();
  focusSelector('.gf-inline-reveal .gf-color-card');
}

function closeReveal() {
  app.revealOpen = false;
  render();
  focusSelector('.gf-add-tile');
}

function openDraft(index) {
  app.draftSlot = index;
  app.draftError = null;
  app.revealOpen = false;
  app.menuOpen = false;
  render();
}

function closeDraft() {
  app.draftSlot = null;
  app.draftError = null;
  render();
  focusSelector('.gf-main-row .gf-main-card');
}

function setDraftValue(index, value) {
  const player = currentPlayer(app.game);
  player.draft[index] = String(value);
  persist();
  app.draftSlot = null;
  app.draftError = null;
  app.notice = null;
  render();
}

function submitDraftValue(event) {
  event.preventDefault();
  const player = currentPlayer(app.game);
  const index = app.draftSlot;
  if (index === null) return;
  const input = event.currentTarget.querySelector('.gf-draft-input');
  const n = Number(input?.value);
  const slotTile = tile(player.stand[index]);
  const visible = visibleNumbersFor(app.game, player.id);
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 60 ||
    tile(n).colorIndex !== slotTile.colorIndex ||
    visible.has(n) ||
    player.manual.includes(n)
  ) {
    app.draftError = t('gf.invalidValue');
    render();
    return;
  }
  setDraftValue(index, n);
}

function toggleFichePage() {
  app.fichePage = app.fichePage === 0 ? 1 : 0;
  render();
}

function clearManualMarks() {
  const game = app.game;
  if (!game) return;
  const player = currentPlayer(game);
  if (!player || player.manual.length === 0) return;
  player.manual = [];
  persist();
  render();
  focusSelector('.gf-clear-manual');
}

function gfToggleManual(n, player) {
  const set = new Set(player.manual);
  if (set.has(n)) set.delete(n);
  else set.add(n);
  player.manual = [...set].sort((a, b) => a - b);
  persist();
  render();
}

function nextPlayerName() {
  const game = app.game;
  if (!game) return '';
  const count = game.players.length;
  for (let step = 1; step <= count; step += 1) {
    const player = game.players[(game.currentPlayer + step) % count];
    if (!player.eliminated) return player.name;
  }
  return '';
}

function openClaim() {
  if (!app.game || app.game.phase === PHASES.GAME_OVER) return;
  const player = currentPlayer(app.game);
  if (player.eliminated || player.hasClaimed) return;
  app.ficheOpen = false;
  app.menuOpen = false;
  app.revealOpen = false;
  app.draftSlot = null;
  app.claimOpen = true;
  render();
}

function closeClaim() {
  app.claimOpen = false;
  render();
  focusSelector('.gf-gotfive');
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
      h('button', { class: 'btn btn--secondary btn--wide home-tutorial', type: 'button', onclick: openTutorial }, t('home.tutorial')),
      h('button', { class: 'btn btn--ghost btn--wide', type: 'button', onclick: openRules }, t('home.rules')),
    ),
    app.notice ? h('p', { class: 'notice', text: app.notice }) : null,
    h('p', { class: 'fineprint' }, t('home.fineprint')),
  );
}

function tutorialFiche() {
  return h(
    'div',
    { class: 'tutorial-fiche', 'aria-hidden': 'true' },
    COLORS.map((color, colorIndex) =>
      h(
        'div',
        { class: 'tutorial-fiche-row' },
        h('span', { class: 'tutorial-fiche-stripe', style: { background: color.hex } }),
        tilesForColor(colorIndex)
          .slice(0, 5)
          .map((cell) =>
            h(
              'span',
              { class: 'tutorial-fiche-cell', style: { '--tc': color.hex, '--ti': color.ink } },
              String(cell.n),
            ),
          ),
      ),
    ),
  );
}

function tutorialHand() {
  return h(
    'div',
    { class: 'tutorial-hand', 'aria-hidden': 'true' },
    COLORS.map((color) =>
      h(
        'span',
        { class: 'tutorial-hand-tile', style: { '--tc': color.hex, '--ti': color.ink } },
        h('span', { class: 'tutorial-ribbon', text: t('common.gotFive') }),
        gfEyes(color.id),
        h('span', { class: 'tutorial-badge', text: t('sheet.none') }),
      ),
    ),
  );
}

function tutorialVisual(step) {
  if (step === 2) return tutorialFiche();
  if (step === 3) return tutorialHand();
  if (step === 5) return h('div', { class: 'tutorial-gotfive', text: t('common.gotFive') });
  return h(
    'div',
    { class: 'tutorial-tiles', 'aria-hidden': 'true' },
    [4, 16, 28, 40, 55].map((n) => tileEl(n, { size: 'lg' })),
  );
}

function renderTutorial() {
  const step = app.tutorialStep;
  const total = 6;
  const last = step === total - 1;
  const actions = [
    step > 0
      ? h(
          'button',
          { class: 'btn btn--ghost', type: 'button', onclick: () => tutorialGo(-1) },
          t('tutorial.previous'),
        )
      : h('span', {}),
    last
      ? h(
          'button',
          { class: 'btn btn--primary tutorial-play', type: 'button', onclick: requestNewGame },
          t('tutorial.play'),
        )
      : h(
          'button',
          { class: 'btn btn--primary tutorial-next', type: 'button', onclick: () => tutorialGo(1) },
          t('tutorial.next'),
        ),
  ];
  return h(
    'main',
    { class: 'screen screen--tutorial' },
    topBar(t('tutorial.title'), closeTutorial, renderLangSwitcher()),
    h(
      'article',
      { class: 'card tutorial-card' },
      h('p', { class: 'eyebrow', text: t('tutorial.eyebrow') }),
      h('p', { class: 'tutorial-step', text: t('tutorial.step', { n: step + 1, total }) }),
      h('h2', { text: t(`tutorial.step${step + 1}Title`) }),
      tutorialVisual(step),
      h('p', { class: 'tutorial-text', text: t(`tutorial.step${step + 1}Text`) }),
      h(
        'div',
        { class: 'tutorial-dots', 'aria-hidden': 'true' },
        Array.from({ length: total }, (_, index) =>
          h('span', { class: `tutorial-dot${index === step ? ' is-active' : ''}` }),
        ),
      ),
      h('div', { class: 'tutorial-actions' }, actions),
    ),
    h('p', { class: 'fineprint' }, t('tutorial.fineprint')),
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

function gfOverlay(className, title, onClose, ...body) {
  return h(
    'div',
    { class: `gf-overlay ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'gf-overlay-hit', onclick: onClose }),
    h(
      'section',
      { class: 'gf-overlay-panel' },
      h(
        'div',
        { class: 'gf-overlay-head' },
        h('h2', { text: title }),
        h(
          'button',
          { class: 'gf-overlay-close', type: 'button', 'aria-label': t('common.close'), onclick: onClose },
          '×',
        ),
      ),
      ...body,
    ),
  );
}

function gfEyes(colorId) {
  return h(
    'span',
    { class: `gf-eyes gf-eyes--${colorId}`, 'aria-hidden': 'true' },
    h('span', { class: 'gf-eye' }),
    h('span', { class: 'gf-eye' }),
  );
}

function gfMainCard(player, index, options = {}) {
  const color = tile(player.stand[index]).color;
  const value = player.draft[index] ?? '';
  const classes = ['gf-main-card', `gf-main-card--${color.id}`];
  if (options.compare) classes.push('is-compare');
  if (options.selected) classes.push('is-selected');
  if (options.small) classes.push('is-small');
  const label = options.compare
    ? t('gf.compareWith', { ordinal: ordinal(index + 1), color: colorName(color) })
    : t('gf.cardAria', {
        ordinal: ordinal(index + 1),
        color: colorName(color),
        value: value || t('sheet.none'),
      });
  const attrs = {
    class: classes.join(' '),
    type: 'button',
    style: { '--gf-card': color.hex, '--gf-card-ink': color.ink },
    'aria-label': label,
  };
  if (options.onClick) attrs.onclick = options.onClick;
  else if (options.compare) attrs.onclick = () => doChooseCompareSlot(index);
  else if (options.editable) attrs.onclick = () => openDraft(index);
  return h(
    'button',
    attrs,
    h('span', { class: 'gf-card-ribbon', text: t('common.gotFive') }),
    gfEyes(color.id),
    h(
      'span',
      { class: 'gf-card-badge' },
      h('span', { class: 'gf-badge-symbol', 'aria-hidden': 'true', text: color.symbol }),
      h('span', { text: value || t('sheet.none') }),
    ),
  );
}

function gfTopBar(player, inert = false) {
  const initial = (player.name || '?').trim().charAt(0).toUpperCase() || '?';
  return h(
    'header',
    { class: 'gf-topbar', inert: inert ? true : null },
    h(
      'div',
      { class: 'gf-topbar-who' },
      h('span', { class: 'gf-avatar', 'aria-hidden': 'true', text: initial }),
      h(
        'div',
        { class: 'gf-topbar-id' },
        h('span', { class: 'gf-wordmark', text: 'GOT FIVE!' }),
        h('strong', { class: 'gf-player-name', text: player.name }),
        h('span', { class: 'gf-turn-label', text: t('gf.turnLabel', { n: app.game.turn }) }),
      ),
    ),
    h(
      'button',
      { class: 'gf-menu-btn', type: 'button', 'aria-label': t('gf.menu'), onclick: openMenu },
      h('span', { 'aria-hidden': 'true', text: '☰' }),
    ),
  );
}

function gfVisiblePanel(player) {
  const game = app.game;
  const selecting = game.phase === PHASES.CHOOSE_TILE;
  const choosing = [PHASES.CHOOSE_TILE, PHASES.CHOOSE_CLUE, PHASES.COMPARE_SLOT].includes(game.phase);
  const selected = app.selectedTile ?? game.chosenTile;
  return h(
    'section',
    { class: 'gf-panel gf-visible-panel' },
    h(
      'div',
      { class: 'gf-panel-head' },
      h('h2', { text: selecting ? t('gf.chooseVisible') : t('gf.visibleTiles') }),
      h('span', { class: 'gf-reserve', text: t('gf.reserve', { n: game.supply.length }) }),
    ),
    h(
      'div',
      { class: 'gf-visible-help' },
      h(
        'span',
        { class: `gf-visible-help-step${game.phase === PHASES.REVEAL ? ' is-active' : ''}` },
        h('span', { class: 'gf-visible-help-key', 'aria-hidden': 'true', text: '+' }),
        h('span', { text: t('gf.addTileHint') }),
      ),
      h(
        'span',
        { class: `gf-visible-help-step${choosing ? ' is-active' : ''}` },
        h('span', { class: 'gf-visible-help-key', 'aria-hidden': 'true', text: '›' }),
        h('span', { text: t('gf.chooseVisibleHint') }),
      ),
    ),
    h(
      'div',
      { class: 'gf-visible-row' },
      game.publicTiles.map((n) =>
        tileEl(n, {
          size: 'lg',
          onclick: selecting ? () => selectPublicTile(n) : null,
          selected: selected === n,
          highlight: game.lastRevealed === n && game.revealed !== null,
        }),
      ),
      game.phase === PHASES.REVEAL
        ? game.supply.length > 0
          ? h(
              'button',
              {
                class: `gf-add-tile${app.revealOpen ? ' is-open' : ''}`,
                type: 'button',
                'aria-label': t('gf.revealTitle'),
                'aria-expanded': String(app.revealOpen),
                onclick: app.revealOpen ? closeReveal : openReveal,
              },
              '+',
            )
          : h(
              'button',
              { class: 'gf-add-tile gf-add-tile--wide', type: 'button', onclick: doSkipReveal },
              t('gf.skipReveal'),
            )
        : null,
    ),
    app.revealOpen
      ? h(
          'div',
          { class: 'gf-inline-reveal' },
          h(
            'div',
            { class: 'gf-inline-reveal-head' },
            h('strong', { text: t('gf.revealTitle') }),
            h('button', { class: 'gf-inline-cancel', type: 'button', onclick: closeReveal }, t('common.cancel')),
          ),
          h('p', { class: 'gf-inline-hint', text: t('gf.revealHint') }),
          gfRevealChoices(),
        )
      : null,
  );
}

function gfFicheCell(n, player, visible) {
  const data = tile(n);
  const auto = visible.has(n);
  const manual = player.manual.includes(n);
  const current = app.game.clue?.tile === n;
  const offPage = app.fichePage === 0 ? n > 40 : n <= 40;
  const classes = ['gf-cell', `gf-cell--${data.color.id}`];
  if (auto) classes.push('is-auto');
  if (manual) classes.push('is-manual');
  if (current) classes.push('is-current');
  if (offPage) classes.push('is-offpage');
  const attrs = {
    class: classes.join(' '),
    type: 'button',
    style: { '--gf-cell-color': data.color.hex, '--gf-cell-ink': data.color.ink },
    'aria-label': t('sheet.cellAria', {
      n,
      color: colorName(data.color),
      dots: data.dots,
      s: data.dots > 1 ? 's' : '',
      auto: auto ? t('sheet.auto') : '',
    }),
    'aria-pressed': String(auto || manual),
  };
  if (auto) attrs.disabled = true;
  else attrs.onclick = () => gfToggleManual(n, player);
  return h(
    'button',
    attrs,
    h('span', { class: 'gf-cell-num', text: String(n) }),
    dotsEl(data.dots),
  );
}

function gfFicheRow(color, colorIndex, player, visible, focus) {
  return h(
    'div',
    { class: `gf-fiche-row${focus?.colorIndex === colorIndex ? ' is-focus' : ''}` },
    h(
      'span',
      { class: 'gf-row-stripe', style: { background: color.hex }, 'aria-hidden': 'true' },
      h('span', { class: 'gf-row-symbol', text: color.symbol }),
    ),
    tilesForColor(colorIndex).map((cell) => gfFicheCell(cell.n, player, visible)),
  );
}

function gfFichePanel(player) {
  const game = app.game;
  const visible = visibleNumbersFor(game, player.id);
  const focus = getFicheFocus(game, player);
  const manualSet = new Set(player.manual);
  const autoCount = [...visible].filter((n) => !manualSet.has(n)).length;
  const manualCount = player.manual.length;
  return h(
    'section',
    { class: 'gf-panel gf-fiche-panel' },
    h(
      'div',
      { class: 'gf-panel-head' },
      h('h2', { text: t('gf.fiche') }),
      h(
        'div',
        { class: 'gf-fiche-counts' },
        h(
          'span',
          { class: 'gf-fiche-count' },
          h('span', { text: t('gf.auto') }),
          h('strong', { text: String(autoCount) }),
        ),
        h(
          'span',
          { class: 'gf-fiche-count gf-fiche-count--manual' },
          h('span', { text: t('gf.manual') }),
          h('strong', { text: String(manualCount) }),
        ),
      ),
    ),
    h(
      'div',
      { class: 'gf-fiche-grid' },
      (app.ficheOrder === 'hand'
        ? player.standColors.map((colorIndex) => ({ color: COLORS[colorIndex], colorIndex }))
        : COLORS.map((color, colorIndex) => ({ color, colorIndex }))
      ).map(({ color, colorIndex }) => gfFicheRow(color, colorIndex, player, visible, focus)),
    ),
    h(
      'div',
      { class: 'gf-fiche-foot' },
      h(
        'button',
        { class: 'gf-page-btn', type: 'button', onclick: toggleFichePage },
        app.fichePage === 0 ? t('gf.pageNext') : t('gf.pagePrev'),
      ),
      h(
        'button',
        {
          class: `gf-order-btn${app.ficheOrder === 'hand' ? ' is-active' : ''}`,
          type: 'button',
          'aria-pressed': String(app.ficheOrder === 'hand'),
          'aria-label': t('gf.orderHandAria'),
          title: t('gf.orderHandAria'),
          onclick: toggleFicheOrder,
        },
        h('span', { class: 'gf-order-icon', 'aria-hidden': 'true', text: '⇅' }),
        t('gf.orderHand'),
      ),
      h(
        'button',
        {
          class: 'gf-page-btn gf-clear-manual',
          type: 'button',
          disabled: player.manual.length === 0,
          onclick: clearManualMarks,
        },
        t('sheet.clear'),
      ),
      h(
        'div',
        { class: 'gf-fiche-legend' },
        h(
          'span',
          { class: 'gf-legend' },
          h('span', { class: 'gf-swatch gf-swatch--auto', 'aria-hidden': 'true' }),
          t('gf.auto'),
        ),
        h(
          'span',
          { class: 'gf-legend' },
          h('span', { class: 'gf-swatch gf-swatch--manual', 'aria-hidden': 'true' }),
          t('gf.manual'),
        ),
      ),
    ),
    h('p', { class: 'gf-fiche-hint', text: t('gf.crossHint') }),
  );
}

function gfSortingClues(player, current) {
  return h(
    'div',
    { class: 'sorting-zone gf-clue-sort' },
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
                h(
                  'span',
                  {
                    class: `gf-clue-value${isCurrent && n === current.tile ? ' is-current' : ''}`,
                    text: String(n),
                  },
                ),
              )
            : h('span', { class: 'empty', text: '·' }),
        ),
      );
    }),
  );
}

function gfComparisonClues(player, current) {
  return h(
    'div',
    { class: 'comparison-row gf-clue-compare' },
    player.comparisons.map((group, slot) => {
      const isCurrent = current?.type === 'compare' && current.slot === slot;
      const targetColor = colorName(tile(player.stand[slot]).color);
      return h(
        'div',
        { class: `compare-slot${isCurrent ? ' is-current' : ''}` },
        h(
          'div',
          { class: 'compare-tiles' },
          group.length
            ? group.map((clue) => {
                const label = t(clue.same ? 'clue.same' : 'clue.different', {
                  tile: clue.n,
                  ordinal: ordinal(slot + 1),
                  color: targetColor,
                });
                return h(
                  'span',
                  {
                    class: `gf-clue-pips ${clue.same ? 'is-same' : 'is-different'}${isCurrent && clue.n === current.tile ? ' is-current' : ''}`,
                    'aria-label': label,
                    title: label,
                  },
                  dotsEl(tile(clue.n).dots),
                  h('span', { class: 'gf-clue-sign', 'aria-hidden': 'true', text: clue.same ? '=' : '≠' }),
                );
              })
            : h('span', { class: 'empty', text: '·' }),
        ),
      );
    }),
  );
}

function gfMainPanel(player) {
  const game = app.game;
  const clue = game.clue;
  const compare = game.phase === PHASES.COMPARE_SLOT;
  const editable = !compare && game.phase !== PHASES.CHOOSE_CLUE;
  return h(
    'section',
    { class: 'gf-panel gf-main-panel' },
    h(
      'div',
      { class: 'gf-panel-head' },
      h('h2', { text: t('gf.main') }),
      compare ? h('span', { class: 'gf-main-count', text: t('gf.comparePrompt') }) : null,
    ),
    h('div', { class: 'gf-sortings' }, gfSortingClues(player, clue)),
    h(
      'div',
      { class: 'gf-main-row' },
      h('span', { class: 'gf-order-sign', 'aria-hidden': 'true', text: '−' }),
      player.stand.map((_, index) => gfMainCard(player, index, { compare, editable })),
      h('span', { class: 'gf-order-sign', 'aria-hidden': 'true', text: '+' }),
    ),
    h('div', { class: 'gf-comparisons' }, gfComparisonClues(player, clue)),
    game.phase === PHASES.END ? h('div', { class: 'gf-result' }, renderClueResult()) : null,
    h('div', { class: 'gf-main-claim' }, gfGotFiveButton(player)),
    h('p', { class: 'gf-main-hint', text: t('gf.tapHint') }),
  );
}

function gfGotFiveButton(player) {
  const count = player.draft.filter((value) => value !== '').length;
  const complete = draftComplete(player);
  return h(
    'button',
    {
      class: `gf-gotfive${complete ? ' is-ready' : ''}`,
      type: 'button',
      onclick: openClaim,
      disabled: player.eliminated || player.hasClaimed,
    },
    h('span', { class: 'gf-gotfive-label', text: t('common.gotFive') }),
    h('span', { class: 'gf-gotfive-sep', 'aria-hidden': 'true', text: '·' }),
    h('span', { class: 'gf-gotfive-count', text: t('gf.claimCount', { n: count }) }),
  );
}

function gfBottomBar(player) {
  const game = app.game;
  if (game.phase !== PHASES.END) return null;
  return h(
    'div',
    { class: 'gf-bottom' },
    h(
      'button',
      { class: 'gf-end-turn', type: 'button', onclick: doEndTurn },
      h('strong', { text: t('gf.endTurn') }),
      h('span', { text: t('gf.passTo', { name: nextPlayerName() }) }),
    ),
  );
}

function gfRevealChoices() {
  const game = app.game;
  const available = canRevealColors(game);
  const counts = COLORS.map(
    (_, colorIndex) => game.supply.filter((n) => tile(n).colorIndex === colorIndex).length,
  );
  return h(
    'div',
    { class: 'gf-color-grid gf-color-grid--inline' },
    COLORS.map((color, index) =>
      h(
        'button',
        {
          class: `gf-color-card gf-color-card--${color.id}`,
          type: 'button',
          style: { '--gf-color': color.hex, '--gf-color-ink': color.ink },
          disabled: !available[index],
          onclick: () => doReveal(index),
        },
        h('span', { class: 'gf-color-symbol', 'aria-hidden': 'true', text: color.symbol }),
        gfEyes(color.id),
        h('span', { class: 'gf-color-name', text: colorName(color) }),
        h('span', {
          class: 'gf-color-count',
          text: `×${counts[index]}`,
        }),
      ),
    ),
  );
}

function gfClueModal(player) {
  const game = app.game;
  const n = app.selectedTile ?? game.chosenTile;
  if (n === null) return null;
  if (
    game.phase !== PHASES.CHOOSE_TILE &&
    game.phase !== PHASES.CHOOSE_CLUE &&
    game.phase !== PHASES.COMPARE_SLOT
  ) {
    return null;
  }
  const compare = game.phase === PHASES.COMPARE_SLOT;
  const close = () => {
    if (game.phase === PHASES.CHOOSE_TILE) clearSelectedTile();
    else doCancelClue();
  };
  return gfOverlay(
    'gf-clue-modal',
    t('gf.chooseTileTitle', { n }),
    close,
    h(
      'div',
      { class: 'gf-clue-head' },
      tileEl(n, { size: 'md' }),
      h('p', {
        class: 'gf-modal-sub',
        text: compare ? t('gf.comparePrompt') : t('gf.chooseTileHint'),
      }),
    ),
    compare
      ? null
      : h(
          'div',
          { class: 'gf-clue-actions' },
          h(
            'button',
            { class: 'gf-btn gf-btn--clue', type: 'button', onclick: () => doChooseClue('sort') },
            t('common.sort'),
          ),
          h(
            'button',
            { class: 'gf-btn gf-btn--clue', type: 'button', onclick: () => doChooseClue('compare') },
            t('common.compare'),
          ),
        ),
    h(
      'div',
      { class: 'gf-clue-cards' },
      player.stand.map((_, index) =>
        gfMainCard(player, index, { compare, small: true }),
      ),
    ),
    compare
      ? h('button', { class: 'gf-link', type: 'button', onclick: doCancelClue }, t('common.change'))
      : null,
  );
}

function gfDraftModal(player) {
  const index = app.draftSlot;
  if (index === null) return null;
  const slotTile = tile(player.stand[index]);
  const candidates = remainingNumbers(player, index);
  return gfOverlay(
    'gf-draft-modal',
    t('gf.draftTitle'),
    closeDraft,
    h(
      'div',
      { class: 'gf-draft-cards' },
      player.stand.map((_, cardIndex) =>
        gfMainCard(player, cardIndex, {
          selected: cardIndex === index,
          small: true,
          onClick: () => {
            app.draftSlot = cardIndex;
            app.draftError = null;
            render();
          },
        }),
      ),
    ),
    h('p', {
      class: 'gf-draft-color',
      text: `${ordinal(index + 1)} · ${colorName(slotTile.color)}`,
    }),
    h(
      'div',
      { class: 'gf-draft-values' },
      candidates.map((n) =>
        h(
          'button',
          {
            class: `gf-draft-value${player.draft[index] === String(n) ? ' is-current' : ''}`,
            type: 'button',
            onclick: () => setDraftValue(index, n),
          },
          h('strong', { text: String(n) }),
          dotsEl(tile(n).dots),
        ),
      ),
    ),
    h(
      'form',
      { class: 'gf-draft-form', onsubmit: submitDraftValue },
      h('input', {
        class: 'gf-draft-input',
        type: 'text',
        inputmode: 'numeric',
        maxlength: '2',
        placeholder: t('gf.enterValue'),
        'aria-label': t('gf.enterValue'),
      }),
      h('button', { class: 'gf-btn gf-btn--primary', type: 'submit' }, t('gf.apply')),
    ),
    app.draftError ? h('p', { class: 'gf-error', role: 'alert', text: app.draftError }) : null,
    h('p', { class: 'gf-modal-sub', text: t('gf.draftHint') }),
  );
}

function gfLogTag(entry) {
  if (entry.key === 'sort') return t('gf.tagSort');
  if (entry.key === 'compare') return t('gf.tagCompare');
  if (entry.key === 'reveal') return t('gf.tagReveal');
  if (entry.key === 'setup') return t('gf.tagSetup');
  if (['claimWin', 'claimLose', 'lastActive', 'draw'].includes(entry.key)) return t('gf.tagClaim');
  return t('gf.tagSkip');
}

function gfLogEntry(entry, game) {
  const name = entry.params?.player ?? null;
  const actor = name ? game.players.find((player) => player.name === name) : null;
  const initial = actor ? actor.name.trim().charAt(0).toUpperCase() : '·';
  const tileNumber = Number.isInteger(entry.params?.tile) ? entry.params.tile : null;
  return h(
    'li',
    { class: `gf-log-entry gf-log-entry--${entry.type}` },
    h('span', { class: 'gf-log-avatar', 'aria-hidden': 'true', text: initial }),
    h(
      'div',
      { class: 'gf-log-main' },
      h(
        'div',
        { class: 'gf-log-meta' },
        h('strong', { text: name || t('gf.tagSetup') }),
        h('span', { text: t('gf.turnLabel', { n: entry.turn }) }),
      ),
      tileNumber ? h('div', { class: 'gf-log-tile' }, tileEl(tileNumber, { size: 'xs' })) : null,
      h('span', { class: 'gf-log-detail', text: formatLog(entry) }),
    ),
    h('span', { class: 'gf-log-tag', text: gfLogTag(entry) }),
  );
}

function gfMenuDrawer(player) {
  const game = app.game;
  const entries = game.log.slice().reverse();
  return gfOverlay(
    'gf-menu',
    t('gf.journal'),
    closeMenu,
    h(
      'div',
      { class: 'gf-menu-status' },
      h('span', { class: 'gf-pill', text: t('gf.reserve', { n: game.supply.length }) }),
      renderLangSwitcher(),
    ),
    entries.length
      ? h('ol', { class: 'gf-log' }, entries.map((entry) => gfLogEntry(entry, game)))
      : h('p', { class: 'gf-modal-sub', text: t('gf.noRounds') }),
    h('h3', { class: 'gf-menu-title', text: t('gf.opponents') }),
    h(
      'div',
      { class: 'gf-opponents' },
      game.players
        .filter((other) => other.id !== player.id)
        .map((opponent) =>
          h(
            'article',
            { class: 'gf-opponent' },
            h('strong', { text: opponent.name }),
            h(
              'div',
              { class: 'gf-opponent-tiles' },
              opponent.stand.map((n) => tileEl(n, { size: 'sm' })),
            ),
          ),
        ),
    ),
    h(
      'div',
      { class: 'gf-menu-actions' },
      h('button', { class: 'gf-btn', type: 'button', onclick: openRules }, t('common.rules')),
    ),
  );
}

function gfHasOverlay() {
  if (app.screen !== 'turn' || !app.game) {
    return app.menuOpen || app.draftSlot !== null;
  }
  const phase = app.game.phase;
  return (
    app.menuOpen ||
    app.draftSlot !== null ||
    (phase === PHASES.CHOOSE_TILE && app.selectedTile !== null) ||
    phase === PHASES.CHOOSE_CLUE ||
    phase === PHASES.COMPARE_SLOT
  );
}

function renderTurn() {
  const game = app.game;
  if (!game) return renderHome();
  if (game.phase === PHASES.GAME_OVER) {
    app.screen = 'gameover';
    return renderGameOver();
  }
  const player = currentPlayer(game);
  const overlayOpen = gfHasOverlay();
  normalizeDraft(player);
  return h(
    'main',
    { class: 'screen gf-turn' },
    gfTopBar(player, overlayOpen),
    app.notice
      ? h('p', { class: 'gf-notice', role: 'status', inert: overlayOpen ? true : null, text: app.notice })
      : null,
    h(
      'div',
      { class: 'gf-turn-grid', inert: overlayOpen ? true : null },
      gfFichePanel(player),
      h(
        'div',
        { class: 'gf-tiles-row' },
        gfVisiblePanel(player),
        gfMainPanel(player),
      ),
      gfBottomBar(player),
    ),
    app.menuOpen ? gfMenuDrawer(player) : null,
    gfClueModal(player),
    app.draftSlot !== null ? gfDraftModal(player) : null,
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
        h('button', { class: 'btn btn--primary', type: 'button', onclick: doSkipReveal }, t('dock.skip')),
      ];
    } else {
      const available = canRevealColors(game);
      const counts = COLORS.map(
        (_, colorIndex) => game.supply.filter((n) => tile(n).colorIndex === colorIndex).length,
      );
      content = [
        h(
          'div',
          { class: 'color-grid dock-colors' },
          COLORS.map((color, index) => {
            const count = counts[index];
            const label = t('dock.revealColor', {
              color: colorName(color),
              count,
              s: count > 1 ? 's' : '',
            });
            return h(
              'button',
              {
                class: 'color-choice',
                type: 'button',
                disabled: !available[index],
                style: { '--color-bg': color.hex, '--color-ink': color.ink },
                'aria-label': label,
                title: label,
                onclick: () => doReveal(index),
              },
              h('span', { class: 'color-symbol', text: color.symbol }),
              h('span', { class: 'color-name', text: colorName(color) }),
              h('span', { class: 'color-count', text: String(count) }),
            );
          }),
        ),
      ];
    }
  } else if (phase === PHASES.CHOOSE_TILE) {
    if (selected === null) {
      prompt = t('dock.chooseTile');
      content = [];
    } else {
      prompt = t('dock.selected');
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
            ),
            h(
              'button',
              { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('compare') },
              h('strong', { text: t('dock.compare') }),
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
          ),
          h(
            'button',
            { class: 'btn btn--choice', type: 'button', onclick: () => doChooseClue('compare') },
            h('strong', { text: t('dock.compare') }),
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
        h('span', { 'aria-hidden': 'true' }),
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
      h('div', { class: 'dock-title' }, h('strong', { text: prompt })),
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
    h('div', { class: 'public-block public-block--visible' }, renderVisibleTiles()),
    h(
      'div',
      { class: 'public-block public-block--opponents' },
      h(
        'div',
        { class: 'opponent-list' },
        opponents.map((opponent) => renderOpponent(opponent)),
      ),
    ),
  );
}

function renderVisibleTiles() {
  const game = app.game;
  const canPick = game.phase === PHASES.CHOOSE_TILE;
  const selected = app.selectedTile ?? game.chosenTile;
  const tiles = game.publicTiles;
  return h(
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

function renderComparisonRow(player, compact = false, current = null, labels = true) {
  return h(
    'div',
    { class: `comparison-row${compact ? ' comparison-row--compact' : ''}` },
    player.comparisons.map((group, slot) => {
      const isCurrent = current?.type === 'compare' && current.slot === slot;
      return h(
        'div',
        { class: `compare-slot${isCurrent ? ' is-current' : ''}` },
        labels ? h('span', { class: 'notch-label', text: ordinal(slot + 1) }) : null,
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
        backTile(color),
      );
    }
    return h(
      'div',
      { class: `own-slot${targetSlot === index ? ' is-target' : ''}` },
      backTile(color),
    );
  });

  return h(
    'section',
    { class: `card own-stand-card${compareMode ? ' is-choosing' : ''}` },
    h('div', { class: 'section-head' },
      h('div', { class: 'section-title' },
        h('h2', { text: t('stand.title') }),
        compareMode ? h('span', { class: 'pill', text: t('stand.choose') }) : null,
      ),
    ),
    h('div', { class: 'own-section' },
      renderSortingZone(player, false, clue),
    ),
    h(
      'div',
      { class: 'stand-order', role: 'group', 'aria-label': t('stand.order') },
      h('span', { class: 'stand-order-sign', 'aria-hidden': 'true', text: '−' }),
      h('div', { class: 'own-stand' }, slots),
      h('span', { class: 'stand-order-sign', 'aria-hidden': 'true', text: '+' }),
    ),
    h('div', { class: 'own-section' },
      renderComparisonRow(player, false, clue, false),
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
      : null,
  );
}

function remainingNumbers(player, index) {
  const visible = visibleNumbersFor(app.game, player.id);
  const colorIndex = tile(player.stand[index]).colorIndex;
  return tilesForColor(colorIndex)
    .map((value) => value.n)
    .filter((n) => !visible.has(n) && !player.manual.includes(n));
}

function normalizeDraft(player) {
  let changed = false;
  for (let index = 0; index < 5; index += 1) {
    const candidates = remainingNumbers(player, index);
    const current = player.draft[index] ?? '';
    if (candidates.length === 1 && current !== String(candidates[0])) {
      player.draft[index] = String(candidates[0]);
      changed = true;
    } else if (current !== '' && !candidates.includes(Number(current))) {
      player.draft[index] = '';
      changed = true;
    }
  }
  if (changed) persist();
}

function draftOptions(player, index) {
  const candidates = remainingNumbers(player, index);
  const value = player.draft[index] ?? '';
  const options = [];
  if (candidates.length !== 1) {
    options.push(h('option', { value: '', text: t('sheet.none'), selected: value === '' }));
  }
  options.push(
    ...candidates.map((n) =>
      h('option', { value: String(n), text: String(n), selected: String(n) === value }),
    ),
  );
  return { candidates, options };
}

function draftComplete(player) {
  return player.draft.length === 5 && player.draft.every((value) => value !== '');
}

function syncDraftClaim(player) {
  const button = document.querySelector('.draft-claim');
  if (!button) return;
  button.disabled =
    !draftComplete(player) || player.eliminated || player.hasClaimed;
}

function syncDraftSelects(player) {
  normalizeDraft(player);
  for (const select of document.querySelectorAll('.draft-select')) {
    const index = Number(select.dataset.index);
    const { candidates, options } = draftOptions(player, index);
    select.replaceChildren(...options);
    select.disabled = candidates.length <= 1;
  }
  syncDraftClaim(player);
}

function renderSheet(player, options = {}) {
  const { focus = null, embedded = false, claimable = false } = options;
  const game = app.game;
  const visible = visibleNumbersFor(game, player.id);
  normalizeDraft(player);
  const draft = h(
    'div',
    { class: 'draft-row' },
    Array.from({ length: 5 }, (_, index) => {
      const color = tile(player.stand[index]).color;
      const { candidates, options: selectOptions } = draftOptions(player, index);
      const label = t('sheet.draftAria', {
        ordinal: ordinal(index + 1),
        color: colorName(color),
      });
      return h(
        'select',
        {
          class: 'draft-select',
          style: { '--draft-color': color.hex },
          'data-index': String(index),
          'aria-label': label,
          title: t('sheet.draftTitle', {
            ordinal: ordinal(index + 1),
            color: colorName(color),
          }),
          disabled: candidates.length <= 1,
          onchange: (event) => {
            player.draft[index] = event.target.value;
            persist();
            syncDraftClaim(player);
          },
        },
        selectOptions,
      );
    }),
  );

  const rows = COLORS.map((color, colorIndex) => {
    const isFocus = focus?.colorIndex === colorIndex;
    return h(
      'div',
      { class: `sheet-row${isFocus ? ' is-focus' : ''}` },
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
        ),
    context,
    h('div', { class: 'draft-block' },
      h('h3', { class: 'subtitle', text: t('sheet.draft') }),
      h(
        'div',
        { class: 'draft-line' },
        draft,
        claimable
          ? h(
              'button',
              {
                class: 'btn btn--claim draft-claim',
                type: 'button',
                onclick: openClaim,
                disabled:
                  !draftComplete(player) || player.eliminated || player.hasClaimed,
              },
              t('common.gotFive'),
            )
          : null,
      ),
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
    ),
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
  syncDraftSelects(player);
}

function renderJournalSection() {
  const game = app.game;
  const entries = game.log.slice().reverse();
  return h(
    'section',
    { class: 'card journal-card' },
    h('div', { class: 'section-head' },
      h('h2', { text: t('sheet.journal', { count: entries.length }) }),
    ),
    h(
      'ol',
      { class: 'log-list journal-log' },
      entries.map((entry) =>
        h(
          'li',
          { class: `log-entry log-entry--${entry.type}` },
          h('span', { class: 'log-turn', text: t('turn.turn', { n: entry.turn }) }),
          h('span', { text: formatLog(entry) }),
        ),
      ),
    ),
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

function reviewSteps(game) {
  const history = Array.isArray(game.history) ? game.history : [];
  const steps = history.map((entry) => ({
    turn: entry.turn,
    initial: Boolean(entry.initial),
    final: false,
    currentPlayer: Number.isInteger(entry.currentPlayer) ? entry.currentPlayer : null,
    publicTiles: entry.publicTiles.slice(),
    supply: Array.isArray(entry.supply) ? entry.supply.slice() : null,
    players: entry.players.map((player) => ({
      id: player.id,
      sorting: player.sorting.map((group) => group.slice()),
      comparisons: player.comparisons.map((group) =>
        group.map((clue) => ({ n: clue.n, same: clue.same })),
      ),
      manual: player.manual.slice(),
      draft: player.draft.slice(),
      eliminated: Boolean(player.eliminated),
      hasClaimed: Boolean(player.hasClaimed),
    })),
  }));
  steps.push({
    turn: game.turn,
    initial: false,
    final: true,
    currentPlayer: game.currentPlayer,
    publicTiles: game.publicTiles.slice(),
    supply: game.supply.slice(),
    players: game.players.map((player) => ({
      id: player.id,
      sorting: player.sorting.map((group) => group.slice()),
      comparisons: player.comparisons.map((group) =>
        group.map((clue) => ({ n: clue.n, same: clue.same })),
      ),
      manual: player.manual.slice(),
      draft: player.draft.slice(),
      eliminated: player.eliminated,
      hasClaimed: player.hasClaimed,
    })),
  });
  return steps;
}

function reviewStepGame(game, step) {
  const copy = structuredClone(game);
  copy.publicTiles = step.publicTiles.slice();
  copy.turn = step.turn;
  if (Array.isArray(step.supply)) copy.supply = step.supply.slice();
  if (Number.isInteger(step.currentPlayer)) copy.currentPlayer = step.currentPlayer;
  copy.history = [];
  for (const player of copy.players) {
    const saved = step.players.find((entry) => entry.id === player.id);
    if (!saved) continue;
    player.sorting = saved.sorting.map((group) => group.slice());
    player.comparisons = saved.comparisons.map((group) =>
      group.map((clue) => ({ n: clue.n, same: clue.same })),
    );
    player.manual = saved.manual.slice();
    player.draft = saved.draft.slice();
    player.eliminated = Boolean(saved.eliminated);
    player.hasClaimed = Boolean(saved.hasClaimed);
  }
  return copy;
}

function reviewStepLabel(step, game) {
  if (step.initial) return t('review.stepStart');
  if (step.final) return t('review.stepFinal');
  const player = game.players.find((entry) => entry.id === step.currentPlayer);
  return player
    ? t('review.stepTurnPlayer', { n: step.turn, player: player.name })
    : t('review.stepTurn', { n: step.turn });
}

function deductionReasonText(reason) {
  const params = { ...(reason.params ?? {}) };
  if (Number.isInteger(params.ordinal)) params.ordinal = ordinal(params.ordinal);
  if (Number.isInteger(params.targetDots)) params.s = params.targetDots > 1 ? 's' : '';
  return t(`deduction.${reason.key}`, params);
}

function reviewCell(n, color, options = {}) {
  const { auto = false, manual = false, possible = false, eliminated = false } = options;
  const classes = ['cell', 'review-cell'];
  if (auto) classes.push('is-auto');
  if (manual) classes.push('is-manual');
  if (possible) classes.push('is-possible');
  if (eliminated) classes.push('is-eliminated');

  const cellTile = tile(n);
  const vars = {
    n,
    color: colorName(color),
    dots: cellTile.dots,
    s: cellTile.dots > 1 ? 's' : '',
  };
  const label = eliminated
    ? t('review.cellEliminated', vars)
    : possible
      ? t('review.cellPossible', vars)
      : t('sheet.cellAria', {
          ...vars,
          auto: auto ? t('sheet.auto') : '',
        });

  return h(
    'span',
    {
      class: classes.join(' '),
      style: { '--cell-bg': color.hex, '--cell-ink': color.ink },
      'aria-label': label,
    },
    h('span', { class: 'cell-num', text: String(n) }),
    dotsEl(cellTile.dots),
  );
}

function renderHumanReviewSheet(stepGame, player) {
  const visible = visibleNumbersFor(stepGame, player.id);
  const draft = h(
    'div',
    { class: 'draft-block review-draft-block' },
    h('h3', { class: 'subtitle', text: t('sheet.draft') }),
    h(
      'div',
      { class: 'draft-row review-draft-row' },
      Array.from({ length: 5 }, (_, index) => {
        const color = tile(player.stand[index]).color;
        return h(
          'span',
          {
            class: 'review-draft',
            style: { '--draft-color': color.hex },
            'aria-label': t('sheet.draftAria', {
              ordinal: ordinal(index + 1),
              color: colorName(color),
            }),
          },
          player.draft[index] || t('sheet.none'),
        );
      }),
    ),
  );

  const rows = COLORS.map((color, colorIndex) =>
    h(
      'div',
      { class: 'sheet-row' },
      h(
        'div',
        { class: 'sheet-cells' },
        tilesForColor(colorIndex).map((cellTile) =>
          reviewCell(cellTile.n, color, {
            auto: visible.has(cellTile.n),
            manual: player.manual.includes(cellTile.n),
          }),
        ),
      ),
    ),
  );

  return h(
    'div',
    { class: 'review-sheet' },
    draft,
    h('div', { class: 'sheet-grid' }, rows),
  );
}

function renderAiReviewSheet(stepGame, player) {
  const sheet = explainDeductions(stepGame, player.id);

  return h(
    'div',
    { class: 'review-sheet' },
    h(
      'div',
      { class: 'sheet-grid' },
      sheet.map((slot) => {
        const color = COLORS[slot.colorIndex];
        const candidates = new Set(slot.candidates);
        return h(
          'div',
          { class: 'sheet-row' },
          h(
            'div',
            { class: 'sheet-cells' },
            tilesForColor(slot.colorIndex).map((cellTile) => {
              const possible = candidates.has(cellTile.n);
              return reviewCell(cellTile.n, color, {
                possible,
                eliminated: !possible,
              });
            }),
          ),
          slot.eliminated.length
            ? h(
                'ul',
                { class: 'review-reasons' },
                slot.eliminated.map((group) =>
                  h(
                    'li',
                    { class: 'review-reason' },
                    h('span', {
                      class: 'review-reason-numbers',
                      text: group.numbers.join(', '),
                    }),
                    h('span', {
                      class: 'review-reason-text',
                      text: deductionReasonText(group.reason),
                    }),
                  ),
                ),
              )
            : null,
        );
      }),
    ),
  );
}

function aiActionLabel(action, picked, player) {
  if (action.type === 'claim') {
    return t('review.aiActionClaim', { numbers: action.numbers.join(' · ') });
  }
  if (action.type === 'reveal') {
    return t('review.aiActionReveal', {
      color: colorName(COLORS[action.colorIndex]),
    });
  }
  if (action.type === 'skipReveal') return t('review.aiActionSkip');
  if (action.type === 'chooseTile') {
    return t('review.aiActionTile', { tile: action.tile });
  }
  if (action.type === 'chooseClue') {
    return t(action.clue === 'sort' ? 'review.aiActionSort' : 'review.aiActionCompare', {
      tile: picked,
    });
  }
  if (action.type === 'compareSlot') {
    return t('review.aiActionSlot', {
      ordinal: ordinal(action.slot + 1),
      color: colorName(tile(picked).color),
    });
  }
  if (action.type === 'endTurn') return t('review.aiActionEnd');
  return action.type;
}

function analyzeAiTurn(game, steps, stepIndex, pov) {
  const step = steps[stepIndex];
  if (!step || step.final || step.currentPlayer !== pov.id) return null;
  const startStep = step.initial ? step : steps[stepIndex - 1];
  if (!startStep || !Array.isArray(startStep.supply)) return null;

  try {
    const startGame = reviewStepGame(game, startStep);
    startGame.currentPlayer = pov.id;
    startGame.turn = step.turn;
    startGame.phase = PHASES.REVEAL;
    startGame.revealed = null;
    startGame.lastRevealed = null;
    startGame.chosenTile = null;
    startGame.clue = null;
    startGame.winner = null;
    startGame.winReason = null;
    startGame.claims = [];

    const actions = [];
    let current = startGame;
    for (let index = 0; index < 10; index += 1) {
      const action = chooseBotAction(buildBotView(current, pov.id));
      actions.push({ action, tile: current.chosenTile });
      if (action.type === 'claim' || action.type === 'endTurn') break;
      current = applyBotAction(current, action);
      if (current.phase === PHASES.GAME_OVER) break;
      if (current.currentPlayer !== pov.id) break;
    }
    return actions;
  } catch {
    return null;
  }
}

function renderAiAlternative(actions, pov) {
  return h(
    'div',
    { class: 'review-ai-plan' },
    h(
      'div',
      { class: 'section-head' },
      h('h3', { text: t('review.aiPlan') }),
      h('span', { class: 'pill', text: t('common.ai') }),
    ),
    h('p', {
      class: 'muted small',
      text: t('review.aiPlanNote', { name: pov.name }),
    }),
    h(
      'ol',
      { class: 'review-ai-actions' },
      actions.map(({ action, tile: picked }, index) =>
        h(
          'li',
          { class: 'review-ai-action' },
          h('span', { class: 'review-ai-step', text: String(index + 1) }),
          h('span', { text: aiActionLabel(action, picked, pov) }),
        ),
      ),
    ),
  );
}

function renderReviewPov(game, steps, stepIndex, step, pov, stepGame) {
  const isBot = pov.kind === 'bot';
  const stepPlayer = stepGame.players.find((player) => player.id === pov.id);
  const aiActions = analyzeAiTurn(game, steps, stepIndex, pov);
  const goToStep = (index) => {
    app.reviewStep = Math.max(0, Math.min(steps.length - 1, index));
    render();
  };

  return h(
    'section',
    { class: 'card review-pov-card' },
    h(
      'div',
      { class: 'section-head' },
      h('h2', { text: t('review.pov') }),
    ),
    h(
      'div',
      { class: 'review-pov' },
      game.players.map((player) => {
        const details = [player.kind === 'bot' ? t('common.ai') : t('common.human')];
        if (player.eliminated) details.push(t('common.eliminated'));
        return h(
          'button',
          {
            class: `segment review-pov-btn${player.id === pov.id ? ' is-active' : ''}`,
            type: 'button',
            'aria-pressed': String(player.id === pov.id),
            onclick: () => {
              app.reviewPov = player.id;
              render();
            },
          },
          h('span', { class: 'review-pov-name', text: player.name }),
          h('span', { class: 'review-pov-kind', text: details.join(' · ') }),
        );
      }),
    ),
    h(
      'div',
      { class: 'review-player-control', role: 'group', 'aria-label': t('review.step') },
      h(
        'button',
        {
          class: 'review-step-btn',
          type: 'button',
          disabled: stepIndex === 0,
          'aria-label': t('review.firstStep'),
          title: t('review.firstStep'),
          onclick: () => goToStep(0),
        },
        '«',
      ),
      h(
        'button',
        {
          class: 'review-step-btn',
          type: 'button',
          disabled: stepIndex === 0,
          'aria-label': t('review.previousStep'),
          title: t('review.previousStep'),
          onclick: () => goToStep(stepIndex - 1),
        },
        '‹',
      ),
      h(
        'div',
        { class: 'review-step-display' },
        h('strong', { text: reviewStepLabel(step, game) }),
        h('span', {
          class: 'review-step-count',
          text: `${stepIndex + 1} / ${steps.length}`,
        }),
      ),
      h(
        'button',
        {
          class: 'review-step-btn',
          type: 'button',
          disabled: stepIndex === steps.length - 1,
          'aria-label': t('review.nextStep'),
          title: t('review.nextStep'),
          onclick: () => goToStep(stepIndex + 1),
        },
        '›',
      ),
      h(
        'button',
        {
          class: 'review-step-btn',
          type: 'button',
          disabled: stepIndex === steps.length - 1,
          'aria-label': t('review.lastStep'),
          title: t('review.lastStep'),
          onclick: () => goToStep(steps.length - 1),
        },
        '»',
      ),
    ),
    h(
      'div',
      { class: 'review-sheet-head' },
      h('h3', { text: t('review.sheetTitle', { name: pov.name }) }),
      h('span', { class: 'muted small', text: isBot ? t('common.ai') : t('common.human') }),
    ),
    isBot
      ? renderAiReviewSheet(stepGame, stepPlayer)
      : renderHumanReviewSheet(stepGame, stepPlayer),
    aiActions ? renderAiAlternative(aiActions, pov) : null,
  );
}

function openReview() {
  if (!app.game || app.game.phase !== PHASES.GAME_OVER) return;
  clearBotTimer();
  app.screen = 'review';
  app.privacy = false;
  app.claimOpen = false;
  app.ficheOpen = false;
  const steps = reviewSteps(app.game);
  app.reviewStep = steps.length - 1;
  app.reviewPov = app.game.winner ?? app.game.players[0]?.id ?? null;
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
  const steps = reviewSteps(game);
  const stepIndex = Math.max(
    0,
    Math.min(steps.length - 1, app.reviewStep ?? steps.length - 1),
  );
  app.reviewStep = stepIndex;
  const step = steps[stepIndex];
  const pov = game.players.find((player) => player.id === app.reviewPov) ?? game.players[0];
  app.reviewPov = pov.id;
  const stepGame = reviewStepGame(game, step);

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
    renderReviewPov(game, steps, stepIndex, step, pov, stepGame),
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
  let submitButton = null;
  const syncClaim = () => {
    const numbers = inputs.map((input) => Number(input.value.trim()));
    if (submitButton) submitButton.disabled = !isValidClaimNumbers(numbers);
    const filled = inputs.filter((input) => input.value.trim() !== '').length;
    const count = document.querySelector('.gf-claim-modal .gf-claim-count');
    if (count) count.textContent = t('gf.claimCount', { n: filled });
    const badges = document.querySelectorAll('.gf-claim-cards .gf-main-card .gf-card-badge');
    badges.forEach((badge, index) => {
      badge.textContent = inputs[index]?.value.trim() || t('sheet.none');
    });
  };
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
        syncClaim();
      },
    }),
  );

  const filled = inputs.filter((input) => input.value.trim() !== '').length;
  submitButton = h(
    'button',
    {
      class: 'btn btn--primary',
      type: 'submit',
      disabled: !isValidClaimNumbers(inputs.map((input) => Number(input.value.trim()))),
    },
    t('claim.submit'),
  );
  const dialog = h(
    'dialog',
    { class: 'modal gf-claim-modal', 'aria-labelledby': 'claim-title' },
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
      h('h2', { id: 'claim-title', text: t('gf.claimTitle') }),
      h(
        'div',
        { class: 'gf-claim-cards' },
        player.stand.map((_, index) => gfMainCard(player, index, { small: true })),
      ),
      h('p', { class: 'gf-claim-count', text: t('gf.claimCount', { n: filled }) }),
      h('p', { class: 'gf-claim-note', text: t('gf.claimNote') }),
      h('div', { class: 'claim-inputs' }, inputs),
      error,
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: closeClaim }, t('claim.cancel')),
        submitButton,
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
  if (app.langOpen && app.langScreen !== app.screen) app.langOpen = false;
  document.documentElement.lang = getLanguage();
  if (app.screen === 'turn' && app.privacy) app.screen = 'pass';
  if (app.screen === 'pass' && app.game?.phase === PHASES.GAME_OVER) app.screen = 'gameover';
  if (app.screen === 'turn' && app.game?.phase === PHASES.GAME_OVER) app.screen = 'gameover';
  if (app.screen === 'bot' && app.game?.phase === PHASES.GAME_OVER) app.screen = 'gameover';
  if (!app.game && !['home', 'setup', 'rules', 'tutorial'].includes(app.screen)) app.screen = 'home';

  document.body.classList.toggle(
    'gf-no-scroll',
    app.screen === 'turn' && (gfHasOverlay() || app.claimOpen || app.ficheOpen),
  );

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
  else if (app.screen === 'tutorial') view = renderTutorial();
  else view = renderHome();

  root.append(view);
  const touch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const updateHint = t(touch ? 'common.updateHintTouch' : 'common.updateHint');
  root.append(
    h(
      'footer',
      {
        class: `app-version${app.screen === 'turn' ? ' app-version--turn' : ''}`,
        inert: app.screen === 'turn' && gfHasOverlay() ? true : null,
      },
      h(
        'button',
        {
          class: 'version-button',
          type: 'button',
          title: updateHint,
          'aria-label': `${t('common.commit', { sha: COMMIT })} — ${updateHint}`,
          disabled: app.updating,
          onclick: (event) => {
            if (event.detail === 0 || touch) downloadLatestVersion();
          },
          ondblclick: downloadLatestVersion,
        },
        t('common.commit', { sha: COMMIT }),
      ),
      app.updateMessage
        ? h('span', {
            class: 'version-status',
            role: 'status',
            text: app.updateMessage,
          })
        : null,
    ),
  );
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

  if (app.screen === 'turn') {
    const overlay = root.querySelector('.gf-overlay');
    if (overlay) {
      requestAnimationFrame(() => {
        const target =
          overlay.querySelector('.gf-overlay-close') ||
          overlay.querySelector('button, input, [tabindex]');
        target?.focus();
      });
    }
  }
}

async function downloadLatestVersion() {
  if (app.updating) return;
  app.updating = true;
  app.updateMessage = t('common.updating');
  clearTimeout(app.updateTimer);
  render();

  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  const onControllerChange = () => reload();

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, {
          once: true,
        });
        await registration.update();
        const pending = registration.installing || registration.waiting;
        if (!pending) {
          reload();
          return;
        }
        app.updateTimer = setTimeout(reload, 10000);
        return;
      }
    }
    reload();
  } catch (error) {
    navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    clearTimeout(app.updateTimer);
    app.updating = false;
    app.updateMessage = t('common.updateError');
    render();
    app.updateTimer = setTimeout(() => {
      app.updateMessage = null;
      render();
    }, 5000);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error) => {
        console.warn('Service worker non enregistré :', error);
      });
    });
  }
}

document.addEventListener('click', (event) => {
  if (!app.langOpen) return;
  if (event.target instanceof Element && event.target.closest('.lang-dropdown')) return;
  app.langOpen = false;
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (app.claimOpen || app.ficheOpen) return;

  if (app.menuOpen) {
    event.preventDefault();
    closeMenu();
    return;
  }
  if (app.revealOpen) {
    event.preventDefault();
    closeReveal();
    return;
  }
  if (app.draftSlot !== null) {
    event.preventDefault();
    closeDraft();
    return;
  }
  if (app.screen === 'turn' && app.game) {
    if (app.game.phase === PHASES.CHOOSE_TILE && app.selectedTile !== null) {
      event.preventDefault();
      clearSelectedTile();
      return;
    }
    if (app.game.phase === PHASES.CHOOSE_CLUE || app.game.phase === PHASES.COMPARE_SLOT) {
      event.preventDefault();
      doCancelClue();
      return;
    }
  }
  if (!app.langOpen) return;
  event.preventDefault();
  app.langOpen = false;
  render();
  requestAnimationFrame(() => document.querySelector('.lang-trigger')?.focus());
});

initLanguage();
app.saved = readSaveMeta();
registerServiceWorker();
render();
