import html
import re

from bs4 import BeautifulSoup, NavigableString, Comment, Doctype, Tag

from services.parsing import (
    get_primary_content_container_for_source,
    get_direct_text,
)

VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
}

INLINE_LIKE_ELEMENTS = {
    "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data",
    "dfn", "em", "i", "kbd", "mark", "q", "s", "samp", "small",
    "span", "strong", "sub", "sup", "time", "u", "var", "wbr"
}

RAW_TEXT_ELEMENTS = {"script", "style", "pre", "textarea"}

LARGE_CODE_VIEW_LINE_THRESHOLD = 10000
MAX_CODE_VIEW_CACHE_ITEMS = 10

_CODE_VIEW_CACHE = {}


def get_code_view_cache_key(path, source_env):
    try:
        modified_time = path.stat().st_mtime
    except OSError:
        modified_time = 0

    return f"{source_env}|{path.resolve()}|{modified_time}"


def trim_code_view_cache():
    while len(_CODE_VIEW_CACHE) > MAX_CODE_VIEW_CACHE_ITEMS:
        oldest_key = next(iter(_CODE_VIEW_CACHE))
        _CODE_VIEW_CACHE.pop(oldest_key, None)


def normalize_code_whitespace(text):
    return " ".join((text or "").replace("\t", " ").split())


def is_meaningful_text_node(node):
    return isinstance(node, NavigableString) and normalize_code_whitespace(str(node)) != ""


def format_tag_attrs(tag):
    parts = []

    for key, value in tag.attrs.items():
        if isinstance(value, list):
            value = " ".join(str(v) for v in value)

        if value is None:
            parts.append(str(key))
        else:
            parts.append(f'{key}="{value}"')

    return f" {' '.join(parts)}" if parts else ""


def make_opening_tag(tag):
    return f"<{tag.name}{format_tag_attrs(tag)}>"


def make_closing_tag(tag):
    return f"</{tag.name}>"


def compact_tag_html(tag):
    html_text = tag.decode(formatter="minimal")
    html_text = html_text.replace("\n", " ").replace("\r", " ").replace("\t", " ")
    html_text = re.sub(r">\s+<", "><", html_text)
    html_text = re.sub(r"\s+", " ", html_text).strip()
    return html_text


def is_simple_inline_container(tag):
    if tag.name.lower() in RAW_TEXT_ELEMENTS:
        return False

    children = []

    for child in tag.contents:
        if isinstance(child, Comment):
            return False

        if isinstance(child, NavigableString):
            if normalize_code_whitespace(str(child)):
                children.append(child)
            continue

        if isinstance(child, Tag):
            children.append(child)

    if not children:
        return True

    for child in children:
        if isinstance(child, NavigableString):
            continue

        child_name = child.name.lower()

        if child_name not in INLINE_LIKE_ELEMENTS:
            return False

        if not is_simple_inline_container(child):
            return False

    return True


def highlight_html_line(line):
    escaped = html.escape(line, quote=True)
    stripped = escaped.strip()

    if stripped.startswith("&lt;!--"):
        return f'<span class="code-comment">{escaped}</span>'

    def highlight_tag(match):
        opening = match.group(1)
        tag_name = match.group(2)
        attrs = match.group(3)
        closing = match.group(4)

        attrs = re.sub(
            r'(\s+)([a-zA-Z_:][-a-zA-Z0-9_:.]*)(=)(&quot;.*?&quot;|&#x27;.*?&#x27;|[^\s]+)',
            r'\1<span class="code-attr">\2</span>\3<span class="code-value">\4</span>',
            attrs
        )

        return (
            f'<span class="code-tag">{opening}</span>'
            f'<span class="code-name">{tag_name}</span>'
            f'{attrs}'
            f'<span class="code-tag">{closing}</span>'
        )

    return re.sub(
        r'(&lt;/?)([a-zA-Z][a-zA-Z0-9:-]*)(.*?)(/?&gt;)',
        highlight_tag,
        escaped
    )


def get_no_content_result():
    highlighted_lines = [
        {
            "number": 1,
            "index": 0,
            "raw": "<!-- No usable <main> or .content-area found in this file. -->",
            "html": highlight_html_line("<!-- No usable <main> or .content-area found in this file. -->"),
            "heading_index": None,
            "block_index": None,
            "block_signature": None
        }
    ]

    return highlighted_lines


