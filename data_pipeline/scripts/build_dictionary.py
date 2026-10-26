"""
Dictionary Compiler for SpaceFix V1
Combines SCOWL Level 60 wordlists, Norvig Web 1T frequencies, modern slang, and contractions.
Produces a clean, verified dictionary.json calibrated to ~80k-100k high-frequency words.
"""

import os
import json
import re

def load_scowl_words(scowl_dir: str) -> set[str]:
    """Loads all unique valid words from SCOWL wordlists (sizes 10 to 60)."""
    valid_words = set()
    for filename in os.listdir(scowl_dir):
        filepath = os.path.join(scowl_dir, filename)
        if os.path.isfile(filepath):
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    word = line.strip().lower()
                    # Keep pure letters and words with single apostrophe
                    if re.match(r"^[a-z]+('[a-z]+)?$", word):
                        valid_words.add(word)
    return valid_words


def load_frequency_table(freq_file: str) -> dict[str, int]:
    """Loads word frequencies from Peter Norvig's count_1w.txt."""
    freqs = {}
    with open(freq_file, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) == 2:
                word = parts[0].strip().lower()
                try:
                    count = int(parts[1])
                    freqs[word] = count
                except ValueError:
                    continue
    return freqs


def load_slang_words(slang_file: str) -> set[str]:
    """Loads curated modern internet slang and tech terms."""
    slang = set()
    if os.path.exists(slang_file):
        with open(slang_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip().lower()
                if line and not line.startswith("#"):
                    slang.add(line)
    return slang


def load_contractions(contractions_file: str) -> dict[str, str]:
    """Loads unpunctuated to punctuated contraction mappings."""
    if os.path.exists(contractions_file):
        with open(contractions_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def build_curated_dictionary(
    scowl_dir: str,
    freq_file: str,
    slang_file: str,
    contractions_file: str,
    target_vocab_size: int = 85000
) -> dict[str, int]:
    """Merges all sources into a balanced, verified vocabulary."""
    print("Loading SCOWL words...")
    scowl_words = load_scowl_words(scowl_dir)
    print(f"  SCOWL words loaded: {len(scowl_words):,}")

    print("Loading Google Web 1T frequency counts...")
    freq_table = load_frequency_table(freq_file)
    print(f"  Web 1T words loaded: {len(freq_table):,}")

    print("Loading slang and contractions...")
    slang_words = load_slang_words(slang_file)
    contractions = load_contractions(contractions_file)
    print(f"  Slang entries: {len(slang_words):,}")
    print(f"  Contraction entries: {len(contractions):,}")

    # Single-letter words permitted: strictly 'a' and 'i'
    single_letters_permitted = {"a", "i"}

    # Curate vocabulary:
    # 1. SCOWL words that have web frequency evidence (sorted by frequency)
    scored_scowl = []
    default_rare_freq = 500  # Floor frequency for valid SCOWL words missing from Web 1T
    
    for word in scowl_words:
        if len(word) == 1 and word not in single_letters_permitted:
            continue
        count = freq_table.get(word, default_rare_freq)
        scored_scowl.append((word, count))

    # Sort descending by frequency
    scored_scowl.sort(key=lambda x: x[1], reverse=True)

    # 2. Pick top words up to target size
    final_dict = {}
    for word, count in scored_scowl[:target_vocab_size]:
        final_dict[word] = count

    # 3. Always guarantee slang words are included (with high default frequency)
    for word in slang_words:
        if word not in final_dict:
            # Use web frequency if available, or default to a prominent frequency
            final_dict[word] = freq_table.get(word, 5_000_000)

    # 4. Include punctuated contractions
    for unpunctuated, punctuated in contractions.items():
        base_freq = freq_table.get(unpunctuated, 10_000_000)
        final_dict[punctuated] = base_freq

    print(f"\nFinal curated dictionary size: {len(final_dict):,} words")
    return final_dict


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    scowl_dir = os.path.join(root_dir, "data_pipeline", "raw_wordlists", "scowl")
    freq_file = os.path.join(root_dir, "data_pipeline", "raw_wordlists", "frequency", "count_1w.txt")
    slang_file = os.path.join(root_dir, "data_pipeline", "raw_wordlists", "slang.txt")
    contractions_file = os.path.join(root_dir, "data_pipeline", "raw_wordlists", "contractions.json")

    output_dir = os.path.join(root_dir, "data_pipeline", "output")
    extension_assets_dir = os.path.join(root_dir, "extension", "assets")
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(extension_assets_dir, exist_ok=True)

    dictionary = build_curated_dictionary(scowl_dir, freq_file, slang_file, contractions_file)

    output_path = os.path.join(output_dir, "dictionary.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dictionary, f, separators=(",", ":"))

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Dictionary saved to {output_path} ({size_mb:.2f} MB)")

    # Also mirror to extension assets
    ext_path = os.path.join(extension_assets_dir, "dictionary.json")
    with open(ext_path, "w", encoding="utf-8") as f:
        json.dump(dictionary, f, separators=(",", ":"))
    print(f"Mirrored to extension assets: {ext_path}")

if __name__ == "__main__":
    main()
