# Paralang

Paralang is a local bilingual review tool for comparing English and French HTML pages. It keeps the rendered pages, document structure, source code, and review issues together in one workspace so mismatches are easier to find and verify.

## Features

### Bilingual page comparison

View English and French pages side by side, scroll them together, and use focus mode or element outlines to keep the current content blocks visible. Auto-sync aligns comparable content, while the `Sync -1`, `Sync +1`, and reset controls let you correct the alignment manually.

### Structure maps

Navigate either document from a compact map of its headings. Paralang flags section-count differences and keeps map navigation coordinated with the page views.

### Source code view

Open formatted HTML beneath the rendered pages and follow the selected content in code. The code panels can be resized, expanded, collapsed, or hidden from the Layout menu.

### Automated checks

Paralang compares the structure and content blocks of a page pair and reports possible problems such as missing sections, heading-level differences, extra blocks, identical text, and large text-length differences. Checks refresh when source files change and can also be re-run from the issues panel.

### Review issues

Create an issue for a selected block, add a title and comment, identify the reviewer, and jump from an issue back to its page content. User-created and automated issues are stored locally in `data/paralang-issues.json` and can be removed when fixed.

### Flexible content sources

Review pages from the configured Budget and Fiscal Update folders, local files, AEM sensitive URLs, or public Canada.ca URLs. Canada.ca pages are downloaded to a local cache before review.

For local files, place page pairs under a named folder in `data/local-files/`, for example:

```text
data/local-files/my-review/
|-- page-en.html
`-- page-fr.html
```

English filenames must end in `-en.html` and French filenames in `-fr.html`. A `report-rapport/` subfolder is also supported.

### Pasted HTML review

Paste complete English and French HTML documents directly into Paralang. Saved pages receive readable filenames and are retained in `.cache/pasted_html/`; managed entries older than 14 days are removed when new content is submitted. If similar content already exists, Paralang lets you overwrite it, create a numbered copy, or cancel.

### Customizable workspace

Toggle structure maps, the issues panel, single-page mode, code view, and dark mode. Panel sizes and display preferences are saved in the browser, and the default arrangement can be restored from the Layout menu.

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

The launcher checks for Flask and Beautiful Soup and installs them with `pip` if needed. It then starts Paralang at <http://127.0.0.1:5000>, opens the site in your browser, and leaves a small control window running. Use **Open Browser** to reopen the site and **Stop Paralang** (or close the control window) to stop the server cleanly.

If startup fails, diagnostic output is available in `.cache/launcher/`.

### Manual server

To run without the desktop launcher, install the dependencies and start Flask directly:

```console
python -m pip install flask beautifulsoup4
python app.py
```

Then open <http://127.0.0.1:5000>. Stop the server with `Ctrl+C`.
