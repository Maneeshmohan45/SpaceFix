/**
 * SpaceFix V1 - Candidate Ranking & Confidence Gating Module (Audited)
 *
 * Fixes:
 * - [HIGH-05]: First-letter preservation bonus to prevent 'bll' -> 'all', 'cme' -> 'me'.
 * - [HIGH-05]: Ambiguity gating on Distance-1 ties (Precision > Recall).
 */

class CandidateRanker {
  constructor(options = {}) {
    this.minDistance1Floor = options.minDistance1FrequencyFloor || 100000;
    this.minDistance2Ratio = options.minDistance2FrequencyRatio || 3.0;
    this.minDistance2Floor = options.minDistance2FrequencyFloor || 200000;
  }

  /**
   * Ranks candidates and selects the single winning word, or returns null if confidence is low.
   *
   * @param {string} originalWord - The raw input word typed by user
   * @param {Array<{ word: string, distance: number, frequency: number, wordId: number }>} candidates
   * @param {Object} [dictionary] - Optional Dictionary instance for case restoration
   * @returns {string|null} The chosen replacement word (with case restored), or null if rejected.
   */
  rank(originalWord, candidates, dictionary = null) {
    if (!originalWord || !candidates || candidates.length === 0) {
      return null;
    }

    // 1. Exact match (Distance 0) - Word is already valid
    const exactMatch = candidates.find(c => c.distance === 0);
    if (exactMatch) {
      return dictionary ? dictionary.restoreCase(originalWord, exactMatch.word) : exactMatch.word;
    }

    // Detect if original token is capitalized (potential proper noun: "America", "India", "Rohan")
    const isCapitalized = originalWord.length >= 2 &&
      originalWord[0] === originalWord[0].toUpperCase() &&
      originalWord[0] !== originalWord[0].toLowerCase() &&
      originalWord.slice(1) === originalWord.slice(1).toLowerCase();

    const firstChar = originalWord.charAt(0).toLowerCase();

    // 2. Partition candidates by edit distance
    const dist1 = [];
    const dist2 = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.distance === 1) {
        dist1.push(c);
      } else if (c.distance === 2) {
        dist2.push(c);
      }
    }

    // 3. TIER 1: Distance-1 candidates (Always beats Distance-2)
    if (dist1.length > 0) {
      const sameFirst = dist1.filter(c => c.word.charAt(0).toLowerCase() === firstChar);
      const diffFirst = dist1.filter(c => c.word.charAt(0).toLowerCase() !== firstChar);

      sameFirst.sort((a, b) => a.wordId - b.wordId);
      diffFirst.sort((a, b) => a.wordId - b.wordId);

      // If candidates with the same first letter exist, they get heavy priority
      if (sameFirst.length > 0) {
        const topSame = sameFirst[0];
        const freqSame = topSame.frequency || 0;

        // If user typed a capitalized word, only accept if candidate is very high frequency
        if (isCapitalized && freqSame < 5000000) {
          return null; // Protect unlisted proper nouns (e.g. "Rohan", "Sudan")
        }

        // Single candidate floor: do not mutate an unknown word into an obscure dictionary word
        if (freqSame < this.minDistance1Floor) {
          return null;
        }

        // If a diffFirst candidate exists, it must have >50x the frequency to override same-letter
        if (diffFirst.length > 0) {
          const topDiff = diffFirst[0];
          const ratio = (topDiff.frequency || 1) / (topSame.frequency || 1);
          if (ratio > 50.0) {
            return dictionary ? dictionary.restoreCase(originalWord, topDiff.word) : topDiff.word;
          }
        }

        // Ambiguity check between top-1 and top-2 same-letter candidates
        if (sameFirst.length > 1) {
          const top2Same = sameFirst[1];
          const ratio = (topSame.frequency || 1) / (top2Same.frequency || 1);
          if (ratio < 1.3 && freqSame < 1000000) {
            return null; // Ambiguous tie
          }
        }

        return dictionary ? dictionary.restoreCase(originalWord, topSame.word) : topSame.word;
      }

      // No candidates share first letter -> evaluate diffFirst
      if (diffFirst.length > 0) {
        const topDiff = diffFirst[0];
        const freqDiff = topDiff.frequency || 0;

        // Mismatched first-letter candidates must meet floor and must not mutate capitalized words
        if (freqDiff < this.minDistance1Floor || isCapitalized) {
          return null;
        }

        if (diffFirst.length > 1) {
          const top2 = diffFirst[1];
          const ratio = (topDiff.frequency || 1) / (top2.frequency || 1);
          if (ratio < 2.0) {
            return null; // Ambiguous
          }
        }

        return dictionary ? dictionary.restoreCase(originalWord, topDiff.word) : topDiff.word;
      }
    }

    // 4. TIER 2: Distance-2 candidates
    if (dist2.length > 0) {
      // Reject short words (length <= 4)
      if (originalWord.length <= 4 || isCapitalized) {
        return null;
      }

      // STRICT RULE: Distance-2 candidates MUST share the first letter!
      // (Eliminates "america" -> "emerita" where first letter was also changed)
      const sameFirst = dist2.filter(c => c.word.charAt(0).toLowerCase() === firstChar);
      if (sameFirst.length === 0) {
        return null;
      }

      sameFirst.sort((a, b) => a.wordId - b.wordId);

      const top1 = sameFirst[0];
      const freq1 = top1.frequency || 1;

      // Frequency floor for Distance-2 (blocks rare words like "eland" [60k])
      if (freq1 < this.minDistance2Floor) {
        return null;
      }

      if (sameFirst.length > 1) {
        const top2 = sameFirst[1];
        const freq2 = top2.frequency || 1;
        const ratio = freq1 / freq2;

        if (ratio < this.minDistance2Ratio) {
          return null; // Ambiguous
        }
      }

      return dictionary ? dictionary.restoreCase(originalWord, top1.word) : top1.word;
    }

    return null;
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.CandidateRanker = CandidateRanker;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CandidateRanker };
}
