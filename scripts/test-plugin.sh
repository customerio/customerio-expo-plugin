#!/bin/bash

# Example usages:
#   npm run test-plugin -- apn
#   npm run test-plugin -- apn --skip-build
#   npm run test-plugin -- fcm -u
#   npm run test-plugin -- fcm --skip-build -u

source scripts/utils.sh
set -e

# Parse flags
SKIP_BUILD=false
UPDATE_SNAPSHOTS=false
PUSH_PROVIDER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    -u|--update-snapshots)
      UPDATE_SNAPSHOTS=true
      shift
      ;;
    apn|fcm)
      if [[ -z "$PUSH_PROVIDER" ]]; then
        PUSH_PROVIDER="$1"
      else
        echo "❌ Multiple push providers specified"
        echo "Usage: npm run test-plugin -- [apn|fcm] [--skip-build] [-u|--update-snapshots]"
        exit 1
      fi
      shift
      ;;
    *)
      echo "❌ Unknown option: $1"
      echo "Usage: npm run test-plugin -- [apn|fcm] [--skip-build] [-u|--update-snapshots]"
      exit 1
      ;;
  esac
done

# Check required argument exists
if [[ -z "$PUSH_PROVIDER" ]]; then
  echo "❌ Usage: npm run test-plugin -- [apn|fcm] [--skip-build] [-u|--update-snapshots]"
  exit 1
fi

# Skip clean and build if flag is set
if [[ "$SKIP_BUILD" == false ]]; then
  sh ./scripts/clean-all.sh
fi

# Extract push provider from params
case "$PUSH_PROVIDER" in
  apn)
    pushProviderValue="apn"
    ;;
  fcm)
    pushProviderValue="fcm"
    ;;
  *)
    echo "❌ Invalid argument: $PUSH_PROVIDER"
    echo "Valid options are: apn, fcm"
    exit 1
    ;;
esac

# Generate local.env file with correct pushProvider
rm -f test-app/local.env
touch "test-app/local.env"
echo "pushProvider=$pushProviderValue" >> "test-app/local.env"

# Build plugin and sample app native projects
if [[ "$SKIP_BUILD" == false ]]; then
  sh ./scripts/build-all.sh
fi

# Run tests
SNAPSHOT_FLAG=""
if [[ "$UPDATE_SNAPSHOTS" == true ]]; then
  SNAPSHOT_FLAG="-u"
fi

npm test $SNAPSHOT_FLAG -- __tests__/utils
npm test $SNAPSHOT_FLAG -- __tests__/android
npm test $SNAPSHOT_FLAG -- __tests__/ios/common __tests__/ios/$pushProviderValue
