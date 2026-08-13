from difflib import SequenceMatcher
from decimal import Decimal, InvalidOperation
import math
import re


def parse_table_number(text, language):
    """Return a locale-aware Decimal when the entire cell is a number/currency."""
    value = (text or "").strip().replace("\u00a0", " ").replace("\u202f", " ")
    if not value:
        return None

    negative = value.startswith("(") and value.endswith(")")
    if negative:
        value = value[1:-1].strip()

    # Permit currency markers, signs, whitespace and locale separators only.
    value = re.sub(r"(?:CAD|USD|EUR|CA|US)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[$€£]", "", value).strip()
    if not re.fullmatch(r"[+-]?[\d\s.,']+", value):
        return None

    value = value.replace(" ", "").replace("'", "")
    if language == "fr":
        value = value.replace(".", "").replace(",", ".")
    else:
        value = value.replace(",", "")

    try:
        number = Decimal(value)
        return -number if negative else number
    except InvalidOperation:
        return None


def numeric_cell_mismatch_issues(left, right):
    if not left or not right or left.get("tag") != "tr" or right.get("tag") != "tr":
        return []

    issues = []
    for cell_index, (left_text, right_text) in enumerate(
        zip(left.get("cells", []), right.get("cells", []))
    ):
        left_number = parse_table_number(left_text, "en")
        right_number = parse_table_number(right_text, "fr")
        if left_number is None or right_number is None or left_number == right_number:
            continue

        issues.append({
            "opcode": "table-number-mismatch",
            "left": left,
            "right": right,
            "left_cell_index": cell_index,
            "right_cell_index": cell_index,
            "severity": "warning",
            "label": "Table number mismatch",
            "detail": f"Table values differ: English {left_text}; French {right_text}."
        })

    return issues


def numeric_alignment_token(block, language):
    if block.get("tag") != "tr":
        return block.get("signature", "")

    numbers = []
    for cell_index, cell in enumerate(block.get("cells", [])):
        number = parse_table_number(cell, language)
        if number is not None:
            numbers.append((cell_index, str(number.normalize())))

    # Matching values are much stronger row anchors than repeated structural
    # signatures, while nonnumeric/header rows retain normal structure tokens.
    return ("tr-numbers", tuple(numbers)) if numbers else block.get("signature", "")


def diff_table_numbers(left_blocks, right_blocks):
    """Align numeric rows by their locale-normalized values and compare them."""
    issues = []
    left_sections = split_into_sections(left_blocks)
    right_sections = split_into_sections(right_blocks)

    for section_index in range(min(len(left_sections), len(right_sections))):
        left = left_sections[section_index]["blocks"]
        right = right_sections[section_index]["blocks"]
        matcher = SequenceMatcher(
            None,
            [numeric_alignment_token(block, "en") for block in left],
            [numeric_alignment_token(block, "fr") for block in right],
            autojunk=False,
        )

        for opcode, i1, i2, j1, j2 in matcher.get_opcodes():
            if opcode not in {"equal", "replace"}:
                continue

            for left_block, right_block in zip(left[i1:i2], right[j1:j2]):
                issues.extend(numeric_cell_mismatch_issues(left_block, right_block))

    return issues

def comparable_token(block):
    if not block:
        return ""

    return block["signature"]


def paragraph_match_cost(left, right):
    """Return a language-agnostic cost for pairing two paragraph blocks."""
    left_length = max(1, len(left.get("text", "")))
    right_length = max(1, len(right.get("text", "")))
    length_cost = min(1.4, abs(math.log(left_length / right_length)))

    # Numbers survive translation and are especially useful for captions and
    # table titles (years, table numbers, percentages, and dollar amounts).
    left_numbers = set(re.findall(r"\d+(?:[.,]\d+)?", left.get("text", "")))
    right_numbers = set(re.findall(r"\d+(?:[.,]\d+)?", right.get("text", "")))
    if left_numbers and right_numbers:
        if left_numbers == right_numbers:
            length_cost *= 0.45
        elif left_numbers.isdisjoint(right_numbers):
            length_cost += 0.45

    return min(1.7, length_cost)


def block_match_cost(left, right):
    if left.get("signature") != right.get("signature"):
        return 1.35
    if left.get("tag") == "p":
        return paragraph_match_cost(left, right)
    return 0.0


def align_comparable_blocks(left_blocks, right_blocks):
    """Globally align blocks, using paragraph length to place insertions."""
    gap_cost = 0.8
    left_count = len(left_blocks)
    right_count = len(right_blocks)
    costs = [[0.0] * (right_count + 1) for _ in range(left_count + 1)]
    moves = [[None] * (right_count + 1) for _ in range(left_count + 1)]

    for i in range(1, left_count + 1):
        costs[i][0] = i * gap_cost
        moves[i][0] = "delete"
    for j in range(1, right_count + 1):
        costs[0][j] = j * gap_cost
        moves[0][j] = "insert"

    for i in range(1, left_count + 1):
        for j in range(1, right_count + 1):
            candidates = [
                (costs[i - 1][j - 1] + block_match_cost(
                    left_blocks[i - 1], right_blocks[j - 1]
                ), "match"),
                (costs[i - 1][j] + gap_cost, "delete"),
                (costs[i][j - 1] + gap_cost, "insert"),
            ]
            # Prefer a real pairing on exact ties; length differences still
            # decide where a paragraph gap belongs when one side has an extra.
            costs[i][j], moves[i][j] = min(
                candidates,
                key=lambda candidate: (candidate[0], candidate[1] != "match")
            )

    alignment = []
    i, j = left_count, right_count
    while i or j:
        move = moves[i][j]
        if move == "match":
            alignment.append((left_blocks[i - 1], right_blocks[j - 1]))
            i -= 1
            j -= 1
        elif move == "delete":
            alignment.append((left_blocks[i - 1], None))
            i -= 1
        else:
            alignment.append((None, right_blocks[j - 1]))
            j -= 1

    alignment.reverse()
    return alignment


