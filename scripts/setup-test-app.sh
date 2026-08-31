#!/bin/bash

set -e

echo "Setting up the test project..."

cd test-app

# Apply the local.env values that belong to the checked-in app config.
node ../scripts/applyLocalEnvValues.js

# The static half of the graph comes straight from the committed lockfile, so
# two runs of the same commit resolve identical versions. Before this was
# committed, a plain `npm install` against floating ranges (`~55.0.x`,
# `^6.9.0`) resolved three different `customerio-reactnative` versions across
# three CI runs in two days.
echo "Installing dependencies from the committed lockfile..."
npm ci

# The Customer.io plugin is the one deliberately-floating edge, installed as an
# explicit step so the version is chosen here rather than by range resolution.
# Installing it may also move `customerio-reactnative` within its `^` range,
# because the plugin declares an exact peer on it — that is intended, and it is
# the only package allowed to move after `npm ci`.
SDK_VERSION="$(node ../scripts/applyLocalEnvValues.js --print-sdk-version)"
if [ -n "$SDK_VERSION" ]; then
  echo "Installing published customerio-expo-plugin@$SDK_VERSION..."
  npm install "customerio-expo-plugin@$SDK_VERSION" --save-exact
else
  echo "No sdkVersion in local.env — installing the locally built plugin tarball..."
  bash ../scripts/install-plugin-tarball.sh ..
fi

echo "Running expo prebuild..."
npx expo prebuild

cd ..
echo "Test project setup complete."
