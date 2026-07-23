function scrollCodeFrameToBlock(frame, blockIndex, outlineColor = "#a99de7") {
    if (!frame || blockIndex < 0) return false;

    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) return false;

    const targets = Array.from(
        doc.querySelectorAll(`.code-line[data-block-index="${blockIndex}"]`)
    );

    if (!targets.length) return false;

    doc.querySelectorAll("[data-paralang-code-selected='true']").forEach(el => {
        el.removeAttribute("data-paralang-code-selected");
        el.classList.remove(
            "code-line-selected",
            "code-line-selected-first",
            "code-line-selected-middle",
            "code-line-selected-last",
            "code-line-selected-single"
        );
        el.style.removeProperty("--paralang-code-outline");
    });

    clearCodeFocusMode(frame);

    const firstTarget = targets[0];
    const scroller = doc.scrollingElement || doc.documentElement || doc.body;
    const rect = firstTarget.getBoundingClientRect();

    const targetMiddle = rect.top + scroller.scrollTop + rect.height / 2;
    const viewportMiddle = frame.contentWindow.innerHeight / 2;

    scroller.scrollTop = targetMiddle - viewportMiddle;

    targets.forEach((target, index) => {
        target.setAttribute("data-paralang-code-selected", "true");
        target.style.setProperty("--paralang-code-outline", outlineColor);

        if (!highlightModeEnabled || singleViewEnabled) {
            return;
        }

        target.classList.add("code-line-selected");

        if (targets.length === 1) {
            target.classList.add("code-line-selected-single");
            return;
        }

        if (index === 0) {
            target.classList.add("code-line-selected-first");
            return;
        }

        if (index === targets.length - 1) {
            target.classList.add("code-line-selected-last");
            return;
        }

        target.classList.add("code-line-selected-middle");
    });

    if (focusModeEnabled && !singleViewEnabled) {
        applyCodeFocusMode(frame, targets);
    } else {
        clearCodeFocusMode(frame);
    }

    return true;
}

function normalizeComparableSignature(value) {
    return (value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function scrollCodeFrameToSignature(frame, signature, outlineColor = "#a99de7", preferredBlockIndex = null) {
    if (!frame || !signature) return false;

    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) return false;

    const normalizedSignature = normalizeComparableSignature(signature);

    const targets = Array.from(
        doc.querySelectorAll(".code-line[data-block-signature]")
    ).filter(line => {
        return normalizeComparableSignature(line.dataset.blockSignature) === normalizedSignature;
    });

    let finalTargets = targets;

    if (Number.isFinite(preferredBlockIndex)) {
        const preferredTargets = targets.filter(line => {
            return Number(line.dataset.blockIndex) === preferredBlockIndex;
        });

        if (preferredTargets.length) {
            finalTargets = preferredTargets;
        }
    }

    if (!finalTargets.length) {
        return false;
    }

    if (!targets.length) {
        return false;
    }

    clearCodeFocusMode(frame);

    doc.querySelectorAll("[data-paralang-code-selected='true']").forEach(el => {
        el.removeAttribute("data-paralang-code-selected");
        el.classList.remove(
            "code-line-selected",
            "code-line-selected-first",
            "code-line-selected-middle",
            "code-line-selected-last",
            "code-line-selected-single"
        );
        el.style.removeProperty("--paralang-code-outline");
    });

    const firstTarget = finalTargets[0];
    const scroller = doc.scrollingElement || doc.documentElement || doc.body;
    const rect = firstTarget.getBoundingClientRect();

    const targetMiddle = rect.top + scroller.scrollTop + rect.height / 2;
    const viewportMiddle = frame.contentWindow.innerHeight / 2;

    scroller.scrollTop = targetMiddle - viewportMiddle;

    finalTargets.forEach((target, index) => {
        target.setAttribute("data-paralang-code-selected", "true");
        target.style.setProperty("--paralang-code-outline", outlineColor);

        if (!highlightModeEnabled || singleViewEnabled) {
            return;
        }

        target.classList.add("code-line-selected");

        if (finalTargets.length === 1) {
            target.classList.add("code-line-selected-single");
            return;
        }

        if (index === 0) {
            target.classList.add("code-line-selected-first");
            return;
        }

        if (index === finalTargets.length - 1) {
            target.classList.add("code-line-selected-last");
            return;
        }

        target.classList.add("code-line-selected-middle");
    });

    if (focusModeEnabled && !singleViewEnabled) {
        applyCodeFocusMode(frame, targets);
    } else {
        clearCodeFocusMode(frame);
    }

    return true;
}

function codeFrameIsReady(frame) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    return Boolean(doc && doc.body && doc.querySelector(".code-line"));
}

