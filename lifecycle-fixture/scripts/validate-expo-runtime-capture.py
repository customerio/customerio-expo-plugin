#!/usr/bin/env python3
"""Fail-closed validation for a real generated Expo lifecycle capture."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


class CaptureError(RuntimeError):
    pass


FRAMEWORK_SOURCES = {
    "node_modules/expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift":
        "framework/expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift",
    "node_modules/expo/ios/AppDelegates/ExpoAppDelegate.swift":
        "framework/expo/ios/AppDelegates/ExpoAppDelegate.swift",
    "node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift":
        "framework/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift",
    "node_modules/expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift":
        "framework/expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift",
    "node_modules/expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift":
        "framework/expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift",
    "src/app/index.tsx": "javascript/src/app/index.tsx",
}

CUSTOMERIO_SOURCES = {
    "apn": {
        "ios/Pods/CustomerIOMessagingPush/Sources/MessagingPush/Integration/CioNotificationCenterDelegate.swift":
            "customerio-ios/apn/CioNotificationCenterDelegate.swift",
        "ios/Pods/CustomerIOMessagingPushAPN/Sources/MessagingPushAPN/Integration/CioAppDelegateAPN.swift":
            "customerio-ios/apn/CioAppDelegateAPN.swift",
    },
    "fcm": {
        "ios/Pods/CustomerIOMessagingPush/Sources/MessagingPush/Integration/CioNotificationCenterDelegate.swift":
            "customerio-ios/fcm/CioNotificationCenterDelegate.swift",
        "ios/Pods/CustomerIOMessagingPushFCM/Sources/MessagingPushFCM/Integration/CioAppDelegateFCM.swift":
            "customerio-ios/fcm/CioAppDelegateFCM.swift",
    },
    "nopush": {},
}

NODE_FRAMEWORKS = {
    "expo": "expo",
    "expo-modules-core": "expo-modules-core",
    "expo-notifications": "expo-notifications",
    "react-native": "react-native",
    "customerio-reactnative": "customerio-reactnative",
    "customerio-expo-plugin": "customerio-expo-plugin",
}

CUSTOMERIO_PODS = {
    "apn": ("CustomerIO/DataPipelines", "CustomerIOMessagingPush", "CustomerIOMessagingPushAPN"),
    "fcm": ("CustomerIO/DataPipelines", "CustomerIOMessagingPush", "CustomerIOMessagingPushFCM"),
    "nopush": ("CustomerIO/DataPipelines", "CustomerIOMessagingPush"),
}


def _verify_source_built_expo_modules_core(app: Path) -> None:
    properties = _load_object(
        app / "ios/Podfile.properties.json", "generated Podfile.properties.json"
    )
    if properties.get("EXPO_USE_PRECOMPILED_MODULES") != "false":
        raise CaptureError(
            "generated fixture must disable Expo precompiled modules before pod install"
        )

    local_podspec = _load_object(
        app / "ios/Pods/Local Podspecs/ExpoModulesCore.podspec.json",
        "resolved ExpoModulesCore podspec",
    )
    source_files = local_podspec.get("source_files")
    source_values = source_files if isinstance(source_files, list) else [source_files]
    if not any(isinstance(value, str) and "ios/" in value for value in source_values):
        raise CaptureError("resolved ExpoModulesCore podspec is not source-built")
    if local_podspec.get("vendored_frameworks") is not None:
        raise CaptureError("resolved ExpoModulesCore podspec still vendors a precompiled framework")

    project_path = app / "ios/Pods/Pods.xcodeproj/project.pbxproj"
    if project_path.is_symlink() or not project_path.is_file():
        raise CaptureError("generated Pods project must be a regular file")
    try:
        project = project_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise CaptureError("generated Pods project is not UTF-8") from error
    if "ExpoAppDelegateSubscriberManager.swift in Sources" not in project:
        raise CaptureError(
            "generated ExpoModulesCore target does not compile the patched subscriber manager"
        )
    if "ExpoModulesCore.xcframework" in project:
        raise CaptureError(
            "generated Pods project still links a precompiled ExpoModulesCore framework"
        )


def _run(arguments: list[str], *, cwd: Path) -> bytes:
    try:
        return subprocess.run(
            arguments,
            cwd=cwd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        raise CaptureError(f"command failed: {arguments[0]}") from error


def _git(root: Path, *arguments: str) -> str:
    return _run(["git", "-C", str(root), *arguments], cwd=root).decode().strip()


def _source_snapshot(root: Path) -> tuple[bool, dict[str, str] | None]:
    status = _git(root, "status", "--porcelain=v1", "--untracked-files=all")
    if not status:
        return False, None
    listed = _run(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=root,
    ).split(b"\0")
    untracked_values = _run(
        ["git", "-C", str(root), "ls-files", "-z", "--others", "--exclude-standard"],
        cwd=root,
    ).split(b"\0")
    try:
        untracked = {value.decode("utf-8") for value in untracked_values if value}
    except UnicodeDecodeError as error:
        raise CaptureError("source snapshot contains a non-UTF-8 path") from error
    tree = hashlib.sha256()
    untracked_digest = hashlib.sha256()
    for raw_relative in sorted(value for value in listed if value):
        try:
            relative = raw_relative.decode("utf-8")
        except UnicodeDecodeError as error:
            raise CaptureError("source snapshot contains a non-UTF-8 path") from error
        path = root / relative
        if path.is_symlink() or not path.is_file():
            raise CaptureError(f"source snapshot contains a non-regular path: {relative}")
        entry = f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}\n".encode()
        tree.update(entry)
        if relative in untracked:
            untracked_digest.update(entry)
    diff = _run(
        ["git", "-C", str(root), "diff", "--binary", "--no-ext-diff", "HEAD", "--"],
        cwd=root,
    )
    return True, {
        "algorithm": "sha256",
        "tree_hash": tree.hexdigest(),
        "diff_hash": hashlib.sha256(
            diff + b"\0UNTRACKED\0" + untracked_digest.digest()
        ).hexdigest(),
    }


def _load_object(path: Path, label: str) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise CaptureError(f"{label} must be a regular file")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CaptureError(f"{label} is not valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise CaptureError(f"{label} must be a JSON object")
    return value


def _package_version(path: Path, label: str) -> str:
    value = _load_object(path, label).get("version")
    if not isinstance(value, str) or not value:
        raise CaptureError(f"{label} does not declare an exact version")
    return value


def _pod_version(podfile_lock: str, name: str) -> str:
    matches = re.findall(
        rf'^  - "?{re.escape(name)} \(([^):]+)(?::[^)]*)?\)(?::)?$',
        podfile_lock,
        flags=re.MULTILINE,
    )
    if len(matches) != 1:
        raise CaptureError(f"Podfile.lock must contain exactly one {name} pod version")
    return matches[0]


def _dependency_versions(source: Path, app: Path, variant: str) -> dict[str, str]:
    _verify_source_built_expo_modules_core(app)
    provenance = _load_object(
        source / "__tests__/fixtures/ios/expo57-generated/PROVENANCE.json",
        "pinned Expo provenance",
    )
    pinned_packages = provenance.get("packageVersions")
    if not isinstance(pinned_packages, dict):
        raise CaptureError("pinned Expo provenance lacks packageVersions")
    package_lock = _load_object(app / "package-lock.json", "generated package-lock.json")
    locked_packages = package_lock.get("packages")
    if not isinstance(locked_packages, dict):
        raise CaptureError("generated package-lock.json lacks package entries")
    patch_lock = _load_object(
        source / "lifecycle-fixture/scripts/expo57-source-patch.lock.json",
        "Expo source patch lock",
    )

    versions: dict[str, str] = {}
    for package, framework in NODE_FRAMEWORKS.items():
        actual = _package_version(
            app / "node_modules" / package / "package.json",
            f"installed {package} package",
        )
        lock_entry = locked_packages.get(f"node_modules/{package}")
        locked = lock_entry.get("version") if isinstance(lock_entry, dict) else None
        pinned = (
            patch_lock.get("customerioExpoPluginVersion")
            if package == "customerio-expo-plugin"
            else pinned_packages.get(package)
        )
        if actual != locked or actual != pinned:
            raise CaptureError(
                f"{package} version differs across node_modules, package-lock.json, and pinned provenance"
            )
        versions[framework] = actual

    source_plugin = _package_version(source / "package.json", "Expo plugin source package")
    if versions["customerio-expo-plugin"] != source_plugin:
        raise CaptureError("installed Customer.io Expo plugin version differs from the source package")

    expected_customerio = patch_lock.get("customerioIOSVersion")
    expected_firebase = patch_lock.get("firebaseIOSMessagingVersion")
    if not isinstance(expected_customerio, str) or not isinstance(expected_firebase, str):
        raise CaptureError("Expo source patch lock lacks native dependency versions")
    podfile_path = app / "ios/Podfile.lock"
    if podfile_path.is_symlink() or not podfile_path.is_file():
        raise CaptureError("generated Podfile.lock must be a regular file")
    try:
        podfile_lock = podfile_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise CaptureError("generated Podfile.lock is not UTF-8") from error
    if "\nDEPENDENCIES:\n" not in podfile_lock:
        raise CaptureError("generated Podfile.lock lacks a DEPENDENCIES section")
    pods_section = podfile_lock.split("\nDEPENDENCIES:\n", 1)[0]
    customerio_versions = {
        name: _pod_version(pods_section, name) for name in CUSTOMERIO_PODS[variant]
    }
    if set(customerio_versions.values()) != {expected_customerio}:
        raise CaptureError("Customer.io pod versions differ from the pinned native SDK version")
    versions["customerio-ios"] = customerio_versions["CustomerIO/DataPipelines"]
    if "CustomerIOMessagingPush" in customerio_versions:
        versions["customerio-messaging-push"] = customerio_versions["CustomerIOMessagingPush"]
    if variant == "fcm":
        firebase = _pod_version(pods_section, "FirebaseMessaging")
        if firebase != expected_firebase:
            raise CaptureError("FirebaseMessaging pod version differs from the pinned provider peer")
        versions["firebase-ios-sdk-messaging"] = firebase
    return versions


def _validate_dependency_manifest(manifest: dict[str, Any], actual: dict[str, str]) -> None:
    framework_items = manifest.get("frameworks")
    if not isinstance(framework_items, list):
        raise CaptureError("capture manifest lacks frameworks")
    frameworks: dict[str, str] = {}
    for item in framework_items:
        if not isinstance(item, dict):
            raise CaptureError("capture manifest contains a non-object framework")
        name = item.get("name")
        version = item.get("version")
        if not isinstance(name, str) or not isinstance(version, str) or name in frameworks:
            raise CaptureError("capture manifest frameworks must have unique names and versions")
        frameworks[name] = version
    for name, version in actual.items():
        if frameworks.get(name) != version:
            raise CaptureError(
                f"manifest framework {name} does not match the generated dependency version"
            )


def _verify_validator_python(executable: Path, source: Path) -> str:
    check = (
        "from importlib.metadata import version; "
        "from jsonschema import FormatChecker; "
        "parts=tuple(int(v) for v in version('jsonschema').split('.')[:2]); "
        "assert (4,18) <= parts < (5,0); "
        "checker=FormatChecker(); "
        "assert checker.conforms('2026-08-11T16:00:00Z','date-time'); "
        "assert not checker.conforms('2026-08-11','date-time')"
    )
    try:
        completed = subprocess.run(
            [str(executable), "-c", check],
            cwd=source,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except OSError as error:
        raise CaptureError("validator Python is not executable") from error
    if completed.returncode != 0:
        raise CaptureError("validator Python requires jsonschema[format]>=4.18,<5")
    return str(executable)


def _verify_contract_bundle(executable: str, source: Path) -> None:
    tool = source / "scripts/ios27_lifecycle_contract.py"
    validator = source / "docs/dev-notes/validate_ios27_lifecycle_trace.py"
    for path in (tool, validator):
        if path.is_symlink() or not path.is_file():
            raise CaptureError("canonical contract verifier and validator must be regular files")
    completed = subprocess.run(
        [executable, str(tool), "verify", "--root", str(source)],
        cwd=source,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if completed.returncode != 0:
        raise CaptureError("vendored canonical lifecycle contract failed locked verification")


def _resolve_roots(source_value: Path, app_value: Path) -> tuple[Path, Path]:
    source = source_value.resolve()
    app = app_value.resolve()
    if source_value.is_symlink() or _git(source, "rev-parse", "--show-toplevel") != str(source):
        raise CaptureError("source-root must be a non-symlink Git checkout root")
    fixture_root = (source / "ci-test-apps").resolve()
    if app_value.is_symlink() or app == fixture_root or fixture_root not in app.parents:
        raise CaptureError("app-path must be a non-symlink child of ci-test-apps")
    return source, app


def _compare_file(actual: Path, expected: Path, digest: hashlib._Hash) -> None:
    if actual.is_symlink() or expected.is_symlink() or not actual.is_file() or not expected.is_file():
        raise CaptureError(f"missing or non-regular generated source: {actual}")
    actual_bytes = actual.read_bytes()
    expected_bytes = expected.read_bytes()
    if actual_bytes != expected_bytes:
        raise CaptureError(f"generated source differs from its pinned patched snapshot: {actual}")
    digest.update(f"{hashlib.sha256(actual_bytes).hexdigest()}  {actual}\n".encode())


def _verify_generated_sources(source: Path, app: Path, variant: str) -> str:
    patched = source / "__tests__/fixtures/ios/expo57-patched"
    digest = hashlib.sha256()
    mappings = dict(FRAMEWORK_SOURCES)
    mappings[f"ios/LifecycleFixtureExpo57/AppDelegate.swift"] = f"variants/{variant}/AppDelegate.swift"
    mappings["app.json"] = f"variants/{variant}/app.json"
    mappings["ios/Podfile.properties.json"] = f"variants/{variant}/Podfile.properties.json"
    handler = patched / f"variants/{variant}/CioSdkAppDelegateHandler.swift"
    if handler.exists():
        mappings["ios/LifecycleFixtureExpo57/CioSdkAppDelegateHandler.swift"] = (
            f"variants/{variant}/CioSdkAppDelegateHandler.swift"
        )
    mappings.update(CUSTOMERIO_SOURCES[variant])
    for actual_relative, expected_relative in sorted(mappings.items()):
        _compare_file(app / actual_relative, patched / expected_relative, digest)
    for relative in (
        "expo-module.config.json",
        "ios/CioLifecycleProbe.podspec",
        "ios/CioLifecycleProbeBootstrap.m",
        "ios/CioLifecycleProbeModule.swift",
        "ios/LifecycleTraceModel.swift",
        "ios/LifecycleTraceProbe.swift",
        "ios/LifecycleTraceProbeObserver.swift",
        "ios/LifecycleTraceRecorder.swift",
    ):
        _compare_file(
            app / "modules/cio-lifecycle-probe" / relative,
            source / "lifecycle-fixture/probe-module" / relative,
            digest,
        )
    _compare_file(
        app / "src/lifecycle/LifecycleReceipts.ts",
        source / "lifecycle-fixture/javascript/LifecycleReceipts.ts",
        digest,
    )
    if variant == "nopush":
        app_delegate = (app / "ios/LifecycleFixtureExpo57/AppDelegate.swift").read_text()
        if "customerio.route-deep-link" in app_delegate:
            raise CaptureError("no-push AppDelegate invents Customer.io Live Activity routing")
    return digest.hexdigest()


def _receipt_matches(manifest: dict[str, Any], runtime: str, receipt_path: Path) -> None:
    receipt = _load_object(receipt_path, f"{runtime} receipt")
    streams = [item for item in manifest.get("streams", []) if item.get("runtime") == runtime]
    if len(streams) != 1 or streams[0].get("receipt") != receipt:
        raise CaptureError(f"{runtime} receipt does not match exactly one manifest stream")


def _repository_provenance(source: Path) -> dict[str, Any]:
    dirty, snapshot = _source_snapshot(source)
    return {
        "name": "customerio-expo-plugin",
        "commit_sha": _git(source, "rev-parse", "HEAD"),
        "dirty": dirty,
        "source_snapshot": snapshot,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--app-path", type=Path, required=True)
    parser.add_argument("--variant", choices=sorted(CUSTOMERIO_SOURCES), required=True)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--native-trace", type=Path)
    parser.add_argument("--native-receipt", type=Path)
    parser.add_argument("--javascript-trace", type=Path)
    parser.add_argument("--javascript-receipt", type=Path)
    parser.add_argument("--validator-python", type=Path)
    parser.add_argument("--print-provenance", action="store_true")
    arguments = parser.parse_args()
    source, app = _resolve_roots(arguments.source_root, arguments.app_path)
    fixture_digest = _verify_generated_sources(source, app, arguments.variant)
    dependency_versions = _dependency_versions(source, app, arguments.variant)
    repository = _repository_provenance(source)
    if arguments.print_provenance:
        print(json.dumps({"repository": repository, "generated_fixture_sha256": fixture_digest}, sort_keys=True))
        return
    required = (arguments.manifest, arguments.native_trace, arguments.native_receipt)
    if any(value is None for value in required):
        raise CaptureError("validation requires manifest, native trace, and native receipt")
    manifest = _load_object(arguments.manifest, "capture manifest")
    if manifest.get("evidence_level") not in {"L2", "L3"}:
        raise CaptureError("runtime acceptance validation requires L2 or L3")
    matches = [item for item in manifest.get("repositories", []) if item.get("name") == "customerio-expo-plugin"]
    if matches != [repository]:
        raise CaptureError("manifest does not record the exact current Expo source snapshot")
    _validate_dependency_manifest(manifest, dependency_versions)
    _receipt_matches(manifest, "swift", arguments.native_receipt)
    traces = [arguments.native_trace]
    javascript_streams = [item for item in manifest.get("streams", []) if item.get("runtime") == "javascript"]
    if javascript_streams:
        if arguments.javascript_trace is None or arguments.javascript_receipt is None:
            raise CaptureError("JavaScript stream requires trace and receipt files")
        _receipt_matches(manifest, "javascript", arguments.javascript_receipt)
        traces.append(arguments.javascript_trace)
    elif arguments.javascript_trace is not None or arguments.javascript_receipt is not None:
        raise CaptureError("unexpected JavaScript trace or receipt for a native-only manifest")
    if arguments.validator_python is None:
        raise CaptureError("validation requires --validator-python with jsonschema[format]>=4.18,<5")
    validator_python = _verify_validator_python(arguments.validator_python, source)
    _verify_contract_bundle(validator_python, source)
    validator = source / "docs/dev-notes/validate_ios27_lifecycle_trace.py"
    try:
        completed = subprocess.run(
            [validator_python, str(validator), str(arguments.manifest), *(str(path) for path in traces)],
            cwd=source,
            check=False,
        )
    except OSError as error:
        raise CaptureError("validator Python is not executable") from error
    if completed.returncode != 0:
        raise CaptureError("canonical validator rejected the runtime capture")
    print(f"validated generated Expo runtime capture; fixture_sha256={fixture_digest}")


if __name__ == "__main__":
    try:
        main()
    except CaptureError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
