import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ContentScriptOrchestrator } from "../../extension/content/content_script.js";
import { Dictionary } from "../../extension/content/engine/dictionary.js";
import { SymSpell } from "../../extension/content/engine/symspell.js";
import { CandidateRanker } from "../../extension/content/engine/ranking.js";
import { UndoManager } from "../../extension/content/undo_manager.js";
import { ExclusionsGuard } from "../../extension/content/dom/exclusions.js";
import { StandardInputHandler } from "../../extension/content/dom/input_handler.js";

class MockDomInput {
  constructor(tag = "TEXTAREA", attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  getAttribute(name) {
    return this.attrs[name] || null;
  }

  setRangeText(replacement, start, end, selectMode) {
    this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
    if (selectMode === "end") {
      this.selectionStart = start + replacement.length;
      this.selectionEnd = start + replacement.length;
    }
  }

  dispatchEvent() {}

  // Helper to simulate user typing a character
  typeChar(ch) {
    this.value = this.value.slice(0, this.selectionStart) + ch + this.value.slice(this.selectionEnd);
    this.selectionStart++;
    this.selectionEnd++;
  }
}

function createKeyboardEvent(key, target) {
  let defaultPrevented = false;
  return {
    key,
    target,
    isComposing: false,
    preventDefault: () => { defaultPrevented = true; },
    get defaultPrevented() { return defaultPrevented; }
  };
}

test("DOM Integration: Full End-to-End Spacebar Correction & Undo", () => {
  const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

  const orchestrator = new ContentScriptOrchestrator({
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    undoManager: new UndoManager(),
    exclusions: new ExclusionsGuard(),
    inputHandler: new StandardInputHandler()
  });
  orchestrator.isInitialized = true;

  const input = new MockDomInput("TEXTAREA");

  // 1. Simulate typing "speling"
  for (const ch of "speling") {
    input.typeChar(ch);
  }
  assert.equal(input.value, "speling");
  assert.equal(input.selectionStart, 7);

  // 2. User presses Spacebar
  const spaceEvt = createKeyboardEvent(" ", input);
  orchestrator.handleKeyDown(spaceEvt);

  // Replacement must have occurred immediately
  assert.equal(input.value, "spelling");
  // Cursor must be positioned at end of replacement (index 8)
  assert.equal(input.selectionStart, 8);
  assert.equal(orchestrator.stats.correctionsCount, 1);

  // 3. User presses Backspace immediately -> Must UNDO!
  const backspaceEvt = createKeyboardEvent("Backspace", input);
  orchestrator.handleKeyDown(backspaceEvt);

  assert.equal(backspaceEvt.defaultPrevented, true);
  assert.equal(input.value, "speling");
  assert.equal(input.selectionStart, 7);
  assert.equal(orchestrator.stats.undosCount, 1);
});

test("DOM Integration: Repeated Typing (Multiple words in sequence)", () => {
  const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

  const orchestrator = new ContentScriptOrchestrator({
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    undoManager: new UndoManager(),
    exclusions: new ExclusionsGuard(),
    inputHandler: new StandardInputHandler()
  });
  orchestrator.isInitialized = true;

  const input = new MockDomInput("TEXTAREA");

  // Type: "hey " (valid word)
  for (const ch of "hey") input.typeChar(ch);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", input));
  input.typeChar(" ");
  assert.equal(input.value, "hey ");

  // Type: "teh " (typo -> "the")
  for (const ch of "teh") input.typeChar(ch);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", input));
  input.typeChar(" ");
  assert.equal(input.value, "hey the ");

  // Type: "wrok " (typo -> "work")
  for (const ch of "wrok") input.typeChar(ch);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", input));
  input.typeChar(" ");
  assert.equal(input.value, "hey the work ");

  // Type: "doing " (valid word -> untouched!)
  for (const ch of "doing") input.typeChar(ch);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", input));
  input.typeChar(" ");
  assert.equal(input.value, "hey the work doing ");

  // Final text verification
  assert.equal(input.value, "hey the work doing ");
});

test("DOM Integration: Strict Exclusions (Password & Code fields)", () => {
  const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

  const orchestrator = new ContentScriptOrchestrator({
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    undoManager: new UndoManager(),
    exclusions: new ExclusionsGuard(),
    inputHandler: new StandardInputHandler()
  });
  orchestrator.isInitialized = true;

  // 1. Password input
  const pwdInput = new MockDomInput("INPUT", { type: "password" });
  for (const ch of "speling") pwdInput.typeChar(ch);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", pwdInput));
  assert.equal(pwdInput.value, "speling", "Password input must NEVER be mutated!");

  // 2. spellcheck="false" input
  const noSpellInput = new MockDomInput("TEXTAREA", { spellcheck: "false" });
  for (const ch of "speling") noSpellInput.typeChar(ch);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", noSpellInput));
  assert.equal(noSpellInput.value, "speling", "spellcheck='false' element must NEVER be mutated!");
});

test("DOM Integration: End-to-End Latency Measurement (500 cycles)", () => {
  const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

  const orchestrator = new ContentScriptOrchestrator({
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    undoManager: new UndoManager(),
    exclusions: new ExclusionsGuard(),
    inputHandler: new StandardInputHandler()
  });
  orchestrator.isInitialized = true;

  const testTypos = ["speling", "hllo", "teh", "wrok", "definately", "recieved", "beleive", "foward"];
  const latencies = [];

  for (let i = 0; i < 500; i++) {
    const typo = testTypos[i % testTypos.length];
    const input = new MockDomInput("TEXTAREA");
    for (const ch of typo) input.typeChar(ch);

    const t0 = performance.now();
    orchestrator.handleKeyDown(createKeyboardEvent(" ", input));
    const tTotal = performance.now() - t0;
    latencies.push(tTotal);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  console.log("\n[STAGE 4 DOM BENCHMARK: End-to-End Keydown -> DOM Replacement Latency]");
  console.log(`  Mean: ${mean.toFixed(3)} ms`);
  console.log(`  p50:  ${p50.toFixed(3)} ms`);
  console.log(`  p95:  ${p95.toFixed(3)} ms`);
  console.log(`  p99:  ${p99.toFixed(3)} ms`);

  // Assert p95 is well below 1.0 ms
  assert.ok(p95 < 1.0, `p95 latency (${p95.toFixed(3)} ms) should be under 1.0 ms`);
});

test("DOM Integration: Shadow DOM Piercing (YouTube search box simulation)", () => {
  const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

  const orchestrator = new ContentScriptOrchestrator({
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    undoManager: new UndoManager(),
    exclusions: new ExclusionsGuard(),
    inputHandler: new StandardInputHandler()
  });
  orchestrator.isInitialized = true;

  // Real YouTube input inside shadow root: id="search", spellcheck="false"
  const innerInput = new MockDomInput("INPUT", { id: "search", type: "text", spellcheck: "false" });
  for (const ch of "speling") innerInput.typeChar(ch);

  // Retargeted event: target is <ytd-searchbox>, composedPath() contains [innerInput, ytdSearchbox, ...]
  const ytdHost = { tagName: "YTD-SEARCHBOX" };
  const shadowEvent = {
    key: " ",
    target: ytdHost,
    composedPath: () => [innerInput, ytdHost]
  };

  orchestrator.handleKeyDown(shadowEvent);

  // Must pierce shadow root and correct 'speling' to 'spelling'!
  assert.equal(innerInput.value, "spelling");
  assert.equal(innerInput.selectionStart, 8);
});
