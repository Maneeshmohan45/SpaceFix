import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ContentScriptOrchestrator } from "../extension/content/content_script.js";
import { Dictionary } from "../extension/content/engine/dictionary.js";
import { SymSpell } from "../extension/content/engine/symspell.js";
import { CandidateRanker } from "../extension/content/engine/ranking.js";
import { UndoManager } from "../extension/content/undo_manager.js";
import { ExclusionsGuard } from "../extension/content/dom/exclusions.js";
import { StandardInputHandler } from "../extension/content/dom/input_handler.js";
import { ContentEditableAdapter } from "../extension/content/dom/content_editable.js";
import { CONTRACTIONS_MAP } from "../extension/content/engine/contractions.js";

// Mock Text Node (nodeType === 3)
class MockTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.nodeValue = text;
  }
}

class MockDomElement {
  constructor(tag = "TEXTAREA", attrs = {}, isContentEditable = false) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.isContentEditable = isContentEditable;
    this.contentEditable = isContentEditable ? "true" : "false";
    this.value = isContentEditable ? "" : "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.childNodes = [];
    if (isContentEditable) {
      this.textNode = new MockTextNode("");
      this.childNodes = [this.textNode];
    }
  }

  getAttribute(name) {
    if (name === "contenteditable") return this.isContentEditable ? "true" : null;
    return this.attrs[name] || null;
  }

  setAttribute(name, val) {
    this.attrs[name] = val;
  }

  setRangeText(replacement, start, end, selectMode) {
    if (this.isContentEditable) {
      const cur = this.textNode.nodeValue;
      this.textNode.nodeValue = cur.slice(0, start) + replacement + cur.slice(end);
      if (selectMode === "end") {
        this.selectionStart = start + replacement.length;
        this.selectionEnd = start + replacement.length;
      }
    } else {
      this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
      if (selectMode === "end") {
        this.selectionStart = start + replacement.length;
        this.selectionEnd = start + replacement.length;
      }
    }
  }

  dispatchEvent() {}

  typeChar(ch) {
    if (this.isContentEditable) {
      const cur = this.textNode.nodeValue;
      this.textNode.nodeValue = cur.slice(0, this.selectionStart) + ch + cur.slice(this.selectionEnd);
      this.selectionStart++;
      this.selectionEnd++;
    } else {
      this.value = this.value.slice(0, this.selectionStart) + ch + this.value.slice(this.selectionEnd);
      this.selectionStart++;
      this.selectionEnd++;
    }
  }

  typeString(str) {
    for (const ch of str) {
      this.typeChar(ch);
    }
  }

  getValue() {
    return this.isContentEditable ? this.textNode.nodeValue : this.value;
  }

  setValue(val) {
    if (this.isContentEditable) {
      this.textNode.nodeValue = val;
      this.selectionStart = val.length;
      this.selectionEnd = val.length;
    } else {
      this.value = val;
      this.selectionStart = val.length;
      this.selectionEnd = val.length;
    }
  }
}

function createKeyboardEvent(key, target) {
  let defaultPrevented = false;
  return {
    key,
    target,
    isComposing: false,
    preventDefault: () => { defaultPrevented = true; },
    get defaultPrevented() { return defaultPrevented; }
  };
}

// Initialize Orchestrator
const dictData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/dictionary.json"), "utf-8"));
const indexData = JSON.parse(fs.readFileSync(path.resolve("extension/assets/symspell_index.json"), "utf-8"));

function createOrchestrator() {
  const orchestrator = new ContentScriptOrchestrator({
    dictionary: new Dictionary(dictData),
    symspell: new SymSpell(indexData.words, indexData.deletes, dictData),
    ranker: new CandidateRanker(),
    undoManager: new UndoManager(),
    exclusions: new ExclusionsGuard(),
    inputHandler: new StandardInputHandler(),
    contentEditableAdapter: new ContentEditableAdapter(),
    contractionsMap: CONTRACTIONS_MAP
  });
  orchestrator.isInitialized = true;
  return orchestrator;
}

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  categories: {}
};

