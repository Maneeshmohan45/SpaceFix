import test from "node:test";
import assert from "node:assert/strict";
import { UndoManager } from "../../extension/content/undo_manager.js";

class MockInput {
  constructor(val, cursor) {
    this.value = val;
    this.selectionStart = cursor;
    this.selectionEnd = cursor;
  }
  setRangeText(replacement, start, end, selectMode) {
    this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
    if (selectMode === "end") {
      this.selectionStart = start + replacement.length;
      this.selectionEnd = start + replacement.length;
    }
  }
  dispatchEvent() {}
}

test("UndoManager: atomic undo reverts replacement", () => {
  const undoMgr = new UndoManager();
  // Simulated state: "speling" was auto-corrected to "spelling"
  const input = new MockInput("This is spelling", 16);

  undoMgr.record(input, "speling", "spelling", 8, 16);
  assert.equal(undoMgr.canUndo(input), true);

  // Trigger undo
  const success = undoMgr.undo(input);
  assert.equal(success, true);

  // Value must be reverted to original typo!
  assert.equal(input.value, "This is speling");

  // Caret must be placed right after reverted typo (index 15)
  assert.equal(input.selectionStart, 15);

  // Undo is consumed -> subsequent canUndo must be false
  assert.equal(undoMgr.canUndo(input), false);
});

test("UndoManager: invalidation on different element or clear", () => {
  const undoMgr = new UndoManager();
  const input1 = new MockInput("hello", 5);
  const input2 = new MockInput("world", 5);

  undoMgr.record(input1, "hllo", "hello", 0, 5);
  assert.equal(undoMgr.canUndo(input1), true);
  assert.equal(undoMgr.canUndo(input2), false);

  // Clear purges state
  undoMgr.clear();
  assert.equal(undoMgr.canUndo(input1), false);
});
