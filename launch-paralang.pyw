"""Portable GUI launcher and process controller for Paralang."""

from pathlib import Path
import math
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
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

IRIS = "#3b2e7e"
IRIS_DEEP = "#2f2567"
TANGERINE = "#ff7a3d"
INK = "#29234b"
SURFACE = "#fff8f3"
CARD = "#ffffff"
MUTED = "#746d80"
BORDER = "#ded8e6"


class ParalangLauncher:
    def __init__(self, root):
        self.root = root
        self.process = None
        self.opened_browser = False
        self.poll_attempts = 0
        self.is_refreshing = False

        root.title("Paralang")
        root.resizable(False, False)
        root.protocol("WM_DELETE_WINDOW", self.stop)
        root.configure(background=SURFACE)
        self.app_icon = self.create_app_icon(root)
        try:
            root.iconphoto(True, self.app_icon)
        except tk.TclError:
            pass

        frame = tk.Frame(root, padx=30, pady=26, bg=SURFACE)
        frame.pack()

        self.create_logo(frame).pack(pady=(0, 18))

        status_card = tk.Frame(
            frame,
            padx=18,
            pady=14,
            bg=CARD,
            highlightthickness=1,
            highlightbackground=BORDER,
        )
        status_card.pack(fill=tk.X, pady=(0, 18))
        self.status = tk.StringVar(value="Starting the local server...")
        tk.Label(
            status_card,
            textvariable=self.status,
            font=("Segoe UI", 10, "bold"),
            fg=INK,
            bg=CARD,
        ).pack()
        tk.Label(
            status_card,
            text=SERVER_URL,
            font=("Consolas", 9),
            fg=MUTED,
            bg=CARD,
        ).pack(pady=(5, 0))

        buttons = tk.Frame(frame, bg=SURFACE)
        buttons.pack(fill=tk.X)
        self.open_button = tk.Button(
            buttons,
            text="Open Browser",
            width=15,
            state=tk.DISABLED,
            command=self.open_browser,
            **self.secondary_button_style(),
        )
        self.open_button.pack(side=tk.LEFT, padx=(0, 8))
        self.refresh_button = tk.Button(
            buttons,
            text="Refresh Application",
            width=18,
            state=tk.DISABLED,
            command=self.refresh_application,
            **self.primary_button_style(),
        )
        self.refresh_button.pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(
            buttons,
            text="Stop Paralang",
            width=14,
            command=self.stop,
            **self.secondary_button_style(),
        ).pack(side=tk.LEFT)

        root.after(100, self.start)

    @staticmethod
    def blend(first, second, amount):
        start = tuple(int(first[index:index + 2], 16) for index in (1, 3, 5))
        end = tuple(int(second[index:index + 2], 16) for index in (1, 3, 5))
        values = tuple(round(value + (end[i] - value) * amount) for i, value in enumerate(start))
        return "#{:02x}{:02x}{:02x}".format(*values)

    @staticmethod
    def rounded_inset(radius, distance):
        """Return the horizontal inset for a true circular rounded corner."""
        if distance >= radius:
            return 0
        offset = radius - distance - 0.5
        return round(radius - math.sqrt(max(0, (radius * radius) - (offset * offset))))

    @classmethod
    def draw_gradient_panel(cls, canvas, x1, y1, x2, y2, start, end, radius=8):
        height = y2 - y1
        for row in range(height):
            distance = min(row, height - row - 1)
            inset = cls.rounded_inset(radius, distance)
            color = cls.blend(start, end, row / max(1, height - 1))
            canvas.create_line(x1 + inset, y1 + row, x2 - inset, y1 + row, fill=color, width=1)

    @classmethod
    def create_app_icon(cls, root):
        image = tk.PhotoImage(master=root, width=64, height=64)
        panels = (
            (4, 6, 30, 58, "#493b8d", "#8e5063"),
            (34, 6, 60, 58, "#b45c5b", "#e96a2f"),
        )
        for x1, y1, x2, y2, start, end in panels:
            height = y2 - y1
            for row in range(height):
                distance = min(row, height - row - 1)
                inset = cls.rounded_inset(6, distance)
                color = cls.blend(start, end, row / max(1, height - 1))
                image.put(color, to=(x1 + inset, y1 + row, x2 - inset, y1 + row + 1))
        for x1, x2 in ((11, 23), (41, 53)):
            image.put("#ffffff", to=(x1, 21, x2, 24))
            image.put("#ffffff", to=(x1, 31, x2, 34))
            image.put("#ffffff", to=(x1, 41, x2 - 3, 44))
        return image

    @staticmethod
    def primary_button_style():
        return {
            "font": ("Segoe UI", 9, "bold"),
            "relief": tk.FLAT,
            "borderwidth": 0,
            "padx": 10,
            "pady": 8,
            "bg": IRIS,
            "fg": "white",
            "activebackground": IRIS_DEEP,
            "activeforeground": "white",
            "disabledforeground": "#aaa4b2",
            "cursor": "hand2",
        }

    @staticmethod
    def secondary_button_style():
        return {
            "font": ("Segoe UI", 9, "bold"),
            "relief": tk.FLAT,
            "borderwidth": 1,
            "padx": 10,
            "pady": 8,
            "bg": CARD,
            "fg": INK,
            "activebackground": "#eeeaf8",
            "activeforeground": IRIS,
            "disabledforeground": "#aaa4b2",
            "cursor": "hand2",
        }

    @classmethod
    def create_logo(cls, parent):
        font = tkfont.Font(family="Segoe UI", size=22, weight="bold")
        word_width = font.measure("Paralang")
        height = 58
        mark_width = 54
        width = mark_width + word_width + 12

        canvas = tk.Canvas(
            parent,
            width=width,
            height=height,
            highlightthickness=0,
            borderwidth=0,
            bg=SURFACE,
        )
        canvas.logo_font = font
        center_y = height / 2
        cls.draw_gradient_panel(canvas, 2, 5, 24, 53, "#493b8d", "#8e5063", 6)
        cls.draw_gradient_panel(canvas, 30, 5, 52, 53, "#b45c5b", "#e96a2f", 6)
        for x1, x2 in ((8, 18), (36, 46)):
            canvas.create_line(x1, 19, x2, 19, fill="white", width=3, capstyle=tk.ROUND)
            canvas.create_line(x1, 29, x2, 29, fill="white", width=3, capstyle=tk.ROUND)
            canvas.create_line(x1, 39, x2 - 2, 39, fill="white", width=3, capstyle=tk.ROUND)
        canvas.create_text(
            mark_width + 10,
            center_y - 1,
            text="Paralang",
            font=font,
            fill=INK,
            anchor=tk.W,
        )
        return canvas

    def server_is_ready(self):
        try:
            with socket.create_connection(("127.0.0.1", 5000), timeout=1):
                return True
        except OSError:
            return False

    def ensure_dependencies(self):
        dependency_check = subprocess.run(
            [sys.executable, "-c", "import flask, bs4"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        if dependency_check.returncode == 0:
            return True

        self.status.set("Installing required Python packages...")
        install_check = subprocess.run(
            [sys.executable, "-m", "pip", "install", "flask", "beautifulsoup4"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        if install_check.returncode != 0:
            self.fail(
                "Required Python packages could not be installed automatically.\n\n"
                f"Python: {sys.executable}\n\n"
                "Install them manually with:\npython -m pip install flask beautifulsoup4\n\n"
                f"Installer output:\n{install_check.stderr.strip() or install_check.stdout.strip()}"
            )
            return False

        return True

    def start(self):
        self.poll_attempts = 0

        if not APP_PATH.is_file():
            self.fail(f"app.py was not found in:\n{PROJECT_DIR}")
            return

        if not self.ensure_dependencies():
            return

        if self.server_is_ready():
            self.status.set("Paralang is already running")
            self.open_button.config(state=tk.NORMAL)
            self.refresh_button.config(state=tk.DISABLED)
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
                creationflags=CREATE_NO_WINDOW,
            )
        finally:
            stdout_file.close()
            stderr_file.close()

        self.root.after(500, self.poll_server)

    def poll_server(self):
        if self.server_is_ready():
            self.status.set("Paralang is running")
            self.open_button.config(state=tk.NORMAL)
            self.refresh_button.config(state=tk.NORMAL)
            if self.is_refreshing:
                self.is_refreshing = False
            else:
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
        self.refresh_button.config(state=tk.DISABLED)
        messagebox.showerror("Paralang could not start", message)

    def terminate_server(self):
        if not self.process or self.process.poll() is not None:
            return

        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=2)

    def refresh_application(self):
        if not self.process or self.process.poll() is not None:
            messagebox.showwarning(
                "Refresh Paralang",
                "This launcher does not own the running server, so it cannot restart it safely.",
            )
            return

        self.is_refreshing = True
        self.status.set("Refreshing Paralang...")
        self.open_button.config(state=tk.DISABLED)
        self.refresh_button.config(state=tk.DISABLED)
        self.terminate_server()
        self.process = None
        self.root.after(150, self.start)

    def stop(self):
        if self.process and self.process.poll() is None:
            self.status.set("Stopping Paralang...")
            self.terminate_server()
        self.root.destroy()


def main():
    root = tk.Tk()
    ParalangLauncher(root)
    root.mainloop()


if __name__ == "__main__":
    main()