def build_highlighted_code_lines(path, source_env, year, open_details_indexes=None):
    raw_html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw_html, "html.parser")

    content_area, container_selector = get_primary_content_container_for_source(
        soup,
        source_env
    )

    if not content_area:
        return get_no_content_result()

    lines = []
    heading_line_indexes = {}
    block_line_ranges = {}
    block_signatures = {}
    heading_index = 0
    block_index = 0

    def is_comparable_code_block(node):
        if not isinstance(node, Tag):
            return False

        tag = node.name.lower()

        details_parent = node.find_parent("details")

        if details_parent and not details_parent.has_attr("open"):
            return False

        if tag not in {
            "h1", "h2", "h3", "h4", "h5", "h6",
            "p", "li", "dt", "dd", "tr", "figure", "img"
        }:
            return False

        if node.find_parent("li") and tag != "li":
            return False

        if node.find_parent("dl") and tag not in {"dt", "dd"}:
            return False

        if node.find_parent("table") and tag != "tr":
            return False

        if tag == "tr":
            text = node.get_text(" ", strip=True)
        else:
            text = get_direct_text(node)

        is_visual = tag in {"figure", "img"}

        return is_visual or bool(text)

    def get_code_block_signature(node):
        tag = node.name.lower()

        if tag in {"figure", "img"}:
            src = node.get("src", "")

            if not src:
                img = node.find("img")
                src = img.get("src", "") if img else ""

            alt = node.get("alt", "")

            if not alt:
                img = node.find("img")
                alt = img.get("alt", "") if img else ""

            return f"{tag}|{src}|{alt}".strip().lower()

        text = node.get_text(" ", strip=True)
        text = re.sub(r"\s+", " ", text)

        return f"{tag}|{text[:180]}".strip().lower()

    def append_node(node, depth=0):
        nonlocal heading_index, block_index

        indent = "  " * depth

        if isinstance(node, Doctype):
            lines.append(f"<!DOCTYPE {node}>")
            return

        if isinstance(node, Comment):
            comment_text = normalize_code_whitespace(str(node))
            lines.append(f"{indent}<!-- {comment_text} -->")
            return

        if isinstance(node, NavigableString):
            text = normalize_code_whitespace(str(node))
            if text:
                lines.append(f"{indent}{text}")
            return

        if not isinstance(node, Tag):
            return

        tag_name = node.name.lower()
        is_heading = tag_name in {"h1", "h2", "h3", "h4", "h5", "h6"}

        current_block_index = None
        block_start_line = None

        if is_comparable_code_block(node):
            current_block_index = block_index
            block_start_line = len(lines)
            block_signatures[current_block_index] = get_code_block_signature(node)
            block_index += 1

        def record_current_block_range():
            if (
                current_block_index is not None
                and block_start_line is not None
                and len(lines) > block_start_line
            ):
                block_line_ranges[current_block_index] = (
                    block_start_line,
                    len(lines) - 1
                )

        if tag_name in VOID_ELEMENTS:
            if is_heading:
                heading_line_indexes[heading_index] = len(lines)
                heading_index += 1

            lines.append(f"{indent}{make_opening_tag(node)}")
            record_current_block_range()
            return

        if tag_name in RAW_TEXT_ELEMENTS:
            raw_text = node.get_text()
            raw_text = raw_text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
            raw_text = re.sub(r"\s+", " ", raw_text).strip()

            if is_heading:
                heading_line_indexes[heading_index] = len(lines)
                heading_index += 1

            lines.append(f"{indent}{make_opening_tag(node)}{raw_text}{make_closing_tag(node)}")
            record_current_block_range()
            return

        if is_simple_inline_container(node):
            if is_heading:
                heading_line_indexes[heading_index] = len(lines)
                heading_index += 1

            lines.append(f"{indent}{compact_tag_html(node)}")
            record_current_block_range()
            return

        if is_heading:
            heading_line_indexes[heading_index] = len(lines)
            heading_index += 1

        lines.append(f"{indent}{make_opening_tag(node)}")

        for child in node.contents:
            append_node(child, depth + 1)

        lines.append(f"{indent}{make_closing_tag(node)}")
        record_current_block_range()

    for node in content_area.contents:
        append_node(node, 0)

    cleaned_lines = []
    original_to_cleaned = {}
    previous_blank = False

    for original_index, line in enumerate(lines):
        if line.strip() == "":
            if not previous_blank:
                original_to_cleaned[original_index] = len(cleaned_lines)
                cleaned_lines.append("")
            previous_blank = True
        else:
            original_to_cleaned[original_index] = len(cleaned_lines)
            cleaned_lines.append(line.rstrip())
            previous_blank = False

    cleaned_heading_line_indexes = {
        heading_idx: original_to_cleaned[line_idx]
        for heading_idx, line_idx in heading_line_indexes.items()
        if line_idx in original_to_cleaned
    }

    cleaned_block_line_indexes = {}

    for block_idx, (start_line, end_line) in block_line_ranges.items():
        for original_line_index in range(start_line, end_line + 1):
            if original_line_index not in original_to_cleaned:
                continue

            cleaned_line_index = original_to_cleaned[original_line_index]

            if cleaned_line_index not in cleaned_block_line_indexes:
                cleaned_block_line_indexes[cleaned_line_index] = block_idx

    highlighted_lines = [
        {
            "number": index + 1,
            "index": index,
            "raw": line,
            "html": highlight_html_line(line),
            "heading_index": next(
                (
                    heading_idx
                    for heading_idx, line_idx in cleaned_heading_line_indexes.items()
                    if line_idx == index
                ),
                None
            ),
            "block_index": cleaned_block_line_indexes.get(index),
            "block_signature": block_signatures.get(
                cleaned_block_line_indexes.get(index)
            )
        }
        for index, line in enumerate(cleaned_lines)
    ]

    return highlighted_lines


