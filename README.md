<p align="center">
  <img
    src="docs/assets/paralang-banner.png"
    alt="Paralang"
    width="900"
  >
</p>

# Paralang, the local bilingual HTML review tool

Paralang is a local bilingual review tool for comparing English and French HTML pages. It keeps the rendered pages, document structure, source code, and review issues together in one workspace so mismatches are easier to find and verify.

## Features

### Bilingual page comparison

View English and French pages side by side, scroll them together, and use focus mode or element outlines to keep the current content blocks visible. Auto-sync aligns comparable content, while the `Sync -1`, `Sync +1`, and reset controls let you correct the alignment manually.

### Structure maps

Navigate either document from a compact map of its headings. Paralang flags section-count differences and keeps map navigation coordinated with the page views.

### Source code view

Open formatted HTML beneath the rendered pages and follow the selected content in code. The code panels can be resized, expanded, collapsed, or hidden from the Workspace menu.

### Automated checks

Paralang compares the structure and content blocks of a page pair and reports possible problems such as missing sections, heading-level differences, extra blocks, identical text, and large text-length differences. It also compares numeric table cells using English and French number and currency formats, helping identify values that differ across otherwise corresponding rows. Checks refresh when source files change and can also be re-run from the issues panel.

### Review issues

Create an issue for the selected block using the review form, choose the English or French side, and add a title, comment, and reviewer name. Paralang remembers the reviewer name for the next issue, and selecting an existing issue returns you to the affected page content. User-created and automated issues are stored in `data/paralang-issues.json` and can be removed when fixed.

### Flexible content sources

Review pages from local files, team-configured folder or URL presets, pasted HTML, or public Canada.ca URLs. URL pages are downloaded to a local cache before review.

Use **Workspace > Manage environments** to create and manage custom presets. Folder presets can point directly at HTML pages or discover named collection folders and relative subfolders such as `campaign/pages`. URL presets accept pages from one configured public HTTPS website. Both types can use a custom CSS selector to locate the primary page content.

Custom presets can be edited, exported as JSON for another user to import, or deleted. They may also be grouped under custom headings in the Environment menu. Local preset definitions are stored in `data/environment-presets.json`.

For local files, place page pairs under a named folder in `data/local-files/`, for example:

```text
data/local-files/my-review/
|-- page-en.html
|-- page-fr.html
```

English filenames must end in `-en.html` and French filenames in `-fr.html`. A `report-rapport/` subfolder is also supported.

### Pasted HTML review

Paste complete English and French HTML documents directly into Paralang. Paralang creates readable paired filenames, preferring the English H1 when one is available. Choose temporary storage in `.cache/pasted_html/` or longer-term storage in `data/local-files/pasted-html/`. Temporary entries older than 14 days are removed when new content is submitted; Local files are retained until removed manually. If similar content already exists, Paralang lets you overwrite it, create a numbered copy, or cancel.

### Customizable workspace

Toggle structure maps, the issues panel, single-page mode, code view, and dark mode. Panel sizes and display preferences are saved in the browser, and the default arrangement can be restored from the Workspace menu.

### English and French interface

Switch the Paralang interface between English and French from the language button in the header. The selected interface language is remembered in the browser and is applied to dialogs, controls, status messages, and code views.

### In-app feedback

Use **Send feedback** to report an issue or suggest an improvement. Paralang can prepare either a GitHub issue or an Outlook email containing your comments and automatically includes the app version, computer platform, date, and a report ID. GitHub Issues is recommended for tracking; Outlook remains available for users without a GitHub account. Review the prepared report and remove protected information before sending it.

## Shared team use

Paralang works best when the project folder is stored on a shared drive and every reviewer launches the same copy from the same path. Issues, environment presets, pasted HTML, and downloaded page caches are stored inside that project folder. If team members run separate copies from different locations, each copy will have its own issues and cached content, so changes will not be shared between reviewers.

Browser-specific settings, such as the selected interface language, dark mode, panel sizes, and workspace layout, remain personal to each reviewer.

## Running locally

### Portable launcher

Requirements:

- Python 3 with Tkinter and `pip`
- A web browser

From the project folder, run:

```console
python launch-paralang.pyw
```

On Windows, you can also double-click `launch-paralang.pyw` when `.pyw` files are associated with Python.

The launcher checks for Flask and Beautiful Soup and installs the pinned packages in `requirements.txt` with `pip` if needed. It then starts Paralang at <http://127.0.0.1:5000>, opens the site in your browser, and leaves a small control window running. Use **Refresh Application** to restart the local server and automatically reload open Paralang pages after code changes. Use **Open Browser** to reopen the site and **Stop Paralang** (or close the control window) to stop the server cleanly.

## Protected-content safeguards

Paralang runs only on `127.0.0.1`. Reviewed HTML is displayed in a sandbox with scripts, forms, embedded frames, plug-ins, and browser network APIs disabled. HTTPS stylesheets, fonts, and images remain available, but page requests use a `no-referrer` policy so the remote server is not sent the Paralang URL or local filename.

URL imports may follow redirects only while every redirect remains on the environment's configured HTTPS website. Canada.ca imports are further restricted to `https://www.canada.ca/en/` and `https://www.canada.ca/fr/`. Pasted HTML requests and downloaded URL pages are limited to 100 MB each. Content stored in `data/` and `.cache/` remains local and uses the workstation or shared drive's existing access controls.

If startup fails, diagnostic output is available in `.cache/launcher/`.

### Manual server

To run without the desktop launcher, install the dependencies and start Flask directly:

```console
python -m pip install -r requirements.txt
python app.py
```

Then open <http://127.0.0.1:5000>. Stop the server with `Ctrl+C`.
