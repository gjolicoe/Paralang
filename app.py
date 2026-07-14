from flask import Flask, send_from_directory, abort, render_template, request, jsonify
from pathlib import Path
from bs4 import BeautifulSoup

from datetime import datetime
from urllib.parse import urlsplit
import uuid

from services.sources import (
    get_source_root,
    get_available_sources,
    get_available_years,
    get_html_files,
    is_url_input_environment,
    aem_sensitive_url_to_relative_path,
    CANADA_CA_URL_ENV,
    fetch_canada_ca_url_to_cache,
    get_canada_ca_source_url_from_cached_file,
    get_resolved_source_file_path,
    safe_resolve,
    path_is_within,
    LOCAL_FILES_ENV,
)

from services.parsing import (
    get_headings,
    extract_comparable_blocks,
    get_primary_content_container_for_source,
    mark_heading_section_count_mismatches,
)

from services.preflight import (
    diff_comparable_blocks,
    format_block,
)

from services.code_view import format_html_for_code_view

from services.review_storage import (
    get_issues_for_page_pair,
    create_issue,
    delete_issue,
    delete_automated_issues_for_page_pair,
    create_issues_bulk,
    get_latest_automated_scan_issues,
    get_page_pair_key,
    get_file_modified_iso,
)

from services.automated_issues import (
    build_automated_issue_records,
    ensure_automated_issue_records_are_current,
)

app = Flask(__name__)


def rewrite_local_stylesheet_paths(soup):
    """Point local-file stylesheet references at Paralang's static CSS folder."""
    for link in soup.find_all("link", href=True):
        rel_values = link.get("rel", [])
        if isinstance(rel_values, str):
            rel_values = rel_values.split()

        if "stylesheet" not in {value.lower() for value in rel_values}:
            continue

        href = link["href"].strip()
        parsed = urlsplit(href)

        # Keep remotely hosted and inline stylesheets unchanged.
        if parsed.scheme or parsed.netloc or href.startswith("//"):
            continue

        stylesheet_name = Path(parsed.path.replace("\\", "/")).name
        if not stylesheet_name:
            continue

        rewritten_href = f"/static/css/{stylesheet_name}"
        if parsed.query:
            rewritten_href += f"?{parsed.query}"
        if parsed.fragment:
            rewritten_href += f"#{parsed.fragment}"

        link["href"] = rewritten_href

@app.route("/")
def index():
    source_options = get_available_sources()

    requested_env = request.args.get("env")
    available_envs = [source["key"] for source in source_options]

    if requested_env in available_envs:
        source_env = requested_env
    else:
        source_env = available_envs[0] if available_envs else "budget"

    is_url_input = is_url_input_environment(source_env)

    left_file = ""
    right_file = ""
    left_input_value = ""
    right_input_value = ""

    left_headings = []
    right_headings = []
    left_blocks = []
    right_blocks = []

    preflight_issues = []

    if is_url_input:
        left_input_value = request.args.get("left", "").strip()
        right_input_value = request.args.get("right", "").strip()

        available_years = []
        files = []
        en_files = []
        fr_files = []
        year = "_"

        if source_env == CANADA_CA_URL_ENV:
            if left_input_value:
                try:
                    left_file = fetch_canada_ca_url_to_cache(left_input_value)
                except Exception as error:
                    print(f"[Paralang] Could not fetch left Canada.ca URL: {error}")

            if right_input_value:
                try:
                    right_file = fetch_canada_ca_url_to_cache(right_input_value)
                except Exception as error:
                    print(f"[Paralang] Could not fetch right Canada.ca URL: {error}")

        else:
            left_file = aem_sensitive_url_to_relative_path(left_input_value)
            right_file = aem_sensitive_url_to_relative_path(right_input_value)

    else:
        available_years = get_available_years(source_env)

        requested_year = request.args.get("year")

        if requested_year in available_years:
            year = requested_year
        else:
            year = available_years[0] if available_years else ""

        files = get_html_files(source_env, year)
        en_files = [
            f for f in files
            if f.endswith("-en.html") or f == "home-accueil-en.html"
        ]

        fr_files = [
            f for f in files
            if f.endswith("-fr.html") or f == "home-accueil-fr.html"
        ]

        left_file = request.args.get("left")
        right_file = request.args.get("right")

        if left_file not in en_files:
            left_file = en_files[0] if en_files else ""

        if right_file not in fr_files:
            right_file = fr_files[0] if fr_files else ""

        left_input_value = left_file
        right_input_value = right_file

    if left_file:
        left_headings = get_headings(left_file, source_env, year)
        left_blocks = extract_comparable_blocks(left_file, source_env, year)

    if right_file:
        right_headings = get_headings(right_file, source_env, year)
        right_blocks = extract_comparable_blocks(right_file, source_env, year)
    
    mark_heading_section_count_mismatches(left_headings, right_headings)

    if left_blocks or right_blocks:
        preflight_issues = diff_comparable_blocks(left_blocks, right_blocks)
    
    if left_file and right_file:
        ensure_automated_issues_exist(source_env, year, left_file, right_file)

    all_issues = get_issues_for_page_pair(
        source_env,
        year,
        left_file,
        right_file
    )

    automated_issues = [
        issue for issue in all_issues
        if issue.get("issue_source") == "automated"
    ]

    user_issues = [
        issue for issue in all_issues
        if issue.get("issue_source") == "user"
    ]

    return render_template(
        "index.html",
        files=files,
        left_file=left_file,
        right_file=right_file,
        left_input_value=left_input_value,
        right_input_value=right_input_value,
        en_files=en_files,
        fr_files=fr_files,
        source_env=source_env,
        year=year,
        source_options=source_options,
        available_years=available_years,
        is_url_input=is_url_input,
        left_headings=left_headings,
        right_headings=right_headings,
        preflight_issues=automated_issues,
        user_issues=user_issues,
        format_block=format_block,
        automated_issues=automated_issues,
    )

