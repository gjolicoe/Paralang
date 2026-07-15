function applyDarkModeToFrame(frame, enabled) {
  const doc = frame.contentDocument || frame.contentWindow.document;

  if (!doc) return;

  let style = doc.getElementById("paralang-dark-mode-style");
  const lightIslandElements = doc.querySelectorAll(".table-responsive, table, figure");
  const figureFooterElements = doc.querySelectorAll("figure footer, figure footer *");

  // Read these values with the dark-mode rules inactive. Transparent figures and
  // tables receive the light page background in both view modes.
  doc.documentElement.classList.remove("paralang-dark-mode");

  const htmlStyle = frame.contentWindow.getComputedStyle(doc.documentElement);
  const bodyStyle = frame.contentWindow.getComputedStyle(doc.body);
  const transparentColor = /^(?:transparent|rgba\([^)]*,\s*0\))$/;
  const lightPageBackground = !transparentColor.test(bodyStyle.backgroundColor)
    ? bodyStyle.backgroundColor
    : (!transparentColor.test(htmlStyle.backgroundColor) ? htmlStyle.backgroundColor : "rgb(255, 255, 255)");

  lightIslandElements.forEach((element) => {
    const computedStyle = frame.contentWindow.getComputedStyle(element);
    const backgroundColor = transparentColor.test(computedStyle.backgroundColor)
      ? lightPageBackground
      : computedStyle.backgroundColor;

    element.style.setProperty("--paralang-light-background", backgroundColor);
    element.style.setProperty("--paralang-light-color", computedStyle.color);
  });

  figureFooterElements.forEach((element) => {
    const computedStyle = frame.contentWindow.getComputedStyle(element);
    element.style.setProperty("--paralang-light-color", computedStyle.color);
  });

  if (!style) {
    style = doc.createElement("style");
    style.id = "paralang-dark-mode-style";
    doc.head.appendChild(style);
  }

  doc.documentElement.classList.toggle("paralang-dark-mode", enabled);

  style.textContent = `
        html.paralang-dark-mode,
        html.paralang-dark-mode body {
            background: #111 !important;
            color: #f2f2f2 !important;
        }

        html.paralang-dark-mode :is(.content-area, .paralang-content-scope, main) {
            background: #111 !important;
            color: #f2f2f2 !important;
        }

        html.paralang-dark-mode :is(.content-area, .paralang-content-scope, main) :is(h1, h2, h3, h4, h5, h6, p, li, a, strong, em, span):not(:is(.table-responsive, .table-responsive *, table, table *, figure, figure *)) {
            color: #f2f2f2 !important;
        }

        html.paralang-dark-mode :is(.content-area, .paralang-content-scope, main) a:not(:is(.table-responsive *, table *, figure *)) {
            color: #8ab4f8 !important;
        }

        /* Give figures, tables, and responsive table wrappers explicit light-mode defaults in both modes. */
        html :is(.content-area, .paralang-content-scope, main) :is(.table-responsive, table, figure) {
            background-color: var(--paralang-light-background) !important;
            color: var(--paralang-light-color) !important;
        }

        html :is(.content-area, .paralang-content-scope, main) figure footer,
        html :is(.content-area, .paralang-content-scope, main) figure footer * {
            color: var(--paralang-light-color) !important;
        }

        /* Keep nested designed components mostly unchanged */
        html.paralang-dark-mode :is(.content-area, .paralang-content-scope, main) :is(.panel, .well, .alert, .card, .box, aside):not(:is(.table-responsive, .table-responsive *, table *, figure *)) {
            background-color: revert !important;
            color: revert !important;
        }

        html.paralang-dark-mode :is(.content-area, .paralang-content-scope, main) :is(.panel, .well, .alert, .card, .box, aside) *:not(:is(.table-responsive, .table-responsive *, table, table *, figure, figure *)) {
            color: revert !important;
        }
    `;
}

function setDarkMode(enabled) {
  document.body.classList.toggle("dark-mode", enabled);
  localStorage.setItem(darkModeKey, enabled ? "true" : "false");

  updateDarkModeButton(enabled);

  applyDarkModeToFrame(leftFrame, enabled);
  applyDarkModeToFrame(rightFrame, enabled);
}

