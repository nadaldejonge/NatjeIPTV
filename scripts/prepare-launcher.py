"""Package the approved generated launcher as Android density and TV shelf assets.

Only technical resizing/letterboxing. In-app branding and original logo files are retained.
"""
from pathlib import Path
import shutil
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "src/renderer/public/branding/launcher-2026-11/natje-iptv-launcher-v2.png"
resources = root / "android/app/src/main/res"
shutil.copyfile(source, resources / "drawable-nodpi/natje_iptv_launcher_hd.png")
with Image.open(source) as image:
    image = image.convert("RGBA")
    for density, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
        image.resize((size, size), Image.Resampling.LANCZOS).save(resources / f"mipmap-{density}/natje_iptv_launcher.png")
    banner = Image.new("RGBA", (320, 180), (12, 13, 16, 255))
    mark = image.resize((176, 176), Image.Resampling.LANCZOS)
    banner.alpha_composite(mark, (72, 2))
    banner.convert("RGB").save(resources / "drawable-nodpi/natje_iptv_shelf.png")
print("PASS launcher packaged in 5 densities and TV shelf; in-app assets unchanged")
