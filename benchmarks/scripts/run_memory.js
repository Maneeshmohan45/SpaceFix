/**
 * Stage 3 Benchmark: V8 Heap Memory Profiler
 * Accurately measures the actual resident V8 heap allocation of the engine in RAM.
 */

import fs from "node:fs";
import path from "node:path";
import { Dictionary } from "../../extension/content/engine/dictionary.js";
import { SymSpell } from "../../extension/content/engine/symspell.js";
import { CandidateRanker } from "../../extension/content/engine/ranking.js";

function getHeapMb() {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

export function runMemoryBenchmark() {
  console.log("=" * 70);
  console.log("Stage 3: V8 Heap Memory Allocation Profiler");
  console.log("=" * 70);

  // Trigger GC if available or record initial baseline
  const baselineHeap = getHeapMb();

  const dictPath = path.resolve("extension/assets/dictionary.json");
  const indexPath = path.resolve("extension/assets/symspell_index.json");

  // Step 1: Read and parse dictionary
  const dictData = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
  const afterDictJson = getHeapMb();

  // Step 2: Read and parse symspell index
  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const afterIndexJson = getHeapMb();

  // Step 3: Instantiate Engine classes (Maps, Sets, Class wrappers)
  const dict = new Dictionary(dictData);
  const sym = new SymSpell(indexData.words, indexData.deletes, dictData);
  const ranker = new CandidateRanker();
  const afterEngineInit = getHeapMb();

  const metrics = {
    baselineHeapMb: baselineHeap,
    afterDictJsonMb: afterDictJson,
    dictDeltaMb: afterDictJson - baselineHeap,
    afterIndexJsonMb: afterIndexJson,
    indexDeltaMb: afterIndexJson - afterDictJson,
    afterEngineInitMb: afterEngineInit,
    engineDeltaMb: afterEngineInit - afterIndexJson,
    totalNetHeapUsedMb: afterEngineInit - baselineHeap
  };

  console.log("\n[1] Physical File Sizes on Disk:");
  console.log(`  dictionary.json:         ${(fs.statSync(dictPath).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  symspell_index.json:     ${(fs.statSync(indexPath).size / (1024 * 1024)).toFixed(2)} MB`);

  console.log("\n[2] Real V8 Heap Memory Allocation:");
  console.log(`  Initial V8 Heap Baseline: ${metrics.baselineHeapMb.toFixed(2)} MB`);
  console.log(`  + dictionary.json JSON:   +${metrics.dictDeltaMb.toFixed(2)} MB (Subtotal: ${metrics.afterDictJsonMb.toFixed(2)} MB)`);
  console.log(`  + symspell_index.json:    +${metrics.indexDeltaMb.toFixed(2)} MB (Subtotal: ${metrics.afterIndexJsonMb.toFixed(2)} MB)`);
  console.log(`  + Engine In-Memory Maps:  +${metrics.engineDeltaMb.toFixed(2)} MB (Final Heap: ${metrics.afterEngineInitMb.toFixed(2)} MB)`);
  console.log(`  -------------------------------------------------------------`);
  console.log(`  TOTAL RESIDENT V8 HEAP EXPANSION: ${metrics.totalNetHeapUsedMb.toFixed(2)} MB`);

  return metrics;
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("run_memory.js")) {
  runMemoryBenchmark();
}
