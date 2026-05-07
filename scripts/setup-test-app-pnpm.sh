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

print_blue "\nRunning expo prebuild..."
pnpm exec expo prebuild --clean

cd ..

print_success "✅ test-app-pnpm setup complete."
