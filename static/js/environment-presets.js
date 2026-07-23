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
  const formTitle = document.getElementById("environmentPresetFormTitle");
  const formDescription = document.getElementById("environmentPresetFormDescription");
  const resetButton = document.getElementById("environmentPresetReset");
  const submitButton = document.getElementById("environmentPresetSubmit");
  let editingPresetId = null;

  if (!dialog || !openButton || !form) return;

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function translate(text) {
    return window.ParalangI18n?.translateText(text) || text;
  }

  function restoreDefaultGroup() {
    form.elements.group.value = translate("Team presets");
  }

  async function savePreset(preset, existingId = null) {
    const endpoint = existingId
      ? `/api/environment-presets/${encodeURIComponent(existingId)}`
      : "/api/environment-presets";
    const response = await fetch(endpoint, {
      method: existingId ? "PUT" : "POST",
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

  function appendAdditionalFolder(value = "", focus = true) {
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
    if (focus) input.focus();
  }

  function setFormMode(preset = null) {
    editingPresetId = preset?.id || null;
    const editing = Boolean(editingPresetId);
    form.classList.toggle("is-editing", editing);
    formTitle.textContent = translate(editing ? "Edit preset" : "Create a preset");
    formDescription.textContent = translate(editing
      ? "Update this content source without recreating it."
      : "Connect Paralang to a local or shared folder structure.");
    submitButton.textContent = translate(editing ? "Save changes" : "Create preset");
    resetButton.textContent = translate(editing ? "Cancel editing" : "Reset");
    form.elements.id.readOnly = editing;

    if (!editing) {
      window.ParalangI18n?.translateElement(form);
      restoreDefaultGroup();
      return;
    }

    form.elements.label.value = preset.label || "";
    form.elements.id.value = preset.id || "";
    form.elements.group.value = preset.group || "";
    form.elements.root.value = preset.root || "";
    form.elements.collection_mode.value = preset.collection_mode || "named-folders";
    form.elements.content_selector.value = preset.content_selector || ".content-area";
    form.elements.include_root_html.checked = Boolean(preset.include_root_html);

    const folders = Array.isArray(preset.additional_folders)
      ? preset.additional_folders
      : [];
    detectAdditionalFolders.checked = folders.length > 0;
    additionalFoldersList.replaceChildren();
    (folders.length ? folders : ["report-rapport"]).forEach(value => {
      appendAdditionalFolder(value, false);
    });
    updateAdditionalFoldersVisibility();
    showMessage("");
    form.scrollIntoView({behavior: "smooth", block: "start"});
    form.elements.label.focus({preventScroll: true});
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
      setFormMode();
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
      }, editingPresetId);
      window.location.reload();
    } catch (error) {
      showMessage(error.message);
    }
  });

  dialog.addEventListener("click", async event => {
    const deleteButton = event.target.closest("[data-delete-preset]");
    const exportButton = event.target.closest("[data-export-preset]");
    const editButton = event.target.closest("[data-edit-preset]");
    if (editButton) {
      const row = editButton.closest("[data-preset]");
      const preset = JSON.parse(row.dataset.preset);
      form.reset();
      window.setTimeout(() => setFormMode(preset), 0);
      return;
    }
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
