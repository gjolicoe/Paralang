(() => {
  const dialog = document.getElementById("environmentDialog");
  const openButton = document.getElementById("openEnvironmentDialog");
  const closeButton = document.getElementById("closeEnvironmentDialog");
  const form = document.getElementById("environmentPresetForm");
  const message = document.getElementById("environmentPresetMessage");
  const importInput = document.getElementById("environmentPresetImport");
  const detectAdditionalFolders = document.getElementById("detectAdditionalFolders");
  const additionalFoldersFields = document.getElementById("additionalFoldersFields");
  const additionalFoldersList = document.getElementById("additionalFoldersList");
  const addAdditionalFolder = document.getElementById("addAdditionalFolder");

  if (!dialog || !openButton || !form) return;

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  async function savePreset(preset) {
    const response = await fetch("/api/environment-presets", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(preset)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save the preset.");
    return result.preset;
  }

  openButton.addEventListener("click", () => {
    const workspaceMenu = document.getElementById("layoutMenu");
    const workspaceButton = document.getElementById("layoutMenuButton");
    if (workspaceMenu) workspaceMenu.hidden = true;
    if (workspaceButton) workspaceButton.setAttribute("aria-expanded", "false");
    dialog.showModal();
  });
  closeButton.addEventListener("click", () => dialog.close());

  function updateAdditionalFoldersVisibility() {
    additionalFoldersFields.hidden = !detectAdditionalFolders.checked;
  }

  function appendAdditionalFolder(value = "") {
    const row = document.createElement("div");
    row.className = "additional-folder-row";
    const input = document.createElement("input");
    input.type = "text";
    input.name = "additional_folder";
    input.maxLength = 200;
    input.value = value;
    input.setAttribute("aria-label", "Additional folder path");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.removeAdditionalFolder = "";
    remove.className = "environment-button environment-button-quiet";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove folder");
    row.append(input, remove);
    additionalFoldersList.appendChild(row);
    input.focus();
  }

  detectAdditionalFolders.addEventListener("change", updateAdditionalFoldersVisibility);
  addAdditionalFolder.addEventListener("click", () => appendAdditionalFolder());
  additionalFoldersList.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-additional-folder]");
    if (!remove) return;
    remove.closest(".additional-folder-row").remove();
    if (!additionalFoldersList.children.length) appendAdditionalFolder();
  });
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      while (additionalFoldersList.children.length > 1) additionalFoldersList.lastElementChild.remove();
      const firstInput = additionalFoldersList.querySelector("input[name='additional_folder']");
      if (firstInput) firstInput.value = "report-rapport";
      showMessage("");
      updateAdditionalFoldersVisibility();
    }, 0);
  });
  updateAdditionalFoldersVisibility();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("");
    const data = new FormData(form);
    try {
      await savePreset({
        id: data.get("id"),
        label: data.get("label"),
        group: data.get("group"),
        root: data.get("root"),
        collection_mode: data.get("collection_mode"),
        content_selector: data.get("content_selector"),
        include_root_html: data.has("include_root_html"),
        include_landing_pages: true,
        additional_folders: detectAdditionalFolders.checked
          ? data.getAll("additional_folder").map(value => value.trim()).filter(Boolean)
          : []
      });
      window.location.reload();
    } catch (error) {
      showMessage(error.message);
    }
  });

  dialog.addEventListener("click", async event => {
    const deleteButton = event.target.closest("[data-delete-preset]");
    const exportButton = event.target.closest("[data-export-preset]");
    if (deleteButton) {
      const presetId = deleteButton.dataset.deletePreset;
      if (!window.confirm(`Delete the ${presetId} environment preset?`)) return;
      const response = await fetch(`/api/environment-presets/${encodeURIComponent(presetId)}`, {method: "DELETE"});
      if (response.ok) window.location.reload();
      else showMessage("Could not delete the preset.");
    }
    if (exportButton) {
      const row = exportButton.closest("[data-preset]");
      const preset = JSON.parse(row.dataset.preset);
      const blob = new Blob([JSON.stringify(preset, null, 2)], {type: "application/json"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${preset.id}.paralang-environment.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    if (!file) return;
    showMessage("");
    try {
      const value = JSON.parse(await file.text());
      const presets = Array.isArray(value) ? value : (value.presets || [value]);
      for (const preset of presets) await savePreset(preset);
      window.location.reload();
    } catch (error) {
      showMessage(error instanceof SyntaxError ? "The selected file is not valid JSON." : error.message);
      importInput.value = "";
    }
  });
})();