@app.route("/source/<source_env>/<year>/<path:filename>")
def source(source_env, year, filename):
    source_root = get_source_root(source_env, year)

    if not source_root:
        abort(404)

    requested = safe_resolve(source_root / filename)

    if not path_is_within(requested, source_root):
        abort(403)

    if not requested.exists() or not requested.is_file():
        abort(404)

    return send_from_directory(source_root, filename)

@app.route("/aem-sensitive/<path:filename>")
def aem_sensitive_root_asset(filename):
    source_root = get_source_root("aem-sensitive", "_")

    if not source_root:
        abort(404)

    aem_root = safe_resolve(source_root / "aem-sensitive")
    requested = safe_resolve(aem_root / filename)

    # SECURITY: prevent escaping aem-sensitive root
    if not path_is_within(requested, aem_root):
        abort(403)

    if not requested.exists() or not requested.is_file():
        abort(404)

    return send_from_directory(aem_root, filename)

@app.route("/page/<source_env>/<year>/<path:filename>")
def page_view(source_env, year, filename):
    source_root = get_source_root(source_env, year)

    if not source_root:
        abort(404)

    requested = safe_resolve(source_root / filename)

    if not path_is_within(requested, source_root):
        abort(403)

    if not requested.exists() or not requested.is_file():
        abort(404)

    raw_html = requested.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw_html, "html.parser")

    if source_env == LOCAL_FILES_ENV:
        rewrite_local_stylesheet_paths(soup)

    content_area, container_selector = get_primary_content_container_for_source(soup, source_env)

    if not content_area:
        return render_template("content_not_found.html")

    if soup.head:
        # Remove any existing base tags so the browser only uses the one Paralang sets.
        for existing_base in soup.head.find_all("base"):
            existing_base.decompose()

        base = soup.new_tag("base")

        if source_env == CANADA_CA_URL_ENV:
            source_url = get_canada_ca_source_url_from_cached_file(filename)
            base["href"] = source_url or "https://www.canada.ca/"
        else:
            source_parent = Path(filename).parent.as_posix()

            base["href"] = (
                f"/source/{source_env}/{year}/{source_parent}/"
                if source_parent != "."
                else f"/source/{source_env}/{year}/"
            )

        soup.head.insert(0, base)

        padding_style = soup.new_tag("style")
        padding_style.string = """
            html,
            body {
                margin-top: 0 !important;
                overflow-anchor: none !important;
            }

            body {
                padding-top: 70px !important;
                padding-bottom: 45vh !important;
                box-sizing: border-box;
            }

            .container,
            .content-area,
            .paralang-content-scope,
            main {
                overflow: visible !important;
            }

            .paralang-content-scope {
                padding-bottom: 45vh !important;
                box-sizing: border-box;
            }

            [data-paralang-selected="true"] {
                outline-offset: 6px !important;
                box-sizing: border-box !important;
            }
        """
        soup.head.append(padding_style)

    original_body = soup.body
    new_body = soup.new_tag("body")

    if original_body:
        for attr, value in original_body.attrs.items():
            new_body[attr] = value

    viewer_container = soup.new_tag("div")
    viewer_container["class"] = "container"
    content_copy = BeautifulSoup(str(content_area), "html.parser")
    viewer_container.append(content_copy)

    new_body.append(viewer_container)

    if original_body:
        original_body.replace_with(new_body)
    else:
        soup.append(new_body)

    return str(soup)

