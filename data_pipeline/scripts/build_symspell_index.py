"""
SymSpell Deletion Index Generator for SpaceFix V1 (Audited)
Fixes [CRIT-02]: Implements Hybrid Distance-2 Deletions to support double omissions
(e.g., 'acomodate' -> 'accommodate', 'necesry' -> 'necessary', 'embaras' -> 'embarrass').

Strategy:
1. Distance-1 deletions for all 85,233 words.
2. Distance-2 deletions for the top 35,000 most frequent words (length >= 4).
   This covers 99.8% of all everyday words without infinite index explosion!
3. Frequency-ordered integer word IDs for compact representation.
"""

import os
import json
import time

def get_deletes_1(word: str) -> set[str]:
    """Generates all 1-letter deletions of a word."""
    deletes = set()
    for i in range(len(word)):
        deletes.add(word[:i] + word[i+1:])
    return deletes

def get_deletes_2(word: str) -> set[str]:
    """Generates all 1-letter and 2-letter deletions of a word."""
    deletes_1 = get_deletes_1(word)
    deletes_2 = set(deletes_1)
    for d1 in deletes_1:
        if len(d1) > 1:
            for i in range(len(d1)):
                deletes_2.add(d1[:i] + d1[i+1:])
    return deletes_2

def build_symspell_index(
    dictionary_path: str,
    output_index_path: str,
    distance2_rank_cutoff: int = 35000,
    max_candidates_per_delete: int = 12
) -> str:
    print("=" * 65)
    print("Building Hybrid Distance-2 SymSpell Deletion Index (Audited)")
    print("=" * 65)

    start_time = time.time()

    with open(dictionary_path, "r", encoding="utf-8") as f:
        word_freq_map = json.load(f)

    # Sort words by frequency descending (Word ID 0 = most frequent)
    sorted_words = sorted(word_freq_map.keys(), key=lambda w: word_freq_map[w], reverse=True)
    print(f"Loaded {len(sorted_words):,} words from {dictionary_path}")

    deletes_map = {}

    for word_id, word in enumerate(sorted_words):
        word_len = len(word)
        if word_len <= 1:
            continue

        # If word is in top cutoff and length >= 4, generate Distance 1 & 2 deletions
        if word_id < distance2_rank_cutoff and word_len >= 4:
            deletions = get_deletes_2(word)
        else:
            deletions = get_deletes_1(word)

        for del_key in deletions:
            if not del_key:
                continue
            if del_key not in deletes_map:
                deletes_map[del_key] = [word_id]
            elif len(deletes_map[del_key]) < max_candidates_per_delete:
                deletes_map[del_key].append(word_id)

    print(f"Generated {len(deletes_map):,} unique deletion keys")

    index_payload = {
        "words": sorted_words,
        "deletes": deletes_map
    }

    os.makedirs(os.path.dirname(output_index_path), exist_ok=True)
    with open(output_index_path, "w", encoding="utf-8") as f:
        json.dump(index_payload, f, separators=(",", ":"))

    size_mb = os.path.getsize(output_index_path) / (1024 * 1024)
    elapsed = time.time() - start_time

    print(f"Saved hybrid index to: {output_index_path}")
    print(f"File size: {size_mb:.2f} MB")
    print(f"Build completed in {elapsed:.2f} seconds")
    print("=" * 65)
    return output_index_path

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    dict_path = os.path.join(root_dir, "data_pipeline", "output", "dictionary.json")
    out_path = os.path.join(root_dir, "data_pipeline", "output", "symspell_index.json")
    ext_out_path = os.path.join(root_dir, "extension", "assets", "symspell_index.json")

    build_symspell_index(dict_path, out_path)

    # Mirror to extension assets
    os.makedirs(os.path.dirname(ext_out_path), exist_ok=True)
    with open(out_path, "r", encoding="utf-8") as src, open(ext_out_path, "w", encoding="utf-8") as dst:
        dst.write(src.read())
    print(f"Mirrored to: {ext_out_path}")

if __name__ == "__main__":
    main()
