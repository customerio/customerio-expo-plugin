#!/usr/bin/env bash
# Fast compile evidence for the MBL-2232 probe sources (macOS + Xcode only).
#
# Evidence classes, weakest to strongest:
#   parse      swiftc -parse       syntax only, no imports resolved
#   typecheck  swiftc -typecheck   full type checking against the iOS SDK
#   build      xcodebuild          probe compiled+linked inside a prebuilt app
#
# The trace support imports Apple SDK frameworks only, so it typechecks standalone. The
# no-seat control bridge imports ExpoModulesCore, which only exists inside a
# pod-installed app. It can be parsed standalone and is typechecked by the app
# build
# (scripts/compatibility/validate-plugin.js or a manual xcodebuild).
set -euo pipefail

PROBE_IOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../probe-module/ios" && pwd)"
SDK_PATH="$(xcrun --show-sdk-path --sdk iphonesimulator)"
TARGET="arm64-apple-ios16.4-simulator"

echo "==> typecheck (SDK: ${SDK_PATH##*/}, target: ${TARGET})"
xcrun swiftc -typecheck -sdk "$SDK_PATH" -target "$TARGET" \
  "$PROBE_IOS_DIR"/LifecycleTrace*.swift
echo "OK  Apple SDK trace support typechecks against the iOS simulator SDK"

echo "==> parse (ExpoModulesCore-dependent bridge; full typecheck happens in the app build)"
xcrun swiftc -parse "$PROBE_IOS_DIR/CioLifecycleProbeModule.swift"
echo "OK  CioLifecycleProbeModule.swift parses"

echo "All probe compile checks passed at their respective evidence levels."
