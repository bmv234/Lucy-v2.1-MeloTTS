import os
import logging
from typing import Dict

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('server.log')
    ]
)
logger = logging.getLogger(__name__)

# Whisper model configurations
WHISPER_MODELS = {
    'tiny': 'openai/whisper-tiny',
    'base': 'openai/whisper-base',
    'small': 'openai/whisper-small',
    'medium': 'openai/whisper-medium',
    'large': 'openai/whisper-large',
    'large-v2': 'openai/whisper-large-v2',
    'large-v3': 'openai/whisper-large-v3',
    'large-v3-turbo': 'openai/whisper-large-v3-turbo'
}

# Select which model to use
SELECTED_WHISPER_MODEL = 'small'
WHISPER_MODEL_ID = WHISPER_MODELS[SELECTED_WHISPER_MODEL]

# Audio settings
SAMPLE_RATE = 16000

# Supported languages (intersection of whisper and MeloTTS supported languages)
SUPPORTED_LANGUAGES = {
    'en': 'english',
    'es': 'spanish',
    'fr': 'french',
    'zh': 'chinese',
    'ja': 'japanese'
}

# SSL Configuration
SSL_CERT_PATH = 'cert.pem'
SSL_KEY_PATH = 'key.pem'

# Server Configuration
HOST = '0.0.0.0'
PORT = 5000
DEBUG = True