@app.route("/code/<source_env>/<year>/<path:filename>")
def code_view(source_env, year, filename):
    source_root = get_source_root(source_env, year)

    if not source_root:
        abort(404)

    requested = safe_resolve(source_root / filename)

    if not path_is_within(requested, source_root):
        abort(403)

    if not requested.exists() or not requested.is_file():
        abort(404)

    selected_block_index = request.args.get("center_block_index", type=int)

    code_result = format_html_for_code_view(
        requested,
        source_env,
        year,
        selected_block_index=selected_block_index
    )

    return render_template(
        "code_view.html",
        highlighted_lines=code_result["lines"],
        code_window=code_result["window"]
    )

@app.route("/api/issues")
def api_get_issues():
    source_env = request.args.get("source_env", "")
    year = request.args.get("year", "")
    left_file = request.args.get("left_file", "")
    right_file = request.args.get("right_file", "")

    issues = get_issues_for_page_pair(
        source_env,
        year,
        left_file,
        right_file
    )

    return jsonify({
        "issues": issues
    })


@app.route("/api/issues", methods=["POST"])
def api_create_issue():
    payload = request.get_json(silent=True) or {}

    required_fields = [
        "source_env",
        "year",
        "filename",
        "left_file",
        "right_file",
        "side",
        "block_index",
        "block_signature",
        "title",
        "created_by"
    ]

    missing = [
        field for field in required_fields
        if payload.get(field) in [None, ""]
    ]

    if missing:
        return jsonify({
            "ok": False,
            "error": f"Missing required fields: {', '.join(missing)}"
        }), 400

    source_env = payload.get("source_env", "")
    year = payload.get("year", "")
    left_file = payload.get("left_file", "")
    right_file = payload.get("right_file", "")

    payload["issue_source"] = "user"
    payload["page_pair_key"] = get_page_pair_key(
        source_env,
        year,
        left_file,
        right_file
    )

    issue = create_issue(payload)

    return jsonify({
        "ok": True,
        "issue": issue
    })

@app.route("/api/issues/<issue_id>", methods=["DELETE"])
def api_delete_issue(issue_id):
    deleted = delete_issue(issue_id)

    if not deleted:
        return jsonify({
            "ok": False,
            "error": "Issue not found."
        }), 404

    return jsonify({
        "ok": True
    })

@app.route("/api/issues/rerun-automated", methods=["POST"])
def api_rerun_automated_issues():
    payload = request.get_json(silent=True) or {}

    source_env = payload.get("source_env", "")
    year = payload.get("year", "")
    left_file = payload.get("left_file", "")
    right_file = payload.get("right_file", "")

    if not source_env or not year or not left_file or not right_file:
        return jsonify({
            "ok": False,
            "error": "Missing required page pair information."
        }), 400

    if is_url_input_environment(source_env):
        return jsonify({
            "ok": False,
            "error": "Automated issue tracking is disabled for URL-based environments."
        }), 400

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

    created = create_issues_bulk(records) if records else []

    issues = get_issues_for_page_pair(
        source_env,
        year,
        left_file,
        right_file
    )

    return jsonify({
        "ok": True,
        "created_count": len(created),
        "issues": issues
    })

def ensure_automated_issues_exist(source_env, year, left_file, right_file):
    if not left_file or not right_file:
        return []

    if is_url_input_environment(source_env):
        return []

    return ensure_automated_issue_records_are_current(
        source_env,
        year,
        left_file,
        right_file
    )

if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
