import argostranslate.package
import argostranslate.translate
from transformers import WhisperProcessor
import json
import sys
from config import WHISPER_MODEL_ID, SUPPORTED_LANGUAGES

def get_argos_pairs():
    """Get all available Argostranslate language pairs."""
    try:
        print("Updating Argostranslate package index...")
        argostranslate.package.update_package_index()
        available_packages = argostranslate.package.get_available_packages()
        
        pairs = []
        for package in available_packages:
            pairs.append({
                'from_code': package.from_code,
                'to_code': package.to_code
            })
        return pairs
    except Exception as e:
        print(f"Error getting Argostranslate pairs: {str(e)}")
        return []

def test_translation_pair(from_code, to_code, test_text):
    """Test translation between a language pair."""
    try:
        translated = argostranslate.translate.translate(test_text, from_code, to_code)
        print(f"\nTesting {from_code} -> {to_code}")
        print(f"Original ({from_code}): {test_text}")
        print(f"Translated ({to_code}): {translated}")
        return True
    except Exception as e:
        print(f"Error testing translation {from_code} -> {to_code}: {str(e)}")
        return False

def main():
    print("Starting translation pair analysis...")
    
    # Get currently supported languages from config
    print(f"\nCurrently supported languages in config:")
    for code, name in SUPPORTED_LANGUAGES.items():
        print(f"{code}: {name}")
    
    print("\nGetting Argostranslate language pairs...")
    argos_pairs = get_argos_pairs()
    print(f"Found {len(argos_pairs)} Argostranslate language pairs:")
    for pair in argos_pairs:
        print(f"{pair['from_code']} -> {pair['to_code']}")
    
    # Find compatible pairs (pairs where both languages are in SUPPORTED_LANGUAGES)
    compatible_pairs = []
    for pair in argos_pairs:
        if pair['from_code'] in SUPPORTED_LANGUAGES and pair['to_code'] in SUPPORTED_LANGUAGES:
            compatible_pairs.append(pair)
    
    print(f"\nFound {len(compatible_pairs)} compatible language pairs:")
    for pair in compatible_pairs:
        print(f"{pair['from_code']} -> {pair['to_code']}")
    
    # Test each compatible pair
    print("\nTesting each compatible pair...")
    test_texts = {
        'en': 'Hello, how are you?',
        'es': '¿Hola, cómo estás?',
        'fr': 'Bonjour, comment allez-vous?',
        'zh': '你好，你好吗？',
        'ja': 'こんにちは、お元気ですか？'
    }
    
    successful_pairs = []
    for pair in compatible_pairs:
        from_code = pair['from_code']
        to_code = pair['to_code']
        test_text = test_texts.get(from_code, test_texts['en'])
        
        if test_translation_pair(from_code, to_code, test_text):
            successful_pairs.append(pair)
    
    # Save results
    results = {
        'total_pairs_found': len(argos_pairs),
        'compatible_pairs': len(compatible_pairs),
        'successful_pairs': len(successful_pairs),
        'pairs': successful_pairs
    }
    
    with open('translation_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to translation_test_results.json")
    print(f"Total Argostranslate pairs: {len(argos_pairs)}")
    print(f"Compatible pairs: {len(compatible_pairs)}")
    print(f"Successfully tested pairs: {len(successful_pairs)}")

if __name__ == "__main__":
    main()
