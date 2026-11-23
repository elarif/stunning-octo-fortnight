import { COLORS } from './tiles.js';

const STORAGE_KEY = 'gotfive.lang';

const MESSAGES = {
  fr: {
    language: { fr: 'Français', en: 'Anglais' },
    titles: {
      home: 'Got Five ! — version locale',
      setup: 'Nouvelle partie — Got Five !',
      pass: 'Passage — Got Five !',
      notes: 'Mes notes — Got Five !',
      turn: 'Tour — Got Five !',
      bot: 'Tour de l’IA — Got Five !',
      gameover: 'Partie terminée — Got Five !',
      review: 'Table finale — Got Five !',
      rules: 'Règles — Got Five !',
    },
    common: {
      yes: 'Oui',
      no: 'Non',
      back: 'Retour',
      close: 'Fermer',
      cancel: 'Annuler',
      rules: 'Règles',
      language: 'Langue',
      ai: 'IA',
      human: 'Humain',
      winner: 'Gagnant',
      eliminated: 'Éliminé',
      you: 'Toi',
      opponent: 'Adversaire',
      tileCount: '{count} tuile{s}',
      eventCount: '{count} événement{s}',
      points: '{count} point{s}',
      tileAria: 'Tuile {n}, {color}, {dots} point{s}',
      noEvents: 'Aucun événement.',
      reveal: 'Révéler',
      exhausted: 'Épuisée',
      sort: 'Classer',
      compare: 'Comparer',
      change: 'Changer',
      endTurn: 'Fin du tour',
      gotFive: 'GOT FIVE !',
    },
    home: {
      eyebrow: 'Jeu de déduction — version locale',
      tagline: 'Solo vs IA · 2 à 4 joueurs · hors ligne',
      newGame: 'Nouvelle partie',
      continue: 'Continuer la partie',
      lastGame: 'Voir la dernière partie',
      rules: 'Règles',
      corrupted: 'Sauvegarde illisible. Lance une nouvelle partie.',
      fineprint: 'Version non officielle, à usage personnel. Inspirée du jeu Got Five ! de Blue Orange.',
    },
    setup: {
      title: 'Nouvelle partie',
      who: 'Qui joue ?',
      soloIntro: 'Toi contre une IA locale.',
      localIntro: 'Choisis le nombre de joueurs, puis leurs noms.',
      modeLocal: 'Local',
      modeSolo: 'Solo vs IA',
      modeLabel: 'Mode de partie',
      countLabel: 'Nombre de joueurs',
      soloNote: '2 joueurs : toi et l’IA. L’IA joue automatiquement, sans écran de passage.',
      you: 'Toi',
      yourName: 'Ton nom',
      opponent: 'Adversaire',
      botName: 'IA 1',
      botHint: 'Joue automatiquement',
      player: 'Joueur {n}',
      firstSolo: 'Qui commence ?',
      firstLocal: 'Premier joueur (le plus jeune)',
      start: 'Commencer la partie',
      noteSolo: 'L’IA déduit à partir des informations publiques. Son écran de tour ne montre jamais ton support. Annonce GOT FIVE ! uniquement pendant ton tour.',
      noteLocal: 'Sur un seul appareil, les joueurs se passent l’écran. L’annonce GOT FIVE ! se fait uniquement pendant ton tour.',
    },
    pass: {
      turn: 'Tour {n}',
      title: 'Passe l’appareil à',
      warning: 'Les autres joueurs détournent le regard. Cet écran ne doit être vu que par ce joueur.',
      start: 'Je suis {name} — afficher mon tour',
      notes: 'Consulter mes notes',
      rules: 'Règles',
      fineprint: 'Annonce GOT FIVE ! uniquement pendant ton tour.',
      eliminatedNotice: '{name} a annoncé GOT FIVE ! mais s’est trompé(e) : éliminé(e).',
    },
    notes: {
      title: 'Mes notes',
      fineprint: 'Les autres joueurs détournent le regard. L’annonce GOT FIVE ! se fait uniquement pendant ton tour.',
    },
    turn: {
      turn: 'Tour {n}',
      reserve: 'Réserve : {n}',
      rules: 'Règles',
      fineprint: 'Version non officielle, à usage personnel. Les numéros de ton support restent cachés jusqu’à la fin.',
    },
    table: {
      title: 'Table publique',
      visible: 'Visible par tous',
      visibleTiles: 'Tuiles visibles',
      count: '{count} tuile{s}',
      selectHint: 'Touche une tuile pour la sélectionner.',
      remainHint: 'Elles restent visibles jusqu’à la fin de la partie.',
      noTiles: 'Aucune tuile visible.',
      opponents: 'Adversaires',
      opponentsNote: 'Tu vois leurs numéros. Ne les prononce pas à voix haute.',
      noClues: 'Aucun indice posé.',
      clues: 'Indices posés ({count})',
      sorting: 'Zone de classement',
      comparisons: 'Comparaisons',
      legend: 'Légende des couleurs',
      before: 'avant',
      after: 'après',
    },
    stand: {
      title: 'Ton support',
      hidden: 'Numéros cachés',
      choose: 'Choisis une tuile',
      order: 'ordre croissant →',
      hint: 'Tu connais les couleurs et les positions, pas les numéros.',
      compareHint: 'Touche la tuile à comparer avec la tuile sélectionnée.',
      sorting: 'Zone de classement',
      comparisons: 'Comparaisons',
      compareAria: 'Comparer avec ta {ordinal} tuile, {color}',
    },
    dock: {
      aria: 'Actions du tour',
      kicker: 'À toi de jouer · {name}',
      reveal: 'Révéler une tuile',
      revealHint: 'Choisis une couleur. La tuile piochée sera révélée à tout le monde.',
      emptySupply: 'La réserve est vide. Passe directement à l’indice.',
      skip: 'Continuer sans révéler',
      chooseTile: 'Choisis une tuile visible',
      chooseTileHint: 'Touche une tuile du plateau. Les actions apparaîtront ici.',
      selected: 'Tuile sélectionnée',
      what: 'Que faire de cette tuile ?',
      sort: 'Classer',
      sortHint: 'Placer dans ton ordre croissant.',
      compare: 'Comparer',
      compareHint: 'Comparer ses points à une de tes tuiles.',
      change: 'Changer',
      chooseClue: 'Choisis un indice',
      chooseCompare: 'Choisis ta tuile à comparer',
      compareTouch: 'Touche une tuile de ton support.',
      result: 'Indice obtenu',
      finish: 'Fin du tour',
      noClue: 'Aucun indice possible : termine ton tour.',
      fiche: 'Ma fiche',
    },
    clue: {
      sorted: 'Classé',
      same: 'Le {tile} a le même nombre de points que ta {ordinal} tuile ({color}).',
      different: 'Le {tile} n’a pas le même nombre de points que ta {ordinal} tuile ({color}).',
      sortedText: 'Le {tile} se place {position} de ton support.',
    },
    sheet: {
      title: 'Ma fiche de déduction',
      intro: 'Les numéros visibles sur la table sont barrés automatiquement. Barre les autres au fur et à mesure de tes déductions.',
      draft: 'Mes 5 numéros (brouillon)',
      draftNote: 'Les contours reprennent les couleurs de ton support, dans l’ordre croissant. Une seule annonce, et seulement pendant ton tour.',
      draftAria: 'Brouillon, {ordinal} tuile, {color}',
      draftTitle: '{ordinal} tuile : {color}',
      clear: 'Effacer mes croix manuelles',
      clearNote: 'Les croix automatiques ne s’effacent pas.',
      journal: 'Journal de la partie ({count})',
      journalNote: 'Journal public. Il ne contient aucun numéro caché.',
      noEvents: 'Aucun événement.',
      cellAria: '{n}, {color}, {dots} point{s}{auto}',
      auto: ' — visible, barré automatiquement',
      focusSorted: 'Classé',
      focusSame: 'Le {tile} a le même nombre de points que ta {ordinal} tuile.',
      focusDifferent: 'Le {tile} n’a pas le même nombre de points que ta {ordinal} tuile.',
    },
    claim: {
      title: 'GOT FIVE !',
      hint: 'Annonce tes 5 numéros dans l’ordre croissant. Une seule tentative.',
      fiche: 'Voir ma fiche',
      cancel: 'Annuler',
      submit: 'Annoncer',
      invalid: 'Il faut 5 numéros distincts, dans l’ordre croissant, entre 1 et 60.',
      input: 'Numéro {n}',
    },
    bot: {
      badge: 'IA',
      thinking: 'L’IA réfléchit…',
      reveal: 'L’IA révèle une tuile.',
      skip: 'L’IA passe la révélation.',
      chooseTile: 'L’IA choisit le {tile}.',
      sort: 'L’IA demande un classement.',
      compare: 'L’IA demande une comparaison.',
      comparePoints: 'L’IA compare les points.',
      end: 'L’IA termine son tour.',
      claim: 'L’IA annonce GOT FIVE !',
      error: 'Erreur IA : {message}',
      support: 'Support de l’IA',
      visible: 'Visible par tous',
      note: 'Son écran de tour ne montre jamais les supports humains.',
      visibleTiles: 'Tuiles visibles',
      clues: 'Indices posés par l’IA',
      noClues: 'Aucun indice posé.',
      recent: 'Derniers événements',
      noEvents: 'Aucun événement.',
      fineprint: 'Écran public du tour de l’IA. Aucun support humain n’est affiché.',
      status: 'IA',
    },
    gameover: {
      eyebrow: 'Partie terminée',
      win: '{name} gagne !',
      noWinner: 'Aucun vainqueur',
      claim: 'Annonce GOT FIVE ! réussie.',
      lastActive: 'Dernier joueur en lice.',
      allWrong: 'Tous les joueurs se sont trompés.',
      numbers: 'Ses 5 numéros, dans l’ordre croissant',
      review: 'Voir la table finale',
      replay: 'Rejouer avec les mêmes joueurs',
      newGame: 'Nouvelle partie',
      home: 'Accueil',
    },
    review: {
      title: 'Table finale',
      note: 'Tous les supports sont révélés. Comparez les annonces avec les numéros réels et le journal des actions.',
      supports: 'Supports finaux',
      real: 'Support réel',
      correct: 'Correcte',
      wrong: 'Incorrecte',
      noClaim: 'Aucune annonce',
      claim: 'Annonce : {numbers}',
      clues: 'Indices posés',
      noClues: 'Aucun indice posé.',
      public: 'Table publique finale',
      reserve: 'Réserve : {count}',
      noTiles: 'Aucune tuile visible.',
      journal: 'Journal des actions',
      events: '{count} événement{s}',
      fineprint: 'Table finale et journal publics. La partie est terminée.',
    },
    rules: {
      title: 'Règles',
      goalTitle: 'Le but',
      goal: 'Être le premier à retrouver les 5 numéros cachés sur son support, en s’aidant des indices révélés pendant la partie.',
      principleTitle: 'Le principe',
      principle: 'Tu vois les numéros de tous les autres joueurs, mais jamais les tiens. Chaque joueur a 5 tuiles, une de chaque couleur, rangées dans l’ordre croissant. Tu connais leurs couleurs et leurs positions, pas leurs numéros.',
      turnTitle: 'Un tour, deux actions',
      reveal: 'Révéler une tuile de la couleur de ton choix. Son numéro est annoncé et elle reste visible.',
      clue: 'Demander un indice sur l’une des tuiles visibles : classer (l’app la place dans ton ordre croissant) ou comparer (l’app répond Oui ou Non sur l’égalité des points avec l’une de tes tuiles).',
      sheetTitle: 'La fiche',
      sheet: 'La fiche liste les 60 tuiles par couleur, numéro et points. Les numéros visibles sur la table sont barrés automatiquement ; tu peux barrer les autres à la main. En cas d’erreur, efface tes croix manuelles et recommence.',
      endTitle: 'Annonce et fin',
      end: 'Pendant ton tour, tu peux annoncer « GOT FIVE ! » une seule fois : donne tes 5 numéros dans l’ordre croissant. Si tout est juste, tu gagnes. Si tu te trompes, tu es éliminé et la partie continue. Si tous les autres se trompent, le dernier joueur en lice gagne automatiquement.',
      adaptation: 'Adaptation locale : l’annonce se fait uniquement pendant ton tour, l’application répond aux indices à la place du voisin, et les joueurs se passent l’appareil.',
      aiTitle: 'Mode solo contre l’IA',
      ai: 'L’IA joue automatiquement. Elle ne voit pas ses propres numéros : elle déduit à partir des informations publiques et de ses propres indices. Son écran de tour ne montre aucun support humain. L’annonce reste limitée à son tour.',
      privacyTitle: 'Confidentialité',
      privacy: 'Sur un seul appareil, chaque joueur ne regarde l’écran que pendant son tour. Les autres détournent le regard. Ne prononce jamais les numéros des tuiles de tes adversaires : ils pourraient entendre les leurs.',
      fineprint: 'Version non officielle, à usage personnel. Règles inspirées du jeu Got Five ! de Blue Orange.',
    },
    log: {
      setup: 'Mise en place terminée. {player} commence.',
      reveal: '{player} révèle le {tile}.',
      skipEmpty: 'La réserve est vide : on passe directement à l’indice.',
      skipNoTiles: 'La réserve et les tuiles visibles sont épuisées : le tour se termine.',
      sort: '{player} classe le {tile} : il se place {position} du support de {player}.',
      compare: '{player} compare le {tile} à sa {ordinal} tuile ({color}) : {answer}.',
      claimWin: '{player} annonce GOT FIVE ! et trouve ses 5 numéros. {player} gagne !',
      claimLose: '{player} annonce GOT FIVE ! mais se trompe. {player} est éliminé(e).',
      lastActive: '{player} est le dernier joueur en lice et gagne.',
      draw: 'Tous les joueurs se sont trompés. Aucun vainqueur.',
    },
    position: {
      0: 'avant la 1re tuile',
      1: 'entre la 1re et la 2e tuile',
      2: 'entre la 2e et la 3e tuile',
      3: 'entre la 3e et la 4e tuile',
      4: 'entre la 4e et la 5e tuile',
      5: 'après la 5e tuile',
    },
    ordinal: { 1: '1re', 2: '2e', 3: '3e', 4: '4e', 5: '5e' },
    color: {
      green: 'Vert',
      pink: 'Rose',
      blue: 'Bleu',
      red: 'Rouge',
      orange: 'Orange',
    },
  },
  en: {
    language: { fr: 'French', en: 'English' },
    titles: {
      home: 'Got Five! — Local version',
      setup: 'New game — Got Five!',
      pass: 'Pass — Got Five!',
      notes: 'My notes — Got Five!',
      turn: 'Turn — Got Five!',
      bot: 'AI turn — Got Five!',
      gameover: 'Game over — Got Five!',
      review: 'Final table — Got Five!',
      rules: 'Rules — Got Five!',
    },
    common: {
      yes: 'Yes',
      no: 'No',
      back: 'Back',
      close: 'Close',
      cancel: 'Cancel',
      rules: 'Rules',
      language: 'Language',
      ai: 'AI',
      human: 'Human',
      winner: 'Winner',
      eliminated: 'Eliminated',
      you: 'You',
      opponent: 'Opponent',
      tileCount: '{count} tile{s}',
      eventCount: '{count} event{s}',
      points: '{count} dot{s}',
      tileAria: 'Tile {n}, {color}, {dots} dot{s}',
      noEvents: 'No events.',
      reveal: 'Reveal',
      exhausted: 'Exhausted',
      sort: 'Sort',
      compare: 'Compare',
      change: 'Change',
      endTurn: 'End turn',
      gotFive: 'GOT FIVE!',
    },
    home: {
      eyebrow: 'Deduction game — local version',
      tagline: 'Solo vs AI · 2–4 players · offline',
      newGame: 'New game',
      continue: 'Continue game',
      lastGame: 'View last game',
      rules: 'Rules',
      corrupted: 'Save file unreadable. Start a new game.',
      fineprint: 'Unofficial version, for personal use. Inspired by Got Five! by Blue Orange.',
    },
    setup: {
      title: 'New game',
      who: 'Who’s playing?',
      soloIntro: 'You against a local AI.',
      localIntro: 'Choose the number of players, then their names.',
      modeLocal: 'Local',
      modeSolo: 'Solo vs AI',
      modeLabel: 'Game mode',
      countLabel: 'Number of players',
      soloNote: '2 players: you and the AI. The AI plays automatically, with no pass screen.',
      you: 'You',
      yourName: 'Your name',
      opponent: 'Opponent',
      botName: 'AI 1',
      botHint: 'Plays automatically',
      player: 'Player {n}',
      firstSolo: 'Who starts?',
      firstLocal: 'First player (youngest)',
      start: 'Start game',
      noteSolo: 'The AI deduces from public information. Its turn screen never shows your stand. Call GOT FIVE! only on your turn.',
      noteLocal: 'On one device, players pass the screen. GOT FIVE! can only be called on your turn.',
    },
    pass: {
      turn: 'Turn {n}',
      title: 'Pass the device to',
      warning: 'The other players look away. Only this player should see this screen.',
      start: 'I am {name} — show my turn',
      notes: 'View my notes',
      rules: 'Rules',
      fineprint: 'GOT FIVE! can only be called on your turn.',
      eliminatedNotice: '{name} called GOT FIVE! but was wrong and is eliminated.',
    },
    notes: {
      title: 'My notes',
      fineprint: 'The other players look away. GOT FIVE! can only be called on your turn.',
    },
    turn: {
      turn: 'Turn {n}',
      reserve: 'Supply: {n}',
      rules: 'Rules',
      fineprint: 'Unofficial version, for personal use. Your stand numbers stay hidden until the end.',
    },
    table: {
      title: 'Public table',
      visible: 'Visible to all',
      visibleTiles: 'Visible tiles',
      count: '{count} tile{s}',
      selectHint: 'Tap a tile to select it.',
      remainHint: 'They stay visible until the end of the game.',
      noTiles: 'No visible tiles.',
      opponents: 'Opponents',
      opponentsNote: 'You can see their numbers. Do not say them aloud.',
      noClues: 'No clues placed.',
      clues: 'Clues placed ({count})',
      sorting: 'Sorting zone',
      comparisons: 'Comparisons',
      legend: 'Color legend',
      before: 'before',
      after: 'after',
    },
    stand: {
      title: 'Your stand',
      hidden: 'Hidden numbers',
      choose: 'Choose a tile',
      order: 'ascending order →',
      hint: 'You know the colors and positions, not the numbers.',
      compareHint: 'Tap the tile to compare with the selected tile.',
      sorting: 'Sorting zone',
      comparisons: 'Comparisons',
      compareAria: 'Compare with your {ordinal} tile, {color}',
    },
    dock: {
      aria: 'Turn actions',
      kicker: 'Your turn · {name}',
      reveal: 'Reveal a tile',
      revealHint: 'Choose a color. The drawn tile will be revealed to everyone.',
      emptySupply: 'The supply is empty. Go straight to the clue.',
      skip: 'Continue without revealing',
      chooseTile: 'Choose a visible tile',
      chooseTileHint: 'Tap a tile on the board. Actions will appear here.',
      selected: 'Selected tile',
      what: 'What do you want to do with this tile?',
      sort: 'Sort',
      sortHint: 'Place it in ascending order.',
      compare: 'Compare',
      compareHint: 'Compare its dots with one of your tiles.',
      change: 'Change',
      chooseClue: 'Choose a clue',
      chooseCompare: 'Choose your tile to compare',
      compareTouch: 'Tap a tile on your stand.',
      result: 'Clue result',
      finish: 'End turn',
      noClue: 'No clue possible: end your turn.',
      fiche: 'My sheet',
    },
    clue: {
      sorted: 'Sorted',
      same: 'Tile {tile} has the same number of dots as your {ordinal} tile ({color}).',
      different: 'Tile {tile} does not have the same number of dots as your {ordinal} tile ({color}).',
      sortedText: 'Tile {tile} goes {position} on your stand.',
    },
    sheet: {
      title: 'My deduction sheet',
      intro: 'Numbers visible on the table are crossed out automatically. Cross out the others as you deduce.',
      draft: 'My 5 numbers (draft)',
      draftNote: 'Borders match the colors of your stand, in ascending order. One guess only, and only on your turn.',
      draftAria: 'Draft, {ordinal} tile, {color}',
      draftTitle: '{ordinal} tile: {color}',
      clear: 'Clear my manual crosses',
      clearNote: 'Automatic crosses cannot be cleared.',
      journal: 'Game log ({count})',
      journalNote: 'Public log. It contains no hidden numbers.',
      noEvents: 'No events.',
      cellAria: '{n}, {color}, {dots} dot{s}{auto}',
      auto: ' — visible, crossed out automatically',
      focusSorted: 'Sorted',
      focusSame: 'Tile {tile} has the same number of dots as your {ordinal} tile.',
      focusDifferent: 'Tile {tile} does not have the same number of dots as your {ordinal} tile.',
    },
    claim: {
      title: 'GOT FIVE!',
      hint: 'Enter your 5 numbers in ascending order. One attempt only.',
      fiche: 'View my sheet',
      cancel: 'Cancel',
      submit: 'Announce',
      invalid: 'Enter 5 distinct numbers in ascending order, between 1 and 60.',
      input: 'Number {n}',
    },
    bot: {
      badge: 'AI',
      thinking: 'The AI is thinking…',
      reveal: 'The AI reveals a tile.',
      skip: 'The AI skips the reveal.',
      chooseTile: 'The AI chooses {tile}.',
      sort: 'The AI asks for a sort.',
      compare: 'The AI asks for a comparison.',
      comparePoints: 'The AI compares dots.',
      end: 'The AI ends its turn.',
      claim: 'The AI calls GOT FIVE!',
      error: 'AI error: {message}',
      support: 'AI stand',
      visible: 'Visible to all',
      note: 'Its turn screen never shows human stands.',
      visibleTiles: 'Visible tiles',
      clues: 'Clues placed by the AI',
      noClues: 'No clues placed.',
      recent: 'Recent events',
      noEvents: 'No events.',
      fineprint: 'Public AI turn screen. No human stand is shown.',
      status: 'AI',
    },
    gameover: {
      eyebrow: 'Game over',
      win: '{name} wins!',
      noWinner: 'No winner',
      claim: 'Successful GOT FIVE! call.',
      lastActive: 'Last player standing.',
      allWrong: 'All players were wrong.',
      numbers: 'Their 5 numbers, in ascending order',
      review: 'View final table',
      replay: 'Play again with the same players',
      newGame: 'New game',
      home: 'Home',
    },
    review: {
      title: 'Final table',
      note: 'All stands are revealed. Compare the calls with the real numbers and the action log.',
      supports: 'Final stands',
      real: 'Real stand',
      correct: 'Correct',
      wrong: 'Incorrect',
      noClaim: 'No call',
      claim: 'Call: {numbers}',
      clues: 'Clues placed',
      noClues: 'No clues placed.',
      public: 'Final public table',
      reserve: 'Supply: {count}',
      noTiles: 'No visible tiles.',
      journal: 'Action log',
      events: '{count} event{s}',
      fineprint: 'Final table and action log are public. The game is over.',
    },
    rules: {
      title: 'Rules',
      goalTitle: 'The goal',
      goal: 'Be the first to identify the 5 hidden numbers on your stand, using the clues revealed during the game.',
      principleTitle: 'The principle',
      principle: 'You can see everyone else’s numbers, but never your own. Each player has 5 tiles, one of each color, arranged in ascending order. You know their colors and positions, not their numbers.',
      turnTitle: 'A turn, two actions',
      reveal: 'Reveal a tile of the color of your choice. Its number is announced and it stays visible.',
      clue: 'Ask for a clue on one of the visible tiles: sort (the app places it in your ascending order) or compare (the app answers Yes or No about equal dots with one of your tiles).',
      sheetTitle: 'The sheet',
      sheet: 'The sheet lists all 60 tiles by color, number and dots. Numbers visible on the table are crossed out automatically; you can cross out the others by hand. If you make a mistake, clear your manual crosses and start again.',
      endTitle: 'Call and end',
      end: 'On your turn, you may call “GOT FIVE!” once: give your 5 numbers in ascending order. If everything is correct, you win. If you are wrong, you are eliminated and the game continues. If everyone else is wrong, the last player standing wins automatically.',
      adaptation: 'Local adaptation: calls can only be made on your turn, the app answers clues instead of a neighbor, and players pass the device.',
      aiTitle: 'Solo mode against the AI',
      ai: 'The AI plays automatically. It never sees its own numbers: it deduces from public information and its own clues. Its turn screen never shows a human stand. Calls remain limited to its turn.',
      privacyTitle: 'Privacy',
      privacy: 'On a single device, each player only looks at the screen during their turn. The others look away. Never say an opponent’s tile numbers aloud: they might hear their own.',
      fineprint: 'Unofficial version, for personal use. Rules inspired by Got Five! by Blue Orange.',
    },
    log: {
      setup: 'Setup complete. {player} starts.',
      reveal: '{player} reveals {tile}.',
      skipEmpty: 'The supply is empty: go straight to the clue.',
      skipNoTiles: 'The supply and visible tiles are exhausted: the turn ends.',
      sort: '{player} sorts {tile}: it goes {position} on {player}’s stand.',
      compare: '{player} compares {tile} with their {ordinal} tile ({color}): {answer}.',
      claimWin: '{player} calls GOT FIVE! and finds their 5 numbers. {player} wins!',
      claimLose: '{player} calls GOT FIVE! but is wrong. {player} is eliminated.',
      lastActive: '{player} is the last player standing and wins.',
      draw: 'All players were wrong. No winner.',
    },
    position: {
      0: 'before the 1st tile',
      1: 'between the 1st and 2nd tiles',
      2: 'between the 2nd and 3rd tiles',
      3: 'between the 3rd and 4th tiles',
      4: 'between the 4th and 5th tiles',
      5: 'after the 5th tile',
    },
    ordinal: { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' },
    color: {
      green: 'Green',
      pink: 'Pink',
      blue: 'Blue',
      red: 'Red',
      orange: 'Orange',
    },
  },
};

let current = 'en';

function lookup(dict, key) {
  return key.split('.').reduce((value, part) => (value == null ? undefined : value[part]), dict);
}

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'fr' || stored === 'en' ? stored : null;
  } catch {
    return null;
  }
}

