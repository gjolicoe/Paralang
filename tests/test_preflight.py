import unittest

from services.preflight import diff_comparable_blocks, parse_table_number


def row(index, cells):
    return {
        "index": index,
        "tag": "tr",
        "signature": f"tr:{len(cells)}:0",
        "text": " ".join(cells),
        "cells": cells,
    }


class TableNumberPreflightTests(unittest.TestCase):
    def test_parses_english_and_french_currency_formats(self):
        self.assertEqual(parse_table_number("$1,234.56", "en"), parse_table_number("1 234,56 $", "fr"))
        self.assertEqual(parse_table_number("($2,000)", "en"), parse_table_number("(2 000 $)", "fr"))

    def test_reports_cell_coordinates_for_numeric_mismatch(self):
        issues = diff_comparable_blocks(
            [row(0, ["Program", "$1,234.56"])],
            [row(0, ["Programme", "1 235,56 $"])],
        )

        mismatch = next(issue for issue in issues if issue["opcode"] == "table-number-mismatch")
        self.assertEqual(mismatch["left_cell_index"], 1)
        self.assertEqual(mismatch["right_cell_index"], 1)

    def test_equivalent_numbers_do_not_report_mismatch(self):
        issues = diff_comparable_blocks(
            [row(0, ["$1,234.56"])],
            [row(0, ["1 234,56 $"])],
        )
        self.assertFalse(any(issue["opcode"] == "table-number-mismatch" for issue in issues))


if __name__ == "__main__":
    unittest.main()
