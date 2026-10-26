"""
Dictionary Validator for SpaceFix V1
Ensures the compiled dictionary meets all strict safety, accuracy, and formatting constraints.
"""

import os
import json
import sys

def validate():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    dict_path = os.path.join(root_dir, "data_pipeline", "output", "dictionary.json")

    print("=" * 60)
    print("Validating Compiled dictionary.json")
    print("=" * 60)

    if not os.path.exists(dict_path):
        print(f"FAILED: {dict_path} does not exist.")
        sys.exit(1)

    with open(dict_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_words = len(data)
    print(f"Total entries: {total_words:,}")

    # Check 1: Vocabulary size bounds
    assert 75000 <= total_words <= 95000, f"Vocabulary size {total_words} outside expected range [75k, 95k]!"
    print("  [PASS] Vocabulary size within optimal range.")

    # Check 2: Known typos MUST NOT be present
    known_typos = ["teh", "wrok", "speling", "definately", "recieved", "wierd", "seperate", "untill"]
    for typo in known_typos:
        assert typo not in data, f"POISON DETECTED: Typo '{typo}' was found in the valid dictionary!"
    print(f"  [PASS] Verified {len(known_typos)} classic typos are NOT in dictionary.")

    # Check 3: Essential real words MUST be present
    essential_words = ["the", "work", "spelling", "definitely", "received", "hello", "doing", "whether", "weather"]
    for word in essential_words:
        assert word in data, f"MISSING ESSENTIAL WORD: '{word}' is missing!"
    print(f"  [PASS] Verified {len(essential_words)} essential standard words are present.")

    # Check 4: Modern slang MUST be present
    slang_words = ["lol", "idk", "btw", "bruh", "gonna", "wanna", "wifi", "frontend", "backend", "crypto"]
    for slang in slang_words:
        assert slang in data, f"MISSING SLANG/TECH WORD: '{slang}' is missing!"
    print(f"  [PASS] Verified {len(slang_words)} modern slang & tech terms are present.")

    # Check 5: Only 'a' and 'i' single-letter words allowed
    for word in data:
        if len(word) == 1:
            assert word in {"a", "i"}, f"INVALID SINGLE LETTER: '{word}' found in dictionary!"
    print("  [PASS] Single-letter entries strictly limited to 'a' and 'i'.")

    # Check 6: File size check (< 2.5 MB)
    file_size_mb = os.path.getsize(dict_path) / (1024 * 1024)
    assert file_size_mb < 2.5, f"File size too large: {file_size_mb:.2f} MB!"
    print(f"  [PASS] File size is compact: {file_size_mb:.2f} MB (well below 2.5 MB target).")

    print("\n" + "=" * 60)
    print("ALL VALIDATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    validate()
