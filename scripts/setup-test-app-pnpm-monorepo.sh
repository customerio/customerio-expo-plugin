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
pnpm --filter @cio-test/mobile exec expo prebuild --clean

cd ..

print_success "✅ test-app-pnpm-monorepo setup complete."
