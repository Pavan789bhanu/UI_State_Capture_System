#!/bin/bash

# Verification script for UI Capture System

echo "🔍 Verifying UI Capture System Setup..."
echo ""

ERRORS=0

# Check Python
echo "1️⃣  Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "   ✅ Python $PYTHON_VERSION found"
else
    echo "   ❌ Python not found"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo "2️⃣  Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js $NODE_VERSION found"
else
    echo "   ❌ Node.js not found"
    ERRORS=$((ERRORS + 1))
fi

# Check project structure
echo "3️⃣  Checking project files..."
REQUIRED_FILES=(
    "api_server.py"
    "main.py"
    "config.py"
    "requirements.txt"
    "agent/vision_agent.py"
    "browser/browser_manager.py"
    "workflow/workflow_engine.py"
    "frontend/package.json"
    "frontend/src/services/api.ts"
    "frontend/src/pages/Dashboard.tsx"
    "frontend/src/pages/WorkflowsPage.tsx"
    "frontend/src/pages/ExecutionsPage.tsx"
    "frontend/src/pages/AnalyticsPage.tsx"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check .env file
echo "4️⃣  Checking configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    if grep -q "OPENAI_API_KEY=your_openai_api_key_here" .env; then
        echo "   ⚠️  Warning: Please update OPENAI_API_KEY in .env"
    else
        echo "   ✅ OPENAI_API_KEY appears to be set"
    fi
else
    echo "   ⚠️  .env file not found (will be created on first run)"
fi

# Check frontend .env
if [ -f "frontend/.env" ]; then
    echo "   ✅ frontend/.env exists"
else
    echo "   ⚠️  frontend/.env not found (will be created on first run)"
fi

# Check Python dependencies
echo "5️⃣  Checking Python dependencies..."
if pip show fastapi &> /dev/null; then
    echo "   ✅ FastAPI installed"
else
    echo "   ❌ FastAPI not installed"
    ERRORS=$((ERRORS + 1))
fi

if pip show playwright &> /dev/null; then
    echo "   ✅ Playwright installed"
else
    echo "   ❌ Playwright not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check frontend dependencies
echo "6️⃣  Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo "   ✅ node_modules exists"
else
    echo "   ⚠️  node_modules not found (run: cd frontend && npm install)"
fi

# Check scripts
echo "7️⃣  Checking scripts..."
if [ -x "start.sh" ]; then
    echo "   ✅ start.sh is executable"
else
    echo "   ⚠️  start.sh not executable (run: chmod +x start.sh)"
fi

if [ -x "stop.sh" ]; then
    echo "   ✅ stop.sh is executable"
else
    echo "   ⚠️  stop.sh not executable (run: chmod +x stop.sh)"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! System is ready."
    echo ""
    echo "Next steps:"
    echo "1. Update OPENAI_API_KEY in .env file"
    echo "2. Run: ./start.sh"
    echo "3. Open: http://localhost:5176"
else
    echo "❌ Found $ERRORS error(s). Please fix them before starting."
    echo ""
    echo "Quick fixes:"
    echo "  pip install -r requirements.txt"
    echo "  python -m playwright install"
    echo "  cd frontend && npm install"
    echo "  chmod +x start.sh stop.sh"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
