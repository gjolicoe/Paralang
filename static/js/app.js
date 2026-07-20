loadLayout();
updateDarkModeButton(document.body.classList.contains("dark-mode"));
setupDiffResizer();
setupCodeResizer();
loadCodePanelHeight();

function watchForApplicationRestart() {
  const initialInstanceId = window.PARALANG_APP_INSTANCE_ID;

  if (!initialInstanceId) return;

  window.setInterval(async () => {
    try {
      const response = await fetch("/api/app-instance", { cache: "no-store" });

      if (!response.ok) return;

      const result = await response.json();

      if (result.instance_id && result.instance_id !== initialInstanceId) {
        window.location.reload();
      }
    } catch (error) {
      // The server is briefly unavailable while the launcher restarts it.
    }
  }, 1000);
}

watchForApplicationRestart();

setupLayoutMenu();
setupLayoutMenuActions();
syncLayoutMenuState();

setupReviewIssueControls();
loadSingleViewState();
loadCodeViewState();
updatePageInputLabels();
