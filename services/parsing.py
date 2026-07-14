from bs4 import BeautifulSoup
import re

from services.sources import (
    get_html_dir,
    get_source_root,
    is_url_input_environment,
    path_is_within,
    safe_resolve,
)

def read_soup(filename, source_env, year):
    if is_url_input_environment(source_env):
        source_root = get_source_root(source_env, year)

        if not source_root:
            return None

        path = safe_resolve(source_root / filename)

        if not path_is_within(path, source_root):
            return None

        if not path.exists() or not path.is_file():
            return None

        html = path.read_text(encoding="utf-8", errors="ignore")
        return BeautifulSoup(html, "html.parser")

    source_root = get_source_root(source_env, year)

    if not source_root:
        return None

    path = safe_resolve(source_root / filename)

    if not path_is_within(path, source_root):
        return None

    if not path.exists() or not path.is_file():
        return None

    html = path.read_text(encoding="utf-8", errors="ignore")
    return BeautifulSoup(html, "html.parser")


def get_primary_content_containers(soup):
    content_areas = soup.select(".content-area")

    if content_areas:
        return content_areas, ".content-area"

    main = soup.find("main")

    if main:
        return [main], "main"

    return [], None


def get_primary_content_container(soup):
    containers, selector = get_primary_content_containers(soup)

    if not containers:
        return None, None

    if len(containers) == 1:
        return containers[0], selector

    wrapper = soup.new_tag("div")
    wrapper["class"] = "paralang-content-scope"

    for container in containers:
        wrapper.append(container.extract())

    return wrapper, selector


def get_content_area(filename, source_env, year):
    soup = read_soup(filename, source_env, year)

    if not soup:
        return None

    content_container, _ = get_primary_content_container_for_source(soup, source_env)

    if not content_container:
        return None

    return content_container


def get_headings(filename, source_env, year):
    content_area = get_content_area(filename, source_env, year)

    if not content_area:
        return []

    headings = []

    for index, heading in enumerate(content_area.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])):
        level = int(heading.name[1])
        text = " ".join(heading.get_text(" ", strip=True).split())

        if text:
            headings.append({
                "index": index,
                "level": level,
                "text": text,
                "element": heading,
                "section_count": 0
            })

    headings = get_heading_section_counts(content_area, headings)

    # Remove BeautifulSoup elements before sending to the template/JSON.
    for heading in headings:
        heading.pop("element", None)

    return headings


def mark_heading_section_count_mismatches(left_headings, right_headings):
    max_count = max(len(left_headings), len(right_headings))

    for index in range(max_count):
        left_heading = left_headings[index] if index < len(left_headings) else None
        right_heading = right_headings[index] if index < len(right_headings) else None

        if not left_heading or not right_heading:
            if left_heading:
                left_heading["section_count_mismatch"] = True

            if right_heading:
                right_heading["section_count_mismatch"] = True

            continue

        left_count = left_heading.get("section_count", 0)
        right_count = right_heading.get("section_count", 0)

        mismatch = left_count != right_count

        left_heading["section_count_mismatch"] = mismatch
        right_heading["section_count_mismatch"] = mismatch


def get_heading_section_counts(content_area, headings):
    comparable_selector = ",".join([
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p",
        "li",
        "dt", "dd",
        "tr",
        "figure",
        "img"
    ])

    comparable_elements = []

    for element in content_area.select(comparable_selector):
        tag = element.name.lower()

        if is_inside_closed_details(element):
            continue

        if element.find_parent("li") and tag != "li":
            continue
        
        if element.find_parent("dl") and tag not in {"dt", "dd"}:
            continue

        if element.find_parent("table") and tag != "tr":
            continue

        text = get_direct_text(element)
        is_visual = tag in {"figure", "img"}

        if not text and not is_visual:
            continue

        comparable_elements.append(element)

    heading_elements = [
        item["element"]
        for item in headings
    ]

    for heading_index, heading in enumerate(headings):
        heading_element = heading["element"]
        heading_level = heading["level"]

        count = 0
        started = False

        for element in comparable_elements:
            if element is heading_element:
                started = True
                continue

            if not started:
                continue

            if element.name and element.name.lower() in {"h1", "h2", "h3", "h4", "h5", "h6"}:
                next_level = int(element.name[1])

                if next_level <= heading_level:
                    break

            count += 1

        heading["section_count"] = count

    return headings


