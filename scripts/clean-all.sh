#!/bin/bash

source scripts/utils.sh
set -e

print_heading "Cleaning all resolved dependencies and generated projects..."

# Delete root dependencies
echo -e "\nDeleting root node_modules directory..."
rm -rf node_modules
echo "Deleted root node_modules directory!"

echo -e "\nDeleting root package-lock.json file..."
rm -f package-lock.json
echo "Deleted root package-lock.json file!"


# Delete plugin build files
echo -e "\nDeleting plugin lib directory..."
rm -rf plugin/lib
echo "Deleted plugin lib directory!"


# Delete test app depdencies and generated native projects
echo -e "\nDeleting Test App node_modules directory..."
rm -rf test-app/node_modules
echo "Deleted Test App node_modules directory!"

echo -e "\nDeleting Test App package-lock.json file..."
rm -f test-app/package-lock.json
echo "Deleted Test App package-lock.json file!"

echo -e "\nDeleting Test App .expo directories..."
rm -rf test-app/.expo test-app/.expo-shared
echo "Deleted Test App .expo directories!"

echo -e "\nDeleting Test App Android directory..."
rm -rf test-app/android
echo "Deleted Test App Android directory!"

echo -e -e "\nDeleting Test App iOS directory..."
rm -rf test-app/ios
echo "Deleted Test App iOS directory!"

print_success "✅ Cleanup done successfully!"
