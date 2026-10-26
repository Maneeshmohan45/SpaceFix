/**
 * SpaceFix V1 - SymSpell Engine Module
 * High-speed in-memory candidate generation using Symmetric Delete algorithm
 * and length-dependent maximum edit distance constraints.
 */

class SymSpell {
  /**
   * @param {string[]} words - Pre-sorted word list (index = wordId, 0 = highest frequency)
   * @param {Object<string, number[]>} deletes - Map of deletion keys to list of word IDs
   * @param {Object<string, number>} [wordFreqMap] - Optional frequency lookup map
   */
  constructor(words = [], deletes = {}, wordFreqMap = {}) {
    this.words = words;
    this.deletes = deletes;
    this.freqs = wordFreqMap;

    // Fast word-to-ID lookup
    this.wordToId = new Map();
    for (let i = 0; i < words.length; i++) {
      this.wordToId.set(words[i], i);
    }
  }

  /**
   * Calculates Damerau-Levenshtein distance (optimal string alignment)
   * with early exit if length difference exceeds maxDistance.
   * @param {string} s1
   * @param {string} s2
   * @param {number} maxDistance
   * @returns {number}
   */
  damerauLevenshtein(s1, s2, maxDistance = 2) {
    const len1 = s1.length;
    const len2 = s2.length;

    if (Math.abs(len1 - len2) > maxDistance) {
      return maxDistance + 1;
    }

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // 2-row / matrix distance calculation
    const d = [];
    for (let i = 0; i <= len1; i++) {
      d[i] = new Array(len2 + 1).fill(0);
      d[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      d[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // deletion
          d[i][j - 1] + 1,      // insertion
          d[i - 1][j - 1] + cost // substitution
        );

        // Transposition
        if (
          i > 1 &&
          j > 1 &&
          s1[i - 1] === s2[j - 2] &&
          s1[i - 2] === s2[j - 1]
        ) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
        }
      }
    }

    return d[len1][len2];
  }

  /**
   * Generates candidate corrections for a typo using length-dependent edit distance.
   * Rules:
   *   Length <= 3: max edit distance = 1
   *   Length >= 4: max edit distance = 2
   *
   * @param {string} typo - The misspelled word token
   * @returns {Array<{ word: string, distance: number, frequency: number, wordId: number }>}
   */
  lookup(typo) {
    if (!typo) return [];
    const input = typo.toLowerCase();

    // 1. Exact match check
    if (this.wordToId.has(input)) {
      const wid = this.wordToId.get(input);
      return [{
        word: input,
        distance: 0,
        frequency: this.freqs[input] || 1,
        wordId: wid
      }];
    }

    // Dynamic length-dependent edit distance:
    // Length <= 3 -> max distance 1; Length >= 4 -> max distance 2
    const maxDistance = input.length <= 3 ? 1 : 2;
    const candidatesMap = new Map(); // wordId -> minDistance

    const checkCandidate = (wordId, estimatedDistance) => {
      const candidateWord = this.words[wordId];
      if (!candidateWord) return;

      // Skip words with length delta greater than maxDistance
      if (Math.abs(candidateWord.length - input.length) > maxDistance) {
        return;
      }

      // Compute exact Damerau-Levenshtein distance
      const exactDistance = this.damerauLevenshtein(input, candidateWord, maxDistance);
      if (exactDistance <= maxDistance) {
        const existing = candidatesMap.get(wordId);
        if (existing === undefined || exactDistance < existing) {
          candidatesMap.set(wordId, exactDistance);
        }
      }
    };

    // 2. Direct match with dictionary deletions (covers deletions from dictionary words)
    const directDeletes = this.deletes[input];
    if (directDeletes) {
      for (let i = 0; i < directDeletes.length; i++) {
        checkCandidate(directDeletes[i], 1);
      }
    }

    // 3. Generate 1-letter deletions of the typo
    const d1Set = new Set();
    for (let i = 0; i < input.length; i++) {
      const d1 = input.slice(0, i) + input.slice(i + 1);
      if (!d1) continue;
      d1Set.add(d1);

      // Check if deletion is itself a valid word (distance 1: insertion in typo)
      if (this.wordToId.has(d1)) {
        checkCandidate(this.wordToId.get(d1), 1);
      }

      // Check if deletion matches dictionary deletions (distance 1 or 2: substitution/transposition)
      const matchingIds = this.deletes[d1];
      if (matchingIds) {
        for (let k = 0; k < matchingIds.length; k++) {
          checkCandidate(matchingIds[k], 2);
        }
      }
    }

    // 4. Generate 2-letter deletions of the typo (only if length >= 4)
    if (maxDistance >= 2) {
      for (const d1 of d1Set) {
        if (d1.length <= 1) continue;
        for (let i = 0; i < d1.length; i++) {
          const d2 = d1.slice(0, i) + d1.slice(i + 1);
          if (!d2) continue;

          // Check if d2 is a valid word
          if (this.wordToId.has(d2)) {
            checkCandidate(this.wordToId.get(d2), 2);
          }

          // Check if d2 matches dictionary deletions
          const matchingIds = this.deletes[d2];
          if (matchingIds) {
            for (let k = 0; k < matchingIds.length; k++) {
              checkCandidate(matchingIds[k], 2);
            }
          }
        }
      }
    }

    // 5. Build candidate objects list
    const results = [];
    for (const [wordId, distance] of candidatesMap.entries()) {
      const word = this.words[wordId];
      results.push({
        word,
        distance,
        frequency: this.freqs[word] || (this.words.length - wordId),
        wordId
      });
    }

    return results;
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.SymSpell = SymSpell;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SymSpell };
}

