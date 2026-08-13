import re

from services.parsing import (
    get_block_nav_signature,
    get_block_signature,
    get_comparable_elements,
    get_content_area,
    get_direct_text,
    short_preview,
)


REFERENCE_ATTRIBUTES = {
    "aria-activedescendant", "aria-controls", "aria-describedby",
    "aria-details", "aria-errormessage", "aria-flowto", "aria-labelledby",
    "aria-owns",
}
TRANSLATABLE_ATTRIBUTES = {
    "aria-label", "aria-description", "aria-placeholder",
    "aria-roledescription", "aria-valuetext",
}
COMPARABLE_ATTRIBUTES = {
    "role", "aria-atomic", "aria-autocomplete", "aria-busy", "aria-checked",
    "aria-colcount", "aria-colindex", "aria-colspan", "aria-current",
    "aria-disabled", "aria-dropeffect", "aria-expanded", "aria-grabbed",
    "aria-haspopup", "aria-hidden", "aria-invalid", "aria-keyshortcuts",
    "aria-level", "aria-live", "aria-modal", "aria-multiline",
    "aria-multiselectable", "aria-orientation", "aria-posinset", "aria-pressed",
    "aria-readonly", "aria-relevant", "aria-required",
    "aria-rowcount", "aria-rowindex", "aria-rowspan", "aria-selected",
    "aria-setsize", "aria-sort", "aria-valuemax", "aria-valuemin", "aria-valuenow",
}
BOOLEAN_ATTRIBUTES = {
    "aria-atomic", "aria-busy", "aria-disabled", "aria-expanded", "aria-hidden",
    "aria-modal", "aria-multiline", "aria-multiselectable", "aria-readonly",
    "aria-required", "aria-selected",
}
TRISTATE_ATTRIBUTES = {"aria-checked", "aria-pressed"}
ENUMERATED_VALUES = {
    "aria-autocomplete": {"inline", "list", "both", "none"},
    "aria-current": {"page", "step", "location", "date", "time", "true", "false"},
    "aria-haspopup": {"false", "true", "menu", "listbox", "tree", "grid", "dialog"},
    "aria-invalid": {"false", "true", "grammar", "spelling"},
    "aria-live": {"off", "polite", "assertive"},
    "aria-orientation": {"horizontal", "vertical", "undefined"},
    "aria-sort": {"ascending", "descending", "none", "other"},
}


def normalized_text(value):
    return " ".join((value or "").split())


def element_aria_attributes(element):
    return {
        name.casefold(): normalized_text(" ".join(value) if isinstance(value, list) else str(value))
        for name, value in element.attrs.items()
        if name.casefold() == "role" or name.casefold().startswith("aria-")
    }


def referenced_text(element, attribute):
    root = element
    while root.parent is not None:
        root = root.parent
    parts = []
    missing = []
    for target_id in element.get(attribute, "").split():
        target = root.find(id=target_id)
        if target:
            parts.append(target.get_text(" ", strip=True))
        else:
            missing.append(target_id)
    return normalized_text(" ".join(parts)), missing


def make_block(element, index, occurrence):
    text = get_direct_text(element)
    return {
        "index": index,
        "tag": element.name.lower(),
        "signature": get_block_signature(element),
        "nav_signature": get_block_nav_signature(element),
        "text": text,
        "summary": short_preview(text),
        "occurrence": occurrence,
    }


def aria_elements_by_block(filename, source_env, year):
    content = get_content_area(filename, source_env, year)
    if not content:
        return [], []

    comparable = get_comparable_elements(content)
    tag_counts = {}
    blocks = []
    groups = []
    block_index_by_id = {}
    for index, block_element in enumerate(comparable):
        tag = block_element.name.lower()
        occurrence = tag_counts.get(tag, 0)
        tag_counts[tag] = occurrence + 1
        block = make_block(block_element, index, occurrence)
        blocks.append(block)
        groups.append([])
        block_index_by_id[id(block_element)] = index

    for candidate in content.find_all(True):
        if not element_aria_attributes(candidate):
            continue
        target_index = block_index_by_id.get(id(candidate))
        if target_index is None:
            for parent in candidate.parents:
                target_index = block_index_by_id.get(id(parent))
                if target_index is not None:
                    break
        if target_index is None:
            previous = candidate.find_previous(lambda tag: id(tag) in block_index_by_id)
            target_index = block_index_by_id.get(id(previous)) if previous else None
        if target_index is None and blocks:
            target_index = 0
        if target_index is not None:
            groups[target_index].append((candidate, blocks[target_index]))
    return blocks, groups


