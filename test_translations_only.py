import argostranslate.package
import argostranslate.translate
from typing import Dict, List
import json

# Define supported translation pairs based on testing results
SUPPORTED_TRANSLATION_PAIRS = [
    ('zh', 'en'), ('en', 'zh'),
    ('en', 'fr'), ('fr', 'en'),
    ('en', 'ja'), ('ja', 'en'),
    ('en', 'es'), ('es', 'en')
]

def get_language_pairs() -> Dict[str, List[str]]:
    """Get available language translation pairs."""
    pairs = {}
    for from_code, to_code in SUPPORTED_TRANSLATION_PAIRS:
        if from_code not in pairs:
            pairs[from_code] = []
        pairs[from_code].append(to_code)
    return pairs

def test_translation_pairs():
    """Test all supported translation pairs."""
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
    pairs = get_language_pairs()
    print("\nAvailable language pairs:")
    for from_lang, to_langs in pairs.items():
        print(f"{from_lang} -> {', '.join(to_langs)}")
    
    print("\nTesting translations:")
    print("=" * 50)
    
    results = []
    # Test each supported pair
    for from_lang, to_langs in pairs.items():
        test_text = test_texts[from_lang]
        for to_lang in to_langs:
            try:
                translated = argostranslate.translate.translate(test_text, from_lang, to_lang)
                print(f"\n{from_lang} -> {to_lang}")
                print(f"Original: {test_text}")
                print(f"Translated: {translated}")
                results.append({
                    'from_lang': from_lang,
                    'to_lang': to_lang,
                    'original': test_text,
                    'translated': translated,
                    'success': True
                })
            except Exception as e:
                print(f"Error testing {from_lang} -> {to_lang}: {str(e)}")
                results.append({
                    'from_lang': from_lang,
                    'to_lang': to_lang,
                    'original': test_text,
                    'error': str(e),
                    'success': False
                })
    
    # Save test results
    with open('translation_test_results_detailed.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("\nDetailed results saved to translation_test_results_detailed.json")

def test_unsupported_pair():
    """Test handling of unsupported language pairs."""
    print("\nTesting unsupported pair handling:")
    print("=" * 50)
    
    try:
        # Try to translate between unsupported pair
        argostranslate.translate.translate("Hello", "en", "ko")  # Korean is not in our supported pairs
        print("Error: Should have raised an error for unsupported pair")
    except Exception as e:
        print(f"Successfully caught unsupported pair error: {str(e)}")

def main():
    print("Starting translation tests...")
    print("Initializing Argostranslate packages...")
    
    # Update package index and install required packages
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    
    # Install packages for supported translation pairs
    for package in available_packages:
        pair = (package.from_code, package.to_code)
        if pair in SUPPORTED_TRANSLATION_PAIRS:
            print(f"Installing language package: {package.from_code} to {package.to_code}")
            argostranslate.package.install_from_path(package.download())
    
    # Test translation pairs
    test_translation_pairs()
    
    # Test unsupported pair handling
    test_unsupported_pair()

if __name__ == "__main__":
    main()
