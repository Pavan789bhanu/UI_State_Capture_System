#!/bin/bash

# Stop both frontend and backend servers

echo "🛑 Stopping UI Capture System..."

# Read PIDs from files
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    kill $BACKEND_PID 2>/dev/null
    echo "✅ Backend stopped (PID: $BACKEND_PID)"
    rm .backend.pid
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Frontend stopped (PID: $FRONTEND_PID)"
    rm .frontend.pid
fi

# Also kill any running processes on the ports
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5176 | xargs kill -9 2>/dev/null

echo "✅ All servers stopped"
