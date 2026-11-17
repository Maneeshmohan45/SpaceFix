import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ContentScriptOrchestrator } from '../extension/content/content_script.js';
import { CONTRACTIONS_MAP } from '../extension/content/engine/contractions.js';
import { Dictionary } from '../extension/content/engine/dictionary.js';
import { SymSpell } from '../extension/content/engine/symspell.js';
import { CandidateRanker } from '../extension/content/engine/ranking.js';
import { StandardInputHandler } from '../extension/content/dom/input_handler.js';
import { ExclusionsGuard } from '../extension/content/dom/exclusions.js';
import { UndoManager } from '../extension/content/undo_manager.js';

const dictData = JSON.parse(fs.readFileSync('./extension/assets/dictionary.json', 'utf8'));
const indexData = JSON.parse(fs.readFileSync('./extension/assets/symspell_index.json', 'utf8'));

function createHarness() {
  const orchestrator = new ContentScriptOrchestrator({
    contractionsMap: CONTRACTIONS_MAP,
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    inputHandler: new StandardInputHandler(),
    exclusions: new ExclusionsGuard(),
    undoManager: new UndoManager()
  });
  orchestrator.isInitialized = true;
  return orchestrator;
}

class MockInput {
  constructor(text) {
    this.tagName = 'INPUT';
    this.type = 'text';
    this.value = text;
    this.selectionStart = text.length;
    this.selectionEnd = text.length;
  }
  getAttribute(name) {
    if (name === 'type') return 'text';
    return null;
  }
  setRangeText(repl, start, end, mode) {
    this.value = this.value.slice(0, start) + repl + this.value.slice(end);
    this.selectionStart = start + repl.length;
    this.selectionEnd = start + repl.length;
  }
  dispatchEvent() {}
}

function typeToken(orchestrator, text) {
  const el = new MockInput(text);
  let prevented = false;
  orchestrator.handleKeyDown({
    key: ' ',
    target: el,
    preventDefault() { prevented = true; }
  });
  return el.value;
}

describe('SpaceFix V1 Unified Test Suite', () => {

  test('Target Collisions Suite (Weighted Damerau-Levenshtein)', () => {
    const orchestrator = createHarness();
    const collisions = [
      ['peice', 'piece'],
      ['helo', 'hello'],
      ['aple', 'apple'],
      ['wher', 'where'],
      ['leter', 'letter'],
      ['stoped', 'stopped'],
      ['ther', 'there'],
      ['som', 'some'],
      ['ocured', 'occurred'],
      ['basicly', 'basically']
    ];

    for (const [input, expected] of collisions) {
      const res = typeToken(orchestrator, input);
      assert.equal(res, expected, `Typo "${input}" must correct to "${expected}", got "${res}"`);
    }
  });

  test('Standard Misspellings Suite', () => {
    const orchestrator = createHarness();
    const standard = [
      ['thier', 'their'],
      ['definately', 'definitely'],
      ['speling', 'spelling'],
      ['teh', 'the'],
      ['wrok', 'work'],
      ['wierd', 'weird'],
      ['beleive', 'believe'],
      ['enviroment', 'environment'],
      ['tommorrow', 'tomorrow']
    ];

    for (const [input, expected] of standard) {
      const res = typeToken(orchestrator, input);
      assert.equal(res, expected, `Typo "${input}" must correct to "${expected}", got "${res}"`);
    }
  });

  test('2-Letter Slang & Abbreviation Shield (Guard 2)', () => {
    const orchestrator = createHarness();
    const shortTokens = ['wp', 'gg', 'rn', 'id', 'ts', 'pr', 'db', 'np'];

    for (const token of shortTokens) {
      const res = typeToken(orchestrator, token);
      assert.equal(res, token, `2-letter token "${token}" must NEVER be auto-corrected, got "${res}"`);
    }
  });

  test('Proper Noun & Country Protection (Guard 1)', () => {
    const orchestrator = createHarness();
    const properNouns = ['Maya', 'Peru', 'Vikram', 'Sneha', 'Ananya', 'Meera', 'Karthik', 'Daniel'];

    for (const name of properNouns) {
      const res = typeToken(orchestrator, name);
      assert.equal(res, name, `Proper noun "${name}" must remain untouched, got "${res}"`);
    }
  });

  test('All-Caps Case Restoration', () => {
    const orchestrator = createHarness();
    const allCaps = [
      ['PEICE', 'PIECE'],
      ['TEH', 'THE'],
      ['SPELING', 'SPELLING']
    ];

    for (const [input, expected] of allCaps) {
      const res = typeToken(orchestrator, input);
      assert.equal(res, expected, `All-caps "${input}" must restore to "${expected}", got "${res}"`);
    }
  });

  test('Contractions Expansion (Non-Word Forms)', () => {
    const orchestrator = createHarness();
    const contractions = [
      ['dont', "don't"],
      ['cant', "can't"],
      ['wont', "won't"],
      ['im', "I'm"],
      ['ive', "I've"],
      ['didnt', "didn't"],
      ['isnt', "isn't"],
      ['yall', "y'all"]
    ];

    for (const [input, expected] of contractions) {
      const res = typeToken(orchestrator, input);
      assert.equal(res, expected, `Contraction typo "${input}" must expand to "${expected}", got "${res}"`);
    }
  });

  test('Valid Common Words Safety: "were" and "ill" must NOT mutate', () => {
    const orchestrator = createHarness();
    const resWere = typeToken(orchestrator, 'were');
    assert.equal(resWere, 'were', 'Valid word "were" must NOT mutate to "we\'re"');

    const resIll = typeToken(orchestrator, 'ill');
    assert.equal(resIll, 'ill', 'Valid word "ill" must NOT mutate to "I\'ll"');
  });

  test('Trailing Punctuation Preservation', () => {
    const orchestrator = createHarness();
    const res1 = typeToken(orchestrator, 'peice.');
    assert.equal(res1, 'piece.', `Trailing period must be preserved, got "${res1}"`);

    const res2 = typeToken(orchestrator, 'helo!');
    assert.equal(res2, 'hello!', `Trailing exclamation must be preserved, got "${res2}"`);
  });

  test('Atomic Backspace Undo & Rejection Memory', () => {
    const orchestrator = createHarness();
    const el = new MockInput('peice');
    orchestrator.handleKeyDown({ key: ' ', target: el, preventDefault() {} });
    assert.equal(el.value, 'piece');

    // Simulate immediate Backspace
    let backspacePrevented = false;
    orchestrator.handleKeyDown({
      key: 'Backspace',
      target: el,
      preventDefault() { backspacePrevented = true; }
    });
    assert.equal(el.value, 'peice', 'Backspace must revert correction atomically');
    assert.ok(backspacePrevented, 'Backspace event must be preventDefaulted on undo');

    // Hit Space again: Rejection memory must prevent infinite loop!
    orchestrator.handleKeyDown({ key: ' ', target: el, preventDefault() {} });
    assert.equal(el.value, 'peice', 'Rejection memory must prevent re-correcting an undone word');
  });
});
