#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=lucy-melotts)" ]; then
    echo -e "${YELLOW}Stopping and removing existing container...${NC}"
    docker stop lucy-melotts
    docker rm lucy-melotts
fi

echo -e "${YELLOW}Building Lucy MeloTTS Docker image...${NC}"
if ! docker build -t lucy-melotts .; then
    echo -e "${RED}Error: Docker build failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Starting Lucy MeloTTS container...${NC}"
if ! docker run -d \
    --name lucy-melotts \
    -p 5000:5000 \
    -v "$(pwd)/temp:/app/temp" \
    -v "$(pwd)/.cache:/app/.cache" \
    --restart unless-stopped \
    lucy-melotts; then
    echo -e "${RED}Error: Failed to start container${NC}"
    exit 1
fi

echo -e "${GREEN}Container started successfully!${NC}"
echo -e "${GREEN}Access the application at https://localhost:5000${NC}"
echo -e "\n${YELLOW}Useful commands:${NC}"
echo -e "View logs:${NC} docker logs lucy-melotts"
echo -e "Stop container:${NC} docker stop lucy-melotts"
echo -e "Start container:${NC} docker start lucy-melotts"
