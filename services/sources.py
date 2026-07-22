from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import hashlib
import json
import re
import threading

from services.pasted_html_cache import PASTED_HTML_CACHE_ROOT


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "data"
ENVIRONMENT_PRESETS_PATH = DATA_ROOT / "environment-presets.json"
LOCAL_FILES_ROOT = DATA_ROOT / "local-files"
URL_CACHE_ROOT = PROJECT_ROOT / ".cache" / "canada-ca-pages"

LOCAL_FILES_ROOT.mkdir(parents=True, exist_ok=True)
URL_CACHE_ROOT.mkdir(parents=True, exist_ok=True)
PASTED_HTML_CACHE_ROOT.mkdir(parents=True, exist_ok=True)


def safe_resolve(path):
    """Resolve local paths without making unavailable network paths fatal."""
    try:
        return path.resolve(strict=False)
    except OSError:
        return path


def path_is_within(path, root):
    try:
        safe_resolve(path).relative_to(safe_resolve(root))
        return True
    except (ValueError, OSError):
        return False

CANADA_CA_URL_ENV = "canada-ca-url"
LOCAL_FILES_ENV = "local-files"
PASTED_HTML_ENV = "pasted-html"

BUILTIN_SOURCE_ENVIRONMENTS = {
    "local-files": {"label": "Local files", "root": LOCAL_FILES_ROOT, "type": "folder", "group": "Built-in environments", "collection_mode": "named-folders", "folder_name_pattern": r"[^\\/]+", "show_when_empty": True, "include_root_html": True, "include_landing_pages": True, "additional_folders": ["report-rapport"]},
    "pasted-html": {"label": "Pasted HTML", "root": PASTED_HTML_CACHE_ROOT, "type": "cache-folder", "group": "Built-in environments", "show_when_empty": True},
    "canada-ca-url": {"label": "Canada.ca", "root": URL_CACHE_ROOT, "type": "url-input", "group": "Built-in environments"},
}
SOURCE_ENVIRONMENTS = dict(BUILTIN_SOURCE_ENVIRONMENTS)
_PRESET_LOCK = threading.Lock()


def validate_environment_preset(value):
    if not isinstance(value, dict):
        raise ValueError("A preset must be a JSON object.")
    preset_id = str(value.get("id", "")).strip().lower()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", preset_id):
        raise ValueError("Preset ID must use lowercase letters, numbers, and hyphens.")
    if preset_id in BUILTIN_SOURCE_ENVIRONMENTS:
        raise ValueError("That preset ID is reserved by Paralang.")
    label = str(value.get("label", "")).strip()
    if not label or len(label) > 80:
        raise ValueError("Preset name is required and must be 80 characters or fewer.")
    root_text = str(value.get("root", "")).strip()
    if not root_text or not Path(root_text).is_absolute():
        raise ValueError("Root must be an absolute local or network folder path.")
    collection_mode = value.get("collection_mode", "named-folders")
    if collection_mode not in {"named-folders", "direct"}:
        raise ValueError("Collection mode must be named-folders or direct.")
    group = str(value.get("group", "Team presets")).strip() or "Team presets"
    selector = str(value.get("content_selector", ".content-area")).strip()
    if len(group) > 80 or not selector or len(selector) > 200 or any(char in selector for char in "{};"):
        raise ValueError("Preset group or content selector is invalid.")
    pattern = str(value.get("folder_name_pattern", r"[^\\/]+"))
    try:
        re.compile(pattern)
    except re.error as error:
        raise ValueError(f"Folder name pattern is invalid: {error}") from error
    raw_folders = value.get("additional_folders", ["report-rapport"])
    if not isinstance(raw_folders, list) or len(raw_folders) > 20:
        raise ValueError("Additional folders must be a list containing no more than 20 paths.")
    additional_folders = []
    for raw_folder in raw_folders:
        normalized_folder = str(raw_folder).strip().replace("\\", "/")
        folder = normalized_folder.strip("/")
        parts = Path(folder).parts
        if not folder or len(folder) > 200 or normalized_folder.startswith("/") or Path(folder).is_absolute() or any(part in {".", ".."} for part in parts):
            raise ValueError("Each additional folder must be a safe relative path within the root.")
        if folder not in additional_folders:
            additional_folders.append(folder)
    return {"schema_version": 1, "id": preset_id, "label": label, "group": group, "root": root_text, "source_type": "folder", "collection_mode": collection_mode, "folder_name_pattern": pattern, "include_root_html": collection_mode == "direct" or bool(value.get("include_root_html", False)), "include_landing_pages": bool(value.get("include_landing_pages", True)), "additional_folders": additional_folders, "content_selector": selector}


