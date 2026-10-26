import test from "node:test";
import assert from "node:assert/strict";
import { StandardInputHandler } from "../../extension/content/dom/input_handler.js";

// Mock Input Element with standard DOM selection and setRangeText
class MockTextInput {
  constructor(initialValue = "", initialCursor = 0) {
    this.tagName = "TEXTAREA";
    this.value = initialValue;
    this.selectionStart = initialCursor;
    this.selectionEnd = initialCursor;
    this.dispatchedEvents = [];
  }

  setRangeText(replacement, start, end, selectMode) {
    this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
    if (selectMode === "end") {
      this.selectionStart = start + replacement.length;
      this.selectionEnd = start + replacement.length;
    }
  }

  dispatchEvent(event) {
    this.dispatchedEvents.push(event);
  }
}

test("StandardInputHandler: word extraction boundaries", () => {
  const handler = new StandardInputHandler();

  // 1. Cursor at end of word: "hello" | -> extracts "hello"
  const input1 = new MockTextInput("hello", 5);
  const res1 = handler.extractPrecedingWord(input1);
  assert.deepEqual(res1, { word: "hello", startIndex: 0, endIndex: 5 });

  // 2. Cursor after space: "hello " | -> returns null (cannot extract word from space)
  const input2 = new MockTextInput("hello ", 6);
  assert.equal(handler.extractPrecedingWord(input2), null);

  // 3. Middle of word: "hel|lo" -> returns null (editing inside word)
  const input3 = new MockTextInput("hello", 3);
  assert.equal(handler.extractPrecedingWord(input3), null);

  // 4. Multiple words: "first second" at cursor 12 -> extracts "second"
  const input4 = new MockTextInput("first second", 12);
  const res4 = handler.extractPrecedingWord(input4);
  assert.deepEqual(res4, { word: "second", startIndex: 6, endIndex: 12 });

  // 5. Word with contraction: "don't" at cursor 5 -> extracts "don't"
  const input5 = new MockTextInput("don't", 5);
  const res5 = handler.extractPrecedingWord(input5);
  assert.deepEqual(res5, { word: "don't", startIndex: 0, endIndex: 5 });
});

test("StandardInputHandler: atomic replacement & cursor placement", () => {
  const handler = new StandardInputHandler();
  const input = new MockTextInput("This is speling", 15);

  const extracted = handler.extractPrecedingWord(input);
  assert.equal(extracted.word, "speling");

  const success = handler.replaceWord(input, "spelling", extracted.startIndex, extracted.endIndex);
  assert.equal(success, true);

  // Value must be updated
  assert.equal(input.value, "This is spelling");

  // Cursor must be positioned exactly at end of replacement word (index 16)
  assert.equal(input.selectionStart, 16);
  assert.equal(input.selectionEnd, 16);

  // InputEvent dispatched
  assert.equal(input.dispatchedEvents.length, 1);
  assert.equal(input.dispatchedEvents[0].type, "input");
});
