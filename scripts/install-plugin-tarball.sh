#!/bin/bash

# Generates a tarball for npm package with consistent name for Expo plugin and installs it 
# as a dependency in the app running this script.
#
# Usage: npm run install-plugin-tarball.sh {PLUGIN_PATH_RELATIVE} [Default: `..` (one level up)]
# Or run automatically via npm install or preinstall in the test app.

# Store script's directory
SCRIPT_DIR="$(dirname "$0")"
# Includes utils.sh script located in the same directory as this script
source "$SCRIPT_DIR/utils.sh"

set -e

# Define constants
PLUGIN_NAME="customerio-expo-plugin"
PLUGIN_PATH_RELATIVE=${1:-..} # Default plugin path to `..` if no argument is provided
TARBALL_NAME=$PLUGIN_NAME-latest.tgz

print_heading "Running install-plugin-tarball.sh script..."

# Generate the tarball
"$SCRIPT_DIR/create-plugin-tarball.sh" "$PLUGIN_PATH_RELATIVE"

print_blue "Uninstalling existing expo plugin and installing tarball dependency to ensure it is up-to-date..."
npm uninstall $PLUGIN_NAME --no-save
npm install "$PLUGIN_PATH_RELATIVE/$TARBALL_NAME" --silent

print_success "✅ $TARBALL_NAME dependency installed successfully!"
