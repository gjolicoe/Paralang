# Paralang

Paralang is a local bilingual HTML comparison tool for reviewing English and French versions of web pages side by side.

## Features

- Side-by-side EN/FR page view
- Code view
- Manual sync offset controls
- Page/code comparison workflow
- Local Flask app

## Running locally

Double-click `launch-paralang.cmd`, or run it from a terminal:

```powershell
.\launch-paralang.cmd
```

The launchers use their own folder as the project location, so the repository can
be moved or copied to another computer without updating a shortcut target.

The `.cmd` launcher does not require PowerShell, which allows it to work on
managed computers where PowerShell is blocked by group policy.

The browser is not opened automatically because managed-computer policies can
block URL launcher commands. Open `http://127.0.0.1:5000` after startup.
