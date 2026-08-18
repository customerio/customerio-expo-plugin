#!/usr/bin/env python3

"""Resolve one freshly built Release simulator app from xcodebuild settings."""

from __future__ import annotations

import argparse
import json
import plistlib
from pathlib import Path


SAFE_BUILD_SETTING_KEYS = (
    "CONFIGURATION",
    "TARGET_BUILD_DIR",
    "WRAPPER_EXTENSION",
    "WRAPPER_NAME",
)


def write_sanitized_settings(
    destination: Path,
    entries: list[dict[str, object]] | None,
    *,
    parse_error: str | None = None,
    raw_bytes: int | None = None,
) -> None:
    """Write only the allowlisted settings or bounded parse metadata."""

    if entries is None:
        payload: object = {
            "parse_error": parse_error or "unknown parse error",
            "raw_bytes": raw_bytes or 0,
        }
    else:
        payload = [
            {
                "target": entry.get("target", "unknown"),
                "buildSettings": {
                    key: entry.get("buildSettings", {}).get(key)
                    for key in SAFE_BUILD_SETTING_KEYS
                },
            }
            for entry in entries
        ]
    with destination.open("w", encoding="utf-8") as safe_file:
        json.dump(payload, safe_file, indent=2, sort_keys=True)
        safe_file.write("\n")


def load_settings(source: Path, sanitized_destination: Path) -> list[dict[str, object]]:
    """Load private settings and always leave a bounded sanitized diagnostic."""

    raw_bytes = 0
    try:
        raw_bytes = source.stat().st_size
        raw = source.read_text(encoding="utf-8")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as initial_error:
            decoder = json.JSONDecoder()
            search_from = 0
            while True:
                start = raw.find("[", search_from)
                if start == -1:
                    raise initial_error
                search_from = start + 1
                try:
                    candidate, _ = decoder.raw_decode(raw, start)
                except json.JSONDecodeError:
                    continue
                if isinstance(candidate, list):
                    payload = candidate
                    break
            if not isinstance(payload, list):
                raise initial_error
    except (OSError, json.JSONDecodeError) as error:
        write_sanitized_settings(
            sanitized_destination,
            None,
            parse_error=str(error),
            raw_bytes=raw_bytes,
        )
        raise SystemExit(f"could not parse xcodebuild settings JSON: {error}") from error

    if not isinstance(payload, list) or any(
        not isinstance(entry, dict)
        or not isinstance(entry.get("buildSettings", {}), dict)
        for entry in payload
    ):
        write_sanitized_settings(
            sanitized_destination,
            None,
            parse_error="xcodebuild settings JSON must be a list of target objects",
            raw_bytes=raw_bytes,
        )
        raise SystemExit("xcodebuild settings JSON must be a list of target objects")

    write_sanitized_settings(sanitized_destination, payload)
    return payload


def load_build_start(source: Path) -> int:
    """Load the build-start epoch with a classified error."""

    try:
        return int(source.read_text(encoding="utf-8").strip())
    except (OSError, ValueError) as error:
        raise SystemExit(f"could not read build start epoch: {error}") from error


def resolve_app(entries: list[dict[str, object]], build_started_at: int, scheme: str) -> Path:
    """Return the single fresh Release simulator app or fail with rejection reasons."""

    matches: list[Path] = []
    rejected: list[str] = []
    skipped: list[str] = []
    for entry in entries:
        settings = entry.get("buildSettings", {})
        if settings.get("CONFIGURATION") != "Release":
            skipped.append(
                f"{entry.get('target', 'unknown')}: configuration={settings.get('CONFIGURATION')} "
                f"wrapper={settings.get('WRAPPER_EXTENSION')}"
            )
            continue
        if settings.get("WRAPPER_EXTENSION") != "app":
            skipped.append(
                f"{entry.get('target', 'unknown')}: configuration={settings.get('CONFIGURATION')} "
                f"wrapper={settings.get('WRAPPER_EXTENSION')}"
            )
            continue
        build_directory = settings.get("TARGET_BUILD_DIR")
        wrapper_name = settings.get("WRAPPER_NAME")
        if (
            not isinstance(build_directory, str)
            or not build_directory
            or not isinstance(wrapper_name, str)
            or not wrapper_name
        ):
            rejected.append(
                f"{entry.get('target', 'unknown')}: missing TARGET_BUILD_DIR/WRAPPER_NAME"
            )
            continue
        path = Path(build_directory) / wrapper_name
        info_plist = path / "Info.plist"
        if not info_plist.is_file():
            rejected.append(f"{path}: missing Info.plist")
            continue
        try:
            with info_plist.open("rb") as plist_file:
                executable_name = plistlib.load(plist_file).get("CFBundleExecutable")
        except Exception as error:
            rejected.append(f"{path}: unreadable Info.plist ({error})")
            continue
        if not isinstance(executable_name, str) or not executable_name:
            rejected.append(f"{path}: missing CFBundleExecutable")
            continue
        executable = path / executable_name
        if not executable.is_file():
            rejected.append(f"{path}: missing executable {executable_name}")
            continue
        try:
            executable_modified_at = executable.stat().st_mtime
        except OSError as error:
            rejected.append(f"{path}: unreadable executable {executable_name} ({error})")
            continue
        if executable_modified_at < build_started_at:
            rejected.append(f"{path}: stale executable")
            continue
        matches.append(path)

    if len(matches) != 1:
        raise SystemExit(
            f"expected one current built simulator app for {scheme}, "
            f"found {[str(path) for path in matches]}; inspected {len(entries)} targets; "
            f"skipped {len(skipped)} targets (first 10: {skipped[:10]}); rejected {rejected}"
        )
    return matches[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--private-settings-json", type=Path, required=True)
    parser.add_argument("--build-start-epoch", type=Path, required=True)
    parser.add_argument("--scheme", required=True)
    parser.add_argument("--sanitized-settings-json", type=Path, required=True)
    arguments = parser.parse_args()

    entries = load_settings(
        arguments.private_settings_json,
        arguments.sanitized_settings_json,
    )
    build_started_at = load_build_start(arguments.build_start_epoch)
    print(resolve_app(entries, build_started_at, arguments.scheme))


if __name__ == "__main__":
    main()
