#!/bin/bash

source scripts/utils.sh
set -e

# Check required argument exists
if [[ -z "$1" ]]; then
  echo "❌ Usage: test-plugin.sh [apn|fcm]"
  exit 1
fi

sh ./scripts/clean-all.sh

# Generate local.env file with correct pushProvider
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

rm -f test-app/local.env
touch "test-app/local.env"
echo "pushProvider=$pushProviderValue" >> "test-app/local.env"

# echo "Setting up the test project..."

# cd test-app

# echo "Installing dependencies..."
# npm run preinstall
# npm install

# echo "Running expo prebuild..."
# npx expo prebuild
sh ./scripts/build-all.sh

npm test -- __tests__/android
npm test -- __tests__/ios/common __tests__/ios/$pushProviderValue