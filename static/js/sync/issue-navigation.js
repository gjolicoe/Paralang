function getFrameTargetIndexForBlock(frame, blockIndex) {
    if (blockIndex < 0) return -1;

    const doc = frame.contentDocument || frame.contentWindow.document;
    const elements = getComparableElements(frame);

    if (doc.body && doc.body.dataset.paralangCodeView === "true") {
        const target = doc.querySelector(`.code-line[data-block-index="${blockIndex}"]`);

        if (!target) return -1;

        return elements.indexOf(target);
    }

    return blockIndex;
}

function scrollToPreflightIssue(
    leftBlockIndex,
    rightBlockIndex,
    leftBlockSignature = "",
    rightBlockSignature = ""
) {
    const hasLeft = Number(leftBlockIndex) >= 0;
    const hasRight = Number(rightBlockIndex) >= 0;

    if (hasLeft) {
        scrollToIssueTarget("left", leftBlockIndex, leftBlockSignature);
        return;
    }

    if (hasRight) {
        scrollToIssueTarget("right", rightBlockIndex, rightBlockSignature);
    }
}

function clearAutomatedAlignmentHighlights() {
    [leftFrame, rightFrame].forEach(frame => {
        const doc = frame?.contentDocument || frame?.contentWindow?.document;
        if (!doc) return;

        doc.querySelectorAll("[data-paralang-alignment-highlight]").forEach(element => {
            element.removeAttribute("data-paralang-alignment-highlight");
        });
        doc.querySelectorAll("[data-paralang-alignment-section-highlight]").forEach(element => {
            element.remove();
        });
    });
}

function ensureAutomatedAlignmentHighlightStyles(doc) {
    if (doc.getElementById("paralang-alignment-highlight-styles")) return;

    const style = doc.createElement("style");
    style.id = "paralang-alignment-highlight-styles";
    style.textContent = `
        [data-paralang-alignment-highlight="strong"] {
            background-color: #fff1a8 !important;
            box-shadow: inset 4px 0 #f0ad00, inset -4px 0 #f0ad00 !important;
        }
        [data-paralang-alignment-highlight] {
            margin-left: -8px !important;
            padding-left: 8px !important;
            margin-right: -8px !important;
            padding-right: 8px !important;
        }
    `;
    (doc.head || doc.documentElement).appendChild(style);
}

