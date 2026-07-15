from datetime import datetime, timezone
from pathlib import Path
import hashlib
import html as html_module
import json
import re
import unicodedata

from bs4 import BeautifulSoup


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PASTED_HTML_CACHE_ROOT = PROJECT_ROOT / ".cache" / "pasted_html"
MAX_SLUG_LENGTH = 80
MAX_AGE_SECONDS = 14 * 24 * 60 * 60


def ensure_cache_root():
    PASTED_HTML_CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    return PASTED_HTML_CACHE_ROOT


def normalize_content(content):
    return (content or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def content_digest(content):
    return hashlib.sha256(normalize_content(content).encode("utf-8")).hexdigest()


def extract_name_text(content):
    soup = BeautifulSoup(content or "", "html.parser")
    for candidate in [soup.title, soup.find("h1"), soup.find("h2")]:
        if not candidate:
            continue
        text = " ".join(candidate.get_text(" ", strip=True).split())
        if text:
            return html_module.unescape(text)

    if soup.body:
        for value in soup.body.stripped_strings:
            if value.parent and value.parent.name in {"script", "style", "noscript"}:
                continue
            text = " ".join(str(value).split())
            if text:
                return html_module.unescape(text)
    return "pasted-html"


def slugify(text):
    normalized = unicodedata.normalize("NFKD", html_module.unescape(text or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = re.sub(r"-+", "-", slug)[:MAX_SLUG_LENGTH].rstrip("-")
    return slug or "pasted-html"


def cleanup_expired(now=None):
    root = ensure_cache_root()
    cutoff = (now or datetime.now(timezone.utc)).timestamp() - MAX_AGE_SECONDS
    removed = []
    for path in root.glob("*.html"):
        if not path.is_file() or not re.fullmatch(r"[a-z0-9-]+-(?:en|fr)\.html", path.name):
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed.append(path.name)
                metadata_path = _metadata_path(path)
                if metadata_path.is_file():
                    metadata_path.unlink()
                    removed.append(metadata_path.name)
        except OSError:
            continue
    return removed


def _metadata_path(html_path):
    return html_path.with_suffix(html_path.suffix + ".json")


def _read_metadata(html_path):
    try:
        return json.loads(_metadata_path(html_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def find_conflict(content, language):
    root = ensure_cache_root()
    heading = extract_name_text(content)
    base_slug = slugify(heading)
    digest = content_digest(content)
    similar = None
    for path in sorted(root.glob(f"*-{language}.html")):
        metadata = _read_metadata(path)
        existing_digest = metadata.get("content_digest")
        if not existing_digest:
            try:
                existing_digest = content_digest(path.read_text(encoding="utf-8"))
            except OSError:
                continue
        if existing_digest == digest:
            return {"language": language, "filename": path.name, "match": "identical"}
        if metadata.get("base_slug") == base_slug or slugify(metadata.get("heading", "")) == base_slug:
            similar = {"language": language, "filename": path.name, "match": "similar"}
    return similar


def _unique_path(base_slug, language):
    root = ensure_cache_root()
    candidate = root / f"{base_slug}-{language}.html"
    number = 2
    while candidate.exists():
        candidate = root / f"{base_slug}-{number}-{language}.html"
        number += 1
    return candidate


def get_unique_pair_slug(base_slug):
    root = ensure_cache_root()
    candidate = base_slug
    number = 2
    while any((root / f"{candidate}-{language}.html").exists() for language in ("en", "fr")):
        candidate = f"{base_slug}-{number}"
        number += 1
    return candidate


def save_pasted_html(
    content, language, action="create", existing_filename=None, base_slug_override=None
):
    if language not in {"en", "fr"}:
        raise ValueError("Unsupported language")
    normalized = normalize_content(content)
    if not normalized:
        raise ValueError(f"The {language.upper()} HTML field is empty.")
    heading = extract_name_text(normalized)
    base_slug = base_slug_override or slugify(heading)
    root = ensure_cache_root()

    if action == "overwrite":
        if not existing_filename or Path(existing_filename).name != existing_filename:
            raise ValueError("Invalid cached filename")
        path = root / existing_filename
        if not path.is_file() or not path.name.endswith(f"-{language}.html"):
            raise ValueError("The cached file to overwrite no longer exists.")
        created = _read_metadata(path).get("created_at")
    else:
        path = _unique_path(base_slug, language)
        created = None

    now = datetime.now(timezone.utc).isoformat()
    path.write_text(normalized, encoding="utf-8")
    metadata = {
        "heading": heading,
        "base_slug": base_slug,
        "language": language,
        "created_at": created or now,
        "modified_at": now,
        "content_digest": content_digest(normalized),
        "source_type": "pasted_html",
    }
    _metadata_path(path).write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    return path.name
