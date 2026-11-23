/**
 * SpaceFix V1 - Experimental ContentEditable Adapter (Phase 1B)
 * Explicitly isolated from Phase 1A to preserve stable input/textarea behavior.
 * Evaluates multiple strategies per editor family without assuming a single universal solution.
 */

class ContentEditableAdapter {
  constructor(options = {}) {
    this.name = "ContentEditableAdapter";
    this.experimental = true;
  }

  /**
   * Checks if an element is a rich-text contenteditable surface.
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isContentEditable(element) {
    if (!element) return false;
    return Boolean(element.isContentEditable || element.getAttribute?.("contenteditable") === "true");
  }

  /**
   * Extracts the word token immediately preceding the cursor in a contenteditable node.
   * Uses window.getSelection() and DOM Range API.
   *
   * @param {HTMLElement} activeElement
   * @returns {{ word: string, textNode: Text, startIndex: number, endIndex: number, range: Range } | null}
   */
  extractPrecedingWord(activeElement) {
    const sel = globalThis.getSelection ? globalThis.getSelection() : null;
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) {
      return null;
    }

    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;

    // In some contenteditable editors, selection container can be the parent Element
    if (node && node.nodeType === 1 && node.childNodes.length > 0) {
      const child = node.childNodes[Math.max(0, offset - 1)];
      if (child && child.nodeType === 3) {
        node = child;
        offset = node.nodeValue ? node.nodeValue.length : 0;
      }
    }

    // Must be typing inside a DOM Text node (Node.TEXT_NODE === 3)
    if (!node || node.nodeType !== 3) {
      return null;
    }

    const text = node.nodeValue || "";

    if (offset === 0 || offset > text.length) {
      return null;
    }

    // Safety: If character immediately following cursor is a letter, user is in middle of a word
    if (offset < text.length && /[a-zA-Z]/.test(text.charAt(offset))) {
      return null;
    }

    let start = offset - 1;
    if (!/[a-zA-Z']/.test(text.charAt(start))) {
      return null;
    }

    while (start >= 0 && /[a-zA-Z']/.test(text.charAt(start))) {
      start--;
    }
    start++;

    const word = text.slice(start, offset);
    if (!word || !/[a-zA-Z]/.test(word)) {
      return null;
    }

    // Create a precise DOM Range spanning exactly the target word
    let wordRange = null;
    if (typeof document !== "undefined" && document.createRange) {
      wordRange = document.createRange();
      wordRange.setStart(node, start);
      wordRange.setEnd(node, offset);
    }

    return {
      word,
      textNode: node,
      startIndex: start,
      endIndex: offset,
      range: wordRange
    };
  }

  /**
   * Attempts replacement using Strategy A: document.execCommand('insertText')
   * Preserves browser undo stack and caret.
   * @private
   */
  _replaceViaExecCommand(wordRange, replacement) {
    try {
      const sel = globalThis.getSelection();
      sel.removeAllRanges();
      sel.addRange(wordRange);

      const success = document.execCommand("insertText", false, replacement);
      return Boolean(success);
    } catch {
      return false;
    }
  }

  /**
   * Attempts replacement using Strategy B: Direct DOM TextNode manipulation
   * Used as fallback if execCommand is blocked or disabled.
   * @private
   */
  _replaceViaDomTextNode(textNode, start, end, replacement, container = null) {
    try {
      const currentVal = textNode.nodeValue || "";
      textNode.nodeValue = currentVal.slice(0, start) + replacement + currentVal.slice(end);

      // Restore caret position
      if (globalThis.getSelection && document.createRange) {
        const sel = globalThis.getSelection();
        const newRange = document.createRange();
        newRange.setStart(textNode, start + replacement.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }

      // Dispatch input event so virtual-DOM frameworks (ProseMirror, Lexical, Draft.js) sync their internal state
      if (container && typeof container.dispatchEvent === "function") {
        try {
          const evt = (typeof InputEvent !== "undefined")
            ? new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertReplacementText", data: replacement })
            : new Event("input", { bubbles: true });
          container.dispatchEvent(evt);
        } catch (_) {}
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes word replacement on contenteditable element with graceful fallback.
   *
   * @param {HTMLElement} activeElement
   * @param {string} replacement
   * @param {Object} extractedData - The object returned by extractPrecedingWord
   * @returns {{ success: boolean, strategy: string }}
   */
  replaceWord(activeElement, replacement, extractedData) {
    if (!extractedData || !replacement) {
      return { success: false, strategy: "none" };
    }

    const { range, textNode, startIndex, endIndex } = extractedData;

    // Focus the contenteditable container before executing command
    const container = (activeElement && activeElement.closest) 
      ? (activeElement.closest('[contenteditable="true"]') || activeElement) 
      : activeElement;
    if (container && typeof container.focus === "function") {
      try { container.focus(); } catch (_) {}
    }

    // Strategy A: execCommand('insertText')
    if (range && typeof document !== "undefined" && typeof document.execCommand === "function") {
      const execSuccess = this._replaceViaExecCommand(range, replacement);
      if (execSuccess) {
        return { success: true, strategy: "execCommand" };
      }
    }

    // Strategy B: Fallback to direct TextNode slice
    if (textNode) {
      const domSuccess = this._replaceViaDomTextNode(textNode, startIndex, endIndex, replacement, container);
      if (domSuccess) {
        return { success: true, strategy: "domTextNode" };
      }
    }

    return { success: false, strategy: "failed" };
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.ContentEditableAdapter = ContentEditableAdapter;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ContentEditableAdapter };
}
