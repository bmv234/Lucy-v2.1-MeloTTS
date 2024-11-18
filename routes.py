from flask import Blueprint, send_from_directory, request, jsonify
import numpy as np
import base64
from typing import Dict, Any

from speech_services import SpeechServices
from utils import create_response, preprocess_audio, log_error
from config import SUPPORTED_LANGUAGES

# Create blueprint for API routes
api = Blueprint('api', __name__)
speech_services = SpeechServices()

@api.route('/languages', methods=['GET'])
def get_languages():
    """Get supported languages and translation pairs."""
    try:
        return create_response(True, {
            "supported_languages": SUPPORTED_LANGUAGES,
            "language_pairs": speech_services.get_language_pairs()
        })
    except Exception as e:
        log_error(e, "Failed to get languages")
        return create_response(False, error=str(e))

@api.route('/voices', methods=['GET'])
def list_voices():
    """Get available TTS voices."""
    try:
        voices = speech_services.get_available_voices()
        return create_response(True, {"voices": voices})
    except Exception as e:
        log_error(e, "Failed to get voices")
        return create_response(False, error=str(e))

@api.route('/process_audio', methods=['POST'])
def process_audio():
    """Process audio through the STT-Translation-TTS pipeline."""
    try:
        if not request.is_json:
            return create_response(False, error="Request must be JSON")

        data = request.get_json()
        
        # Extract and validate parameters
        audio_data = base64.b64decode(
            data['audio'].split(',')[1] if ',' in data['audio'] else data['audio']
        )
        from_code = data.get('from_code', 'en')
        to_code = data.get('to_code', 'en')
        voice_id = data.get('voice', 'EN')
        speed = float(data.get('speed', 1.0))

        # Process audio through pipeline
        audio = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        processed_audio = preprocess_audio(audio)
        
        # Transcribe
        transcription = speech_services.transcribe(processed_audio, from_code)
        
        # Translate
        translation = speech_services.translate(transcription, from_code, to_code)
        
        # Synthesize translated text
        synthesized_audio = speech_services.synthesize_speech(translation, voice_id, speed)
        
        # Encode audio to base64 for response
        audio_base64 = base64.b64encode(synthesized_audio).decode('utf-8')
        
        return create_response(True, {
            "transcription": transcription,
            "translation": translation,
            "audio": audio_base64
        })

    except Exception as e:
        log_error(e, "Failed to process audio")
        return create_response(False, error=str(e))

@api.route('/synthesize', methods=['POST'])
def synthesize():
    """Synthesize speech from text."""
    try:
        if not request.is_json:
            return create_response(False, error="Request must be JSON")

        data = request.get_json()
        text = data.get('text')
        voice_id = data.get('voice', 'EN')
        speed = float(data.get('speed', 1.0))

        if not text:
            return create_response(False, error="Text is required")

        # Synthesize speech
        audio_data = speech_services.synthesize_speech(text, voice_id, speed)
        
        # Encode audio to base64 for response
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        return create_response(True, {"audio": audio_base64})

    except Exception as e:
        log_error(e, "Failed to synthesize speech")
        return create_response(False, error=str(e))

# Create blueprint for static routes
static = Blueprint('static', __name__)

@static.route('/')
def serve_teacher():
    """Serve teacher's page."""
    return send_from_directory('.', 'index.html')

@static.route('/student')
def serve_student():
    """Serve student's page."""
    return send_from_directory('.', 'student.html')

@static.route('/<path:path>')
def serve_files(path):
    """Serve static files."""
    return send_from_directory('.', path)
