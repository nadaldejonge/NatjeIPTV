"""Package the supplied logo assets; only technical size/ICO conversion, no redesign.

Run with the bundled Python (Pillow). Original PNGs and all legacy assets are retained.
"""
from pathlib import Path
import shutil
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "src/renderer/public/branding/natje-2026"
resources = root / "android/app/src/main/res"

for density, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    target = resources / f"mipmap-{density}/natje_launcher.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    supplied = source / f"natje-joint-icon-{size}.png"
    if supplied.exists():
        shutil.copyfile(supplied, target)
    else:
        with Image.open(source / "natje-joint-icon-512.png") as image:
            image.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS).save(target)

drawable = resources / "drawable-nodpi"
drawable.mkdir(exist_ok=True)
shutil.copyfile(source / "natje-joint-icon-512.png", drawable / "natje_joint_mark.png")
shutil.copyfile(source / "natje-tv-banner-320x180.png", drawable / "natje_tv_banner.png")

with Image.open(source / "natje-joint-icon-512.png") as image:
    target = root / "public/icons/natje-app.ico"
    image.convert("RGBA").save(target, format="ICO", sizes=[(s, s) for s in [16, 24, 32, 48, 64, 128, 256]])

print("Branding resources prepared; original logos and previous assets preserved.")
