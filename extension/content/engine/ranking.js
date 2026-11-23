/**
 * SpaceFix V1.1 - Candidate Ranking & Confidence Gating Module
 * Edit-type-weighted noisy-channel ranker.
 *
 * Model (all in "decades", i.e. powers of ten of unigram frequency):
 *
 *     score(c) = log10(freq(c)) - editCost(typo, c) - FIRST_LETTER_PENALTY * [first letter changed]
 *
 * editCost is a weighted Damerau-Levenshtein (OSA) where each operation has a
 * type-specific price. One ordinary edit costs `unit` decades (4.5 ~ 30,000x
 * frequency), so edit count still dominates; the discounts below are what let a
 * *likely* edit type beat an *unlikely* one at a bounded frequency disadvantage:
 *
 *   substitution / mid-word insertion / stray deletion .... 1.00 * unit
 *   adjacent transposition (peice -> piece) ............... 0.65 * unit  (~38x freq tolerance)
 *   geminate omission/extra double (helo -> hello) ........ 0.60 * unit  (~63x)
 *   tail completion of truncated word (wher -> where) ..... 0.60 * unit  (~63x)
 *   first letter changed (surcharge) ...................... +1.7 decades (== legacy ">50x" rule)
 *
 * The caller-supplied `distance` remains an authoritative floor on the edit count,
 * so Distance-1 still beats Distance-2 unless the Distance-2 edits are cheap types
 * (e.g. ocured -> occurred = two geminate omissions beats cured = dropped first letter).
 *
 * Confidence gating (floors, capitalization guard, ambiguity margins) is unchanged
 * in spirit; ratio tests became score-margin tests (log10 of the old ratios).
 */

const LOG10 = Math.log10;

const DEFAULT_WEIGHTS = Object.freeze({
  unit: 4.5,
  geminate: 0.6,
  transposition: 0.65,
  tail: 0.6,
  firstLetterPenalty: 1.7,
  shortlist: 12 // exact weighted cost computed only for the best N candidates (latency bound)
});

const MAX_LEN = 40;
const _M = new Float64Array(MAX_LEN * MAX_LEN); // reused DP matrix: no per-call allocation

/**
 * Weighted OSA cost of turning `s` (typed) into `t` (dictionary word), excluding the
 * first-letter surcharge. Both must be lowercase and shorter than MAX_LEN.
 */
function weightedEditCost(s, t, w) {
  const n = s.length, m = t.length, W = m + 1;
  const U = w.unit, GEM = U * w.geminate, TR = U * w.transposition, TAIL = U * w.tail;

  // t[j] is missing from the typo ("omission"): doubled letter or final letter are cheap
  const ins = (j) => (t[j] === t[j - 1] || t[j] === t[j + 1]) ? GEM : (j === m - 1 ? TAIL : U);
  // s[i] is an extra typed char: a stuttered double letter is cheap
  const del = (i) => (s[i] === s[i - 1] || s[i] === s[i + 1]) ? GEM : U;

  for (let j = 1; j <= m; j++) _M[j] = _M[j - 1] + ins(j - 1);
  _M[0] = 0;
  for (let i = 1; i <= n; i++) {
    _M[i * W] = _M[(i - 1) * W] + del(i - 1);
    for (let j = 1; j <= m; j++) {
      const a = s[i - 1], b = t[j - 1];
      let best = _M[(i - 1) * W + j - 1] + (a === b ? 0 : U);
      const d = _M[(i - 1) * W + j] + del(i - 1);
      if (d < best) best = d;
      const x = _M[i * W + j - 1] + ins(j - 1);
      if (x < best) best = x;
      if (i > 1 && j > 1 && a === t[j - 2] && s[i - 2] === b && a !== b) {
        const tr = _M[(i - 2) * W + j - 2] + TR;
        if (tr < best) best = tr;
      }
      _M[i * W + j] = best;
    }
  }
  return _M[n * W + m];
}

const SHORT_GRAMMATICAL_STOP_WORDS = new Set([
  "may", "per", "in", "to", "as", "at", "an", "on", "or", "so", "no", "up", "by", "of", "do", "if", "my", "we", "he", "it", "is", "am"
]);

class CandidateRanker {
  constructor(options = {}) {
    this.minDistance1Floor = options.minDistance1FrequencyFloor || 100000;
    this.minDistance2Ratio = options.minDistance2FrequencyRatio || 3.0;
    this.minDistance2Floor = options.minDistance2FrequencyFloor || 200000;
    this.weights = Object.assign({}, DEFAULT_WEIGHTS, options.weights || {});
  }

