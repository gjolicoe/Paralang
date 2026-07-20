import unittest

from bs4 import BeautifulSoup

from services.parsing import get_primary_content_container_for_source


class PrimaryContentContainerTests(unittest.TestCase):
    def test_prepends_document_h1_outside_content_area(self):
        soup = BeautifulSoup(
            "<html><body><header><h1>Page title</h1></header>"
            "<div class='content-area'><p>Content</p></div></body></html>",
            "html.parser",
        )

        container, selector = get_primary_content_container_for_source(
            soup, "pasted-html"
        )

        self.assertEqual(selector, ".content-area")
        self.assertEqual([tag.name for tag in container.find_all(recursive=False)], ["h1", "p"])
        self.assertEqual(container.h1.get_text(strip=True), "Page title")

    def test_does_not_duplicate_h1_already_in_content_area(self):
        soup = BeautifulSoup(
            "<div class='content-area'><h1>Page title</h1><p>Content</p></div>",
            "html.parser",
        )

        container, _ = get_primary_content_container_for_source(soup, "pasted-html")

        self.assertEqual(len(container.find_all("h1")), 1)
        self.assertIs(container.find("h1"), soup.find("h1"))

    def test_body_fallback_keeps_existing_h1_in_place(self):
        soup = BeautifulSoup(
            "<html><body><h1>Page title</h1><p>Content</p></body></html>",
            "html.parser",
        )

        container, selector = get_primary_content_container_for_source(
            soup, "canada-ca-url"
        )

        self.assertEqual(selector, "body")
        self.assertEqual(len(container.find_all("h1")), 1)


if __name__ == "__main__":
    unittest.main()
