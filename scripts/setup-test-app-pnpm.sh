#!/bin/bash

# Sets up test-app-pnpm: produces the plugin tarball at the repo root, then
# `pnpm install` inside the dev app. This is the pnpm equivalent of
# setup-test-app.sh for the npm test-app/.

set -e

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/utils.sh"

print_heading "Setting up test-app-pnpm..."

print_blue "\nGenerating plugin tarball at repo root..."
"$SCRIPT_DIR/create-plugin-tarball.sh" "."

cd test-app-pnpm

print_blue "\nInstalling dependencies with pnpm..."
pnpm install

# On macOS `expo prebuild` also runs `pod install`; on Linux (CI) CocoaPods
# is unavailable, so skip the post-prebuild install there with --no-install.
# The Podfile is still generated and verify-pnpm-dev-apps.sh only makes text
# assertions, which don't need pods.
PREBUILD_ARGS=(--clean)
if [ "$(uname -s)" != "Darwin" ]; then
  PREBUILD_ARGS+=(--no-install)
fi

print_blue "\nRunning expo prebuild..."
pnpm exec expo prebuild "${PREBUILD_ARGS[@]}"

cd ..

print_success "✅ test-app-pnpm setup complete."
