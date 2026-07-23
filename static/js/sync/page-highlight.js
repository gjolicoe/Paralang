function clearSelectedOutline(frame) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    doc.querySelectorAll("[data-paralang-selection-outline='true']").forEach(el => {
        el.remove();
    });

    doc.querySelectorAll("[data-paralang-selected='true']").forEach(el => {
        el.style.transform = el.dataset.paralangPreviousTransform || "";
        el.style.transformOrigin = el.dataset.paralangPreviousTransformOrigin || "";
        el.style.position = "";
        el.style.zIndex = "";
        el.removeAttribute("data-paralang-previous-transform");
        el.removeAttribute("data-paralang-previous-transform-origin");
        el.removeAttribute("data-paralang-outline-color");
        el.removeAttribute("data-paralang-selected");
    });

    if (!focusModeEnabled) {
        clearFocusMode(frame);
    }
}

function getListItemContentBounds(el) {
    if (!el || el.tagName.toLowerCase() !== "li") return null;

    const nestedList = Array.from(el.children).find(child => {
        const tag = child.tagName.toLowerCase();
        return tag === "ul" || tag === "ol";
    });

    if (!nestedList) return null;

    const doc = el.ownerDocument;
    const childNodes = Array.from(el.childNodes);
    const firstNestedListIndex = childNodes.indexOf(nestedList);
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
        top: Math.min(result.top, rect.top),
        bottom: Math.max(result.bottom, rect.bottom)
    }), {
        top: Infinity,
        bottom: -Infinity
    });
}

function highlightBounds(doc, bounds, treatment) {
    const outline = doc.createElement("div");
    outline.setAttribute("data-paralang-selection-outline", "true");
    outline.style.position = "fixed";
    outline.style.pointerEvents = "none";
    const isGradient = typeof treatment === "object";
    const color = isGradient ? treatment.start : treatment;
    const shadowColor = isGradient
        ? treatment.shadow
        : color === "#ff9900" || color === "#ffb347"
            ? "rgba(255, 153, 0, 0.3)"
            : "rgba(102, 86, 181, 0.26)";
    const pixelRatio = doc.defaultView?.devicePixelRatio || 1;
    const snapToDevicePixel = value => Math.round(value * pixelRatio) / pixelRatio;
    const outlineTop = snapToDevicePixel(bounds.top - 8);
    const outlineBottom = snapToDevicePixel(bounds.bottom + 8);
    const lineThickness = Math.max(1, Math.round(2 * pixelRatio)) / pixelRatio;

    outline.style.boxSizing = "border-box";
    outline.style.left = "0";
    outline.style.right = "0";
    outline.style.top = `${outlineTop}px`;
    outline.style.height = `${outlineBottom - outlineTop}px`;
    if (isGradient) {
        const gradient = `linear-gradient(90deg, ${treatment.start}, ${treatment.end})`;
        outline.style.border = "0";
        outline.style.background = [
            `${gradient} top / 100% ${lineThickness}px no-repeat`,
            `${gradient} bottom / 100% ${lineThickness}px no-repeat`
        ].join(", ");
    } else {
        outline.style.borderTop = `${lineThickness}px solid ${color}`;
        outline.style.borderBottom = `${lineThickness}px solid ${color}`;
        outline.style.background = "transparent";
    }
    outline.style.boxShadow = "none";
    outline.style.filter = [
        `drop-shadow(0 0 2px ${shadowColor})`,
        `drop-shadow(0 0 5px ${shadowColor})`,
        `drop-shadow(0 0 9px ${shadowColor})`
    ].join(" ");
    outline.style.zIndex = "2147483647";
    doc.body.appendChild(outline);
}

function highlightElement(el, color = "#8172d0") {
    if (!el) return;

    const warningColor = "rgba(220, 53, 69, 0.95)";
    const isWarning = color === warningColor;
    const isDarkMode = el.ownerDocument.documentElement.classList.contains(
        "paralang-dark-mode"
    );
    const frameId = el.ownerDocument.defaultView?.frameElement?.id || "";
    const isRightFrame = frameId === "rightFrame";
    const purpleDark = isDarkMode ? "#8172d0" : "#3b2e7e";
    const purpleLight = isDarkMode ? "#b8abf0" : "#7566c5";
    const outlineTreatment = isWarning
        ? (isDarkMode ? "#ffb347" : "#ff9900")
        : {
            start: isRightFrame ? purpleLight : purpleDark,
            end: isRightFrame ? purpleDark : purpleLight,
            shadow: isDarkMode
                ? "rgba(184, 171, 240, 0.34)"
                : "rgba(102, 86, 181, 0.3)"
        };
    const listItemContentBounds = getListItemContentBounds(el);
    const unscaledBounds = listItemContentBounds || el.getBoundingClientRect();

    el.dataset.paralangPreviousTransform = el.style.transform;
    el.dataset.paralangPreviousTransformOrigin = el.style.transformOrigin;
    const selectionScale = listItemContentBounds
        ? ""
        : el.tagName.toLowerCase() === "tr"
            ? "scaleY(1.035)"
            : "scale(1.035)";
    el.style.transform = [el.style.transform, selectionScale]
        .filter(Boolean)
        .join(" ");
    if (selectionScale) {
        el.style.transformOrigin = "left center";
    }
    el.setAttribute("data-paralang-selected", "true");
    el.dataset.paralangOutlineColor = color;

    const showOutline = highlightModeEnabled || isWarning;

    if (showOutline) {
        highlightBounds(el.ownerDocument, unscaledBounds, outlineTreatment);
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

function refreshSelectedOutlineForTheme(frame) {
    const doc = frame?.contentDocument || frame?.contentWindow?.document;
    if (!doc) return;

    doc.querySelectorAll("[data-paralang-selection-outline='true']").forEach(outline => {
        outline.remove();
    });

    const selected = doc.querySelector("[data-paralang-selected='true']");
    if (!selected) return;

    const color = selected.dataset.paralangOutlineColor || "#8172d0";
    const warningColor = "rgba(220, 53, 69, 0.95)";
    const isWarning = color === warningColor;
    if (!highlightModeEnabled && !isWarning) return;
    const isDarkMode = doc.documentElement.classList.contains("paralang-dark-mode");
    const frameId = doc.defaultView?.frameElement?.id || "";
    const isRightFrame = frameId === "rightFrame";
    const purpleDark = isDarkMode ? "#8172d0" : "#3b2e7e";
    const purpleLight = isDarkMode ? "#b8abf0" : "#7566c5";
    const treatment = isWarning
        ? (isDarkMode ? "#ffb347" : "#ff9900")
        : {
            start: isRightFrame ? purpleLight : purpleDark,
            end: isRightFrame ? purpleDark : purpleLight,
            shadow: isDarkMode
                ? "rgba(184, 171, 240, 0.34)"
                : "rgba(102, 86, 181, 0.3)"
        };
    const bounds = getListItemContentBounds(selected) || selected.getBoundingClientRect();

    highlightBounds(doc, bounds, treatment);
}
