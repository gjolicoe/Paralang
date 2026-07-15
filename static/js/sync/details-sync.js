function getDetailsElements(frame) {
    if (!frame) return [];

    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) return [];

    const contentArea = getPrimaryContentContainer(doc);

    if (!contentArea) return [];

    return Array.from(contentArea.querySelectorAll("details"));
}

function getDetailsIndex(frame, detailsElement) {
    const detailsElements = getDetailsElements(frame);
    return detailsElements.indexOf(detailsElement);
}

function setDetailsOpenAtIndex(frame, detailsIndex, open) {
    const detailsElements = getDetailsElements(frame);
    const target = detailsElements[detailsIndex];

    if (!target) return;

    target.open = open;
}

function getFirstComparableIndexInsideDetails(frame, detailsElement) {
    const elements = getComparableElements(frame);

    return elements.findIndex(element => {
        return element.closest("details") === detailsElement;
    });
}

function moveSyncToFirstElementInsideDetails(frame, detailsElement) {
    const detailsIndex = getDetailsIndex(frame, detailsElement);

    if (detailsIndex < 0) return;

    const comparableIndex = getFirstComparableIndexInsideDetails(frame, detailsElement);

    if (comparableIndex < 0) return;

    if (frame.id === "rightFrame") {
        const leftIndex = Math.max(
            0,
            comparableIndex - getEffectiveRightSyncOffset()
        );

        syncToElement(leftIndex);
        return;
    }

    syncToElement(comparableIndex);
}

function closeDetailsWhenLeaving(currentIndex, requestedIndex) {
    const elements = getComparableElementsCached(leftFrame);
    const currentElement = elements[currentIndex];
    const currentDetails = currentElement
        ? currentElement.closest("details")
        : null;

    if (!currentDetails || !currentDetails.open) return requestedIndex;

    const safeRequestedIndex = Math.max(
        0,
        Math.min(requestedIndex, elements.length - 1)
    );
    const requestedElement = elements[safeRequestedIndex];

    if (!requestedElement || currentDetails.contains(requestedElement)) {
        return requestedIndex;
    }

    const detailsIndex = getDetailsIndex(leftFrame, currentDetails);

    isSyncingDetails = true;

    try {
        currentDetails.open = false;

        if (detailsIndex >= 0) {
            setDetailsOpenAtIndex(rightFrame, detailsIndex, false);
        }
    } finally {
        isSyncingDetails = false;
    }

    clearComparableElementsCache(leftFrame);
    clearComparableElementsCache(rightFrame);
    clearSyncMapCache();

    const collapsedElements = getComparableElementsCached(leftFrame);
    const collapsedIndex = collapsedElements.indexOf(requestedElement);

    return collapsedIndex >= 0 ? collapsedIndex : requestedIndex;
}

function syncMatchingDetailsPanel(sourceFrame, sourceDetails) {
    if (isSyncingDetails) return;

    const detailsIndex = getDetailsIndex(sourceFrame, sourceDetails);

    if (detailsIndex < 0) return;

    const targetFrame = sourceFrame.id === "leftFrame"
        ? rightFrame
        : leftFrame;

    isSyncingDetails = true;

    try {
        setDetailsOpenAtIndex(targetFrame, detailsIndex, sourceDetails.open);
    } finally {
        isSyncingDetails = false;
    }
}

function attachDetailsSyncHandlers(frame) {
    if (!frame) return;

    const detailsElements = getDetailsElements(frame);

    detailsElements.forEach(detailsElement => {
        if (detailsElement.dataset.paralangDetailsBound === "true") {
            return;
        }

        detailsElement.dataset.paralangDetailsBound = "true";

        detailsElement.addEventListener("toggle", () => {
            clearComparableElementsCache(frame);
            clearSyncMapCache();

            if (isSyncingDetails) return;

            syncMatchingDetailsPanel(frame, detailsElement);

            if (isOpeningDetailsForIssueNavigation) {
                return;
            }

            if (detailsElement.open) {
                const detailsComparableIndex = getFirstComparableIndexInsideDetails(
                    frame,
                    detailsElement
                );

                if (detailsComparableIndex >= 0) {
                    if (frame.id === "rightFrame") {
                        selectedElementIndex = Math.max(
                            0,
                            detailsComparableIndex - getEffectiveRightSyncOffset()
                        );
                    } else {
                        selectedElementIndex = detailsComparableIndex;
                    }
                }
            }

            syncToElement(selectedElementIndex);
        });
        clearComparableElementsCache(frame);
        clearSyncMapCache();
    });
}
