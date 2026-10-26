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

  return { dict, sym, ranker, orchestrator, inputHandler };
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
  type(text) {
    for (const ch of text) {
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

test("QA2 Regression [BUG-01]: Caret placement past trailing punctuation", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("speling.");
  assert.equal(input.value, "speling.");
  assert.equal(input.selectionStart, 8);

  // Press Spacebar
  const spaceEvt = keyEvt(" ", input);
  orchestrator.handleKeyDown(spaceEvt);

  // Replacement must be "spelling.", and cursor must be at index 9 (after the dot!)
  assert.equal(input.value, "spelling.");
  assert.equal(input.selectionStart, 9, "Cursor must be placed AFTER the period, not before it!");

  // Now simulate the browser's native Spacebar action inserting ' ' at selectionStart
  input.type(" ");
  assert.equal(input.value, "spelling. ", "Resulting text must have space AFTER period!");
});

test("QA2 Regression [BUG-02]: URL domain protection ('https://example.com')", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("Visit https://example.com");
  const spaceEvt = keyEvt(" ", input);
  orchestrator.handleKeyDown(spaceEvt);

  // Must NOT mutate .com into .come
  assert.equal(input.value, "Visit https://example.com");
});

test("QA2 Regression [BUG-06]: Tech and geographic terms preserved", () => {
  const { orchestrator } = getEngine();

  // Test 'bot' stays 'bot'
  const input1 = new MockInput();
  input1.type("discord bot");
  orchestrator.handleKeyDown(keyEvt(" ", input1));
  assert.equal(input1.value, "discord bot", "'bot' must NEVER mutate into 'but'!");

  // Test 'america' stays 'america'
  const input2 = new MockInput();
  input2.type("north america");
  orchestrator.handleKeyDown(keyEvt(" ", input2));
  assert.equal(input2.value, "north america", "'america' must NEVER mutate into 'emerita'!");

  // Test 'india' stays 'india'
  const input3 = new MockInput();
  input3.type("india");
  orchestrator.handleKeyDown(keyEvt(" ", input3));
  assert.equal(input3.value, "india", "'india' must NEVER mutate into 'indie'!");

  // Test 'sudan' stays 'sudan'
  const input4 = new MockInput();
  input4.type("sudan");
  orchestrator.handleKeyDown(keyEvt(" ", input4));
  assert.equal(input4.value, "sudan", "'sudan' must NEVER mutate into 'sedan'!");
});

test("QA2 Regression [LOOP-TRAP]: Rejection memory kills the Backspace <-> Space loop", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  // 1. User types a typo
  input.type("speling");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  input.type(" "); // browser inserts space
  assert.equal(input.value, "spelling ");

  // 2. User presses Backspace to UNDO
  const backspaceEvt = keyEvt("Backspace", input);
  orchestrator.handleKeyDown(backspaceEvt);
  assert.equal(input.value, "speling");

  // 3. User presses Space again -> Rejection memory MUST prevent re-correction!
  orchestrator.handleKeyDown(keyEvt(" ", input));
  input.type(" "); // browser inserts space
  assert.equal(input.value, "speling ", "Word that was actively undone must NEVER be re-corrected in same session!");
});

test("QA2 Regression [BUG-03]: Capitalized proper noun protection", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  // Unlisted proper name 'Rohan'
  input.type("Rohan");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  assert.equal(input.value, "Rohan", "Capitalized unlisted proper noun must NEVER mutate into common noun 'Roman'!");
});

test("QA2 Regression [BUG-05]: Double backspace cursor synchronization", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("speling");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  input.type(" ");
  assert.equal(input.value, "spelling ");

  // First backspace: undo
  orchestrator.handleKeyDown(keyEvt("Backspace", input));
  assert.equal(input.value, "speling");
  assert.equal(input.selectionStart, 7);

  // Second backspace: normal deletion of 'g'
  input.selectionStart--;
  input.value = input.value.slice(0, 6);
  assert.equal(input.value, "spelin");
});

test("QA3 Regression [NEW-01]: Snake_case and compound identifier protection", () => {
  const { orchestrator } = getEngine();

  const input1 = new MockInput();
  input1.type("user_profile_id");
  orchestrator.handleKeyDown(keyEvt(" ", input1));
  assert.equal(input1.value, "user_profile_id", "Identifier with underscore must NEVER be sliced into 'I'd'!");

  const input2 = new MockInput();
  input2.type("order_id");
  orchestrator.handleKeyDown(keyEvt(" ", input2));
  assert.equal(input2.value, "order_id", "order_id must stay order_id!");
});

test("QA3 Regression [NEW-02]: Trailing colon punctuation ('beleive:')", () => {
  const { orchestrator } = getEngine();
  const input = new MockInput();

  input.type("beleive:");
  orchestrator.handleKeyDown(keyEvt(" ", input));
  input.type(" ");

  assert.equal(input.value, "believe: ", "Word before colon must be corrected to 'believe: '!");
});

test("QA3 Regression [NEW-03]: Contractions yall / y'all", () => {
  const { orchestrator } = getEngine();

  const input1 = new MockInput();
  input1.type("yall");
  orchestrator.handleKeyDown(keyEvt(" ", input1));
  assert.equal(input1.value, "y'all");

  const input2 = new MockInput();
  input2.type("y'all");
  orchestrator.handleKeyDown(keyEvt(" ", input2));
  assert.equal(input2.value, "y'all");
});

test("QA3 Regression [NEW-04]: Modern tools & names preserved", () => {
  const { orchestrator } = getEngine();

  const input1 = new MockInput();
  input1.type("redis");
  orchestrator.handleKeyDown(keyEvt(" ", input1));
  assert.equal(input1.value, "redis");

  const input2 = new MockInput();
  input2.type("streamlit");
  orchestrator.handleKeyDown(keyEvt(" ", input2));
  assert.equal(input2.value, "streamlit");

  const input3 = new MockInput();
  input3.type("Mia");
  orchestrator.handleKeyDown(keyEvt(" ", input3));
  assert.equal(input3.value, "Mia");
});
