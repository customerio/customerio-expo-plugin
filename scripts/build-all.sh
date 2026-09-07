#!/bin/bash

source scripts/utils.sh
set -e

print_heading "Building plugin and generating test app native projects.."

print_blue "\nInstalling root dependencies for plugin and tests...\n"
npm install

print_blue "\nInstalling test-app dependencies and generating native projects...\n"
bash scripts/setup-test-app.sh

print_success "✅ Plugin and test app built successfully!"