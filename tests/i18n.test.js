import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { LANGUAGES, hasTranslation } from '../js/i18n.js';

function usedKeys() {
  const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const keys = new Set(
    [...source.matchAll(/(?<![A-Za-z0-9_$])t\('([^']+)'/g)].map((match) => match[1]),
  );

  for (const screen of ['home', 'setup', 'pass', 'notes', 'turn', 'bot', 'gameover', 'review', 'rules', 'tutorial']) {
    keys.add(`titles.${screen}`);
  }
  for (const code of LANGUAGES) keys.add(`language.${code}`);
  for (const id of ['green', 'pink', 'blue', 'red', 'orange']) keys.add(`color.${id}`);
  for (const n of [1, 2, 3, 4, 5]) keys.add(`ordinal.${n}`);
  for (const n of [0, 1, 2, 3, 4, 5]) keys.add(`position.${n}`);
  for (const key of [
    'setup',
    'reveal',
    'skipEmpty',
    'skipNoTiles',
    'sort',
    'compare',
    'claimWin',
    'claimLose',
    'lastActive',
    'draw',
  ]) {
    keys.add(`log.${key}`);
  }
  for (const key of [
    'visible',
    'sortLower',
    'sortHigher',
    'compareSame',
    'compareDifferent',
    'orderBefore',
    'orderAfter',
    'incompatible',
  ]) {
    keys.add(`deduction.${key}`);
  }

  return keys;
}

test('every supported language covers the keys used by the interface', () => {
  const keys = usedKeys();
  assert.ok(keys.size > 100, 'the interface should expose a substantial key set');

  for (const language of LANGUAGES) {
    const missing = [...keys].filter((key) => !hasTranslation(language, key));
    assert.deepEqual(missing, [], `${language} is missing translations`);
  }
});
