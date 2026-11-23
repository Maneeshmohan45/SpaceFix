import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { Dictionary } from '../extension_firefox/content/engine/dictionary.js';
import { SymSpell } from '../extension_firefox/content/engine/symspell.js';
import { CandidateRanker } from '../extension_firefox/content/engine/ranking.js';
import { CONTRACTIONS_MAP } from '../extension_firefox/content/engine/contractions.js';

test('Firefox QA Audit: Manifest V3 & AMO Compliance', () => {
  const manifestPath = path.resolve('extension_firefox/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'extension_firefox/manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Manifest V3
  assert.equal(manifest.manifest_version, 3, 'Firefox build must be Manifest V3');

  // 2. Gecko settings for Mozilla AMO
  assert.ok(manifest.browser_specific_settings?.gecko, 'browser_specific_settings.gecko must exist');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'spacefix@maneeshmohan.com', 'Gecko ID must match specification');
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '109.0', 'Gecko strict_min_version must be 109.0');

  // 3. Strict Offline Security (Zero network permissions)
  assert.deepEqual(manifest.permissions, ['storage'], 'Must strictly request only storage');
  assert.equal(manifest.host_permissions, undefined, 'Must not request any host permissions');

  // 4. Background scripts array
  assert.ok(Array.isArray(manifest.background?.scripts), 'background.scripts must be an array in Firefox');
  assert.equal(manifest.background.scripts[0], 'background/service_worker.js');
});

test('Firefox QA Audit: Asset & Engine Integrity', () => {
  const dictPath = path.resolve('extension_firefox/assets/dictionary.json');
  const indexPath = fs.existsSync(path.resolve('extension_firefox/assets/symspell_index.bin'))
    ? path.resolve('extension_firefox/assets/symspell_index.bin')
    : path.resolve('extension_firefox/assets/symspell_index.json');

  assert.ok(fs.existsSync(dictPath), 'dictionary.json missing in extension_firefox');
  assert.ok(fs.existsSync(indexPath), 'symspell_index missing in extension_firefox');

  const dictData = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  assert.ok(Object.keys(dictData).length >= 86000, 'Dictionary must contain >= 86k words');
  assert.ok(Object.keys(indexData.deletes).length >= 1400000, 'Deletes must contain >= 1.4M keys');

  // Contractions safety: were and ill must not be present
  assert.equal(CONTRACTIONS_MAP['were'], undefined, 'were must NOT be in contractions map');
  assert.equal(CONTRACTIONS_MAP['ill'], undefined, 'ill must NOT be in contractions map');
  assert.equal(CONTRACTIONS_MAP["i'll"], "I'll", "i'll must expand to I'll");
});

test('Firefox QA Audit: Core Collisions, Names & Sacred Immunity Battery', () => {
  const dictData = JSON.parse(fs.readFileSync('extension_firefox/assets/dictionary.json', 'utf8'));
  const indexPath = fs.existsSync('extension_firefox/assets/symspell_index.bin')
    ? 'extension_firefox/assets/symspell_index.bin'
    : 'extension_firefox/assets/symspell_index.json';
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const dict = new Dictionary(dictData);
  const sym = new SymSpell(indexData.words, indexData.deletes, dictData);
  const ranker = new CandidateRanker();

  const testMatrix = [
    // Typo Collisions (must fix)
    ['peice', 'piece'],
    ['helo', 'hello'],
    ['aple', 'apple'],
    ['wher', 'where'],
    ['som', 'some'],
    ['ocured', 'occurred'],
    ['Teh', 'The'],

    // Proper Names (must protect)
    ['Dan', 'Dan'],
    ['Ben', 'Ben'],
    ['Ron', 'Ron'],
    ['Tim', 'Tim'],
    ['mohan', 'mohan'],
    ['Mohan', 'Mohan'],
    ['charmi', 'charmi'],
    ['sai', 'sai'],
    ['prasad', 'prasad'],
    ['rekha', 'rekha'],

    // Sacred Deities (must protect)
    ['jesus', 'jesus'],
    ['Jesus', 'Jesus'],
    ['allah', 'allah'],
    ['Allah', 'Allah'],
    ['krishna', 'krishna'],
    ['shiva', 'shiva'],

    // Valid common English words (must protect)
    ['were', 'were'],
    ['ill', 'ill']
  ];

  for (const [input, expected] of testMatrix) {
    let result;
    if (dict.has(input)) {
      result = input;
    } else {
      const cands = sym.lookup(input);
      result = ranker.rank(input, cands, dict) || input;
    }
    assert.equal(result, expected, `Firefox Engine: "${input}" must result in "${expected}", got "${result}"`);
  }
});

test('Firefox QA Audit: AMO Zip Archive Validation', () => {
  const zipPath = path.resolve('spacefix-firefox-v1.0.0.zip');
  assert.ok(fs.existsSync(zipPath), 'spacefix-firefox-v1.0.0.zip must exist');

  const stats = fs.statSync(zipPath);
  assert.ok(stats.size > 1000000 && stats.size < 15000000, `Zip size unexpected: ${stats.size}`);

  const output = execSync('tar -tf spacefix-firefox-v1.0.0.zip').toString();
  const entries = output.split('\n').map(s => s.trim()).filter(Boolean);

  assert.ok(entries.includes('manifest.json'), 'Root manifest.json must be present in zip archive');
  assert.ok(entries.includes('assets/dictionary.json'), 'Dictionary asset must be present in zip archive');
  assert.ok(entries.includes('content/content_script.js'), 'Content script must be present in zip archive');
});
