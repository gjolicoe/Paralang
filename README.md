<p align="center">
  <img
    src="docs/assets/paralang-banner.png"
    alt="Paralang"
    width="900"
  >
</p>

<h1>Paralang, the local bilingual HTML review tool</h1>

<p>Paralang is a local bilingual review tool for comparing English and French HTML pages. It keeps the rendered pages, document structure, source code, and review issues together in one workspace so mismatches are easier to find and verify.</p>

<p>Paralang is designed for web publishers and reviewers who compare bilingual HTML before publication, particularly English and French content prepared for Canada.ca.</p>

<p><strong>Using Paralang?</strong> Start with <a href="#getting-started">Getting started</a> below. <strong>Developing Paralang?</strong> See the <a href="CONTRIBUTING.md">developer and contribution guide</a>.</p>

> [!IMPORTANT]
> **Python 3 with Tkinter must be installed on the workstation before Paralang can run.** This requirement also applies to the <code>portable-windows</code> version: that branch includes Paralang's third-party Python packages, but it does not include the Python interpreter itself.

<h2>Getting started</h2>

<ol>
  <li>Launch <code>launch-paralang.pyw</code> from the project folder. The launcher starts the local server and opens Paralang in your browser.</li>
  <li>Choose an environment, then select or enter the English and French pages you want to compare.</li>
  <li>Select <strong>Load</strong> and use the synchronized page views, structure maps, code panels, and issues panel to complete the review.</li>
</ol>