function syncCodePanelsToCurrentSelection() {
    if (!codePanelEnabled) return;

    const effectiveOffset = getEffectiveRightSyncOffset();

    const leftIndex = selectedElementIndex;

    const rightCount = getComparableElementsCached
        ? getComparableElementsCached(rightFrame).length
        : getComparableElements(rightFrame).length;

    const rightIndex = Math.max(
        0,
        Math.min(
            selectedElementIndex + effectiveOffset,
            Math.max(0, rightCount - 1)
        )
    );

    let reloadedCodeFrame = false;

    if (leftCodeFrame && !codeFrameWindowContainsBlock(leftCodeFrame, leftIndex)) {
        reloadCodeFrameAroundBlock("left", leftIndex);
        reloadedCodeFrame = true;
    }

    if (
        !singleViewEnabled &&
        rightCodeFrame &&
        !codeFrameWindowContainsBlock(rightCodeFrame, rightIndex)
    ) {
        reloadCodeFrameAroundBlock("right", rightIndex);
        reloadedCodeFrame = true;
    }

    if (reloadedCodeFrame) {
        pendingCodePanelSync = true;
        return;
    }

    const leftBlockSynced = scrollCodeFrameToBlock(
        leftCodeFrame,
        leftIndex,
        "#a99de7"
    );

    if (!leftBlockSynced) {
        const leftSignature = getComparableSignatureForFrameIndex(leftFrame, leftIndex);

        scrollCodeFrameToSignature(
            leftCodeFrame,
            leftSignature,
            "#a99de7",
            leftIndex
        );
    }

    if (!singleViewEnabled) {
        const outOfSync = areCurrentBlocksOutOfSync(leftIndex, rightIndex);
        const rightColor = outOfSync
            ? "rgba(220, 53, 69, 0.95)"
            : "#a99de7";

        const rightBlockSynced = scrollCodeFrameToBlock(
            rightCodeFrame,
            rightIndex,
            rightColor
        );

        if (!rightBlockSynced) {
            const rightSignature = getComparableSignatureForFrameIndex(
                rightFrame,
                rightIndex
            );

            scrollCodeFrameToSignature(
                rightCodeFrame,
                rightSignature,
                rightColor,
                rightIndex
            );
        }
    }
}

function clearCodeFocusMode(frame) {
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return;

    doc.querySelectorAll("[data-paralang-code-dimmed='true']").forEach(el => {
        el.style.filter = "";
        el.style.opacity = "";
        el.removeAttribute("data-paralang-code-dimmed");
    });
}

function applyCodeFocusMode(frame, selectedLines) {
    if (!frame || !selectedLines || !selectedLines.length) return;

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return;

    const selectedSet = new Set(selectedLines);

    doc.querySelectorAll(".code-line").forEach(line => {
        if (selectedSet.has(line)) {
            line.style.filter = "";
            line.style.opacity = "";
            line.removeAttribute("data-paralang-code-dimmed");
            return;
        }

        line.setAttribute("data-paralang-code-dimmed", "true");
        line.style.filter = "blur(2px)";
        line.style.opacity = "0.35";
    });
}

function getCodeBlockIndexes(frame) {
    if (!frame) return [];

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return [];

    const indexes = Array.from(doc.querySelectorAll(".code-line[data-block-index]"))
        .map(line => Number(line.dataset.blockIndex))
        .filter(index => Number.isFinite(index));

    return [...new Set(indexes)].sort((a, b) => a - b);
}

function attachCodePanelScrollSync(frame, side) {
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return;

    if (doc.body.dataset.paralangCodeScrollBound === "true") {
        return;
    }

    doc.body.dataset.paralangCodeScrollBound = "true";

    doc.addEventListener("wheel", event => {
        // Hold Shift to manually scroll the code view without triggering page/code sync.
        if (event.shiftKey || codeManualScrollMode) {
            event.preventDefault();
            event.stopPropagation();

            const scroller = doc.scrollingElement || doc.documentElement || doc.body;

            if (scroller) {
                scroller.scrollTop += event.deltaY * 1.4;
            }

            return;
        }

        event.preventDefault();

        const now = Date.now();

        if (now - lastScrollTime < 40) return;
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

        let nextIndex;

        if (side === "right") {
            const effectiveOffset = getEffectiveRightSyncOffset();
            const currentRightIndex = selectedElementIndex + effectiveOffset;
            const nextRightIndex = currentRightIndex + direction * jump;

            nextIndex = nextRightIndex - effectiveOffset;
        } else {
            nextIndex = selectedElementIndex + direction * jump;
        }

        const leftCount = getComparableElements(leftFrame).length;
        const maxIndex = Math.max(0, leftCount - 1);

        nextIndex = Math.max(0, Math.min(nextIndex, maxIndex));

        requestSyncToElement(nextIndex);
    }, { passive: false });

    doc.addEventListener("keydown", event => {
        if (event.key === "ArrowDown" || event.key === "PageDown") {
            event.preventDefault();
            requestSyncToElement(selectedElementIndex + 1);
        }

        if (event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault();
            requestSyncToElement(selectedElementIndex - 1);
        }
    });
}

