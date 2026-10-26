import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Dictionary } from "../../extension/content/engine/dictionary.js";
import { SymSpell } from "../../extension/content/engine/symspell.js";
import { CandidateRanker } from "../../extension/content/engine/ranking.js";

test("Integration: End-to-end correction with real 85k assets", () => {
  const dictPath = path.resolve("extension/assets/dictionary.json");
  const indexPath = path.resolve("extension/assets/symspell_index.json");

  assert.ok(fs.existsSync(dictPath), "dictionary.json must exist");
  assert.ok(fs.existsSync(indexPath), "symspell_index.json must exist");

  const dictData = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  const dict = new Dictionary(dictData);
  const sym = new SymSpell(indexData.words, indexData.deletes, dictData);
  const ranker = new CandidateRanker();

  const correctWord = (typo) => {
    if (dict.has(typo)) return typo;
    const candidates = sym.lookup(typo);
    const best = ranker.rank(typo, candidates, dict);
    return best || typo;
  };

  // Test classic typos
  assert.equal(correctWord("speling"), "spelling");
  assert.equal(correctWord("Speling"), "Spelling");
  assert.equal(correctWord("hllo"), "hello");
  assert.equal(correctWord("teh"), "the");
  assert.equal(correctWord("wrok"), "work");
  assert.equal(correctWord("definately"), "definitely");

  // Test that valid words are untouched
  assert.equal(correctWord("doing"), "doing");
  assert.equal(correctWord("ding"), "ding");
  assert.equal(correctWord("work"), "work");
  assert.equal(correctWord("the"), "the");

  // Test modern slang is untouched
  assert.equal(correctWord("lol"), "lol");
  assert.equal(correctWord("idk"), "idk");
  assert.equal(correctWord("bruh"), "bruh");
  assert.equal(correctWord("wifi"), "wifi");
});
