# Android TV launcher artwork — 18 November 2026

## Reference and resource selection

Inspected the actual installed NatjeTube 2.1.2 APK on the Xiaomi Android 14 TV, together with the local NatjeTube branding sources. The Android 11+ `nodpi-v30` override is important: comparing only the ordinary icon misses the additional padding used on this TV.

| Use | NatjeTube resource | Canvas | Visible artwork bounds, alpha > 128 |
| --- | --- | --- | --- |
| App icon, Android 11+ (including Natje TV tiles) | mipmap-nodpi-v30/app_icon | 320 × 320 | (67, 75)–(253, 240), 186 × 165 |
| App icon, older Android | mipmap-nodpi/app_icon | 320 × 320 | (47, 56)–(274, 258), 227 × 202 |
| Android TV homescreen banner | mipmap-nodpi/app_banner | 640 × 360 | Opaque 16:9 background |
| Application logo | mipmap-nodpi/app_logo | 180 × 180 | (25, 30)–(155, 147), 130 × 117 |

Bounds are exclusive on their right/bottom edge. The IPTV exports use these exact canvas sizes and icon/logo bounds. The banner keeps the same compact central placement: measured bright artwork occupies approximately (204, 63)–(433, 275), compared with (205, 63)–(433, 275) in the reference. Generated artwork is a raster edit of the original design, rather than a pixel-identical recolour; the text now reads `NatjeIPTV` and the palette is glossy black/white.

Natje TV's launcher loads `ApplicationInfo.loadIcon()`, rasterizes to 256 × 256, and shows a 104dp square tile with round clipping and CENTER_CROP. At this TV's 320dpi density the tile is 208 × 208 screen pixels. Neither NatjeTube nor IPTV has a custom artwork override in the launcher configuration. Google TV's broad tiles use the manifest banner. IPTV now declares separate icon, roundIcon, banner and logo references; roundIcon uses the same padded artwork as icon.

Public source references:

- [NatjeTube Android manifest](https://github.com/nadaldejonge/NatjeTube/blob/main/smarttubetv/src/main/AndroidManifest.xml)
- [NatjeTube branding configuration](https://github.com/nadaldejonge/NatjeTube/blob/main/natjetube-branding.gradle)
- [NatjeTube branding inventory](https://github.com/nadaldejonge/NatjeTube/blob/main/branding-inventory.json)

## Saved artwork and reproduction

Built-in `image_gen.imagegen` edit mode was used, referencing the original NatjeTube PNGs. No CLI/API fallback was used. Selected masters are committed at:

- `src/renderer/public/branding/launcher-2026-11/natje-iptv-natjetube-icon-master.png`
- `src/renderer/public/branding/launcher-2026-11/natje-iptv-natjetube-banner-master.png`

`python scripts/prepare-launcher.py` (Pillow required) performs only technical resizing/padding, preserves alpha, asserts the exact visible icon/logo bounds and exports the four native resources. Previous artwork and all in-app assets are retained. No playback, login, settings, filters, search or Windows code changes are included.

Icon edit prompt:

> PRECISE EDIT of the supplied original NatjeTube app icon. This is an existing brand mark that must be retained, not a new logo design. Keep the EXACT same N/play monogram shape, same tilted rounded-square silhouette, same tilt angle, same relative dimensions, same thin rim width, same black lower wordmark strip and underline, and same bold italic typography/layout. Only replace the substring 'Tube' with 'IPTV' so the wordmark reads exactly 'NatjeIPTV' (no space), with 'Natje' and 'IPTV' aligned exactly like 'Natje' and 'Tube' in the source. Only recolor the source's red outline, red play triangle and red Tube letters into glossy white/pearl white, keeping the badge and wordmark strip glossy deep black. Keep the N white with the source's subtle gloss. The look should be the ORIGINAL NatjeTube logo with one word and its palette edited. Do not add, remove, enlarge or redesign any frame, do not add a pill, no thick chrome, no new badge around the text, no new N letterform, no dramatic 3D. Preserve the original transparent square canvas and generous transparent margins. One complete icon, sharp clean edges, genuinely transparent outside background, no mockup, no circle backdrop, no extra text.

Final icon cleanup prompt:

> Clean up ONLY the transparent cutout edge of this exact NatjeIPTV logo. Remove every stray detached white fleck, speckle and rough white residue outside the smooth rounded badge and smooth wordmark silhouette, especially above the top rim and below the underline. Keep the complete logo, typography 'NatjeIPTV', glossy black surfaces, white N and play triangle, exact design, same angle, composition and proportions unchanged. The white outer badge rim should be smooth and thin like the original NatjeTube branding, with no thick chrome extrusion. Do not redesign or add any element. Output the complete same icon on genuinely transparent background with clean antialiased edges and generous empty margins.

Banner edit prompt:

> Precisely edit this existing NatjeTube Android TV homescreen banner. Preserve the EXACT source composition and geometry: 16:9 wide canvas, dark background, centrally positioned original tilted N/play badge, the same compact lower wordmark strip, original underline and subtle horizontal decorative lines. Keep the central logo's size and position EXACTLY as in the reference, with the same surrounding negative space. Change ONLY 'Tube' to 'IPTV', making the wordmark exactly 'NatjeIPTV' (no space) with the original bold italic typography, and recolor all red branding accents (thin badge outline, play triangle, Tube/IPTV letters, underline and subtle decorative lines) to glossy white/pearl white. Black surfaces become glossy deep black rather than purplish, retaining subtle source lighting. N stays glossy white. This must look like the original NatjeTube banner with edited text and black/white palette, not a new logo or layout. No extra frames, no enlarged logo, no thick silver chrome or bevels, no pill frame around wordmark, no new N shape, no other text. Opaque background. Match the supplied 640x360 banner's 16:9 aspect ratio exactly.

## Release verification

Built Android 0.1.16-branding / versionCode 16 successfully. Export dimensions/margins, all four packaged PNG resources and the nodpi-v30 configuration passed verification. The signing certificate matches 0.1.15 and all 30 packaged renderer assets are byte-for-byte unchanged. The in-place Xiaomi TV installation succeeded; installed version 16 and the original first-install time (2026-11-03 19:32:22) were confirmed. Natje TV was reopened to refresh its icon cache. Detailed build/install evidence is stored locally under `artifacts/android-tv` and `artifacts/icon-match-2026-11-18` (excluded from Git).

APK: `Natje-IPTV-AndroidTV-0.1.16-branding-debug.apk`.
SHA-256: `410310bb411f05bcfe5c836f472a41660e8bb135d452163d8ef92c7c92fad05c`.
