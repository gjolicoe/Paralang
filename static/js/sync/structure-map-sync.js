function getHeadingsForFrame(frame) {
    if (!frame) return [];

    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) return [];

    const contentArea = getPrimaryContentContainer(doc);

    if (!contentArea) return [];

    return Array.from(
        contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6")
    );
}

function isElementAtOrBeforeTarget(heading, target) {
    if (!heading || !target) return false;

    if (heading === target) return true;

    if (heading.contains(target)) return true;

    const position = heading.compareDocumentPosition(target);

    return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);
}

function getActiveHeadingIndexForFrame(frame, comparableIndex) {
    const elements = getComparableElementsCached(frame);

    if (!elements.length) return -1;

    const safeIndex = Math.max(0, Math.min(comparableIndex, elements.length - 1));
    const target = elements[safeIndex];

    if (!target) return -1;

    const headings = getHeadingsForFrame(frame);

    if (!headings.length) return -1;

    let activeHeadingIndex = -1;

    headings.forEach((heading, index) => {
        if (isInsideClosedDetails(heading)) return;

        if (isElementAtOrBeforeTarget(heading, target)) {
            activeHeadingIndex = index;
        }
    });

    return activeHeadingIndex;
}

function clearStructureMapActiveHeadings() {
    document.querySelectorAll(".heading-btn.is-active-heading").forEach(button => {
        button.classList.remove("is-active-heading");
        button.removeAttribute("aria-current");
    });
}

function setStructureMapActiveHeading(frameId, headingIndex) {
    if (headingIndex < 0) return null;

    const button = document.querySelector(
        `.heading-btn[data-frame-id="${frameId}"][data-heading-index="${headingIndex}"]`
    );

    if (!button) return null;

    button.classList.add("is-active-heading");
    button.setAttribute("aria-current", "true");

    return button;
}

function getStructureMapPanelForButton(button) {
    if (!button) return null;

    return button.closest(".map");
}

function getCenteredStructureMapScrollTop(panel, button) {
    if (!panel || !button) return 0;

    const panelRect = panel.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const buttonTopInsidePanel =
        buttonRect.top - panelRect.top + panel.scrollTop;

    const idealScrollTop =
        buttonTopInsidePanel -
        (panel.clientHeight / 2) +
        (button.offsetHeight / 2);

    const maxScrollTop = Math.max(0, panel.scrollHeight - panel.clientHeight);

    return Math.max(0, Math.min(maxScrollTop, idealScrollTop));
}

function syncStructureMapPanelToButton(button) {
    const panel = getStructureMapPanelForButton(button);

    if (!panel || !button) return;

    const targetScrollTop = getCenteredStructureMapScrollTop(panel, button);

    panel.scrollTo({
        top: targetScrollTop,
        behavior: "smooth"
    });
}

function syncStructureMapPanels(leftButton, rightButton) {
    if (singleViewEnabled) {
        syncStructureMapPanelToButton(leftButton);
        return;
    }

    syncStructureMapPanelToButton(leftButton);
    syncStructureMapPanelToButton(rightButton);
}

function updateStructureMapActiveHeading() {
    clearStructureMapActiveHeadings();

    const leftHeadingIndex = getActiveHeadingIndexForFrame(
        leftFrame,
        selectedElementIndex
    );

    const leftButton = setStructureMapActiveHeading(
        "leftFrame",
        leftHeadingIndex
    );

    if (singleViewEnabled) {
        syncStructureMapPanels(leftButton, null);
        return;
    }

    const rightIndex = Math.max(
        0,
        selectedElementIndex + getEffectiveRightSyncOffset()
    );

    const rightHeadingIndex = getActiveHeadingIndexForFrame(
        rightFrame,
        rightIndex
    );

    const rightButton = setStructureMapActiveHeading(
        "rightFrame",
        rightHeadingIndex
    );

    syncStructureMapPanels(leftButton, rightButton);
}