def element_key(element, counters):
    tag = element.name.lower()
    key = tag
    occurrence = counters.get(key, 0)
    counters[key] = occurrence + 1
    return tag, occurrence


def local_aria_issues(groups, side):
    issues = []
    for group in groups:
        for element, block in group:
            attributes = element_aria_attributes(element)
            for attribute in REFERENCE_ATTRIBUTES & attributes.keys():
                _, missing = referenced_text(element, attribute)
                if missing:
                    issues.append({
                        "opcode": "aria-broken-reference",
                        "severity": "warning",
                        "label": "Broken ARIA reference",
                        "detail": f"Location: the {side} page. {attribute} references missing IDs: {', '.join(missing)}.",
                        "left": block if side == "English" else None,
                        "right": block if side == "French" else None,
                    })

            for attribute, value in attributes.items():
                allowed = None
                if attribute in BOOLEAN_ATTRIBUTES:
                    allowed = {"true", "false"}
                elif attribute in TRISTATE_ATTRIBUTES:
                    allowed = {"true", "false", "mixed", "undefined"}
                elif attribute in ENUMERATED_VALUES:
                    allowed = ENUMERATED_VALUES[attribute]
                if allowed is not None and value.casefold() not in allowed:
                    issues.append({
                        "opcode": "aria-invalid-value",
                        "severity": "warning",
                        "label": "Invalid ARIA attribute value",
                        "detail": f'Location: the {side} page. {attribute} has invalid value "{value}".',
                        "left": block if side == "English" else None,
                        "right": block if side == "French" else None,
                    })
    return issues


def compare_aria(left_file, right_file, source_env, year):
    """Compare ARIA markup in corresponding English and French content blocks."""
    _, left_groups = aria_elements_by_block(left_file, source_env, year)
    _, right_groups = aria_elements_by_block(right_file, source_env, year)
    issues = local_aria_issues(left_groups, "English") + local_aria_issues(right_groups, "French")

    for block_index in range(max(len(left_groups), len(right_groups))):
        left_group = left_groups[block_index] if block_index < len(left_groups) else []
        right_group = right_groups[block_index] if block_index < len(right_groups) else []
        left_counters = {}
        right_counters = {}
        left_by_key = {element_key(element, left_counters): (element, block) for element, block in left_group}
        right_by_key = {element_key(element, right_counters): (element, block) for element, block in right_group}

        for key in sorted(left_by_key.keys() | right_by_key.keys()):
            left_pair = left_by_key.get(key)
            right_pair = right_by_key.get(key)
            left_element, left_block = left_pair if left_pair else (None, None)
            right_element, right_block = right_pair if right_pair else (None, None)
            left_attrs = element_aria_attributes(left_element) if left_element else {}
            right_attrs = element_aria_attributes(right_element) if right_element else {}

            for attribute in sorted(left_attrs.keys() | right_attrs.keys()):
                left_value = left_attrs.get(attribute)
                right_value = right_attrs.get(attribute)
                if left_value is None or right_value is None:
                    location = "English" if left_value is not None else "French"
                    issues.append({
                        "opcode": "aria-attribute-presence-mismatch",
                        "severity": "warning",
                        "label": "ARIA attribute missing on one page",
                        "detail": f"{attribute} is present only on the {location} page.",
                        "left": left_block,
                        "right": right_block,
                    })
                    continue

                if attribute in REFERENCE_ATTRIBUTES:
                    # Generated IDs may differ. Reference validity is checked locally;
                    # translated referenced text is intentionally allowed to differ.
                    continue
                if attribute in TRANSLATABLE_ATTRIBUTES:
                    if (
                        left_value == right_value
                        and len(left_value) >= 4
                        and re.search(r"[A-Za-zÀ-ÿ]", left_value)
                    ):
                        issues.append({
                            "opcode": "aria-possibly-untranslated",
                            "severity": "notice",
                            "label": "Possibly untranslated ARIA text",
                            "detail": f'Both pages use {attribute}="{left_value}".',
                            "left": left_block,
                            "right": right_block,
                        })
                    continue
                if attribute in COMPARABLE_ATTRIBUTES and left_value.casefold() != right_value.casefold():
                    issues.append({
                        "opcode": "aria-value-mismatch",
                        "severity": "warning",
                        "label": "ARIA attribute mismatch",
                        "detail": f'{attribute} is "{left_value}" in English and "{right_value}" in French.',
                        "left": left_block,
                        "right": right_block,
                    })

    return issues
