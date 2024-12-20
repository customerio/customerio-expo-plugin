#!/bin/bash

# Script that generates a tarball for the npm package.
#
# Designed to be run before installing dependencies in the app.
#
# Use script: npm run install (in test-app)
# Ensures the tarball name is consistent to avoid unnecessary git diffs.

set -e

# Define constants
PLUGIN_NAME="customerio-expo-plugin"
PLUGIN_PATH_RELATIVE=${1:-..} # Default plugin path to `..` if no argument is provided
TARBALL_NAME=$PLUGIN_NAME-latest.tgz
TARBALL_PATTERN=$PLUGIN_NAME-*.tgz
START_DIR=$(pwd) # Save the current directory (starting directory)

echo "================================="
echo "Running install-plugin-tarball.sh"
echo "================================="
echo "Starting in directory: $START_DIR with relative plugin path: $PLUGIN_PATH_RELATIVE"
echo "Generating tarball for the plugin..."

# Navigate to root plugin directory
cd $PLUGIN_PATH_RELATIVE
# Remove any existing matching tarball to avoid conflicts
rm $TARBALL_PATTERN || true
# Generate the tarball using npm pack
# This creates a tarball named based on the `name` and `version` fields in the package.json
npm pack --silent
# Rename the tarball to a consistent name
mv $TARBALL_PATTERN $TARBALL_NAME
echo "Tarball created: $TARBALL_NAME" at $(pwd)

# Return to the starting directory
cd $START_DIR
echo "Returned to directory: $START_DIR"

echo "Uninstalling existing plugin and installing the tarball to ensure it's up-to-date..."
npm uninstall $PLUGIN_NAME --no-save
npm install "$PLUGIN_PATH_RELATIVE/$TARBALL_NAME" --silent

echo "Plugin tarball installed successfully!"

echo "==================================="
echo "install-plugin-tarball.sh completed"
echo "==================================="
