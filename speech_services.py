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
            argostranslate.package.update_package_index()
            available_packages = argostranslate.package.get_available_packages()
            installed_packages = argostranslate.package.get_installed_packages()
            
            # Install missing language pairs
            language_pairs = [(from_code, to_code) 
                            for from_code in SUPPORTED_LANGUAGES.keys() 
                            for to_code in SUPPORTED_LANGUAGES.keys() 
                            if from_code != to_code]
            
            for from_code, to_code in language_pairs:
                if not any(pkg.from_code == from_code and pkg.to_code == to_code 
                          for pkg in installed_packages):
                    package = next((pkg for pkg in available_packages 
                                  if pkg.from_code == from_code and pkg.to_code == to_code), None)
                    if package:
                        logger.info(f"Installing language package: {from_code} to {to_code}")
                        argostranslate.package.install_from_path(package.download())
            
            logger.info("Translation packages initialized successfully")
        except Exception as e:
            log_error(e, "Failed to initialize translation packages")
            raise

    def transcribe(self, audio: np.ndarray, from_language: str) -> str:
        """Transcribe audio to text using Whisper."""
        try:
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
            translated = argostranslate.translate.translate(text, from_code, to_code)
            if translated is None or translated == text:
                raise ValueError(f"Translation failed or returned None for {from_code} to {to_code}")
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
                'JP': 'ja'
            }
            
            language = lang_map.get(voice_id, 'en')
            
            # Get the appropriate TTS model
            tts = self.tts_models.get(language, self.tts_models['en'])
            
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
            {"id": "JP", "name": "Japanese"}
        ]

    def get_language_pairs(self) -> Dict[str, List[str]]:
        """Get available language translation pairs."""
        return {
            lang: [pkg.to_code for pkg in argostranslate.package.get_installed_packages() 
                  if pkg.from_code == lang and pkg.to_code in SUPPORTED_LANGUAGES]
            for lang in SUPPORTED_LANGUAGES.keys()
        }
