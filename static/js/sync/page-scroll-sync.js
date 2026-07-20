function handleSnapWheel(event, sourceFrame) {
    event.preventDefault();

    const now = Date.now();

    if (now - lastScrollTime < 5) return;
    lastScrollTime = now;

    const delta = event.deltaY;
    const direction = delta > 0 ? 1 : -1;
    const speed = Math.abs(delta);

    let jump = 1;

    if (speed > 700) {
        jump = 5;
    } else if (speed > 400) {
        jump = 3;
    } else if (speed > 120) {
        jump = 2;
    }

    const leftCount = getComparableElements(leftFrame).length;
    const maxIndex = Math.max(0, leftCount - 1);

    const nextIndex = Math.max(
        0,
        Math.min(selectedElementIndex + direction * jump, maxIndex)
    );

    requestSyncToElement(nextIndex);
}

function shouldPreserveNativeArrowKeyBehavior(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return true;

    const target = event.target;

    if (!target || !target.closest) return false;

    return Boolean(target.closest([
        "input",
        "textarea",
        "select",
        "option",
        "[contenteditable='true']"
    ].join(", ")));
}

function handleSnapNavigationKey(event) {
    if (shouldPreserveNativeArrowKeyBehavior(event)) return;

    if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        requestSyncToElement(selectedElementIndex + 1);
        return;
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        requestSyncToElement(selectedElementIndex - 1);
    }
}

function attachElementSnapSync() {
    const frames = singleViewEnabled ? [leftFrame] : [leftFrame, rightFrame];

    frames.forEach(frame => {
        const doc = frame.contentDocument || frame.contentWindow.document;

        doc.addEventListener("wheel", event => {
            handleSnapWheel(event, frame);
        }, { passive: false });

        doc.addEventListener("keydown", handleSnapNavigationKey);
    });

    if (document.documentElement.dataset.paralangSnapKeysBound !== "true") {
        document.documentElement.dataset.paralangSnapKeysBound = "true";
        document.addEventListener("keydown", handleSnapNavigationKey);
    }

    requestSyncToElement(0);
}

function attachComparableElementClickHandlers(frame) {
    const elements = getComparableElements(frame);

    elements.forEach(el => {
        if (el.dataset.paralangClickBound === "true") {
            return;
        }

        el.dataset.paralangClickBound = "true";
        el.style.cursor = "pointer";

        el.addEventListener("click", event => {
            event.stopPropagation();

            const currentElements = getComparableElements(frame);
            const clickedIndex = currentElements.indexOf(el);

            if (clickedIndex < 0) return;

            if (frame.id === "leftFrame") {
                syncToElement(clickedIndex);
                return;
            }

            const leftIndex = Math.max(
                0,
                clickedIndex - getEffectiveRightSyncOffset()
            );

            syncToElement(leftIndex);
        });
    });
}
