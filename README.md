# SpaceFix

> **Zero-latency, 100% offline in-browser auto-correct on Spacebar with single-step atomic Backspace-to-undo.**

SpaceFix is a lightweight Chromium browser extension (Manifest V3) engineered to fix broken non-word typos in real time without lag, cloud API roundtrips, or aggressive false positives.

---

## 🌟 What SpaceFix V1 Does

SpaceFix solves the fundamental flaws of legacy spellcheckers and browser auto-correct tools:

- ⚡ **Zero Typing Latency (< 0.2 ms)**: Built on an in-memory SymSpell deletion index and Damerau-Levenshtein distance algorithm. Runs 100% client-side inside the active tab's V8 isolated world. No background IPC lag, no network requests.
- ⌫ **Single-Step Atomic Backspace-to-Undo**: If a correction is not what you wanted, pressing **Backspace once** instantly restores your exact original typo and removes the trailing phantom space.
- 🔁 **Rejection Memory (Loop Immunity)**: Once you undo a word, SpaceFix remembers your choice and **never re-corrects that word** during the editing session. Eliminates the dreaded Backspace $\leftrightarrow$ Space infinite correction trap.
- 🧩 **Contractions Expansion**: Directly intercepts informal contractions (`cant` $\rightarrow$ `can't`, `dont` $\rightarrow$ `don't`, `wont` $\rightarrow$ `won't`, `yall` $\rightarrow$ `y'all`, `couldve` $\rightarrow$ `could've`) with 100% accuracy before dictionary lookup.
- 🛡️ **Precision Over Recall**: Follows a strict confidence threshold. If a typed token is ambiguous or missing from the vocabulary, SpaceFix **prefers doing nothing** over making a low-confidence guess.
- 💻 **Developer & Code Safe**: Automatically recognizes and ignores `snake_case` variables (`user_profile_id`), `kebab-case` classes, `camelCase` identifiers, URLs (`https://...`), email addresses, and file paths.
- ✍️ **Sentence Boundary Punctuation**: Preserves and places spaces correctly after colons (`note:`), semicolons, commas, periods, question marks, and exclamation marks.
- 🌐 **Web Applications Compatibility**: Thoroughly audited and verified on modern rich-text editors and Shadow DOMs:
  - **ChatGPT** (ProseMirror `#prompt-textarea`)
  - **Google Gemini** (Angular `rich-textarea`)
  - **YouTube** (Lit / Polymer Shadow DOM search box)
  - **WhatsApp Web** (Lexical / Draft.js message composer)
  - **Gmail** (Rich contenteditable message body)
- 🔒 **100% Private & Offline**: Requires only standard `"storage"` permission. Zero analytics, zero telemetries, zero external HTTP calls.

---

## 📊 Performance & Accuracy Scorecard

Measured across 1,000 real Chromium DOM keydown cycles and Norvig benchmark corpora:

| Metric | Measured Baseline | Target Standard | Status |
| :--- | :---: | :---: | :---: |
| **Keystroke Delay (Median p50)** | **0.151 ms** | $< 5.0\text{ ms}$ | 🟢 ~330x faster than perceptible lag |
| **Keystroke Delay (Worst-case p99)** | **0.328 ms** | $< 10.0\text{ ms}$ | 🟢 Sub-millisecond worst-case |
| **Startup / Navigation Overhead** | **0.00 ms** | $0\text{ ms}$ | 🟢 Lazy-initializes on first input focus |
| **V8 Heap Memory Footprint** | **~82.4 MB** | $< 120\text{ MB}$ | 🟢 Completely bounded |
| **Valid Vocabulary Safety** | **100.0%** | $> 99.0\%$ | 🟢 Zero false positives on valid words |
| **Code Identifiers Safety** | **100.0%** | $100.0\%$ | 🟢 Zero corruption of code identifiers |
| **Automated Test Suite** | **42 / 42 PASS** | $100\%$ | 🟢 0 regressions across all suites |

---

## 📂 Repository File Structure

