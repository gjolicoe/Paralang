let syncSectionMapCache = new Map();
let syncSectionMapCacheKey = "";

let pendingSyncIndex = null;
let syncFrameRequested = false;

function syncToElement(index) {
    if (singleViewEnabled) {
        selectedElementIndex = Math.max(0, index);
        syncCodePanelsToCurrentSelection();
        updateStructureMapActiveHeading();
        return;
    }

    const leftCount = getComparableElementsCached(leftFrame).length;
    const rightCount = getComparableElementsCached(rightFrame).length;

    const leftIndex = Math.max(0, Math.min(index, leftCount - 1));

    const rightIndex = findBestRightIndexForLeftIndex(leftIndex);

    lastAutoSyncedRightIndex = rightIndex;

    theoreticalRightSyncOffset = rightIndex - leftIndex - manualRightSyncOffset;

    selectedElementIndex = leftIndex;

    const outOfSync = areCurrentBlocksOutOfSync(leftIndex, rightIndex);

    scrollFrameToElement(leftFrame, leftIndex, "cornflowerblue");

    scrollFrameToElement(
        rightFrame,
        rightIndex,
        outOfSync ? "rgba(220, 53, 69, 0.95)" : "cornflowerblue"
    );

    updateSyncOffsetLabel();
    codeWindowManualBrowsing = false;
    requestCodePanelSync();
    updateStructureMapActiveHeading();
}

function updateSyncOffsetLabel() {
    const resetButton = document.getElementById("resetSyncOffset");

    if (!resetButton) return;

    const effectiveOffset = getEffectiveRightSyncOffset();

    if (effectiveOffset === 0) {
        resetButton.textContent = "Reset sync";
        return;
    }

    resetButton.textContent =
        `Reset sync (${effectiveOffset > 0 ? "+" : ""}${effectiveOffset})`;
}

function getSyncElementsForFrame(frame) {
    return getComparableElementsCached(frame);
}

function getSyncSignaturesForFrame(frame) {
    return getComparableElementsCached(frame).map(getSyncSignatureFromElement);
}

function getAlignmentScore(leftSignature, rightSignature) {
    if (leftSignature === rightSignature) {
        return 3;
    }

    return -2;
}

function findBestRightIndexForLeftIndex(leftIndex) {
    const rightElements = getComparableElementsCached(rightFrame);

    if (!rightElements.length) {
        return 0;
    }

    const manualBaseIndex = leftIndex + manualRightSyncOffset;

    if (!autoSyncEnabled || codeViewEnabled) {
        return Math.max(
            0,
            Math.min(manualBaseIndex, rightElements.length - 1)
        );
    }

    const sectionSyncMap = getSectionSyncMap(leftIndex);
    const mappedRightIndex = sectionSyncMap[leftIndex];

    const targetIndex = Number.isFinite(mappedRightIndex)
        ? mappedRightIndex + manualRightSyncOffset
        : manualBaseIndex;

    return Math.max(
        0,
        Math.min(targetIndex, rightElements.length - 1)
    );
}

function getEffectiveRightSyncOffset() {
    return manualRightSyncOffset + theoreticalRightSyncOffset;
}

function getSyncMapCacheKey() {
    return [
        leftSelect.value,
        rightSelect.value,
        getOpenDetailsParamForSide("left"),
        getOpenDetailsParamForSide("right"),
        getComparableElementsCached(leftFrame).length,
        getComparableElementsCached(rightFrame).length
    ].join("|");
}

function clearSyncMapCache() {
    syncSectionMapCache = new Map();
    syncSectionMapCacheKey = "";
}

function getSectionSyncMap(leftIndex) {
    const key = getSyncMapCacheKey();

    if (key !== syncSectionMapCacheKey) {
        syncSectionMapCache = new Map();
        syncSectionMapCacheKey = key;
    }

    const leftElements = getComparableElementsCached(leftFrame);
    const rightElements = getComparableElementsCached(rightFrame);

    if (!leftElements.length || !rightElements.length) {
        return [];
    }

    const leftSection = getSectionInfoForIndex(leftElements, leftIndex);
    const sectionKey = String(leftSection.headingOrdinal);

    if (syncSectionMapCache.has(sectionKey)) {
        return syncSectionMapCache.get(sectionKey);
    }

    const sectionMap = buildSectionAwareSyncMapForSection(
        leftElements,
        rightElements,
        leftSection
    );

    syncSectionMapCache.set(sectionKey, sectionMap);

    return sectionMap;
}

