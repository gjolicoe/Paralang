(() => {
  const dialog = document.getElementById("pasteHtmlDialog");
  if (!dialog) return;

  const form = document.getElementById("pasteHtmlForm");
  const message = document.getElementById("pasteHtmlMessage");
  const conflictDialog = document.getElementById("pasteConflictDialog");
  const conflictForm = document.getElementById("pasteConflictForm");
  const conflictChoices = document.getElementById("pasteConflictChoices");
  let decisions = {};

  document.getElementById("openPasteDialog").addEventListener("click", () => {
    decisions = {};
    message.hidden = true;
    dialog.showModal();
  });
  document.getElementById("cancelPasteHtml").addEventListener("click", () => dialog.close());
  document.getElementById("cancelPasteConflict").addEventListener("click", () => {
    decisions = {};
    conflictDialog.close();
    dialog.close();
  });
  ["enPastedHtml", "frPastedHtml"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      decisions = {};
      message.hidden = true;
      if (conflictDialog.open) conflictDialog.close();
    });
  });
  document.querySelectorAll('input[name="pasteSaveLocation"]').forEach(input => {
    input.addEventListener("change", () => {
      decisions = {};
      message.hidden = true;
      if (conflictDialog.open) conflictDialog.close();
    });
  });

  async function savePastedHtml() {
    const response = await fetch("/api/pasted-html", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        en_html: document.getElementById("enPastedHtml").value,
        fr_html: document.getElementById("frPastedHtml").value,
        save_location: document.querySelector('input[name="pasteSaveLocation"]:checked').value,
        decisions
      })
    });
    const result = await response.json();

    if (response.status === 409) {
      conflictChoices.replaceChildren();
      result.conflicts.forEach(conflict => {
        const card = document.createElement("fieldset");
        card.className = "paste-conflict-card";
        const legend = document.createElement("legend");
        legend.textContent = conflict.language === "en" ? "English HTML" : "French HTML";
        const detail = document.createElement("p");
        detail.textContent = `A ${conflict.match} file already exists: ${conflict.filename}`;
        card.append(legend, detail);

        [["overwrite", "Overwrite existing", "Replace the existing file with this pasted content."],
         ["create", "Create new copy", "Keep the existing file and save a numbered copy."]]
          .forEach(([value, title, description], index) => {
            const label = document.createElement("label");
            label.className = "paste-conflict-option";
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = `conflict-${conflict.language}`;
            radio.value = value;
            radio.checked = index === 0;
            radio.addEventListener("change", () => { decisions[conflict.language] = value; });
            const text = document.createElement("span");
            text.innerHTML = `<strong>${title}</strong><small>${description}</small>`;
            label.append(radio, text);
            card.appendChild(label);
          });
        decisions[conflict.language] = "overwrite";
        conflictChoices.appendChild(card);
      });
      conflictDialog.showModal();
      return;
    }
    if (!response.ok) {
      message.hidden = false;
      message.textContent = result.error || "The pasted HTML could not be saved.";
      return;
    }
    if (result.cancelled) {
      dialog.close();
      return;
    }
    window.location.assign(result.redirect);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    savePastedHtml();
  });

  conflictForm.addEventListener("submit", event => {
    event.preventDefault();
    conflictDialog.close();
    savePastedHtml();
  });
})();
