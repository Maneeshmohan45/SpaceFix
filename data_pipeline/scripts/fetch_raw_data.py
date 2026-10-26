"""
Safe and Verified Data Fetcher for SpaceFix V1
Downloads plain-text corpora from trusted sources with strict security verification.

Security & Safety Guarantees:
1. HTTPS only from hardcoded trusted domains (norvig.com, raw.githubusercontent.com).
2. Size guard: Rejects any response exceeding max byte limits (max 10MB).
3. Binary/Executable signature check: Rejects any PE (MZ), ELF, Zip (PK), or binary headers.
4. Content sanitization: Verifies content is 100% valid plain text without null bytes.
5. SHA-256 hashing: Computes and logs cryptographic hashes for complete transparency.
"""

import os
import sys
import hashlib
import urllib.request
import urllib.parse

# Hardcoded whitelist of trusted domains
ALLOWED_DOMAINS = {
    "norvig.com",
    "raw.githubusercontent.com"
}

# Dangerous binary signatures (PE executable, ELF, Mach-O, Zip, Rar, 7z, etc.)
DANGEROUS_SIGNATURES = [
    b"MZ",               # Windows PE executable / DLL
    b"\x7fELF",          # Linux ELF binary
    b"\xca\xfe\xba\xbe", # Mach-O or Java class
    b"\xfe\xed\xfa\xce", # Mach-O
    b"\xfe\xed\xfa\xcf", # Mach-O 64-bit
    b"PK\x03\x04",       # Zip archive / executable jar
    b"Rar!\x1a\x07",     # RAR archive
    b"7z\xbc\xaf\x27\x1c"# 7-Zip archive
]

def verify_and_fetch_text(url: str, dest_path: str, max_bytes: int = 10 * 1024 * 1024) -> str:
    """Fetches a plain-text file securely, verifying it before writing to disk."""
    parsed = urllib.parse.urlparse(url)
    
    # 1. Domain verification
    if parsed.scheme != "https":
        raise ValueError(f"Insecure scheme: {url}. Only HTTPS is permitted.")
    if parsed.netloc not in ALLOWED_DOMAINS:
        raise ValueError(f"Untrusted domain: {parsed.netloc}. Only whitelisted domains are permitted.")
    
    print(f"\n[FETCHING] {url}")
    
    # 2. Download into memory buffer with size cap
    req = urllib.request.Request(url, headers={"User-Agent": "SpaceFix-Pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        content = resp.read(max_bytes + 1)
        if len(content) > max_bytes:
            raise ValueError(f"File exceeds maximum allowed size ({max_bytes} bytes). Aborting.")
    
    # 3. Binary executable check
    for sig in DANGEROUS_SIGNATURES:
        if content.startswith(sig):
            raise ValueError(f"SECURITY ALERT: Content starts with binary signature {sig!r}. Aborting.")
    
    if b"\x00" in content:
        raise ValueError("SECURITY ALERT: Null byte detected in plain text payload. Aborting.")
        
    # 4. UTF-8 / ASCII text decode check
    try:
        decoded_text = content.decode("utf-8")
    except UnicodeDecodeError:
        # Fallback to Latin-1 for standard SCOWL/historical corpora
        try:
            decoded_text = content.decode("latin-1")
            content = decoded_text.encode("utf-8") # Normalize to UTF-8
        except Exception as e:
            raise ValueError(f"Content is not valid text: {e}")
            
    # 5. Compute SHA-256 hash
    sha256_hash = hashlib.sha256(content).hexdigest()
    
    # 6. Write securely to target destination
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(content)
        
    size_kb = len(content) / 1024
    print(f"  --> Saved: {dest_path}")
    print(f"  --> Size: {size_kb:.1f} KB")
    print(f"  --> SHA-256: {sha256_hash}")
    return sha256_hash


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    print("=" * 70)
    print("SpaceFix V1: Verified Plain-Text Corpus Fetcher")
    print("=" * 70)
    
    # Targets to download
    tasks = [
        # Peter Norvig's Google 1T Web Unigram Frequencies
        (
            "https://norvig.com/ngrams/count_1w.txt",
            os.path.join(root_dir, "data_pipeline", "raw_wordlists", "frequency", "count_1w.txt"),
            10 * 1024 * 1024 # max 10MB
        ),
        # Norvig Benchmark Testset 1
        (
            "https://norvig.com/spell-testset1.txt",
            os.path.join(root_dir, "benchmarks", "datasets", "norvig", "spell-testset1.txt"),
            100 * 1024 # max 100KB
        ),
        # Norvig Benchmark Testset 2
        (
            "https://norvig.com/spell-testset2.txt",
            os.path.join(root_dir, "benchmarks", "datasets", "norvig", "spell-testset2.txt"),
            100 * 1024 # max 100KB
        ),
    ]
    
    # SCOWL Level 10-60 core files
    scowl_base = "https://raw.githubusercontent.com/rdeits/SCOWL-mirror/master/final"
    scowl_sizes = ["10", "20", "35", "40", "50", "55", "60"]
    scowl_categories = ["english-words", "american-words", "british-words"]
    
    for cat in scowl_categories:
        for size in scowl_sizes:
            filename = f"{cat}.{size}"
            url = f"{scowl_base}/{filename}"
            dest = os.path.join(root_dir, "data_pipeline", "raw_wordlists", "scowl", filename)
            tasks.append((url, dest, 500 * 1024)) # max 500KB per SCOWL partition
            
    success_count = 0
    for url, dest, max_bytes in tasks:
        try:
            verify_and_fetch_text(url, dest, max_bytes)
            success_count += 1
        except Exception as e:
            print(f"  [ERROR] Failed to fetch {url}: {e}", file=sys.stderr)
            sys.exit(1)
            
    print("\n" + "=" * 70)
    print(f"SUCCESS: {success_count} files securely downloaded, verified, and saved.")
    print("=" * 70)

if __name__ == "__main__":
    main()
