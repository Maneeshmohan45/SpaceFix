/**
 * SpaceFix V1 - Exclusions Guard Module (Audited)
 *
 * Fixes:
 * - [HIGH-02]: Allows all-caps misspellings (e.g. 'SPELING' -> 'SPELLING') while preserving acronym safety.
 */

class ExclusionsGuard {
  constructor(options = {}) {
    this.excludedInputTypes = new Set([
      "password",
      "email",
      "url",
      "number",
      "tel",
      "date",
      "datetime-local",
      "color",
      "file"
    ]);

    this.codeClassNames = [
      "monaco-editor",
      "ace_editor",
      "cm-editor",
      "xterm",
      "terminal",
      "prism-code"
    ];

    // Known acronyms that should never be spell-checked
    this.knownAcronyms = new Set([
      "API", "APIS", "UI", "UX", "URL", "URLS", "HTML", "CSS", "JS", "SQL",
      "ID", "IDS", "AI", "ML", "CEO", "CTO", "CFO", "USA", "UK", "NASA",
      "IP", "TCP", "UDP", "HTTP", "HTTPS", "SSH", "SSL", "TLS", "DNS"
    ]);
  }

  /**
   * Determines whether an HTML element should be excluded.
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isElementExcluded(element) {
    if (!element) return true;

    // Handle text nodes
    if (element.nodeType === 3) {
      element = element.parentElement;
      if (!element) return true;
    }

    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    if (tagName === "input") {
      const inputType = (element.getAttribute("type") || "text").toLowerCase();
      if (this.excludedInputTypes.has(inputType)) {
        return true;
      }
    }

    // Check spellcheck="false" ONLY if it is not a search box or contenteditable editor
    // (Search engines like YouTube/Google and chat interfaces set spellcheck="false" to suppress browser squiggles)
    if (element.getAttribute && element.getAttribute("spellcheck") === "false") {
      const elId = element.id || (element.getAttribute && element.getAttribute("id")) || "";
      const isSearchOrPrompt = elId === "search" || 
                               elId === "prompt-textarea" || 
                               element.getAttribute("type") === "search" || 
                               element.getAttribute("name") === "search_query" || 
                               element.getAttribute("role") === "combobox" || 
                               Boolean(element.isContentEditable) || 
                               Boolean(element.closest && element.closest('[contenteditable="true"]'));
      if (!isSearchOrPrompt) {
        return true;
      }
    }

    const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase();
    if (autocomplete.includes("password")) {
      return true;
    }

    if (tagName === "pre" || tagName === "code") {
      return true;
    }

    let current = element;
    let depth = 0;
    while (current && depth < 6) {
      if (current.classList) {
        for (const codeClass of this.codeClassNames) {
          if (current.classList.contains(codeClass)) {
            return true;
          }
        }
      }
      current = current.parentElement;
      depth++;
    }

    return false;
  }

  /**
   * Determines whether an extracted word token should be excluded.
   * @param {string} token
   * @returns {boolean}
   */
  isTokenExcluded(token) {
    if (!token || token.length === 0) return true;

    // 1. Digits
    if (/\d/.test(token)) return true;

    // 2. URL or symbols
    if (/[@\/\\#_=\$\+\*\(\)\[\]\{\}]/.test(token)) return true;

    // 3. Snake_case
    if (token.includes("_")) return true;

    // 4. CamelCase
    if (/[a-z][A-Z]/.test(token)) return true;

    // 5. Fix [HIGH-02]: Only exclude if it is a known acronym
    if (token.length >= 2 && token === token.toUpperCase()) {
      if (this.knownAcronyms.has(token)) {
        return true;
      }
    }

    return false;
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.ExclusionsGuard = ExclusionsGuard;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ExclusionsGuard };
}