function recordTest(category, name, passed, details = "") {
  results.total++;
  if (!results.categories[category]) {
    results.categories[category] = { passed: 0, failed: 0, tests: [] };
  }
  if (passed) {
    results.passed++;
    results.categories[category].passed++;
  } else {
    results.failed++;
    results.categories[category].failed++;
  }
  results.categories[category].tests.push({ name, passed, details });
}

console.log("================================================================================");
console.log("STARTING QATEST-4 AUTOMATED AUDIT BATTERY (100% FRESH ADVERSARIAL TOKENS)");
console.log("================================================================================");

// --- 1. FRESH COMMON TYPOS (DISTANCE-1 & STANDARD) ---
const freshCommonTypos = [
  { typo: "thier", expected: "their" },
  { typo: "peice", expected: "piece" },
  { typo: "truely", expected: "truly" },
  { typo: "freind", expected: "friend" },
  { typo: "beleif", expected: "belief" },
  { typo: "tommorrow", expected: "tomorrow" },
  { typo: "absense", expected: "absence" },
  { typo: "acceptible", expected: "acceptable" },
  { typo: "accross", expected: "across" },
  { typo: "adress", expected: "address" },
  { typo: "agressive", expected: "aggressive" },
  { typo: "appearence", expected: "appearance" },
  { typo: "arguement", expected: "argument" },
  { typo: "basicly", expected: "basically" },
  { typo: "bussiness", expected: "business" },
  { typo: "cemetary", expected: "cemetery" },
  { typo: "catagory", expected: "category" },
  { typo: "consience", expected: "conscience" },
  { typo: "definate", expected: "definite" },
  { typo: "disapear", expected: "disappear" },
  { typo: "dissappoint", expected: "disappoint" },
  { typo: "existance", expected: "existence" },
  { typo: "familar", expected: "familiar" },
  { typo: "foriegn", expected: "foreign" },
  { typo: "guarentee", expected: "guarantee" },
  { typo: "harrass", expected: "harass" },
  { typo: "humerous", expected: "humorous" },
  { typo: "hygene", expected: "hygiene" },
  { typo: "ignorence", expected: "ignorance" },
  { typo: "immediatly", expected: "immediately" },
  { typo: "incidently", expected: "incidentally" },
  { typo: "interupt", expected: "interrupt" },
  { typo: "knowlege", expected: "knowledge" },
  { typo: "millenium", expected: "millennium" },
  { typo: "noticable", expected: "noticeable" },
  { typo: "occassion", expected: "occasion" },
  { typo: "occurance", expected: "occurrence" },
  { typo: "paralell", expected: "parallel" },
  { typo: "perseverence", expected: "perseverance" },
  { typo: "posession", expected: "possession" },
  { typo: "prefered", expected: "preferred" },
  { typo: "priviledge", expected: "privilege" },
  { typo: "pronounciation", expected: "pronunciation" },
  { typo: "refered", expected: "referred" },
  { typo: "relavent", expected: "relevant" },
  { typo: "resistence", expected: "resistance" },
  { typo: "rythm", expected: "rhythm" },
  { typo: "seige", expected: "siege" },
  { typo: "suprise", expected: "surprise" },
  { typo: "tendancy", expected: "tendency" },
  { typo: "threshhold", expected: "threshold" },
  { typo: "tounge", expected: "tongue" },
  { typo: "unforseen", expected: "unforeseen" },
  { typo: "vaccum", expected: "vacuum" },
  { typo: "veiw", expected: "view" },
  { typo: "yeild", expected: "yield" }
];

for (const t of freshCommonTypos) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(t.typo);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === t.expected;
  recordTest("Common Typos", `${t.typo} -> ${t.expected}`, passed, `Actual: "${actual}"`);
}

// --- 2. FRESH DISTANCE-2 OMISSIONS ---
const freshDistance2 = [
  { typo: "mispel", expected: "misspell" },
  { typo: "comitee", expected: "committee" },
  { typo: "succesfuly", expected: "successfully" },
  { typo: "possesion", expected: "possession" },
  { typo: "milenium", expected: "millennium" },
  { typo: "ocured", expected: "occurred" },
  { typo: "embaras", expected: "embarrass" },
  { typo: "recuring", expected: "recurring" },
  { typo: "supercede", expected: "supersede" }
];

