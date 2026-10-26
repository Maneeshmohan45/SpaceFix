"""
Stage 1 Automated Test Suite
Verifies Dictionary and SymSpell Index integrity, formatting, coverage, and memory limits.
"""

import os
import json
import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DICT_PATH = os.path.join(ROOT_DIR, "data_pipeline", "output", "dictionary.json")
INDEX_PATH = os.path.join(ROOT_DIR, "data_pipeline", "output", "symspell_index.json")
EXT_DICT_PATH = os.path.join(ROOT_DIR, "extension", "assets", "dictionary.json")
EXT_INDEX_PATH = os.path.join(ROOT_DIR, "extension", "assets", "symspell_index.json")

@pytest.fixture(scope="module")
def dictionary_data():
    assert os.path.exists(DICT_PATH), f"Dictionary file missing: {DICT_PATH}"
    with open(DICT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture(scope="module")
def index_data():
    assert os.path.exists(INDEX_PATH), f"Index file missing: {INDEX_PATH}"
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def test_dictionary_vocabulary_bounds(dictionary_data):
    """Test that vocabulary size is within optimal 75k-95k bounds."""
    total_words = len(dictionary_data)
    assert 75000 <= total_words <= 95000, f"Vocabulary size {total_words} out of bounds!"

def test_dictionary_file_size():
    """Test that dictionary.json does not exceed 2.5 MB."""
    size_mb = os.path.getsize(DICT_PATH) / (1024 * 1024)
    assert size_mb < 2.5, f"Dictionary file size too large: {size_mb:.2f} MB"

def test_classic_typos_not_in_dictionary(dictionary_data):
    """Ensure typos have not poisoned the valid dictionary."""
    poison_list = ["teh", "wrok", "speling", "definately", "recieved", "wierd", "seperate", "untill"]
    for typo in poison_list:
        assert typo not in dictionary_data, f"Typo '{typo}' was mistakenly included as a valid word!"

def test_essential_vocabulary_present(dictionary_data):
    """Verify core everyday vocabulary is present."""
    essential = ["the", "work", "hello", "spelling", "definitely", "received", "doing", "weather", "whether"]
    for word in essential:
        assert word in dictionary_data, f"Essential word '{word}' is missing!"

def test_slang_and_contractions_present(dictionary_data):
    """Verify modern conversational slang and contractions are present."""
    modern = ["lol", "idk", "btw", "bruh", "gonna", "wanna", "wifi", "frontend", "don't", "can't"]
    for term in modern:
        assert term in dictionary_data, f"Term '{term}' is missing!"

def test_single_letter_words(dictionary_data):
    """Only 'a' and 'i' are permitted as 1-letter words."""
    for word in dictionary_data:
        if len(word) == 1:
            assert word in {"a", "i"}, f"Illegal single letter word: '{word}'"

def test_symspell_index_structure(index_data, dictionary_data):
    """Verify index schema and completeness."""
    assert "words" in index_data, "Index missing 'words' list"
    assert "deletes" in index_data, "Index missing 'deletes' dictionary"
    
    words_list = index_data["words"]
    deletes_map = index_data["deletes"]
    
    # Word count matches dictionary
    assert len(words_list) == len(dictionary_data)
    assert len(deletes_map) > 500000, f"Unexpectedly low delete key count: {len(deletes_map)}"

def test_symspell_index_file_size():
    """Verify symspell_index.json is under 30 MB (hybrid distance-1 + distance-2 index)."""
    size_mb = os.path.getsize(INDEX_PATH) / (1024 * 1024)
    assert size_mb < 30.0, f"Index file size too large: {size_mb:.2f} MB"

def test_symspell_word_ids_valid(index_data):
    """Verify all word IDs in deletion lists point to valid words."""
    words_len = len(index_data["words"])
    deletes_map = index_data["deletes"]
    
    # Check a sample of deletion keys
    sample_keys = list(deletes_map.keys())[:1000]
    for key in sample_keys:
        ids = deletes_map[key]
        assert len(ids) > 0
        for wid in ids:
            assert 0 <= wid < words_len, f"Word ID {wid} out of bounds for key '{key}'"

def test_symspell_deletions_map_correctly(index_data):
    """Verify known deletions map to expected words."""
    words = index_data["words"]
    deletes = index_data["deletes"]
    word_to_id = {w: i for i, w in enumerate(words)}
    
    # "speling" should be a deletion of "spelling"
    assert "speling" in deletes, "Deletion 'speling' missing from index!"
    spelling_id = word_to_id["spelling"]
    assert spelling_id in deletes["speling"], "'speling' does not map to 'spelling'!"
    
    # "hllo" should be a deletion of "hello"
    assert "hllo" in deletes, "Deletion 'hllo' missing from index!"
    hello_id = word_to_id["hello"]
    assert hello_id in deletes["hllo"], "'hllo' does not map to 'hello'!"

def test_extension_assets_mirroring():
    """Verify that assets are properly mirrored to the extension directory."""
    assert os.path.exists(EXT_DICT_PATH), f"Extension dict missing: {EXT_DICT_PATH}"
    assert os.path.exists(EXT_INDEX_PATH), f"Extension index missing: {EXT_INDEX_PATH}"
    
    assert os.path.getsize(DICT_PATH) == os.path.getsize(EXT_DICT_PATH)
    assert os.path.getsize(INDEX_PATH) == os.path.getsize(EXT_INDEX_PATH)
