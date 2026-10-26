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
