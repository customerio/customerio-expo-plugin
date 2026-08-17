import json
import os
import plistlib
import subprocess
import tempfile
import unittest
from pathlib import Path


class ResolveSimulatorAppTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.private_settings = self.root / "private.json"
        self.sanitized_settings = self.root / "sanitized.json"
        self.build_start = self.root / "build-start"
        self.build_start.write_text("100\n", encoding="utf-8")
        self.script = Path(__file__).with_name("resolve_simulator_app.py")

    def create_app(self, *, executable=True, modified_at=101):
        app = self.root / "Build" / "Fixture.app"
        app.mkdir(parents=True)
        with (app / "Info.plist").open("wb") as plist_file:
            plistlib.dump({"CFBundleExecutable": "Fixture"}, plist_file)
        if executable:
            binary = app / "Fixture"
            binary.write_bytes(b"fixture")
            os.utime(binary, (modified_at, modified_at))
        return app

    def settings(self, app):
        return [
            {
                "target": "Fixture",
                "buildSettings": {
                    "CONFIGURATION": "Release",
                    "TARGET_BUILD_DIR": str(app.parent),
                    "WRAPPER_EXTENSION": "app",
                    "WRAPPER_NAME": app.name,
                    "PRIVATE_VALUE": "must-not-be-published",
                },
            }
        ]

    def run_script(self):
        return subprocess.run(
            [
                "python3",
                str(self.script),
                "--private-settings-json",
                str(self.private_settings),
                "--build-start-epoch",
                str(self.build_start),
                "--scheme",
                "Fixture",
                "--sanitized-settings-json",
                str(self.sanitized_settings),
            ],
            check=False,
            capture_output=True,
            text=True,
        )

    def test_resolves_fresh_app_and_sanitizes_settings(self):
        app = self.create_app()
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(app))
        sanitized = self.sanitized_settings.read_text(encoding="utf-8")
        self.assertNotIn("PRIVATE_VALUE", sanitized)
        self.assertNotIn("must-not-be-published", sanitized)

    def test_malformed_json_leaves_only_bounded_parse_metadata(self):
        self.private_settings.write_text('{"secret":"must-not-leak"', encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        diagnostic = json.loads(self.sanitized_settings.read_text(encoding="utf-8"))
        self.assertEqual(set(diagnostic), {"parse_error", "raw_bytes"})
        self.assertNotIn("must-not-leak", json.dumps(diagnostic))

    def test_invalid_epoch_is_classified(self):
        app = self.create_app()
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")
        self.build_start.write_text("", encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("could not read build start epoch", result.stderr)

    def test_rejection_reports_missing_executable(self):
        app = self.create_app(executable=False)
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing executable Fixture", result.stderr)


if __name__ == "__main__":
    unittest.main()
