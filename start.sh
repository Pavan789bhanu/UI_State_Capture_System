#!/bin/bash

# UI Capture System - Quick Start Script
# This script starts both frontend and backend servers

echo "🚀 Starting UI Capture System..."
echo ""

# Check if we're in the right directory
if [ ! -f "api_server.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating template..."
    cat > .env << 'EOF'
# OpenAI API Key (Required)
OPENAI_API_KEY=your_openai_api_key_here

# LLM Model
LLM_MODEL=gpt-4o

# Directories
SCREENSHOT_DIR=./captured_dataset
USER_DATA_DIR=./browser_session_data

# Timeout (milliseconds)
TIMEOUT=10000
EOF
    echo "✅ Created .env template. Please add your OPENAI_API_KEY"
    echo ""
fi

# Check if frontend .env exists
if [ ! -f "frontend/.env" ]; then
    echo "📝 Creating frontend .env file..."
    cat > frontend/.env << 'EOF'
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
EOF
    echo "✅ Frontend .env created"
    echo ""
fi

# Create data directory
mkdir -p data
mkdir -p captured_dataset
mkdir -p browser_session_data

# Start backend in background
echo "🔧 Starting Backend API Server..."
python api_server.py > backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID) - Logs: backend.log"
echo "📡 API: http://localhost:8000"
echo ""

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting Frontend Dev Server..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "✅ Frontend started (PID: $FRONTEND_PID) - Logs: frontend.log"
echo "🌐 UI: http://localhost:5176"
echo ""

# Save PIDs for easy cleanup
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ System is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Quick Links:"
echo "   Frontend: http://localhost:5176"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📊 Check Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 Stop System:"
echo "   ./stop.sh"
echo ""
echo "Press Ctrl+C to stop both servers..."

# Wait for Ctrl+C
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .backend.pid .frontend.pid; echo '✅ Stopped'; exit 0" INT
wait
