let clientTableNumberIssues = [];
let latestStoredIssues = [
  ...(window.PARALANG_PREFLIGHT_ISSUES || []),
  ...(window.PARALANG_USER_ISSUES || [])
];

function parseLocalizedTableNumber(text, language) {
  let value = String(text || "")
    .trim()
    .replace(/[\u00a0\u202f]/g, " ");

  if (!value) return null;

  const negative = value.startsWith("(") && value.endsWith(")");
  if (negative) {
    value = value.slice(1, -1).trim();
  }

  value = value
    .replace(/(?:CAD|USD|EUR|CA|US)/gi, "")
    .replace(/[$€£]/g, "")
    .trim();

  if (!/^[+-]?[\d\s.,']+$/.test(value)) return null;

  value = value.replace(/[\s']/g, "");
  value = language === "fr"
    ? value.replace(/\./g, "").replace(",", ".")
    : value.replace(/,/g, "");

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return negative ? -number : number;
}

function getDirectTableCells(row) {
  return Array.from(row?.children || []).filter(cell => {
    const tag = cell.tagName?.toLowerCase();
    return tag === "th" || tag === "td";
  });
}

function buildClientTableNumberIssues() {
  if (singleViewEnabled || !leftFrame.contentDocument || !rightFrame.contentDocument) {
    return [];
  }

  const leftElements = getComparableElementsCached(leftFrame);
  const rightElements = getComparableElementsCached(rightFrame);
  const issues = [];

  leftElements.forEach((leftRow, leftIndex) => {
    if (leftRow.tagName?.toLowerCase() !== "tr") return;

    const rightIndex = findBestRightIndexForLeftIndex(leftIndex);
    const rightRow = rightElements[rightIndex];
    if (rightRow?.tagName?.toLowerCase() !== "tr") return;

    const leftCells = getDirectTableCells(leftRow);
    const rightCells = getDirectTableCells(rightRow);
    const cellCount = Math.min(leftCells.length, rightCells.length);

    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const leftText = leftCells[cellIndex].textContent.trim();
      const rightText = rightCells[cellIndex].textContent.trim();
      const leftNumber = parseLocalizedTableNumber(leftText, "en");
      const rightNumber = parseLocalizedTableNumber(rightText, "fr");

      if (leftNumber === null || rightNumber === null || leftNumber === rightNumber) {
        continue;
      }

      issues.push({
        id: `client_table_number_${leftIndex}_${rightIndex}_${cellIndex}`,
        issue_source: "automated",
        side: "left",
        block_index: leftIndex,
        block_signature: getComparableElementSignature(leftRow),
        left_block_index: leftIndex,
        right_block_index: rightIndex,
        left_cell_index: cellIndex,
        right_cell_index: cellIndex,
        severity: "warning",
        status: "open",
        title: "Table number mismatch",
        comment: `Table values differ: English ${leftText}; French ${rightText}.`,
        created_by: "Automated check"
      });
    }
  });

  return issues;
}

function refreshClientTableNumberIssues() {
  clientTableNumberIssues = buildClientTableNumberIssues();

  if (typeof renderIssues === "function") {
    renderIssues(latestStoredIssues);
    return;
  }

  highlightTableNumberMismatches();
}
