#!/bin/bash

# Dialogue Editor Launcher
# Starts the dev server and opens the browser automatically

PROJECT_DIR="/Users/ben/Documents/GitHub/articy-clone/dialogue-editor"
URL="http://dialogue.local:3000"
LOG_FILE="/tmp/dialogue-editor.log"
PID_FILE="/tmp/dialogue-editor.pid"

# Check if server is already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        # Server already running, just open browser
        open "$URL"
        exit 0
    fi
fi

# Kill any existing vite processes for this project
pkill -f "vite.*dialogue-editor" 2>/dev/null || true

# Start the dev server in background
cd "$PROJECT_DIR"

# Check if node_modules exists, if not install
if [ ! -d "node_modules" ]; then
    npm install >> "$LOG_FILE" 2>&1
fi

# Start vite dev server
npm run dev >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

# Wait for server to be ready (max 15 seconds)
for i in {1..30}; do
    if curl -s "$URL" > /dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

# Open browser
open "$URL"
