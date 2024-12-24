#!/bin/bash

set -e 

VERSION=$1

# version in package.json has already been updated when the git tag was made. 
# we just need to push. 

if [[ "$NPM_TOKEN" == "" ]]; then # makes sure auth token is set. 
    echo "Forgot to set environment variable NPM_TOKEN (value found in 1password for Ami npm account). Set it, then try again."
    echo "Set variable with command (yes, with the double quotes around the variable value): export NAME_OF_VAR=\"foo\""
    exit 1
fi 

echo "Setting up configuration file that will authenticate your computer with npm server..."

NPM_CONFIG_FILE_PATH="$(npm config get userconfig)"
if [[ "$NPM_CONFIG_FILE_PATH" == "" ]]; then # makes sure auth token is set. 
    NPM_CONFIG_FILE_PATH="~/.npmrc"
fi 

echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "$NPM_CONFIG_FILE_PATH"

echo "Testing authentication. This next command should not fail and should print the username of the npm Ami account..."
npm whoami
echo "Authentication complete."

npm unpublish customerio-expo-plugin@$VERSION