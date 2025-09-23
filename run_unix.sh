#!/usr/bin/env bash
set -euo pipefail

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
fi

# Small helper
have() { command -v "$1" >/dev/null 2>&1; }

echo ""
echo "🌊 ============================================"
echo "   🎨 VIBRANT WAVE MINI 🎨"
echo "============================================"
echo ""

echo "🚀 [vibrant-wave-mini] Checking bun..."
if ! have bun; then
  echo "⚠️  bun not found. Installing..."
  if [[ "$OS" == "macos" ]] && have brew; then
    echo "📦 Installing via Homebrew..."
    brew tap oven-sh/bun || true
    brew install bun || true
  else
    echo "📦 Installing via curl script..."
    curl -fsSL https://bun.sh/install | bash
  fi
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

if ! have bun; then
  echo "❌ bun is not on PATH. Add \"$HOME/.bun/bin\" to PATH or restart your shell."
  exit 1
else
  echo "✅ bun found and ready!"
fi

echo "📦 [vibrant-wave-mini] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "🔄 Installing dependencies..."
  bun install
  echo "✅ Dependencies installed!"
else
  echo "✅ Dependencies already installed!"
fi

echo "🔑 [vibrant-wave-mini] Checking OPENROUTER_API_KEY..."
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  FOUND_KEY=0
  if [ -f ".env.local" ] && grep -qE '^OPENROUTER_API_KEY=.*' .env.local; then
    FOUND_KEY=1
  fi
  if [ -f ".env" ] && grep -qE '^OPENROUTER_API_KEY=.*' .env; then
    FOUND_KEY=1
  fi
  if [ $FOUND_KEY -eq 0 ]; then
    echo "❌ Missing OPENROUTER_API_KEY in environment or .env files"
    echo "Create .env or .env.local with:"
    echo "OPENROUTER_API_KEY=sk-or-..."
    echo "# Optional:" 
    echo "OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image-preview"
    exit 1
  else
    echo "✅ OPENROUTER_API_KEY found in .env files"
  fi
fi

echo ""
echo "🚀 [vibrant-wave-mini] Starting dev server..."
echo "⏳ [vibrant-wave-mini] Waiting for server to start..."

# Start dev server in background and capture output
bun run dev > dev_output.log 2>&1 &
DEV_PID=$!

# Wait for server to start (check for typical Next.js output)
wait_for_server() {
  while true; do
    if grep -q "Local:" dev_output.log 2>/dev/null || grep -q "ready" dev_output.log 2>/dev/null; then
      break
    fi
    sleep 2
  done
}

wait_for_server

# Extract port from dev output (default 3000)
PORT=3000
if grep -q "Local:" dev_output.log; then
  PORT=$(grep "Local:" dev_output.log | sed -n 's/.*Local:[[:space:]]*[^:]*:\([0-9]*\).*/\1/p' | head -1)
fi

echo "✅ [vibrant-wave-mini] Server started on port $PORT"
echo "🌐 [vibrant-wave-mini] Opening browser..."

# Open browser (OS-specific)
if [[ "$OS" == "macos" ]]; then
  open "http://localhost:$PORT"
elif [[ "$OS" == "linux" ]]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
  elif command -v firefox >/dev/null 2>&1; then
    firefox "http://localhost:$PORT" &
  elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome "http://localhost:$PORT" &
  else
    echo "⚠️  [vibrant-wave-mini] Could not find browser command. Please open http://localhost:$PORT manually."
  fi
else
  echo "⚠️  [vibrant-wave-mini] Unknown OS. Please open http://localhost:$PORT manually."
fi

# Show the log output
echo ""
echo "📋 [vibrant-wave-mini] Development server output:"
echo "============================================"
cat dev_output.log
echo "============================================"

# Clean up on exit
cleanup() {
  kill $DEV_PID 2>/dev/null || true
  rm -f dev_output.log
}
trap cleanup EXIT

# Wait for the dev server process
wait $DEV_PID
