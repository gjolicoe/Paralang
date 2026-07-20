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

leftFrame.addEventListener("load", frameLoaded);
rightFrame.addEventListener("load", frameLoaded);

document.getElementById("rightBack").addEventListener("click", () => {
    manualRightSyncOffset -= 1;
    syncToElement(selectedElementIndex);
});

document.getElementById("rightForward").addEventListener("click", () => {
    manualRightSyncOffset += 1;
    syncToElement(selectedElementIndex);
});

document.getElementById("resetSyncOffset").addEventListener("click", () => {
    manualRightSyncOffset = 0;
    theoreticalRightSyncOffset = 0;
    lastAutoSyncedRightIndex = selectedElementIndex;
    syncToElement(selectedElementIndex);
});

document.getElementById("toggleAutoSync").addEventListener("click", () => {
    autoSyncEnabled = !autoSyncEnabled;
    setViewControlButtonActive("toggleAutoSync", autoSyncEnabled);

    document.getElementById("toggleAutoSync").textContent =
        autoSyncEnabled ? "Auto-sync on" : "Auto-sync off";

    theoreticalRightSyncOffset = 0;
    clearSyncMapCache();

    syncToElement(selectedElementIndex);
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
    if (!singleViewEnabled) return;

    event.preventDefault();
    loadSinglePage();
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
