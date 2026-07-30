(() => {
  const dialog = document.getElementById("feedbackDialog");
  const openButton = document.getElementById("openFeedbackDialog");
  const closeButton = document.getElementById("closeFeedbackDialog");
  const cancelButton = document.getElementById("cancelFeedback");
  const form = document.getElementById("feedbackForm");
  const titleInput = document.getElementById("feedbackTitle");
  const primaryLabel = document.getElementById("feedbackPrimaryLabel");
  const primaryHelp = document.getElementById("feedbackPrimaryHelp");
  const primaryInput = document.getElementById("feedbackPrimary");
  const secondaryField = document.getElementById("feedbackSecondaryField");
  const secondaryLabel = document.getElementById("feedbackSecondaryLabel");
  const secondaryHelp = document.getElementById("feedbackSecondaryHelp");
  const secondaryInput = document.getElementById("feedbackSecondary");
  const outlookButton = document.getElementById("outlookFeedbackButton");

  if (!dialog || !openButton || !form || !titleInput) return;

  const t = value => window.ParalangI18n?.translateText(value) || value;
  const GITHUB_NEW_ISSUE_URL = "https://github.com/gjolicoe/paralang/issues/new";

  const questions = {
    issue: {
      type: "Issue",
      primaryLabel: "What were you trying to do?",
      primaryHelp: "Briefly describe what you were doing.",
      secondaryLabel: "What happened instead?",
      secondaryHelp: "Tell us what went wrong. You can add a screenshot before submitting."
    },
    suggestion: {
      type: "Suggestion",
      primaryLabel: "What would you like Paralang to do?",
      primaryHelp: "Describe your idea in your own words.",
      secondaryLabel: "How would this help you?",
      secondaryHelp: "Tell us when or why you would use it."
    }
  };

  function selectedType() {
    return form.elements.feedback_type.value;
  }

  function updateQuestions() {
    const question = questions[selectedType()] || questions.issue;
    titleInput.placeholder = t(
      selectedType() === "suggestion"
        ? "Example: Add a faster comparison workflow"
        : "Example: Comparison does not load"
    );
    primaryLabel.textContent = question.primaryLabel;
    primaryHelp.textContent = question.primaryHelp;
    secondaryLabel.textContent = question.secondaryLabel;
    secondaryHelp.textContent = question.secondaryHelp;
    secondaryField.hidden = !question.secondaryLabel;
    secondaryInput.disabled = !question.secondaryLabel;
  }

  function closeDialog() {
    dialog.close();
  }

  function reportId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().split("-")[0].toUpperCase();
    }
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  let currentReportId = reportId();

  function platformDescription() {
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      return navigator.userAgentData.platform;
    }
    return navigator.platform || "Not available";
  }

  function appVersion() {
    const versionLabel = document.querySelector(".pageTitle small");
    return versionLabel ? versionLabel.textContent.trim().replace(/^v/i, "") : "Not available";
  }

  function feedbackContent() {
    const source = questions[selectedType()] || questions.issue;
    const question = Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, t(value)])
    );
    const secondary = secondaryInput.disabled ? "" : secondaryInput.value.trim();

    return {
      type: selectedType(),
      question,
      title: titleInput.value.trim(),
      primary: primaryInput.value.trim(),
      secondary,
      environment: [
        `${t("Paralang version:")} ${appVersion()}`,
        `${t("Computer platform:")} ${platformDescription()}`,
        `${t("Date and time:")} ${new Date().toLocaleString(window.PARALANG_UI_LANGUAGE === "fr" ? "fr-CA" : "en-CA")}`,
        `${t("Report ID:")} ${currentReportId}`
      ].join("\n")
    };
  }

  function githubIssueUrl(content) {
    const url = new URL(GITHUB_NEW_ISSUE_URL);
    url.searchParams.set(
      "template",
      content.type === "suggestion" ? "suggestion.yml" : "issue.yml"
    );
    url.searchParams.set("title", content.title);
    url.searchParams.set(
      "details",
      `${content.question.primaryLabel}\n${content.primary}`
    );

    if (content.type === "suggestion" && content.secondary) {
      url.searchParams.set("benefit", content.secondary);
    } else if (content.secondary) {
      url.searchParams.set(
        "details",
        `${content.question.primaryLabel}\n${content.primary}\n\n${content.question.secondaryLabel}\n${content.secondary}`
      );
    }

    url.searchParams.set("environment", content.environment);
    return url.toString();
  }

  function emailUrl(content) {
    const subjectPrefix = window.PARALANG_UI_LANGUAGE === "fr"
      ? "Commentaires sur Paralang"
      : "Paralang feedback";
    const subject = `${subjectPrefix}: ${content.title}`;
    const lines = [
      t("Hello,"),
      "",
      `${t("Feedback type:")} ${content.question.type}`,
      `${t("Short title:")} ${content.title}`,
      "",
      content.question.primaryLabel,
      content.primary,
      ""
    ];

    if (content.question.secondaryLabel && content.secondary) {
      lines.push(
        content.question.secondaryLabel.replace(/ \((?:optional|facultatif)\)/, ""),
        content.secondary,
        ""
      );
    }

    lines.push(
      t("--- Automatically added by Paralang ---"),
      content.environment,
      "",
      t("You can attach a screenshot to this email if it would help explain the report.")
    );

    const recipient = window.PARALANG_FEEDBACK_EMAIL || "";
    return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\r\n"))}`;
  }

  openButton.addEventListener("click", () => {
    const workspaceMenu = document.getElementById("layoutMenu");
    const workspaceButton = document.getElementById("layoutMenuButton");
    if (workspaceMenu) workspaceMenu.hidden = true;
    if (workspaceButton) workspaceButton.setAttribute("aria-expanded", "false");
    currentReportId = reportId();
    updateQuestions();
    dialog.showModal();
  });

  closeButton.addEventListener("click", closeDialog);
  cancelButton.addEventListener("click", closeDialog);
  form.addEventListener("change", event => {
    if (event.target.name === "feedback_type") updateQuestions();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const issueWindow = window.open(
      githubIssueUrl(feedbackContent()),
      "_blank",
      "noopener,noreferrer"
    );
    if (issueWindow) issueWindow.opener = null;
  });

  outlookButton?.addEventListener("click", () => {
    if (!form.reportValidity()) return;
    window.location.href = emailUrl(feedbackContent());
  });

  updateQuestions();
})();