def get_section_block_range(section):
    blocks = section.get("blocks", []) if section else []
    if not blocks:
        heading = section.get("heading") if section else None
        index = heading.get("index") if heading else None
        return index, index
    return blocks[0].get("index"), blocks[-1].get("index")


def paragraph_gap_confidence(alignment, position):
    """Classify whether the unmatched paragraph is distinct from its peers."""
    left, right = alignment[position]
    extra = left or right
    if not extra or extra.get("tag") != "p":
        return "high"

    def is_paragraph_pair(pair):
        present = [block for block in pair if block is not None]
        return bool(present) and all(block.get("tag") == "p" for block in present)

    run_start = position
    run_end = position
    while run_start > 0 and is_paragraph_pair(alignment[run_start - 1]):
        run_start -= 1
    while run_end + 1 < len(alignment) and is_paragraph_pair(alignment[run_end + 1]):
        run_end += 1

    paragraph_run = alignment[run_start:run_end + 1]
    left_count = sum(left_block is not None for left_block, _ in paragraph_run)
    right_count = sum(right_block is not None for _, right_block in paragraph_run)
    gap_count = sum(
        left_block is None or right_block is None
        for left_block, right_block in paragraph_run
    )

    # One paragraph split into several (commonly chart footnotes separated by
    # <br> on one page and <p> on the other) is a grouping ambiguity, not
    # evidence that any individual paragraph is extra.
    if gap_count > 1 or min(left_count, right_count) == 1:
        return "low"

    neighboring_pairs = []
    for distance in range(1, 4):
        for nearby_position in (position - distance, position + distance):
            if not 0 <= nearby_position < len(alignment):
                continue
            nearby_left, nearby_right = alignment[nearby_position]
            if (nearby_left and nearby_right
                    and nearby_left.get("tag") == "p"
                    and nearby_right.get("tag") == "p"):
                neighboring_pairs.append((nearby_left, nearby_right))

    if not neighboring_pairs:
        return "low"

    extra_length = max(1, len(extra.get("text", "")))
    plausible_matches = []
    for nearby_left, nearby_right in neighboring_pairs:
        counterpart = nearby_right if left else nearby_left
        ratio_cost = abs(math.log(
            extra_length / max(1, len(counterpart.get("text", "")))
        ))
        plausible_matches.append(ratio_cost)

    # A large difference from every nearby counterpart means the gap choice
    # is stable. Similar-length repeated paragraphs remain deliberately soft.
    return "high" if min(plausible_matches) >= 0.45 else "low"


def get_ambiguous_paragraph_range(alignment, position, side):
    """Return the local paragraph run around an uncertain alignment gap."""
    start = position
    end = position

    def is_paragraph_pair(pair):
        present = [block for block in pair if block is not None]
        return bool(present) and all(block.get("tag") == "p" for block in present)

    while start > 0 and is_paragraph_pair(alignment[start - 1]):
        start -= 1
    while end + 1 < len(alignment) and is_paragraph_pair(alignment[end + 1]):
        end += 1

    side_offset = 0 if side == "left" else 1
    indexes = [
        pair[side_offset].get("index")
        for pair in alignment[start:end + 1]
        if pair[side_offset] is not None
    ]
    indexes = [index for index in indexes if index is not None]
    if not indexes:
        return None, None
    return min(indexes), max(indexes)


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

    for numeric_issue in diff_table_numbers(left_blocks, right_blocks):
        issues.append({
            "index": len(issues) + 1,
            **numeric_issue
        })

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

        alignment = align_comparable_blocks(
            left_section["blocks"], right_section["blocks"]
        )
        left_range = get_section_block_range(left_section)
        right_range = get_section_block_range(right_section)

        for position, (left, right) in enumerate(alignment):
            if left and right and left["signature"] == right["signature"]:
                continue

            issue_info = classify_preflight_issue(left, right)
            confidence = paragraph_gap_confidence(alignment, position)
            issue_left_range = left_range
            issue_right_range = right_range
            if confidence == "low":
                issue_left_range = get_ambiguous_paragraph_range(
                    alignment, position, "left"
                )
                issue_right_range = get_ambiguous_paragraph_range(
                    alignment, position, "right"
                )
            opcode = "delete" if right is None else (
                "insert" if left is None else "replace"
            )

            issues.append({
                "index": len(issues) + 1,
                "opcode": opcode,
                "left": left,
                "right": right,
                "alignment_confidence": confidence,
                "left_section_start_index": issue_left_range[0],
                "left_section_end_index": issue_left_range[1],
                "right_section_start_index": issue_right_range[0],
                "right_section_end_index": issue_right_range[1],
                **issue_info
            })

    return issues
