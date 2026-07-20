function clearSelectedOutline(frame) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    doc.querySelectorAll("[data-paralang-selection-outline='true']").forEach(el => {
        el.remove();
    });

    doc.querySelectorAll("[data-paralang-selected='true']").forEach(el => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.borderRadius = "";
        el.style.boxShadow = "";
        el.style.transform = el.dataset.paralangPreviousTransform || "";
        el.style.transformOrigin = el.dataset.paralangPreviousTransformOrigin || "";
        el.style.position = "";
        el.style.zIndex = "";
        el.removeAttribute("data-paralang-previous-transform");
        el.removeAttribute("data-paralang-previous-transform-origin");
        el.removeAttribute("data-paralang-selected");
    });

    if (!focusModeEnabled) {
        clearFocusMode(frame);
    }
}

function getListItemContentBounds(el) {
    if (!el || el.tagName.toLowerCase() !== "li") return null;

    const nestedLists = Array.from(el.children).filter(child => {
        const tag = child.tagName.toLowerCase();
        return tag === "ul" || tag === "ol";
    });

    if (!nestedLists.length) return null;

    const doc = el.ownerDocument;
    const childNodes = Array.from(el.childNodes);
    const firstNestedListIndex = childNodes.findIndex(node => {
        return nestedLists.includes(node);
    });
    const contentNodes = childNodes.slice(0, firstNestedListIndex);

    if (!contentNodes.length) return null;

    const range = doc.createRange();
    range.setStartBefore(contentNodes[0]);
    range.setEndAfter(contentNodes[contentNodes.length - 1]);

    const rects = Array.from(range.getClientRects()).filter(rect => {
        return rect.width > 0 && rect.height > 0;
    });

    if (!rects.length) return null;

    return rects.reduce((result, rect) => ({
        left: Math.min(result.left, rect.left),
        top: Math.min(result.top, rect.top),
        right: Math.max(result.right, rect.right),
        bottom: Math.max(result.bottom, rect.bottom)
    }), {
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity
    });
}

function highlightBounds(doc, bounds, color) {
    const outline = doc.createElement("div");
    outline.setAttribute("data-paralang-selection-outline", "true");
    outline.style.position = "fixed";
    outline.style.pointerEvents = "none";
    const isWarning = color === "#ff9900" || color === "#ffb347";
    const shadow = isWarning
        ? "rgba(255, 153, 0, 0.28)"
        : "rgba(31, 90, 166, 0.24)";

    outline.style.boxSizing = "border-box";
    outline.style.left = `${bounds.left - 5}px`;
    outline.style.top = `${bounds.top - 4}px`;
    outline.style.width = `${bounds.right - bounds.left + 10}px`;
    outline.style.height = `${bounds.bottom - bounds.top + 8}px`;
    outline.style.border = `2px solid ${color}`;
    outline.style.borderRadius = "3px";
    outline.style.background = "transparent";
    outline.style.boxShadow = `0 3px 10px ${shadow}`;
    outline.style.zIndex = "2147483647";
    doc.body.appendChild(outline);
}

function highlightElement(el, color = "cornflowerblue") {
    if (!el) return;

    const warningColor = "rgba(220, 53, 69, 0.95)";
    const isWarning = color === warningColor;
    const isDarkMode = el.ownerDocument.documentElement.classList.contains(
        "paralang-dark-mode"
    );
    const professionalColor = isWarning
        ? (isDarkMode ? "#ffb347" : "#ff9900")
        : "#1f5aa6";

    el.dataset.paralangPreviousTransform = el.style.transform;
    el.dataset.paralangPreviousTransformOrigin = el.style.transformOrigin;
    const selectionScale = el.tagName.toLowerCase() === "tr"
        ? "scaleY(1.035)"
        : "scale(1.035)";
    el.style.transform = [el.style.transform, selectionScale]
        .filter(Boolean)
        .join(" ");
    el.style.transformOrigin = "center center";
    el.setAttribute("data-paralang-selected", "true");

    const showOutline = highlightModeEnabled || isWarning;

    if (showOutline) {
        const bounds = getListItemContentBounds(el)
            || el.getBoundingClientRect();

        highlightBounds(el.ownerDocument, bounds, professionalColor);
    }

    el.style.outline = "";
    el.style.outlineOffset = "";
    el.style.borderRadius = "";
    el.style.boxShadow = "";

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
    const contentBounds = getListItemContentBounds(target);
    const rect = contentBounds
        ? {
            top: contentBounds.top,
            height: contentBounds.bottom - contentBounds.top
        }
        : target.getBoundingClientRect();

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
