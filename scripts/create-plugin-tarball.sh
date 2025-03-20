#!/bin/bash

# Generates a tarball for npm package with a consistent name for expo plugin.
#
# Usage: npm run create-plugin-tarball.sh {PLUGIN_PATH_RELATIVE} [Default: `..` (one level up)]

# Store script's directory
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/utils.sh"

set -e

# Define constants
PLUGIN_NAME="customerio-expo-plugin"
PLUGIN_PATH_RELATIVE=${1:-..}
TARBALL_NAME="$PLUGIN_NAME-latest.tgz"
TARBALL_PATTERN="$PLUGIN_NAME-*.tgz"
START_DIR=$(pwd)

print_heading "Running create-plugin-tarball.sh script..."

print_blue "Starting in directory: '$START_DIR' with relative plugin path: '$PLUGIN_PATH_RELATIVE'"
print_blue "Generating tarball for expo plugin...\n"

# Navigate to root plugin directory
cd $PLUGIN_PATH_RELATIVE
# Remove any existing matching tarball to avoid conflicts
rm -f $TARBALL_PATTERN
# Generate the tarball using npm pack
# This creates a tarball named based on the `name` and `version` fields in the package.json
npm pack --silent
# Rename the tarball to a consistent name
mv $TARBALL_PATTERN $TARBALL_NAME
print_blue "\nTarball created successfully: '$TARBALL_NAME' at '$(pwd)'"

# Return to the starting directory
cd $START_DIR
print_blue "Returned to directory: '$(pwd)'"
