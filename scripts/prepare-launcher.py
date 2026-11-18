"""Export artwork using installed NatjeTube sizes and visible-content margins.

Technical resizing/padding only. Original and in-app assets remain available.
Run with Python + Pillow from any directory.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / "src/renderer/public/branding/launcher-2026-11"
RESOURCES = ROOT / "android/app/src/main/res"


def solid_bounds(image):
    return image.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()


def fit_artwork(image, size, bounds):
    """Retain transparent edge pixels; normalize the visible mark's bounds."""
    left, top, right, bottom = solid_bounds(image)
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    base_width = round(image.width * width / (right - left))
    base_height = round(image.height * height / (bottom - top))
    # Search adjacent raster sizes instead of skipping sizes through rounding.
    offsets = (0, -1, 1, -2, 2, -3, 3, -4, 4)
    for dx, dy in ((x, y) for x in offsets for y in offsets):
        scaled = image.resize((base_width + dx, base_height + dy), Image.Resampling.LANCZOS)
        actual = solid_bounds(scaled)
        actual_width, actual_height = actual[2] - actual[0], actual[3] - actual[1]
        if (actual_width, actual_height) == (width, height):
            break
    else:
        raise ValueError("Artwork cannot match reference bounds")
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(scaled, (bounds[0] - actual[0], bounds[1] - actual[1]))
    assert solid_bounds(canvas) == bounds
    return canvas


def main():
    icon = Image.open(BRANDING / "natje-iptv-natjetube-icon-master.png").convert("RGBA")
    variants = [
        ("mipmap-nodpi/natje_app_icon.png", (320, 320), (47, 56, 274, 258)),
        ("mipmap-nodpi-v30/natje_app_icon.png", (320, 320), (67, 75, 253, 240)),
        ("mipmap-nodpi/natje_app_logo.png", (180, 180), (25, 30, 155, 147)),
    ]
    exported = {}
    for name, size, bounds in variants:
        target = RESOURCES / name
        target.parent.mkdir(parents=True, exist_ok=True)
        image = fit_artwork(icon, size, bounds)
        image.save(target)
        exported[name] = {"size": size, "solidAlphaBounds": solid_bounds(image)}
    banner = Image.open(BRANDING / "natje-iptv-natjetube-banner-master.png").convert("RGB")
    # Generated raster dimensions may round the intended 16:9 height by one pixel.
    assert abs(banner.height - banner.width * 9 / 16) <= 1, "Banner must be 16:9"
    banner = banner.resize((640, 360), Image.Resampling.LANCZOS)
    banner.save(RESOURCES / "mipmap-nodpi/natje_app_banner.png")
    exported["mipmap-nodpi/natje_app_banner.png"] = {"size": banner.size}
    print(json.dumps(exported, indent=2))


if __name__ == "__main__":
    main()
