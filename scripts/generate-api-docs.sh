#!/bin/bash

source scripts/utils.sh
set -e

print_heading "Generating API Documentation with API Extractor"

print_blue "\nInstalling dependencies...\n"
npm install

print_blue "\nRunning API Extractor to generate documentation...\n"
npx api-extractor run --local --verbose

print_blue "\nCleaning up temporary files...\n"
rm -rf api-extractor-output/temp/

print_success "✅ API documentation generated successfully!"
print_blue "Check the api-extractor-output/ directory for the generated API report." 