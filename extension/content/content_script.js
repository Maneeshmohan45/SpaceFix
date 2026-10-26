/**
 * SpaceFix V1 - Content Script Orchestrator (Audited)
 *
 * Fixes:
 * - [CRIT-04]: Intercepts contractions directly via CONTRACTIONS_MAP.
 * - [CRIT-03]: Protects contenteditable undo and never preventsDefault on failure.
 * - [HIGH-03]: Lazy-initializes engine on first input focusin event (0ms page load impact).
 * - [LOW-02]: Ignores modifier keys (Shift, Control, Alt, Meta) to preserve undo buffer.
 * - [MED-01]: Persists stats to chrome.storage.local so popup displays live counts.
 */

class ContentScriptOrchestrator {
  constructor(options = {}) {
    this.dict = options.dictionary || null;
    this.sym = options.symspell || null;
    this.ranker = options.ranker || null;
    this.contractionsMap = options.contractionsMap || (globalThis.SpaceFix?.CONTRACTIONS_MAP || globalThis.SpellCorrector?.CONTRACTIONS_MAP || (typeof CONTRACTIONS_MAP !== "undefined" ? CONTRACTIONS_MAP : null));

    const UndoClass = options.undoManager || globalThis.SpaceFix?.UndoManager || globalThis.SpellCorrector?.UndoManager || (typeof UndoManager !== "undefined" ? UndoManager : null);
    this.undoManager = UndoClass ? (typeof UndoClass === "function" ? new UndoClass() : UndoClass) : null;

    const ExclusionsClass = options.exclusions || globalThis.SpaceFix?.ExclusionsGuard || globalThis.SpellCorrector?.ExclusionsGuard || (typeof ExclusionsGuard !== "undefined" ? ExclusionsGuard : null);
    this.exclusions = ExclusionsClass ? (typeof ExclusionsClass === "function" ? new ExclusionsClass() : ExclusionsClass) : null;

    const InputHandlerClass = options.inputHandler || globalThis.SpaceFix?.StandardInputHandler || globalThis.SpellCorrector?.StandardInputHandler || (typeof StandardInputHandler !== "undefined" ? StandardInputHandler : null);
    this.inputHandler = InputHandlerClass ? (typeof InputHandlerClass === "function" ? new InputHandlerClass() : InputHandlerClass) : null;

    const CEClass = options.contentEditableAdapter || globalThis.SpaceFix?.ContentEditableAdapter || globalThis.SpellCorrector?.ContentEditableAdapter || (typeof ContentEditableAdapter !== "undefined" ? ContentEditableAdapter : null);
    this.contentEditableAdapter = CEClass ? (typeof CEClass === "function" ? new CEClass() : CEClass) : null;

    this.enabled = true;
    this.whitelist = new Set();
    this.sessionRejections = new Set();
    this.isInitialized = false;
    this.stats = {
      corrections: 0,
      undos: 0,
      get correctionsCount() { return this.corrections; },
      set correctionsCount(v) { this.corrections = v; },
      get undosCount() { return this.undos; },
      set undosCount(v) { this.undos = v; }
    };

    // Fix [LOW-02]: Modifier keys to ignore
    this.modifierKeys = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "NumLock", "ScrollLock"]);

    this._loadSettingsFromStorage();
  }

  _loadSettingsFromStorage() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["enabled", "whitelist", "stats"], (res) => {
        if (res.enabled !== undefined) {
          this.enabled = res.enabled;
        }
        if (Array.isArray(res.whitelist)) {
          this.whitelist = new Set(res.whitelist.map(w => w.toLowerCase()));
        }
        if (res.stats) {
          this.stats.corrections = res.stats.corrections || 0;
          this.stats.undos = res.stats.undos || 0;
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          if (changes.enabled) this.enabled = changes.enabled.newValue;
          if (changes.whitelist && Array.isArray(changes.whitelist.newValue)) {
            this.whitelist = new Set(changes.whitelist.newValue.map(w => w.toLowerCase()));
          }
        }
      });
    }
  }

  // Fix [MED-01]: Sync stats to chrome.storage.local
  _saveStatsToStorage() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ stats: { corrections: this.stats.corrections, undos: this.stats.undos } });
    }
  }

  initialize(dictData, indexData) {
    const DictClass = globalThis.SpaceFix?.Dictionary || globalThis.SpellCorrector?.Dictionary || (typeof Dictionary !== "undefined" ? Dictionary : null);
    const SymClass = globalThis.SpaceFix?.SymSpell || globalThis.SpellCorrector?.SymSpell || (typeof SymSpell !== "undefined" ? SymSpell : null);
    const RankerClass = globalThis.SpaceFix?.CandidateRanker || globalThis.SpellCorrector?.CandidateRanker || (typeof CandidateRanker !== "undefined" ? CandidateRanker : null);

    this.dict = new DictClass(dictData);
    this.sym = new SymClass(indexData.words, indexData.deletes, dictData);
    this.ranker = new RankerClass();
    this.isInitialized = true;
  }

  handleKeyDown(event) {
    if (!this.isInitialized || !this.enabled || !event || event.isComposing) {
      return;
    }

    // Fix [LOW-02]: Never purge undo state on modifier keys
    if (this.modifierKeys.has(event.key)) {
      return;
    }

    // Pierce Shadow DOM (e.g. YouTube search box inside <ytd-searchbox> shadow root)
    let target = (event.composedPath && event.composedPath()[0]) || event.target;
    if (target && target.nodeType === 3) {
      target = target.parentElement;
    }
    if (!target) return;

    // 1. Backspace Key: Atomic undo
    if (event.key === "Backspace") {
      if (this.undoManager && this.undoManager.canUndo(target)) {
        // Record rejected token into sessionRejections so user is never trapped in a loop
        const rejectedWord = this.undoManager.state?.originalWord;
        const success = this.undoManager.undo(target);
        if (success) {
          if (rejectedWord) {
            this.sessionRejections.add(rejectedWord.toLowerCase());
          }
          event.preventDefault();
          this.stats.undos++;
          this._saveStatsToStorage();
          return;
        }
      }
      if (this.undoManager) this.undoManager.clear();
      return;
    }

    // 2. Spacebar Key: Candidate correction
    if (event.key === " ") {
      if (this.undoManager) this.undoManager.clear();

      if (this.exclusions && this.exclusions.isElementExcluded(target)) {
        return;
      }

      const tagName = target.tagName ? target.tagName.toLowerCase() : "";
      const isInputOrTextarea = tagName === "input" || tagName === "textarea";
      const isContentEditable = !isInputOrTextarea && Boolean(
        (this.contentEditableAdapter && this.contentEditableAdapter.isContentEditable(target)) ||
        target.isContentEditable ||
        Boolean(target.closest && target.closest('[contenteditable="true"]'))
      );

      if (!isInputOrTextarea && !isContentEditable) {
        return;
      }

      let word = null;
      let startIndex = 0;
      let endIndex = 0;
      let extractedData = null;

      if (isInputOrTextarea && this.inputHandler) {
        extractedData = this.inputHandler.extractPrecedingWord(target);
        if (!extractedData) return;
        word = extractedData.word;
        startIndex = extractedData.startIndex;
        endIndex = extractedData.endIndex;
      } else if (isContentEditable && this.contentEditableAdapter) {
        extractedData = this.contentEditableAdapter.extractPrecedingWord(target);
        if (!extractedData) return;
        word = extractedData.word;
        startIndex = extractedData.startIndex;
        endIndex = extractedData.endIndex;
      }

      if (this.exclusions && this.exclusions.isTokenExcluded(word)) {
        return;
      }

      const wordLower = word.toLowerCase();

      if (this.whitelist.has(wordLower)) {
        return;
      }

      // Rejection Memory: Do NOT re-correct a word the user actively undid in this session!
      if (this.sessionRejections.has(wordLower)) {
        return;
      }

      let bestCandidate = null;

      // Fix [CRIT-04]: Priority 1: Check Contractions Map ('dont' -> 'don't', 'im' -> 'I'm')
      if (this.contractionsMap && this.contractionsMap[wordLower]) {
        const expanded = this.contractionsMap[wordLower];
        bestCandidate = this.dict ? this.dict.restoreCase(word, expanded) : expanded;
      } else {
        // Priority 2: Standard Dictionary check
        if (this.dict && this.dict.has(word)) {
          return;
        }

        // Priority 3: SymSpell candidate lookup
        if (this.sym && this.ranker) {
          const candidates = this.sym.lookup(word);
          bestCandidate = this.ranker.rank(word, candidates, this.dict);
        }
      }

      if (bestCandidate && bestCandidate.toLowerCase() !== wordLower) {
        let replaced = false;

        if (isInputOrTextarea && this.inputHandler) {
          replaced = this.inputHandler.replaceWord(target, bestCandidate, startIndex, endIndex, extractedData?.trailingPunct || "");
        } else if (isContentEditable && this.contentEditableAdapter) {
          const res = this.contentEditableAdapter.replaceWord(target, bestCandidate, extractedData);
          replaced = res.success;
        }

        if (replaced && this.undoManager) {
          this.undoManager.record(target, word, bestCandidate, startIndex, endIndex, isContentEditable, extractedData);
          this.stats.corrections++;
          this._saveStatsToStorage();
        }
      }

      return;
    }

    // Any other key clears undo
    if (this.undoManager) this.undoManager.clear();
  }

  attachListeners() {
    document.addEventListener("keydown", (e) => this.handleKeyDown(e), true);
    document.addEventListener("click", () => { if (this.undoManager) this.undoManager.clear(); }, true);
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.ContentScriptOrchestrator = ContentScriptOrchestrator;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ContentScriptOrchestrator };
}

