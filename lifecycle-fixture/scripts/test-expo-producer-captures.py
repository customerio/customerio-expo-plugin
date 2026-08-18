#!/usr/bin/env python3
"""Validate complete producer-shaped Expo streams against the canonical contract."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "docs/dev-notes/validate_ios27_lifecycle_trace.py"
NATIVE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
JAVASCRIPT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
PROCESS_INSTANCE_ID = "99999999-9999-4999-8999-999999999999"
ALIAS_NAMES = ("occurrence", "delivery", "request", "scene", "url", "closure")


def frameworks() -> list[dict]:
    values = (
        ("customerio-ios", "sdk", "4.7.2", "5903eaddd88638d37f7204b737dc0faf07d7d3dc"),
        ("customerio-messaging-push", "sdk", "4.7.2", "5903eaddd88638d37f7204b737dc0faf07d7d3dc"),
        ("customerio-expo-plugin", "wrapper", "3.7.1", "3637028bfa4c5c66752697b346ad826266e6ae03"),
        ("expo", "runtime", "57.0.12", None),
        ("expo-notifications", "peer", "57.0.10", None),
        ("expo-modules-core", "peer", "57.0.10", None),
        ("customerio-reactnative", "wrapper", "6.6.2", "1edc94769359dfd992d6622884561d448d3f8dd9"),
        ("react-native", "runtime", "0.86.2", None),
        ("apple-usernotifications", "platform-framework", "26.5", None),
    )
    return [
        {"name": name, "role": role, "version": version, "commit_sha": commit}
        for name, role, version, commit in values
    ]


def repositories() -> list[dict]:
    return [
        {"name": "customerio-ios", "commit_sha": "5903eaddd88638d37f7204b737dc0faf07d7d3dc", "dirty": False, "source_snapshot": None},
        {"name": "customerio-expo-plugin", "commit_sha": "3637028bfa4c5c66752697b346ad826266e6ae03", "dirty": False, "source_snapshot": None},
        {"name": "customerio-reactnative", "commit_sha": "1edc94769359dfd992d6622884561d448d3f8dd9", "dirty": False, "source_snapshot": None},
    ]


def recorder_snapshot(correlation: dict[str, str] | None) -> dict:
    correlation = correlation or {}
    return {
        "dropped_records_total": 0,
        "alias_counts": {name: int(name in correlation) for name in ALIAS_NAMES},
        "alias_overflow": False,
        "alias_overflow_namespaces": [],
        "buffer_high_watermark": 1,
        "buffer_capacity": 256,
    }


def record(
    sequence: int,
    scenario: str,
    provider: str,
    runtime: str,
    callback: str,
    owner: str,
    kind: str,
    phase: str,
    summary: dict | None = None,
    correlation: dict[str, str] | None = None,
) -> dict:
    if kind != "trace-control":
        correlation = dict(correlation or {})
        correlation.setdefault("occurrence", "occurrence-1")
    return {
        "schema": "cio-lifecycle-trace/1",
        "manifest_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "run_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "stream_id": NATIVE_ID if runtime == "swift" else JAVASCRIPT_ID,
        "sequence": sequence,
        "monotonic_ms": 1000 + sequence,
        "captured_at": f"2026-08-11T16:00:{sequence:02d}Z",
        "process_id": 321 if runtime == "swift" else None,
        "integration": "expo",
        "runtime": runtime,
        "provider": provider,
        "scenario": scenario,
        "evidence_level": "L2",
        "owner": owner,
        "kind": kind,
        "callback": callback,
        "phase": phase,
        "main_thread": False if runtime == "javascript" or kind == "trace-control" else True,
        "payload_summary": summary or {"flags": {}, "counts": {}, "enums": {}},
        "correlation": correlation,
        "completion": None,
        "recorder": recorder_snapshot(correlation),
    }


def controls(scenario: str, provider: str, runtime: str, body: list[dict]) -> list[dict]:
    start_summary = (
        {"flags": {"scene_manifest_active": False}, "counts": {}, "enums": {}}
        if runtime == "swift"
        else None
    )
    start = record(
        1, scenario, provider, runtime, "trace.scenario-start", "trace-recorder",
        "trace-control", "state-change", start_summary
    )
    renumbered = []
    for sequence, item in enumerate(body, 2):
        item["sequence"] = sequence
        item["monotonic_ms"] = 1000 + sequence
        item["captured_at"] = f"2026-08-11T16:00:{sequence:02d}Z"
        renumbered.append(item)
    end = record(len(body) + 2, scenario, provider, runtime, "trace.scenario-end", "trace-recorder", "trace-control", "state-change")
    end["recorder"] = recorder_snapshot(body[-1].get("correlation") if body else None)
    return [start, *renumbered, end]


def receipt(records: list[dict]) -> dict:
    final = records[-1]["recorder"]
    return {
        "drained_at": "2026-08-11T16:00:20Z",
        "last_assigned_sequence": records[-1]["sequence"],
        "last_emitted_sequence": records[-1]["sequence"],
        "emitted_records": len(records),
        **final,
    }


def manifest(scenario: str, provider: str, native: list[dict], javascript: list[dict] | None, native_callback: str | None) -> dict:
    provider_scenario = scenario.startswith("push-") or scenario == "token-registration"
    provenance = {
        "provider": provider,
        "source": "system-registration" if scenario == "token-registration" else ("simulator-control" if provider_scenario else "none"),
        "environment": "simulator" if provider_scenario else "none",
        "receipt_result": "registered" if scenario == "token-registration" else ("injected" if provider_scenario else "not-applicable"),
        "receipt_recorded_at": "2026-08-11T16:00:02Z" if provider_scenario else None,
        "provider_sdk": None,
    }
    stimulus_source = (
        "system-registration" if scenario == "token-registration"
        else "live-activity" if scenario.startswith("live-activity")
        else "simulator-control"
    )
    streams = [{
        "stream_id": NATIVE_ID,
        "integration": "expo",
        "runtime": "swift",
        "provider": provider,
        "process_id": 321,
        "process_instance_id": PROCESS_INSTANCE_ID,
        "receipt": receipt(native),
    }]
    assertions = []
    if javascript is not None and native_callback is not None:
        streams.append({
            "stream_id": JAVASCRIPT_ID,
            "integration": "expo",
            "runtime": "javascript",
            "provider": provider,
            "process_id": None,
            "process_instance_id": PROCESS_INSTANCE_ID,
            "receipt": receipt(javascript),
        })
        wrapper_callback = "wrapper.app-received-notification" if "tap" in scenario and "url" not in scenario and "activity" not in scenario else "wrapper.app-received-url"
        assertions.append({
            "name": "producer-handoff",
            "relation": "equal-exact-count",
            "expected_count": 1,
            "members": [
                {"stream_id": NATIVE_ID, "callback": native_callback, "phase": "entry" if "subscriber" in native_callback else "result"},
                {"stream_id": JAVASCRIPT_ID, "callback": wrapper_callback, "phase": "entry"},
            ],
        })
    return {
        "schema": "cio-lifecycle-capture-manifest/1",
        "manifest_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "run_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "run_started_at": "2026-08-11T16:00:00Z",
        "run_ended_at": "2026-08-11T16:00:20Z",
        "created_at": "2026-08-11T16:00:21Z",
        "evidence_level": "L2",
        "host_topology": "app-delegate-only",
        "scenario": scenario,
        "repositories": repositories(),
        "fixture_source": {
            "name": "customerio-expo-plugin",
            "commit_sha": "5635e80e69eaed39f4b2dfff01d1a01104766abe",
            "dirty": False,
            "source_snapshot": None,
        },
        "toolchain": {"xcode_version": "26.6", "xcode_build": "17F113", "swift_version": "6.2.4", "flutter_version": None, "dart_version": None, "node_version": "24.13.1", "expo_cli_version": "57.0.12"},
        "sdk": {"platform": "ios", "name": "iphonesimulator", "version": "26.5", "build": "23F81a"},
        "build": {"configuration": "Debug", "scheme": "LifecycleFixtureExpo57", "target_name": "LifecycleFixtureExpo57", "product_kind": "application", "deployment_target": "15.1"},
        "target": {"kind": "simulator", "model": "iPhone 17 Pro", "architecture": "arm64", "os_name": "iOS", "os_version": "26.5", "os_build": "23F81a"},
        "frameworks": frameworks(),
        "provider_provenance": provenance,
        "stimulus": {"scenario": scenario, "source": stimulus_source, "initiated_at": "2026-08-11T16:00:01Z"},
        "streams": streams,
        "aggregate_assertions": assertions,
    }


def url_summary(live: bool, result: str | None = None) -> dict:
    flags = {"has_url": True, "has_delivery_id": live, "has_delivery_token": live, "has_redirect": live}
    enums = {"url_scheme": "custom", "url_class": "cio-live-activity" if live else "custom-scheme"}
    if result is not None:
        flags["handled"] = True
        enums["result"] = result
    return {"flags": flags, "counts": {"url_path_components": 0, "url_query_items": 3 if live else 0}, "enums": enums}


def notification_summary(peer: str, result: bool = False) -> dict:
    enums = {"notification_origin": "remote", "notification_class": "customerio", "delegate_peer": peer, "action_class": "default"}
    if result: enums["result"] = "handled"
    return {"flags": {"has_notification": True, "has_notification_response": True, "has_aps": True, "has_delivery_id": True, "has_delivery_token": True}, "counts": {"notification_user_info_keys": 3}, "enums": enums}


def validate_case(name: str, manifest_value: dict, streams: list[list[dict]], should_pass: bool = True) -> None:
    with tempfile.TemporaryDirectory(prefix="cio-expo-producer-") as temp:
        root = Path(temp)
        manifest_path = root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest_value) + "\n")
        paths = []
        for index, records in enumerate(streams):
            trace_path = root / f"stream-{index}.ndjson"
            trace_path.write_text("".join(f"CIO-LIFECYCLE-TRACE {json.dumps(item, separators=(',', ':'))}\n" for item in records))
            paths.append(trace_path)
        result = subprocess.run([sys.executable, str(VALIDATOR), str(manifest_path), *(str(path) for path in paths)], text=True, capture_output=True)
        if (result.returncode == 0) != should_pass:
            raise AssertionError(f"{name}: unexpected validator result\n{result.stdout}{result.stderr}")
        print(f"{name}: {'accepted' if should_pass else 'rejected as expected'}")


def main() -> None:
    for scenario, live in (("custom-url-warm", False), ("live-activity-tap-warm", True)):
        correlation = {"url": "url-1"}
        body = [
            record(0, scenario, "none", "swift", "application.open-url", "application-delegate", "os-callback", "entry", url_summary(live), correlation),
            record(0, scenario, "none", "swift", "host.route-url", "host", "host-routing", "intent", url_summary(live), correlation),
        ]
        if live:
            body.append(record(0, scenario, "none", "swift", "customerio.route-deep-link", "customerio-sdk", "sdk-routing", "intent", url_summary(True), correlation))
        body.append(record(0, scenario, "none", "swift", "expo.subscriber.open-url-forwarded", "expo-subscriber", "framework-callback", "entry", url_summary(live), correlation))
        if live:
            body.append(record(0, scenario, "none", "swift", "customerio.route-deep-link", "customerio-sdk", "sdk-routing", "result", url_summary(True, "redirect"), correlation))
        body.append(record(0, scenario, "none", "swift", "host.route-url", "host", "host-routing", "result", url_summary(live, "handled"), correlation))
        native = controls(scenario, "none", "swift", body)
        wrapper = controls(scenario, "none", "javascript", [record(0, scenario, "none", "javascript", "wrapper.app-received-url", "expo-javascript", "app-received", "entry", url_summary(live), correlation)])
        value = manifest(scenario, "none", native, wrapper, "expo.subscriber.open-url-forwarded")
        validate_case(f"{scenario}-single-result-closes", value, [native, wrapper])
        if live:
            premature = [item for item in native if item["callback"] != "host.route-url" or item["phase"] != "result"]
            premature[-1]["sequence"] = len(premature)
            premature[-1]["monotonic_ms"] = 1000 + len(premature)
            bad = manifest(scenario, "none", premature, wrapper, "expo.subscriber.open-url-forwarded")
            bad["streams"][0]["receipt"] = receipt(premature)
            validate_case("route-intent-cannot-close", bad, [premature, wrapper], should_pass=False)

            duplicate_body = json.loads(json.dumps(body))
            duplicate_body.append(json.loads(json.dumps(body[-1])))
            duplicate = controls(scenario, "none", "swift", duplicate_body)
            bad = manifest(scenario, "none", duplicate, wrapper, "expo.subscriber.open-url-forwarded")
            validate_case("route-second-result-cannot-close-again", bad, [duplicate, wrapper], should_pass=False)

    scenario = "push-tap-warm"
    correlation = {"delivery": "delivery-1", "request": "request-1"}
    warm_startup = [
        record(0, scenario, "apn", "swift", "application.did-become-active", "application-delegate", "os-callback", "state-change", {"flags": {}, "counts": {}, "enums": {"app_state": "active"}}),
        record(0, scenario, "apn", "swift", "expo.subscriber.did-become-active-forwarded", "expo-subscriber", "framework-callback", "state-change", {"flags": {}, "counts": {}, "enums": {"app_state": "active"}}),
        record(0, scenario, "apn", "swift", "expo.notifications-emitter-created", "expo-notifications", "framework-callback", "result"),
    ]
    notification_body = [
        record(0, scenario, "apn", "swift", "notification-center.did-receive-response", "notification-center-delegate", "os-callback", "entry", notification_summary("customerio-messaging-push"), correlation),
        record(0, scenario, "apn", "swift", "customerio.handle-notification-response", "customerio-sdk", "sdk-routing", "result", notification_summary("customerio-messaging-push", True), correlation),
        record(0, scenario, "apn", "swift", "expo.notification-center-manager.did-receive-response-forwarded", "expo-notifications", "framework-callback", "entry", notification_summary("expo-notifications"), correlation),
        record(0, scenario, "apn", "swift", "expo.notifications-emitter.notification-response-event-sent", "expo-notifications", "framework-callback", "result", notification_summary("expo-notifications"), correlation),
    ]
    native = controls(scenario, "apn", "swift", [*warm_startup, *notification_body])
    wrapper = controls(scenario, "apn", "javascript", [record(0, scenario, "apn", "javascript", "wrapper.app-received-notification", "expo-javascript", "app-received", "entry", notification_summary("expo-notifications"), correlation)])
    validate_case("push-tap-warm-with-allowed-startup", manifest(scenario, "apn", native, wrapper, "expo.notifications-emitter.notification-response-event-sent"), [native, wrapper])

    forbidden_launch = record(
        0, scenario, "apn", "swift", "application.did-finish-launching",
        "application-delegate", "os-callback", "entry",
        {"flags": {"has_launch_options": False}, "counts": {"launch_option_keys": 0}, "enums": {"app_state": "inactive"}},
    )
    invalid_warm = controls(scenario, "apn", "swift", [forbidden_launch, *json.loads(json.dumps(warm_startup)), *json.loads(json.dumps(notification_body))])
    invalid_manifest = manifest(scenario, "apn", invalid_warm, wrapper, "expo.notifications-emitter.notification-response-event-sent")
    validate_case("warm-launch-callback-is-rejected", invalid_manifest, [invalid_warm, wrapper], should_pass=False)

    scenario = "token-registration"
    correlation = {"request": "request-1"}
    token_summary = {"flags": {"has_device_token": True}, "counts": {"device_token_bytes": 32}, "enums": {}}
    native = controls(scenario, "apn", "swift", [
        record(0, scenario, "apn", "swift", "application.did-register-for-remote-notifications", "application-delegate", "os-callback", "entry", token_summary, correlation),
        record(0, scenario, "apn", "swift", "customerio.register-device-token", "customerio-sdk", "sdk-routing", "result", token_summary, correlation),
        record(0, scenario, "apn", "swift", "expo.subscriber.did-register-for-remote-notifications-forwarded", "expo-subscriber", "framework-callback", "entry", token_summary, correlation),
    ])
    validate_case(scenario, manifest(scenario, "apn", native, None, None), [native])


if __name__ == "__main__":
    main()
