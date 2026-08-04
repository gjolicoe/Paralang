# Developing Paralang

This guide is for people changing Paralang itself. For installation and everyday review instructions, see the [user README](README.md).

## Development setup

Requirements:

- Python 3 with Tkinter and `pip`
- A modern web browser

Install the pinned Python dependencies from the repository root:

```console
python -m pip install -r requirements.txt
```

Start the application directly during development:

```console
python app.py
```

Open <http://127.0.0.1:5000>. Flask's automatic reloader is disabled, so restart the process after Python changes. Alternatively, run `launch-paralang.pyw` and use **Refresh Application** to restart the server and reload open Paralang pages.

## Repository structure

```text
app.py                    Flask routes, request safeguards, and page preparation
launch-paralang.pyw       Desktop launcher and local server controller
services/                 Source discovery, parsing, checks, code formatting, and storage
templates/                Main application and embedded page templates
static/js/                Browser UI, synchronization, review, and layout behaviour
static/css/               Application, code-view, and reviewed-page styles
static/fonts/             Bundled interface fonts and their licences
data/                     Local review state, presets, and retained local content
.cache/                   Generated page, pasted-HTML, and launcher caches
docs/assets/              Images used by the user README
```

The Flask application is the boundary for filesystem and remote-page access. Browser code coordinates the rendered page frames, comparison index, highlighting, layout, and review interactions. Keep deterministic parsing and comparison rules in `services/` rather than duplicating them in routes or UI handlers unless an equivalent client-side check is required for the live rendered DOM.

## Local and shared state

The following paths contain runtime state and are intentionally ignored by Git:

- `data/paralang-issues.json`
- `data/environment-presets.json`
- `data/local-files/`
- `.cache/`

Do not commit reviewed content, issue data, environment-specific paths, downloaded pages, or generated caches. When testing shared review behaviour, launch the same project copy from the same path because this state is relative to the project folder.

## Making a change

1. Inspect the complete route, service, template, and browser interaction affected by the change.
2. Preserve English and French interface behaviour, keyboard access, focus handling, and synchronized page/code navigation.
3. Keep filesystem access within configured source roots and preserve the localhost, origin, sandbox, content-security-policy, redirect, and download-size safeguards.
4. Update the user README when user-visible behaviour, setup, storage, privacy, or security changes.
5. Validate the change and manually exercise the affected workflow before committing it.

## Validation

Compile the Python sources to catch syntax errors:

```console
python -m compileall -q app.py launch-paralang.pyw services
```

There is currently no committed automated test suite. Perform a focused browser smoke test appropriate to the change. For a broad change, verify at least:

- The launcher or manual server starts successfully on `127.0.0.1:5000`.
- A local English/French pair loads in page and code views.
- Structure-map navigation, synchronized scrolling, focus mode, and manual sync offsets still work.
- Automated and user-created issues target the expected side and content block.
- Workspace and language preferences survive a reload.
- Pasted HTML and any affected folder or URL environment behave as expected.
- Reviewed content remains sandboxed and cannot execute scripts, submit forms, or use browser network APIs.

If a workflow was not exercised, state that clearly when handing off the change.

## Versions and releases

The user-facing version appears in two attributes near the application title in `templates/index.html`. Update both values together when preparing a release:

- The `aria-label` containing `Paralang version ...`
- The visible `<small>v...</small>` label

`AUTOMATED_CHECK_VERSION` in `services/automated_issues.py` is separate from the application version. Increment it only when automated-check behaviour or stored automated-issue results change in a way that requires existing page pairs to be scanned again.

Before releasing:

1. Update the displayed version and user documentation.
2. Run Python syntax validation and the relevant browser smoke tests.
3. Launch the app through `launch-paralang.pyw` and verify its start, refresh, open-browser, and stop controls.
4. Confirm that no local review data, content, presets, logs, or caches are staged.

## Dependencies

Runtime packages are pinned in `requirements.txt`. When changing a dependency, update that file deliberately and verify both a direct `python app.py` start and the launcher's dependency check. Do not add a browser dependency that requires an external runtime request; Paralang bundles its interface assets so it can operate in protected environments.
