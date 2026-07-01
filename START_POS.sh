#!/bin/bash

# Vendora Quick Start - Run on Mac/Linux
# Make executable: chmod +x START_POS.sh
# Then double-click or run: ./START_POS.sh

echo ""
echo "========================================"
echo "  Vendora - Point of Sale System"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Then run this file again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] Node.js detected"
node --version

# Check if we're in the right directory
if [ ! -f "backend/server.js" ]; then
    echo ""
    echo "ERROR: backend/server.js not found"
    echo "Please make sure this file is in the Vendora project root directory"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] Project files found"
echo ""

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies (this may take a minute)..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Failed to install dependencies"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

echo ""
echo "========================================"
echo "  Starting Vendora Server..."
echo "========================================"
echo ""
echo "Open your browser and go to: http://localhost:3000"
echo ""
echo "To stop the server, press Ctrl+C"
echo ""

# Start the server
cd backend
node server.js

# If server exits, show a message
echo ""
echo "The server has stopped."
read -p "Press Enter to exit..."
