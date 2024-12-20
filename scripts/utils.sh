#!/bin/bash

# Colors and Formatting
GREEN='\033[0;32m'
BLUE='\033[1;34m'
BOLD='\033[1m'
RESET='\033[0m'

print_heading() {
  echo "==========================="
  echo -e "${BOLD}${BLUE}$1${RESET}"
  echo "==========================="
}

print_blue() {
  echo -e "${BLUE}$1${RESET}"
}

print_success() {
  echo -e "\n${BOLD}${GREEN}$1${RESET}\n"
}
