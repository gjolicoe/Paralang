"""Make downloaded wheels directly importable without extracting them."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import sys


def add_missing_package_marker(wheel_path, member):
    with ZipFile(wheel_path, "a", compression=ZIP_DEFLATED) as archive:
        if member not in archive.namelist():
            archive.writestr(member, "\"\"\"Package marker for direct wheel imports.\"\"\"\n")


def main(vendor_directory):
    vendor_directory = Path(vendor_directory)
    flask_wheels = sorted(vendor_directory.glob("flask-*.whl"))
    if len(flask_wheels) != 1:
        raise RuntimeError("Expected exactly one Flask wheel archive.")
    add_missing_package_marker(flask_wheels[0], "flask/sansio/__init__.py")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_vendor_wheels.py VENDOR_WHEELS_DIRECTORY")
    main(sys.argv[1])
