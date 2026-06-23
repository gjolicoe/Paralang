let issuePollingTimer = null;
let issueCountdownTimer = null;
let issuePollingInProgress = false;
let issueRefreshSecondsRemaining = 10;
const issueRefreshIntervalSeconds = 10;

async function refreshUserIssuesFromServer() {
  if (issuePollingInProgress) return;

  issuePollingInProgress = true;

  try {
    const params = getCurrentIssueApiParams();

    const response = await fetch(`/api/issues?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const result = await response.json();

    renderIssues(result.issues || []);
    resetIssueRefreshCountdown();
  } catch (error) {
    console.warn("[Paralang] Could not refresh user issues:", error);
  } finally {
    issuePollingInProgress = false;
  }
}

function startIssuePolling() {
  stopIssuePolling();

  refreshUserIssuesFromServer();
  startIssueRefreshCountdown();

  issuePollingTimer = window.setInterval(() => {
    refreshUserIssuesFromServer();
  }, issueRefreshIntervalSeconds * 1000);
}

function stopIssuePolling() {
  if (issuePollingTimer) {
    window.clearInterval(issuePollingTimer);
    issuePollingTimer = null;
  }

  stopIssueRefreshCountdown();
}

function updateIssueRefreshCountdownDisplay() {
  const countdown = document.getElementById("issueRefreshCountdown");

  if (!countdown) return;

  countdown.textContent = `Refresh in ${issueRefreshSecondsRemaining}s`;
}

function resetIssueRefreshCountdown() {
  issueRefreshSecondsRemaining = issueRefreshIntervalSeconds;
  updateIssueRefreshCountdownDisplay();
}

function startIssueRefreshCountdown() {
  stopIssueRefreshCountdown();
  resetIssueRefreshCountdown();

  issueCountdownTimer = window.setInterval(() => {
    issueRefreshSecondsRemaining -= 1;

    if (issueRefreshSecondsRemaining <= 0) {
      issueRefreshSecondsRemaining = issueRefreshIntervalSeconds;
    }

    updateIssueRefreshCountdownDisplay();
  }, 1000);
}

function stopIssueRefreshCountdown() {
  if (issueCountdownTimer) {
    window.clearInterval(issueCountdownTimer);
    issueCountdownTimer = null;
  }
}

function getReviewUserName() {
  return localStorage.getItem("paralangReviewUserName") || "";
}

function askForReviewUserName() {
  const currentName = getReviewUserName();

  const name = prompt(
    "Enter your name for QA notes:",
    currentName || ""
  );

  if (!name) {
    return "";
  }

  const cleanedName = name.trim();

  if (!cleanedName) {
    return "";
  }

  localStorage.setItem("paralangReviewUserName", cleanedName);

  return cleanedName;
}

function getOrAskReviewUserName() {
  const savedName = getReviewUserName();

  if (savedName) {
    return savedName;
  }

  return askForReviewUserName();
}

function changeReviewUserName() {
  const updatedName = askForReviewUserName();

  if (!updatedName) {
    return;
  }

  alert(`Reviewer name updated to: ${updatedName}`);
}

function getCurrentReviewSide() {
  if (singleViewEnabled) {
    return "left";
  }

  return "left";
}

function getCurrentReviewFrame(side) {
  return side === "right" ? rightFrame : leftFrame;
}

function getCurrentReviewFile(side) {
  if (side === "right") {
    const hidden = document.getElementById("rightResolvedFile");

    if (getSelectedEnv() === "canada-ca-url" && hidden) {
      return hidden.value;
    }

    return rightSelect.value;
  }

  const hidden = document.getElementById("leftResolvedFile");

  if (getSelectedEnv() === "canada-ca-url" && hidden) {
    return hidden.value;
  }

  return leftSelect.value;
}

function getCurrentSelectedBlockData(side) {
  const frame = getCurrentReviewFrame(side);
  const elements = getComparableElements(frame);

  if (!elements.length) {
    return null;
  }

  let index = selectedElementIndex;

  if (side === "right") {
    index = Math.max(0, selectedElementIndex + getEffectiveRightSyncOffset());
  }

  index = Math.max(0, Math.min(index, elements.length - 1));

  const element = elements[index];

  if (!element) {
    return null;
  }

  return {
    block_index: index,
    block_signature: getComparableElementSignature(element),
    block_hash: getSimpleTextHash(element.outerHTML || element.textContent || ""),
    preview: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180)
  };
}

function getSimpleTextHash(value) {
  let hash = 0;
  const text = value || "";

  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  return String(hash);
}

async function createUserMarkedIssue() {
  const userName = getOrAskReviewUserName();

  if (!userName) {
    askForReviewUserName();
    return;
  }

  const side = getCurrentReviewSide();
  const blockData = getCurrentSelectedBlockData(side);

  if (!blockData) {
    alert("No selected block found.");
    return;
  }

  const title = prompt("Issue title:", "Review this block");

  if (!title) {
    return;
  }

  const comment = prompt("Comment:", blockData.preview || "");

  const payload = {
    source_env: getSelectedEnv(),
    year: getSelectedYear(),
    filename: getCurrentReviewFile(side),
    left_file: getCurrentReviewFile("left"),
    right_file: getCurrentReviewFile("right"),
    side: side,
    block_index: blockData.block_index,
    block_signature: blockData.block_signature,
    block_hash: blockData.block_hash,
    severity: "warning",
    title: title,
    comment: comment || "",
    created_by: userName
  };

  const response = await fetch("/api/issues", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    alert(result.error || "Could not create issue.");
    return;
  }

  await refreshUserIssuesFromServer();
}

function getComparableElementsIncludingClosedDetails(frame) {
  const doc = frame.contentDocument || frame.contentWindow.document;

  if (!doc || !doc.body) return [];

  const contentArea = getPrimaryContentContainer(doc);

  if (!contentArea) return [];

  return Array.from(
    contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, tr, figure, img")
  ).filter(element => {
    const tag = element.tagName.toLowerCase();

    if (element.closest("li") && tag !== "li") {
      return false;
    }

    if (element.closest("table") && tag !== "tr") {
      return false;
    }

    return true;
  });
}

function getSafeNumber(value, fallback = -1) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getComparableElementsIncludingClosedDetails(frame) {
  const doc = frame.contentDocument || frame.contentWindow.document;

  if (!doc || !doc.body) return [];

  const contentArea = getPrimaryContentContainer(doc);

  if (!contentArea) return [];

  return Array.from(
    contentArea.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, tr, figure, img")
  ).filter(element => {
    const tag = element.tagName.toLowerCase();

    if (element.closest("li") && tag !== "li") {
      return false;
    }

    if (element.closest("table") && tag !== "tr") {
      return false;
    }

    return true;
  });
}

function findIssueTargetElement(frame, blockSignature, fallbackBlockIndex) {
  const allElements = getComparableElementsIncludingClosedDetails(frame);
  const safeFallbackIndex = getSafeNumber(fallbackBlockIndex, -1);

  if (!allElements.length) {
    return null;
  }

  if (blockSignature) {
    const normalizedSignature = normalizeComparableSignature(blockSignature);

    const matches = allElements
      .map((element, index) => ({ element, index }))
      .filter(item => {
        return getComparableElementSignature(item.element) === normalizedSignature;
      });

    if (matches.length === 1) {
      return matches[0].element;
    }

    if (matches.length > 1) {
      if (safeFallbackIndex < 0) {
        return matches[0].element;
      }

      matches.sort((a, b) => {
        return Math.abs(a.index - safeFallbackIndex) - Math.abs(b.index - safeFallbackIndex);
      });

      return matches[0].element;
    }
  }

  if (safeFallbackIndex >= 0 && safeFallbackIndex < allElements.length) {
    return allElements[safeFallbackIndex];
  }

  return null;
}

function openAllParentDetailsForElement(frame, element) {
  if (!frame || !element) return;

  const parentDetails = Array.from(element.closest("body").querySelectorAll("details"))
    .filter(details => details.contains(element));

  if (!parentDetails.length) return;

  isOpeningDetailsForIssueNavigation = true;

  try {
    parentDetails.forEach(details => {
      details.open = true;

      if (!singleViewEnabled) {
        syncMatchingDetailsPanel(frame, details);
      }
    });
  } finally {
    // Let toggle events finish first.
    setTimeout(() => {
      isOpeningDetailsForIssueNavigation = false;
    }, 0);
  }
}

function getVisibleComparableIndexForElement(frame, targetElement) {
  if (!frame || !targetElement) return -1;

  const visibleElements = getComparableElements(frame);

  return visibleElements.indexOf(targetElement);
}

function convertSideIndexToLeftIndex(side, sideIndex) {
  const safeSideIndex = getSafeNumber(sideIndex, -1);

  if (safeSideIndex < 0) {
    return -1;
  }

  if (side === "right") {
    return Math.max(0, safeSideIndex - getEffectiveRightSyncOffset());
  }

  return Math.max(0, safeSideIndex);
}

function scrollToIssueTarget(side, fallbackBlockIndex, blockSignature = "") {
  const safeSide = side === "right" ? "right" : "left";
  const frame = safeSide === "right" ? rightFrame : leftFrame;

  const targetElement = findIssueTargetElement(
    frame,
    blockSignature,
    fallbackBlockIndex
  );

  if (!targetElement) {
    const fallbackLeftIndex = convertSideIndexToLeftIndex(
      safeSide,
      fallbackBlockIndex
    );

    if (fallbackLeftIndex >= 0) {
      syncToElement(fallbackLeftIndex);
    }

    return;
  }

  openAllParentDetailsForElement(frame, targetElement);

  setTimeout(() => {
    const visibleIndex = getVisibleComparableIndexForElement(frame, targetElement);

    if (visibleIndex >= 0) {
      const leftIndex = convertSideIndexToLeftIndex(safeSide, visibleIndex);

      if (leftIndex >= 0) {
        syncToElement(leftIndex);
        return;
      }
    }

    const fallbackLeftIndex = convertSideIndexToLeftIndex(
      safeSide,
      fallbackBlockIndex
    );

    if (fallbackLeftIndex >= 0) {
      syncToElement(fallbackLeftIndex);
    }
  }, 0);
}

function scrollToUserMarkedIssue(side, blockIndex, blockSignature = "") {
  scrollToIssueTarget(side, blockIndex, blockSignature || "");
}

function setupReviewIssueControls() {
  const markIssueButton = document.getElementById("markIssueButton");

  if (markIssueButton) {
    markIssueButton.addEventListener("click", createUserMarkedIssue);
  }

  const changeReviewerNameButton = document.getElementById("changeReviewerNameButton");

  if (changeReviewerNameButton) {
    changeReviewerNameButton.addEventListener("click", changeReviewUserName);
  }

  const rerunButton = document.getElementById("rerunAutomatedIssuesButton");

  if (rerunButton) {
    rerunButton.addEventListener("click", rerunAutomatedIssuesCheck);
  }

  updateReviewIssueButtonsState();
  setupIssuePanelClickHandler();
  startIssuePolling();
}

function getIssuePanelHeader() {
  return document.querySelector(".diff-header");
}

function updateIssuePanelHeaderCounts() {
  const automatedCountEl = document.getElementById("automatedIssueCount");
  const userIssueCountEl = document.getElementById("userIssueCount");

  const automatedCount = document.querySelectorAll(".diff-row.automated-issue").length;
  const userIssueCount = document.querySelectorAll(".diff-row.user-issue").length;

  if (automatedCountEl) {
    automatedCountEl.textContent = String(automatedCount);
  }

  if (userIssueCountEl) {
    userIssueCountEl.textContent = String(userIssueCount);
  }
}

function updateNoIssuesMessage() {
  const diffPanel = document.getElementById("diffPanel");

  if (!diffPanel) return;

  const issueCount = document.querySelectorAll(
    ".diff-row.user-issue, .diff-row.automated-issue"
  ).length;

  const existingMessage = document.getElementById("noIssuesMessage");

  if (issueCount === 0) {
    if (!existingMessage) {
      const message = document.createElement("div");
      message.id = "noIssuesMessage";
      message.className = "no-diffs";
      message.textContent = "No issues found.";
      diffPanel.appendChild(message);
    }

    return;
  }

  if (existingMessage) {
    existingMessage.remove();
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addUserIssueToPanel(issue) {
  refreshUserIssuesFromServer();
}

async function markUserIssueFixed(issueId) {
  if (!issueId) return;

  const confirmed = confirm("Remove this issue from the issue panel?");

  if (!confirmed) return;

  const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, {
    method: "DELETE"
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    alert(result.error || "Could not remove issue.");
    return;
  }

  const row = document.querySelector(`.diff-row.user-issue[data-issue-id="${CSS.escape(issueId)}"]`);

  await refreshUserIssuesFromServer();
}

function updateNoIssuesMessage() {
  const diffPanel = document.getElementById("diffPanel");

  if (!diffPanel) return;

  const automatedCount = Array.isArray(window.PARALANG_PREFLIGHT_ISSUES)
    ? window.PARALANG_PREFLIGHT_ISSUES.length
    : 0;

  const userIssueCount = document.querySelectorAll(".diff-row.user-issue").length;
  const existingMessage = document.getElementById("noIssuesMessage");

  if (automatedCount === 0 && userIssueCount === 0) {
    if (!existingMessage) {
      const message = document.createElement("div");
      message.id = "noIssuesMessage";
      message.className = "no-diffs";
      message.textContent = "No issues found.";
      diffPanel.appendChild(message);
    }

    return;
  }

  if (existingMessage) {
    existingMessage.remove();
  }
}

function reviewIssuesDisabledForEnvironment(env) {
  return env === "aem-sensitive" || env === "canada-ca-url";
}

function updateReviewIssueButtonsState() {
  const disabled = reviewIssuesDisabledForEnvironment(getSelectedEnv());

  const markIssueButton = document.getElementById("markIssueButton");
  const changeReviewerNameButton = document.getElementById("changeReviewerNameButton");

  const rerunButton = document.getElementById("rerunAutomatedIssuesButton");

  if (markIssueButton) {
    markIssueButton.disabled = disabled;
    markIssueButton.title = disabled
      ? "Issue marking is disabled for URL-based environments."
      : "Mark the currently selected block as an issue";
  }

  if (changeReviewerNameButton) {
    changeReviewerNameButton.disabled = disabled;
    changeReviewerNameButton.title = disabled
      ? "Reviewer names are only needed when issue marking is enabled."
      : "Change reviewer name";
  }

  if (rerunButton) {
    rerunButton.disabled = disabled;
    rerunButton.title = disabled
      ? "Automated issue tracking is disabled for URL-based environments."
      : "Re-run automated issue check for this page pair";
  }
}

function getCurrentIssueApiParams() {
  const params = new URLSearchParams();

  params.set("source_env", getSelectedEnv());
  params.set("year", getSelectedYear());
  params.set("left_file", getCurrentReviewFile("left"));
  params.set("right_file", getCurrentReviewFile("right"));

  return params;
}

function removeAllStoredIssueRows() {
  document.querySelectorAll(".diff-row.user-issue, .diff-row.automated-issue").forEach(row => {
    row.remove();
  });
}

function renderIssueRow(issue) {
  const row = document.createElement("div");

  const sourceClass = issue.issue_source === "automated"
    ? "automated-issue"
    : "user-issue";

  const sourceLabel = issue.issue_source === "automated"
    ? "Auto"
    : "User";

  row.className = `diff-row ${sourceClass} ${issue.severity || "warning"}`;
  row.dataset.issueId = issue.id;
  row.dataset.issueSource = issue.issue_source || "user";
  row.dataset.issueSide = issue.side;
  row.dataset.issueBlockIndex = issue.block_index;
  row.dataset.issueBlockSignature = issue.block_signature || "";

  row.innerHTML = `
    <div class="diff-index">${sourceLabel}</div>

    <div class="diff-left">
      <strong>${escapeHtml(issue.title)}</strong><br>
      ${escapeHtml(issue.comment)}
    </div>

    <div class="diff-right">
      <span>Status: ${escapeHtml(issue.status)}</span><br>
      <span>By: ${escapeHtml(issue.created_by)}</span>
    </div>

    <button class="issue-fixed-btn"
            type="button"
            data-issue-action="fixed"
            data-issue-id="${escapeHtml(issue.id)}">
      Mark fixed
    </button>
  `;

  return row;
}

function renderIssues(issues) {
  const diffPanel = document.getElementById("diffPanel");

  if (!diffPanel) return;

  removeAllStoredIssueRows();

  const noIssuesMessage = document.getElementById("noIssuesMessage");

  issues.forEach(issue => {
    const row = renderIssueRow(issue);

    if (noIssuesMessage) {
      diffPanel.insertBefore(row, noIssuesMessage);
    } else {
      diffPanel.appendChild(row);
    }
  });

  updateIssuePanelHeaderCounts();
  updateNoIssuesMessage();
}

async function rerunAutomatedIssuesCheck() {
  const confirmed = confirm(
    "Re-run the automated issue check? This will replace existing automated issues for this page pair."
  );

  if (!confirmed) return;

  const payload = {
    source_env: getSelectedEnv(),
    year: getSelectedYear(),
    left_file: getCurrentReviewFile("left"),
    right_file: getCurrentReviewFile("right")
  };

  const response = await fetch("/api/issues/rerun-automated", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    alert(result.error || "Could not re-run automated issue check.");
    return;
  }

  renderIssues(result.issues || []);
  resetIssueRefreshCountdown();
}

function setupIssuePanelClickHandler() {
  const diffPanel = document.getElementById("diffPanel");

  if (!diffPanel || diffPanel.dataset.issueClickBound === "true") {
    return;
  }

  diffPanel.dataset.issueClickBound = "true";

  diffPanel.addEventListener("click", event => {
    const fixedButton = event.target.closest("[data-issue-action='fixed']");

    if (fixedButton) {
      event.preventDefault();
      event.stopPropagation();

      const issueId = fixedButton.dataset.issueId;

      if (issueId) {
        markUserIssueFixed(issueId);
      }

      return;
    }

    const issueRow = event.target.closest(".diff-row.user-issue, .diff-row.automated-issue");

    if (!issueRow || !diffPanel.contains(issueRow)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    scrollToIssueTarget(
      issueRow.dataset.issueSide || "left",
      Number(issueRow.dataset.issueBlockIndex ?? -1),
      issueRow.dataset.issueBlockSignature || ""
    );
  });
}