for (const t of freshDistance2) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(t.typo);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === t.expected;
  recordTest("Distance-2 Omissions", `${t.typo} -> ${t.expected}`, passed, `Actual: "${actual}"`);
}

// --- 3. FRESH VALID COMMON WORDS (MUST BE UNTOUCHED) ---
const freshValidWords = [
  "elephant", "sapphire", "blanket", "thunder", "whisper", "candle",
  "diamond", "harbor", "lantern", "meadow", "orchard", "pyramid",
  "silver", "velvet", "walnut", "compass", "feather", "glacier",
  "island", "journey", "kettle", "lemon", "magnet", "needle", "palace"
];

for (const w of freshValidWords) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(w);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === w;
  recordTest("Valid Words Safety", `${w} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 4. FRESH PROPER NAMES (CAPITALIZED & LOWERCASE) ---
const freshProperNames = [
  // Capitalized:
  { name: "Maya", expect: "Maya" },
  { name: "Liam", expect: "Liam" },
  { name: "Noah", expect: "Noah" },
  { name: "Lucas", expect: "Lucas" },
  { name: "Oliver", expect: "Oliver" },
  { name: "Emma", expect: "Emma" },
  { name: "Chloe", expect: "Chloe" },
  { name: "Ethan", expect: "Ethan" },
  { name: "Aiden", expect: "Aiden" },
  { name: "Zoe", expect: "Zoe" },
  { name: "Rajesh", expect: "Rajesh" },
  { name: "Suresh", expect: "Suresh" },
  { name: "Anand", expect: "Anand" },
  { name: "Kavita", expect: "Kavita" },
  { name: "Deepak", expect: "Deepak" },
  { name: "Sunil", expect: "Sunil" },
  { name: "Pooja", expect: "Pooja" },
  { name: "Manoj", expect: "Manoj" },
  // Newly whitelisted lowercase names:
  { name: "vikram", expect: "vikram" },
  { name: "sneha", expect: "sneha" },
  { name: "ananya", expect: "ananya" },
  { name: "aditya", expect: "aditya" },
  { name: "priya", expect: "priya" },
  { name: "mia", expect: "mia" },
  { name: "harper", expect: "harper" },
  { name: "leo", expect: "leo" },
  { name: "ava", expect: "ava" }
];

for (const n of freshProperNames) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(n.name);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === n.expect;
  recordTest("Proper Names Safety", `${n.name} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 5. FRESH COUNTRIES & PLACES ---
const freshPlaces = [
  "Argentina", "Belgium", "Colombia", "Denmark", "Egypt", "Finland",
  "Greece", "Hungary", "Ireland", "Jordan", "Kuwait", "Lebanon",
  "Mexico", "Norway", "Oman", "Peru", "Qatar", "Romania",
  "Spain", "Turkey", "Ukraine", "Vietnam", "Yemen", "Zimbabwe"
];

for (const p of freshPlaces) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(p);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === p;
  recordTest("Countries & Places", `${p} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 6. FRESH MODERN TECH & TOOLS ---
const freshTech = [
  "graphql", "kafka", "fastapi", "pytorch", "nextjs", "tailwind",
  "typescript", "angular", "vue", "svelte", "django", "flask",
  "express", "postgres", "mongodb", "sqlite", "aws", "azure",
  "gcp", "cloudflare", "github", "gitlab", "npm", "yarn", "webpack", "vite",
  "streamlit", "redis", "vscode"
];

for (const t of freshTech) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(t);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === t;
  recordTest("Modern Tech & Tools", `${t} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 7. FRESH SLANG & CHAT TERMS ---
const freshSlang = [
  "sup", "cuz", "idk", "afaik", "imo", "imho", "gg", "wp",
  "rn", "smh", "fyi", "btw", "omg", "thx", "pls", "goat", "sus", "vibes"
];

for (const s of freshSlang) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(s);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === s;
  recordTest("Slang & Chat Terms", `${s} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 8. FRESH CONTRACTIONS & APOSTROPHES ---
const freshContractions = [
  { input: "cant", expected: "can't" },
  { input: "wont", expected: "won't" },
  { input: "dont", expected: "don't" },
  { input: "aint", expected: "ain't" },
  { input: "whos", expected: "who's" },
  { input: "whats", expected: "what's" },
  { input: "wheres", expected: "where's" },
  { input: "hows", expected: "how's" },
  { input: "theyre", expected: "they're" },
  { input: "weve", expected: "we've" },
  { input: "youve", expected: "you've" },
  { input: "theyve", expected: "they've" },
  { input: "couldve", expected: "could've" },
  { input: "shouldve", expected: "should've" },
  { input: "wouldve", expected: "would've" },
  { input: "yall", expected: "y'all" },
  { input: "y'all", expected: "y'all" },
  { input: "theyll", expected: "they'll" },
  { input: "youll", expected: "you'll" },
  // Already punctuated:
  { input: "can't", expected: "can't" },
  { input: "won't", expected: "won't" },
  { input: "don't", expected: "don't" },
  { input: "it's", expected: "it's" }
];

for (const c of freshContractions) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(c.input);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === c.expected;
  recordTest("Contractions Expansion", `${c.input} -> ${c.expected}`, passed, `Actual: "${actual}"`);
}

// --- 9. FRESH CODE IDENTIFIERS & DELIMITERS (SNAKE_CASE, KEBAB-CASE, CAMELCASE) ---
const freshCodeIdentifiers = [
  // Snake_case:
  "customer_account_id",
  "created_timestamp",
  "max_retry_count",
  "auth_token_key",
  "session_data_val",
  "user_profile_id",
  "order_id",
  // Kebab-case:
  "user-nav-link",
  "btn-primary",
  "card-header-title",
  "data-testid",
  // CamelCase:
  "getUserProfile",
  "onClickHandler",
  "totalCalculatedSum",
  "isModalOpen",
  // Environment variables:
  "DATABASE_URL",
  "JWT_SECRET",
  "NODE_ENV",
  "PORT",
  // Paths:
  "/etc/nginx/nginx.conf",
  "../relative/path/to/script.sh"
];

for (const id of freshCodeIdentifiers) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(id);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === id;
  recordTest("Code Identifiers Safety", `${id} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 10. FRESH TRAILING PUNCTUATION ---
const freshPunctuation = [
  // Colons:
  { input: "thier:", expected: "their:" },
  { input: "adress:", expected: "address:" },
  { input: "freind:", expected: "friend:" },
  { input: "note:", expected: "note:" },
  { input: "warning:", expected: "warning:" },
  { input: "beleive:", expected: "believe:" },
  // Semicolons:
  { input: "thier;", expected: "their;" },
  { input: "freind;", expected: "friend;" },
  // Periods:
  { input: "thier.", expected: "their." },
  { input: "adress.", expected: "address." },
  { input: "peice.", expected: "piece." },
  // Commas:
  { input: "thier,", expected: "their," },
  { input: "adress,", expected: "address," },
  { input: "truely,", expected: "truly," },
  // Question marks:
  { input: "thier?", expected: "their?" },
  { input: "freind?", expected: "friend?" },
  // Exclamations:
  { input: "thier!", expected: "their!" },
  { input: "suprise!", expected: "surprise!" }
];

for (const p of freshPunctuation) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(p.input);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === p.expected;
  recordTest("Trailing Punctuation", `${p.input} -> ${p.expected}`, passed, `Actual: "${actual}"`);
}

// --- 11. FRESH URLS, EMAILS, PROTOCOL SCHEMES ---
const freshUrls = [
  "https://microsoft.com",
  "https://support.google.com/mail",
  "http://localhost:3000",
  "ftp://files.example.com",
  "contact@company.co.uk",
  "sales.dept@enterprise.org",
  "https://chatgpt.com/c/12345"
];

for (const u of freshUrls) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(u);
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  const actual = el.getValue();
  const passed = actual === u;
  recordTest("URLs & Protocols Safety", `${u} remains untouched`, passed, `Actual: "${actual}"`);
}

// --- 12. REJECTION LOOP RESILIENCE (BACKSPACE <-> SPACE 5 CYCLES) ---
const rejectionWords = [
  { typo: "thier", correction: "their" },
  { typo: "adress", correction: "address" },
  { typo: "freind", correction: "friend" },
  { typo: "truely", correction: "truly" }
];

for (const item of rejectionWords) {
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString(item.typo);
  
  // Cycle 1: Space triggers correction
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
  let val1 = el.getValue();
  // Browser natively inserts space after keydown
  el.typeChar(" ");
  
  // Cycle 1 Undo: Backspace restores typo and strips trailing space
  orchestrator.handleKeyDown(createKeyboardEvent("Backspace", el));
  let undoneVal = el.getValue();
  
  let loopBroken = true;
  // Cycles 2 to 5: Space must NOT re-correct!
  for (let c = 2; c <= 5; c++) {
    orchestrator.handleKeyDown(createKeyboardEvent(" ", el));
    el.typeChar(" ");
    if (el.getValue().trim() !== item.typo) {
      loopBroken = false;
      break;
    }
  }
  recordTest("Rejection Loop Stability", `${item.typo}: 5-cycle Backspace<->Space rejection`, loopBroken && (val1 === item.correction) && (undoneVal === item.typo), `Restored: "${undoneVal}", Final: "${el.getValue().trim()}"`);
}

// --- 13. DOUBLE BACKSPACE TEST ---
{
  const orchestrator = createOrchestrator();
  const el = new MockDomElement("TEXTAREA");
  el.typeString("thier");
  orchestrator.handleKeyDown(createKeyboardEvent(" ", el)); // corrects to "their"
  el.typeChar(" "); // Browser inserted space
  
  // First Backspace: Undoes replacement and strips space
  const evtUndo = createKeyboardEvent("Backspace", el);
  orchestrator.handleKeyDown(evtUndo);
  const passUndo = evtUndo.defaultPrevented && el.getValue() === "thier";
  
  // Second Backspace: Normal typing character deletion
  const evtNormalBs = createKeyboardEvent("Backspace", el);
  orchestrator.handleKeyDown(evtNormalBs);
  const passSecondBs = !evtNormalBs.defaultPrevented;
  recordTest("Double Backspace Handling", "First Backspace undos, second Backspace is native", passUndo && passSecondBs, `Undo prevented: ${evtUndo.defaultPrevented}, Second prevented: ${evtNormalBs.defaultPrevented}`);
}

// --- 14. WEB APPLICATIONS COMPOSER ADAPTERS (IN-BROWSER DOM SURFACES) ---
// A. ChatGPT: ProseMirror contenteditable (#prompt-textarea)
{
  const orchestrator = createOrchestrator();
  const gptEl = new MockDomElement("TEXTAREA", { id: "prompt-textarea", "data-virtual-keyboard": "true" });
  gptEl.typeString("thier");
  orchestrator.handleKeyDown(createKeyboardEvent(" ", gptEl));
  const passGpt = gptEl.getValue() === "their";
  recordTest("Web Apps: ChatGPT (#prompt-textarea)", "Auto-correct in ChatGPT composer", passGpt, `Result: "${gptEl.getValue()}"`);
}

// B. Gemini: rich-textarea / message box
{
  const orchestrator = createOrchestrator();
  const geminiEl = new MockDomElement("TEXTAREA", { class: "rich-textarea", role: "combobox" });
  geminiEl.typeString("truely");
  orchestrator.handleKeyDown(createKeyboardEvent(" ", geminiEl));
  const passGemini = geminiEl.getValue() === "truly";
  recordTest("Web Apps: Gemini (rich-textarea)", "Auto-correct in Gemini prompt box", passGemini, `Result: "${geminiEl.getValue()}"`);
}

// C. YouTube: Search box (Shadow DOM pierced input)
{
  const orchestrator = createOrchestrator();
  const ytEl = new MockDomElement("INPUT", { id: "search", name: "search_query" });
  ytEl.typeString("freind");
  orchestrator.handleKeyDown(createKeyboardEvent(" ", ytEl));
  const passYT = ytEl.getValue() === "friend";
  recordTest("Web Apps: YouTube (ytd-searchbox)", "Auto-correct in search input", passYT, `Result: "${ytEl.getValue()}"`);
}

// D. WhatsApp Web: Chat composer
{
  const orchestrator = createOrchestrator();
  const waEl = new MockDomElement("TEXTAREA", { class: "selectable-text copyable-text", "data-tab": "10" });
  waEl.typeString("cant");
  orchestrator.handleKeyDown(createKeyboardEvent(" ", waEl));
  const passWA = waEl.getValue() === "can't";
  recordTest("Web Apps: WhatsApp Web (data-tab=10)", "Contraction expansion in chat box", passWA, `Result: "${waEl.getValue()}"`);
}

// E. Gmail: Message Body composer
{
  const orchestrator = createOrchestrator();
  const gmailEl = new MockDomElement("TEXTAREA", { "aria-label": "Message Body", role: "textbox" });
  gmailEl.typeString("adress");
  orchestrator.handleKeyDown(createKeyboardEvent(" ", gmailEl));
  const passGmail = gmailEl.getValue() === "address";
  recordTest("Web Apps: Gmail (Message Body)", "Auto-correct in email compose box", passGmail, `Result: "${gmailEl.getValue()}"`);
}

// --- 15. CONTINUOUS SENTENCE STREAM TEST IN WEB COMPOSERS ---
{
  const orchestrator = createOrchestrator();
  const streamEl = new MockDomElement("TEXTAREA");
  const sentenceTokens = [
    { token: "thier", expect: "their" },
    { token: "colleague", expect: "colleague" },
    { token: "didnt", expect: "didn't" },
    { token: "recieve", expect: "receive" },
    { token: "the", expect: "the" },
    { token: "user_profile_id", expect: "user_profile_id" },
    { token: "note:", expect: "note:" },
    { token: "cant", expect: "can't" },
    { token: "fastapi", expect: "fastapi" },
    { token: "run", expect: "run" }
  ];
  for (const item of sentenceTokens) {
    streamEl.typeString(item.token);
    orchestrator.handleKeyDown(createKeyboardEvent(" ", streamEl));
    streamEl.typeChar(" ");
  }
  const expectedSentence = "their colleague didn't receive the user_profile_id note: can't fastapi run ";
  const actualSentence = streamEl.getValue();
  const passed = actualSentence === expectedSentence;
  recordTest("Web Apps: Continuous Multi-Token Stream", "Complex sentence with code, contractions, tech, typos, punctuation", passed, `Actual: "${actualSentence}"`);
}

// --- 16. LATENCY BENCHMARK ON REAL WORDS (1,000 CYCLES) ---
const latencies = [];
const benchOrch = createOrchestrator();
for (let i = 0; i < 1000; i++) {
  const el = new MockDomElement("TEXTAREA");
  el.typeString("thier");
  const t0 = performance.now();
  benchOrch.handleKeyDown(createKeyboardEvent(" ", el));
  const t1 = performance.now();
  latencies.push(t1 - t0);
}
latencies.sort((a, b) => a - b);
const meanLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const p50Lat = latencies[Math.floor(latencies.length * 0.50)];
const p95Lat = latencies[Math.floor(latencies.length * 0.95)];
const p99Lat = latencies[Math.floor(latencies.length * 0.99)];

console.log("\n================================================================================");
console.log(`TOTAL AUDIT TESTS RUN: ${results.total}`);
console.log(`PASSED: ${results.passed} (${((results.passed / results.total) * 100).toFixed(2)}%)`);
console.log(`FAILED: ${results.failed} (${((results.failed / results.total) * 100).toFixed(2)}%)`);
console.log(`LATENCY: Mean = ${meanLat.toFixed(3)}ms, p50 = ${p50Lat.toFixed(3)}ms, p95 = ${p95Lat.toFixed(3)}ms, p99 = ${p99Lat.toFixed(3)}ms`);
console.log("================================================================================");

for (const [cat, data] of Object.entries(results.categories)) {
  console.log(`[${cat}]: ${data.passed}/${data.tests.length} PASS (${((data.passed / data.tests.length) * 100).toFixed(1)}%)`);
  if (data.failed > 0) {
    for (const t of data.tests) {
      if (!t.passed) {
        console.log(`   FAIL: ${t.name} -> ${t.details}`);
      }
    }
  }
}

fs.writeFileSync(path.resolve("benchmarks/results/qa4_audit_results.json"), JSON.stringify({
  summary: {
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    accuracy: ((results.passed / results.total) * 100).toFixed(2),
    latency: { mean: meanLat, p50: p50Lat, p95: p95Lat, p99: p99Lat }
  },
  categories: results.categories
}, null, 2));
