#!/bin/bash

# Asserts that the pnpm dev apps are built with portable, correct artifacts.
# Run after both setup-test-app-pnpm.sh and setup-test-app-pnpm-monorepo.sh.
#
# Two regression dimensions:
#
#   1. Podfile :path values must not contain `.pnpm/` — the plugin must emit
#      the symlinked node_modules path that React Native autolinking expects,
#      not the realpath inside pnpm's virtual store.
#
#   2. `expoVersion` must be present in the installed customerio-reactnative
#      package.json. The RN SDK reads this at runtime to set User-Agent
#      attribution to "Expo" instead of "ReactNative". Under pnpm the
#      postinstall hook can be silently skipped, so the plugin must also
#      write this at expo-prebuild time.

set -e

source "$(dirname "$0")/utils.sh"

print_heading "Verifying pnpm dev apps..."

failures=0

PODFILES=(
  "test-app-pnpm/ios/Podfile"
  "test-app-pnpm-monorepo/apps/mobile/ios/Podfile"
)

# Apps whose customerio-reactnative install we need to inspect. The package
# may live at the leaf app's node_modules (default pnpm isolated layout) OR
# at a parent's node_modules (pnpm hoisted layout, or yarn-classic-style
# hoisting in workspaces). We walk up from each app and use the first match.
APP_DIRS=(
  "test-app-pnpm"
  "test-app-pnpm-monorepo/apps/mobile"
)

# Echoes the path to customerio-reactnative/package.json reachable from
# $1 by walking up directories, or returns 1 if none is found.
find_cio_pkg_json() {
  local dir="$1"
  while :; do
    local candidate="$dir/node_modules/customerio-reactnative/package.json"
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
    local parent
    parent=$(dirname "$dir")
    if [ "$parent" = "$dir" ]; then
      return 1
    fi
    dir="$parent"
  done
}

echo
print_blue "Checking Podfile :path values..."
for podfile in "${PODFILES[@]}"; do
  if [ ! -f "$podfile" ]; then
    echo "::error::$podfile does not exist — did the prebuild step run?"
    failures=$((failures + 1))
    continue
  fi

  offending=$(grep -E "^\s*pod .* :path =>" "$podfile" | grep "\.pnpm/" || true)
  if [ -n "$offending" ]; then
    echo "::error::$podfile contains .pnpm/ in a :path => line."
    echo "Plugin emitted the pnpm realpath instead of the symlink path that React Native autolinking expects."
    echo "$offending"
    failures=$((failures + 1))
  else
    echo "  OK: $podfile"
  fi
done

echo
print_blue "Checking expoVersion in customerio-reactnative/package.json..."
for app_dir in "${APP_DIRS[@]}"; do
  if ! pkg=$(find_cio_pkg_json "$app_dir"); then
    echo "::error::could not find customerio-reactnative/package.json reachable from $app_dir — did pnpm install run?"
    failures=$((failures + 1))
    continue
  fi

  if grep -q '"expoVersion"' "$pkg"; then
    echo "  OK: $pkg"
  else
    echo "::error::$pkg is missing expoVersion."
    echo "User-Agent attribution will report ReactNative instead of Expo."
    failures=$((failures + 1))
  fi
done

echo
if [ "$failures" -ne 0 ]; then
  echo "::error::pnpm dev app verification failed: $failures issue(s)."
  exit 1
fi

print_success "✅ pnpm dev apps verified."