function highlightAutomatedAlignmentSection(doc, elements, rangeKey) {
    const duplicate = Array.from(
        doc.querySelectorAll("[data-paralang-alignment-section-highlight]")
    ).some(element => element.dataset.paralangAlignmentRange === rangeKey);
    if (duplicate) return;

    const visibleBounds = elements
        .map(element => element.getBoundingClientRect())
        .filter(bounds => bounds.width > 0 && bounds.height > 0);
    if (!visibleBounds.length) return;

    const view = doc.defaultView;
    const scrollX = view?.scrollX || 0;
    const scrollY = view?.scrollY || 0;
    const left = Math.min(...visibleBounds.map(bounds => bounds.left)) + scrollX - 8;
    const right = Math.max(...visibleBounds.map(bounds => bounds.right)) + scrollX + 8;
    const top = Math.min(...visibleBounds.map(bounds => bounds.top)) + scrollY;
    const bottom = Math.max(...visibleBounds.map(bounds => bounds.bottom)) + scrollY;

    const overlay = doc.createElement("div");
    overlay.dataset.paralangAlignmentSectionHighlight = "soft";
    overlay.dataset.paralangAlignmentRange = rangeKey;
    overlay.style.position = "absolute";
    overlay.style.pointerEvents = "none";
    overlay.style.boxSizing = "border-box";
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${right - left}px`;
    overlay.style.height = `${bottom - top}px`;
    overlay.style.background = "rgba(255, 193, 7, 0.10)";
    overlay.style.boxShadow = "inset 2px 0 rgba(240, 173, 0, 0.38), inset -2px 0 rgba(240, 173, 0, 0.38)";
    overlay.style.zIndex = "2147483646";
    doc.body.appendChild(overlay);
}

function clampAlignmentElementsToSemanticContainer(elements, target) {
    if (!target || !elements.length) return elements;

    const container = target.closest([
        "figure",
        "[role='figure']",
        ".chart",
        ".wb-charts",
        ".panel",
        ".well"
    ].join(","));

    if (!container) return elements;

    const contained = elements.filter(element => container.contains(element));
    return contained.length ? contained : elements;
}

function applyAutomatedAlignmentHighlight(issueRow, clearExisting = true) {
    if (clearExisting) clearAutomatedAlignmentHighlights();

    const side = issueRow.dataset.issueSide === "right" ? "right" : "left";
    const frame = side === "right" ? rightFrame : leftFrame;
    const confidence = issueRow.dataset.issueAlignmentConfidence || "high";
    const elements = getComparableElements(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;
    ensureAutomatedAlignmentHighlightStyles(doc);

    if (confidence !== "low") {
        const target = findIssueTargetElement(
            frame,
            issueRow.dataset.issueBlockSignature || "",
            Number(issueRow.dataset.issueBlockIndex ?? -1)
        );
        if (!target) return;

        target.dataset.paralangAlignmentHighlight = "strong";
        return;
    }

    const prefix = side === "right" ? "Right" : "Left";
    const rawStart = issueRow.dataset[`issue${prefix}SectionStart`];
    const rawEnd = issueRow.dataset[`issue${prefix}SectionEnd`];
    if (rawStart === "" || rawEnd === "") return;
    const start = Number(rawStart);
    const end = Number(rawEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return;

    const rangeElements = elements.slice(Math.max(0, start), end + 1);
    const issueTarget = elements[Number(issueRow.dataset.issueBlockIndex)];
    const localizedElements = clampAlignmentElementsToSemanticContainer(
        rangeElements,
        issueTarget
    );

    highlightAutomatedAlignmentSection(
        doc,
        localizedElements,
        `${side}:${start}:${end}`
    );
}

function highlightStoredAutomatedAlignmentIssues() {
    clearAutomatedAlignmentHighlights();
    document.querySelectorAll(".diff-row.automated-issue").forEach(issueRow => {
        if (!(issueRow.dataset.issueTitle || "").startsWith("Extra block")
                || !["high", "low"].includes(
                    issueRow.dataset.issueAlignmentConfidence
                )) {
            return;
        }
        applyAutomatedAlignmentHighlight(issueRow, false);
    });
}

function highlightAutomatedAlignmentIssue(issueRow) {
    const side = issueRow.dataset.issueSide || "left";
    const blockIndex = Number(issueRow.dataset.issueBlockIndex ?? -1);
    const signature = issueRow.dataset.issueBlockSignature || "";

    scrollToIssueTarget(side, blockIndex, signature);
    // Issue navigation may first open a details element and synchronize both
    // frames. Apply the persistent finding highlight after that work settles.
    setTimeout(() => applyAutomatedAlignmentHighlight(issueRow), 30);
}

function highlightTableNumberMismatches() {
    const issues = Array.isArray(clientTableNumberIssues)
        ? clientTableNumberIssues
        : [];

    [[leftFrame, "left"], [rightFrame, "right"]].forEach(([frame, side]) => {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (!doc?.body) return;

        doc.querySelectorAll("[data-paralang-number-mismatch]").forEach(cell => {
            cell.removeAttribute("data-paralang-number-mismatch");
            cell.style.removeProperty("background-color");
        });

        const rows = getComparableElements(frame);
        issues.forEach(issue => {
            if (issue.title !== "Table number mismatch") return;
            const blockIndex = Number(issue[`${side}_block_index`]);
            const cellIndex = Number(issue[`${side}_cell_index`]);
            if (!Number.isInteger(blockIndex) || !Number.isInteger(cellIndex)) return;

            const row = rows[blockIndex];
            const cell = row?.querySelectorAll(":scope > th, :scope > td")[cellIndex];
            if (!cell) return;

            cell.dataset.paralangNumberMismatch = "true";
            cell.style.setProperty("background-color", "#fff4bf", "important");
        });
    });
}
