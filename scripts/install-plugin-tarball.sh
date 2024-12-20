#!/bin/bash

# Script that generates a tarball for the npm package.
#
# Designed to be run before installing dependencies in the app.
#
# Use script: npm run install (in test-app)
# Ensures the tarball name is consistent to avoid unnecessary git diffs.

# Includes utils.sh script located in the same directory as this script
source "$(dirname "$0")/utils.sh"
set -e

# Define constants
PLUGIN_NAME="customerio-expo-plugin"
PLUGIN_PATH_RELATIVE=${1:-..} # Default plugin path to `..` if no argument is provided
TARBALL_NAME=$PLUGIN_NAME-latest.tgz
TARBALL_PATTERN=$PLUGIN_NAME-*.tgz
START_DIR=$(pwd) # Save the current directory (starting directory)

print_heading "Running install-plugin-tarball.sh script..."

print_blue "Starting in directory: '$START_DIR' with relative plugin path: '$PLUGIN_PATH_RELATIVE'"
print_blue "Generating tarball for expo plugin...\n"

# Navigate to root plugin directory
cd $PLUGIN_PATH_RELATIVE
# Remove any existing matching tarball to avoid conflicts
rm $TARBALL_PATTERN || true
# Generate the tarball using npm pack
# This creates a tarball named based on the `name` and `version` fields in the package.json
npm pack --silent
# Rename the tarball to a consistent name
mv $TARBALL_PATTERN $TARBALL_NAME
print_blue "\nTarball created successfully: '$TARBALL_NAME' at '$(pwd)'"

# Return to the starting directory
cd $START_DIR
print_blue "Returned to directory: '$(pwd)'"

print_blue "Uninstalling existing expo plugin and installing tarball dependency to ensure it is up-to-date..."
npm uninstall $PLUGIN_NAME --no-save
npm install "$PLUGIN_PATH_RELATIVE/$TARBALL_NAME" --silent

print_success "✅ $TARBALL_NAME dependency installed successfully!"
