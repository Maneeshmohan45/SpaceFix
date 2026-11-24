import os
import sys
import zipfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, 'extension')
OUT_ZIP = os.path.join(ROOT_DIR, 'spacefix-edge-v1.0.1.zip')

def main():
    print(f"Packaging Edge build: {SRC_DIR} -> {OUT_ZIP}...")
    if os.path.exists(OUT_ZIP):
        os.remove(OUT_ZIP)

    with zipfile.ZipFile(OUT_ZIP, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(SRC_DIR):
            dirs.sort()
            files.sort()
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, SRC_DIR)
                # Ensure POSIX forward slashes in zip headers
                posix_name = rel_path.replace('\\', '/')
                z.write(full_path, posix_name)

    size = os.path.getsize(OUT_ZIP)
    print(f"✅ Created {os.path.basename(OUT_ZIP)} ({size:,} bytes)")

    # Verify root manifest.json and no backslashes
    with zipfile.ZipFile(OUT_ZIP, 'r') as z:
        names = z.namelist()
        assert 'manifest.json' in names, "manifest.json must be at zip root!"
        assert not any('\\' in n for n in names), "Zip contains backslashes!"
        print(f"✅ Verified {len(names)} files in package with manifest.json at root and zero backslashes.")

if __name__ == '__main__':
    main()
