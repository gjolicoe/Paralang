from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
import ctypes
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime, timezone

from services.pasted_html_cache import PASTED_HTML_CACHE_ROOT


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "data"
ENVIRONMENT_PRESETS_PATH = DATA_ROOT / "environment-presets.json"
LOCAL_FILES_ROOT = DATA_ROOT / "local-files"
URL_CACHE_ROOT = PROJECT_ROOT / ".cache" / "canada-ca-pages"
URL_PRESET_CACHE_ROOT = PROJECT_ROOT / ".cache" / "url-presets"
MAX_CANADA_CA_PAGE_BYTES = 100 * 1024 * 1024
MAX_CANADA_CA_REDIRECTS = 10
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

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
    "canada-ca-url": {
        "label": "Canada.ca",
        "root": URL_CACHE_ROOT,
        "type": "url-input",
        "group": "Built-in environments",
        "allowed_origins": ["https://www.canada.ca"],
        "path_prefixes": ["/en/", "/fr/"],
        "content_selector": "main",
    },
}
SOURCE_ENVIRONMENTS = dict(BUILTIN_SOURCE_ENVIRONMENTS)
_PRESET_LOCK = threading.Lock()
_URL_FETCH_LOCK = threading.Lock()


def normalize_public_https_origin(value):
    parsed = urlparse(str(value or "").strip())
    hostname = (parsed.hostname or "").lower()
    if (
        parsed.scheme.lower() != "https"
        or not hostname
        or hostname == "localhost"
        or "." not in hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Allowed website must be a public HTTPS origin, such as https://www.example.com.")
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("Allowed website contains an invalid port.") from error
    if re.fullmatch(r"\d+(?:\.\d+){3}", hostname) or ":" in hostname:
        raise ValueError("Allowed website must use a public hostname rather than an IP address.")
    return f"https://{hostname}" + (f":{port}" if port and port != 443 else "")


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
    group = str(value.get("group", "Team presets")).strip() or "Team presets"
    selector = str(value.get("content_selector", ".content-area")).strip()
    if len(group) > 80 or not selector or len(selector) > 200 or any(char in selector for char in "{};"):
        raise ValueError("Preset group or content selector is invalid.")
    source_type = str(value.get("source_type", "folder")).strip().lower()
    if source_type not in {"folder", "url"}:
        raise ValueError("Preset type must be folder or URL.")
    if source_type == "url":
        raw_origins = value.get("allowed_origins")
        if raw_origins is None:
            raw_origins = [value.get("allowed_origin", "")]
        if not isinstance(raw_origins, list) or len(raw_origins) != 1:
            raise ValueError("A URL preset must define one allowed website.")
        allowed_origin = normalize_public_https_origin(raw_origins[0])
        return {
            "schema_version": 1,
            "id": preset_id,
            "label": label,
            "group": group,
            "source_type": "url",
            "allowed_origins": [allowed_origin],
            "content_selector": selector,
        }
    root_text = str(value.get("root", "")).strip()
    if not root_text or not Path(root_text).is_absolute():
        raise ValueError("Root must be an absolute local or network folder path.")
    collection_mode = value.get("collection_mode", "named-folders")
    if collection_mode not in {"named-folders", "direct"}:
        raise ValueError("Collection mode must be named-folders or direct.")
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
        if preset["source_type"] == "url":
            root = URL_PRESET_CACHE_ROOT / preset["id"]
            source_type = "url-input"
        else:
            root = Path(preset["root"])
            source_type = "folder"
        SOURCE_ENVIRONMENTS[preset["id"]] = {**preset, "root": root, "type": source_type}


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


def update_environment_preset(preset_id, value):
    if preset_id in BUILTIN_SOURCE_ENVIRONMENTS:
        raise ValueError("Built-in environment presets cannot be edited.")

    normalized = validate_environment_preset(value)
    if normalized["id"] != preset_id:
        raise ValueError("Preset ID cannot be changed while editing.")

    with _PRESET_LOCK:
        presets = read_environment_presets()
        updated = False
        next_presets = []
        for item in presets:
            if item["id"] == preset_id:
                next_presets.append(normalized)
                updated = True
            else:
                next_presets.append(item)
        if not updated:
            raise ValueError("Preset not found.")
        write_environment_presets(next_presets)
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


def get_url_origin(url):
    parsed = urlparse((url or "").strip())
    try:
        port = parsed.port
    except ValueError:
        return ""
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme.lower() != "https" or not hostname or parsed.username or parsed.password:
        return ""
    return f"https://{hostname}" + (f":{port}" if port and port != 443 else "")


def is_allowed_environment_url(source_env, url):
    config = SOURCE_ENVIRONMENTS.get(source_env, {})
    if config.get("type") != "url-input":
        return False
    parsed = urlparse((url or "").strip())
    if get_url_origin(url) not in config.get("allowed_origins", []):
        return False
    prefixes = config.get("path_prefixes", ["/"])
    return any(parsed.path.startswith(prefix) for prefix in prefixes)


class EnvironmentUrlRedirectHandler(HTTPRedirectHandler):
    def __init__(self, source_env, max_redirects=MAX_CANADA_CA_REDIRECTS):
        super().__init__()
        self.source_env = source_env
        self.max_redirects = max_redirects

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirect_count = getattr(req, "_paralang_redirect_count", 0) + 1
        resolved_url = urljoin(req.full_url, newurl)
        if redirect_count > self.max_redirects:
            raise ValueError("The website returned too many redirects.")
        if not is_allowed_environment_url(self.source_env, resolved_url):
            raise ValueError("The website redirected outside the preset's allowed origin.")
        redirected = super().redirect_request(req, fp, code, msg, headers, resolved_url)
        if redirected is not None:
            redirected._paralang_redirect_count = redirect_count
        return redirected


def is_allowed_canada_ca_url(url):
    return is_allowed_environment_url(CANADA_CA_URL_ENV, url)


class CanadaCaRedirectHandler(HTTPRedirectHandler):
    """Follow redirects only while every hop remains an allowed Canada.ca page."""

    def __init__(self, max_redirects=MAX_CANADA_CA_REDIRECTS):
        super().__init__()
        self.max_redirects = max_redirects

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirect_count = getattr(req, "_paralang_redirect_count", 0) + 1
        resolved_url = urljoin(req.full_url, newurl)
        if redirect_count > self.max_redirects:
            raise ValueError("Canada.ca returned too many redirects.")
        if not is_allowed_canada_ca_url(resolved_url):
            raise ValueError("Canada.ca redirected to a URL outside the approved Canada.ca paths.")

        redirected = super().redirect_request(req, fp, code, msg, headers, resolved_url)
        if redirected is not None:
            redirected._paralang_redirect_count = redirect_count
        return redirected


def read_limited_response(response, maximum_bytes=MAX_CANADA_CA_PAGE_BYTES):
    content_length = response.headers.get("Content-Length")
    if content_length:
        try:
            declared_length = int(content_length)
        except (TypeError, ValueError):
            declared_length = None
        if declared_length is not None and declared_length > maximum_bytes:
            raise ValueError("The Canada.ca page exceeds the 100 MB download limit.")

    chunks = []
    total = 0
    while True:
        chunk = response.read(min(1024 * 1024, maximum_bytes - total + 1))
        if not chunk:
            break
        total += len(chunk)
        if total > maximum_bytes:
            raise ValueError("The Canada.ca page exceeds the 100 MB download limit.")
        chunks.append(chunk)
    return b"".join(chunks)


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


def get_environment_url_cache_info(source_env, url):
    url = (url or "").strip()

    if not url or not is_allowed_environment_url(source_env, url):
        return None

    cache_root = get_source_root(source_env, "_")
    cached_path = cache_root / get_canada_ca_cached_relative_path(url)
    metadata_path = get_canada_ca_metadata_path(cached_path)

    if not cached_path.is_file() or not metadata_path.is_file():
        return None

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        fetched_at = metadata.get("fetched_at")

        if not fetched_at:
            fetched_at = datetime.fromtimestamp(
                cached_path.stat().st_mtime,
                tz=timezone.utc
            ).isoformat()

        fetched_datetime = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))

        return {
            "fetched_at": fetched_at,
            "fetched_at_display": fetched_datetime.astimezone().strftime(
                "%Y-%m-%d %H:%M"
            )
        }
    except (OSError, ValueError, TypeError):
        return None


