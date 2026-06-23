function buildGlobalSyncAlignment(leftSignatures, rightSignatures) {
    const leftLength = leftSignatures.length;
    const rightLength = rightSignatures.length;

    const matchScore = 3;
    const mismatchScore = -2;
    const gapPenalty = -2;

    const scores = Array.from({ length: leftLength + 1 }, () =>
        Array(rightLength + 1).fill(0)
    );

    const moves = Array.from({ length: leftLength + 1 }, () =>
        Array(rightLength + 1).fill(null)
    );

    for (let i = 1; i <= leftLength; i += 1) {
        scores[i][0] = scores[i - 1][0] + gapPenalty;
        moves[i][0] = "up";
    }

    for (let j = 1; j <= rightLength; j += 1) {
        scores[0][j] = scores[0][j - 1] + gapPenalty;
        moves[0][j] = "left";
    }

    for (let i = 1; i <= leftLength; i += 1) {
        for (let j = 1; j <= rightLength; j += 1) {
            const leftSignature = leftSignatures[i - 1];
            const rightSignature = rightSignatures[j - 1];

            const positionPenalty = Math.abs(i - j) * 0.15;

            const diagonalScore =
                scores[i - 1][j - 1] +
                (leftSignature === rightSignature ? matchScore : mismatchScore) -
                positionPenalty;

            const upScore = scores[i - 1][j] + gapPenalty;
            const leftScore = scores[i][j - 1] + gapPenalty;

            const bestScore = Math.max(diagonalScore, upScore, leftScore);

            scores[i][j] = bestScore;

            if (bestScore === diagonalScore) {
                moves[i][j] = "diagonal";
            } else if (bestScore === leftScore) {
                moves[i][j] = "left";
            } else {
                moves[i][j] = "up";
            }
        }
    }

    const leftToRight = Array(leftLength).fill(-1);
    const rightToLeft = Array(rightLength).fill(-1);

    let i = leftLength;
    let j = rightLength;

    while (i > 0 || j > 0) {
        const move = moves[i][j];

        if (move === "diagonal") {
            leftToRight[i - 1] = j - 1;
            rightToLeft[j - 1] = i - 1;
            i -= 1;
            j -= 1;
            continue;
        }

        if (move === "up") {
            i -= 1;
            continue;
        }

        if (move === "left") {
            j -= 1;
            continue;
        }

        break;
    }

    return {
        leftToRight,
        rightToLeft
    };
}

function getNearestMappedRightIndex(leftToRight, leftIndex, rightCount) {
    if (leftToRight[leftIndex] >= 0) {
        return leftToRight[leftIndex];
    }

    return Math.max(0, Math.min(leftIndex, rightCount - 1));
}

function clampRightIndexToStableRange(candidateRightIndex, leftIndex, rightCount) {
    if (!Number.isFinite(candidateRightIndex)) {
        return Math.max(0, Math.min(leftIndex, rightCount - 1));
    }

    const safeCandidate = Math.max(0, Math.min(candidateRightIndex, rightCount - 1));

    if (!Number.isFinite(lastAutoSyncedRightIndex)) {
        return safeCandidate;
    }

    const maxStep = 3;

    const minAllowed = Math.max(0, lastAutoSyncedRightIndex - maxStep);
    const maxAllowed = Math.min(rightCount - 1, lastAutoSyncedRightIndex + maxStep);

    return Math.max(minAllowed, Math.min(safeCandidate, maxAllowed));
}