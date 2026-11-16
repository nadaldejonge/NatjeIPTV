"""Read-only branding/legacy-asset verification. Does not build or install the app."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile
import json
import xml.etree.ElementTree as ET
from PIL import Image

root = Path(__file__).resolve().parents[1]
brand = root / "src/renderer/public/branding/natje-2026"
archive = Path.home() / "Downloads/Natje_IPTV_Logopakket.zip"
with ZipFile(archive) as package:
    names = [name for name in package.namelist() if not name.endswith("/")]
    for name in names:
        assert (brand / name).read_bytes() == package.read(name), name
print(f"PASS {len(names)} supplied files preserved byte-for-byte")

resources = root / "android/app/src/main/res"
for density, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    with Image.open(resources / f"mipmap-{density}/natje_launcher.png") as icon:
        assert icon.size == (size, size), density
print("PASS all 5 Android launcher density sizes")
with Image.open(root / "public/icons/natje-app.ico") as icon:
    assert {(n, n) for n in [16, 24, 32, 48, 64, 128, 256]} <= icon.ico.sizes()
print("PASS Windows ICO contains 7 sizes")
with Image.open(resources / "drawable-nodpi/natje_tv_banner.png") as banner:
    assert banner.size == (320, 180)
print("PASS TV banner is supplied 320x180 source")
assert (resources / "drawable-nodpi/natje_joint_mark.png").read_bytes() == (brand / "natje-joint-icon-512.png").read_bytes()
for file in resources.rglob("natje_*.xml"):
    ET.parse(file)
ET.parse(resources / "values/styles.xml")
ET.parse(root / "android/app/src/main/AndroidManifest.xml")
print("PASS native branding XML is well-formed")

pointer = root.parent / "Player-backup-latest.txt"
backup = Path(pointer.read_text(encoding="utf-8-sig").strip())
manifest = json.loads((backup / "asset-manifest.json").read_text(encoding="utf-8-sig"))
original_count = 0
for entry in manifest:
    file = root / entry["path"]
    assert file.exists(), f"Legacy asset removed: {entry['path']}"
    if entry["path"].replace("\\", "/") == "android/app/src/main/res/values/styles.xml":
        continue  # Theme now refers to new resources; previous image files are retained.
    assert sha256(file.read_bytes()).hexdigest().upper() == entry["sha256"], entry["path"]
    original_count += 1
print(f"PASS {original_count} original assets unchanged, none removed")
