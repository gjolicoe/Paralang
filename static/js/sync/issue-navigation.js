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

function highlightTableNumberMismatches() {
    const issues = Array.isArray(window.PARALANG_PREFLIGHT_ISSUES)
        ? window.PARALANG_PREFLIGHT_ISSUES
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