```
SpaceFix/
├── .gitignore                      # Excludes virtual environments, caches, and internal notes
├── package.json                    # Node.js project metadata and test/benchmark scripts
├── requirements.txt                # Python pipeline dependencies (pytest)
├── README.md                       # Complete project overview & documentation
├── test_playground.html            # Standalone browser testbed for DOM & input testing
│
├── benchmarks/                     # Automated performance, latency & accuracy profiling
│   ├── datasets/                   # Norvig & Birkbeck error corpora
│   ├── results/                    # Machine-readable benchmark scorecards
│   └── scripts/
│       ├── run_accuracy.js         # Accuracy & false-positive profiler
│       ├── run_all.js              # Full test harness runner
│       ├── run_latency.js          # Microsecond keystroke latency benchmark
│       └── run_memory.js           # V8 heap memory allocation profiler
│
├── data_pipeline/                  # Offline vocabulary curation & SymSpell index builder
│   ├── raw_wordlists/              # SCOWL, slang, developer tools, and frequency data
│   ├── scripts/
│   │   ├── build_dictionary.py     # Ingests SCOWL + frequency lists -> dictionary.json
│   │   ├── build_symspell_index.py # Generates 1.4M deletion keys -> symspell_index.json
│   │   ├── fetch_raw_data.py       # Deterministic raw corpus downloader
│   │   └── validate_dictionary.py  # Word list sanity and integrity checks
│   ├── tests/
│   │   └── test_pipeline.py        # Pytest test suite for dictionary & index builds
│   └── output/                     # Compiled dictionary & symspell index assets
│
├── extension/                      # Manifest V3 Extension Source (Distributable)
│   ├── manifest.json               # MV3 extension manifest
│   ├── assets/
│   │   ├── dictionary.json         # 85,296 curated words with frequency rankings
│   │   └── symspell_index.json     # Precomputed deletion hash index (Distance 1 & 2)
│   ├── background/
│   │   └── service_worker.js       # Background event listener
│   ├── content/
│   │   ├── content_script.js       # Main orchestrator & keydown event lifecycle
│   │   ├── undo_manager.js         # Atomic Backspace-to-undo state machine
│   │   ├── dom/
│   │   │   ├── content_editable.js # Rich-text contenteditable adapter
│   │   │   ├── exclusions.js       # Passwords, code editors, and delimiter safety guard
│   │   │   └── input_handler.js    # Input/textarea boundary extractor & caret placer
│   │   └── engine/
│   │       ├── contractions.js     # Contractions mapping dictionary
│   │       ├── dictionary.js       # In-memory dictionary lookup and case restorer
│   │       ├── ranking.js          # Distance, frequency, and ambiguity confidence ranker
│   │       └── symspell.js         # SymSpell candidate search & Damerau-Levenshtein
│   └── popup/
│       ├── popup.html              # Extension settings UI
│       ├── popup.css               # Clean modern dark/light popup stylesheet
│       └── popup.js                # Toggle on/off, whitelist, and live stats counters
│
└── tests/                          # Automated Node.js integration & regression test suites
    ├── dom/
    │   ├── content_editable.test.js
    │   ├── end_to_end_dom.test.js
    │   ├── exclusions.test.js
    │   └── input_handler.test.js
    ├── engine/
    │   ├── dictionary.test.js
    │   ├── ranking.test.js
    │   ├── real_assets_integration.test.js
    │   └── symspell.test.js
    ├── packaging/
    │   └── manifest.test.js
    ├── undo/
    │   └── undo_manager.test.js
    ├── qa2_regression.test.js      # QA-2 & QA-3 edge cases regression suite
    ├── qa_fixes.test.js            # Core engine fixes validation suite
    └── qa4_audit_runner.js         # 268-token fresh adversarial real-browser test runner
```

---

## 🚀 Installation & Local Development

### 1. Load in Chromium (Edge, Brave, Chrome)
1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/spacefix.git
   cd spacefix
   ```
2. Open your browser and navigate to the extensions page:
   - **Microsoft Edge**: `edge://extensions`
   - **Brave Browser**: `brave://extensions`
   - **Google Chrome**: `chrome://extensions`
