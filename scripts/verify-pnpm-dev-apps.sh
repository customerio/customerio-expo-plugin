#!/bin/bash

# Asserts that the pnpm dev apps are built with correct artifacts.
# Run after both setup-test-app-pnpm.sh and setup-test-app-pnpm-monorepo.sh.
#
# Two regression dimensions:
#
#   1. The Podfile must emit the install-time `customerio_reactnative_path`
#      Ruby lambda, and every `pod 'customerio-reactnative...', :path =>`
#      line must reference the variable rather than a baked path string.
#      This is what guarantees the plugin's path agrees with whatever path
#      React Native autolinking emits in the same Podfile, regardless of
#      pnpm/yarn/symlink behavior.
#
#      The actual path validity is enforced by `pod install` succeeding in
#      the setup-test-app-pnpm{,-monorepo}.sh steps that ran before this
#      script — those would already have failed if the resolved path were
#      bogus. This script's job is to catch plugin bugs that re-introduce
#      a baked-path :path => before pod install runs.
#
#   2. `expoVersion` must be present in the installed customerio-reactnative
#      package.json. The RN SDK reads this at runtime to set User-Agent
#      attribution to "Expo" instead of "ReactNative". Under pnpm the
#      postinstall hook can be silently skipped, so the plugin's prebuild-
#      time fallback must land the field reliably.

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
print_blue "Checking install-time path-resolver lambda is emitted..."
for podfile in "${PODFILES[@]}"; do
  if [ ! -f "$podfile" ]; then
    echo "::error::$podfile does not exist — did the prebuild step run?"
    failures=$((failures + 1))
    continue
  fi

  if ! grep -q "customerio_reactnative_path = (lambda do" "$podfile"; then
    echo "::error::$podfile is missing the customerio_reactnative_path lambda."
    echo "         The plugin should emit a Ruby block that resolves the SDK path"
    echo "         at pod install time via Node's require.resolve."
    failures=$((failures + 1))
    continue
  fi

  if ! grep -q "node --print \"require.resolve('customerio-reactnative/package.json')\"" "$podfile"; then
    echo "::error::$podfile lambda is missing the node --print require.resolve call."
    failures=$((failures + 1))
    continue
  fi

  # Every customerio-reactnative pod line must reference the variable, not a
  # baked path string. A baked-path regression looks like
  # `:path => '../node_modules/...'` instead of `:path => customerio_reactnative_path`.
  baked=$(grep -E "^\s*pod 'customerio-reactnative.*':path *=> *'" "$podfile" || true)
  if [ -n "$baked" ]; then
    echo "::error::$podfile contains a customerio-reactnative pod line with a baked :path => string:"
    echo "$baked"
    echo "         Expected every such line to use ':path => customerio_reactnative_path'."
    failures=$((failures + 1))
    continue
  fi

  echo "  OK: $podfile"
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
