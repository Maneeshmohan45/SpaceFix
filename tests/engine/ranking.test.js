import test from "node:test";
import assert from "node:assert/strict";
import { CandidateRanker } from "../../extension/content/engine/ranking.js";
import { Dictionary } from "../../extension/content/engine/dictionary.js";

test("CandidateRanker: Distance-1 always beats Distance-2", () => {
  const ranker = new CandidateRanker();
  const dict = new Dictionary();

  const candidates = [
    { word: "doing", distance: 2, frequency: 100000000, wordId: 0 },
    { word: "ring", distance: 1, frequency: 500000, wordId: 100 }
  ];

  // Even though 'doing' has 200x frequency, 'ring' is Distance-1 and MUST win!
  const result = ranker.rank("ding", candidates, dict);
  assert.equal(result, "ring");
});

test("CandidateRanker: Frequency ordering within same distance", () => {
  const ranker = new CandidateRanker();
  const dict = new Dictionary();

  const candidates = [
    { word: "halo", distance: 1, frequency: 500000, wordId: 200 },
    { word: "hello", distance: 1, frequency: 50000000, wordId: 10 }
  ];

  const result = ranker.rank("hllo", candidates, dict);
  assert.equal(result, "hello");
});

test("CandidateRanker: Case restoration preserved", () => {
  const ranker = new CandidateRanker();
  const dict = new Dictionary();

  const candidates = [
    { word: "spelling", distance: 1, frequency: 5000000, wordId: 50 }
  ];

  assert.equal(ranker.rank("Speling", candidates, dict), "Spelling");
  assert.equal(ranker.rank("SPELING", candidates, dict), "SPELLING");
  assert.equal(ranker.rank("speling", candidates, dict), "spelling");
});

test("CandidateRanker: Ambiguity rejection on Distance-2 (Precision > Recall)", () => {
  const ranker = new CandidateRanker({
    minDistance2FrequencyRatio: 3.0,
    minDistance2FrequencyFloor: 50000
  });
  const dict = new Dictionary();

  // Two distance-2 candidates with nearly identical frequency (ratio = 1.05 < 3.0)
  const ambiguousCandidates = [
    { word: "crate", distance: 2, frequency: 105000, wordId: 500 },
    { word: "crane", distance: 2, frequency: 100000, wordId: 510 }
  ];

  // Must reject and return null!
  const result = ranker.rank("craze", ambiguousCandidates, dict);
  assert.equal(result, null);
});
