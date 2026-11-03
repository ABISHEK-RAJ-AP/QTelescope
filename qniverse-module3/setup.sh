#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Qniverse Module 2 - Setup                          ║"
echo "╚════════════════════════════════════════════════════════╝"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found"
    exit 1
fi

echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing dependencies..."
cd backend
pip install -q -r requirements.txt
cd ..

mkdir -p frontend backend/logs

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Setup Complete!                                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "To start:"
echo ""
echo "Terminal 1:"
echo "  source venv/bin/activate"
echo "  cd backend && python main.py"
echo ""
echo "Terminal 2:"
echo "  cd frontend && python -m http.server 8080"
echo ""
echo "Browser: http://localhost:8080"