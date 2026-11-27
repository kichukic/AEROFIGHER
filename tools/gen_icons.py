#!/usr/bin/env python3
"""
Generates high-resolution gaming app icons for AeroFighter:
- assets/icon.png (1024x1024)
- assets/android-icon-background.png (1024x1024)
- assets/android-icon-foreground.png (1024x1024)
- assets/android-icon-monochrome.png (1024x1024)
- assets/splash-icon.png (512x512)
- assets/favicon.png (48x48)
"""
import math
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024

def draw_background(size=SIZE):
    # Radial dark stealth gradient with subtle radar grid
    img = Image.new("RGBA", (size, size), (7, 15, 30, 255))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2

    # Concentric radial gradient
    for r in range(size // 2, 0, -8):
        alpha = int(255 * (1.0 - (r / (size // 2)) * 0.45))
        # subtle blue gradient
        color = (int(7 + (18 - 7) * (1 - r / (size / 2))),
                 int(15 + (38 - 15) * (1 - r / (size / 2))),
                 int(30 + (70 - 30) * (1 - r / (size / 2))),
                 255)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    # Radar concentric circles
    radar_color = (0, 245, 212, 28)
    for rad in [140, 260, 380]:
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=radar_color, width=2)

    # Radar crosshair lines
    cross_color = (0, 245, 212, 35)
    draw.line([cx - 420, cy, cx + 420, cy], fill=cross_color, width=2)
    draw.line([cx, cy - 420, cx, cy + 420], fill=cross_color, width=2)

    # Diagonal tick marks
    diag_color = (255, 210, 63, 30)
    draw.line([cx - 280, cy - 280, cx + 280, cy + 280], fill=diag_color, width=1)
    draw.line([cx - 280, cy + 280, cx + 280, cy - 280], fill=diag_color, width=1)

    return img

def draw_jet(draw, cx, cy, scale=1.0, monochrome=False):
    """Draws an aggressive top-down stealth fighter jet soaring upwards."""
    # Afterburner flames behind engines (soaring up means flames point down)
    if not monochrome:
        # Flame glow
        flame_len = 110 * scale
        flame_w = 24 * scale
        # Left engine flame
        draw.polygon([
            (cx - 32 * scale, cy + 130 * scale),
            (cx - 32 * scale - flame_w / 2, cy + 140 * scale),
            (cx - 32 * scale, cy + 130 * scale + flame_len),
            (cx - 32 * scale + flame_w / 2, cy + 140 * scale),
        ], fill=(0, 245, 212, 180))
        draw.polygon([
            (cx - 32 * scale, cy + 130 * scale),
            (cx - 32 * scale - flame_w / 4, cy + 138 * scale),
            (cx - 32 * scale, cy + 130 * scale + flame_len * 0.7),
            (cx - 32 * scale + flame_w / 4, cy + 138 * scale),
        ], fill=(255, 255, 255, 240))

        # Right engine flame
        draw.polygon([
            (cx + 32 * scale, cy + 130 * scale),
            (cx + 32 * scale - flame_w / 2, cy + 140 * scale),
            (cx + 32 * scale, cy + 130 * scale + flame_len),
            (cx + 32 * scale + flame_w / 2, cy + 140 * scale),
        ], fill=(0, 245, 212, 180))
        draw.polygon([
            (cx + 32 * scale, cy + 130 * scale),
            (cx + 32 * scale - flame_w / 4, cy + 138 * scale),
            (cx + 32 * scale, cy + 130 * scale + flame_len * 0.7),
            (cx + 32 * scale + flame_w / 4, cy + 138 * scale),
        ], fill=(255, 255, 255, 240))

    body_fill = (255, 255, 255, 255) if monochrome else (28, 44, 72, 255)
    body_outline = (255, 255, 255, 255) if monochrome else (0, 245, 212, 255)
    wing_fill = (240, 240, 240, 255) if monochrome else (38, 58, 92, 255)
    wing_trim = (200, 200, 200, 255) if monochrome else (255, 210, 63, 255)

    # Main Swept Wings (F-22 style diamond delta)
    # Wing polygon
    wings = [
        (cx, cy - 90 * scale),
        (cx + 195 * scale, cy + 45 * scale),
        (cx + 205 * scale, cy + 85 * scale),
        (cx + 65 * scale, cy + 115 * scale),
        (cx + 50 * scale, cy + 145 * scale),
        (cx - 50 * scale, cy + 145 * scale),
        (cx - 65 * scale, cy + 115 * scale),
        (cx - 205 * scale, cy + 85 * scale),
        (cx - 195 * scale, cy + 45 * scale),
    ]
    draw.polygon(wings, fill=wing_fill, outline=body_outline)

    # Wing Leading Edge Trim
    if not monochrome:
        draw.line([(cx, cy - 90 * scale), (cx + 195 * scale, cy + 45 * scale)], fill=wing_trim, width=int(5 * scale))
        draw.line([(cx, cy - 90 * scale), (cx - 195 * scale, cy + 45 * scale)], fill=wing_trim, width=int(5 * scale))

    # Fuselage (central body)
    fuselage = [
        (cx, cy - 195 * scale),              # Sharp needle nose
        (cx + 16 * scale, cy - 120 * scale),
        (cx + 38 * scale, cy - 20 * scale),
        (cx + 42 * scale, cy + 120 * scale),
        (cx + 24 * scale, cy + 140 * scale),
        (cx - 24 * scale, cy + 140 * scale),
        (cx - 42 * scale, cy + 120 * scale),
        (cx - 38 * scale, cy - 20 * scale),
        (cx - 16 * scale, cy - 120 * scale),
    ]
    draw.polygon(fuselage, fill=body_fill, outline=body_outline)

    # Twin Vertical Stabilizer Fins
    tail_l = [
        (cx - 40 * scale, cy + 70 * scale),
        (cx - 85 * scale, cy + 145 * scale),
        (cx - 50 * scale, cy + 155 * scale),
        (cx - 30 * scale, cy + 125 * scale),
    ]
    draw.polygon(tail_l, fill=wing_fill, outline=body_outline)

    tail_r = [
        (cx + 40 * scale, cy + 70 * scale),
        (cx + 85 * scale, cy + 145 * scale),
        (cx + 50 * scale, cy + 155 * scale),
        (cx + 30 * scale, cy + 125 * scale),
    ]
    draw.polygon(tail_r, fill=wing_fill, outline=body_outline)

    # Cockpit Canopy
    canopy_fill = (255, 255, 255, 255) if monochrome else (255, 210, 63, 230)
    canopy_outline = (255, 255, 255, 255) if monochrome else (255, 255, 255, 255)
    canopy = [
        (cx, cy - 110 * scale),
        (cx + 12 * scale, cy - 65 * scale),
        (cx + 11 * scale, cy - 15 * scale),
        (cx, cy + 5 * scale),
        (cx - 11 * scale, cy - 15 * scale),
        (cx - 12 * scale, cy - 65 * scale),
    ]
    draw.polygon(canopy, fill=canopy_fill, outline=canopy_outline)

    # Target Lock Reticle around the jet nose
    if not monochrome:
        reticle_r = 85 * scale
        rc = (255, 59, 92, 220)
        # 4 corners
        blen = 22 * scale
        draw.line([(cx - reticle_r, cy - 110 * scale - reticle_r + blen), (cx - reticle_r, cy - 110 * scale - reticle_r)], fill=rc, width=3)
        draw.line([(cx - reticle_r, cy - 110 * scale - reticle_r), (cx - reticle_r + blen, cy - 110 * scale - reticle_r)], fill=rc, width=3)
        draw.line([(cx + reticle_r, cy - 110 * scale - reticle_r + blen), (cx + reticle_r, cy - 110 * scale - reticle_r)], fill=rc, width=3)
        draw.line([(cx + reticle_r, cy - 110 * scale - reticle_r), (cx + reticle_r - blen, cy - 110 * scale - reticle_r)], fill=rc, width=3)
        draw.line([(cx - reticle_r, cy - 110 * scale + reticle_r - blen), (cx - reticle_r, cy - 110 * scale + reticle_r)], fill=rc, width=3)
        draw.line([(cx - reticle_r, cy - 110 * scale + reticle_r), (cx - reticle_r + blen, cy - 110 * scale + reticle_r)], fill=rc, width=3)
        draw.line([(cx + reticle_r, cy - 110 * scale + reticle_r - blen), (cx + reticle_r, cy - 110 * scale + reticle_r)], fill=rc, width=3)
        draw.line([(cx + reticle_r, cy - 110 * scale + reticle_r), (cx + reticle_r - blen, cy - 110 * scale + reticle_r)], fill=rc, width=3)

def generate_icons():
    # 1. Background image (1024x1024)
    bg = draw_background(SIZE)
    bg.save("assets/android-icon-background.png", "PNG")
    print("Saved assets/android-icon-background.png")

    # 2. Foreground image (1024x1024)
    fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(fg)
    draw_jet(fg_draw, SIZE // 2, SIZE // 2, scale=1.35)
    fg.save("assets/android-icon-foreground.png", "PNG")
    print("Saved assets/android-icon-foreground.png")

    # 3. Combined main icon (1024x1024)
    icon = bg.copy()
    icon.alpha_composite(fg)
    icon.save("assets/icon.png", "PNG")
    print("Saved assets/icon.png")

    # 4. Monochrome adaptive icon (1024x1024)
    mono = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mono_draw = ImageDraw.Draw(mono)
    draw_jet(mono_draw, SIZE // 2, SIZE // 2, scale=1.35, monochrome=True)
    mono.save("assets/android-icon-monochrome.png", "PNG")
    print("Saved assets/android-icon-monochrome.png")

    # 5. Splash screen icon (512x512)
    splash = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(splash)
    draw_jet(sp_draw, 256, 256, scale=0.85)
    splash.save("assets/splash-icon.png", "PNG")
    print("Saved assets/splash-icon.png")

    # 6. Favicon (48x48)
    fav = icon.resize((48, 48), Image.Resampling.LANCZOS)
    fav.save("assets/favicon.png", "PNG")
    print("Saved assets/favicon.png")

if __name__ == "__main__":
    generate_icons()
