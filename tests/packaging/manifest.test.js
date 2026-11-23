import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Manifest V3: Packaging & Security Verification", () => {
  const manifestPath = path.resolve("extension/manifest.json");
  assert.ok(fs.existsSync(manifestPath), "manifest.json must exist");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  // Check 1: Manifest Version
  assert.equal(manifest.manifest_version, 3, "Must be Manifest V3");

  // Check 2: Strict Offline Security (Zero Network Permissions)
  assert.deepEqual(manifest.permissions, ["storage"], "Permissions must strictly contain ONLY ['storage']");
  assert.equal(manifest.host_permissions, undefined, "Must NOT request any host permissions");

  // Check 3: Content script files exist
  assert.ok(Array.isArray(manifest.content_scripts), "content_scripts must be an array");
  const scripts = manifest.content_scripts[0].js;
  for (const scriptRelPath of scripts) {
    const fullPath = path.resolve("extension", scriptRelPath);
    assert.ok(fs.existsSync(fullPath), `Declared content script missing: ${scriptRelPath}`);
  }

  // Check 4: Background service worker exists
  assert.ok(manifest.background?.service_worker, "Service worker must be declared");
  const swPath = path.resolve("extension", manifest.background.service_worker);
  assert.ok(fs.existsSync(swPath), "Service worker file missing");

  // Check 5: Popup files exist
  const popupHtml = path.resolve("extension", manifest.action.default_popup);
  assert.ok(fs.existsSync(popupHtml), "popup.html missing");

  // Check 6: Web accessible resources exist
  assert.ok(Array.isArray(manifest.web_accessible_resources));
  const resources = manifest.web_accessible_resources[0].resources;
  for (const resPath of resources) {
    const fullPath = path.resolve("extension", resPath);
    assert.ok(fs.existsSync(fullPath), `Declared asset missing: ${resPath}`);
  }
});

test("Manifest V3: Firefox Packaging & Security Verification", () => {
  const manifestPath = path.resolve("extension_firefox/manifest.json");
  assert.ok(fs.existsSync(manifestPath), "extension_firefox/manifest.json must exist");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  // Check 1: Manifest Version
  assert.equal(manifest.manifest_version, 3, "Firefox must be Manifest V3");

  // Check 2: Gecko Settings for Mozilla AMO
  assert.ok(manifest.browser_specific_settings?.gecko, "browser_specific_settings.gecko must exist");
  assert.equal(manifest.browser_specific_settings.gecko.id, "spacefix@maneeshmohan.com", "AMO ID must match specification");
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "109.0", "Minimum Firefox version must be 109.0");

  // Check 3: Strict Offline Security (Zero Network Permissions)
  assert.deepEqual(manifest.permissions, ["storage"], "Permissions must strictly contain ONLY ['storage']");
  assert.equal(manifest.host_permissions, undefined, "Must NOT request any host permissions");

  // Check 4: Background scripts array
  assert.ok(Array.isArray(manifest.background?.scripts), "Firefox background.scripts must be an array");
  const bgPath = path.resolve("extension_firefox", manifest.background.scripts[0]);
  assert.ok(fs.existsSync(bgPath), "Firefox background script missing");

  // Check 5: Content script files exist
  assert.ok(Array.isArray(manifest.content_scripts), "content_scripts must be an array");
  const scripts = manifest.content_scripts[0].js;
  for (const scriptRelPath of scripts) {
    const fullPath = path.resolve("extension_firefox", scriptRelPath);
    assert.ok(fs.existsSync(fullPath), `Declared content script missing: ${scriptRelPath}`);
  }

  // Check 6: Popup files exist
  const popupHtml = path.resolve("extension_firefox", manifest.action.default_popup);
  assert.ok(fs.existsSync(popupHtml), "popup.html missing");

  // Check 7: Web accessible resources exist
  assert.ok(Array.isArray(manifest.web_accessible_resources));
  const resources = manifest.web_accessible_resources[0].resources;
  for (const resPath of resources) {
    const fullPath = path.resolve("extension_firefox", resPath);
    assert.ok(fs.existsSync(fullPath), `Declared asset missing: ${resPath}`);
  }
});
