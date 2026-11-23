/**
 * SpaceFix V1 - Standard Input Handler Module (Audited)
 * Handles word extraction and atomic text replacement for <input> and <textarea>.
 *
 * Fixes:
 * - [HIGH-04]: Handles punctuation at sentence/clause boundaries ("speling. " -> "spelling. ").
 * - [MED-03]: Strips leading/trailing quotes so possessives/quotes are not corrupted.
 */

class StandardInputHandler {
  /**
   * Extracts the word immediately preceding the cursor, skipping trailing punctuation.
   *
   * @param {HTMLInputElement|HTMLTextAreaElement} element
   * @returns {{ word: string, startIndex: number, endIndex: number } | null}
   */
  extractPrecedingWord(element) {
    if (!element || typeof element.selectionStart !== "number") {
      return null;
    }

    const cursor = element.selectionStart;
    const value = element.value || "";

    if (cursor === 0 || cursor > value.length) {
      return null;
    }

    // Safety: If character immediately following cursor is a letter,
    // user is in the middle of a word. Do not auto-correct!
    if (cursor < value.length) {
      const nextChar = value.charAt(cursor);
      if (/[a-zA-Z]/.test(nextChar)) {
        return null;
      }
    }

    // Fix [BUG-QA2-02 & NEW-02]: Check if cursor is part of a URL, domain, email, or dotted path
    // Note: Protocol schemes require '://' so trailing colons (e.g. 'Note:', 'beleive:') are not falsely blocked
    let tokenStart = cursor - 1;
    while (tokenStart >= 0 && !/\s/.test(value.charAt(tokenStart))) {
      tokenStart--;
    }
    tokenStart++;
    const fullToken = value.slice(tokenStart, cursor);
    if (/[/@]|www\.|\w+\.\w+|[a-zA-Z0-9]+:\/\//.test(fullToken)) {
      return null;
    }

    let end = cursor;
    let trailingPunct = "";

    // Fix [HIGH-04]: Skip any trailing punctuation (.,!?;:") between word and cursor
    while (end > 0 && /[.,!?;:"]/.test(value.charAt(end - 1))) {
      trailingPunct = value.charAt(end - 1) + trailingPunct;
      end--;
    }

    if (end === 0) {
      return null;
    }

    let start = end - 1;
    // Must be preceded by a valid letter
    if (!/[a-zA-Z']/.test(value.charAt(start))) {
      return null;
    }

    while (start >= 0 && /[a-zA-Z']/.test(value.charAt(start))) {
      start--;
    }
    start++; // Position of first letter

    // Fix [NEW-01]: Check if word is preceded by underscore, hyphen, or slash (e.g. user_profile_id, order-id, path/file)
    if (start > 0) {
      const prevChar = value.charAt(start - 1);
      if (prevChar === "_" || prevChar === "-" || prevChar === "/" || prevChar === "\\") {
        return null;
      }
    }

    let rawWord = value.slice(start, end);

    // Fix [MED-03]: Strip leading/trailing single quotes
    let trimmedWord = rawWord;
    let actualStart = start;
    let actualEnd = end;

    if (trimmedWord.startsWith("'")) {
      trimmedWord = trimmedWord.slice(1);
      actualStart += 1;
    }
    if (trimmedWord.endsWith("'")) {
      trimmedWord = trimmedWord.slice(0, -1);
      actualEnd -= 1;
    }

    if (!trimmedWord || !/[a-zA-Z]/.test(trimmedWord)) {
      return null;
    }

    const result = {
      word: trimmedWord,
      startIndex: actualStart,
      endIndex: actualEnd
    };
    if (trailingPunct) {
      result.trailingPunct = trailingPunct;
    }
    return result;
  }

  /**
   * Replaces the target word with the replacement word in-place,
   * cleanly setting the cursor to the end of the new word (past any trailing punctuation).
   *
   * @param {HTMLInputElement|HTMLTextAreaElement} element
   * @param {string} replacementWord
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {string} [trailingPunct=""]
   * @returns {boolean} True if successfully replaced
   */
  replaceWord(element, replacementWord, startIndex, endIndex, trailingPunct = "") {
    if (!element || typeof replacementWord !== "string") {
      return false;
    }

    const finalPos = startIndex + replacementWord.length + (trailingPunct ? trailingPunct.length : 0);

    if (typeof element.setRangeText === "function") {
      element.setRangeText(replacementWord, startIndex, endIndex, "end");
      element.selectionStart = finalPos;
      element.selectionEnd = finalPos;
    } else {
      const val = element.value || "";
      element.value = val.slice(0, startIndex) + replacementWord + val.slice(endIndex);
      element.selectionStart = finalPos;
      element.selectionEnd = finalPos;
    }

    if (typeof InputEvent !== "undefined") {
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: false,
          inputType: "insertReplacementText",
          data: replacementWord
        })
      );
    } else if (typeof Event !== "undefined") {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (typeof element.dispatchEvent === "function") {
      element.dispatchEvent({ type: "input", bubbles: true });
    }

    return true;
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.StandardInputHandler = StandardInputHandler;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { StandardInputHandler };
}
