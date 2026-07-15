# Paralang

Paralang is a local bilingual HTML comparison tool for reviewing English and French versions of web pages side by side.

## Features

- Side-by-side EN/FR page view
- Code view
- Manual sync offset controls
- Page/code comparison workflow
- Local Flask app
- Pasted EN/FR HTML review with readable filenames and local cache retention

Pasted pages are stored in `.cache/pasted_html/`. When new content is submitted,
managed cache entries older than 14 days are removed. Similar or identical pages
prompt for overwrite, a numbered new copy, or cancellation before saving.

## Running locally

Run the portable Python launcher:

```console
python launch-paralang.pyw
```

You can also double-click `launch-paralang.pyw` when the default app for `.pyw` files is python.

The launcher starts the local server, opens Paralang in the browser, and keeps a
small control window available. Use **Open Browser** if needed, and use
**Stop Paralang** or close the control window to stop the server cleanly.
