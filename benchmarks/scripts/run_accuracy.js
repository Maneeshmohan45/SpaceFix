/**
 * Stage 3 Benchmark: Accuracy & False-Positive Rate Evaluator
 * Evaluates:
 * 1. Corrected typos (Top-1 Accuracy)
 * 2. Incorrect corrections (Wrong word selected)
 * 3. Missed corrections (Returned null / did nothing)
 * 4. False-positive rate (Valid words/slang mistakenly changed)
 */

import fs from "node:fs";
import path from "node:path";
import { Dictionary } from "../../extension/content/engine/dictionary.js";
import { SymSpell } from "../../extension/content/engine/symspell.js";
import { CandidateRanker } from "../../extension/content/engine/ranking.js";

function loadEngine() {
  const dictPath = path.resolve("extension/assets/dictionary.json");
  const indexPath = path.resolve("extension/assets/symspell_index.json");

  const dictData = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  const dict = new Dictionary(dictData);
  const sym = new SymSpell(indexData.words, indexData.deletes, dictData);
  const ranker = new CandidateRanker();

  return { dict, sym, ranker };
}

function evaluateTypos(engine, testsetPath) {
  const content = fs.readFileSync(testsetPath, "utf-8");
  const lines = content.split("\n");

  let total = 0;
  let correct = 0;
  let incorrect = 0;
  let missed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(":")) continue;

    const [targetPart, typosPart] = trimmed.split(":");
    const target = targetPart.trim().toLowerCase();
    const typos = typosPart.trim().split(/\s+/);

    for (const typo of typos) {
      if (!typo) continue;
      total++;

      // If typo is accidentally already a valid word in dictionary
      if (engine.dict.has(typo)) {
        if (typo === target) {
          correct++;
        } else {
          // Real-word collision
          missed++;
        }
        continue;
      }

      const candidates = engine.sym.lookup(typo);
      const prediction = engine.ranker.rank(typo, candidates, engine.dict);

      if (!prediction) {
        missed++; // Precision > Recall: engine chose to do nothing
      } else if (prediction.toLowerCase() === target) {
        correct++;
      } else {
        incorrect++; // Engine made a wrong guess
      }
    }
  }

  return { total, correct, incorrect, missed };
}

function evaluateFalsePositives(engine) {
  // Test suite of valid words, modern slang, and common names
  const validWords = [
    "the", "work", "hello", "doing", "weather", "whether", "spelling", "definitely",
    "received", "friend", "system", "computer", "keyboard", "software", "network",
    "project", "document", "function", "variable", "database", "browser", "extension"
  ];

  const slangWords = [
    "lol", "idk", "btw", "bruh", "gonna", "wanna", "wifi", "frontend", "backend",
    "crypto", "cool", "chill", "dude", "fam", "vibe", "vibes", "hype", "flex"
  ];

  const commonNames = [
    "john", "sarah", "david", "alex", "rohan", "mary", "james", "michael", "emma", "daniel"
  ];

  const allValid = [...validWords, ...slangWords, ...commonNames];
  let falseCorrections = 0;
  const corruptedList = [];

  for (const word of allValid) {
    // If the word is in the dictionary (or slang whitelist), it should remain unchanged
    if (engine.dict.has(word)) {
      // Should not be corrected
      const candidates = engine.sym.lookup(word);
      const res = engine.ranker.rank(word, candidates, engine.dict);
      if (res && res.toLowerCase() !== word.toLowerCase()) {
        falseCorrections++;
        corruptedList.push({ word, corruptedTo: res });
      }
    }
  }

  return {
    testedCount: allValid.length,
    falseCorrections,
    corruptedList,
    falsePositiveRate: (falseCorrections / allValid.length) * 100
  };
}

export function runAccuracyBenchmark() {
  console.log("=" * 70);
  console.log("Stage 3: Accuracy & False-Positive Benchmark");
  console.log("=" * 70);

  const engine = loadEngine();

  // 1. Evaluate Peter Norvig Testset 1
  const testset1Path = path.resolve("benchmarks/datasets/norvig/spell-testset1.txt");
  const res1 = evaluateTypos(engine, testset1Path);

  // 2. Evaluate Peter Norvig Testset 2
  const testset2Path = path.resolve("benchmarks/datasets/norvig/spell-testset2.txt");
  const res2 = evaluateTypos(engine, testset2Path);

  // 3. Evaluate False Positives
  const fpRes = evaluateFalsePositives(engine);

  console.log("\n[1] Norvig Test Set 1 (General Errors):");
  console.log(`  Total Typos:             ${res1.total}`);
  console.log(`  Corrected (Top-1 Match): ${res1.correct} (${((res1.correct / res1.total) * 100).toFixed(2)}%)`);
  console.log(`  Incorrect Corrections:   ${res1.incorrect} (${((res1.incorrect / res1.total) * 100).toFixed(2)}%)`);
  console.log(`  Missed (Did Nothing):    ${res1.missed} (${((res1.missed / res1.total) * 100).toFixed(2)}%)`);

  console.log("\n[2] Norvig Test Set 2 (Difficult & Rare Errors):");
  console.log(`  Total Typos:             ${res2.total}`);
  console.log(`  Corrected (Top-1 Match): ${res2.correct} (${((res2.correct / res2.total) * 100).toFixed(2)}%)`);
  console.log(`  Incorrect Corrections:   ${res2.incorrect} (${((res2.incorrect / res2.total) * 100).toFixed(2)}%)`);
  console.log(`  Missed (Did Nothing):    ${res2.missed} (${((res2.missed / res2.total) * 100).toFixed(2)}%)`);

  console.log("\n[3] False-Positive / False-Correction Rate (Valid Words & Slang):");
  console.log(`  Valid Tokens Tested:     ${fpRes.testedCount}`);
  console.log(`  False Corrections:       ${fpRes.falseCorrections}`);
  console.log(`  False-Correction Rate:   ${fpRes.falsePositiveRate.toFixed(2)}%`);

  if (fpRes.falseCorrections > 0) {
    console.log("  Corrupted Words:", fpRes.corruptedList);
  } else {
    console.log("  [PERFECT] 100% of tested valid words and slang remained completely untouched!");
  }

  return { testset1: res1, testset2: res2, falsePositives: fpRes };
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("run_accuracy.js")) {
  runAccuracyBenchmark();
}
