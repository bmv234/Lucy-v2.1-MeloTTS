from melo import TTS

def test_tts():
    try:
        # Initialize TTS with English language
        tts = TTS(language="EN")
        print("Successfully initialized TTS")
        
        # Test text-to-speech conversion
        text = "Hello, this is a test."
        audio = tts.tts_to_file(text, speaker_id=0, output_path="test_output.wav")
        print("Successfully generated speech")
        
        return True
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    test_tts()
