#!/usr/bin/env bash

# macOS-specific wrapper for the unified Unix script
# This script delegates to run_unix.sh for better maintainability

# Make sure we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if run_unix.sh exists, if not fall back to inline implementation
if [ -f "./run_unix.sh" ]; then
  # Set OSTYPE to ensure macOS detection
  export OSTYPE="darwin"
  exec ./run_unix.sh
else
  echo "❌ run_unix.sh not found. Please ensure all scripts are present."
  exit 1
fi


