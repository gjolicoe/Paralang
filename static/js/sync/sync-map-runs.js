function isListItemSyncElement(element) {
    return element && element.tagName && element.tagName.toLowerCase() === "li";
}

function getDirectNestedListInfo(listItem) {
    if (!listItem || !isListItemSyncElement(listItem)) {
        return null;
    }

    const nestedLists = Array.from(listItem.children).filter(child => {
        const tag = child.tagName ? child.tagName.toLowerCase() : "";
        return tag === "ul" || tag === "ol";
    });

    if (!nestedLists.length) {
        return null;
    }

    const nestedItemCount = nestedLists.reduce((count, list) => {
        return count + Array.from(list.children).filter(child => {
            return child.tagName && child.tagName.toLowerCase() === "li";
        }).length;
    }, 0);

    return {
        types: nestedLists.map(list => list.tagName.toLowerCase()).join("+"),
        count: nestedItemCount
    };
}

function listItemsHaveComparableNestedList(leftItem, rightItem) {
    const leftInfo = getDirectNestedListInfo(leftItem);
    const rightInfo = getDirectNestedListInfo(rightItem);

    if (!leftInfo || !rightInfo) {
        return false;
    }

    return leftInfo.types === rightInfo.types && leftInfo.count === rightInfo.count;
}

function getFirstNestedListAnchorIndex(listItems) {
    return listItems.findIndex(item => {
        return Boolean(getDirectNestedListInfo(item));
    });
}

function findListRuns(elements) {
    const runs = [];
    let start = null;

    elements.forEach((element, index) => {
        if (isListItemSyncElement(element)) {
            if (start === null) {
                start = index;
            }
            return;
        }

        if (start !== null) {
            runs.push({
                startIndex: start,
                endIndex: index - 1
            });

            start = null;
        }
    });

    if (start !== null) {
        runs.push({
            startIndex: start,
            endIndex: elements.length - 1
        });
    }

    return runs;
}

function findContainingListRun(elements, index) {
    return findListRuns(elements).find(run => {
        return index >= run.startIndex && index <= run.endIndex;
    }) || null;
}

function buildListRunSyncMap(leftElements, rightElements, leftRun, rightRun) {
    const map = [];

    const leftItems = leftElements.slice(leftRun.startIndex, leftRun.endIndex + 1);
    const rightItems = rightElements.slice(rightRun.startIndex, rightRun.endIndex + 1);

    if (!leftItems.length || !rightItems.length) {
        return map;
    }

    const leftAnchorIndex = getFirstNestedListAnchorIndex(leftItems);
    const rightAnchorIndex = getFirstNestedListAnchorIndex(rightItems);

    const hasComparableAnchor =
        leftAnchorIndex >= 0 &&
        rightAnchorIndex >= 0 &&
        listItemsHaveComparableNestedList(
            leftItems[leftAnchorIndex],
            rightItems[rightAnchorIndex]
        );

    if (!hasComparableAnchor) {
        leftItems.forEach((item, localLeftIndex) => {
            const mappedLocalRightIndex = Math.min(
                localLeftIndex,
                rightItems.length - 1
            );

            map[leftRun.startIndex + localLeftIndex] =
                rightRun.startIndex + mappedLocalRightIndex;
        });

        return map;
    }

    const leftBeforeCount = leftAnchorIndex;
    const rightBeforeCount = rightAnchorIndex;

    const beforeCount = Math.min(leftBeforeCount, rightBeforeCount);

    for (let i = 0; i < beforeCount; i += 1) {
        map[leftRun.startIndex + i] = rightRun.startIndex + i;
    }

    for (let i = beforeCount; i < leftBeforeCount; i += 1) {
        map[leftRun.startIndex + i] = rightRun.startIndex + Math.max(0, rightAnchorIndex - 1);
    }

    map[leftRun.startIndex + leftAnchorIndex] =
        rightRun.startIndex + rightAnchorIndex;

    const leftAfterCount = leftItems.length - leftAnchorIndex - 1;
    const rightAfterCount = rightItems.length - rightAnchorIndex - 1;

    const afterCount = Math.min(leftAfterCount, rightAfterCount);

    for (let i = 1; i <= afterCount; i += 1) {
        map[leftRun.startIndex + leftAnchorIndex + i] =
            rightRun.startIndex + rightAnchorIndex + i;
    }

    for (let i = afterCount + 1; i <= leftAfterCount; i += 1) {
        map[leftRun.startIndex + leftAnchorIndex + i] =
            rightRun.startIndex + Math.min(
                rightAnchorIndex + i,
                rightItems.length - 1
            );
    }

    return map;
}

function isTableRowSyncElement(element) {
    return element && element.tagName && element.tagName.toLowerCase() === "tr";
}

function findTableRuns(elements) {
    const runs = [];
    let start = null;

    elements.forEach((element, index) => {
        if (isTableRowSyncElement(element)) {
            if (start === null) {
                start = index;
            }

            return;
        }

        if (start !== null) {
            runs.push({
                startIndex: start,
                endIndex: index - 1
            });

            start = null;
        }
    });

    if (start !== null) {
        runs.push({
            startIndex: start,
            endIndex: elements.length - 1
        });
    }

    return runs;
}

function buildTableRunSyncMap(leftElements, rightElements, leftRun, rightRun) {
    const map = [];

    const leftRows = leftElements.slice(leftRun.startIndex, leftRun.endIndex + 1);
    const rightRows = rightElements.slice(rightRun.startIndex, rightRun.endIndex + 1);

    if (!leftRows.length || !rightRows.length) {
        return map;
    }

    leftRows.forEach((row, localLeftIndex) => {
        const mappedLocalRightIndex = Math.min(
            localLeftIndex,
            rightRows.length - 1
        );

        map[leftRun.startIndex + localLeftIndex] =
            rightRun.startIndex + mappedLocalRightIndex;
    });

    return map;
}