function scrollToHeading(frameId, headingIndex) {
    const frame = document.getElementById(frameId);
    const doc = frame.contentDocument || frame.contentWindow.document;
    const elements = getComparableElements(frame);

    let target = null;
    let comparableTarget = null;

    if (doc.body && doc.body.dataset.paralangCodeView === "true") {
        target = doc.querySelector(`.code-line[data-heading-index="${headingIndex}"]`);
        comparableTarget = target;
    } else {
        const contentArea = getPrimaryContentContainer(doc);
        if (!contentArea) return;

        const headings = Array.from(
            contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6")
        );

        target = headings[headingIndex];

        if (!target) return;

        comparableTarget = target.closest("li") || target;
    }

    if (!target || !comparableTarget) return;

    let matchingIndex = elements.indexOf(comparableTarget);

    if (matchingIndex < 0) {
        matchingIndex = elements.findIndex(el => el.contains(target));
    }

    if (matchingIndex < 0) {
        target.scrollIntoView({
            behavior: "auto",
            block: "center"
        });
        return;
    }

    if (singleViewEnabled) {
        comparableTarget.scrollIntoView({
            behavior: "auto",
            block: "center"
        });

        selectedElementIndex = matchingIndex;
        return;
    }

    if (frame.id === "rightFrame") {
        const leftIndex = Math.max(
            0,
            matchingIndex - getEffectiveRightSyncOffset()
        );

        syncToElement(leftIndex);
        return;
    }

    syncToElement(matchingIndex);
}

function getStructureMapHeadingModels(frame) {
    if (!frame) return [];

    const doc = frame.contentDocument || frame.contentWindow.document;
    const contentArea = doc ? getPrimaryContentContainer(doc) : null;

    if (!contentArea) return [];

    const comparableElements = getComparableElements(frame);
    const headingElements = Array.from(
        contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6")
    );

    return headingElements.map((heading, headingIndex) => {
        const level = Number(heading.tagName.slice(1));
        const comparableIndex = comparableElements.indexOf(heading);
        let sectionCount = 0;

        if (comparableIndex >= 0) {
            for (let index = comparableIndex + 1; index < comparableElements.length; index += 1) {
                const element = comparableElements[index];
                const tag = element.tagName.toLowerCase();

                if (/^h[1-6]$/.test(tag) && Number(tag.slice(1)) <= level) {
                    break;
                }

                sectionCount += 1;
            }
        }

        return {
            headingIndex,
            level,
            text: (heading.textContent || "").replace(/\s+/g, " ").trim(),
            sectionCount,
            countMismatch: false
        };
    }).filter(heading => heading.text);
}

function markStructureMapCountMismatches(leftHeadings, rightHeadings) {
    const count = Math.max(leftHeadings.length, rightHeadings.length);

    for (let index = 0; index < count; index += 1) {
        const leftHeading = leftHeadings[index];
        const rightHeading = rightHeadings[index];
        const mismatch = !leftHeading
            || !rightHeading
            || leftHeading.sectionCount !== rightHeading.sectionCount;

        if (leftHeading) leftHeading.countMismatch = mismatch;
        if (rightHeading) rightHeading.countMismatch = mismatch;
    }
}

function renderStructureMap(frame, panel, title, headings) {
    if (!panel) return;

    panel.replaceChildren();

    const titleElement = document.createElement("h2");
    titleElement.textContent = title;
    panel.appendChild(titleElement);

    headings.forEach(heading => {
        const button = document.createElement("button");
        button.className = `heading-btn level-${heading.level}`;
        button.type = "button";
        button.dataset.frameId = frame.id;
        button.dataset.headingIndex = String(heading.headingIndex);
        button.addEventListener("click", () => {
            scrollToHeading(frame.id, heading.headingIndex);
        });

        const mainLine = document.createElement("span");
        mainLine.className = "heading-main-line";

        const level = document.createElement("span");
        level.className = "heading-level";
        level.textContent = `H${heading.level}`;

        const text = document.createElement("span");
        text.className = "heading-text";
        text.dataset.i18nSkip = "";
        text.textContent = heading.text;

        const sectionCount = document.createElement("span");
        sectionCount.className = "heading-section-count";
        sectionCount.classList.toggle("is-count-mismatch", heading.countMismatch);
        sectionCount.textContent = `${heading.sectionCount} elements`;

        mainLine.append(level, text);
        button.append(mainLine, sectionCount);
        panel.appendChild(button);
    });

    const note = document.createElement("div");
    note.className = "small-note";
    note.textContent = `${headings.length} headings`;
    panel.appendChild(note);
}

function refreshStructureMaps() {
    const leftHeadings = getStructureMapHeadingModels(leftFrame);
    const rightHeadings = singleViewEnabled
        ? []
        : getStructureMapHeadingModels(rightFrame);

    if (!singleViewEnabled) {
        markStructureMapCountMismatches(leftHeadings, rightHeadings);
    }

    renderStructureMap(
        leftFrame,
        document.querySelector(".left-map"),
        "Left structure",
        leftHeadings
    );

    if (!singleViewEnabled) {
        renderStructureMap(
            rightFrame,
            document.querySelector(".right-map"),
            "Right structure",
            rightHeadings
        );
    }

    window.ParalangI18n?.translateElement(document.querySelector(".view-grid"));
}
