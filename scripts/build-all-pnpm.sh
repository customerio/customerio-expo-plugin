#!/bin/bash

# Sets up both pnpm dev apps end-to-end: rebuilds the plugin, regenerates
# the tarball, installs into each pnpm dev app, and runs expo prebuild.
# Does not touch the npm test-app/ — see build-all.sh for that.

source scripts/utils.sh
set -e

print_heading "Building plugin and setting up pnpm dev apps..."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required for this script. Install it first: npm install -g pnpm"
  exit 1
fi

print_blue "\nInstalling root dependencies for plugin...\n"
npm install

print_blue "\nSetting up test-app-pnpm...\n"
bash scripts/setup-test-app-pnpm.sh

print_blue "\nSetting up test-app-pnpm-monorepo...\n"
bash scripts/setup-test-app-pnpm-monorepo.sh

print_success "✅ Plugin and pnpm dev apps built successfully!"
