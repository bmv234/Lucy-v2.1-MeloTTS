# Lucy MeloTTS

A Text-to-Speech application using MeloTTS, with support for multiple languages and translation capabilities.

## Prerequisites

- Python 3.10
- pyenv (for local installation)
- Docker (for containerized installation)
- NVIDIA GPU with CUDA support (recommended)
- Sudo privileges (for local installation)

## Installation Options

### Option 1: Local Installation

1. Make sure you have pyenv installed. If not, install it using:
```bash
curl https://pyenv.run | bash
```

2. Run the installation script with sudo:
```bash
sudo ./install.sh
```

This script will:
- Install required system dependencies
- Install Python 3.10 using pyenv if not already installed
- Install and configure Rust toolchain
- Create and configure a virtual environment
- Install all required Python packages

3. Activate the virtual environment:
```bash
source venv/bin/activate
```

Note: If you encounter any issues during installation, check the error messages. The script includes detailed error handling and will guide you through any problems.

### Option 2: Docker Installation

1. Build the Docker image:
```bash
docker build -t lucy-melotts .
```

2. Run the container:
```bash
docker run -d --gpus all -p 5000:5000 lucy-melotts
```

The Docker setup includes:
- CUDA support for GPU acceleration
- All necessary build tools and dependencies
- Proper Rust toolchain configuration
- Automatic SSL certificate generation

## Features

- Text-to-Speech synthesis using MeloTTS
- Multi-language support
- Speech recognition using Whisper
- Translation capabilities using argostranslate
- HTTPS support with SSL certificates
- GPU acceleration support

## Supported Languages

- English (US and Default)
- Spanish
- French
- Chinese
- Japanese

## API Endpoints

The application runs on port 5000 and supports HTTPS. Available endpoints:

- `/tts`: Text-to-Speech synthesis
- `/transcribe`: Speech-to-text transcription
- `/translate`: Text translation
- `/voices`: List available voices
- `/languages`: List supported language pairs

## Development

To run the application in development mode:

```bash
python app.py
```

The server will start on https://localhost:5000

## Troubleshooting

### Common Installation Issues

1. Tokenizers Build Error
   - Ensure you have the latest Rust toolchain installed
   - Try updating Rust: `rustup update`
   - Make sure all system dependencies are installed

2. CUDA Issues
   - Verify NVIDIA drivers are installed
   - Check CUDA compatibility with your GPU
   - Ensure PyTorch is installed with CUDA support

3. Permission Issues
   - Make sure to run the install script with sudo
   - Check directory permissions for cache and temp folders

## Environment Variables

- `PYTHONUNBUFFERED`: Set to 1 for unbuffered output
- `PYTHONDONTWRITEBYTECODE`: Set to 1 to prevent Python from writing pyc files
- `TRANSFORMERS_CACHE`: Location for Hugging Face model cache
- `HF_HOME`: Hugging Face home directory

## System Requirements

### Minimum Requirements
- 4GB RAM
- 2 CPU cores
- 10GB disk space

### Recommended Requirements
- 8GB+ RAM
- 4+ CPU cores
- NVIDIA GPU with 6GB+ VRAM
- 20GB+ disk space

## License

[License information here]