  /**
   * @param {string} originalWord
   * @param {Array<{ word: string, distance: number, frequency: number, wordId: number }>} candidates
   * @param {Object} [dictionary] Optional Dictionary instance for case restoration
   * @returns {string|null} Replacement (case restored) or null if confidence is too low
   */
  rank(originalWord, candidates, dictionary = null) {
    if (!originalWord || !candidates || candidates.length === 0) return null;
    // Guard 2: Enforce a strict minimum length of 3 chars for non-exact auto-correction (protects 2-letter slang like wp, gg, rn)
    if (originalWord.length <= 2) return null;
    const restore = (w) => (dictionary ? dictionary.restoreCase(originalWord, w) : w);

    // 1. Exact match (Distance 0): word is already valid
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].distance === 0) return restore(candidates[i].word);
    }

    const wt = this.weights;
    const orig = originalWord.toLowerCase();
    const isCapitalized = originalWord.length >= 2 &&
      originalWord[0] === originalWord[0].toUpperCase() &&
      originalWord[0] !== originalWord[0].toLowerCase() &&
      originalWord.slice(1) === originalWord.slice(1).toLowerCase();

    // 2. Shortlist by cheap coarse score (frequency - unit*distance), bounded for latency
    let pool = [];
    for (let i = 0; i < candidates.length; i++) {
      const d = candidates[i].distance;
      if (d === 1 || d === 2) pool.push(candidates[i]);
    }
    if (pool.length === 0) return null;
    if (pool.length > wt.shortlist) {
      pool.sort((a, b) =>
        (LOG10(b.frequency || 1) - wt.unit * b.distance) -
        (LOG10(a.frequency || 1) - wt.unit * a.distance));
      pool = pool.slice(0, wt.shortlist);
    }

    // 3. Exact weighted score for each shortlisted candidate
    const scored = pool.map((c) => {
      const firstDiffers = c.word[0] !== orig[0];
      const penalty = firstDiffers ? wt.firstLetterPenalty : 0;
      let cost;
      if (orig.length < MAX_LEN && c.word.length < MAX_LEN) {
        cost = weightedEditCost(orig, c.word, wt);
        // The supplied SymSpell distance is a floor: discounts may make edits cheaper,
        // but never make a Distance-2 candidate look like a single edit.
        const implied = Math.ceil(cost / wt.unit - 1e-9);
        if (c.distance > implied) cost += (c.distance - implied) * wt.unit;
      } else {
        cost = c.distance * wt.unit;
      }
      cost += penalty;
      return { c, sameFirst: !firstDiffers, score: LOG10(c.frequency || 1) - cost };
    });
    scored.sort((a, b) => (b.score - a.score) || (a.c.wordId - b.c.wordId));

    const top = scored[0];
    const win = top.c;
    const freq = win.frequency || 0;
    const margin = scored.length > 1 ? top.score - scored[1].score : Infinity;

    // 4. Confidence gating, selected by the winner's class
    if (win.distance === 2) {
      if (orig.length <= 4 || isCapitalized || !top.sameFirst) return null;
      if (freq < this.minDistance2Floor) return null;
      if (margin < LOG10(this.minDistance2Ratio)) return null; // ambiguous
      return restore(win.word);
    }

    if (top.sameFirst) {
      if (isCapitalized) {
        if (SHORT_GRAMMATICAL_STOP_WORDS.has(win.word.toLowerCase())) return null;
        if (orig.length <= 3) {
          // Protect 3-letter proper names/acronyms (Dan, Ben, Ron, Tim, Kim, Jon) from high-frequency
          // substitutions (Day, Run, Kit) or insertions (Been, Time, John).
          // Only permit genuine letter swaps/transpositions (e.g. Teh -> The).
          const isTransposition = (orig.length === win.word.length) &&
            (orig.toLowerCase().split('').sort().join('') === win.word.toLowerCase().split('').sort().join(''));
          if (!isTransposition) return null;
        }
        if (freq < 5000000) return null; // Protect unlisted proper nouns
      }
      if (freq < this.minDistance1Floor) return null;
      if (margin < LOG10(1.3) && freq < 1000000) return null; // ambiguous tie
      return restore(win.word);
    }

    // Winner changed the first letter (only possible when it beat every same-letter option by the penalty)
    if (freq < this.minDistance1Floor || isCapitalized) return null;
    if (margin < LOG10(2.0)) return null;
    return restore(win.word);
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.CandidateRanker = CandidateRanker;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CandidateRanker, weightedEditCost, DEFAULT_WEIGHTS };
}
