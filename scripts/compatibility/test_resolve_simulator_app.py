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

    def create_app(self, *, name="Fixture", executable=True, modified_at=101):
        app = self.root / "Build" / f"{name}.app"
        app.mkdir(parents=True)
        with (app / "Info.plist").open("wb") as plist_file:
            plistlib.dump({"CFBundleExecutable": name}, plist_file)
        if executable:
            binary = app / name
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

    def test_resolves_settings_after_xcodebuild_stdout_preamble(self):
        app = self.create_app()
        self.private_settings.write_text(
            "2026-08-17 07:20:00.123 xcodebuild[1234:5678] warning: diagnostic preamble\n"
            + json.dumps(self.settings(app))
            + "\nxcodebuild: warning: diagnostic trailer\n",
            encoding="utf-8",
        )

        result = self.run_script()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(app))
        sanitized = self.sanitized_settings.read_text(encoding="utf-8")
        self.assertNotIn("diagnostic preamble", sanitized)

    def test_malformed_json_leaves_only_bounded_parse_metadata(self):
        self.private_settings.write_text('{"secret":"must-not-leak"', encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        diagnostic = json.loads(self.sanitized_settings.read_text(encoding="utf-8"))
        self.assertEqual(set(diagnostic), {"parse_error", "raw_bytes"})
        self.assertNotIn("must-not-leak", json.dumps(diagnostic))

    def test_wrong_shaped_json_leaves_only_bounded_parse_metadata(self):
        self.private_settings.write_text(
            json.dumps({"secret": "must-not-leak"}),
            encoding="utf-8",
        )

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

    def test_rejection_reports_missing_info_plist(self):
        app = self.create_app()
        (app / "Info.plist").unlink()
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing Info.plist", result.stderr)

    def test_rejection_reports_unreadable_info_plist(self):
        app = self.create_app()
        (app / "Info.plist").write_bytes(b"not a plist")
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unreadable Info.plist", result.stderr)

    def test_rejection_reports_truncated_xml_info_plist(self):
        app = self.create_app()
        (app / "Info.plist").write_bytes(b'<?xml version="1.0"?><plist')
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unreadable Info.plist", result.stderr)

    def test_rejection_reports_corrupt_binary_info_plist(self):
        app = self.create_app()
        (app / "Info.plist").write_bytes(b"bplist00" + b"\0" * 32)
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unreadable Info.plist", result.stderr)

    def test_rejection_reports_missing_bundle_executable(self):
        app = self.create_app()
        with (app / "Info.plist").open("wb") as plist_file:
            plistlib.dump({}, plist_file)
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing CFBundleExecutable", result.stderr)

    def test_rejects_stale_executable(self):
        app = self.create_app(modified_at=99)
        self.private_settings.write_text(json.dumps(self.settings(app)), encoding="utf-8")

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stale executable", result.stderr)

    def test_rejects_multiple_fresh_release_apps(self):
        first_app = self.create_app(name="FixtureOne")
        second_app = self.create_app(name="FixtureTwo")
        self.private_settings.write_text(
            json.dumps(self.settings(first_app) + self.settings(second_app)),
            encoding="utf-8",
        )

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected one current built simulator app", result.stderr)
        self.assertIn(str(first_app), result.stderr)
        self.assertIn(str(second_app), result.stderr)

    def test_reports_filtered_debug_and_extension_targets(self):
        app = self.create_app()
        debug_settings = self.settings(app)[0]
        debug_settings["target"] = "DebugApp"
        debug_settings["buildSettings"]["CONFIGURATION"] = "Debug"
        extension_settings = self.settings(app)[0]
        extension_settings["target"] = "NotificationExtension"
        extension_settings["buildSettings"]["WRAPPER_EXTENSION"] = "appex"
        self.private_settings.write_text(
            json.dumps([debug_settings, extension_settings]),
            encoding="utf-8",
        )

        result = self.run_script()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DebugApp: configuration=Debug wrapper=app", result.stderr)
        self.assertIn(
            "NotificationExtension: configuration=Release wrapper=appex",
            result.stderr,
        )


if __name__ == "__main__":
    unittest.main()
