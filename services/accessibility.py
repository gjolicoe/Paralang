import re
from pathlib import PurePosixPath
from urllib.parse import urlparse

from services.parsing import (
    get_block_nav_signature,
    get_block_signature,
    get_comparable_elements,
    get_content_area,
    get_direct_text,
    short_preview,
)


VALID_SCOPES = {"row", "col", "rowgroup", "colgroup"}
GENERIC_ALT_TEXT = {
    "image", "photo", "picture", "graphic", "icon",
    "image de", "photo de", "illustration", "icône", "icone",
}


def block_for_element(element, comparable_elements, block_by_id):
    current = element
    while current is not None:
        block = block_by_id.get(id(current))
        if block:
            return block
        current = getattr(current, "parent", None)

    # Standalone interactive elements are uncommon in content, but attaching
    # them to the closest preceding block still makes the issue navigable.
    previous = element.find_previous(lambda tag: id(tag) in block_by_id)
    if previous:
        return block_by_id[id(previous)]
    return block_by_id.get(id(comparable_elements[0])) if comparable_elements else None


def accessible_name(element):
    aria_label = " ".join(element.get("aria-label", "").split())
    if aria_label:
        return aria_label

    labelledby = element.get("aria-labelledby", "").split()
    if labelledby:
        root = element
        while root.parent is not None:
            root = root.parent
        parts = []
        for target_id in labelledby:
            target = root.find(id=target_id)
            if target:
                parts.append(target.get_text(" ", strip=True))
        name = " ".join(" ".join(parts).split())
        if name:
            return name

    parts = []
    for child in element.descendants:
        if getattr(child, "name", None) == "img":
            parts.append(child.get("alt", ""))
        elif getattr(child, "name", None) is None:
            parts.append(str(child))
    return " ".join(" ".join(parts).split())


def looks_like_filename_or_url(value):
    value = value.strip()
    if re.match(r"^(?:https?:)?//", value, flags=re.IGNORECASE):
        return True
    path = urlparse(value).path
    name = PurePosixPath(path.replace("\\", "/")).name
    return bool(name and re.search(r"\.(?:avif|gif|jpe?g|png|svg|webp)$", name, re.IGNORECASE))


def is_complex_table(table):
    def span_value(header, attribute):
        try:
            return int(header.get(attribute, 1) or 1)
        except (TypeError, ValueError):
            # Malformed spans still make the table unsafe to treat as simple.
            return 2

    rows = table.find_all("tr")
    header_rows = sum(bool(row.find("th")) for row in rows)
    headers = table.find_all("th")
    has_spans = any(
        span_value(header, "rowspan") > 1
        or span_value(header, "colspan") > 1
        for header in headers
    )
    has_row_headers = any(
        row.find(["th", "td"], recursive=False)
        and row.find(["th", "td"], recursive=False).name == "th"
        for row in rows[1:]
    )
    has_column_headers = bool(rows and rows[0].find("th"))
    return header_rows > 1 or has_spans or (has_row_headers and has_column_headers)


def scan_accessibility(filename, source_env, year):
    content = get_content_area(filename, source_env, year)
    if not content:
        return []

    comparable_elements = get_comparable_elements(content)
    block_by_id = {}
    tag_counts = {}
    for index, element in enumerate(comparable_elements):
        tag = element.name.lower()
        occurrence = tag_counts.get(tag, 0)
        tag_counts[tag] = occurrence + 1
        text = get_direct_text(element)
        block_by_id[id(element)] = {
            "index": index,
            "tag": tag,
            "signature": get_block_signature(element),
            "nav_signature": get_block_nav_signature(element),
            "text": text,
            "summary": short_preview(text),
            "occurrence": occurrence,
        }

    issues = []

    def add(element, opcode, severity, label, detail):
        block = block_for_element(element, comparable_elements, block_by_id)
        if block:
            issues.append({
                "opcode": opcode,
                "severity": severity,
                "label": label,
                "detail": detail,
                "target": block,
            })

    for image in content.find_all("img"):
        if not image.has_attr("alt"):
            add(image, "image-missing-alt", "warning", "Image missing alt text",
                "The image has no alt attribute. Use descriptive alt text or alt=\"\" for a decorative image.")
            continue
        alt = " ".join(image.get("alt", "").split())
        if not alt:
            continue
        normalized = alt.casefold().strip(" .:;!-")
        if looks_like_filename_or_url(alt):
            add(image, "image-filename-alt", "warning", "Suspicious image alt text",
                f'The image alt text appears to be a filename or URL: "{alt}".')
        elif normalized in GENERIC_ALT_TEXT:
            add(image, "image-generic-alt", "notice", "Generic image alt text",
                f'The image alt text may not describe its purpose: "{alt}".')
        elif re.match(r"^(?:image|photo|picture)\s+of\b", normalized):
            add(image, "image-redundant-alt", "notice", "Possibly redundant image alt text",
                f'Consider describing the image without introductory wording: "{alt}".')
        elif len(alt) > 250:
            add(image, "image-long-alt", "notice", "Long image alt text",
                f"The image alt text is {len(alt)} characters long; consider a concise alt and a nearby long description.")

    for link in content.find_all("a", href=True):
        if not accessible_name(link):
            add(link, "link-missing-name", "warning", "Link has no accessible name",
                "The link has no text, labelled name, or non-empty image alt text.")

    previous_level = None
    for heading in content.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        level = int(heading.name[1])
        if not get_direct_text(heading):
            add(heading, "heading-empty", "warning", "Empty heading",
                f"The {heading.name.upper()} does not contain readable text.")
        if previous_level is not None and level > previous_level + 1:
            add(heading, "heading-level-skipped", "notice", "Skipped heading level",
                f"Heading order moves from H{previous_level} to H{level}.")
        previous_level = level

    for table in content.find_all("table"):
        headers = table.find_all("th")
        if not headers:
            add(table, "table-no-headers", "warning", "Table has no header cells",
                "The table contains data cells but no TH elements.")
            continue

        ids = {}
        for header in headers:
            if header.get("id"):
                ids[header["id"]] = ids.get(header["id"], 0) + 1
            scope = header.get("scope")
            if scope and scope.casefold() not in VALID_SCOPES:
                add(header, "table-invalid-scope", "warning", "Invalid table header scope",
                    f'The header scope value "{scope}" is not valid.')

        duplicate_ids = {header_id for header_id, count in ids.items() if count > 1}
        for cell in table.find_all(["td", "th"]):
            references = cell.get("headers", [])
            if isinstance(references, str):
                references = references.split()
            missing = [reference for reference in references if reference not in ids]
            ambiguous = [reference for reference in references if reference in duplicate_ids]
            if missing:
                add(cell, "table-missing-header-reference", "warning", "Broken table header reference",
                    "The headers attribute references missing IDs: " + ", ".join(missing) + ".")
            if ambiguous:
                add(cell, "table-duplicate-header-id", "warning", "Ambiguous table header reference",
                    "The headers attribute references duplicate IDs: " + ", ".join(ambiguous) + ".")

        if is_complex_table(table):
            referenced_ids = {
                reference
                for cell in table.find_all(["td", "th"])
                for reference in (
                    cell.get("headers", []).split()
                    if isinstance(cell.get("headers", []), str)
                    else cell.get("headers", [])
                )
            }
            unscoped = [
                header for header in headers
                if not header.get("scope") and header.get("id") not in referenced_ids
            ]
            if unscoped:
                add(unscoped[0], "table-complex-unscoped-header", "notice",
                    "Complex table header needs association",
                    f"{len(unscoped)} header cell(s) have neither scope nor an ID used by a headers attribute.")

    return issues
