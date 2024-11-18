from transformers import WhisperProcessor, WhisperForConditionalGeneration
import argostranslate.package
import argostranslate.translate
from melo import TTS
import numpy as np
from typing import Dict, Optional, List, Tuple
import torch
import tempfile
import os

from config import WHISPER_MODEL_ID, SUPPORTED_LANGUAGES, logger
from utils import get_device, adjust_speed_for_model, log_error

# Define supported translation pairs based on testing results
SUPPORTED_TRANSLATION_PAIRS = [
    ('zh', 'en'), ('en', 'zh'),
    ('en', 'fr'), ('fr', 'en'),
    ('en', 'ja'), ('ja', 'en'),
    ('en', 'es'), ('es', 'en')
]

class SpeechServices:
    def __init__(self):
        self.device = get_device()
        self._init_whisper()
        self._init_tts()
        self._init_translation()

    def _init_whisper(self) -> None:
        """Initialize Whisper model for speech recognition."""
        try:
            self.processor = WhisperProcessor.from_pretrained(WHISPER_MODEL_ID)
            self.whisper_model = WhisperForConditionalGeneration.from_pretrained(WHISPER_MODEL_ID).to(self.device)
            logger.info("Whisper model initialized successfully")
        except Exception as e:
            log_error(e, "Failed to initialize Whisper model")
            raise

    def _init_tts(self) -> None:
        """Initialize TTS models."""
        try:
            # Initialize TTS instances for each language
            self.tts_models = {
                'en': TTS(language="EN"),
                'es': TTS(language="ES"),
                'fr': TTS(language="FR"),
                'zh': TTS(language="ZH"),
                'ja': TTS(language="JP")
            }
            logger.info("TTS models initialized successfully")
        except Exception as e:
            log_error(e, "Failed to initialize TTS models")
            raise

    def _init_translation(self) -> None:
        """Initialize translation packages."""
        try:
            # Clear existing packages
            package_dir = os.path.expanduser('~/.local/share/argos-translate/packages')
            if os.path.exists(package_dir):
                import shutil
                shutil.rmtree(package_dir)

            # Update package index and get available packages
            argostranslate.package.update_package_index()
            available_packages = argostranslate.package.get_available_packages()
            
            # Install packages for supported translation pairs
            installed_pairs = set()
            for package in available_packages:
                pair = (package.from_code, package.to_code)
                if pair in SUPPORTED_TRANSLATION_PAIRS:
                    logger.info(f"Installing language package: {package.from_code} to {package.to_code}")
                    argostranslate.package.install_from_path(package.download())
                    installed_pairs.add(pair)
            
            # Verify all supported pairs are installed
            missing_pairs = set(SUPPORTED_TRANSLATION_PAIRS) - installed_pairs
            if missing_pairs:
                logger.warning(f"Some supported translation pairs could not be installed: {missing_pairs}")
            
            # Log installed packages
            installed_packages = argostranslate.package.get_installed_packages()
            logger.info("Installed translation packages:")
            for pkg in installed_packages:
                logger.info(f"- {pkg.from_code} -> {pkg.to_code}")
            
            logger.info("Translation packages initialized successfully")
        except Exception as e:
            log_error(e, "Failed to initialize translation packages")
            raise

    def transcribe(self, audio: np.ndarray, from_language: str) -> str:
        """Transcribe audio to text using Whisper."""
        try:
            if from_language not in SUPPORTED_LANGUAGES:
                raise ValueError(f"Unsupported language for transcription: {from_language}")

            input_features = self.processor(
                audio, 
                sampling_rate=16000, 
                return_tensors="pt"
            ).input_features.to(self.device)
            
            forced_decoder_ids = self.processor.get_decoder_prompt_ids(
                language=SUPPORTED_LANGUAGES[from_language],
                task="transcribe"
            )
            
            generated_ids = self.whisper_model.generate(
                input_features,
                forced_decoder_ids=forced_decoder_ids
            )
            
            transcription = self.processor.batch_decode(
                generated_ids,
                skip_special_tokens=True
            )[0]
            
            return transcription
        except Exception as e:
            log_error(e, "Transcription failed")
            raise

    def translate(self, text: str, from_code: str, to_code: str) -> str:
        """Translate text between languages."""
        if from_code == to_code:
            return text
            
        try:
            # Validate language pair is supported
            if (from_code, to_code) not in SUPPORTED_TRANSLATION_PAIRS:
                raise ValueError(
                    f"Unsupported translation pair: {from_code} -> {to_code}. "
                    f"Available pairs: {self.get_language_pairs()}"
                )
            
            # Use argostranslate for translation
            translated = argostranslate.translate.translate(text, from_code, to_code)
            if translated is None or translated.strip() == "":
                raise ValueError(f"Translation failed or returned empty for {from_code} to {to_code}")
            return translated
        except Exception as e:
            log_error(e, f"Translation failed ({from_code} to {to_code})")
            raise

    def synthesize_speech(self, text: str, voice_id: str = 'EN', speed: float = 1.0) -> bytes:
        """Synthesize speech from text."""
        temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_path = temp_file.name
        temp_file.close()

        try:
            # Map voice_id to language code
            lang_map = {
                'EN-US': 'en',
                'EN': 'en',
                'ES': 'es',
                'FR': 'fr',
                'ZH': 'zh',
                'JA': 'ja',  # Changed from JP to JA to match frontend
                'JP': 'ja'   # Keep JP mapping for backward compatibility
            }
            
            language = lang_map.get(voice_id, 'en')
            
            # Validate language is supported
            if language not in self.tts_models:
                raise ValueError(f"Unsupported language for speech synthesis: {language}")
            
            # Get the appropriate TTS model
            tts = self.tts_models[language]
            
            # Generate speech
            tts.tts_to_file(text, speaker_id=0, output_path=temp_path)

            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                raise Exception("Failed to generate audio file")

            with open(temp_path, 'rb') as audio_file:
                audio_data = audio_file.read()
                
            return audio_data
        except Exception as e:
            log_error(e, "Speech synthesis failed")
            raise
        finally:
            try:
                os.unlink(temp_path)
            except Exception as e:
                log_error(e, "Error cleaning up temporary file")

    def get_available_voices(self) -> List[Dict[str, str]]:
        """Get list of available TTS voices."""
        return [
            {"id": "EN-US", "name": "English (American)"},
            {"id": "EN", "name": "English (Default)"},
            {"id": "ES", "name": "Spanish"},
            {"id": "FR", "name": "French"},
            {"id": "ZH", "name": "Chinese"},
            {"id": "JA", "name": "Japanese"}  # Changed from JP to JA to match frontend
        ]

    def get_language_pairs(self) -> Dict[str, List[str]]:
        """Get available language translation pairs."""
        pairs = {}
        for from_code, to_code in SUPPORTED_TRANSLATION_PAIRS:
            if from_code not in pairs:
                pairs[from_code] = []
            pairs[from_code].append(to_code)
        return pairs
