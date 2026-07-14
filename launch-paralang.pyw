"""Portable GUI launcher and process controller for Paralang."""

from pathlib import Path
import os
import socket
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox
import webbrowser


PROJECT_DIR = Path(__file__).resolve().parent
APP_PATH = PROJECT_DIR / "app.py"
SERVER_URL = "http://127.0.0.1:5000"
LOG_DIR = PROJECT_DIR / ".cache" / "launcher"
STDOUT_LOG = LOG_DIR / "paralang.stdout.log"
STDERR_LOG = LOG_DIR / "paralang.stderr.log"


class ParalangLauncher:
    def __init__(self, root):
        self.root = root
        self.process = None
        self.opened_browser = False
        self.poll_attempts = 0

        root.title("Paralang")
        root.resizable(False, False)
        root.protocol("WM_DELETE_WINDOW", self.stop)

        frame = tk.Frame(root, padx=24, pady=20)
        frame.pack()

        tk.Label(frame, text="Paralang", font=("Segoe UI", 16, "bold")).pack()
        self.status = tk.StringVar(value="Starting the local server...")
        tk.Label(frame, textvariable=self.status, font=("Segoe UI", 10)).pack(pady=(10, 4))
        tk.Label(frame, text=SERVER_URL, font=("Segoe UI", 10)).pack(pady=(0, 14))

        buttons = tk.Frame(frame)
        buttons.pack()
        self.open_button = tk.Button(
            buttons,
            text="Open Browser",
            width=14,
            state=tk.DISABLED,
            command=self.open_browser,
        )
        self.open_button.pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(buttons, text="Stop Paralang", width=14, command=self.stop).pack(side=tk.LEFT)

        root.after(100, self.start)

    def server_is_ready(self):
        try:
            with socket.create_connection(("127.0.0.1", 5000), timeout=1):
                return True
        except OSError:
            return False

    def start(self):
        if not APP_PATH.is_file():
            self.fail(f"app.py was not found in:\n{PROJECT_DIR}")
            return

        dependency_check = subprocess.run(
            [sys.executable, "-c", "import flask, bs4"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        if dependency_check.returncode != 0:
            self.fail(
                "Required Python packages are missing.\n\n"
                f"Python: {sys.executable}\n\n"
                "Install them with:\npython -m pip install flask beautifulsoup4"
            )
            return

        if self.server_is_ready():
            self.status.set("Paralang is already running")
            self.open_button.config(state=tk.NORMAL)
            self.open_browser()
            return

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        stdout_file = STDOUT_LOG.open("w", encoding="utf-8")
        stderr_file = STDERR_LOG.open("w", encoding="utf-8")
        try:
            self.process = subprocess.Popen(
                [sys.executable, str(APP_PATH)],
                cwd=PROJECT_DIR,
                stdout=stdout_file,
                stderr=stderr_file,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        finally:
            stdout_file.close()
            stderr_file.close()

        self.root.after(500, self.poll_server)

    def poll_server(self):
        if self.server_is_ready():
            self.status.set("Paralang is running")
            self.open_button.config(state=tk.NORMAL)
            self.open_browser()
            return

        self.poll_attempts += 1
        if self.process and self.process.poll() is not None:
            self.fail_from_log("The local server stopped during startup.")
            return
        if self.poll_attempts >= 40:
            self.fail_from_log("The local server did not respond within 20 seconds.")
            return

        self.root.after(500, self.poll_server)

    def open_browser(self):
        try:
            opened = webbrowser.open(SERVER_URL, new=1)
            if not opened and hasattr(os, "startfile"):
                os.startfile(SERVER_URL)
            self.opened_browser = True
        except Exception as error:
            messagebox.showwarning(
                "Open Paralang",
                f"The browser could not be opened automatically.\n\n"
                f"Open this address manually:\n{SERVER_URL}\n\n{error}",
            )

    def fail_from_log(self, heading):
        try:
            details = STDERR_LOG.read_text(encoding="utf-8").strip()
        except OSError:
            details = ""
        self.fail(
            f"{heading}\n\n{details or 'No Python error was reported.'}\n\n"
            f"Diagnostic log:\n{STDERR_LOG}"
        )

    def fail(self, message):
        self.status.set("Paralang could not start")
        messagebox.showerror("Paralang could not start", message)

    def stop(self):
        if self.process and self.process.poll() is None:
            self.status.set("Stopping Paralang...")
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2)
        self.root.destroy()


def main():
    root = tk.Tk()
    ParalangLauncher(root)
    root.mainloop()


if __name__ == "__main__":
    main()
