from flask import Blueprint, send_from_directory, request, jsonify, redirect, url_for
import numpy as np
import base64
from typing import Dict, Any

from speech_services import SpeechServices
from utils import create_response, preprocess_audio, log_error
from config import SUPPORTED_LANGUAGES
from sessions import session_manager
from database import db

# Create blueprint for API routes
api = Blueprint('api', __name__)
speech_services = SpeechServices()

# Session management routes
@api.route('/create_teacher_session', methods=['POST'])
def create_teacher_session():
    """Create a new teacher session."""
    try:
        session_data = session_manager.create_teacher_session()
        return create_response(True, session_data)
    except Exception as e:
        log_error(e, "Failed to create teacher session")
        return create_response(False, error=str(e))

@api.route('/validate_teacher_session', methods=['POST'])
def validate_teacher_session():
    """Validate a teacher session code."""
    try:
        if not request.is_json:
            return create_response(False, error="Request must be JSON")
            
        data = request.get_json()
        teacher_code = data.get('teacher_code')
        
        if not teacher_code:
            return create_response(False, error="Teacher code is required")
            
        is_valid = session_manager.validate_teacher_session(teacher_code)
        
        if is_valid:
            # Get associated student code and session data
            session_codes = session_manager.get_session_codes(teacher_code)
            if session_codes:
                _, student_code = session_codes
                # Get stored session data
                session_data = db.get_session_data(teacher_code)
                transcription = ' '.join(item[0] for item in session_data) if session_data else ''
                translation = ' '.join(item[1] for item in session_data) if session_data else ''
                return create_response(True, {
                    "valid": True, 
                    "student_code": student_code,
                    "transcription": transcription,
                    "translation": translation
                })
        
        return create_response(True, {"valid": False})
    except Exception as e:
        log_error(e, "Failed to validate teacher session")
        return create_response(False, error=str(e))

@api.route('/validate_student_session', methods=['POST'])
def validate_student_session():
    """Validate a student session code."""
    try:
        if not request.is_json:
            return create_response(False, error="Request must be JSON")
            
        data = request.get_json()
        student_code = data.get('student_code')
        
        if not student_code:
            return create_response(False, error="Student code is required")
            
        is_valid = session_manager.validate_student_session(student_code)
        
        if is_valid:
            # Get teacher code and session data
            teacher_code = db.get_teacher_code_for_student(student_code)
            if teacher_code:
                session_data = db.get_session_data(teacher_code)
                transcription = ' '.join(item[0] for item in session_data) if session_data else ''
                translation = ' '.join(item[1] for item in session_data) if session_data else ''
                return create_response(True, {
                    "valid": True,
                    "teacher_code": teacher_code,  # Added teacher_code to response
                    "transcription": transcription,
                    "translation": translation
                })
        
        return create_response(True, {"valid": False})
    except Exception as e:
        log_error(e, "Failed to validate student session")
        return create_response(False, error=str(e))

@api.route('/clear_session', methods=['POST'])
def clear_session():
    """Clear session data."""
    try:
        if not request.is_json:
            return create_response(False, error="Request must be JSON")
            
        data = request.get_json()
        teacher_code = data.get('teacher_code')
        
        if not teacher_code:
            return create_response(False, error="Teacher code is required")
            
        success = db.clear_session_data(teacher_code)
        return create_response(success)
    except Exception as e:
        log_error(e, "Failed to clear session")
        return create_response(False, error=str(e))

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
        teacher_code = data.get('teacher_code')

        if not teacher_code:
            return create_response(False, error="Teacher code is required")

        # Process audio through pipeline
        audio = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        processed_audio = preprocess_audio(audio)
        
        # Transcribe
        transcription = speech_services.transcribe(processed_audio, from_code)
        
        # Translate
        translation = speech_services.translate(transcription, from_code, to_code)
        
        # Store session data
        db.store_session_data(teacher_code, transcription, translation)
        
        # Synthesize translated text
        synthesis_result = speech_services.synthesize_speech(translation, voice_id, speed)
        
        # Encode audio to base64 for response
        audio_base64 = base64.b64encode(synthesis_result['audio']).decode('utf-8')
        
        response_data = {
            "transcription": transcription,
            "translation": translation,
            "audio": audio_base64,
            "word_timings": synthesis_result['word_timings']
        }
        
        return create_response(True, response_data)

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

        # Synthesize speech with word timings
        synthesis_result = speech_services.synthesize_speech(text, voice_id, speed)
        
        # Encode audio to base64 for response
        audio_base64 = base64.b64encode(synthesis_result['audio']).decode('utf-8')
        
        response_data = {
            "audio": audio_base64,
            "word_timings": synthesis_result['word_timings']
        }
        
        return create_response(True, response_data)

    except Exception as e:
        log_error(e, "Failed to synthesize speech")
        return create_response(False, error=str(e))

# Create blueprint for static routes
static = Blueprint('static', __name__)

@static.route('/')
def serve_landing():
    """Serve landing page."""
    return send_from_directory('.', 'session.html')

@static.route('/teacher')
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