function detectLanguage() {
  const stored = readStoredLanguage();
  if (stored) return stored;
  const preferred = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const language of preferred) {
    const code = String(language).slice(0, 2).toLowerCase();
    if (code === 'fr' || code === 'en') return code;
  }
  return 'en';
}

export function initLanguage() {
  current = detectLanguage();
  document.documentElement.lang = current;
  return current;
}

export function getLanguage() {
  return current;
}

export function setLanguage(language) {
  if (language !== 'fr' && language !== 'en') return;
  current = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Langue conservée en mémoire si le stockage est indisponible.
  }
  document.documentElement.lang = language;
}

export function hasTranslation(lang, key) {
  return typeof lookup(MESSAGES[lang], key) === 'string';
}

export function t(key, vars = {}) {
  const value =
    lookup(MESSAGES[current], key) ??
    lookup(MESSAGES.en, key) ??
    lookup(MESSAGES.fr, key) ??
    key;
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] === undefined || vars[name] === null ? '' : String(vars[name]),
  );
}

export function colorName(color) {
  return t(`color.${color.id}`);
}

export function ordinal(n) {
  return t(`ordinal.${n}`);
}

export function positionLabel(notch) {
  return t(`position.${notch}`);
}

export function formatLog(entry) {
  if (!entry.key) return entry.text ?? '';
  const vars = { ...(entry.params ?? {}) };
  if (Number.isInteger(vars.colorIndex)) {
    vars.color = colorName(COLORS[vars.colorIndex]);
  }
  if (Number.isInteger(vars.slot)) {
    vars.ordinal = ordinal(vars.slot + 1);
  }
  if (Number.isInteger(vars.notch)) {
    vars.position = positionLabel(vars.notch);
  }
  if (typeof vars.same === 'boolean') {
    vars.answer = vars.same ? t('common.yes') : t('common.no');
  }
  return t(`log.${entry.key}`, vars);
}
