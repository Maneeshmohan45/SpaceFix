/**
 * SpaceFix V1 - Dictionary Module
 * Handles O(1) membership validation, case restoration, and unigram frequencies.
 */

class Dictionary {
  /**
   * @param {Object<string, number>} wordFreqMap - Lowercase word to frequency count mapping
   */
  constructor(wordFreqMap = {}) {
    this.words = new Set(Object.keys(wordFreqMap));
    this.freqs = wordFreqMap;
  }

  /**
   * Checks if a word exists in the dictionary (case-insensitive).
   * @param {string} word
   * @returns {boolean}
   */
  has(word) {
    if (!word) return false;
    return this.words.has(word.toLowerCase());
  }

  /**
   * Returns the unigram frequency of a word.
   * @param {string} word
   * @returns {number}
   */
  getFrequency(word) {
    if (!word) return 0;
    return this.freqs[word.toLowerCase()] || 0;
  }

  /**
   * Restores the original capitalization pattern onto the replacement word.
   * Examples:
   *   "Speling" -> "Spelling" (Capitalized)
   *   "SPELING" -> "SPELLING" (Uppercase)
   *   "speling" -> "spelling" (Lowercase)
   * @param {string} original
   * @param {string} replacement
   * @returns {string}
   */
  restoreCase(original, replacement) {
    if (!original || !replacement) return replacement;

    // 1. All uppercase: "SPELING" -> "SPELLING"
    if (original === original.toUpperCase() && original !== original.toLowerCase()) {
      return replacement.toUpperCase();
    }

    // 2. Capitalized: "Speling" -> "Spelling"
    const firstChar = original.charAt(0);
    if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }

    // Fix [CRIT-04]: Pronoun contractions starting with "I'" (e.g. "I'm", "I've", "I'd", "I'll")
    if (replacement.startsWith("I'")) {
      return replacement;
    }

    // 3. Default lowercase
    return replacement.toLowerCase();
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.Dictionary = Dictionary;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Dictionary };
}

