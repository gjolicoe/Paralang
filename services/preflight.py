from difflib import SequenceMatcher

def comparable_token(block):
    if not block:
        return ""

    return block["signature"]


def classify_preflight_issue(left, right):
    if left is None:
        return {
            "severity": "warning",
            "label": "Extra block on right",
            "detail": "The French page has a comparable block that does not align with the English page."
        }

    if right is None:
        return {
            "severity": "warning",
            "label": "Extra block on left",
            "detail": "The English page has a comparable block that does not align with the French page."
        }

    if left["signature"] != right["signature"]:
        return {
            "severity": "warning",
            "label": "Structure mismatch",
            "detail": f"Left is {left['signature']}; right is {right['signature']}."
        }

    left_text = left["text"]
    right_text = right["text"]

    if left_text and right_text and left_text == right_text and len(left_text) > 20:
        return {
            "severity": "notice",
            "label": "Identical text",
            "detail": "Both sides contain identical text. This may be valid, but it can also indicate untranslated content."
        }

    left_len = len(left_text)
    right_len = len(right_text)

    if left_len > 80 and right_len > 0:
        ratio = right_len / left_len

        if ratio < 0.45 or ratio > 2.2:
            return {
                "severity": "notice",
                "label": "Length mismatch",
                "detail": f"Text length differs significantly: left {left_len} characters, right {right_len} characters."
            }

    return {
        "severity": "notice",
        "label": "Possible mismatch",
        "detail": "These blocks were aligned by the diff engine but may need review."
    }


def split_into_sections(blocks):
    sections = []
    current_section = {
        "heading": None,
        "blocks": []
    }

    for block in blocks:
        tag = block["tag"]

        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            if current_section["blocks"] or current_section["heading"]:
                sections.append(current_section)

            current_section = {
                "heading": block,
                "blocks": []
            }
            continue

        current_section["blocks"].append(block)

    if current_section["blocks"] or current_section["heading"]:
        sections.append(current_section)

    return sections


def diff_comparable_blocks(left_blocks, right_blocks):
    left_sections = split_into_sections(left_blocks)
    right_sections = split_into_sections(right_blocks)

    max_sections = max(len(left_sections), len(right_sections))
    issues = []

    for i in range(max_sections):
        left_section = left_sections[i] if i < len(left_sections) else None
        right_section = right_sections[i] if i < len(right_sections) else None

        if not left_section or not right_section:
            issues.append({
                "index": len(issues) + 1,
                "opcode": "section-missing",
                "left": left_section["heading"] if left_section else None,
                "right": right_section["heading"] if right_section else None,
                "severity": "warning",
                "label": "Missing section",
                "detail": "A section exists on one side but not the other."
            })
            continue

        left_heading = left_section["heading"]
        right_heading = right_section["heading"]

        if left_heading and right_heading:
            if left_heading["tag"] != right_heading["tag"]:
                issues.append({
                    "index": len(issues) + 1,
                    "opcode": "heading-level-mismatch",
                    "left": left_heading,
                    "right": right_heading,
                    "severity": "warning",
                    "label": "Heading level mismatch",
                    "detail": f"Left heading is {left_heading['tag'].upper()}; right heading is {right_heading['tag'].upper()}."
                })

        left_tokens = [comparable_token(b) for b in left_section["blocks"]]
        right_tokens = [comparable_token(b) for b in right_section["blocks"]]

        matcher = SequenceMatcher(None, left_tokens, right_tokens, autojunk=False)

        for opcode, i1, i2, j1, j2 in matcher.get_opcodes():
            if opcode == "equal":
                continue

            left_slice = left_section["blocks"][i1:i2]
            right_slice = right_section["blocks"][j1:j2]
            max_len = max(len(left_slice), len(right_slice))

            for offset in range(max_len):
                left = left_slice[offset] if offset < len(left_slice) else None
                right = right_slice[offset] if offset < len(right_slice) else None

                issue_info = classify_preflight_issue(left, right)

                issues.append({
                    "index": len(issues) + 1,
                    "opcode": opcode,
                    "left": left,
                    "right": right,
                    **issue_info
                })

    return issues
