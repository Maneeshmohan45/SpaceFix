import test from "node:test";
import assert from "node:assert/strict";
import { ContentEditableAdapter } from "../../extension/content/dom/content_editable.js";

// Mock Text Node (nodeType === 3)
class MockTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.nodeValue = text;
  }
}

// Mock ContentEditable Element
class MockEditableElement {
  constructor(isEditable = true) {
    this.isContentEditable = isEditable;
    this.tagName = "DIV";
  }
  getAttribute(name) {
    if (name === "contenteditable") return this.isContentEditable ? "true" : "false";
    return null;
  }
}

test("ContentEditableAdapter: detection check", () => {
  const adapter = new ContentEditableAdapter();

  assert.equal(adapter.isContentEditable(new MockEditableElement(true)), true);
  assert.equal(adapter.isContentEditable(new MockEditableElement(false)), false);
  assert.equal(adapter.isContentEditable(null), false);
});

test("ContentEditableAdapter: direct text node replacement (Strategy B)", () => {
  const adapter = new ContentEditableAdapter();
  const textNode = new MockTextNode("Hey this is speling");

  const extracted = {
    word: "speling",
    textNode,
    startIndex: 12,
    endIndex: 19,
    range: null // Strategy A execCommand skipped in Node.js
  };

  const res = adapter.replaceWord(new MockEditableElement(true), "spelling", extracted);

  assert.equal(res.success, true);
  assert.equal(res.strategy, "domTextNode");
  assert.equal(textNode.nodeValue, "Hey this is spelling");
});
