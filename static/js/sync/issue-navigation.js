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