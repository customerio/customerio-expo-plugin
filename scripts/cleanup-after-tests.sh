#!/bin/bash

set -e

echo "Cleaning up temporary files..."

cd test-app

echo "Removing generated directories..."
rm -rf .expo .expo-shared node_modules android ios

cd ..
echo "Cleanup done successfully!"