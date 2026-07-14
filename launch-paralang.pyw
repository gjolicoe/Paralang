"""Portable, windowless launcher for managed Windows computers."""

from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import webbrowser


PROJECT_DIR = Path(__file__).resolve().parent
APP_PATH = PROJECT_DIR / "app.py"
SERVER_URL = "http://127.0.0.1:5000"
LOG_DIR = PROJECT_DIR / ".cache" / "launcher"
STDOUT_LOG = LOG_DIR / "paralang.stdout.log"
STDERR_LOG = LOG_DIR / "paralang.stderr.log"


def show_error(message):
    try:
        from tkinter import messagebox

        messagebox.showerror("Paralang could not start", message)
    except Exception:
        pass


def server_is_ready():
    try:
        with urllib.request.urlopen(SERVER_URL, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def main():
    if not APP_PATH.is_file():
        show_error(f"app.py was not found in:\n{PROJECT_DIR}")
        return 1

    dependency_check = subprocess.run(
        [sys.executable, "-c", "import flask, bs4"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )

    if dependency_check.returncode != 0:
        show_error(
            "Required Python packages are missing.\n\n"
            f"Python: {sys.executable}\n\n"
            "Install Flask and Beautiful Soup with:\n"
            "python -m pip install flask beautifulsoup4"
        )
        return 1

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    with STDOUT_LOG.open("w", encoding="utf-8") as stdout_file, \
            STDERR_LOG.open("w", encoding="utf-8") as stderr_file:
        process = subprocess.Popen(
            [sys.executable, str(APP_PATH)],
            cwd=PROJECT_DIR,
            stdout=stdout_file,
            stderr=stderr_file,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )

    for _ in range(20):
        if server_is_ready():
            webbrowser.open(SERVER_URL)
            return 0

        if process.poll() is not None:
            break

        time.sleep(1)

    details = ""
    try:
        details = STDERR_LOG.read_text(encoding="utf-8").strip()
    except OSError:
        pass

    show_error(
        "The local server did not start.\n\n"
        f"{details or 'No Python error was reported.'}\n\n"
        f"Diagnostic log:\n{STDERR_LOG}"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
