from datetime import datetime
import uuid

from services.preflight import diff_comparable_blocks
from services.parsing import extract_comparable_blocks
from services.sources import get_resolved_source_file_path
from services.review_storage import (
    create_issues_bulk,
    delete_automated_issues_for_page_pair,
    get_file_modified_iso,
    get_latest_automated_scan_issues,
    get_page_pair_key,
)


def build_automated_issue_records(source_env, year, left_file, right_file):
    def is_heading_tag(tag):
        return tag in {"h1", "h2", "h3", "h4", "h5", "h6"}

    left_blocks = extract_comparable_blocks(left_file, source_env, year) if left_file else []
    right_blocks = extract_comparable_blocks(right_file, source_env, year) if right_file else []

    preflight_issues = diff_comparable_blocks(left_blocks, right_blocks)

    page_pair_key = get_page_pair_key(source_env, year, left_file, right_file)
    scan_id = f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    left_path = get_resolved_source_file_path(source_env, year, left_file)
    right_path = get_resolved_source_file_path(source_env, year, right_file)

    left_modified_at = get_file_modified_iso(left_path)
    right_modified_at = get_file_modified_iso(right_path)

    records = []

    for issue in preflight_issues:
        left = issue.get("left")
        right = issue.get("right")

        target = left or right

        if not target:
            continue

        side = "left" if left else "right"
        filename = left_file if left else right_file        

        records.append({
            "issue_source": "automated",
            "source_env": source_env,
            "year": year,
            "filename": filename,
            "left_file": left_file,
            "right_file": right_file,
            "page_pair_key": page_pair_key,
            "side": side,
            "block_index": target.get("index"),
            "block_signature": target.get("nav_signature", ""),
            "block_hash": "",
            "left_block_index": left.get("index") if left else None,
            "right_block_index": right.get("index") if right else None,
            "left_cell_index": issue.get("left_cell_index"),
            "right_cell_index": issue.get("right_cell_index"),
            "severity": issue.get("severity", "warning"),
            "title": issue.get("label", "Automated issue"),
            "comment": issue.get("detail", ""),
            "created_by": "Automated check",
            "scan_id": scan_id,
            "left_modified_at": left_modified_at,
            "right_modified_at": right_modified_at
        })

    return records

def automated_scan_is_stale(source_env, year, left_file, right_file):
    existing_automated = get_latest_automated_scan_issues(
        source_env,
        year,
        left_file,
        right_file
    )

    if not existing_automated:
        return True

    latest_issue = max(
        existing_automated,
        key=lambda issue: issue.get("created_at", "")
    )

    # Records created before cell-level table checks do not contain these
    # coordinates and must be regenerated once after upgrading.
    if "left_block_index" not in latest_issue:
        return True

    left_path = get_resolved_source_file_path(source_env, year, left_file)
    right_path = get_resolved_source_file_path(source_env, year, right_file)

    current_left_modified_at = get_file_modified_iso(left_path)
    current_right_modified_at = get_file_modified_iso(right_path)

    stored_left_modified_at = latest_issue.get("left_modified_at")
    stored_right_modified_at = latest_issue.get("right_modified_at")

    return (
        current_left_modified_at != stored_left_modified_at
        or current_right_modified_at != stored_right_modified_at
    )


def ensure_automated_issue_records_are_current(source_env, year, left_file, right_file):
    if not left_file or not right_file:
        return []

    if not automated_scan_is_stale(source_env, year, left_file, right_file):
        return get_latest_automated_scan_issues(
            source_env,
            year,
            left_file,
            right_file
        )

    delete_automated_issues_for_page_pair(
        source_env,
        year,
        left_file,
        right_file
    )

    records = build_automated_issue_records(
        source_env,
        year,
        left_file,
        right_file
    )

    if not records:
        return []

    return create_issues_bulk(records)
