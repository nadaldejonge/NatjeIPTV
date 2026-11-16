"""Verify the delivered APK, renderer parity and launcher without account data."""
from pathlib import Path
from zipfile import ZipFile
from hashlib import sha256
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
apk = root / "artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.12-categories-debug.apk"
with ZipFile(apk) as package:
    renderer = [file for file in (root / "dist/renderer").rglob("*") if file.is_file()]
    for file in renderer:
        name = "assets/public/" + file.relative_to(root / "dist/renderer").as_posix()
        assert file.read_bytes() == package.read(name), name
    javascript = b"\n".join(file.read_bytes() for file in renderer if file.suffix == ".js")
    assert b"2026-11-16.12" in javascript
    assert b"__NATJE_TEST_PLATFORM__" not in javascript
    assert b"cf.portaltivi.site" not in javascript
    assert b"Alles uit" in javascript and b"categoryPreferences" in javascript
    assert not any("androidTest" in name or "test-tv-" in name for name in package.namelist())
for density, size in [("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)]:
    with Image.open(root / f"android/app/src/main/res/mipmap-{density}/natje_iptv_launcher.png") as image:
        assert image.size == (size,size)
with Image.open(root / "android/app/src/main/res/drawable-nodpi/natje_iptv_shelf.png") as image:
    assert image.size == (320,180)
badging = (root / "logs/android-tv-0.1.12-badging.log").read_text(encoding="utf-8-sig")
assert "versionCode='12'" in badging and "versionName='0.1.12-categories'" in badging
assert "nl.natje.iptvplayer" in badging
signatures = [(root / f"logs/android-tv-0.1.{version}-signature.log").read_text(encoding="utf-8-sig") for version in (11,12)]
digests = [next(line for line in data.splitlines() if "certificate SHA-256 digest:" in line) for data in signatures]
assert digests[0] == digests[1], "Update must use the existing signer"
info = {
    "versionName":"0.1.12-categories", "versionCode":12, "buildId":"2026-11-16.12",
    "rendererFilesByteVerified":len(renderer), "testFixturesExcluded":True,
    "sameSignerAsPrevious":True, "size":apk.stat().st_size, "sha256":sha256(apk.read_bytes()).hexdigest()
}
(root / "artifacts/android-tv/build-info-0.1.12.json").write_text(json.dumps(info,indent=2),encoding="utf-8")
print(json.dumps(info,indent=2))
