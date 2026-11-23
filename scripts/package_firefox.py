import os
import sys
import zipfile
import subprocess
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, 'extension_firefox')
OUT_ZIP = os.path.join(ROOT_DIR, 'spacefix-firefox-v1.0.0.zip')
KIT_DIR = os.path.join(ROOT_DIR, 'SpaceFix-Firefox-AMO-Submission-Kit')
KIT_ZIP = os.path.join(ROOT_DIR, 'SpaceFix-Firefox-AMO-Submission-Kit.zip')

def build_zip(src_folder, dest_zip_path):
    print(f"Packaging {src_folder} -> {dest_zip_path}...")
    if os.path.exists(dest_zip_path):
        os.remove(dest_zip_path)

    with zipfile.ZipFile(dest_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src_folder):
            dirs.sort()
            files.sort()
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, src_folder)
                # CRITICAL: Force POSIX forward slashes in ZIP entry headers!
                # Windows '\\' triggers "Invalid file name in archive" in Mozilla AMO linter.
                posix_name = rel_path.replace('\\', '/')
                z.write(full_path, posix_name)
    print(f"  Created {os.path.basename(dest_zip_path)} ({os.path.getsize(dest_zip_path):,} bytes)")

def main():
    # 1. Package extension_firefox into spacefix-firefox-v1.0.0.zip
    build_zip(SRC_DIR, OUT_ZIP)

    # 2. Update Submission Kit folder
    os.makedirs(os.path.join(KIT_DIR, 'assets'), exist_ok=True)
    shutil.copy(OUT_ZIP, os.path.join(KIT_DIR, 'spacefix-firefox-v1.0.0.zip'))

    # Ensure only png assets are in KIT_DIR/assets
    for item in os.listdir(os.path.join(SRC_DIR, 'assets')):
        if item.endswith('.png'):
            shutil.copy(os.path.join(SRC_DIR, 'assets', item), os.path.join(KIT_DIR, 'assets', item))

    # Clean any accidental json/bin files in KIT_DIR/assets
    for item in os.listdir(os.path.join(KIT_DIR, 'assets')):
        if not item.endswith('.png'):
            os.remove(os.path.join(KIT_DIR, 'assets', item))

    # 3. Package SpaceFix-Firefox-AMO-Submission-Kit.zip
    build_zip(KIT_DIR, KIT_ZIP)

    # 4. Run official Mozilla addons-linter validation
    print("\n--- Running Mozilla Add-ons Linter (addons-linter) ---")
    cmd = ["npx.cmd" if os.name == "nt" else "npx", "addons-linter", OUT_ZIP]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(res.stdout)
    if res.stderr:
        print(res.stderr)

    if res.returncode != 0:
        print("❌ Linter reported errors!")
        sys.exit(1)
    else:
        print("✅ AMO LINTER VALIDATION PASSED! 0 ERRORS.")

if __name__ == '__main__':
    main()
