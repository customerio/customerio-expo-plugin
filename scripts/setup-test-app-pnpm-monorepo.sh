#!/bin/bash

# Sets up test-app-pnpm-monorepo: produces the plugin tarball at the repo
# root, then `pnpm install` inside the workspace. The mobile app at
# apps/mobile/ depends on customerio-reactnative alongside packages/shared-cio-utils
# so that pnpm has to deduplicate and symlink the SDK across packages — the
# exact shape that surfaced the duplicate-pod bug in real customer monorepos.

set -e

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/utils.sh"

print_heading "Setting up test-app-pnpm-monorepo..."

print_blue "\nGenerating plugin tarball at repo root..."
"$SCRIPT_DIR/create-plugin-tarball.sh" "."

cd test-app-pnpm-monorepo

print_blue "\nInstalling dependencies with pnpm (workspace)..."
pnpm install

print_blue "\nRunning expo prebuild in apps/mobile..."
# Pods are installed by prebuild: the CIO branch pins are applied by the app's own config plugin
# (apps/mobile/plugins/with-cio-inbox-pods.js), so the Podfile is already pinned when prebuild runs
# `pod install`. That plugin covers every prebuild path — this script, `prebuild:ios`, and EAS.
pnpm --filter @cio-test/mobile exec expo prebuild --clean

cd ..

print_success "✅ test-app-pnpm-monorepo setup complete."
