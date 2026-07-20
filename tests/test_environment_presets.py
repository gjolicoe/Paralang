import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module
from services import sources


class EnvironmentPresetTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.preset_path = Path(self.temp_dir.name) / "environment-presets.json"
        self.path_patch = patch.object(sources, "ENVIRONMENT_PRESETS_PATH", self.preset_path)
        self.path_patch.start()
        sources.load_environment_presets()
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.path_patch.stop()
        sources.load_environment_presets()
        self.temp_dir.cleanup()

    def preset(self, **updates):
        value = {
            "id": "team-site",
            "label": "Team site",
            "group": "Communications",
            "root": str(Path(self.temp_dir.name).resolve()),
            "collection_mode": "direct",
            "content_selector": "main",
        }
        value.update(updates)
        return value

    def test_create_persists_and_registers_preset(self):
        response = self.client.post("/api/environment-presets", json=self.preset())
        self.assertEqual(response.status_code, 201)
        self.assertIn("team-site", sources.SOURCE_ENVIRONMENTS)
        self.assertTrue(self.preset_path.exists())
        self.assertTrue(response.get_json()["preset"]["include_root_html"])

    def test_duplicate_id_is_rejected(self):
        self.client.post("/api/environment-presets", json=self.preset())
        response = self.client.post("/api/environment-presets", json=self.preset(label="Duplicate"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.get_json()["error"])

    def test_delete_removes_custom_but_not_builtin(self):
        self.client.post("/api/environment-presets", json=self.preset())
        self.assertEqual(self.client.delete("/api/environment-presets/team-site").status_code, 200)
        self.assertNotIn("team-site", sources.SOURCE_ENVIRONMENTS)
        self.assertEqual(self.client.delete("/api/environment-presets/local-files").status_code, 404)

    def test_invalid_relative_root_is_rejected(self):
        response = self.client.post("/api/environment-presets", json=self.preset(root="relative/path"))
        self.assertEqual(response.status_code, 400)

    def test_multiple_additional_folders_are_discovered(self):
        root = Path(self.temp_dir.name)
        for folder, filename in [("news", "story-en.html"), ("campaign/pages", "launch-fr.html")]:
            target = root / "2026" / folder
            target.mkdir(parents=True)
            (target / filename).write_text("<main>Page</main>", encoding="utf-8")
        preset = self.preset(
            collection_mode="named-folders",
            include_root_html=False,
            additional_folders=["news", "campaign/pages"],
        )
        response = self.client.post("/api/environment-presets", json=preset)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(sources.get_available_years("team-site"), ["2026"])
        self.assertEqual(
            sources.get_html_files("team-site", "2026"),
            ["news/story-en.html", "campaign/pages/launch-fr.html"],
        )

    def test_additional_folder_cannot_escape_root(self):
        response = self.client.post(
            "/api/environment-presets",
            json=self.preset(additional_folders=["../outside"]),
        )
        self.assertEqual(response.status_code, 400)

    def test_environment_dropdown_uses_group_headers(self):
        self.client.post("/api/environment-presets", json=self.preset())
        (Path(self.temp_dir.name) / "sample-en.html").write_text("<main>Hello</main>", encoding="utf-8")
        response = self.client.get("/")
        self.assertIn(b'<optgroup label="Built-in environments">', response.data)
        self.assertIn(b'<optgroup label="Communications">', response.data)


if __name__ == "__main__":
    unittest.main()
