/**
 * SpaceFix V1 - Contractions Expansion Map
 * Direct lookup for unpunctuated contraction typos.
 * These are intercepted with 100% priority before dictionary/SymSpell lookup,
 * preventing high-frequency hijacking ('im' -> 'in', 'dont' -> 'done', 'ive' -> 'live').
 */

const CONTRACTIONS_MAP = {
  "dont": "don't",
  "cant": "can't",
  "wont": "won't",
  "im": "I'm",
  "ive": "I've",
  "yall": "y'all",
  "y'all": "y'all",
  "youre": "you're",
  "youve": "you've",
  "youll": "you'll",
  "youd": "you'd",
  "theyre": "they're",
  "theyve": "they've",
  "theyll": "they'll",
  "theyd": "they'd",
  "were": "we're",
  "weve": "we've",
  "didnt": "didn't",
  "doesnt": "doesn't",
  "isnt": "isn't",
  "arent": "aren't",
  "wasnt": "wasn't",
  "werent": "weren't",
  "hasnt": "hasn't",
  "havent": "haven't",
  "hadnt": "hadn't",
  "couldnt": "couldn't",
  "shouldnt": "shouldn't",
  "wouldnt": "wouldn't",
  "couldve": "could've",
  "shouldve": "should've",
  "wouldve": "would've",
  "thats": "that's",
  "whats": "what's",
  "wheres": "where's",
  "hows": "how's",
  "theres": "there's",
  "heres": "here's",
  "lets": "let's",
  "whos": "who's",
  "aint": "ain't"
};

// Universal export
globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.CONTRACTIONS_MAP = CONTRACTIONS_MAP;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONTRACTIONS_MAP };
}
