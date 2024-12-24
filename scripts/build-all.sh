#!/bin/bash

source scripts/utils.sh
set -e

print_heading "Building plugin and generating test app native projects.."

print_blue "\nInstalling root dependencies for plugin and tests...\n"
npm install

print_blue "\nInstalling test-app dependencies...\n"
(cd test-app && npm run preinstall && npm install)

print_blue "\nGenerating Android and iOS native projects...\n"
(cd test-app && npx npx expo prebuild)

print_success "✅ Plugin and test app built successfully!"