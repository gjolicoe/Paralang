from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen
import hashlib
import json
import re


# READ-ONLY SOURCES (DO NOT MODIFY)
BASE_ROOT = Path(r"\\intra-web-prd\authoring.budget.canada.ca")
AEM_SENSITIVE_ROOT = Path(r"\\intra-web-prd\authoring.finb.gc.ca")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "data"
LOCAL_FILES_ROOT = DATA_ROOT / "local-files"
URL_CACHE_ROOT = PROJECT_ROOT / ".cache" / "canada-ca-pages"

LOCAL_FILES_ROOT.mkdir(parents=True, exist_ok=True)
URL_CACHE_ROOT.mkdir(parents=True, exist_ok=True)


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

SOURCE_ENVIRONMENTS = {
    "budget": {
        "label": "Budget",
        "root": BASE_ROOT,
        "type": "year-folder"
    },
    "local-files": {
        "label": "Local files",
        "root": LOCAL_FILES_ROOT,
        "type": "year-folder",
        "folder_name_pattern": r"[^\\/]+",
        "show_when_empty": True
    },
    "fiscal-update": {
        "label": "Fiscal update",
        "root": BASE_ROOT / "update-miseajour",
        "type": "year-folder"
    },
    "aem-sensitive": {
        "label": "AEM sensitive",
        "root": AEM_SENSITIVE_ROOT,
        "type": "url-input"
    },
    "canada-ca-url": {
        "label": "Canada.ca",
        "root": URL_CACHE_ROOT,
        "type": "url-input"
    }
}


def get_source_root(source_env, year=None):
    if source_env not in SOURCE_ENVIRONMENTS:
        return None

    config = SOURCE_ENVIRONMENTS[source_env]

    if config.get("type") == "url-input":
        if source_env == CANADA_CA_URL_ENV:
            config["root"].mkdir(parents=True, exist_ok=True)

        return safe_resolve(config["root"])

    folder_name = str(year or "")
    folder_name_pattern = config.get("folder_name_pattern", r"\d{4}")
    if not re.fullmatch(folder_name_pattern, folder_name):
        return None

    source_root = safe_resolve(config["root"] / folder_name)
    if not path_is_within(source_root, config["root"]):
        return None
    return source_root


def get_html_dir(source_env, year):
    source_root = get_source_root(source_env, year)

    if not source_root:
        return None

    html_dir = safe_resolve(source_root / "report-rapport")

    env_root = safe_resolve(SOURCE_ENVIRONMENTS[source_env]["root"])

    if not path_is_within(html_dir, env_root):
        return None

    if not html_dir.exists() or not html_dir.is_dir():
        return None

    return html_dir


def get_available_years(source_env):
    if source_env not in SOURCE_ENVIRONMENTS:
        return []

    env_root = SOURCE_ENVIRONMENTS[source_env]["root"]

    try:
        if not env_root.exists() or not env_root.is_dir():
            return []
    except OSError:
        return []

    years = []

    folder_name_pattern = SOURCE_ENVIRONMENTS[source_env].get("folder_name_pattern", r"\d{4}")
    try:
        for child in env_root.iterdir():
            if not child.is_dir() or not re.fullmatch(folder_name_pattern, child.name):
                continue
            if source_env == LOCAL_FILES_ENV or (child / "report-rapport").is_dir():
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
                "years": []
            })
            continue

        years = get_available_years(key)

        if years or config.get("show_when_empty"):
            sources.append({
                "key": key,
                "label": config["label"],
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
    if source_env in {"budget", "fiscal-update", LOCAL_FILES_ENV}:
        for landing_page in ["home-accueil-en.html", "home-accueil-fr.html"]:
            landing_path = source_root / landing_page

            if landing_path.exists() and landing_path.is_file():
                files.append(landing_page)

    report_dir = source_root / "report-rapport"

    if source_env == LOCAL_FILES_ENV:
        try:
            for html_file in sorted(source_root.glob("*.html")):
                if html_file.name not in files:
                    files.append(html_file.name)
        except OSError:
            return files

    if report_dir.exists() and report_dir.is_dir():
        for html_file in sorted(report_dir.glob("*.html")):
            files.append(f"report-rapport/{html_file.name}")

    return files


def is_canada_ca_url_environment(source_env):
    return source_env == CANADA_CA_URL_ENV


def is_url_input_environment(source_env):
    return (
        source_env in SOURCE_ENVIRONMENTS
        and SOURCE_ENVIRONMENTS[source_env].get("type") == "url-input"
    )


def aem_sensitive_url_to_relative_path(value):
    value = (value or "").strip()

    if not value:
        return ""

    normalized = value.replace("\\", "/")

    if normalized.startswith("aem-sensitive/"):
        return normalized

    marker = "/aem-sensitive/"

    parsed = urlparse(normalized)
    path = unquote(parsed.path or normalized)

    if marker not in path:
        return ""

    relative = path.split(marker, 1)[1]

    return f"aem-sensitive/{relative}".lstrip("/")


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