function loadDarkMode() {
  const enabled = localStorage.getItem(darkModeKey) === "true";
  setDarkMode(enabled);
}

function getResolvedFileForSide(filename, side) {
  if (getSelectedEnv() !== "canada-ca-url") {
    return filename;
  }

  const hiddenInput = side === "right"
    ? document.getElementById("rightResolvedFile")
    : document.getElementById("leftResolvedFile");

  return hiddenInput ? hiddenInput.value : "";
}

function appendCodeWindowParams(src, options = {}) {
  if (!src) return "";

  const url = new URL(src, window.location.origin);

  const contextLines = Number.isFinite(options.contextLines)
    ? options.contextLines
    : 500;

  url.searchParams.set("context", String(contextLines));

  if (Number.isFinite(options.startLine)) {
    url.searchParams.set("start_line", String(options.startLine));
    url.searchParams.delete("center_block_index");
    return url.pathname + url.search;
  }

  if (Number.isFinite(options.centerBlockIndex)) {
    url.searchParams.set("center_block_index", String(options.centerBlockIndex));
    url.searchParams.delete("start_line");
    return url.pathname + url.search;
  }

  // Default code view opening: start at the beginning.
  url.searchParams.set("start_line", "1");
  url.searchParams.delete("center_block_index");

  return url.pathname + url.search;
}

function getPageSrc(filename, side = "left") {
  const env = getSelectedEnv();

  if (env === "aem-sensitive") {
    const relativePath = normalizeAemSensitivePath(filename);

    if (!relativePath) return "";

    return `/page/${env}/_/${encodeURI(relativePath)}`;
  }

  if (env === "canada-ca-url") {
    const resolvedFile = getResolvedFileForSide(filename, side);

    if (!resolvedFile) return "";

    return `/page/${env}/_/${encodeURIComponent(resolvedFile)}`;
  }

  return `/page/${env}/${getSelectedYear()}/${encodeURI(filename)}`;
}

function appendCodeSectionParams(src, options = {}) {
  if (!src) return "";

  const url = new URL(src, window.location.origin);

  const centerBlockIndex = Number.isFinite(options.centerBlockIndex)
    ? options.centerBlockIndex
    : (
        Number.isFinite(selectedElementIndex) && selectedElementIndex >= 0
          ? selectedElementIndex
          : 0
      );

  url.searchParams.set("center_block_index", String(centerBlockIndex));

  return url.pathname + url.search;
}

function getCodeSrc(filename, side = "left", options = {}) {
  const env = getSelectedEnv();

  if (env === "aem-sensitive") {
    const relativePath = normalizeAemSensitivePath(filename);

    if (!relativePath) return "";

    return appendCodeSectionParams(
      `/code/${env}/_/${encodeURI(relativePath)}`,
      options
    );
  }

  if (env === "canada-ca-url") {
    const resolvedFile = getResolvedFileForSide(filename, side);

    if (!resolvedFile) return "";

    return appendCodeSectionParams(
      `/code/${env}/_/${encodeURIComponent(resolvedFile)}`,
      options
    );
  }

  return appendCodeSectionParams(
    `/code/${env}/${getSelectedYear()}/${encodeURI(filename)}`,
    options
  );
}

function setCodeView(enabled) {
  codePanelEnabled = enabled;
  localStorage.setItem(codePanelKey, enabled ? "true" : "false");

  document.body.classList.toggle("show-code-panel", enabled);

  const codeViewCheckbox = document.getElementById("layoutMenuCodeView");

  if (codeViewCheckbox) {
    codeViewCheckbox.checked = enabled;
  }

  if (enabled) {
    if (!Number.isFinite(selectedElementIndex) || selectedElementIndex < 0) {
      selectedElementIndex = 0;
    }

    loadCodePanelHeight();
    loadCodePanels();
  }

  syncCodePanelsToCurrentSelection();
  syncLayoutMenuState();
}

function loadCodeViewState() {
  const saved = localStorage.getItem(codePanelKey) === "true";
  setCodeView(saved);
}

