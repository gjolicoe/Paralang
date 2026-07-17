function clearSelectedOutline(frame) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    doc.querySelectorAll("[data-paralang-selected='true']").forEach(el => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.borderRadius = "";
        el.style.position = "";
        el.style.zIndex = "";
        el.removeAttribute("data-paralang-selected");
    });

    if (!focusModeEnabled) {
        clearFocusMode(frame);
    }
}

function highlightElement(el, color = "cornflowerblue") {
    if (!el) return;

    const warningColor = "rgba(220, 53, 69, 0.95)";
    const isWarning = color === warningColor;

    el.setAttribute("data-paralang-selected", "true");

    if (highlightModeEnabled || isWarning) {
        el.style.outline = `3px solid ${color}`;
        el.style.outlineOffset = "6px";
        el.style.borderRadius = "4px";
    } else {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.borderRadius = "";
    }

    el.style.position = "relative";
    el.style.zIndex = "5";

    if (focusModeEnabled) {
        applyFocusMode(el);
    }
}

function applyFocusMode(selectedEl) {
    if (!selectedEl) return;

    const doc = selectedEl.ownerDocument;

    // Code view: dim all code lines except the selected line
    if (doc.body && doc.body.dataset.paralangCodeView === "true") {
        doc.querySelectorAll(".code-line").forEach(el => {
            const isSelected = el === selectedEl;

            if (isSelected) {
                el.style.filter = "";
                el.style.opacity = "";
                el.removeAttribute("data-paralang-dimmed");
                return;
            }

            el.setAttribute("data-paralang-dimmed", "true");
            el.style.filter = "blur(2px)";
            el.style.opacity = "0.35";
            el.style.transition = "";
        });

        return;
    }

    // Normal page view
    const contentArea = getPrimaryContentContainer(doc);

    if (!contentArea) return;

    const blocks = getComparableElementsForDocument(contentArea);

    blocks.forEach(el => {
        const isSelected = el === selectedEl;
        const isInsideSelected = selectedEl.contains(el);
        const containsSelected = el.contains(selectedEl);

        if (isSelected || isInsideSelected || containsSelected) {
            el.style.filter = "";
            el.style.opacity = "";
            el.removeAttribute("data-paralang-dimmed");
            return;
        }

        el.setAttribute("data-paralang-dimmed", "true");
        el.style.filter = "blur(2px)";
        el.style.opacity = "0.35";
        el.style.transition = "";
    });
}

function clearFocusMode(frame) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    doc.querySelectorAll("[data-paralang-dimmed='true']").forEach(el => {
        el.style.filter = "";
        el.style.opacity = "";
        el.style.transition = "";
        el.removeAttribute("data-paralang-dimmed");
    });
}

function scrollFrameToElement(frame, index, outlineColor) {
    const elements = getComparableElements(frame);

    if (!elements.length) return;

    const safeIndex = Math.max(0, Math.min(index, elements.length - 1));
    const target = elements[safeIndex];

    clearSelectedOutline(frame);

    const doc = frame.contentDocument || frame.contentWindow.document;
    const scroller = doc.scrollingElement || doc.documentElement || doc.body;
    const rect = target.getBoundingClientRect();

    const targetMiddle = rect.top + scroller.scrollTop + rect.height / 2;
    const viewportMiddle = frame.contentWindow.innerHeight / 2;

    scroller.scrollTop = targetMiddle - viewportMiddle;

    highlightElement(target, outlineColor);
}

function disableReviewDisplayControlsForSingleView() {
    focusModeEnabled = false;
    highlightModeEnabled = false;

    const focusButton = document.getElementById("toggleFocusMode");
    const highlightButton = document.getElementById("toggleHighlightMode");

    if (focusButton) {
        focusButton.textContent = "Focus mode";
    }

    if (highlightButton) {
        highlightButton.textContent = "Show outline";
        highlightButton.classList.add("is-active");
    }

    clearFocusMode(leftFrame);

    if (!singleViewEnabled) {
        clearFocusMode(rightFrame);
    }
}
