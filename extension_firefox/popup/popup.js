/**
 * SpaceFix V1 - Popup Controller
 * Manages enabled state, statistics display, and the user's personal whitelist.
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggle-enabled");
  const statusIndicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");
  const statCorrections = document.getElementById("stat-corrections");
  const statUndos = document.getElementById("stat-undos");
  const whitelistInput = document.getElementById("whitelist-input");
  const addWhitelistBtn = document.getElementById("add-whitelist-btn");
  const whitelistTags = document.getElementById("whitelist-tags");

  let currentWhitelist = [];

  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusIndicator.classList.add("active");
      statusText.textContent = "Active on this page";
    } else {
      statusIndicator.classList.remove("active");
      statusText.textContent = "Disabled";
    }
  }

  function renderWhitelist(list) {
    whitelistTags.innerHTML = "";
    if (!list || list.length === 0) {
      whitelistTags.innerHTML = "<span style='font-size:0.75rem; color:#64748b;'>No custom words added yet.</span>";
      return;
    }

    list.forEach((word) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = word;

      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = " ×";
      removeBtn.addEventListener("click", () => removeWord(word));

      tag.appendChild(removeBtn);
      whitelistTags.appendChild(tag);
    });
  }

  function addWord() {
    const raw = whitelistInput.value.trim().toLowerCase();
    if (!raw) return;

    if (!currentWhitelist.includes(raw)) {
      currentWhitelist.push(raw);
      chrome.storage.local.set({ whitelist: currentWhitelist }, () => {
        renderWhitelist(currentWhitelist);
        whitelistInput.value = "";
      });
    }
  }

  function removeWord(word) {
    currentWhitelist = currentWhitelist.filter((w) => w !== word);
    chrome.storage.local.set({ whitelist: currentWhitelist }, () => {
      renderWhitelist(currentWhitelist);
    });
  }

  // 1. Load initial state
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["enabled", "stats", "whitelist"], (res) => {
      const isEnabled = res.enabled !== false;
      toggleEnabled.checked = isEnabled;
      updateStatusUI(isEnabled);

      if (res.stats) {
        statCorrections.textContent = res.stats.corrections || 0;
        statUndos.textContent = res.stats.undos || 0;
      }

      currentWhitelist = Array.isArray(res.whitelist) ? res.whitelist : [];
      renderWhitelist(currentWhitelist);
    });

    // 2. Event listener for toggle switch
    toggleEnabled.addEventListener("change", () => {
      const isEnabled = toggleEnabled.checked;
      chrome.storage.local.set({ enabled: isEnabled }, () => {
        updateStatusUI(isEnabled);
      });
    });

    // 3. Whitelist button & Enter key
    addWhitelistBtn.addEventListener("click", addWord);
    whitelistInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addWord();
    });
  }
});
