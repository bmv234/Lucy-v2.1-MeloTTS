#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building Lucy MeloTTS Docker image...${NC}"
docker build -t lucy-melotts .

echo -e "${YELLOW}Starting Lucy MeloTTS container...${NC}"
docker run -d \
  --name lucy-melotts \
  --gpus all \
  -p 5000:5000 \
  -v "$(pwd)/temp:/app/temp" \
  -v "$(pwd)/.cache:/app/.cache" \
  --restart unless-stopped \
  lucy-melotts

echo -e "${GREEN}Container started! Access the application at https://localhost:5000${NC}"
echo -e "${YELLOW}View logs with:${NC} docker logs lucy-melotts"
echo -e "${YELLOW}Stop container with:${NC} docker stop lucy-melotts"