def read_environment_presets():
    if not ENVIRONMENT_PRESETS_PATH.exists():
        return []
    try:
        raw = json.loads(ENVIRONMENT_PRESETS_PATH.read_text(encoding="utf-8"))
        values = raw.get("presets", []) if isinstance(raw, dict) else raw
        return [validate_environment_preset(value) for value in values]
    except (OSError, ValueError, json.JSONDecodeError):
        return []


def load_environment_presets():
    SOURCE_ENVIRONMENTS.clear()
    SOURCE_ENVIRONMENTS.update(BUILTIN_SOURCE_ENVIRONMENTS)
    for preset in read_environment_presets():
        SOURCE_ENVIRONMENTS[preset["id"]] = {**preset, "root": Path(preset["root"]), "type": "folder"}


def write_environment_presets(presets):
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    normalized = [validate_environment_preset(value) for value in presets]
    temp_path = ENVIRONMENT_PRESETS_PATH.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps({"schema_version": 1, "presets": normalized}, indent=2), encoding="utf-8")
    temp_path.replace(ENVIRONMENT_PRESETS_PATH)
    load_environment_presets()


def save_environment_preset(value):
    normalized = validate_environment_preset(value)
    with _PRESET_LOCK:
        presets = read_environment_presets()
        if any(item["id"] == normalized["id"] for item in presets):
            raise ValueError("A preset with that ID already exists.")
        write_environment_presets([*presets, normalized])
    return normalized


def delete_environment_preset(preset_id):
    if preset_id in BUILTIN_SOURCE_ENVIRONMENTS:
        return False
    with _PRESET_LOCK:
        presets = read_environment_presets()
        kept = [item for item in presets if item["id"] != preset_id]
        if len(kept) == len(presets):
            return False
        write_environment_presets(kept)
    return True


load_environment_presets()


def get_source_root(source_env, year=None):
    if source_env not in SOURCE_ENVIRONMENTS:
        return None

    config = SOURCE_ENVIRONMENTS[source_env]

    if config.get("type") == "cache-folder":
        config["root"].mkdir(parents=True, exist_ok=True)
        return safe_resolve(config["root"])

    if config.get("type") == "url-input":
        if source_env == CANADA_CA_URL_ENV:
            config["root"].mkdir(parents=True, exist_ok=True)

        return safe_resolve(config["root"])

    if config.get("collection_mode") == "direct":
        return safe_resolve(config["root"])

    folder_name = str(year or "")
    folder_name_pattern = config.get("folder_name_pattern", r"\d{4}")
    if not re.fullmatch(folder_name_pattern, folder_name):
        return None

    source_root = safe_resolve(config["root"] / folder_name)
    if not path_is_within(source_root, config["root"]):
        return None
    return source_root


def get_available_years(source_env):
    if source_env not in SOURCE_ENVIRONMENTS:
        return []

    config = SOURCE_ENVIRONMENTS[source_env]
    env_root = config["root"]

    if config.get("type") == "cache-folder":
        return ["_"]
    if config.get("collection_mode") == "direct":
        try:
            return ["_"] if env_root.is_dir() else []
        except OSError:
            return []

    try:
        if not env_root.exists() or not env_root.is_dir():
            return []
    except OSError:
        return []

    years = []

    folder_name_pattern = config.get("folder_name_pattern", r"\d{4}")
    try:
        for child in env_root.iterdir():
            if not child.is_dir() or not re.fullmatch(folder_name_pattern, child.name):
                continue
            has_additional_folder = any((child / folder).is_dir() for folder in config.get("additional_folders", []))
            if config.get("include_root_html") or has_additional_folder:
                years.append(child.name)
    except OSError:
        return []

    return sorted(years, reverse=True)


def get_available_sources():
    sources = []

    for key, config in SOURCE_ENVIRONMENTS.items():
        if config.get("type") == "url-input":
            sources.append({
                "key": key,
                "label": config["label"],
                "group": config.get("group", "Team presets"),
                "type": config.get("type"),
                "years": []
            })
            continue

        years = get_available_years(key)

        if years or config.get("show_when_empty"):
            sources.append({
                "key": key,
                "label": config["label"],
                "group": config.get("group", "Team presets"),
                "type": config.get("type"),
                "years": years
            })

    return sources


