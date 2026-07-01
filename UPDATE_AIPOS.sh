#!/bin/bash

# Vendora Auto-Updater for Mac/Linux
# Make executable: chmod +x UPDATE_AIPOS.sh
# Then run: ./UPDATE_VENDORA.sh

echo ""
echo "========================================"
echo "  Vendora - Auto Updater"
echo "========================================"
echo ""

# Get current version
if [ -f version.txt ]; then
    CURRENT_VERSION=$(head -n 1 version.txt)
else
    CURRENT_VERSION="unknown"
fi

echo "Current version: $CURRENT_VERSION"
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git is not installed"
    echo ""
    echo "Install Git:"
    echo "  Mac: brew install git"
    echo "  Linux: sudo apt-get install git"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[INFO] Checking for updates..."
echo ""

# Fetch latest version from GitHub
# Replace 'your-repo' with your actual GitHub username/repo
LATEST_VERSION=$(curl -s https://raw.githubusercontent.com/your-repo/aipos/main/version.txt 2>/dev/null | head -n 1)

if [ -z "$LATEST_VERSION" ]; then
    echo "[ERROR] Could not check for updates"
    echo ""
    echo "Make sure:"
    echo "- You have internet connection"
    echo "- Replace 'your-repo' in this script with your GitHub repo"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Latest version: $LATEST_VERSION"
echo ""

# Compare versions
if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
    echo "[OK] You are already on the latest version!"
    echo ""
    read -p "Press Enter to exit..."
    exit 0
fi

echo "[INFO] Update available: $CURRENT_VERSION → $LATEST_VERSION"
echo ""

# Ask user to confirm
read -p "Do you want to update now? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Update cancelled."
    read -p "Press Enter to exit..."
    exit 0
fi

echo ""
echo "[INFO] Starting update..."
echo ""

# Backup database
if [ -f pos.db ]; then
    echo "[INFO] Backing up database..."
    BACKUP_FILE="pos.db.backup.$(date +%Y%m%d_%H%M%S)"
    cp pos.db "$BACKUP_FILE"
    echo "[OK] Backup created: $BACKUP_FILE"
    echo ""
fi

# Update from Git
echo "[INFO] Downloading latest version from GitHub..."
git fetch origin main
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to fetch updates"
    read -p "Press Enter to exit..."
    exit 1
fi

git reset --hard origin/main
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to apply updates"
    echo "Your database backup is safe: $BACKUP_FILE"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] Update completed successfully!"
echo ""
echo "[INFO] Installing new dependencies..."
npm install > /dev/null 2>&1

echo ""
echo "========================================"
echo "   Update Complete!"
echo "========================================"
echo ""
echo "Changes installed:"
echo "- Latest features and fixes"
echo "- Updated database schema (if any)"
echo ""
echo "Your data has been preserved."
echo ""
echo "Next steps:"
echo "1. Run './START_POS.sh' to restart Vendora"
echo "2. The app will apply any schema updates automatically"
echo ""
read -p "Press Enter to exit..."