def summarize_table(table):
    rows = table.find_all("tr")
    row_count = len(rows)
    max_cols = 0
    th_count = len(table.find_all("th"))
    td_count = len(table.find_all("td"))

    for row in rows:
        cell_count = len(row.find_all(["th", "td"]))
        max_cols = max(max_cols, cell_count)

    return f"{row_count} rows, {max_cols} columns, {th_count} headers, {td_count} cells"


def summarize_list(list_element):
    direct_items = list_element.find_all("li", recursive=False)
    return f"{len(direct_items)} items"


def normalize_text(text):
    return " ".join((text or "").split())


def short_preview(text, limit=120):
    text = normalize_text(text)

    if len(text) <= limit:
        return text

    return text[:limit].rstrip() + "..."


def is_inside_closed_details(element):
    details_parent = element.find_parent("details")

    if not details_parent:
        return False

    return not details_parent.has_attr("open")


def get_direct_text(element):
    return normalize_text(element.get_text(" ", strip=True))


def get_block_signature(element):
    tag = element.name.lower()

    if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        return tag

    if tag == "tr":
        cell_count = len(element.find_all(["th", "td"], recursive=False))
        header_count = len(element.find_all("th", recursive=False))
        return f"tr:{cell_count}:{header_count}"

    if tag == "img":
        src = element.get("src", "")
        alt = element.get("alt", "")
        return f"img:{bool(src)}:{bool(alt)}"

    if tag == "figure":
        img_count = len(element.find_all("img"))
        caption_count = len(element.find_all("figcaption"))
        return f"figure:{img_count}:{caption_count}"

    return tag

def get_block_nav_signature(element):
    if not element:
        return ""

    tag = element.name.lower()

    if tag in {"figure", "img"}:
        src = element.get("src", "")

        if not src:
            img = element.find("img")
            src = img.get("src", "") if img else ""

        alt = element.get("alt", "")

        if not alt:
            img = element.find("img")
            alt = img.get("alt", "") if img else ""

        return f"{tag}|{src}|{alt}".strip().lower()

    text = element.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text)

    return f"{tag}|{text[:180]}".strip().lower()


def extract_comparable_blocks(filename, source_env, year):
    content_area = get_content_area(filename, source_env, year)

    if not content_area:
        return []

    selector = [
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p",
        "li",
        "dt", "dd",
        "tr",
        "figure",
        "img"
    ]

    blocks = []
    tag_counts = {}

    for element in content_area.select(",".join(selector)):
        tag = element.name.lower()

        if is_inside_closed_details(element):
            continue

        if element.find_parent("li") and tag != "li":
            continue
        
        if element.find_parent("dl") and tag not in {"dt", "dd"}:
            continue

        if element.find_parent("table") and tag != "tr":
            continue

        text = get_direct_text(element)
        is_visual = tag in {"figure", "img"}

        if not text and not is_visual:
            continue

        occurrence = tag_counts.get(tag, 0)
        tag_counts[tag] = occurrence + 1

        blocks.append({
            "index": len(blocks),
            "tag": tag,
            "signature": get_block_signature(element),
            "nav_signature": get_block_nav_signature(element),
            "text": text,
            "summary": short_preview(text),
            "occurrence": occurrence
        })

    return blocks


def get_primary_content_container_for_source(soup, source_env):
    if source_env == "canada-ca-url":
        main = soup.find("main")

        if main:
            return main, "main"

        body = soup.body

        if body:
            return body, "body"

    return get_primary_content_container(soup)

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