def fetch_environment_url_to_cache(source_env, url, force_refresh=False):
    url = (url or "").strip()
    config = SOURCE_ENVIRONMENTS.get(source_env, {})
    if not is_allowed_environment_url(source_env, url):
        allowed = ", ".join(config.get("allowed_origins", [])) or "the configured website"
        raise ValueError(f"Only HTTPS URLs from {allowed} are allowed.")
    cache_root = get_source_root(source_env, "_")
    cached_name = get_canada_ca_cached_relative_path(url)
    cached_path = cache_root / cached_name
    metadata_path = get_canada_ca_metadata_path(cached_path)

    def cached_copy_is_available():
        try:
            return (
                cached_path.is_file()
                and cached_path.stat().st_size > 0
                and metadata_path.is_file()
            )
        except OSError:
            return False

    if not force_refresh and cached_copy_is_available():
        return cached_name

    # A workspace can be refreshed from more than one browser tab. Only one
    # request should download a given pair while the others reuse its result.
    with _URL_FETCH_LOCK:
        if not force_refresh and cached_copy_is_available():
            return cached_name

        return _download_environment_url_to_cache(
            source_env,
            url,
            cached_name,
            cached_path,
            metadata_path
        )


def _download_environment_url_to_cache(
    source_env,
    url,
    cached_name,
    cached_path,
    metadata_path
):
    request = Request(
        url,
        headers={"User-Agent": "Paralang local QA tool"}
    )
    opener = build_opener(EnvironmentUrlRedirectHandler(source_env))
    try:
        with opener.open(request, timeout=20) as response:
            final_url = response.geturl()
            if not is_allowed_environment_url(source_env, final_url):
                raise ValueError("The final download URL is outside the preset's allowed origin.")
            raw = read_limited_response(response)
    except HTTPError:
        raise
    except (OSError, TimeoutError) as urllib_error:
        # Some Windows/Python/OpenSSL combinations are reset by Canada.ca's CDN
        # even though the OS-native HTTPS stack works. Curl uses that native
        # stack on Windows, so retain urllib as the portable default and use
        # curl as a compatibility transport for network-level failures only.
        try:
            raw, final_url = fetch_environment_url_with_curl(source_env, url)
        except Exception as curl_error:
            raise OSError(
                f"The page could not be downloaded with either available HTTPS transport. "
                f"Python: {urllib_error}. System: {curl_error}"
            ) from curl_error
    html = raw.decode("utf-8", errors="ignore")
    html = inject_base_href(html, final_url)
    cached_path.write_text(html, encoding="utf-8")
    metadata = {
        "source_url": final_url,
        "fetched_at": datetime.now(timezone.utc).isoformat()
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return cached_name


def fetch_environment_url_with_curl(source_env, url):
    curl_path = get_trusted_curl_path()
    if not curl_path:
        raise OSError("The system curl transport is not available.")

    current_url = url
    for redirect_count in range(MAX_CANADA_CA_REDIRECTS + 1):
        if not is_allowed_environment_url(source_env, current_url):
            raise ValueError("The website redirected outside the preset's allowed origin.")

        cache_root = get_source_root(source_env, "_")
        with tempfile.TemporaryDirectory(prefix="paralang-download-", dir=cache_root) as temp_dir:
            body_path = Path(temp_dir) / "body"
            headers_path = Path(temp_dir) / "headers"
            result = subprocess.run(
                [
                    curl_path,
                    # This must be the first curl option. It prevents user or
                    # machine curl configuration from changing the request.
                    "--disable",
                    "--silent",
                    "--show-error",
                    "--proto",
                    "=https",
                    "--connect-timeout",
                    "20",
                    "--max-time",
                    "20",
                    "--max-filesize",
                    str(MAX_CANADA_CA_PAGE_BYTES),
                    "--user-agent",
                    "Paralang local QA tool",
                    "--output",
                    str(body_path),
                    "--dump-header",
                    str(headers_path),
                    "--write-out",
                    "%{http_code}",
                    current_url,
                ],
                capture_output=True,
                text=True,
                timeout=25,
                creationflags=CREATE_NO_WINDOW,
            )
            if result.returncode != 0:
                raise OSError(result.stderr.strip() or f"curl exited with code {result.returncode}.")

            try:
                status = int(result.stdout.strip())
            except ValueError as error:
                raise OSError("The system HTTPS transport returned an invalid status.") from error

            header_text = headers_path.read_text(encoding="iso-8859-1")
            if status in {301, 302, 303, 307, 308}:
                locations = re.findall(r"^Location:\s*(.+?)\s*$", header_text, flags=re.IGNORECASE | re.MULTILINE)
                if not locations:
                    raise OSError("The website returned a redirect without a destination.")
                if redirect_count >= MAX_CANADA_CA_REDIRECTS:
                    raise ValueError("The website returned too many redirects.")
                current_url = urljoin(current_url, locations[-1])
                continue
            if status < 200 or status >= 300:
                raise OSError(f"The website returned HTTP {status}.")

            raw = body_path.read_bytes()
            if len(raw) > MAX_CANADA_CA_PAGE_BYTES:
                raise ValueError("The Canada.ca page exceeds the 100 MB download limit.")
            return raw, current_url

    raise ValueError("The website returned too many redirects.")


def get_trusted_curl_path():
    if os.name == "nt":
        # Ask Windows for its protected system directory rather than trusting
        # PATH or environment variables that could point at another curl.exe.
        buffer = ctypes.create_unicode_buffer(32768)
        length = ctypes.windll.kernel32.GetSystemDirectoryW(buffer, len(buffer))
        if not length or length >= len(buffer):
            return None
        system_curl = Path(buffer.value) / "curl.exe"
        return str(system_curl) if system_curl.is_file() else None

    # On non-Windows systems curl is not guaranteed to have a fixed location.
    # which() returns an absolute executable path; subprocess never uses a shell.
    curl_path = shutil.which("curl")
    return str(Path(curl_path).resolve()) if curl_path else None


def fetch_canada_ca_url_to_cache(url):
    return fetch_environment_url_to_cache(CANADA_CA_URL_ENV, url)


def get_environment_source_url_from_cached_file(source_env, filename):
    source_root = get_source_root(source_env, "_")
    if not source_root:
        return None
    path = source_root / filename
    metadata_path = get_canada_ca_metadata_path(path)
    if not metadata_path.exists():
        return None
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        return metadata.get("source_url")
    except Exception:
        return None


def get_canada_ca_source_url_from_cached_file(filename):
    return get_environment_source_url_from_cached_file(CANADA_CA_URL_ENV, filename)

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