function getOpenDetailsParamForSide(side) {
  const frame = side === "right" ? rightFrame : leftFrame;

  if (!frame) return "";

  const detailsElements = getDetailsElements(frame);

  const openIndexes = detailsElements
    .map((detailsElement, index) => detailsElement.open ? index : null)
    .filter(index => index !== null);

  return openIndexes.join(",");
}

function setViewLoading(isLoading, message = "Loading view...") {
  viewIsLoading = isLoading;

  const overlay = document.getElementById("viewLoadingOverlay");
  const text = document.getElementById("viewLoadingText");
  const codeViewCheckbox = document.getElementById("layoutMenuCodeView");

  if (!overlay) return;

  if (text) {
    text.textContent = message;
  }
  
  if (codeViewCheckbox) {
      codeViewCheckbox.disabled = isLoading;
  }

  overlay.classList.toggle("is-visible", isLoading);
  overlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
}

function setSingleView(enabled) {
  singleViewEnabled = enabled;
  localStorage.setItem(singleViewKey, enabled ? "true" : "false");

  document.body.classList.toggle("single-view", enabled);

  clearAllComparableElementsCache();
  clearSyncMapCache();

  const oldSingleViewButton = document.getElementById("toggleSingleView");
  const rightGroup = document.getElementById("rightSelectGroup");
  const oldDiffButton = document.getElementById("toggleDiff");

  if (oldSingleViewButton) {
    oldSingleViewButton.textContent = enabled ? "Dual view" : "Single view";
  }

  if (rightGroup) {
    rightGroup.hidden = enabled;
  }

  if (oldDiffButton) {
    oldDiffButton.disabled = enabled;
  }

  if (enabled) {
    disableReviewDisplayControlsForSingleView();
    rebuildLeftDropdownForSingleView();
    setDiffHidden(true);
    loadSinglePage();
  } else {
    highlightModeEnabled = true;

    const highlightButton = document.getElementById("toggleHighlightMode");

    if (highlightButton) {
      highlightButton.textContent = "Hide outline";
    }

    const selectedSingleFile = leftSelect.value;

    rebuildLeftDropdownForDualView();

    if (selectedSingleFile.endsWith("-en.html")) {
      selectOptionIfExists(leftSelect, selectedSingleFile);

      const pairedFr = getPairedFilename(selectedSingleFile, "-en.html", "-fr.html");
      selectOptionIfExists(rightSelect, pairedFr);
    }

    if (selectedSingleFile.endsWith("-fr.html")) {
      selectOptionIfExists(rightSelect, selectedSingleFile);

      const pairedEn = getPairedFilename(selectedSingleFile, "-fr.html", "-en.html");
      selectOptionIfExists(leftSelect, pairedEn);
    }

    setDiffHidden(localStorage.getItem(diffHiddenKey) === "true");
    loadDualPages();
  }

  syncLayoutMenuState();
  updatePageInputLabels();
}

function loadSinglePage() {
  clearAllComparableElementsCache();
  clearSyncMapCache();

  const leftFile = leftSelect.value;

  selectedElementIndex = 0;
  loaded = 0;

  setViewLoading(true, "Loading page view...");

  const leftSrc = getPageSrc(leftFile, "left");

  setFrameSource(leftFrame, leftSrc, "Choose or paste a valid page and press Load.");

  if (codePanelEnabled) {
    loadCodePanels();
  }

  loaded = 1;
}

function scrollFrameToTop(frame) {
  const doc = frame.contentDocument || frame.contentWindow.document;
  const scroller = doc.scrollingElement || doc.documentElement || doc.body;

  if (scroller) {
    scroller.scrollTop = 0;
  }
}

function loadDualPages() {
  clearAllComparableElementsCache();
  clearSyncMapCache();

  const leftFile = leftSelect.value;
  const rightFile = rightSelect.value;

  loaded = 0;

  setViewLoading(true, "Loading page view...");

  const leftSrc = getPageSrc(leftFile, "left");
  const rightSrc = getPageSrc(rightFile, "right");

  setFrameSource(leftFrame, leftSrc, "Choose or paste a valid EN page and press Load.");
  setFrameSource(rightFrame, rightSrc, "Choose or paste a valid FR page and press Load.");

  if (codePanelEnabled) {
    loadCodePanels();
  }
}