def get_h2_section_ranges(highlighted_lines):
    h2_lines = []

    for index, line in enumerate(highlighted_lines):
        block_index = line.get("block_index")

        if block_index is None:
            continue

        raw_html = line.get("raw", "") or ""

        if raw_html.lstrip().lower().startswith("<h2"):
            h2_lines.append(index)

    if not h2_lines:
        return []

    ranges = []

    for position, start_index in enumerate(h2_lines):
        end_index = (
            h2_lines[position + 1] - 1
            if position + 1 < len(h2_lines)
            else len(highlighted_lines) - 1
        )

        ranges.append({
            "section_index": position,
            "start_index": start_index,
            "end_index": end_index
        })

    return ranges


def get_line_index_for_block(highlighted_lines, selected_block_index):
    if selected_block_index is None:
        return None

    try:
        selected_block_index = int(selected_block_index)
    except (TypeError, ValueError):
        return None

    available = []

    for index, line in enumerate(highlighted_lines):
        block_index = line.get("block_index")

        if block_index is None:
            continue

        try:
            block_index = int(block_index)
        except (TypeError, ValueError):
            continue

        available.append((block_index, index))

        if block_index == selected_block_index:
            return index

    if not available:
        return None

    nearest_block_index, nearest_line_index = min(
        available,
        key=lambda item: abs(item[0] - selected_block_index)
    )

    return nearest_line_index


def get_h2_section_window_for_block(highlighted_lines, selected_block_index):
    total_lines = len(highlighted_lines)

    if total_lines <= LARGE_CODE_VIEW_LINE_THRESHOLD:
        return {
            "is_windowed": False,
            "start_index": 0,
            "end_index": total_lines - 1,
            "total_lines": total_lines,
            "reason": "small-file"
        }

    h2_ranges = get_h2_section_ranges(highlighted_lines)

    if not h2_ranges:
        return {
            "is_windowed": False,
            "start_index": 0,
            "end_index": total_lines - 1,
            "total_lines": total_lines,
            "reason": "no-h2-sections"
        }

    selected_line_index = get_line_index_for_block(
        highlighted_lines,
        selected_block_index
    )

    if selected_line_index is None:
        selected_line_index = 0

    current_section_position = 0

    for position, section_range in enumerate(h2_ranges):
        if section_range["start_index"] <= selected_line_index <= section_range["end_index"]:
            current_section_position = position
            break

    start_section_position = max(0, current_section_position - 1)
    end_section_position = min(len(h2_ranges) - 1, current_section_position + 1)

    start_index = h2_ranges[start_section_position]["start_index"]
    end_index = h2_ranges[end_section_position]["end_index"]

    return {
        "is_windowed": True,
        "start_index": start_index,
        "end_index": end_index,
        "total_lines": total_lines,
        "current_h2_section": current_section_position + 1,
        "start_h2_section": start_section_position + 1,
        "end_h2_section": end_section_position + 1,
        "total_h2_sections": len(h2_ranges),
        "reason": "large-file-h2-window"
    }


def get_cached_highlighted_code_lines(path, source_env, year, open_details_indexes=None):
    cache_key = get_code_view_cache_key(path, source_env)

    if cache_key in _CODE_VIEW_CACHE:
        return _CODE_VIEW_CACHE[cache_key]

    highlighted_lines = build_highlighted_code_lines(
        path,
        source_env,
        year,
        open_details_indexes=open_details_indexes
    )

    _CODE_VIEW_CACHE[cache_key] = highlighted_lines
    trim_code_view_cache()

    return highlighted_lines


def format_html_for_code_view(
    path,
    source_env,
    year,
    selected_block_index=None,
    open_details_indexes=None
):
    highlighted_lines = get_cached_highlighted_code_lines(
        path,
        source_env,
        year,
        open_details_indexes=open_details_indexes
    )

    code_window = get_h2_section_window_for_block(
        highlighted_lines,
        selected_block_index
    )

    windowed_lines = highlighted_lines[
        code_window["start_index"]:code_window["end_index"] + 1
    ]

    window_block_indexes = [
        line.get("block_index")
        for line in windowed_lines
        if line.get("block_index") is not None
    ]

    if window_block_indexes:
        code_window["start_block_index"] = min(window_block_indexes)
        code_window["end_block_index"] = max(window_block_indexes)
    else:
        code_window["start_block_index"] = None
        code_window["end_block_index"] = None

    return {
        "lines": windowed_lines,
        "window": code_window
    }