(() => {
  const dialog = document.getElementById("feedbackDialog");
  const openButton = document.getElementById("openFeedbackDialog");
  const closeButton = document.getElementById("closeFeedbackDialog");
  const cancelButton = document.getElementById("cancelFeedback");
  const form = document.getElementById("feedbackForm");
  const primaryLabel = document.getElementById("feedbackPrimaryLabel");
  const primaryHelp = document.getElementById("feedbackPrimaryHelp");
  const primaryInput = document.getElementById("feedbackPrimary");
  const secondaryField = document.getElementById("feedbackSecondaryField");
  const secondaryLabel = document.getElementById("feedbackSecondaryLabel");
  const secondaryHelp = document.getElementById("feedbackSecondaryHelp");
  const secondaryInput = document.getElementById("feedbackSecondary");

  if (!dialog || !openButton || !form) return;

  const questions = {
    bug: {
      type: "Something didn't work",
      primaryLabel: "What were you trying to do?",
      primaryHelp: "Briefly describe what you were doing.",
      secondaryLabel: "What happened instead?",
      secondaryHelp: "Tell us what went wrong. You can add a screenshot in Outlook."
    },
    confusing: {
      type: "Something was confusing",
      primaryLabel: "What were you trying to do?",
      primaryHelp: "Tell us what you wanted to accomplish.",
      secondaryLabel: "What was unclear?",
      secondaryHelp: "Which instruction, button, or part of the screen was confusing?"
    },
    suggestion: {
      type: "I have a suggestion",
      primaryLabel: "What would you like Paralang to do?",
      primaryHelp: "Describe your idea in your own words.",
      secondaryLabel: "How would this help you? (optional)",
      secondaryHelp: "Tell us when or why you would use it."
    },
    other: {
      type: "Something else",
      primaryLabel: "What would you like to tell us?",
      primaryHelp: "Add any comments or feedback here.",
      secondaryLabel: "",
      secondaryHelp: ""
    }
  };

  function selectedType() {
    return form.elements.feedback_type.value;
  }

  function updateQuestions() {
    const question = questions[selectedType()] || questions.bug;
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

  openButton.addEventListener("click", () => {
    const workspaceMenu = document.getElementById("layoutMenu");
    const workspaceButton = document.getElementById("layoutMenuButton");
    if (workspaceMenu) workspaceMenu.hidden = true;
    if (workspaceButton) workspaceButton.setAttribute("aria-expanded", "false");
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

    const question = questions[selectedType()] || questions.bug;
    const id = reportId();
    const primary = primaryInput.value.trim();
    const secondary = secondaryInput.disabled ? "" : secondaryInput.value.trim();
    const subject = `Paralang feedback: ${question.type} [${id}]`;
    const lines = [
      "Hello,",
      "",
      `Feedback type: ${question.type}`,
      "",
      question.primaryLabel,
      primary,
      ""
    ];

    if (question.secondaryLabel && secondary) {
      lines.push(question.secondaryLabel.replace(" (optional)", ""), secondary, "");
    }

    lines.push(
      "--- Automatically added by Paralang ---",
      `Paralang version: ${appVersion()}`,
      `Computer platform: ${platformDescription()}`,
      `Date and time: ${new Date().toLocaleString()}`,
      `Report ID: ${id}`,
      "",
      "You can attach a screenshot to this email if it would help explain the report."
    );

    const recipient = window.PARALANG_FEEDBACK_EMAIL || "";
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\r\n"))}`;
    window.location.href = mailto;
    closeDialog();
    form.reset();
    updateQuestions();
  });

  updateQuestions();
})();