function loadSingleViewState() {
  setSingleView(localStorage.getItem(singleViewKey) === "true");
}

function frameLoaded() {
  clearComparableElementsCache(leftFrame);
  clearComparableElementsCache(rightFrame);
  clearSyncMapCache();

  loaded += 1;

  attachComparableElementClickHandlers(leftFrame);
  attachDetailsSyncHandlers(leftFrame);

  if (!singleViewEnabled) {
    attachComparableElementClickHandlers(rightFrame);
    attachDetailsSyncHandlers(rightFrame);
  }

  const requiredLoads = singleViewEnabled ? 1 : 2;

  if (loaded >= requiredLoads) {
    loadDarkMode();

    if (!singleViewEnabled) {
      attachElementSnapSync();
      syncToElement(selectedElementIndex);
    } else {
      scrollFrameToTop(leftFrame);
      updateStructureMapActiveHeading();
    }

    setViewLoading(false);
  }
}

function getMoonIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>
    </svg>
  `;
}

function getSunIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="M4.93 4.93l1.41 1.41"></path>
      <path d="M17.66 17.66l1.41 1.41"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="M4.93 19.07l1.41-1.41"></path>
      <path d="M17.66 6.34l1.41-1.41"></path>
    </svg>
  `;
}

function updateDarkModeButton(enabled) {
  const button = document.getElementById("toggleDarkMode");
  const icon = document.getElementById("darkModeIcon");

  if (!button || !icon) return;

  if (enabled) {
    icon.innerHTML = getSunIconSvg();
    button.setAttribute("aria-label", "Enable light mode");
    button.setAttribute("title", "Enable light mode");
  } else {
    icon.innerHTML = getMoonIconSvg();
    button.setAttribute("aria-label", "Enable dark mode");
    button.setAttribute("title", "Enable dark mode");
  }
}

function normalizeAemSensitivePath(value) {
  const raw = (value || "").trim();

  if (!raw) return "";

  const normalized = raw.replaceAll("\\", "/");

  if (normalized.startsWith("aem-sensitive/")) {
    return normalized;
  }

  const marker = "/aem-sensitive/";
  const markerIndex = normalized.indexOf(marker);

  if (markerIndex < 0) {
    return "";
  }

  return `aem-sensitive/${normalized.slice(markerIndex + marker.length)}`;
}

function setFrameSource(frame, src, message) {
  if (!src) {
    frame.removeAttribute("src");
    frame.srcdoc = `<p style="font-family: sans-serif; padding: 2rem;">${message}</p>`;
    return;
  }

  frame.removeAttribute("srcdoc");
  frame.src = src;
}

function loadCodePanels() {
  if (!codePanelEnabled) return;

  const leftFile = leftSelect.value;
  const rightFile = rightSelect.value;

  const leftSrc = getCodeSrc(leftFile, "left");
  const rightSrc = getCodeSrc(rightFile, "right");

  setFrameSource(leftCodeFrame, leftSrc, "No left code view available.");

  if (!singleViewEnabled) {
    setFrameSource(rightCodeFrame, rightSrc, "No right code view available.");
  }
}

function updatePageInputLabels() {
  const env = getSelectedEnv();

  const leftLabel = document.getElementById("leftSelectLabel");
  const rightLabel = document.querySelector("#rightSelectGroup label");

  let leftText = "EN page";
  let rightText = "FR page";

  if (env === "aem-sensitive") {
    leftText = "EN AEM URL";
    rightText = "FR AEM URL";
  }

  if (env === "canada-ca-url") {
    leftText = "EN Canada.ca URL";
    rightText = "FR Canada.ca URL";
  }

  if (singleViewEnabled && env !== "aem-sensitive" && env !== "canada-ca-url") {
    leftText = "Page";
  }

  if (leftLabel) {
    leftLabel.textContent = leftText;
  }

  if (rightLabel) {
    rightLabel.textContent = rightText;
  }
}
