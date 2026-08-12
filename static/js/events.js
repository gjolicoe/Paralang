function selectedEnvUsesTextInputs(env) {
  const option = Array.from(envSelect.options).find(item => item.value === env);
  return option?.dataset.sourceType === "url-input";
}

function setViewControlButtonActive(buttonId, isActive) {
  const button = document.getElementById(buttonId);

  if (!button) return;

  button.classList.toggle("is-active", Boolean(isActive));
}

envSelect.addEventListener("change", () => {
  const selectedEnv = envSelect.value;

  if (!selectedEnvUsesTextInputs(selectedEnv)) {
    rebuildYearDropdown();
  }

  if (selectedEnvUsesTextInputs(selectedEnv)) {
    leftSelect.value = "";
    rightSelect.value = "";

    const leftResolvedFile = document.getElementById("leftResolvedFile");
    const rightResolvedFile = document.getElementById("rightResolvedFile");

    if (leftResolvedFile) leftResolvedFile.value = "";
    if (rightResolvedFile) rightResolvedFile.value = "";
  }

  updateReviewIssueButtonsState();
  updatePageInputLabels();

  document.querySelector(".toolbar").submit();
});

yearSelect.addEventListener("change", () => {
    // Reload the app so the page dropdowns are rebuilt from the selected year.
    document.querySelector(".toolbar").submit();
});

leftFrame.addEventListener("load", event => {
    frameLoaded(event);
    refreshClientTableNumberIssues();
});
rightFrame.addEventListener("load", event => {
    frameLoaded(event);
    refreshClientTableNumberIssues();
});

document.getElementById("rightBack").addEventListener("click", () => {
    manualRightSyncOffset -= 1;
    syncToElement(selectedElementIndex);
    refreshClientTableNumberIssues();
});

document.getElementById("rightForward").addEventListener("click", () => {
    manualRightSyncOffset += 1;
    syncToElement(selectedElementIndex);
    refreshClientTableNumberIssues();
});

document.getElementById("resetSyncOffset").addEventListener("click", () => {
    manualRightSyncOffset = 0;
    theoreticalRightSyncOffset = 0;
    lastAutoSyncedRightIndex = selectedElementIndex;
    syncToElement(selectedElementIndex);
    refreshClientTableNumberIssues();
});

document.getElementById("toggleAutoSync").addEventListener("click", () => {
    autoSyncEnabled = !autoSyncEnabled;
    setViewControlButtonActive("toggleAutoSync", autoSyncEnabled);

    document.getElementById("toggleAutoSync").textContent =
        autoSyncEnabled ? "Auto-sync on" : "Auto-sync off";

    theoreticalRightSyncOffset = 0;
    clearSyncMapCache();

    syncToElement(selectedElementIndex);
    refreshClientTableNumberIssues();
});

document.getElementById("toggleFocusMode").addEventListener("click", () => {
  focusModeEnabled = !focusModeEnabled;
  setViewControlButtonActive("toggleFocusMode", focusModeEnabled);

  document.getElementById("toggleFocusMode").textContent =
    focusModeEnabled ? "Exit focus" : "Focus mode";

  if (!focusModeEnabled) {
    clearFocusMode(leftFrame);
    clearFocusMode(rightFrame);
    clearCodeFocusMode(leftCodeFrame);
    clearCodeFocusMode(rightCodeFrame);
  }

  syncToElement(selectedElementIndex);
});

document.getElementById("toggleHighlightMode").addEventListener("click", () => {
    highlightModeEnabled = !highlightModeEnabled;
    setViewControlButtonActive("toggleHighlightMode", !highlightModeEnabled);

    document.getElementById("toggleHighlightMode").textContent =
        highlightModeEnabled ? "Hide outline" : "Show outline";

    syncToElement(selectedElementIndex);
});

document.getElementById("toggleDarkMode").addEventListener("click", () => {
    setDarkMode(!document.body.classList.contains("dark-mode"));
});

leftSelect.addEventListener("change", () => {
  if (singleViewEnabled) {
    loadSinglePage();
    return;
  }

  const paired = getPairedFilename(leftSelect.value, "-en.html", "-fr.html");
  selectOptionIfExists(rightSelect, paired);
});

rightSelect.addEventListener("change", () => {
  if (singleViewEnabled) return;

  const paired = getPairedFilename(rightSelect.value, "-fr.html", "-en.html");
  selectOptionIfExists(leftSelect, paired);
});

document.querySelector(".toolbar").addEventListener("submit", event => {
    // A newly entered URL still needs the server to resolve it into a cached
    // file. Folder-based environments already have their selections locally.
    if (selectedEnvUsesTextInputs(getSelectedEnv()) && !singleViewEnabled) {
      return;
    }

    event.preventDefault();

    if (singleViewEnabled) {
      loadSinglePage();
      return;
    }

    loadDualPages();
});

leftCodeFrame.addEventListener("load", () => {
  setCodeLoading("left", false);

  attachCodePanelScrollSync(leftCodeFrame, "left");
  attachCodePanelClickHandlers(leftCodeFrame, "left");

  if (pendingCodePanelSync && singleViewEnabled) {
    syncCodePanelsToCurrentSelection();
    pendingCodePanelSync = false;
  }

  if (pendingCodePanelSync && !singleViewEnabled) {
    syncCodePanelsToCurrentSelection();
  }
});

rightCodeFrame.addEventListener("load", () => {
  setCodeLoading("right", false);

  attachCodePanelScrollSync(rightCodeFrame, "right");
  attachCodePanelClickHandlers(rightCodeFrame, "right");

  if (pendingCodePanelSync) {
    syncCodePanelsToCurrentSelection();
    pendingCodePanelSync = false;
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Shift") {
    codeManualScrollMode = true;
  }
});

document.addEventListener("keyup", event => {
  if (event.key === "Shift") {
    codeManualScrollMode = false;
  }
});

window.addEventListener("blur", () => {
  codeManualScrollMode = false;
});

const reloadUrlPagesButton = document.getElementById("reloadUrlPages");

if (reloadUrlPagesButton) {
  reloadUrlPagesButton.addEventListener("click", async () => {
    reloadUrlPagesButton.disabled = true;
    setViewLoading(true, "Reloading website pages...");

    try {
      const response = await fetch("/api/reload-url-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_env: getSelectedEnv(),
          left: leftSelect.value,
          right: rightSelect.value
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "The website pages could not be reloaded.");
      }

      ["left", "right"].forEach(side => {
        const page = result.pages?.[side];
        if (!page) return;

        const resolvedInput = document.getElementById(`${side}ResolvedFile`);
        const cacheTime = document.getElementById(`${side}UrlCacheTime`);

        if (resolvedInput) resolvedInput.value = page.filename;

        if (cacheTime && page.cache_info) {
          cacheTime.dateTime = page.cache_info.fetched_at;
          cacheTime.textContent = page.cache_info.fetched_at_display;
        }
      });

      if (singleViewEnabled) {
        loadSinglePage();
      } else {
        loadDualPages();
      }
    } catch (error) {
      setViewLoading(false);
      window.alert(error.message);
    } finally {
      reloadUrlPagesButton.disabled = false;
    }
  });
}