// Fix [HIGH-03]: Lazy-initialize on first focusin event (0ms impact on page load!)
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
  let isInitializing = false;
  let orchestratorInstance = null;

  async function triggerLazyInit() {
    if (orchestratorInstance || isInitializing) return;
    isInitializing = true;

    try {
      const dictUrl = chrome.runtime.getURL("assets/dictionary.json");
      const indexUrl = chrome.runtime.getURL("assets/symspell_index.json");

      const [dictResp, indexResp] = await Promise.all([
        fetch(dictUrl),
        fetch(indexUrl)
      ]);

      const dictData = await dictResp.json();
      const indexData = await indexResp.json();

      orchestratorInstance = new ContentScriptOrchestrator();
      orchestratorInstance.initialize(dictData, indexData);
      orchestratorInstance.attachListeners();

      console.log("%c⚡ SpaceFix V1 active & listening", "color: #38bdf8; font-weight: bold;");
    } catch (err) {
      console.warn("SpaceFix V1 lazy initialization failed:", err);
    } finally {
      isInitializing = false;
    }
  }

  // Trigger immediately on interaction with any editable element (piercing Shadow DOM)
  function handleEditableInteraction(e) {
    if (orchestratorInstance) return;
    let t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (t && t.nodeType === 3) t = t.parentElement;
    if (!t) return;

    const tag = t.tagName ? t.tagName.toLowerCase() : "";
    const isEditable = tag === "input" || 
                       tag === "textarea" || 
                       Boolean(t.isContentEditable) || 
                       Boolean(t.closest && t.closest('[contenteditable="true"]'));

    if (isEditable) {
      triggerLazyInit();
    }
  }

  document.addEventListener("focusin", handleEditableInteraction, { capture: true });
  document.addEventListener("pointerdown", handleEditableInteraction, { capture: true });

  // Fallback: Also proactively trigger after short idle (800ms) so engine is ready when user starts typing
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => triggerLazyInit(), { timeout: 800 });
  } else {
    setTimeout(triggerLazyInit, 800);
  }
}
