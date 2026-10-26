/**
 * SpaceFix V1 - Undo Manager Module (Audited)
 * Implements an atomic single-step Backspace-to-undo state machine.
 *
 * Fixes:
 * - [HIGH-01]: Atomically removes the trailing phantom space on undo.
 * - [CRIT-03]: Supports contenteditable elements cleanly; never calls preventDefault on failure.
 */

class UndoManager {
  constructor() {
    this.state = null;
  }

  /**
   * Records an auto-correction event into the undo buffer.
   * @param {HTMLElement} element
   * @param {string} originalWord
   * @param {string} replacedWord
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {boolean} [isContentEditable=false]
   * @param {Object} [ceExtracted=null]
   */
  record(element, originalWord, replacedWord, startIndex, endIndex, isContentEditable = false, ceExtracted = null) {
    this.state = {
      element,
      originalWord,
      replacedWord,
      startIndex,
      endIndex,
      isContentEditable,
      ceExtracted,
      timestamp: Date.now()
    };
  }

  /**
   * Checks if an undo operation is currently valid for the given element.
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  canUndo(element) {
    if (!this.state) return false;
    if (this.state.element !== element) return false;
    return true;
  }

  /**
   * Executes the atomic undo.
   * Returns true ONLY if the text was actually restored.
   *
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  undo(element) {
    if (!this.canUndo(element)) {
      return false;
    }

    const { originalWord, startIndex, replacedWord, isContentEditable, ceExtracted } = this.state;

    // ContentEditable Undo Path
    if (isContentEditable) {
      try {
        if (typeof document !== "undefined" && typeof document.execCommand === "function") {
          const success = document.execCommand("undo", false, null);
          if (success) {
            this.clear();
            return true;
          }
        }

        // Direct TextNode fallback for contenteditable
        if (ceExtracted && ceExtracted.textNode) {
          const node = ceExtracted.textNode;
          const currentVal = node.nodeValue || "";
          
          // Check if space was inserted after replacedWord
          let replaceLen = replacedWord.length;
          if (currentVal.charAt(startIndex + replaceLen) === " ") {
            replaceLen += 1; // Also remove the trailing space
          }

          node.nodeValue = currentVal.slice(0, startIndex) + originalWord + currentVal.slice(startIndex + replaceLen);

          if (globalThis.getSelection && document.createRange) {
            const sel = globalThis.getSelection();
            const range = document.createRange();
            range.setStart(node, startIndex + originalWord.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          this.clear();
          return true;
        }
      } catch {
        // If contenteditable undo fails, do not preventDefault
        this.clear();
        return false;
      }
    }

    // Standard Input / Textarea Path
    const currentVal = element.value || "";
    const sliceAtPos = currentVal.slice(startIndex, startIndex + replacedWord.length);

    if (sliceAtPos !== replacedWord) {
      this.clear();
      return false;
    }

    // Fix [HIGH-01]: Check if trailing space exists right after replacedWord
    let endPos = startIndex + replacedWord.length;
    if (currentVal.charAt(endPos) === " ") {
      endPos += 1; // Atomically remove the space created on spacebar keydown!
    }

    if (typeof element.setRangeText === "function") {
      element.setRangeText(originalWord, startIndex, endPos, "end");
      const newPos = startIndex + originalWord.length;
      element.selectionStart = newPos;
      element.selectionEnd = newPos;
    } else {
      element.value = currentVal.slice(0, startIndex) + originalWord + currentVal.slice(endPos);
      const newPos = startIndex + originalWord.length;
      element.selectionStart = newPos;
      element.selectionEnd = newPos;
    }

    if (typeof Event !== "undefined") {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (typeof element.dispatchEvent === "function") {
      element.dispatchEvent({ type: "input", bubbles: true });
    }

    this.clear();
    return true;
  }

  /**
   * Purges the active undo state.
   */
  clear() {
    this.state = null;
  }
}

globalThis.SpaceFix = globalThis.SpaceFix || globalThis.SpellCorrector || {};
globalThis.SpellCorrector = globalThis.SpaceFix;
globalThis.SpaceFix.UndoManager = UndoManager;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { UndoManager };
}