function requestSyncToElement(index) {
    pendingSyncIndex = index;

    if (syncFrameRequested) return;

    syncFrameRequested = true;

    requestAnimationFrame(() => {
        syncFrameRequested = false;

        if (pendingSyncIndex !== null) {
            syncToElement(pendingSyncIndex);
            pendingSyncIndex = null;
        }
    });
}
function buildSectionAwareSyncMapForSection(leftElements, rightElements, leftSection) {
    const map = [];

    const rightSection = getSectionInfoForHeadingOrdinal(
        rightElements,
        leftSection.headingOrdinal
    );

    if (!rightSection) {
        return map;
    }

    const leftSectionElements = leftElements.slice(
        leftSection.startIndex,
        leftSection.endIndex + 1
    );

    const rightSectionElements = rightElements.slice(
        rightSection.startIndex,
        rightSection.endIndex + 1
    );

    if (!leftSectionElements.length || !rightSectionElements.length) {
        return map;
    }

    const leftListRuns = findListRuns(leftSectionElements);
    const rightListRuns = findListRuns(rightSectionElements);

    leftListRuns.forEach(leftLocalRun => {
        const leftRun = {
            startIndex: leftSection.startIndex + leftLocalRun.startIndex,
            endIndex: leftSection.startIndex + leftLocalRun.endIndex
        };

        const leftRunStartLocal = leftLocalRun.startIndex;

        let matchingRightLocalRun = rightListRuns.find(rightRun => {
            return Math.abs(rightRun.startIndex - leftRunStartLocal) <= 2;
        });

        if (!matchingRightLocalRun && rightListRuns.length === 1) {
            matchingRightLocalRun = rightListRuns[0];
        }

        if (!matchingRightLocalRun) {
            return;
        }

        const rightRun = {
            startIndex: rightSection.startIndex + matchingRightLocalRun.startIndex,
            endIndex: rightSection.startIndex + matchingRightLocalRun.endIndex
        };

        const listRunMap = buildListRunSyncMap(
            leftElements,
            rightElements,
            leftRun,
            rightRun
        );

        Object.entries(listRunMap).forEach(([leftIndex, rightIndex]) => {
            map[Number(leftIndex)] = rightIndex;
        });
    });

    const leftTableRuns = findTableRuns(leftSectionElements);
    const rightTableRuns = findTableRuns(rightSectionElements);

    leftTableRuns.forEach((leftLocalRun, runIndex) => {
        const matchingRightLocalRun = rightTableRuns[runIndex];

        if (!matchingRightLocalRun) {
            return;
        }

        const leftRun = {
            startIndex: leftSection.startIndex + leftLocalRun.startIndex,
            endIndex: leftSection.startIndex + leftLocalRun.endIndex
        };

        const rightRun = {
            startIndex: rightSection.startIndex + matchingRightLocalRun.startIndex,
            endIndex: rightSection.startIndex + matchingRightLocalRun.endIndex
        };

        const tableRunMap = buildTableRunSyncMap(
            leftElements,
            rightElements,
            leftRun,
            rightRun
        );

        Object.entries(tableRunMap).forEach(([leftIndex, rightIndex]) => {
            map[Number(leftIndex)] = rightIndex;
        });
    });

    const leftSignatures = leftSectionElements.map(getSyncSignatureFromElement);
    const rightSignatures = rightSectionElements.map(getSyncSignatureFromElement);

    const alignment = buildGlobalSyncAlignment(
        leftSignatures,
        rightSignatures
    );

    alignment.leftToRight.forEach((mappedLocalRightIndex, localLeftIndex) => {
        const absoluteLeftIndex = leftSection.startIndex + localLeftIndex;

        if (map[absoluteLeftIndex] !== undefined) {
            return;
        }

        if (mappedLocalRightIndex >= 0) {
            map[absoluteLeftIndex] =
                rightSection.startIndex + mappedLocalRightIndex;

            return;
        }

        map[absoluteLeftIndex] = Math.max(
            rightSection.startIndex,
            Math.min(
                rightSection.startIndex + localLeftIndex,
                rightSection.endIndex
            )
        );
    });

    return map;
}