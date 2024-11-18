from speech_services import SpeechServices
import numpy as np

def test_translation_pairs():
    """Test all supported translation pairs."""
    service = SpeechServices()
    
    # Test texts for each language
    test_texts = {
        'en': 'Hello, how are you?',
        'es': '¿Hola, cómo estás?',
        'fr': 'Bonjour, comment allez-vous?',
        'zh': '你好，你好吗？',
        'ja': 'こんにちは、お元気ですか？'
    }
    
    print("\nTesting translation pairs:")
    print("=" * 50)
    
    # Get available pairs
    pairs = service.get_language_pairs()
    print("\nAvailable language pairs:")
    for from_lang, to_langs in pairs.items():
        print(f"{from_lang} -> {', '.join(to_langs)}")
    
    print("\nTesting translations:")
    print("=" * 50)
    
    # Test each supported pair
    for from_lang, to_langs in pairs.items():
        test_text = test_texts[from_lang]
        for to_lang in to_langs:
            try:
                translated = service.translate(test_text, from_lang, to_lang)
                print(f"\n{from_lang} -> {to_lang}")
                print(f"Original: {test_text}")
                print(f"Translated: {translated}")
            except Exception as e:
                print(f"Error testing {from_lang} -> {to_lang}: {str(e)}")

def test_unsupported_pair():
    """Test handling of unsupported language pairs."""
    service = SpeechServices()
    
    print("\nTesting unsupported pair handling:")
    print("=" * 50)
    
    try:
        # Try to translate between unsupported pair
        service.translate("Hello", "en", "ko")  # Korean is not in our supported pairs
        print("Error: Should have raised ValueError for unsupported pair")
    except ValueError as e:
        print(f"Successfully caught unsupported pair error: {str(e)}")

def main():
    print("Starting Speech Services tests...")
    
    # Test translation pairs
    test_translation_pairs()
    
    # Test unsupported pair handling
    test_unsupported_pair()

if __name__ == "__main__":
    main()