function attachCodePanelClickHandlers(frame, side) {
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return;

    if (doc.body.dataset.paralangCodeClickBound === "true") {
        return;
    }

    doc.body.dataset.paralangCodeClickBound = "true";

    doc.querySelectorAll(".code-line[data-block-index]").forEach(line => {
        line.style.cursor = "pointer";

        line.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            const blockIndex = Number(line.dataset.blockIndex);

            if (!Number.isFinite(blockIndex)) return;

            if (side === "right") {
                const leftIndex = Math.max(
                    0,
                    blockIndex - getEffectiveRightSyncOffset()
                );

                syncToElement(leftIndex);
                return;
            }

            syncToElement(blockIndex);
        });
    });
}



const codeSectionReloadInProgress = {
    left: false,
    right: false
};

function codeFrameWindowContainsBlock(frame, blockIndex) {
    const doc = frame.contentDocument || frame.contentWindow.document;

    if (!doc || !doc.body) {
        return true;
    }

    if (!Number.isFinite(blockIndex) || blockIndex < 0) {
        return true;
    }

    const isWindowed = doc.body.dataset.codeWindowIsWindowed === "true";

    if (!isWindowed) {
        return true;
    }

    const startBlockIndex = Number(doc.body.dataset.codeWindowStartBlockIndex);
    const endBlockIndex = Number(doc.body.dataset.codeWindowEndBlockIndex);

    if (!Number.isFinite(startBlockIndex) || !Number.isFinite(endBlockIndex)) {
        console.warn("[Paralang] Code window metadata missing or invalid.", {
            blockIndex,
            startBlockIndex: doc.body.dataset.codeWindowStartBlockIndex,
            endBlockIndex: doc.body.dataset.codeWindowEndBlockIndex,
            isWindowed: doc.body.dataset.codeWindowIsWindowed
        });

        return true;
    }

    return blockIndex >= startBlockIndex && blockIndex <= endBlockIndex;
}

const pendingCodeSectionReloads = {
    left: null,
    right: null
};

const lastRequestedCodeSectionSrc = {
    left: "",
    right: ""
};

function reloadCodeFrameAroundBlock(side, blockIndex) {
    const filename = side === "right" ? rightSelect.value : leftSelect.value;
    const frame = side === "right" ? rightCodeFrame : leftCodeFrame;

    if (!filename || !frame) return;

    if (!Number.isFinite(blockIndex) || blockIndex < 0) return;

    const src = getCodeSrc(filename, side, {
        centerBlockIndex: blockIndex
    });

    const currentSrc = frame.getAttribute("src") || "";

    if (lastRequestedCodeSectionSrc[side] === src || currentSrc === src) {
        return;
    }

    if (pendingCodeSectionReloads[side]) {
        clearTimeout(pendingCodeSectionReloads[side]);
    }

    pendingCodeSectionReloads[side] = setTimeout(() => {
        lastRequestedCodeSectionSrc[side] = src;

        setCodeLoading(side, true);
        setFrameSource(frame, src, "No code view available.");

        pendingCodeSectionReloads[side] = null;
    }, 75);
}

let pendingCodeSyncFrame = false;

function requestCodePanelSync() {
    if (!codePanelEnabled) return;

    if (pendingCodeSyncFrame) return;

    pendingCodeSyncFrame = true;

    requestAnimationFrame(() => {
        pendingCodeSyncFrame = false;
        syncCodePanelsToCurrentSelection();
    });
}

function setCodeLoading(side, isLoading) {
    const overlay = side === "right"
        ? document.getElementById("rightCodeLoadingOverlay")
        : document.getElementById("leftCodeLoadingOverlay");

    if (!overlay) return;

    overlay.classList.toggle("is-visible", isLoading);
    overlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
}
