#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Lucy MeloTTS installation...${NC}"

# Get the actual user when running with sudo
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

# Install system dependencies (requires root)
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run with sudo to install system dependencies${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing system dependencies...${NC}"
apt-get update
apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libffi-dev \
    python3-dev \
    curl \
    git \
    libsndfile1 \
    ffmpeg

# Switch to user context for Python/pyenv operations
echo -e "${YELLOW}Switching to user context for Python setup...${NC}"

# Create installation commands
SETUP_COMMANDS='
# Setup pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

# Initialize pyenv and rehash
pyenv rehash
eval "$(pyenv init -)"

cd '"'$PWD'"'

# Install Python 3.12 if needed
if ! pyenv versions | grep -q "3.12"; then
    pyenv install 3.12
fi

# Set local Python version
pyenv local 3.12

# Install/Update Rust
if ! command -v rustup &> /dev/null; then
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
fi

source "$HOME/.cargo/env"
rustup update stable
rustup default stable

# Remove existing virtual environment
rm -rf venv

# Create new virtual environment
python -m venv venv
source venv/bin/activate

# Install build dependencies
python -m pip install --upgrade pip wheel setuptools
python -m pip install --upgrade maturin

# Install MeloTTS dependencies
RUSTUP_TOOLCHAIN=stable pip install --no-binary :all: tokenizers
pip install torch numpy

# Build and install local MeloTTS package
python setup.py build
pip install -e .

# Install remaining requirements
pip install -r requirements.txt

# Create test script
cat > test_melo.py << EOL
#!/usr/bin/env python3
import os
import sys

try:
    from melo import TTS
    print("MeloTTS import successful")
    tts = TTS(language="EN")
    print("MeloTTS initialization successful")
    sys.exit(0)
except Exception as e:
    print(f"Error testing MeloTTS: {e}")
    sys.exit(1)
EOL

# Make test script executable
chmod +x test_melo.py

# Run test script
./test_melo.py

# Clean up test script
rm -f test_melo.py

# Clean up build artifacts
echo "Cleaning up build artifacts..."
rm -rf build/ dist/ *.egg-info/
'

# Run installation commands as the actual user
echo -e "${YELLOW}Running installation as user $ACTUAL_USER...${NC}"
su - $ACTUAL_USER -c "bash -c '$SETUP_COMMANDS'"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Installation completed successfully!${NC}"
    echo -e "${YELLOW}To activate the virtual environment, run:${NC}"
    echo "source venv/bin/activate"
else
    echo -e "${RED}Installation failed. Please check the error messages above.${NC}"
    exit 1
fi
