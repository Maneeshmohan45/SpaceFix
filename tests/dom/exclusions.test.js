import test from "node:test";
import assert from "node:assert/strict";
import { ExclusionsGuard } from "../../extension/content/dom/exclusions.js";

// Mock HTML element helper
function mockElement(tag, attrs = {}, classList = []) {
  return {
    tagName: tag.toUpperCase(),
    getAttribute: (name) => attrs[name] || null,
    classList: {
      contains: (cls) => classList.includes(cls)
    },
    parentElement: null
  };
}

test("ExclusionsGuard: input type exclusions", () => {
  const guard = new ExclusionsGuard();

  assert.equal(guard.isElementExcluded(mockElement("input", { type: "password" })), true);
  assert.equal(guard.isElementExcluded(mockElement("input", { type: "email" })), true);
  assert.equal(guard.isElementExcluded(mockElement("input", { type: "url" })), true);
  assert.equal(guard.isElementExcluded(mockElement("input", { type: "number" })), true);
  assert.equal(guard.isElementExcluded(mockElement("input", { type: "tel" })), true);

  // Standard inputs must NOT be excluded
  assert.equal(guard.isElementExcluded(mockElement("input", { type: "text" })), false);
  assert.equal(guard.isElementExcluded(mockElement("input", {})), false);
  assert.equal(guard.isElementExcluded(mockElement("textarea", {})), false);
});

test("ExclusionsGuard: attribute & code editor exclusions", () => {
  const guard = new ExclusionsGuard();

  assert.equal(guard.isElementExcluded(mockElement("textarea", { spellcheck: "false" })), true);
  assert.equal(guard.isElementExcluded(mockElement("input", { autocomplete: "current-password" })), true);
  assert.equal(guard.isElementExcluded(mockElement("pre", {})), true);
  assert.equal(guard.isElementExcluded(mockElement("code", {})), true);

  // Code editor classes
  assert.equal(guard.isElementExcluded(mockElement("div", {}, ["monaco-editor"])), true);
  assert.equal(guard.isElementExcluded(mockElement("div", {}, ["cm-editor"])), true);

  // Search boxes & ChatGPT prompt must NOT be excluded even if developer set spellcheck="false"
  assert.equal(guard.isElementExcluded({ tagName: "INPUT", id: "search", getAttribute: (k) => ({ spellcheck: "false", type: "text" })[k] || null }), false);
  assert.equal(guard.isElementExcluded({ tagName: "DIV", id: "prompt-textarea", isContentEditable: true, getAttribute: (k) => ({ spellcheck: "false" })[k] || null }), false);
});

test("ExclusionsGuard: token exclusions", () => {
  const guard = new ExclusionsGuard();

  // Digits
  assert.equal(guard.isTokenExcluded("w1red"), true);
  assert.equal(guard.isTokenExcluded("v2"), true);

  // URLs & Symbols
  assert.equal(guard.isTokenExcluded("http://example"), true);
  assert.equal(guard.isTokenExcluded("user@domain"), true);
  assert.equal(guard.isTokenExcluded("api/v1"), true);

  // Snake_case & CamelCase
  assert.equal(guard.isTokenExcluded("get_user_data"), true);
  assert.equal(guard.isTokenExcluded("userId"), true);
  assert.equal(guard.isTokenExcluded("parseData"), true);

  // Acronyms
  assert.equal(guard.isTokenExcluded("NASA"), true);
  assert.equal(guard.isTokenExcluded("API"), true);

  // Normal words must NOT be excluded
  assert.equal(guard.isTokenExcluded("speling"), false);
  assert.equal(guard.isTokenExcluded("hello"), false);
  assert.equal(guard.isTokenExcluded("don't"), false);
});
