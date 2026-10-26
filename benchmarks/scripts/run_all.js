/**
 * Master Benchmark Runner
 * Runs Accuracy, Latency, and Memory benchmarks, then outputs baseline_scorecard.json
 */

import fs from "node:fs";
import path from "node:path";
import { runAccuracyBenchmark } from "./run_accuracy.js";
import { runLatencyBenchmark } from "./run_latency.js";
import { runMemoryBenchmark } from "./run_memory.js";

console.log("#################################################################");
console.log("                SPACEFIX V1: FULL STAGE 3 BENCHMARK              ");
console.log("#################################################################\n");

const accuracyResults = runAccuracyBenchmark();
console.log("\n" + "-".repeat(65) + "\n");

const latencyResults = runLatencyBenchmark();
console.log("\n" + "-".repeat(65) + "\n");

const memoryResults = runMemoryBenchmark();
console.log("\n" + "-".repeat(65) + "\n");

const scorecard = {
  timestamp: new Date().toISOString(),
  engine: "SymSpell V1 (JavaScript V8)",
  dataset_evaluated: "Peter Norvig spell-testset1 & spell-testset2",
  accuracy: accuracyResults,
  latency: latencyResults,
  memory: memoryResults
};

const resultsDir = path.resolve("benchmarks/results");
fs.mkdirSync(resultsDir, { recursive: true });
const scorecardPath = path.join(resultsDir, "baseline_scorecard.json");
fs.writeFileSync(scorecardPath, JSON.stringify(scorecard, null, 2), "utf-8");

console.log("=================================================================");
console.log(`FULL SCORECARD SAVED TO: ${scorecardPath}`);
console.log("=================================================================");
