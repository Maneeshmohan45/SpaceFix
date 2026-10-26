import test from "node:test";
import assert from "node:assert/strict";
import { SymSpell } from "../../extension/content/engine/symspell.js";

test("SymSpell: Damerau-Levenshtein distance", () => {
  const sym = new SymSpell();

  // Equal
  assert.equal(sym.damerauLevenshtein("hello", "hello", 2), 0);

  // 1 deletion / insertion
  assert.equal(sym.damerauLevenshtein("speling", "spelling", 2), 1);
  assert.equal(sym.damerauLevenshtein("hllo", "hello", 2), 1);

  // 1 substitution
  assert.equal(sym.damerauLevenshtein("wprk", "work", 2), 1);

  // 1 transposition
  assert.equal(sym.damerauLevenshtein("teh", "the", 2), 1);

  // 2 edits
  assert.equal(sym.damerauLevenshtein("helo", "hello", 2), 1);
  assert.equal(sym.damerauLevenshtein("caat", "cut", 2), 2);

  // Greater than maxDistance early exit
  assert.equal(sym.damerauLevenshtein("cat", "elephant", 2), 3);
});

test("SymSpell: Length-dependent distance limits", () => {
  const words = ["the", "cat", "dog", "hello", "spelling"];
  const deletes = {
    "th": [0],
    "he": [0],
    "ca": [1],
    "at": [1],
    "ct": [1],
    "hllo": [3],
    "speling": [4]
  };

  const sym = new SymSpell(words, deletes, {
    "the": 1000000,
    "cat": 500000,
    "dog": 400000,
    "hello": 800000,
    "spelling": 200000
  });

  // Short word (length <= 3): only distance 1 permitted
  // "teh" -> "the" (distance 1 transposition)
  const candsTeh = sym.lookup("teh");
  const theMatch = candsTeh.find(c => c.word === "the");
  assert.ok(theMatch, "Should find 'the' for 'teh'");
  assert.equal(theMatch.distance, 1);

  // "ct" -> "cat" (distance 1)
  const candsCt = sym.lookup("ct");
  assert.ok(candsCt.find(c => c.word === "cat"));

  // Longer word: "speling" -> "spelling" (distance 1)
  const candsSpeling = sym.lookup("speling");
  assert.ok(candsSpeling.find(c => c.word === "spelling"));
});
