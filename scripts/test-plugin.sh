#!/bin/bash

source scripts/utils.sh
set -e

# Check required argument exists
if [[ -z "$1" ]]; then
  echo "❌ Usage: test-plugin.sh [apn|fcm]"
  exit 1
fi

sh ./scripts/clean-all.sh

# Extract push provider from params
case "$1" in
  apn)
    pushProviderValue="apn"
    ;;
  fcm)
    pushProviderValue="fcm"
    ;;
  *)
    echo "❌ Invalid argument: $1"
    echo "Valid options are: apn, fcm"
    exit 1
    ;;
esac

# Generate local.env file with correct pushProvider
rm -f test-app/local.env
touch "test-app/local.env"
echo "pushProvider=$pushProviderValue" >> "test-app/local.env"

# Build plugin and sample app native projects
sh ./scripts/build-all.sh

# Run tests
npm test -- __tests__/android
npm test -- __tests__/ios/common __tests__/ios/$pushProviderValue