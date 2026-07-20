from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import time
import uuid


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
ISSUES_PATH = DATA_DIR / "paralang-issues.json"
LOCK_PATH = DATA_DIR / "paralang-issues.json.lock"


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def ensure_data_files():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not ISSUES_PATH.exists():
        ISSUES_PATH.write_text("[]", encoding="utf-8")


def acquire_file_lock(timeout_seconds=5):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    start = time.time()

    while True:
        try:
            fd = os.open(str(LOCK_PATH), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            return
        except FileExistsError:
            if time.time() - start > timeout_seconds:
                raise TimeoutError("Could not acquire review storage lock.")

            time.sleep(0.05)


def release_file_lock():
    try:
        LOCK_PATH.unlink()
    except FileNotFoundError:
        pass


def read_json_file(path, fallback):
    ensure_data_files()

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json_file(path, data):
    ensure_data_files()

    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    temp_path.replace(path)


def get_all_issues():
    return read_json_file(ISSUES_PATH, [])


def save_all_issues(issues):
    acquire_file_lock()

    try:
        write_json_file(ISSUES_PATH, issues)
    finally:
        release_file_lock()


def get_page_pair_key(source_env, year, left_file, right_file):
    raw = "|".join([
        str(source_env or ""),
        str(year or ""),
        str(left_file or ""),
        str(right_file or "")
    ])

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_file_modified_iso(path):
    if not path or not path.exists():
        return None

    timestamp = path.stat().st_mtime
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


def get_issues_for_page_pair(source_env, year, left_file, right_file):
    issues = get_all_issues()
    page_pair_key = get_page_pair_key(source_env, year, left_file, right_file)

    return [
        issue for issue in issues
        if issue.get("page_pair_key") == page_pair_key
        and issue.get("status") != "deleted"
    ]


def delete_issue(issue_id):
    issues = get_all_issues()

    original_count = len(issues)

    issues = [
        issue for issue in issues
        if issue.get("id") != issue_id
    ]

    if len(issues) == original_count:
        return False

    save_all_issues(issues)
    return True


def delete_automated_issues_for_page_pair(source_env, year, left_file, right_file):
    issues = get_all_issues()
    page_pair_key = get_page_pair_key(source_env, year, left_file, right_file)

    kept = [
        issue for issue in issues
        if not (
            issue.get("page_pair_key") == page_pair_key
            and issue.get("issue_source") == "automated"
        )
    ]

    deleted_count = len(issues) - len(kept)

    save_all_issues(kept)

    return deleted_count


def build_issue(issue_data, default_source="user", default_side="", default_creator="Unknown"):
    issue_id = f"issue_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    return {
        "id": issue_id,
        "issue_source": issue_data.get("issue_source", default_source),
        "source_env": issue_data.get("source_env", ""),
        "year": str(issue_data.get("year", "")),
        "filename": issue_data.get("filename", ""),
        "left_file": issue_data.get("left_file", ""),
        "right_file": issue_data.get("right_file", ""),
        "page_pair_key": issue_data.get("page_pair_key", ""),
        "side": issue_data.get("side", default_side),
        "block_index": issue_data.get("block_index"),
        "block_signature": issue_data.get("block_signature", ""),
        "block_hash": issue_data.get("block_hash", ""),
        "left_block_index": issue_data.get("left_block_index"),
        "right_block_index": issue_data.get("right_block_index"),
        "left_cell_index": issue_data.get("left_cell_index"),
        "right_cell_index": issue_data.get("right_cell_index"),
        "severity": issue_data.get("severity", "warning"),
        "status": "open",
        "title": issue_data.get("title", "").strip(),
        "comment": issue_data.get("comment", "").strip(),
        "created_by": issue_data.get("created_by", default_creator),
        "created_at": utc_now_iso(),
        "scan_id": issue_data.get("scan_id"),
        "left_modified_at": issue_data.get("left_modified_at"),
        "right_modified_at": issue_data.get("right_modified_at"),
        "resolved_by": None,
        "resolved_at": None
    }


def create_issue(issue_data):
    issues = get_all_issues()
    issue_data = dict(issue_data)
    issue_data["created_by"] = issue_data.get("created_by", "Unknown").strip() or "Unknown"
    issue = build_issue(issue_data)

    issues.append(issue)
    save_all_issues(issues)

    return issue


def create_issues_bulk(new_issues):
    issues = get_all_issues()
    created = []

    for issue_data in new_issues:
        issue = build_issue(
            issue_data,
            default_source="automated",
            default_side="left",
            default_creator="Automated check"
        )

        issues.append(issue)
        created.append(issue)

    save_all_issues(issues)

    return created


def get_latest_automated_scan_issues(source_env, year, left_file, right_file):
    issues = get_issues_for_page_pair(source_env, year, left_file, right_file)

    return [
        issue for issue in issues
        if issue.get("issue_source") == "automated"
    ]
