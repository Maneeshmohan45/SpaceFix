import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Dictionary } from "../extension/content/engine/dictionary.js";
import { SymSpell } from "../extension/content/engine/symspell.js";
import { CandidateRanker } from "../extension/content/engine/ranking.js";
import { CONTRACTIONS_MAP } from "../extension/content/engine/contractions.js";
import { UndoManager } from "../extension/content/undo_manager.js";
import { ExclusionsGuard } from "../extension/content/dom/exclusions.js";
import { StandardInputHandler } from "../extension/content/dom/input_handler.js";
import { ContentScriptOrchestrator } from "../extension/content/content_script.js";

function getEngine() {
  const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

  const dict = new Dictionary(dictData);
  const sym = new SymSpell(indexData.words, indexData.deletes, dictData);
  const ranker = new CandidateRanker();
  const undoManager = new UndoManager();
  const exclusions = new ExclusionsGuard();
  const inputHandler = new StandardInputHandler();

  const orchestrator = new ContentScriptOrchestrator({
    dictionary: dict,
    symspell: sym,
    ranker: ranker,
    undoManager: undoManager,
    exclusions: exclusions,
    inputHandler: inputHandler,
    contractionsMap: CONTRACTIONS_MAP
  });
  orchestrator.isInitialized = true;

  return { dict, sym, ranker, orchestrator };
}

class MockInput {
  constructor(val = "", cursor = 0) {
    this.tagName = "TEXTAREA";
    this.value = val;
    this.selectionStart = cursor;
    this.selectionEnd = cursor;
  }
  getAttribute() { return null; }
  setRangeText(replacement, start, end, selectMode) {
    this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
    if (selectMode === "end") {
      this.selectionStart = start + replacement.length;
      this.selectionEnd = start + replacement.length;
    }
  }
  dispatchEvent() {}
  type(str) {
    for (const ch of str) {
      this.value = this.value.slice(0, this.selectionStart) + ch + this.value.slice(this.selectionEnd);
      this.selectionStart++;
      this.selectionEnd++;
    }
  }
}

function keyEvt(key, target) {
  let defaultPrevented = false;
  return {
    key,
    target,
    isComposing: false,
    preventDefault: () => { defaultPrevented = true; },
    get defaultPrevented() { return defaultPrevented; }
  };
}

test("QA Fix [CRIT-02]: Distance-2 omissions found by hybrid index", () => {
  const { sym, ranker, dict } = getEngine();

  const testWord = (typo) => {
    const cands = sym.lookup(typo);
    return ranker.rank(typo, cands, dict);
  };

  assert.equal(testWord("acomodate"), "accommodate");
  assert.equal(testWord("necesry"), "necessary");
  
  // Verify that Distance-2 candidates like 'embarrass' for 'embaras' are found in lookup
  const embarasCands = sym.lookup("embaras");
  assert.ok(embarasCands.some(c => c.word === "embarrass"), "sym.lookup('embaras') must find 'embarrass'");
});

test("QA Fix [CRIT-04]: Contractions direct expansion ('dont', 'im', 'ive', 'cant')", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  // Test 'dont' -> "don't"
  input.type("dont");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  assert.equal(input.value, "don't");

  // Test 'im' -> "I'm"
  const input2 = new MockInput();
  input2.type("im");
  orchestrator.handleKeyDown(keyEvt(" ", input2));
  assert.equal(input2.value, "I'm");

  // Test 'ive' -> "I've"
  const input3 = new MockInput();
  input3.type("ive");
  orchestrator.handleKeyDown(keyEvt(" ", input3));
  assert.equal(input3.value, "I've");
});

test("QA Fix [HIGH-01]: Trailing space atomically removed on Backspace undo", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("speling");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  // Browser default spacebar action appends space
  input.type(" ");

  assert.equal(input.value, "spelling ");
  assert.equal(input.selectionStart, 9);

  // User hits Backspace immediately
  const bsEvt = keyEvt("Backspace", input);
  orchestrator.handleKeyDown(bsEvt);

  assert.equal(bsEvt.defaultPrevented, true);
  // Both the word AND the trailing space must be reverted!
  assert.equal(input.value, "speling");
  assert.equal(input.selectionStart, 7);
});

test("QA Fix [HIGH-04]: Punctuation at sentence boundaries", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("This was bad speling.");
  orchestrator.handleKeyDown(keyEvt(" ", input));

  // Word replaced while preserving the period!
  assert.equal(input.value, "This was bad spelling.");
});

test("QA Fix [HIGH-05]: First-letter preservation bonus", () => {
  const { sym, ranker, dict } = getEngine();

  // 'bll' should NOT become 'all'
  const candsBll = sym.lookup("bll");
  const resBll = ranker.rank("bll", candsBll, dict);
  assert.notEqual(resBll, "all");

  // 'cme' should NOT become 'me'
  const candsCme = sym.lookup("cme");
  const resCme = ranker.rank("cme", candsCme, dict);
  assert.notEqual(resCme, "me");
});

test("QA Fix [HIGH-02]: All-caps misspellings allowed and case restored", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("SPELING");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  assert.equal(input.value, "SPELLING");
});

test("QA Fix [LOW-02]: Modifier keys do NOT clear undo buffer", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("speling");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  input.type(" ");
  assert.equal(input.value, "spelling ");

  // User taps Shift (e.g. preparing to capitalize next letter)
  orchestrator.handleKeyDown(keyEvt("Shift", input));

  // User hits Backspace -> Undo must STILL WORK!
  const bsEvt = keyEvt("Backspace", input);
  orchestrator.handleKeyDown(bsEvt);

  assert.equal(bsEvt.defaultPrevented, true);
  assert.equal(input.value, "speling");
});
