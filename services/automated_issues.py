from datetime import datetime
import uuid

from services.preflight import diff_comparable_blocks
from services.parsing import extract_comparable_blocks
from services.accessibility import scan_accessibility
from services.aria_checks import compare_aria
from services.sources import get_resolved_source_file_path
from services.review_storage import (
    create_issues_bulk,
    delete_automated_issues_for_page_pair,
    get_file_modified_iso,
    get_latest_automated_scan_issues,
    get_page_pair_key,
)


AUTOMATED_CHECK_VERSION = 9


def merge_skipped_heading_issues(left_issues, right_issues):
    """Pair equivalent skipped-heading findings by document order."""
    left_skips = [issue for issue in left_issues if issue.get("opcode") == "heading-level-skipped"]
    right_skips = [issue for issue in right_issues if issue.get("opcode") == "heading-level-skipped"]
    other_issues = [
        {**issue, "left": issue["target"], "right": None}
        for issue in left_issues
        if issue.get("opcode") != "heading-level-skipped"
    ] + [
        {**issue, "left": None, "right": issue["target"]}
        for issue in right_issues
        if issue.get("opcode") != "heading-level-skipped"
    ]

    for index in range(max(len(left_skips), len(right_skips))):
        left_issue = left_skips[index] if index < len(left_skips) else None
        right_issue = right_skips[index] if index < len(right_skips) else None
        source_issue = left_issue or right_issue
        locations = "both English and French pages" if left_issue and right_issue else (
            "the English page" if left_issue else "the French page"
        )
        details = []
        if left_issue:
            details.append(f'English: {left_issue["detail"]}')
        if right_issue and (not left_issue or right_issue["detail"] != left_issue["detail"]):
            details.append(f'French: {right_issue["detail"]}')
        elif right_issue:
            details.append(f'French: {right_issue["detail"]}')

        other_issues.append({
            **source_issue,
            "left": left_issue["target"] if left_issue else None,
            "right": right_issue["target"] if right_issue else None,
            "detail": f"Location: {locations}. " + " ".join(details),
        })

    return other_issues


def build_automated_issue_records(source_env, year, left_file, right_file):
    def is_heading_tag(tag):
        return tag in {"h1", "h2", "h3", "h4", "h5", "h6"}

    left_blocks = extract_comparable_blocks(left_file, source_env, year) if left_file else []
    right_blocks = extract_comparable_blocks(right_file, source_env, year) if right_file else []

    preflight_issues = diff_comparable_blocks(left_blocks, right_blocks)

    left_accessibility = scan_accessibility(left_file, source_env, year) if left_file else []
    right_accessibility = scan_accessibility(right_file, source_env, year) if right_file else []
    preflight_issues.extend(merge_skipped_heading_issues(
        left_accessibility,
        right_accessibility,
    ))
    if left_file and right_file:
        preflight_issues.extend(compare_aria(left_file, right_file, source_env, year))

    page_pair_key = get_page_pair_key(source_env, year, left_file, right_file)
    scan_id = f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    left_path = get_resolved_source_file_path(source_env, year, left_file)
    right_path = get_resolved_source_file_path(source_env, year, right_file)

    left_modified_at = get_file_modified_iso(left_path)
    right_modified_at = get_file_modified_iso(right_path)

    records = []

    for issue in preflight_issues:
        # Numeric table pairing uses the browser's resolved scroll-sync map,
        # including the current manual offset. The server cannot reproduce
        # that live state, so these issues are generated client-side.
        if issue.get("opcode") == "table-number-mismatch":
            continue

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
            "alignment_confidence": issue.get("alignment_confidence", "high"),
            "left_section_start_index": issue.get("left_section_start_index"),
            "left_section_end_index": issue.get("left_section_end_index"),
            "right_section_start_index": issue.get("right_section_start_index"),
            "right_section_end_index": issue.get("right_section_end_index"),
            "automated_check_version": AUTOMATED_CHECK_VERSION,
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

    # Regenerate records when alignment behavior changes so cached scans do
    # not retain issue coordinates produced by an older checker.
    if latest_issue.get("automated_check_version") != AUTOMATED_CHECK_VERSION:
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
