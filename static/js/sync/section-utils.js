function isSyncHeadingElement(element) {
    if (!element) return false;

    return /^h[1-6]$/i.test(element.tagName);
}

function getHeadingComparableIndexes(elements) {
    const headingIndexes = [];

    elements.forEach((element, index) => {
        if (isSyncHeadingElement(element)) {
            headingIndexes.push(index);
        }
    });

    return headingIndexes;
}

function getSectionInfoForIndex(elements, index) {
    const headingIndexes = getHeadingComparableIndexes(elements);

    if (!headingIndexes.length) {
        return {
            headingOrdinal: -1,
            startIndex: 0,
            endIndex: elements.length - 1
        };
    }

    let headingOrdinal = -1;

    for (let i = 0; i < headingIndexes.length; i += 1) {
        if (headingIndexes[i] <= index) {
            headingOrdinal = i;
        } else {
            break;
        }
    }

    if (headingOrdinal < 0) {
        return {
            headingOrdinal: -1,
            startIndex: 0,
            endIndex: headingIndexes[0] - 1
        };
    }

    const startIndex = headingIndexes[headingOrdinal];
    const endIndex = headingOrdinal + 1 < headingIndexes.length
        ? headingIndexes[headingOrdinal + 1] - 1
        : elements.length - 1;

    return {
        headingOrdinal,
        startIndex,
        endIndex
    };
}

function getSectionInfoForHeadingOrdinal(elements, headingOrdinal) {
    const headingIndexes = getHeadingComparableIndexes(elements);

    if (!headingIndexes.length || headingOrdinal < 0 || headingOrdinal >= headingIndexes.length) {
        return null;
    }

    const startIndex = headingIndexes[headingOrdinal];
    const endIndex = headingOrdinal + 1 < headingIndexes.length
        ? headingIndexes[headingOrdinal + 1] - 1
        : elements.length - 1;

    return {
        headingOrdinal,
        startIndex,
        endIndex
    };
}

function findBestRightIndexInsideMatchingSection(leftElements, rightElements, leftIndex) {
    const leftSection = getSectionInfoForIndex(leftElements, leftIndex);

    const rightSection = getSectionInfoForHeadingOrdinal(
        rightElements,
        leftSection.headingOrdinal
    );

    if (!rightSection) {
        return null;
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
        return null;
    }

    const leftLocalIndex = leftIndex - leftSection.startIndex;

    const leftSignatures = leftSectionElements.map(getSyncSignatureFromElement);
    const rightSignatures = rightSectionElements.map(getSyncSignatureFromElement);

    const alignment = buildGlobalSyncAlignment(
        leftSignatures,
        rightSignatures
    );

    const mappedLocalRightIndex = getNearestMappedRightIndex(
        alignment.leftToRight,
        leftLocalIndex,
        rightSectionElements.length
    );

    const absoluteRightIndex = rightSection.startIndex + mappedLocalRightIndex;

    return Math.max(
        rightSection.startIndex,
        Math.min(absoluteRightIndex, rightSection.endIndex)
    );
}