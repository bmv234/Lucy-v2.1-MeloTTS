import torch
import logging
import socket
from typing import Dict, Any, Optional, Tuple
import numpy as np
from config import logger

def get_device() -> torch.device:
    """Get the appropriate device (CUDA or CPU) for model execution."""
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")

def get_local_ip() -> str:
    """Get the local IP address of the machine."""
    hostname = socket.gethostname()
    return socket.gethostbyname(hostname)

def create_response(success: bool, data: Optional[Dict[str, Any]] = None, error: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
    """Create a standardized API response."""
    response = {"success": success}
    status_code = 200 if success else 500

    if data is not None:
        response["data"] = data
    if error is not None:
        response["error"] = error
        if "not found" in error.lower():
            status_code = 404
        elif "invalid" in error.lower():
            status_code = 400

    return response, status_code

def preprocess_audio(audio: np.ndarray) -> np.ndarray:
    """Preprocess audio data for model input."""
    # Normalize audio if not already normalized
    if audio.max() > 1.0 or audio.min() < -1.0:
        audio = audio.astype(np.float32) / 32768.0
    return audio

def log_error(error: Exception, context: str = "") -> None:
    """Log error with context information."""
    error_msg = f"{context}: {str(error)}" if context else str(error)
    logger.error(error_msg, exc_info=True)

def validate_language_code(lang_code: str, supported_languages: Dict[str, str]) -> bool:
    """Validate if a language code is supported."""
    return lang_code.lower() in supported_languages

def adjust_speed_for_model(speed: float) -> float:
    """Adjust speed parameter for MeloTTS."""
    # MeloTTS uses speed parameter directly
    return speed
