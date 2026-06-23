const comparableElementsCache = new WeakMap();

function getComparableElementsCached(frame) {
    if (!frame) return [];

    const cached = comparableElementsCache.get(frame);

    if (cached) {
        return cached;
    }

    const elements = getComparableElements(frame);
    comparableElementsCache.set(frame, elements);

    return elements;
}

function clearComparableElementsCache(frame) {
    if (!frame) return;

    comparableElementsCache.delete(frame);
}

function clearAllComparableElementsCache() {
    comparableElementsCache.delete(leftFrame);
    comparableElementsCache.delete(rightFrame);
}

