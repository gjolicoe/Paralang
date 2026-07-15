"""Portable GUI launcher and process controller for Paralang."""

from pathlib import Path
import os
import socket
import subprocess
import sys
import tkinter as tk
import tkinter.font as tkfont
from tkinter import messagebox
import webbrowser


PROJECT_DIR = Path(__file__).resolve().parent
APP_PATH = PROJECT_DIR / "app.py"
SERVER_URL = "http://127.0.0.1:5000"
LOG_DIR = PROJECT_DIR / ".cache" / "launcher"
STDOUT_LOG = LOG_DIR / "paralang.stdout.log"
STDERR_LOG = LOG_DIR / "paralang.stderr.log"
ICON_PATH = PROJECT_DIR / "static" / "favicon.ico"


class ParalangLauncher:
    def __init__(self, root):
        self.root = root
        self.process = None
        self.opened_browser = False
        self.poll_attempts = 0

        root.title("Paralang")
        root.resizable(False, False)
        root.protocol("WM_DELETE_WINDOW", self.stop)
        if ICON_PATH.is_file():
            try:
                root.iconbitmap(default=str(ICON_PATH))
            except tk.TclError:
                pass

        frame = tk.Frame(root, padx=24, pady=20)
        frame.pack()

        self.create_logo(frame).pack()
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

    @staticmethod
    def create_logo(parent):
        font = tkfont.Font(family="Arial", size=20, weight="bold")
        para_width = font.measure("PARA")
        lang_width = font.measure("LANG")
        badge_padding = 7
        badge_width = lang_width + (badge_padding * 2)
        height = font.metrics("linespace") + 14
        width = para_width + badge_width + 3

        canvas = tk.Canvas(
            parent,
            width=width,
            height=height,
            highlightthickness=0,
            borderwidth=0,
        )
        canvas.logo_font = font
        center_y = height / 2
        canvas.create_text(
            para_width,
            center_y,
            text="PARA",
            font=font,
            fill="black",
            anchor=tk.E,
        )

        x1 = para_width + 3
        y1 = 3
        x2 = width
        y2 = height - 3
        radius = 10
        canvas.create_polygon(
            x1 + radius, y1,
            x2 - radius, y1,
            x2, y1 + radius,
            x2, y2 - radius,
            x2 - radius, y2,
            x1 + radius, y2,
            x1, y2 - radius,
            x1, y1 + radius,
            smooth=True,
            splinesteps=36,
            fill="#6495ED",
            outline="",
        )
        canvas.create_text(
            x1 + (badge_width / 2),
            center_y,
            text="LANG",
            font=font,
            fill="white",
            anchor=tk.CENTER,
        )
        return canvas

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
