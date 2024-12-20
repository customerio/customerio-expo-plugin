#!/bin/bash

set -e

echo "Setting up the test project..."

cd test-app

echo "Installing dependencies..."
npm run preinstall
npm install

echo "Running expo prebuild..."
npx expo prebuild

cd ..
echo "Test project setup complete."