def get_html_files(source_env, year):
    source_root = get_source_root(source_env, year)

    if not source_root:
        return []

    config = SOURCE_ENVIRONMENTS.get(source_env, {})

    # URL-input environments do not use dropdown file discovery.
    if config.get("type") == "url-input":
        return []

    files = []

    # Landing pages live one level above report-rapport.
    if config.get("include_landing_pages"):
        for landing_page in ["home-accueil-en.html", "home-accueil-fr.html"]:
            landing_path = source_root / landing_page

            if landing_path.exists() and landing_path.is_file():
                files.append(landing_page)

    if config.get("include_root_html") or source_env == PASTED_HTML_ENV:
        try:
            for html_file in sorted(source_root.glob("*.html")):
                if html_file.name not in files:
                    files.append(html_file.name)
        except OSError:
            return files

    for folder in config.get("additional_folders", []):
        content_dir = safe_resolve(source_root / folder)
        if not path_is_within(content_dir, source_root):
            continue
        try:
            if content_dir.is_dir():
                for html_file in sorted(content_dir.glob("*.html")):
                    relative_file = html_file.relative_to(source_root).as_posix()
                    if relative_file not in files:
                        files.append(relative_file)
        except OSError:
            continue

    return files


def is_url_input_environment(source_env):
    return (
        source_env in SOURCE_ENVIRONMENTS
        and SOURCE_ENVIRONMENTS[source_env].get("type") == "url-input"
    )


def is_custom_environment(source_env):
    return source_env in SOURCE_ENVIRONMENTS and source_env not in BUILTIN_SOURCE_ENVIRONMENTS


def is_allowed_canada_ca_url(url):
    parsed = urlparse((url or "").strip())

    if parsed.scheme != "https":
        return False

    if parsed.netloc.lower() != "www.canada.ca":
        return False

    return bool(re.match(r"^/(en|fr)/", parsed.path))


def get_canada_ca_cache_key(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def get_canada_ca_cached_relative_path(url):
    cache_key = get_canada_ca_cache_key(url)
    parsed = urlparse(url)

    suffix = Path(parsed.path).suffix or ".html"

    return f"{cache_key}{suffix}"


def get_canada_ca_cached_file_path(url):
    URL_CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    return URL_CACHE_ROOT / get_canada_ca_cached_relative_path(url)


def get_canada_ca_metadata_path(cached_path):
    return cached_path.with_suffix(cached_path.suffix + ".json")


def inject_base_href(html, url):
    base_tag = f'<base href="{url}">'

    if "<head" not in html.lower():
        return base_tag + "\n" + html

    return re.sub(
        r"(<head[^>]*>)",
        r"\1\n  " + base_tag,
        html,
        count=1,
        flags=re.IGNORECASE
    )


def fetch_canada_ca_url_to_cache(url):
    url = (url or "").strip()

    if not is_allowed_canada_ca_url(url):
        raise ValueError("Only https://www.canada.ca/en/... and https://www.canada.ca/fr/... URLs are allowed.")

    cached_path = get_canada_ca_cached_file_path(url)
    metadata_path = get_canada_ca_metadata_path(cached_path)

    request = Request(
        url,
        headers={
            "User-Agent": "Paralang local QA tool"
        }
    )

    with urlopen(request, timeout=20) as response:
        raw = response.read()

    html = raw.decode("utf-8", errors="ignore")
    html = inject_base_href(html, url)

    cached_path.write_text(html, encoding="utf-8")

    metadata = {
        "source_url": url
    }

    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return get_canada_ca_cached_relative_path(url)


def get_canada_ca_source_url_from_cached_file(filename):
    path = URL_CACHE_ROOT / filename
    metadata_path = get_canada_ca_metadata_path(path)

    if not metadata_path.exists():
        return None

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        return metadata.get("source_url")
    except Exception:
        return None

def get_resolved_source_file_path(source_env, year, filename):
    source_root = get_source_root(source_env, year)

    if not source_root:
        return None

    path = safe_resolve(source_root / filename)

    if not path_is_within(path, source_root):
        return None

    if not path.exists() or not path.is_file():
        return None

    return path
