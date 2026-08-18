#!/usr/bin/env python3
"""Focused mutation tests for generated Expo dependency provenance."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate-expo-runtime-capture.py")
SPEC = importlib.util.spec_from_file_location("expo_runtime_capture", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


NODE_VERSIONS = {
    "expo": "57.0.12",
    "expo-modules-core": "57.0.10",
    "expo-notifications": "57.0.10",
    "react-native": "0.86.2",
    "customerio-reactnative": "6.6.2",
    "customerio-expo-plugin": "3.7.1",
}


class ExpoRuntimeDependencyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        root = Path(self.temporary.name)
        self.source = root / "source"
        self.app = root / "app"
        (self.source / "__tests__/fixtures/ios/expo57-generated").mkdir(parents=True)
        (self.source / "lifecycle-fixture/scripts").mkdir(parents=True)
        (self.app / "ios").mkdir(parents=True)
        self.write_json(self.source / "package.json", {"version": "3.7.1"})
        self.write_json(
            self.source / "__tests__/fixtures/ios/expo57-generated/PROVENANCE.json",
            {"packageVersions": NODE_VERSIONS},
        )
        self.write_json(
            self.source / "lifecycle-fixture/scripts/expo57-source-patch.lock.json",
            {
                "customerioExpoPluginVersion": "3.7.1",
                "customerioIOSVersion": "4.7.2",
                "firebaseIOSMessagingVersion": "12.17.0",
                "files": {
                    "customerioNotificationDelegate": {
                        "preSha256": [hashlib.sha256(b"original delegate").hexdigest()]
                    }
                },
            },
        )
        delegate = self.app / MODULE.CUSTOMERIO_PODS_SOURCE
        delegate.parent.mkdir(parents=True, exist_ok=True)
        delegate.write_bytes(b"original delegate")
        packages = {}
        for package, version in NODE_VERSIONS.items():
            self.write_json(
                self.app / "node_modules" / package / "package.json",
                {"version": version},
            )
            packages[f"node_modules/{package}"] = {"version": version}
        self.write_json(self.app / "package-lock.json", {"packages": packages})
        (self.app / "ios/Podfile.lock").write_text(
            "PODS:\n"
            "  - CustomerIO/DataPipelines (4.7.2)\n"
            "  - CustomerIOMessagingPush (4.7.2)\n"
            "  - CustomerIOMessagingPushFCM (4.7.2)\n"
            "  - FirebaseMessaging (12.17.0)\n"
            "\nDEPENDENCIES:\n",
            encoding="utf-8",
        )
        self.write_json(
            self.app / "ios/Podfile.properties.json",
            {"EXPO_USE_PRECOMPILED_MODULES": "false"},
        )
        self.write_json(
            self.app / "ios/Pods/Local Podspecs/ExpoModulesCore.podspec.json",
            {"source_files": "ios/**/*.{h,m,mm,swift,cpp}"},
        )
        project = self.app / "ios/Pods/Pods.xcodeproj/project.pbxproj"
        project.parent.mkdir(parents=True, exist_ok=True)
        project.write_text(
            "ExpoAppDelegateSubscriberManager.swift in Sources\n", encoding="utf-8"
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    @staticmethod
    def write_json(path: Path, value: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def test_exact_generated_dependencies_match_manifest(self) -> None:
        actual = MODULE._dependency_versions(self.source, self.app, "fcm")
        manifest = {
            "frameworks": [
                {"name": name, "version": version} for name, version in actual.items()
            ]
        }
        MODULE._validate_dependency_manifest(manifest, actual)

    def test_mutated_installed_package_fails_closed(self) -> None:
        self.write_json(
            self.app / "node_modules/expo/package.json", {"version": "57.0.13"}
        )
        with self.assertRaisesRegex(MODULE.CaptureError, "differs across"):
            MODULE._dependency_versions(self.source, self.app, "fcm")

    def test_mutated_native_pod_fails_closed(self) -> None:
        podfile = self.app / "ios/Podfile.lock"
        podfile.write_text(
            podfile.read_text(encoding="utf-8").replace(
                "CustomerIOMessagingPushFCM (4.7.2)",
                "CustomerIOMessagingPushFCM (4.7.3)",
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(MODULE.CaptureError, "pod versions differ"):
            MODULE._dependency_versions(self.source, self.app, "fcm")

    def test_precompiled_expo_modules_core_fails_closed(self) -> None:
        self.write_json(
            self.app / "ios/Podfile.properties.json",
            {"EXPO_USE_PRECOMPILED_MODULES": "true"},
        )
        with self.assertRaisesRegex(MODULE.CaptureError, "disable Expo precompiled"):
            MODULE._dependency_versions(self.source, self.app, "fcm")

    def test_source_graph_without_subscriber_manager_fails_closed(self) -> None:
        project = self.app / "ios/Pods/Pods.xcodeproj/project.pbxproj"
        project.write_text("other.swift in Sources\n", encoding="utf-8")
        with self.assertRaisesRegex(MODULE.CaptureError, "subscriber manager"):
            MODULE._dependency_versions(self.source, self.app, "fcm")

    def test_precompiled_framework_reference_fails_closed(self) -> None:
        project = self.app / "ios/Pods/Pods.xcodeproj/project.pbxproj"
        project.write_text(
            "ExpoAppDelegateSubscriberManager.swift in Sources\n"
            "ExpoModulesCore.xcframework\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(MODULE.CaptureError, "precompiled ExpoModulesCore"):
            MODULE._dependency_versions(self.source, self.app, "fcm")

    def test_nopush_requires_exact_unpatched_customerio_delegate(self) -> None:
        digest = hashlib.sha256()
        MODULE._verify_nopush_customerio_source(self.source, self.app, digest)
        self.assertNotEqual(digest.hexdigest(), hashlib.sha256().hexdigest())

    def test_mutated_nopush_customerio_delegate_fails_closed(self) -> None:
        (self.app / MODULE.CUSTOMERIO_PODS_SOURCE).write_bytes(b"patched delegate")
        with self.assertRaisesRegex(MODULE.CaptureError, "exact unpatched source"):
            MODULE._verify_nopush_customerio_source(
                self.source, self.app, hashlib.sha256()
            )

    def test_mutated_canonical_validator_fails_locked_verification(self) -> None:
        actual_source = SCRIPT.parents[2]
        lock_relative = Path("docs/dev-notes/ios27-lifecycle-contract-v1.lock.json")
        lock = json.loads((actual_source / lock_relative).read_text(encoding="utf-8"))
        self.write_json(self.source / lock_relative, lock)
        tool_relative = Path("scripts/ios27_lifecycle_contract.py")
        (self.source / tool_relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(actual_source / tool_relative, self.source / tool_relative)
        for item in lock["files"]:
            relative = Path(item["path"])
            destination = self.source / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(actual_source / relative, destination)
        validator = self.source / "docs/dev-notes/validate_ios27_lifecycle_trace.py"
        validator.write_bytes(validator.read_bytes() + b"\n# mutation\n")
        with self.assertRaisesRegex(MODULE.CaptureError, "failed locked verification"):
            MODULE._verify_contract_bundle(sys.executable, self.source)

    def initialize_source_repository(self) -> str:
        commands = (
            ("git", "init", "-q"),
            ("git", "config", "user.name", "Lifecycle Fixture Test"),
            ("git", "config", "user.email", "fixture@example.invalid"),
            ("git", "add", "."),
            ("git", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "fixture"),
        )
        for command in commands:
            subprocess.run(command, cwd=self.source, check=True)
        return subprocess.run(
            ("git", "rev-parse", "HEAD"), cwd=self.source, check=True,
            stdout=subprocess.PIPE, text=True,
        ).stdout.strip()

    def test_clean_fixture_source_uses_exact_checkout_commit(self) -> None:
        commit = self.initialize_source_repository()
        expected = MODULE._fixture_source_provenance(self.source)
        self.assertEqual(expected, {
            "name": "customerio-expo-plugin",
            "commit_sha": commit,
            "dirty": False,
            "source_snapshot": None,
        })
        MODULE._validate_fixture_source({"fixture_source": expected}, expected)

    def test_dirty_fixture_source_requires_exact_current_snapshot(self) -> None:
        self.initialize_source_repository()
        self.write_json(self.source / "package.json", {"version": "3.7.1", "fixture": True})
        expected = MODULE._fixture_source_provenance(self.source)
        self.assertTrue(expected["dirty"])
        self.assertEqual(expected["source_snapshot"]["algorithm"], "sha256")
        MODULE._validate_fixture_source({"fixture_source": expected}, expected)

        stale = json.loads(json.dumps(expected))
        stale["source_snapshot"]["tree_hash"] = "0" * 64
        with self.assertRaisesRegex(MODULE.CaptureError, "exact current Expo fixture source"):
            MODULE._validate_fixture_source({"fixture_source": stale}, expected)

    def test_stale_clean_fixture_commit_fails_closed(self) -> None:
        self.initialize_source_repository()
        expected = MODULE._fixture_source_provenance(self.source)
        stale = json.loads(json.dumps(expected))
        stale["commit_sha"] = "0" * 40
        with self.assertRaisesRegex(MODULE.CaptureError, "exact current Expo fixture source"):
            MODULE._validate_fixture_source({"fixture_source": stale}, expected)

    def test_snapshot_framing_distinguishes_newline_path_collision(self) -> None:
        self.initialize_source_repository()
        first = b"first fixture contents"
        second = b"second fixture contents"
        second_hash = hashlib.sha256(second).hexdigest()
        ambiguous_name = f"a\n{second_hash}  b"

        (self.source / ambiguous_name).write_bytes(first)
        first_snapshot = MODULE._fixture_source_provenance(self.source)
        (self.source / ambiguous_name).unlink()
        (self.source / "a").write_bytes(first)
        (self.source / "b").write_bytes(second)
        second_snapshot = MODULE._fixture_source_provenance(self.source)

        legacy_single = (
            f"{hashlib.sha256(first).hexdigest()}  {ambiguous_name}\n".encode()
        )
        legacy_split = (
            f"{hashlib.sha256(first).hexdigest()}  a\n"
            f"{second_hash}  b\n"
        ).encode()
        self.assertEqual(legacy_single, legacy_split)
        self.assertNotEqual(
            first_snapshot["source_snapshot"], second_snapshot["source_snapshot"]
        )

    def test_snapshot_framing_distinguishes_untracked_executable_mode(self) -> None:
        self.initialize_source_repository()
        script = self.source / "fixture-script"
        script.write_bytes(b"#!/bin/sh\nexit 0\n")
        script.chmod(0o655)
        non_executable = MODULE._fixture_source_provenance(self.source)
        script.chmod(0o755)
        executable = MODULE._fixture_source_provenance(self.source)
        self.assertNotEqual(
            non_executable["source_snapshot"], executable["source_snapshot"]
        )


if __name__ == "__main__":
    if "--integration" not in sys.argv:
        unittest.main()
    else:
        parser = argparse.ArgumentParser()
        parser.add_argument("--integration", action="store_true")
        parser.add_argument("--source-root", type=Path, required=True)
        parser.add_argument("--app-path", type=Path, required=True)
        parser.add_argument("--variant", choices=("apn", "fcm", "nopush"), required=True)
        arguments = parser.parse_args()
        versions = MODULE._dependency_versions(
            arguments.source_root.resolve(), arguments.app_path.resolve(), arguments.variant
        )
        print(json.dumps(versions, sort_keys=True))