> [!IMPORTANT]
> **For the best team experience, keep the Paralang application folder on a [shared drive](#shared-drive-feature-behaviour) and have everyone launch that same copy.** This allows reviewers to work with the same issues, presets, pasted HTML, and downloaded page caches. Running separate copies creates separate review data.

<blockquote>
  <p><strong>Privacy:</strong> Paralang runs locally and does not upload reviewed documents to an application server. URL environments download the pages you explicitly request, and feedback is sent only after you review and submit the prepared GitHub issue or email. See <a href="#protected-content-safeguards">Protected-content safeguards</a> for details.</p>
</blockquote>

<h2>Features</h2>

<p align="center">
  <img
    src="docs/assets/paralang-toolbar.png"
    alt="Paralang toolbar"
    width="900"
  >
</p>

<h3>Bilingual page comparison</h3>

<p>View English and French pages side by side, scroll them together, and use focus mode or element outlines to keep the current content blocks visible. Auto-sync aligns comparable content, while the <code>Sync -1</code>, <code>Sync +1</code>, and reset controls let you correct the alignment manually.</p>

<h3>Structure maps</h3>

<p>Navigate either document from a compact map of its headings. Click a heading in either map to move the current comparison index directly to that section. Paralang also flags section-count differences and keeps map navigation coordinated with the page views.</p>

<p align="center">
  <img
    src="docs/assets/paralang-structureview.png"
    alt="Paralang structure maps"
    width="900"
  >
</p>

<h3>Source code view</h3>

<p>Open formatted HTML beneath the rendered pages and follow the selected content in code. The code panels can be resized, expanded, collapsed, or hidden from the Workspace menu.</p>

<p align="center">
  <img
    src="docs/assets/paralang-codeview.png"
    alt="Paralang code view"
    width="900"
  >
</p>

<h3>Automated checks</h3>

<p>Paralang compares the structure and content blocks of a page pair and reports possible problems such as missing sections, heading-level differences, extra blocks, identical text, and large text-length differences. It also compares numeric table cells using English and French number and currency formats, helping identify values that differ across otherwise corresponding rows. Checks refresh when source files change and can also be re-run from the issues panel.</p>

<h3>Review issues</h3>

<p>Create an issue for the selected block using the review form, choose the English or French side, and add a title, comment, and reviewer name. Paralang remembers the reviewer name for the next issue, and selecting an existing issue returns you to the affected page content. User-created and automated issues are stored in <code>data/paralang-issues.json</code> and can be removed when fixed.</p>

<p align="center">
  <img
    src="docs/assets/paralang-issuespanel.png"
    alt="Paralang issues panel"
    width="900"
  >
</p>

<h3>Flexible content sources</h3>

<p>Review pages from local files, team-configured folder or URL presets, pasted HTML, or public Canada.ca URLs. URL pages are downloaded to a local cache before review. Paralang reuses the cached copy when the same URL is loaded again, including after a browser refresh, so the remote website is not downloaded repeatedly.</p>

<p>For URL environments, the view controls show the date and time of the cached English and French copies. Select <strong>Reload URLs</strong> when you want to download the latest versions explicitly. Paralang displays the page-view loading overlay, updates the cache timestamps, and reloads only the page and code views; the surrounding workspace does not refresh.</p>

<p>Use <strong>Workspace &gt; Manage environments</strong> to create and manage custom presets. Folder presets can point directly at HTML pages or discover named collection folders and relative subfolders such as <code>campaign/pages</code>. URL presets accept pages from one configured public HTTPS website. Both types can use a custom CSS selector to locate the primary page content.</p>

<p>Custom presets can be edited, exported as JSON for another user to import, or deleted. They may also be grouped under custom headings in the Environment menu. Local preset definitions are stored in <code>data/environment-presets.json</code>. Downloaded URL content and its cache metadata are stored under <code>.cache/</code>.</p>

<p align="center">
  <img
    src="docs/assets/paralang-environmentpresets.png"
    alt="Paralang custom environments popup"
    width="600"
  >
</p>

<p>For local files, place page pairs under a named folder in <code>data/local-files/</code>, for example:</p>

<pre><code>data/local-files/my-review/
|-- page-en.html
|-- page-fr.html</code></pre>

<p>English filenames must end in <code>-en.html</code> and French filenames in <code>-fr.html</code>. A <code>report-rapport/</code> subfolder is also supported.</p>

<h3>Pasted HTML review</h3>

<p>Paste complete English and French HTML documents directly into Paralang. Paralang creates readable paired filenames, preferring the English H1 when one is available. Choose temporary storage in <code>.cache/pasted_html/</code> or longer-term storage in <code>data/local-files/pasted-html/</code>. Temporary entries older than 14 days are removed when new content is submitted; Local files are retained until removed manually. If similar content already exists, Paralang lets you overwrite it, create a numbered copy, or cancel.</p>

<p align="center">
  <img
    src="docs/assets/paralang-pastedhtml.png"
    alt="Paralang pasted html popup"
    width="600"
  >
</p>

<h3>Customizable workspace</h3>

<p>Toggle structure maps, the issues panel, single-page mode, code view, and dark mode. Panel sizes and display preferences are saved in the browser, and the default arrangement can be restored from the Workspace menu.</p>

<h3>English and French interface</h3>

<p>Switch the Paralang interface between English and French from the language button in the header. The selected interface language is remembered in the browser and is applied to dialogs, controls, status messages, and code views.</p>

<h3>In-app feedback</h3>

<p>Use <strong>Send feedback</strong> to report an issue or suggest an improvement. Paralang can prepare either a GitHub issue or an Outlook email containing your comments and automatically includes the app version, computer platform, date, and a report ID. GitHub Issues is recommended for tracking; Outlook remains available for users without a GitHub account. Review the prepared report and remove protected information before sending it.</p>

<h2>Shared team use</h2>

<p>Paralang works best when the project folder is stored on a <a href="#shared-drive-feature-behaviour">shared drive</a> and every reviewer launches the same copy from the same path. Issues, environment presets, pasted HTML, and downloaded page caches are stored inside that project folder. If team members run separate copies from different locations, each copy will have its own issues and cached content, so changes will not be shared between reviewers.</p>

<h3 id="shared-drive-feature-behaviour">What the shared drive changes</h3>

<p>Paralang is still fully usable from a local folder. A <a href="#shared-drive-feature-behaviour">shared drive</a> does not turn Paralang into a shared web server or allow reviewers to use one running launcher together; each reviewer launches their own local Paralang server. The benefit comes from every launcher reading and writing the same project files.</p>

<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>When using one <a href="#shared-drive-feature-behaviour">shared project folder</a></th>
      <th>When using separate local copies</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Review issues</td>
      <td>Reviewers see the same saved and automated issues.</td>
      <td>Issues remain in the copy where they were created.</td>
    </tr>
    <tr>
      <td>Environment presets</td>
      <td>Preset additions and edits are available to the team.</td>
      <td>Each copy has its own preset definitions unless they are exported and imported manually.</td>
    </tr>
    <tr>
      <td>Pasted HTML</td>
      <td>Saved pasted pages are available to other reviewers.</td>
      <td>Pasted pages exist only in the copy that received them.</td>
    </tr>
    <tr>
      <td>URL page cache</td>
      <td>Reviewers reuse the same downloaded pages and cache timestamps; a manual URL reload updates the shared copy.</td>
      <td>Each copy downloads, timestamps, and refreshes its own cached pages.</td>
    </tr>
    <tr>
      <td>Local-file environments</td>
      <td>Everyone reviews the same HTML files stored with the <a href="#shared-drive-feature-behaviour">shared project</a>.</td>
      <td>Files can differ between copies unless they are synchronized separately.</td>
    </tr>
  </tbody>
</table>

<p>Browser-specific settings, such as the selected interface language, dark mode, panel sizes, and workspace layout, remain personal to each reviewer.</p>

<h2>Running locally</h2>

<blockquote>
  <p><strong>For team use:</strong> place the entire Paralang project folder on a <a href="#shared-drive-feature-behaviour">shared drive</a>, then have each reviewer launch <code>launch-paralang.pyw</code> from that same folder. Each launcher still runs locally on <code>127.0.0.1</code>, while <a href="#shared-drive-feature-behaviour">shared project data</a> remains available to the team. See <a href="#shared-drive-feature-behaviour">What the shared drive changes</a> for feature-by-feature details.</p>
</blockquote>

<h3>Standard launcher</h3>

<p>Requirements:</p>

<ul>
  <li>Python 3 with Tkinter and <code>pip</code></li>
  <li>A web browser</li>
</ul>

<p>The standard version does not bundle its third-party Python packages. The launcher uses <code>pip</code> to install the pinned packages from <code>requirements.txt</code> when they are not already available.</p>

<h3>Portable launcher</h3>

<p>Requirements:</p>

<ul>
  <li>Python 3 with Tkinter; <code>pip</code> is not required</li>
  <li>A web browser</li>
</ul>

<p>The <code>portable-windows</code> version includes Paralang's third-party Python packages. It remains portable between compatible Windows workstations, but it does not include Python itself.</p>

<h3>Starting Paralang</h3>

<p>From the project folder, run:</p>

<pre><code>python launch-paralang.pyw</code></pre>

<p>On Windows, you can also double-click <code>launch-paralang.pyw</code> when <code>.pyw</code> files are associated with Python.</p>

<p>The launcher starts Paralang at <a href="http://127.0.0.1:5000">http://127.0.0.1:5000</a>, opens the site in your browser, and leaves a small control window running. With the standard version, it also checks for Flask and Beautiful Soup and installs the pinned packages with <code>pip</code> if needed. Use <strong>Refresh Application</strong> to restart the local server and automatically reload open Paralang pages after code changes. Use <strong>Open Browser</strong> to reopen the site and <strong>Stop Paralang</strong> (or close the control window) to stop the server cleanly.</p>

<p align="center">
  <img
    src="docs/assets/paralang-launcher.png"
    alt="Paralang launcher"
    width="500"
  >
</p>

<h2>Protected-content safeguards</h2>

<p>Paralang runs only on <code>127.0.0.1</code>. Reviewed HTML is displayed in a sandbox with scripts, forms, embedded frames, plug-ins, and browser network APIs disabled. HTTPS stylesheets, fonts, and images remain available, but page requests use a <code>no-referrer</code> policy so the remote server is not sent the Paralang URL or local filename.</p>

<p>URL imports may follow redirects only while every redirect remains on the environment's configured HTTPS website. Canada.ca imports are further restricted to <code>https://www.canada.ca/en/</code> and <code>https://www.canada.ca/fr/</code>. Pasted HTML requests and downloaded URL pages are limited to 100 MB each. Content stored in <code>data/</code> and <code>.cache/</code> remains local and uses the workstation or <a href="#shared-drive-feature-behaviour">shared drive</a>'s existing access controls.</p>

<h2>Portable Windows edition</h2>

<p>The <code>portable-windows</code> branch includes its Python packages as wheel archives in <code>vendor-wheels/</code>. Users launch <code>launch-paralang.pyw</code> normally; Python imports directly from those local archives and Paralang never runs <code>pip</code>. The archives are data, are not executables, and are never extracted on the user's computer. The workstation must already provide an approved Python installation with Tkinter and a <code>.pyw</code> file association.</p>

<p>Maintainers can refresh the bundled dependencies from <code>requirements.txt</code> by running <code>refresh-vendor.ps1</code> on an approved build computer, then committing the resulting <code>vendor-wheels/</code> changes.</p>

<p>If startup fails, diagnostic output is available in <code>.cache/launcher/</code>.</p>

<h3>Manual server</h3>

<p>To run without the desktop launcher, install the dependencies and start Flask directly:</p>

<pre><code>python -m pip install -r requirements.txt
python app.py</code></pre>

<p>Then open <a href="http://127.0.0.1:5000">http://127.0.0.1:5000</a>. Stop the server with <code>Ctrl+C</code>.</p>

<h2>Updating the portable branch</h2>

<p>Make regular application changes on <code>main</code>. After committing and pushing them, merge <code>main</code> into <code>portable-windows</code> so the portable-only dependency files remain in that branch:</p>

<pre><code>git switch main
git add -A
git commit -m "Describe your changes"
git push origin main

git switch portable-windows
git merge main
git push origin portable-windows

git switch main</code></pre>

<p>If the branches are kept in separate worktree folders, run the merge from the portable folder instead:</p>

<pre><code>cd ..\paralang-portable
git merge main
git push origin portable-windows</code></pre>

<p>If Git reports a merge conflict, resolve the files reported by <code>git status</code>, then run <code>git add -A</code>, <code>git commit</code>, and <code>git push origin portable-windows</code>. Do not merge <code>portable-windows</code> back into <code>main</code> unless its portable-only files are intentionally wanted on the main branch.</p>
