from flask import Flask, send_from_directory, abort, render_template, request, jsonify
from pathlib import Path
from bs4 import BeautifulSoup

from urllib.parse import urlsplit
from uuid import uuid4

from services.sources import (
    get_source_root,
    get_available_sources,
    get_available_years,
    get_html_files,
    is_url_input_environment,
    CANADA_CA_URL_ENV,
    fetch_canada_ca_url_to_cache,
    get_canada_ca_source_url_from_cached_file,
    safe_resolve,
    path_is_within,
    LOCAL_FILES_ENV,
    LOCAL_FILES_ROOT,
    PASTED_HTML_ENV,
    read_environment_presets,
    save_environment_preset,
    update_environment_preset,
    delete_environment_preset,
    is_custom_environment,
)
from services.pasted_html_cache import (
    cleanup_expired,
    extract_name_text,
    find_conflict,
    get_unique_pair_slug,
    is_managed_pasted_html,
    save_pasted_html,
    slugify,
)

from services.parsing import (
    get_headings,
    get_primary_content_container_for_source,
    mark_heading_section_count_mismatches,
)

from services.code_view import format_html_for_code_view

from services.review_storage import (
    get_issues_for_page_pair,
    create_issue,
    delete_issue,
    delete_automated_issues_for_page_pair,
    create_issues_bulk,
    get_page_pair_key,
)

from services.automated_issues import (
    build_automated_issue_records,
    ensure_automated_issue_records_are_current,
)

app = Flask(__name__)
APP_INSTANCE_ID = uuid4().hex


@app.get("/api/app-instance")
def api_app_instance():
    response = jsonify({"instance_id": APP_INSTANCE_ID})
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/environment-presets")
def api_environment_presets():
    return jsonify({"presets": read_environment_presets()})


@app.post("/api/environment-presets")
def api_create_environment_preset():
    try:
        preset = save_environment_preset(request.get_json(silent=True) or {})
    except ValueError as error:
        return jsonify({"ok": False, "error": str(error)}), 400
    return jsonify({"ok": True, "preset": preset}), 201


@app.put("/api/environment-presets/<preset_id>")
def api_update_environment_preset(preset_id):
    try:
        preset = update_environment_preset(
            preset_id,
            request.get_json(silent=True) or {},
        )
    except ValueError as error:
        return jsonify({"ok": False, "error": str(error)}), 400
    return jsonify({"ok": True, "preset": preset})


@app.delete("/api/environment-presets/<preset_id>")
def api_delete_environment_preset(preset_id):
    if not delete_environment_preset(preset_id):
        return jsonify({"ok": False, "error": "Preset not found or cannot be deleted."}), 404
    return jsonify({"ok": True})


@app.post("/api/pasted-html")
def api_pasted_html():
    payload = request.get_json(silent=True) or {}
    contents = {"en": payload.get("en_html", ""), "fr": payload.get("fr_html", "")}
    if not all(value.strip() for value in contents.values()):
        return jsonify({"ok": False, "error": "Both English and French HTML are required."}), 400

    save_location = payload.get("save_location", "temporary")
    if save_location not in {"temporary", "local"}:
        return jsonify({"ok": False, "error": "Invalid save location."}), 400

    cleanup_expired()
    local_folder = "pasted-html"
    storage_root = (
        LOCAL_FILES_ROOT / local_folder
        if save_location == "local"
        else None
    )
    english_base_slug = slugify(extract_name_text(contents["en"]))
    decisions = payload.get("decisions") or {}
    conflicts = [conflict for language, content in contents.items()
                 if (conflict := find_conflict(
                     content, language, storage_root, english_base_slug
                 ))]
    unresolved = [conflict for conflict in conflicts if conflict["language"] not in decisions]
    if unresolved:
        return jsonify({"ok": False, "conflicts": unresolved}), 409
    if any(decisions.get(conflict["language"]) == "cancel" for conflict in conflicts):
        return jsonify({"ok": False, "cancelled": True})

    actions = {}
    for language in contents:
        conflict = next((item for item in conflicts if item["language"] == language), None)
        actions[language] = decisions.get(language, "create") if conflict else "create"

    shared_base_slug = None
    if all(action == "create" for action in actions.values()):
        shared_base_slug = get_unique_pair_slug(english_base_slug, storage_root)

    filenames = {}
    for language, content in contents.items():
        conflict = next((item for item in conflicts if item["language"] == language), None)
        action = actions[language]
        if action not in {"overwrite", "create"}:
            return jsonify({"ok": False, "error": "Invalid duplicate action."}), 400
        filenames[language] = save_pasted_html(
            content, language, action,
            conflict["filename"] if conflict and action == "overwrite" else None,
            shared_base_slug if action == "create" else None,
            storage_root,
        )
    target_env = LOCAL_FILES_ENV if save_location == "local" else PASTED_HTML_ENV
    target_year = local_folder if save_location == "local" else "_"
    return jsonify({
        "ok": True,
        "redirect": (
            f"/?env={target_env}&year={target_year}"
            f"&left={filenames['en']}&right={filenames['fr']}"
        )
    })


