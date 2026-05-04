#!/bin/bash

# Cleans the pnpm dev apps and the cached plugin tarball at the repo root.
# Does not touch the npm test-app/ — see clean-all.sh for that.

source scripts/utils.sh
set -e

print_heading "Cleaning pnpm dev apps..."

for pnpm_app in test-app-pnpm test-app-pnpm-monorepo; do
  if [ -d "$pnpm_app" ]; then
    echo -e "\nCleaning $pnpm_app..."
    rm -rf "$pnpm_app/node_modules" "$pnpm_app/pnpm-lock.yaml" "$pnpm_app/.expo"
    rm -rf "$pnpm_app/ios" "$pnpm_app/android"
    # Workspace variant has its node_modules inside apps/* and packages/*
    rm -rf "$pnpm_app"/apps/*/node_modules "$pnpm_app"/apps/*/.expo
    rm -rf "$pnpm_app"/apps/*/ios "$pnpm_app"/apps/*/android
    rm -rf "$pnpm_app"/packages/*/node_modules
    echo "Cleaned $pnpm_app!"
  fi
done

# Remove the cached plugin tarball at the repo root so the next setup picks
# up a fresh build.
rm -f customerio-expo-plugin-latest.tgz

print_success "✅ pnpm dev app cleanup done!"