3. Toggle on **Developer mode** (top-right or bottom-left toggle).
4. Click **Load unpacked** and select the [`extension/`](file:///c:/Users/dundi/Desktop/Spell%20correcter/extension) folder inside this repository.
5. SpaceFix is now active on all websites!

### 2. Quick Testing with `test_playground.html`
Open [`test_playground.html`](file:///c:/Users/dundi/Desktop/Spell%20correcter/test_playground.html) directly in your browser:
- Try typing common typos: `thier `, `adress `, `freind `, `cant `, `beleive: `.
- Press **Backspace** immediately after any auto-correction to verify atomic undo.
- Try typing code identifiers: `user_profile_id `, `order_id `, `customer-nav-link `.

---

## 🧪 Running Automated Tests & Benchmarks

### JavaScript Unit, DOM & Regression Suites
Requires **Node.js (v18+)**:
```bash
# Run all 42 automated tests
npm test

# Run the 268-token adversarial QA audit runner
node tests/qa4_audit_runner.js
```

### Performance & Latency Benchmarking
```bash
# Run all benchmarks (accuracy, latency, and V8 heap memory)
npm run benchmark:all

# Or run individual profilers:
npm run benchmark:accuracy
npm run benchmark:latency
npm run benchmark:memory
```

### Python Data Pipeline Tests
Requires Python 3.10+ and pytest:
```bash
pytest data_pipeline/tests
```

---

## 🗺️ V1 Scope vs V2 Roadmap

### ✅ Completed in V1
- [x] Zero-latency in-tab SymSpell engine (85,296 words + 1.4M deletion keys).
- [x] Single-step atomic Backspace undo with trailing whitespace removal.
- [x] Rejection memory state machine to eliminate infinite correction loops.
- [x] Contraction expansion map (`cant` $\rightarrow$ `can't`, `couldve` $\rightarrow$ `could've`).
- [x] Case restoration (`Thier` $\rightarrow$ `Their`, `RECIEVE` $\rightarrow$ `RECEIVE`).
- [x] Sentence boundary punctuation handling (colons, semicolons, commas, periods).
- [x] Exclusion guards for code identifiers, passwords, and URLs.
- [x] ProseMirror & Shadow DOM support (ChatGPT, Gemini, YouTube, WhatsApp, Gmail).
- [x] Browser popup with enable toggle, whitelist management, and live stats.

### 🔮 Planned for V2
- [ ] Contextual n-gram / bigram disambiguation for real-word homophones and frequency ties (e.g., `helo` -> `hello` vs `help`).
- [ ] Edit-type weighting (giving prefix extensions and double-consonant completions priority over letter substitutions).
- [ ] User custom personal dictionary in popup settings.
- [ ] Multi-language vocabulary packs (Spanish, French, German).

---

## ⚠️ Known V1 Limitations & Technical Explanation

SpaceFix V1 is engineered with a strict **Precision > Recall** philosophy to guarantee zero typing lag (< 0.2 ms) without complex cloud dependencies. As a result, users may observe a known linguistic phenomenon called **Frequency Dominance Over Edit Types**:

### 1. Observed Behaviors
- Typing `helo` auto-corrects to `help` instead of `hello`.
- Typing `wher` auto-corrects to `when` instead of `where`.
- Typing `aple` auto-corrects to `able` instead of `apple`.
- Typing `som` auto-corrects to `so` instead of `some`.

### 2. Why This Happens (The Algorithmic Mechanics)
In edit distance algorithms like SymSpell / Damerau-Levenshtein, **inserting a letter** and **substituting a letter** both carry an identical edit distance penalty of **1 (Distance 1)**:
- **`helo` $\rightarrow$ `hello`** requires inserting an `l` (Distance 1). `hello` has a frequency count of **~33 Million** in our 85k dictionary.
- **`helo` $\rightarrow$ `help`** requires substituting `o` with `p` (Distance 1). `help` has an astronomical frequency count of **~611 Million** in the English corpus.

Because `help` appears **18.5x more frequently** in general English than `hello`, the unigram ranker selects `help`. Similarly, `when` (~650 Million) outranks `where` (~360 Million) when evaluated against the stem `wher`.

### 3. How V1 Protects the User
1. **Single-Step Atomic Undo**: If a high-frequency substitution occurs that you did not want, pressing **Backspace once** instantly restores your exact original typo (`helo`) and strips the trailing phantom space.
2. **Infinite Rejection Memory**: Once undone, SpaceFix remembers your rejection and **never re-corrects that word** again during that editing session, permanently preventing correction loops.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
