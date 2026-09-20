"""Pillow renderers for AHOY's card images (/profile and welcome cards).

Fonts are resolved from a small list of common system paths; if none exist
Pillow's bundled bitmap font is used so commands still work everywhere.
Drop your own TTFs in ``bot/assets/fonts`` to override.
"""

from __future__ import annotations

import io
import os
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from ..utils.logger import get_logger
from .level_service import format_xp

log = get_logger("cards")

WIDTH, HEIGHT = 1000, 400
TEAL = (31, 182, 166)
GOLD = (224, 177, 92)
INK = (233, 241, 245)
MUTED = (150, 170, 182)

ASSET_FONTS = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "fonts")
FONT_CANDIDATES = [
    os.path.join(ASSET_FONTS, "Inter-Bold.ttf"),
    os.path.join(ASSET_FONTS, "font.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
]


def _font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:  # pragma: no cover
                continue
    return ImageFont.load_default()


def _rounded(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius, fill=255)
    return mask


def _backdrop(bg_bytes: Optional[bytes] = None) -> Image.Image:
    """Deep-harbour gradient with soft teal/gold light blooms, or a custom
    banner image cropped/blurred to fit if one was provided."""
    if bg_bytes:
        try:
            custom = Image.open(io.BytesIO(bg_bytes)).convert("RGB")
            ratio = max(WIDTH / custom.width, HEIGHT / custom.height)
            custom = custom.resize((int(custom.width * ratio) + 1, int(custom.height * ratio) + 1))
            x = (custom.width - WIDTH) // 2
            y = (custom.height - HEIGHT) // 2
            custom = custom.crop((x, y, x + WIDTH, y + HEIGHT))
            darken = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
            return Image.blend(custom, darken, 0.35)
        except Exception as exc:  # pragma: no cover - broken URL
            log.warning("Custom background render failed, using default: %s", exc)

    base = Image.new("RGB", (WIDTH, HEIGHT), (10, 18, 26))
    draw = ImageDraw.Draw(base)
    for y in range(HEIGHT):
        t = y / HEIGHT
        draw.line(
            [(0, y), (WIDTH, y)],
            fill=(int(10 + 8 * t), int(18 + 16 * t), int(26 + 24 * t)),
        )
    glow = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([-120, -160, 380, 240], fill=(0, 90, 84))
    gdraw.ellipse([680, 220, 1180, 520], fill=(80, 58, 18))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.blend(base, glow, 0.5)


def _glass(image: Image.Image, box: tuple[int, int, int, int], radius: int = 28) -> None:
    x0, y0, x1, y1 = box
    region = image.crop(box).filter(ImageFilter.GaussianBlur(18))
    overlay = Image.new("RGBA", region.size, (255, 255, 255, 26))
    region = Image.alpha_composite(region.convert("RGBA"), overlay)
    image.paste(region.convert("RGB"), (x0, y0), _rounded(region.size, radius))
    ImageDraw.Draw(image).rounded_rectangle(box, radius, outline=(255, 255, 255, 40), width=2)


def render_profile_card(
    *,
    username: str,
    discriminator: str,
    avatar_bytes: Optional[bytes],
    level: int,
    progress_current: float,
    progress_needed: int,
    total_xp: float,
    rank: int,
    messages: int,
    voice_time: str,
    joined_server: str,
    joined_discord: str,
) -> io.BytesIO:
    """Render the AHOY profile card in the supplied premium HUD reference style."""

    # The reference is a wide cinematic HUD rather than a tall profile panel.
    w, h = 1536, 480

    # Deep-ocean base with teal/blue/gold cinematic blooms.
    base = Image.new("RGB", (w, h), (2, 8, 14))
    draw = ImageDraw.Draw(base)
    for y in range(h):
        t = y / max(1, h - 1)
        draw.line(
            [(0, y), (w, y)],
            fill=(int(2 + 5 * t), int(9 + 13 * t), int(15 + 22 * t)),
        )

    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-180, -170, 680, 520), fill=(0, 92, 94))
    gd.ellipse((620, -130, 1570, 430), fill=(0, 72, 110))
    gd.ellipse((800, 300, 1660, 650), fill=(92, 58, 17))
    glow = glow.filter(ImageFilter.GaussianBlur(105))
    base = Image.blend(base, glow, 0.48)

    # Cinematic maritime artwork: moon, stars, ropes, distant ship, spray and wave bands.
    art = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ad = ImageDraw.Draw(art)
    # Moon glow.
    ad.ellipse((1050, 82, 1165, 197), fill=(220, 231, 222, 20), outline=(224, 177, 92, 75), width=2)
    # Fine stars / sparks.
    for x, y, r, a in [
        (650, 72, 2, 115), (720, 112, 2, 90), (805, 70, 3, 105),
        (900, 120, 2, 85), (980, 64, 2, 100), (1210, 72, 2, 95),
        (1290, 118, 3, 90), (1360, 76, 2, 105), (1440, 128, 2, 80),
        (850, 180, 1, 100), (1005, 168, 2, 75),
    ]:
        ad.ellipse((x-r, y-r, x+r, y+r), fill=(240, 224, 175, a))

    # Ghost ship silhouette behind the HUD.
    sx, sy = 1030, 205
    ad.polygon(
        [(sx-190, sy+82), (sx+185, sy+82), (sx+132, sy+118), (sx-150, sy+118)],
        fill=(1, 7, 13, 165),
    )
    ad.rectangle((sx-8, sy-105, sx+8, sy+86), fill=(1, 7, 13, 160))
    ad.rectangle((sx+54, sy-70, sx+64, sy+86), fill=(1, 7, 13, 135))
    ad.polygon([(sx, sy-92), (sx-145, sy-12), (sx, sy+12)], fill=(1, 7, 13, 135))
    ad.polygon([(sx+6, sy-76), (sx+145, sy-6), (sx+6, sy+14)], fill=(1, 7, 13, 120))

    # Decorative rope arcs around the upper HUD.
    ad.arc((420, -170, 1160, 420), 192, 346, fill=(224, 177, 92, 38), width=2)
    ad.arc((520, -210, 1320, 470), 205, 338, fill=(31, 182, 166, 28), width=2)

    # Gold spray / ember particles near the frame.
    for x, y, r in [(480, 82, 3), (520, 62, 2), (560, 92, 2), (1260, 210, 3), (1320, 236, 2), (1380, 205, 2)]:
        ad.ellipse((x-r, y-r, x+r, y+r), fill=(224, 177, 92, 75))

    # Sea haze and wave bands.
    sea = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sea)
    import math
    for row in range(7):
        pts = []
        for x in range(390, w + 20, 16):
            yy = 268 + row * 22 + int(8 * math.sin(x / 66 + row * 0.7))
            pts.append((x, yy))
        sd.line(pts, fill=(31, 182, 166, max(9, 34 - row * 4)), width=2)
    base = Image.alpha_composite(base.convert("RGBA"), art).convert("RGB")


    # Cinematic pirate artwork: moon, clouds, stars, ghost ship, sea haze and
    # faint nautical chart lines. Kept deliberately low-contrast so the HUD text stays readable.
    art = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ad = ImageDraw.Draw(art)

    # Moon halo.
    ad.ellipse((1050, -65, 1325, 210), fill=(92, 182, 196, 20))
    ad.ellipse((1095, -25, 1280, 160), fill=(205, 225, 215, 35))
    ad.ellipse((1120, 0, 1260, 140), fill=(235, 225, 180, 48))

    # Stars / navigation lights.
    for sx, sy, r, a in [
        (760, 72, 2, 115), (842, 122, 1, 95), (910, 66, 2, 100),
        (974, 150, 1, 85), (1315, 92, 2, 100), (1390, 138, 1, 90),
        (720, 168, 1, 80), (1215, 205, 1, 75),
    ]:
        ad.ellipse((sx-r, sy-r, sx+r, sy+r), fill=(222, 241, 236, a))

    # Wispy clouds.
    cloud = (2, 11, 18, 90)
    for box in [(735, 105, 970, 170), (1235, 110, 1490, 185), (860, 185, 1120, 235)]:
        ad.ellipse(box, fill=cloud)

    # Ghost ship: hull, stern, masts, sails and rigging.
    sx, sy = 1050, 228
    hull = (1, 8, 14, 170)
    sail = (5, 18, 25, 105)
    rope = (118, 150, 150, 65)
    ad.polygon(
        [(sx-245, sy+58), (sx+205, sy+58), (sx+155, sy+100),
         (sx-185, sy+105), (sx-245, sy+58)], fill=hull
    )
    ad.line([(sx-205, sy+76), (sx+160, sy+76)], fill=(31,182,166,65), width=3)
    # main mast
    ad.line([(sx-45, sy+60), (sx-45, sy-145)], fill=rope, width=5)
    ad.line([(sx+70, sy+60), (sx+70, sy-95)], fill=rope, width=4)
    # sails
    ad.polygon([(sx-42, sy-135), (sx-42, sy+35), (sx-185, sy+25)], fill=sail)
    ad.polygon([(sx-34, sy-125), (sx-34, sy+34), (sx+88, sy+18)], fill=(4,16,24,95))
    ad.polygon([(sx+77, sy-83), (sx+77, sy+33), (sx+172, sy+22)], fill=(4,16,24,82))
    # rigging
    for ex, ey in [(sx-190, sy+25), (sx+170, sy+22), (sx+88, sy+18)]:
        ad.line([(sx-45, sy-140), (ex, ey)], fill=rope, width=2)
    # lanterns / portholes
    for px in [sx-155, sx-85, sx-10, sx+70, sx+135]:
        ad.ellipse((px, sy+62, px+8, sy+70), fill=(224,177,92,100))

    # Distant horizon and layered waves.
    ad.rectangle((0, 330, w, 480), fill=(0, 10, 18, 28))
    import math
    for row in range(8):
        pts = []
        for x in range(-20, w + 20, 14):
            yy = 326 + row * 18 + int(7 * math.sin(x / 72 + row * 0.8))
            pts.append((x, yy))
        ad.line(pts, fill=(31, 182, 166, max(8, 30-row*3)), width=2)

    # Subtle nautical chart arcs / compass geometry.
    for radius, alpha in [(240, 18), (330, 12), (420, 8)]:
        ad.arc((1180-radius, 215-radius, 1180+radius, 215+radius), 195, 345,
               fill=(224,177,92,alpha), width=2)
    ad.line([(700, 300), (1450, 300)], fill=(224,177,92,18), width=1)
    ad.line([(820, 245), (1460, 360)], fill=(31,182,166,14), width=1)

    art = art.filter(ImageFilter.GaussianBlur(1.2))
    base = Image.alpha_composite(base.convert("RGBA"), art).convert("RGB")

    card = base.convert("RGBA")
    panel = (38, 22, w - 38, h - 24)

    # Dark glass chassis.
    _glass(card, panel, 38)
    _gradient_border(card, panel, 38, 5)

    # Reference-style stepped gold/teal frame and luminous corner brackets.
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    gold = (*GOLD, 215)
    teal = (*TEAL, 220)
    fd.line([(58, 58), (345, 58)], fill=gold, width=4)
    fd.line([(1190, 58), (1478, 58)], fill=teal, width=4)
    fd.line([(58, h - 58), (345, h - 58)], fill=teal, width=4)
    fd.line([(1190, h - 58), (1478, h - 58)], fill=gold, width=4)
    corners = [(64, 64, gold, 1, 1), (1472, 64, teal, -1, 1),
               (64, h - 64, teal, 1, -1), (1472, h - 64, gold, -1, -1)]
    for x, y, col, dx, dy in corners:
        fd.line([(x, y), (x + dx * 46, y)], fill=col, width=5)
        fd.line([(x, y), (x, y + dy * 46)], fill=col, width=5)
        fd.ellipse((x - 7, y - 7, x + 7, y + 7), fill=col)
    # Small central jewel / anchor plate.
    fd.ellipse((w // 2 - 15, 42, w // 2 + 15, 72), outline=gold, width=3)
    fd.ellipse((w // 2 - 9, h - 72, w // 2 + 9, h - 54), fill=teal)
    frame = frame.filter(ImageFilter.GaussianBlur(0.45))
    card.alpha_composite(frame)

    # Thin internal highlight rails.
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(panel, 38, outline=(255, 255, 255, 45), width=2)
    od.line([(88, 93), (w - 88, 93)], fill=(255, 255, 255, 24), width=2)
    card.alpha_composite(overlay)

    draw = ImageDraw.Draw(card, "RGBA")

    # Avatar medallion: large, left aligned, with gold/teal cinematic halo.
    cx, cy, d = 270, 230, 236
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse(
        (cx - d // 2 - 26, cy - d // 2 - 26, cx + d // 2 + 26, cy + d // 2 + 26),
        outline=(31, 182, 166, 95),
        width=14,
    )
    halo = halo.filter(ImageFilter.GaussianBlur(12))
    card.alpha_composite(halo)
    _gradient_ring(
        card,
        (cx - d // 2 - 7, cy - d // 2 - 7, cx + d // 2 + 7, cy + d // 2 + 7),
        7,
    )
    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((d, d))
            card.paste(avatar, (cx - d // 2, cy - d // 2), _rounded((d, d), d // 2))
        except Exception as exc:
            log.warning("Profile avatar render failed: %s", exc)
    draw = ImageDraw.Draw(card, "RGBA")
    draw.ellipse(
        (cx - d // 2, cy - d // 2, cx + d // 2, cy + d // 2),
        outline=GOLD,
        width=3,
    )

    # Anchor medallion under the avatar.
    badge_y = cy + d // 2 + 3
    draw.ellipse(
        (cx - 24, badge_y - 24, cx + 24, badge_y + 24),
        fill=(3, 14, 21, 245),
        outline=GOLD,
        width=3,
    )
    _anchor_glyph(draw, (cx, badge_y), 14, TEAL)

    # Identity block — polished crown insignia (font-independent).
    crown = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crown)
    crown_glow = (490, 72, 620, 155)
    cd.rounded_rectangle(crown_glow, 18, fill=(224, 177, 92, 24))
    crown = crown.filter(ImageFilter.GaussianBlur(10))
    card.alpha_composite(crown)

    draw = ImageDraw.Draw(card, "RGBA")
    cx0, cy0 = 550, 116
    # Crown silhouette with five distinct points, curved base, and jewel highlights.
    crown_poly = [
        (cx0-62, cy0+28), (cx0-51, cy0-20), (cx0-18, cy0+4),
        (cx0, cy0-34), (cx0+22, cy0+4), (cx0+56, cy0-20),
        (cx0+62, cy0+28)
    ]
    draw.polygon(crown_poly, fill=(224, 177, 92, 255))
    draw.rounded_rectangle((cx0-61, cy0+27, cx0+61, cy0+43), 7,
                           fill=(248, 205, 111, 255), outline=(255, 235, 172, 220), width=2)
    # Crown cutouts / dark inner arches so it reads as a crown, not a bat or bow.
    for dx in (-38, 0, 38):
        draw.ellipse((cx0+dx-10, cy0+8, cx0+dx+10, cy0+31), fill=(8, 18, 25, 210))
    # Three jewel points.
    for dx in (-51, 0, 56):
        draw.ellipse((cx0+dx-5, cy0-22, cx0+dx+5, cy0-12), fill=(31, 182, 166, 255))

    draw.text((635, 108), username[:24], font=_font(48), fill=INK)
    draw.text((637, 166), discriminator[:32], font=_font(25), fill=(150, 211, 220, 235))

    # Level/rank capsule — right side, as in the supplied reference.
    capsule = (1035, 62, 1460, 177)
    _glass(card, capsule, 30)
    draw = ImageDraw.Draw(card, "RGBA")
    # Nautical anchor plate.
    draw.ellipse((1060, 78, 1148, 166), fill=(5, 16, 23, 235), outline=GOLD, width=4)
    _anchor_glyph(draw, (1104, 122), 27, GOLD)
    draw.text((1172, 78), f"LEVEL {level}", font=_font(42), fill=TEAL)
    draw.text((1174, 130), f"RANK #{rank}", font=_font(29), fill=GOLD)

    # XP bar and exact reference-style labels.
    bar_x0, bar_y0, bar_x1, bar_y1 = 475, 220, 1455, 263
    draw.rounded_rectangle(
        (bar_x0 - 5, bar_y0 - 5, bar_x1 + 5, bar_y1 + 5),
        25,
        fill=(0, 0, 0, 85),
        outline=(224, 177, 92, 110),
        width=2,
    )
    draw.rounded_rectangle(
        (bar_x0, bar_y0, bar_x1, bar_y1),
        22,
        fill=(2, 14, 20, 235),
        outline=(31, 182, 166, 125),
        width=2,
    )
    ratio = 0.0 if progress_needed <= 0 else max(
        0.0, min(1.0, progress_current / progress_needed)
    )
    filled = bar_x0 + int((bar_x1 - bar_x0) * ratio)
    if filled > bar_x0 + 8:
        # Glow under the fill.
        glowbar = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gbd = ImageDraw.Draw(glowbar)
        gbd.rounded_rectangle(
            (bar_x0, bar_y0, filled, bar_y1),
            22,
            fill=(0, 210, 220, 180),
        )
        glowbar = glowbar.filter(ImageFilter.GaussianBlur(9))
        card.alpha_composite(glowbar)
        draw = ImageDraw.Draw(card, "RGBA")
        draw.rounded_rectangle(
            (bar_x0 + 3, bar_y0 + 3, filled, bar_y1 - 3),
            19,
            fill=(18, 205, 196, 255),
        )
        draw.rounded_rectangle(
            (bar_x0 + 9, bar_y0 + 7, max(bar_x0 + 10, filled - 8), bar_y0 + 14),
            6,
            fill=(210, 255, 252, 75),
        )

    draw = ImageDraw.Draw(card, "RGBA")
    draw.text(
        (475, 278),
        f"{format_xp(progress_current)} / {format_xp(progress_needed)} XP",
        font=_font(28),
        fill=INK,
    )
    # Target is the level threshold; keep the label visually aligned to the reference.
    draw.text(
        (1190, 283),
        f"NEXT: {format_xp(progress_needed)} XP",
        font=_font(20),
        fill=(150, 211, 220, 235),
    )

    # Five compact glass stat tiles across the bottom.
    stats = [
        ("MESSAGES", f"{messages:,}", TEAL),
        ("TOTAL XP", f"{total_xp:,.0f}", GOLD),
        ("CREW RANK", f"#{rank}", GOLD),
        ("JOINED SERVER", joined_server, TEAL),
        ("ON DISCORD", joined_discord, TEAL),
    ]
    tile_y0, tile_y1 = 326, 444
    left, gap, tile_w = 88, 8, 264
    for idx, (label, value, accent) in enumerate(stats):
        x0 = left + idx * (tile_w + gap)
        x1 = x0 + tile_w
        _glass(card, (x0, tile_y0, x1, tile_y1), 18)
        draw = ImageDraw.Draw(card, "RGBA")
        # Icon circles / simple glyphs for a consistent font-independent HUD.
        icon_x = x0 + 35
        icon_y = tile_y0 + 42
        draw.ellipse((icon_x - 16, icon_y - 16, icon_x + 16, icon_y + 16),
                     fill=(4, 18, 25, 230), outline=accent, width=2)
        if idx == 0:
            draw.ellipse((icon_x - 8, icon_y - 5, icon_x + 8, icon_y + 7), fill=accent)
            draw.ellipse((icon_x - 11, icon_y + 8, icon_x - 5, icon_y + 13), fill=accent)
        elif idx == 1:
            draw.polygon(
                [(icon_x - 5, icon_y - 15), (icon_x + 5, icon_y - 15),
                 (icon_x - 1, icon_y - 3), (icon_x + 8, icon_y - 3),
                 (icon_x - 5, icon_y + 16), (icon_x - 2, icon_y + 3),
                 (icon_x - 10, icon_y + 3)],
                fill=accent,
            )
        elif idx == 2:
            draw.polygon(
                [(icon_x, icon_y - 13), (icon_x + 8, icon_y - 4),
                 (icon_x + 6, icon_y + 7), (icon_x, icon_y + 13),
                 (icon_x - 6, icon_y + 7), (icon_x - 8, icon_y - 4)],
                fill=accent,
            )
        else:
            draw.ellipse((icon_x - 9, icon_y - 9, icon_x + 9, icon_y + 9),
                         outline=accent, width=3)
        draw.text((x0 + 68, tile_y0 + 23), label, font=_font(15), fill=MUTED)
        draw.text((x0 + 68, tile_y0 + 58), value[:23], font=_font(23), fill=INK)

    # Center anchor jewel, decorative only; no footer text.
    _anchor_glyph(draw, (w // 2, 462), 13, GOLD)

    buffer = io.BytesIO()
    card.convert("RGB").save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer

def render_level_up_card(
    *,
    username: str,
    avatar_bytes: Optional[bytes],
    level: int,
    rank: int,
    progress_current: float,
    progress_needed: int,
    total_xp: float,
    message: str,
) -> io.BytesIO:
    """Render a compact premium level-up HUD matching the profile card footprint."""

    w, h = 1536, 480
    base = Image.new("RGB", (w, h), (2, 8, 14))
    draw = ImageDraw.Draw(base)

    # Deep-ocean cinematic gradient.
    for y in range(h):
        t = y / max(1, h - 1)
        draw.line([(0, y), (w, y)],
                  fill=(int(2 + 5*t), int(8 + 12*t), int(14 + 22*t)))

    # Teal harbour light + warm gold haze.
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-180, -160, 690, 500), fill=(0, 95, 100))
    gd.ellipse((820, -120, 1650, 430), fill=(0, 70, 105))
    gd.ellipse((920, 250, 1650, 650), fill=(92, 58, 17))
    glow = glow.filter(ImageFilter.GaussianBlur(100))
    base = Image.blend(base, glow, 0.48)

    # Cinematic maritime artwork: moon, stars, distant ship and sea haze.
    art = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ad = ImageDraw.Draw(art)
    ad.ellipse((1120, 92, 1240, 212), fill=(216, 226, 214, 18), outline=(224, 177, 92, 80), width=2)
    for x, y, r, a in [
        (520, 78, 2, 120), (590, 112, 3, 100), (700, 66, 2, 110),
        (840, 92, 2, 90), (930, 58, 3, 105), (1000, 128, 2, 80),
        (1290, 70, 2, 100), (1380, 112, 3, 90),
    ]:
        ad.ellipse((x-r, y-r, x+r, y+r), fill=(235, 224, 181, a))
    # Ghost ship silhouette.
    sx, sy = 1120, 245
    ad.polygon([(sx-210, sy+45), (sx+210, sy+45), (sx+145, sy+82), (sx-165, sy+82)],
               fill=(1, 7, 13, 180))
    ad.rectangle((sx-8, sy-115, sx+8, sy+48), fill=(1, 7, 13, 175))
    ad.polygon([(sx-3, sy-104), (sx-145, sy-25), (sx-3, sy+4)], fill=(1, 7, 13, 145))
    ad.polygon([(sx+5, sy-86), (sx+145, sy-15), (sx+5, sy+8)], fill=(1, 7, 13, 125))
    # Water lines.
    import math
    for row in range(5):
        pts = []
        for x in range(420, w, 18):
            yy = 290 + row * 24 + int(7 * math.sin(x / 70 + row))
            pts.append((x, yy))
        ad.line(pts, fill=(31, 182, 166, 35), width=2)
    base = Image.alpha_composite(base.convert("RGBA"), art).convert("RGB")

    card = base.convert("RGBA")
    panel = (38, 18, w - 38, h - 20)
    _glass(card, panel, 38)
    _gradient_border(card, panel, 38, 5)

    # Reference-style illuminated corner brackets.
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    gold, teal = (*GOLD, 220), (*TEAL, 225)
    for x, y, col, dx, dy in [
        (64, 58, gold, 1, 1), (1472, 58, teal, -1, 1),
        (64, h-58, teal, 1, -1), (1472, h-58, gold, -1, -1),
    ]:
        fd.line([(x, y), (x + dx*48, y)], fill=col, width=4)
        fd.line([(x, y), (x, y + dy*38)], fill=col, width=4)
        fd.ellipse((x-6, y-6, x+6, y+6), fill=col)
    frame = frame.filter(ImageFilter.GaussianBlur(0.4))
    card.alpha_composite(frame)
    draw = ImageDraw.Draw(card, "RGBA")

    # Avatar medallion.
    cx, cy, d = 270, 205, 176
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((cx-d//2-20, cy-d//2-20, cx+d//2+20, cy+d//2+20),
               outline=(31, 182, 166, 100), width=10)
    halo = halo.filter(ImageFilter.GaussianBlur(10))
    card.alpha_composite(halo)
    _gradient_ring(card, (cx-d//2-6, cy-d//2-6, cx+d//2+6, cy+d//2+6), 6)
    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((d, d))
            card.paste(avatar, (cx-d//2, cy-d//2), _rounded((d, d), d//2))
        except Exception as exc:
            log.warning("Level-up avatar render failed: %s", exc)
    draw = ImageDraw.Draw(card, "RGBA")
    draw.ellipse((cx-d//2, cy-d//2, cx+d//2, cy+d//2), outline=GOLD, width=3)

    # Compact identity header.
    draw.text((390, 106), "LEVEL UP", font=_font(22), fill=(181, 201, 210, 220))
    draw.text((390, 138), username[:24], font=_font(38), fill=INK)
    draw.text((392, 185), message[:48], font=_font(18), fill=(164, 194, 204, 225))

    # Small real crown — deliberately restrained so it reads as an icon, not a giant logo.
    crown_x, crown_y = 350, 116
    pts = [
        (crown_x, crown_y+24), (crown_x+7, crown_y+4),
        (crown_x+19, crown_y+15), (crown_x+31, crown_y),
        (crown_x+43, crown_y+15), (crown_x+55, crown_y+4),
        (crown_x+62, crown_y+24),
    ]
    draw.polygon(pts, fill=GOLD)
    draw.rectangle((crown_x+5, crown_y+24, crown_x+57, crown_y+29), fill=GOLD)
    for bx in (crown_x+7, crown_x+31, crown_x+55):
        draw.ellipse((bx-3, crown_y-3, bx+3, crown_y+3), fill=TEAL)

    # Level/rank capsule.
    capsule = (1045, 58, 1460, 164)
    _glass(card, capsule, 28)
    draw = ImageDraw.Draw(card, "RGBA")
    draw.ellipse((1066, 72, 1150, 156), fill=(4, 14, 21, 235), outline=GOLD, width=3)
    _anchor_glyph(draw, (1108, 114), 23, GOLD)
    draw.text((1175, 73), f"LEVEL {level}", font=_font(38), fill=TEAL)
    draw.text((1177, 119), f"RANK #{rank}", font=_font(25), fill=GOLD)

    # XP progress HUD.
    bx0, by0, bx1, by1 = 475, 218, 1455, 258
    draw.rounded_rectangle((bx0-4, by0-4, bx1+4, by1+4), 24,
                           fill=(0,0,0,90), outline=(224,177,92,100), width=2)
    draw.rounded_rectangle((bx0, by0, bx1, by1), 20,
                           fill=(2,14,20,230), outline=(31,182,166,125), width=2)
    ratio = 0 if progress_needed <= 0 else max(0.0, min(1.0, progress_current / progress_needed))
    filled = bx0 + int((bx1-bx0) * ratio)
    if filled > bx0 + 8:
        glowbar = Image.new("RGBA", (w, h), (0,0,0,0))
        gbd = ImageDraw.Draw(glowbar)
        gbd.rounded_rectangle((bx0, by0, filled, by1), 20, fill=(0,210,220,180))
        card.alpha_composite(glowbar.filter(ImageFilter.GaussianBlur(9)))
        draw = ImageDraw.Draw(card, "RGBA")
        draw.rounded_rectangle((bx0+3, by0+3, filled, by1-3), 17, fill=(18,205,196,255))
        draw.rounded_rectangle((bx0+10, by0+7, max(bx0+11,filled-8), by0+13), 5,
                               fill=(220,255,252,75))
    draw = ImageDraw.Draw(card, "RGBA")
    draw.text((475, 273), f"{format_xp(progress_current)} / {format_xp(progress_needed)} XP",
              font=_font(27), fill=INK)
    draw.text((1190, 278), f"NEXT: {format_xp(progress_needed)} XP",
              font=_font(19), fill=(155,211,220,235))

    # Five compact glass stat tiles — same footprint and visual language as /profile.
    stats = [
        ("TOTAL XP", format_xp(total_xp), GOLD),
        ("CREW RANK", f"#{rank}", GOLD),
        ("NEW LEVEL", str(level), TEAL),
        ("STATUS", "PROMOTED", TEAL),
        ("PROGRESS", f"{int(ratio*100)}%", GOLD),
    ]
    tile_y0, tile_y1 = 330, 442
    left, gap, tile_w = 88, 8, 264
    for idx, (label, value, accent) in enumerate(stats):
        x0 = left + idx * (tile_w + gap)
        x1 = x0 + tile_w
        _glass(card, (x0, tile_y0, x1, tile_y1), 18)
        draw = ImageDraw.Draw(card, "RGBA")
        draw.ellipse((x0+18, tile_y0+30, x0+46, tile_y0+58),
                     fill=(4,18,25,230), outline=accent, width=2)
        draw.text((x0+58, tile_y0+20), label, font=_font(14), fill=MUTED)
        draw.text((x0+58, tile_y0+54), value[:20], font=_font(23), fill=INK)

    _anchor_glyph(draw, (w//2, 463), 12, GOLD)

    buffer = io.BytesIO()
    card.convert("RGB").save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer

def render_welcome_card(
    *,
    username: str,
    avatar_bytes: Optional[bytes],
    title: str,
    subtitle: str,
    background_bytes: Optional[bytes] = None,
) -> io.BytesIO:
    """Render a welcome/goodbye banner: dark glass card, glowing teal→gold
    border, a circular avatar badge ring at top, a big two-line title, and a
    pill-shaped subtitle badge — matching the reference AHOY banner style.
    `title`/`subtitle` are already template-rendered plain text."""
    base = _backdrop(background_bytes)
    card = base.convert("RGBA")
    _decorate_corners(card)
    draw = ImageDraw.Draw(card, "RGBA")

    border_box = (10, 10, WIDTH - 10, HEIGHT - 10)
    radius = 36
    _gradient_border(card, border_box, radius, width=4)

    # -- circular avatar badge with a glowing teal→gold ring -------------
    ring_d = 148
    ring_cx, ring_cy = WIDTH // 2, 118
    ring_box = (ring_cx - ring_d // 2, ring_cy - ring_d // 2, ring_cx + ring_d // 2, ring_cy + ring_d // 2)
    _gradient_ring(card, ring_box, thickness=5)

    avatar_d = ring_d - 26
    avatar_box = (
        ring_cx - avatar_d // 2,
        ring_cy - avatar_d // 2,
        ring_cx + avatar_d // 2,
        ring_cy + avatar_d // 2,
    )
    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((avatar_d, avatar_d))
            card.paste(avatar, (avatar_box[0], avatar_box[1]), _rounded((avatar_d, avatar_d), avatar_d // 2))
        except Exception as exc:  # pragma: no cover - broken CDN image
            log.warning("Avatar render failed: %s", exc)

    # Small diamond accents flanking the ring, like the reference banner.
    for dx, color in ((-190, TEAL), (190, GOLD)):
        _diamond(draw, (ring_cx + dx, ring_cy - 15), 8, color)
        _diamond(draw, (ring_cx + dx + (18 if dx < 0 else -18), ring_cy + 20), 5, color)

    # -- "WELCOME" tracked label -------------------------------------------
    _centered_tracked(draw, "W E L C O M E", 208, 16, MUTED, letter_spacing=4)
    _tick_divider(draw, WIDTH // 2, 214, TEAL, GOLD)

    # -- big title ----------------------------------------------------------
    _centered(draw, title[:40] or username, 232, 46, INK, stroke=1)

    # -- pill-shaped subtitle badge ------------------------------------------
    if subtitle:
        pill_font = _font(22)
        text_w = draw.textbbox((0, 0), subtitle, font=pill_font)[2]
        pill_w = min(WIDTH - 120, text_w + 90)
        pill_h = 46
        pill_x0 = (WIDTH - pill_w) // 2
        pill_y0 = 300

        # Semi-transparent shapes must go through alpha_composite — a plain
        # draw() call on an RGBA image bakes the raw (unblended) color in,
        # which flattens to solid white once the final .convert("RGB") drops
        # the alpha channel without compositing against anything.
        pill_layer = Image.new("RGBA", card.size, (0, 0, 0, 0))
        pdraw = ImageDraw.Draw(pill_layer)
        pdraw.rounded_rectangle(
            (pill_x0, pill_y0, pill_x0 + pill_w, pill_y0 + pill_h),
            pill_h // 2,
            fill=(255, 255, 255, 22),
            outline=(255, 255, 255, 70),
            width=1,
        )
        card.alpha_composite(pill_layer)

        icon_d = 28
        icon_cx = pill_x0 + 12 + icon_d // 2
        icon_cy = pill_y0 + pill_h // 2
        icon_box = (icon_cx - icon_d // 2, icon_cy - icon_d // 2, icon_cx + icon_d // 2, icon_cy + icon_d // 2)
        draw.ellipse(icon_box, fill=(20, 40, 46, 255))
        if avatar_bytes:
            try:
                mini = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((icon_d, icon_d))
                card.paste(mini, (icon_box[0], icon_box[1]), _rounded((icon_d, icon_d), icon_d // 2))
            except Exception:  # pragma: no cover
                pass
        draw.text(
            (icon_cx + icon_d // 2 + 12, icon_cy),
            subtitle[:60],
            font=pill_font,
            fill=INK,
            anchor="lm",
        )

    # -- bottom anchor + dotted divider --------------------------------------
    _tick_divider(draw, WIDTH // 2, HEIGHT - 46, TEAL, GOLD, span=120)
    _anchor_glyph(draw, (WIDTH // 2, HEIGHT - 46), 11, TEAL)

    buffer = io.BytesIO()
    card.convert("RGB").save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer


def _lerp_color(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def _gradient_border(image: Image.Image, box: tuple[int, int, int, int], radius: int, width: int) -> None:
    """A rounded-rect outline that sweeps from teal (top-left) to gold
    (bottom-right), with a soft glow, approximating a gradient stroke."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0

    stroke_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    mask = Image.new("L", image.size, 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle(box, radius, outline=255, width=width)

    gradient = Image.new("RGB", (w, h), TEAL)
    gdraw = ImageDraw.Draw(gradient)
    for gx in range(w):
        t = gx / max(1, w - 1)
        gdraw.line([(gx, 0), (gx, h)], fill=_lerp_color(TEAL, GOLD, t))
    stroke_layer.paste(gradient, (x0, y0), mask.crop(box))

    glow = stroke_layer.filter(ImageFilter.GaussianBlur(6))
    image.alpha_composite(glow)
    image.alpha_composite(stroke_layer)


def _gradient_ring(image: Image.Image, box: tuple[int, int, int, int], thickness: int) -> None:
    x0, y0, x1, y1 = box
    size = (x1 - x0, y1 - y0)
    ring_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    mask = Image.new("L", image.size, 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse(box, outline=255, width=thickness)

    gradient = Image.new("RGB", size, TEAL)
    gdraw = ImageDraw.Draw(gradient)
    for gx in range(size[0]):
        t = gx / max(1, size[0] - 1)
        gdraw.line([(gx, 0), (gx, size[1])], fill=_lerp_color(TEAL, GOLD, t))
    ring_layer.paste(gradient, (x0, y0), mask.crop(box))

    glow = ring_layer.filter(ImageFilter.GaussianBlur(8))
    image.alpha_composite(glow)
    image.alpha_composite(ring_layer)


def _diamond(draw: ImageDraw.ImageDraw, center: tuple[int, int], size: int, color: tuple[int, int, int]) -> None:
    x, y = center
    draw.polygon([(x, y - size), (x + size, y), (x, y + size), (x - size, y)], outline=color, width=2)


def _tick_divider(
    draw: ImageDraw.ImageDraw,
    cx: int,
    y: int,
    left_color: tuple[int, int, int],
    right_color: tuple[int, int, int],
    span: int = 90,
) -> None:
    draw.line([(cx - span, y), (cx - 14, y)], fill=left_color, width=2)
    draw.line([(cx + 14, y), (cx + span, y)], fill=right_color, width=2)
    _diamond(draw, (cx - 14, y), 4, left_color)
    _diamond(draw, (cx + 14, y), 4, right_color)


def _anchor_glyph(draw: ImageDraw.ImageDraw, center: tuple[int, int], size: int, color: tuple[int, int, int]) -> None:
    x, y = center
    draw.ellipse((x - size, y - size, x + size, y + size), outline=color, width=2)
    draw.text((x, y), "\u2693", font=_font(size + 4), fill=color, anchor="mm")


def _centered(draw: ImageDraw.ImageDraw, text: str, y: int, size: int, fill, stroke: int = 0) -> None:
    font = _font(size)
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((WIDTH - w) / 2, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))


def _centered_tracked(
    draw: ImageDraw.ImageDraw, text: str, y: int, size: int, fill, letter_spacing: int = 0
) -> None:
    font = _font(size)
    widths = [draw.textbbox((0, 0), ch, font=font)[2] for ch in text]
    total = sum(widths) + letter_spacing * (len(text) - 1)
    x = (WIDTH - total) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + letter_spacing


def _decorate_corners(image: Image.Image) -> None:
    """Faint dotted grids in the top corners and soft wave lines in the
    bottom corners, echoing the reference banner's background texture."""
    draw = ImageDraw.Draw(image, "RGBA")
    for ox, oy, flip in ((28, 28, 1), (WIDTH - 28, 28, -1)):
        for row in range(5):
            for col in range(5):
                x = ox + flip * col * 10
                y = oy + row * 10
                draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(255, 255, 255, 30))

    import math

    for base_color, x_start, direction in ((TEAL, 0, 1), (GOLD, WIDTH, -1)):
        for i in range(3):
            points = []
            for step in range(0, 260, 8):
                x = x_start + direction * step
                y = HEIGHT - 20 - i * 18 - int(14 * math.sin(step / 28 + i))
                points.append((x, y))
            if len(points) > 1:
                draw.line(points, fill=(*base_color, 40 - i * 10), width=2)
