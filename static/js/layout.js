function px(value) {
  return `${Math.max(0, Math.round(value))}px`;
}

function setVar(name, value) {
  root.style.setProperty(name, value);
}

function getPixelVar(name, fallback) {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function getFractionVar(name, fallback) {
  const value = getComputedStyle(root).getPropertyValue(name).trim();

  if (value.endsWith("fr")) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  return fallback;
}

function getLayoutState() {
  return {
    leftMapWidth: getPixelVar("--left-map-width", defaults.leftMapWidth),
    leftPageRatio: getFractionVar("--left-page-width", defaults.leftPageRatio),
    rightPageRatio: getFractionVar("--right-page-width", defaults.rightPageRatio),
    rightMapWidth: getPixelVar("--right-map-width", defaults.rightMapWidth)
  };
}

function applyLayoutState(state) {
  setVar("--left-map-width", px(state.leftMapWidth));
  setVar("--left-page-width", `${state.leftPageRatio}fr`);
  setVar("--right-page-width", `${state.rightPageRatio}fr`);
  setVar("--right-map-width", px(state.rightMapWidth));
}

function saveLayout() {
  localStorage.setItem(storageKey, JSON.stringify(getLayoutState()));
}

function getDiffHeight() {
  return getPixelVar("--diff-height", defaults.diffHeight);
}

function setDiffHeight(height) {
  setVar("--diff-height", px(height));
}

function setDiffHidden(hidden) {
  document.body.classList.toggle("hide-diff", hidden);
  localStorage.setItem(diffHiddenKey, hidden ? "true" : "false");

  syncLayoutMenuState();
}

function loadDiffState() {
  const savedHeight = localStorage.getItem(diffHeightKey);
  const hidden = localStorage.getItem(diffHiddenKey) === "true";

  if (savedHeight && !hidden) {
    setDiffHeight(Number(savedHeight));
  } else if (!hidden) {
    setDiffHeight(defaults.diffHeight);
  }

  setDiffHidden(hidden);
}

function setMapsHidden(hidden) {
  document.body.classList.toggle("hide-maps", hidden);
  localStorage.setItem(mapsHiddenKey, hidden ? "true" : "false");

  syncLayoutMenuState();
}

function loadLayout() {
  const saved = localStorage.getItem(storageKey);

  if (saved) {
    try {
      applyLayoutState(JSON.parse(saved));
    } catch {
      applyLayoutState(defaults);
    }
  } else {
    applyLayoutState(defaults);
  }

  const mapsHidden = localStorage.getItem(mapsHiddenKey) === "true";
  document.body.classList.toggle("hide-maps", mapsHidden);

  loadDiffState();
  syncLayoutMenuState();
}

function getPageWidths() {
  const leftPage = document.querySelector(".left-page").getBoundingClientRect().width;
  const rightPage = document.querySelector(".right-page").getBoundingClientRect().width;

  return { leftPage, rightPage };
}

function setupResizers() {
  document.querySelectorAll(".resizer").forEach(resizer => {
    resizer.addEventListener("mousedown", startResize);
  });
}

function startResize(event) {
  event.preventDefault();

  const resizer = event.currentTarget;
  const type = resizer.dataset.resizer;
  const startX = event.clientX;
  const startState = getLayoutState();
  const pageWidths = getPageWidths();

  resizer.classList.add("is-dragging");
  document.body.classList.add("is-resizing");

  function onMove(moveEvent) {
    const delta = moveEvent.clientX - startX;

    const state = {
      leftMapWidth: startState.leftMapWidth,
      leftPageRatio: startState.leftPageRatio,
      rightPageRatio: startState.rightPageRatio,
      rightMapWidth: startState.rightMapWidth
    };

    if (type === "left-map") {
      state.leftMapWidth = Math.max(0, startState.leftMapWidth + delta);
    }

    if (type === "right-map") {
      state.rightMapWidth = Math.max(0, startState.rightMapWidth - delta);
    }

    if (type === "pages") {
      const newLeft = Math.max(160, pageWidths.leftPage + delta);
      const newRight = Math.max(160, pageWidths.rightPage - delta);
      const adjustedTotal = newLeft + newRight;

      state.leftPageRatio = newLeft / adjustedTotal;
      state.rightPageRatio = newRight / adjustedTotal;
    }

    applyLayoutState(state);
  }

  function onUp() {
    saveLayout();

    resizer.classList.remove("is-dragging");
    document.body.classList.remove("is-resizing");

    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function setupDiffResizer() {
  const diffResizer = document.getElementById("diffResizer");

  if (!diffResizer) return;

  diffResizer.addEventListener("mousedown", event => {
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = getDiffHeight();

    diffResizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-diff");

    function onMove(moveEvent) {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.max(120, window.innerHeight - 180);
      const newHeight = Math.max(0, Math.min(maxHeight, startHeight + delta));

      setDiffHidden(false);
      setDiffHeight(newHeight);
    }

    function onUp() {
      localStorage.setItem(diffHeightKey, String(getDiffHeight()));

      diffResizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-diff");

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function getCodeHeight() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--code-height")
    .trim();

  const number = parseFloat(value);

  return Number.isFinite(number) ? number : 260;
}

function setCodeHeight(height) {
  document.documentElement.style.setProperty("--code-height", px(height));
}

function loadCodePanelHeight() {
  const savedHeight = localStorage.getItem(codeHeightKey);

  if (!savedHeight) return;

  const pageStack = document.querySelector(".left-stack");
  const stackHeight = pageStack
    ? pageStack.getBoundingClientRect().height
    : window.innerHeight - 220;

  const maxHeight = Math.max(140, stackHeight * 0.9);
  const safeHeight = Math.max(120, Math.min(maxHeight, Number(savedHeight)));

  setCodeHeight(safeHeight);
}

function setupCodeResizer() {
  const codeResizers = document.querySelectorAll(".code-resizer");

  if (!codeResizers.length) return;

  codeResizers.forEach(codeResizer => {
    codeResizer.addEventListener("mousedown", event => {
      event.preventDefault();

      const startY = event.clientY;
      const startHeight = getCodeHeight();

      codeResizer.classList.add("is-dragging");
      document.body.classList.add("is-resizing-diff");

      function onMove(moveEvent) {
        const delta = startY - moveEvent.clientY;

        const pageStack = document.querySelector(".left-stack");
        const stackHeight = pageStack
          ? pageStack.getBoundingClientRect().height
          : window.innerHeight - 220;

        const maxHeight = Math.max(140, stackHeight * 0.9);

        const newHeight = Math.max(
          120,
          Math.min(maxHeight, startHeight + delta)
        );

        setCodeHeight(newHeight);
      }

      function onUp() {
        localStorage.setItem(codeHeightKey, String(getCodeHeight()));

        codeResizer.classList.remove("is-dragging");
        document.body.classList.remove("is-resizing-diff");

        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

function setupLayoutMenu() {
  const menuButton = document.getElementById("layoutMenuButton");
  const menu = document.getElementById("layoutMenu");

  if (!menuButton || !menu) return;

  menuButton.addEventListener("click", event => {
    event.stopPropagation();

    const willOpen = menu.hidden;

    menu.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", willOpen ? "true" : "false");

    if (willOpen) {
      syncLayoutMenuState();
    }
  });

  menu.addEventListener("click", event => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      menu.hidden = true;
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

function syncLayoutMenuState() {
  const mapsCheckbox = document.getElementById("layoutMenuMaps");
  const issuesCheckbox = document.getElementById("layoutMenuIssues");
  const singleViewCheckbox = document.getElementById("layoutMenuSingleView");
  const codeViewCheckbox = document.getElementById("layoutMenuCodeView");

  if (mapsCheckbox) {
    mapsCheckbox.checked = !document.body.classList.contains("hide-maps");
  }

  if (issuesCheckbox) {
    issuesCheckbox.checked = !document.body.classList.contains("hide-diff");
  }

  if (singleViewCheckbox) {
    singleViewCheckbox.checked = singleViewEnabled;
  }

  if (codeViewCheckbox) {
    codeViewCheckbox.checked = codePanelEnabled;
  }
}

function setupLayoutMenuActions() {
  const mapsCheckbox = document.getElementById("layoutMenuMaps");
  const issuesCheckbox = document.getElementById("layoutMenuIssues");
  const singleViewCheckbox = document.getElementById("layoutMenuSingleView");
    const codeViewCheckbox = document.getElementById("layoutMenuCodeView");
    const resetButton = document.getElementById("layoutMenuReset");

  if (mapsCheckbox) {
    mapsCheckbox.addEventListener("change", () => {
      setMapsHidden(!mapsCheckbox.checked);
    });
  }

  if (issuesCheckbox) {
    issuesCheckbox.addEventListener("change", () => {
      setDiffHidden(!issuesCheckbox.checked);
    });
  }

  if (singleViewCheckbox) {
    singleViewCheckbox.addEventListener("change", () => {
      setSingleView(singleViewCheckbox.checked);
      syncLayoutMenuState();
    });
  }

  if (codeViewCheckbox) {
    codeViewCheckbox.addEventListener("change", () => {
        setCodeView(codeViewCheckbox.checked);
        syncLayoutMenuState();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      resetLayout();

      const menu = document.getElementById("layoutMenu");
      const menuButton = document.getElementById("layoutMenuButton");

      if (menu) menu.hidden = true;
      if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    });
  }
}

function resetLayout() {
  localStorage.removeItem(storageKey);
  localStorage.removeItem(diffHeightKey);
  localStorage.removeItem(codeHeightKey);
  localStorage.removeItem(mapsHiddenKey);
  localStorage.removeItem(diffHiddenKey);

  document.documentElement.style.removeProperty("--left-map-width");
  document.documentElement.style.removeProperty("--left-page-width");
  document.documentElement.style.removeProperty("--right-page-width");
  document.documentElement.style.removeProperty("--right-map-width");
  document.documentElement.style.removeProperty("--diff-height");
  document.documentElement.style.removeProperty("--code-height");

  document.body.classList.remove("hide-maps");
  document.body.classList.remove("hide-diff");

  applyLayoutState(defaults);
  setDiffHeight(defaults.diffHeight);
  loadCodePanelHeight();

  syncLayoutMenuState();
}