def rewrite_local_stylesheet_paths(soup, bundled_only=False):
    """Point bundled stylesheet references at Paralang's static CSS folder."""
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
        if bundled_only and stylesheet_name != "theme.min.css":
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
        source_env = available_envs[0] if available_envs else LOCAL_FILES_ENV

    is_url_input = is_url_input_environment(source_env)

    left_file = ""
    right_file = ""
    left_input_value = ""
    right_input_value = ""

    left_headings = []
    right_headings = []
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

    if right_file:
        right_headings = get_headings(right_file, source_env, year)
    
    mark_heading_section_count_mismatches(left_headings, right_headings)

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
        environment_presets=read_environment_presets(),
        available_years=available_years,
        is_url_input=is_url_input,
        left_headings=left_headings,
        right_headings=right_headings,
        user_issues=user_issues,
        automated_issues=automated_issues,
        app_instance_id=APP_INSTANCE_ID,
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

    is_pasted_content = source_env == PASTED_HTML_ENV or is_managed_pasted_html(requested)
    if is_pasted_content:
        for unsafe in soup.find_all(["script", "iframe", "object", "embed"]):
            unsafe.decompose()
        for element in soup.find_all(True):
            for attribute in list(element.attrs):
                value = element.get(attribute)
                if attribute.lower().startswith("on") or (
                    attribute.lower() in {"href", "src", "action", "formaction"}
                    and isinstance(value, str) and value.strip().lower().startswith("javascript:")
                ):
                    del element.attrs[attribute]

        if not soup.head:
            soup.insert(0, soup.new_tag("head"))

        theme_stylesheet = soup.new_tag("link")
        theme_stylesheet["rel"] = "stylesheet"
        theme_stylesheet["href"] = "/static/css/theme.min.css"
        soup.head.append(theme_stylesheet)

    if source_env == LOCAL_FILES_ENV:
        rewrite_local_stylesheet_paths(soup)
    elif is_custom_environment(source_env):
        rewrite_local_stylesheet_paths(soup, bundled_only=True)

    parsing_env = PASTED_HTML_ENV if is_pasted_content else source_env
    content_area, container_selector = get_primary_content_container_for_source(soup, parsing_env)

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

            /* Fit tables to the page-view width without adding a nested
               horizontal scroll area. Automatic layout preserves useful
               content-based column proportions while cells may wrap. */
            :is(.content-area, .paralang-content-scope, main) .table-responsive {
                width: 100% !important;
                max-width: 100% !important;
                overflow-x: visible !important;
            }

            :is(.content-area, .paralang-content-scope, main) table {
                width: 100% !important;
                max-width: 100% !important;
                table-layout: auto !important;
            }

            :is(.content-area, .paralang-content-scope, main) :is(th, td) {
                min-width: 0 !important;
                white-space: normal !important;
                overflow-wrap: anywhere;
                word-break: normal;
            }

            :is(.content-area, .paralang-content-scope, main) :is(th, td) :is(pre, code) {
                max-width: 100%;
                white-space: pre-wrap !important;
                overflow-wrap: anywhere;
            }

            :is(.content-area, .paralang-content-scope, main) :is(th, td) :is(img, svg) {
                max-width: 100% !important;
                height: auto;
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
