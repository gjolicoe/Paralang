function getHeadingsForFrame(frame) {
    if (!frame) return [];

    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) return [];

    const contentArea = getPrimaryContentContainer(doc);

    if (!contentArea) return [];

    return Array.from(
        contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6")
    ).filter(heading => {
        const detailsParent = heading.closest("details");

        if (detailsParent && !detailsParent.hasAttribute("open")) {
            return false;
        }

        return true;
    });
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