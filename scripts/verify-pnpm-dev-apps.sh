#!/bin/bash

# Asserts that the pnpm dev apps are built with correct artifacts.
# Run after both setup-test-app-pnpm.sh and setup-test-app-pnpm-monorepo.sh.
#
# Two regression dimensions:
#
#   1. Every customerio-reactnative pod line in the Podfile must use the
#      same :path => value. CocoaPods rejects "multiple dependencies with
#      different sources" when our plugin and React Native autolinking
#      emit different paths for the same package, which is the customer-
#      reported failure under pnpm. The actual validity of the path is
#      verified by `pod install` succeeding in the setup-test-app-pnpm{,
#      -monorepo}.sh steps that ran before this script.
#
#   2. `expoVersion` must be present in the installed customerio-reactnative
#      package.json. The RN SDK reads this at runtime to set User-Agent
#      attribution to "Expo" instead of "ReactNative". Under pnpm the
#      postinstall hook can be silently skipped, so the plugin's prebuild-
#      time write must land the field reliably.

set -e

source "$(dirname "$0")/utils.sh"

print_heading "Verifying pnpm dev apps..."

failures=0

PODFILES=(
  "test-app-pnpm/ios/Podfile"
  "test-app-pnpm-monorepo/apps/mobile/ios/Podfile"
)

# Apps whose customerio-reactnative install we need to inspect. The actual
# package.json may land at the leaf app's node_modules (default pnpm
# isolated layout) OR at a parent's node_modules (pnpm hoisted layout, or
# yarn-classic-style hoisting in workspaces) — so we walk up from each app
# and use the first match.
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
print_blue "Checking customerio-reactnative pod :path consistency..."
for podfile in "${PODFILES[@]}"; do
  if [ ! -f "$podfile" ]; then
    echo "::error::$podfile does not exist — did the prebuild step run?"
    failures=$((failures + 1))
    continue
  fi

  # Extract every distinct :path => value across customerio-reactnative pod
  # lines (host app + NSE target). All such values must be identical for
  # CocoaPods to accept the install. The plugin uses one resolved path per
  # prebuild run, so a divergence here would mean either a bug in the
  # snippet builder or autolinking emitting a path the plugin didn't match.
  paths=$(grep -E "^\s*pod 'customerio-reactnative" "$podfile" \
            | grep -E ":path *=> *'[^']*'" \
            | sed -E "s/.*:path *=> *'([^']*)'.*/\1/" \
            | sort -u || true)
  count=$(echo -n "$paths" | grep -c '^' || true)

  if [ "$count" -eq 0 ]; then
    echo "::error::$podfile has no customerio-reactnative pod lines with a baked :path."
    failures=$((failures + 1))
    continue
  fi

  if [ "$count" -gt 1 ]; then
    echo "::error::$podfile has $count differing :path values for customerio-reactnative pods:"
    echo "$paths" | sed 's/^/    /'
    echo "         Every line must agree, otherwise CocoaPods rejects the install."
    failures=$((failures + 1))
    continue
  fi

  echo "  OK: $podfile (:path => '$paths')"
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
