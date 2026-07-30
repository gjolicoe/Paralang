# GitHub Copilot instructions for Paralang

Paralang is a local Flask application for comparing English and French HTML pages during bilingual review. Read `README.md` and the directly relevant modules before proposing broad changes.

- Preserve existing review behavior during refactors. Do not silently change English/French pairing, synchronized navigation, automated checks, issue locations, focus behavior, or rendered document structure.
- Keep HTTP routes and request validation in `app.py`. Put focused source, parsing, storage, cache, and automated-check logic in `services/` rather than expanding route handlers unnecessarily.
- The browser application is composed from `templates/index.html` and the ordered scripts in `static/js/`. Reuse the existing modules and shared state boundaries; do not introduce a framework or a second application state owner without an explicit request.
- Treat `static/css/theme.min.css` and files under `static/fonts/` as vendored assets. Do not edit, reformat, or regenerate them during ordinary application work.
- Keep the interface bilingual. English UI strings are the source text and French translations live in `static/js/i18n.js`. Update both languages when adding or changing user-facing copy, including dynamic JavaScript messages and placeholders.
- Preserve accessibility: semantic labels and fieldsets, keyboard operation, dialog focus, visible focus states, required-field state, live status messages, and meaningful accessible names.
- Preserve the protected-content safeguards. Paralang must remain bound to localhost, keep reviewed documents sandboxed, restrict URL imports and redirects to approved origins, avoid leaking referrers or local paths, and never transmit reviewed HTML implicitly.
- Use `safe_resolve`, `path_is_within`, configured size limits, and the existing source/cache helpers for filesystem or URL work. Do not weaken path traversal, origin, redirect, or content-size checks.
- Project records such as review issues and saved environment presets belong in the existing `data/` stores. Temporary downloads and pasted content belong in the existing `.cache/` paths. Do not move project content into browser storage.
- Browser storage is for deliberate per-user conveniences only, such as interface/layout preferences, the reviewer name, and the last successfully saved environment group. Form drafts must clear when their dialogs close unless the requested behavior explicitly says otherwise.
- Do not commit generated caches, local reviewed content, launcher diagnostics, or project-specific review state. Follow `.gitignore`.
- There is no runtime AI integration. Do not add AI providers, credentials, remote document processing, analytics, or content telemetry unless explicitly requested as a separately reviewed feature. Copilot is used only for development assistance.
- Keep changes focused and preserve unrelated working-tree edits. When changing cached CSS or JavaScript, update the corresponding version query in `templates/index.html` so users receive the new asset.
- Add or update focused tests for behavior changes. Pure Python and rendered-Flask behavior belongs in `tests/`; browser-only interactions still require an honest manual verification note.
- Run `python -m unittest discover -s tests -p "test_*.py"` and `git diff --check` before handoff. Also run relevant syntax or focused checks when risk warrants them, and do not claim browser workflows were exercised unless they actually were.
- Update `README.md` when setup, storage behavior, user workflows, security constraints, or operating commands change.
