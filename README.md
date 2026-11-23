# Got Five! — local version

Unofficial web version of the deduction game **Got Five!**, playable **offline**, for **2–4 players on a single device**, or **solo 1v1 against a local AI**.

## Play online

**<https://elarif.github.io/stunning-octo-fortnight/>**

The site is published with GitHub Pages through GitHub Actions on every push to `main`. The workflow injects the short commit SHA into `js/version.js` and displays it at the bottom of every screen. The site is installable as a PWA and works offline after the first load.

The app acts as the neighbor who answers clues. Players pass the device around; everyone else looks away. **GOT FIVE!** can only be called during the active player's turn.

The board and the deduction sheet are no longer separate tabs: the sheet stays visible in a side panel on desktop and opens as a drawer on mobile. Visible tiles and opponent stands are grouped in a public table. Actions appear in a contextual dock next to the selected tile, and a clue result highlights the relevant slot, comparison and sheet row. The five draft selectors only offer numbers that are still possible for each color and fill themselves when only one remains. Reveal buttons show how many tiles are left in each color.

In **Solo vs AI**, the AI plays its turns automatically. It is a local solver with no network or LLM: it never sees its own numbers, keeps candidate numbers per color and only calls GOT FIVE! when a unique solution is consistent with its clues. Its turn screen is public and never shows a human stand.

The interface, rules and game log are available in **French, English and Polish**. The browser language is used on first launch, then the choice is remembered. A flag dropdown (FR/EN/PL) is available on every screen.

At the end of the game, **View final table** reveals every stand, each player's call and the full action log so mistakes can be compared.

## Run the game

The service worker and ES modules require an HTTP server (do not open `index.html` by double-clicking):

```bash
# from the project directory
python3 -m http.server 8000
```

Open <http://localhost:8000/>. To install the PWA, use the browser's install button.

## Test the engine

```bash
npm test
```

The tests cover the 60 tiles, setup, clues, calls, eliminations, the last-player rule, the AI decisions and the translation keys for every supported language.

## Project layout

- `index.html` — entry point.
- `styles.css` — responsive interface.
- `js/tiles.js` — the 60 tiles (color, number, dots).
- `js/engine.js` — pure game-rule engine, testable without a browser.
- `js/bot.js` — local AI deduction solver, without access to its own stand.
- `js/i18n.js` — French, English and Polish translations, language detection and localized log.
- `js/app.js` — screens, interactions, AI turns and save handling.
- `js/storage.js` — versioned local save.
- `js/version.js` — build version injected by the Pages workflow.
- `sw.js` + `manifest.webmanifest` + `icons/` — offline support and installation.
- `tests/engine.test.js`, `tests/bot.test.js` and `tests/i18n.test.js` — engine, AI and translation tests.
- `regles-got-five-simplifiees.md` — simplified rules (French).
- `PLAN.md` and `PLAN-IA.md` — HTML and AI implementation plans (French).

## Offline

After the first online load, the app is cached and works without a network. A normal reload in airplane mode works; a forced reload that bypasses the browser cache may fail, which is expected.

When updating files, change `CACHE_NAME` in `sw.js` to force the cache to refresh. The Pages workflow also stamps the cache name with the deployed commit SHA.

## Known limitations

- **Privacy.** On a shared screen, privacy relies on players looking away. The full game state is stored in the browser: a curious player can inspect it with developer tools.
- **Out-of-turn calls.** Deliberately not implemented: a player can call GOT FIVE! only during their turn.
- **AI.** Solo 1v1 is implemented. Mixed human + AI games and 3–4 player games with AI are not offered yet.
- **Network multiplayer.** Not included.
- **Artwork.** No official Blue Orange graphic assets are reused. Unofficial version, for personal use.

## Rules source

Official Blue Orange rules, 2026 edition:
<https://blueorangegames.eu/wp-content/uploads/2026/02/GOT-FIVE_RULES-FR.pdf>
