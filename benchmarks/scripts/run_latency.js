/**
 * Stage 3 Benchmark: Detailed Latency Profiler
 * Explicitly separates:
 * 1. Asset initialization / loading time
 * 2. Runtime Candidate Lookup time (SymSpell)
 * 3. Runtime Ranking time (CandidateRanker)
 * 4. Total correction time
 * Reports Mean, p50, p95, and p99 across word lengths.
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Dictionary } from "../../extension/content/engine/dictionary.js";
import { SymSpell } from "../../extension/content/engine/symspell.js";
import { CandidateRanker } from "../../extension/content/engine/ranking.js";

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

export function runLatencyBenchmark() {
  console.log("=" * 70);
  console.log("Stage 3: Comprehensive Latency Profiler");
  console.log("=" * 70);

  // -------------------------------------------------------------
  // PART 1: ASSET INITIALIZATION / LOAD TIME (One-Time Startup)
  // -------------------------------------------------------------
  const t0 = performance.now();
  const dictPath = path.resolve("extension/assets/dictionary.json");
  const indexPath = path.resolve("extension/assets/symspell_index.json");

  const dictData = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
  const tDictLoaded = performance.now();

  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const tIndexLoaded = performance.now();

  const dict = new Dictionary(dictData);
  const sym = new SymSpell(indexData.words, indexData.deletes, dictData);
  const ranker = new CandidateRanker();
  const tEngineReady = performance.now();

  const startupMetrics = {
    dictLoadMs: tDictLoaded - t0,
    indexLoadMs: tIndexLoaded - tDictLoaded,
    engineConstructionMs: tEngineReady - tIndexLoaded,
    totalStartupMs: tEngineReady - t0
  };

  console.log("\n[1] Asset Initialization / Startup Time (One-Time at Browser Start):");
  console.log(`  dictionary.json (1.46MB) read & parse:   ${startupMetrics.dictLoadMs.toFixed(2)} ms`);
  console.log(`  symspell_index.json (13.9MB) read & parse: ${startupMetrics.indexLoadMs.toFixed(2)} ms`);
  console.log(`  In-memory engine initialization:         ${startupMetrics.engineConstructionMs.toFixed(2)} ms`);
  console.log(`  -------------------------------------------------------------`);
  console.log(`  TOTAL ONE-TIME STARTUP DURATION:         ${startupMetrics.totalStartupMs.toFixed(2)} ms`);

  // -------------------------------------------------------------
  // PART 2: RUNTIME PER-WORD CORRECTION LATENCY (Active Typing)
  // -------------------------------------------------------------
  // Test suite containing typos across varying lengths:
  // Short (<=3), Medium (4-7), Long (8-14)
  const testTokens = [
    // Short
    "teh", "ct", "fo", "wrk", "thn", "wht", "plz", "thx",
    // Medium
    "speling", "hllo", "definately", "wrok", "recieved", "foward", "beleive", "untill",
    "freind", "happend", "rember", "goverment", "tuesday", "famly", "peice", "seperate",
    // Long
    "unfortunatly", "accommodation", "embarrassment", "pronounciation", "consistant",
    "enviroment", "conveinient", "responsability", "successfully", "recommandation"
  ];

  // Warm-up JIT compiler
  for (let i = 0; i < 50; i++) {
    const t = testTokens[i % testTokens.length];
    const c = sym.lookup(t);
    ranker.rank(t, c, dict);
  }

  const lookupTimes = [];
  const rankingTimes = [];
  const totalCorrectionTimes = [];

  // Run 1,000 iterations to gather robust statistical distributions
  const ITERATIONS = 1000;
  for (let i = 0; i < ITERATIONS; i++) {
    const token = testTokens[i % testTokens.length];

    // Measure lookup time
    const tLookupStart = performance.now();
    const candidates = sym.lookup(token);
    const tLookupEnd = performance.now();

    // Measure ranking time
    const tRankStart = performance.now();
    const result = ranker.rank(token, candidates, dict);
    const tRankEnd = performance.now();

    const lookupMs = tLookupEnd - tLookupStart;
    const rankMs = tRankEnd - tRankStart;
    const totalMs = tRankEnd - tLookupStart;

    lookupTimes.push(lookupMs);
    rankingTimes.push(rankMs);
    totalCorrectionTimes.push(totalMs);
  }

  // Sort arrays for percentile calculations
  lookupTimes.sort((a, b) => a - b);
  rankingTimes.sort((a, b) => a - b);
  totalCorrectionTimes.sort((a, b) => a - b);

  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const runtimeMetrics = {
    lookup: {
      mean: mean(lookupTimes),
      p50: percentile(lookupTimes, 50),
      p95: percentile(lookupTimes, 95),
      p99: percentile(lookupTimes, 99)
    },
    ranking: {
      mean: mean(rankingTimes),
      p50: percentile(rankingTimes, 50),
      p95: percentile(rankingTimes, 95),
      p99: percentile(rankingTimes, 99)
    },
    total: {
      mean: mean(totalCorrectionTimes),
      p50: percentile(totalCorrectionTimes, 50),
      p95: percentile(totalCorrectionTimes, 95),
      p99: percentile(totalCorrectionTimes, 99)
    }
  };

  console.log("\n[2] Runtime Per-Word Correction Latency (Active Typing - 1,000 runs):");
  console.log(`  CANDIDATE LOOKUP (SymSpell):`);
  console.log(`    Mean: ${runtimeMetrics.lookup.mean.toFixed(3)} ms | p50: ${runtimeMetrics.lookup.p50.toFixed(3)} ms | p95: ${runtimeMetrics.lookup.p95.toFixed(3)} ms | p99: ${runtimeMetrics.lookup.p99.toFixed(3)} ms`);

  console.log(`  CANDIDATE RANKING (CandidateRanker):`);
  console.log(`    Mean: ${runtimeMetrics.ranking.mean.toFixed(3)} ms | p50: ${runtimeMetrics.ranking.p50.toFixed(3)} ms | p95: ${runtimeMetrics.ranking.p95.toFixed(3)} ms | p99: ${runtimeMetrics.ranking.p99.toFixed(3)} ms`);

  console.log(`  -------------------------------------------------------------`);
  console.log(`  TOTAL SPACEBAR TYPING DELAY:`);
  console.log(`    Mean: ${runtimeMetrics.total.mean.toFixed(3)} ms`);
  console.log(`    p50:  ${runtimeMetrics.total.p50.toFixed(3)} ms (Median keystroke impact)`);
  console.log(`    p95:  ${runtimeMetrics.total.p95.toFixed(3)} ms (95% of words complete under this)`);
  console.log(`    p99:  ${runtimeMetrics.total.p99.toFixed(3)} ms (Worst-case long words)`);

  return { startup: startupMetrics, runtime: runtimeMetrics };
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("run_latency.js")) {
  runLatencyBenchmark();
}
