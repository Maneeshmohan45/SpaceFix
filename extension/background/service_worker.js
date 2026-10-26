/**
 * SpaceFix V1 - Background Service Worker
 * Manages extension lifecycle and initial storage state.
 * NOTE: This worker is strictly EXCLUDED from the keystroke path to prevent latency.
 */

chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage defaults if not already present
  chrome.storage.local.get(["enabled", "whitelist", "stats"], (res) => {
    const defaults = {};

    if (res.enabled === undefined) {
      defaults.enabled = true;
    }
    if (!Array.isArray(res.whitelist)) {
      defaults.whitelist = [];
    }
    if (!res.stats) {
      defaults.stats = { corrections: 0, undos: 0 };
    }

    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });

  console.log("SpaceFix V1 installed and initialized (100% offline).");
});
