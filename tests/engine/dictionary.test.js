import test from "node:test";
import assert from "node:assert/strict";
import { Dictionary } from "../../extension/content/engine/dictionary.js";

test("Dictionary: membership lookup", () => {
  const dict = new Dictionary({
    "hello": 1000000,
    "world": 800000,
    "don't": 500000
  });

  assert.equal(dict.has("hello"), true);
  assert.equal(dict.has("HELLO"), true);
  assert.equal(dict.has("world"), true);
  assert.equal(dict.has("don't"), true);
  assert.equal(dict.has("speling"), false);
  assert.equal(dict.has(""), false);
  assert.equal(dict.has(null), false);
});

test("Dictionary: frequency lookup", () => {
  const dict = new Dictionary({
    "hello": 1000000,
    "world": 800000
  });

  assert.equal(dict.getFrequency("hello"), 1000000);
  assert.equal(dict.getFrequency("HELLO"), 1000000);
  assert.equal(dict.getFrequency("missing"), 0);
});

test("Dictionary: case restoration", () => {
  const dict = new Dictionary();

  // All uppercase
  assert.equal(dict.restoreCase("HELLO", "hello"), "HELLO");
  assert.equal(dict.restoreCase("SPELING", "spelling"), "SPELLING");

  // Capitalized
  assert.equal(dict.restoreCase("Speling", "spelling"), "Spelling");
  assert.equal(dict.restoreCase("Teh", "the"), "The");

  // Lowercase
  assert.equal(dict.restoreCase("speling", "spelling"), "spelling");
});
