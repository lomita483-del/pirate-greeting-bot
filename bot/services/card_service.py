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
    """Premium cinematic AHOY profile card.

    The profile renderer is intentionally a true image card rather than a
    plain Discord embed: layered glass panels, luminous teal/gold trim,
    nautical silhouettes, an avatar medallion, XP HUD and stat tiles.
    """

    w, h = 1536, 820
    base = Image.new("RGB", (w, h), (3, 10, 18))
    draw = ImageDraw.Draw(base)

    # Stormy ocean / deep-harbour atmosphere.
    for y in range(h):
        t = y / h
        draw.line(
            [(0, y), (w, y)],
            fill=(
                int(3 + 5 * t),
                int(11 + 12 * t),
                int(19 + 18 * t),
            ),
        )

    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-180, -220, 620, 560), fill=(0, 94, 91))
    gd.ellipse((850, -120, 1600, 520), fill=(0, 76, 112))
    gd.ellipse((700, 520, 1700, 1100), fill=(86, 56, 15))
    glow = glow.filter(ImageFilter.GaussianBlur(125))
    base = Image.blend(base, glow, 0.46)

    # Moon / sea-light bloom.
    moon = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon)
    md.ellipse((1190, 55, 1350, 215), fill=(126, 220, 231, 42))
    md.ellipse((1210, 75, 1330, 195), fill=(210, 244, 244, 65))
    moon = moon.filter(ImageFilter.GaussianBlur(18))
    base = Image.alpha_composite(base.convert("RGBA"), moon).convert("RGB")

    # Subtle ocean bands.
    sea = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sea)
    import math
    for row in range(7):
        pts = []
        for x in range(-20, w + 20, 18):
            y = 560 + row * 27 + int(11 * math.sin(x / 70 + row * 0.8))
            pts.append((x, y))
        sd.line(pts, fill=(31, 182, 166, max(12, 34 - row * 3)), width=2)
    base = Image.alpha_composite(base.convert("RGBA"), sea).convert("RGB")

    # Ghost-ship silhouettes behind the HUD.
    ship = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sh = ImageDraw.Draw(ship)
    sx, sy = 1030, 285
    sh.polygon(
        [(sx - 160, sy + 110), (sx + 155, sy + 110), (sx + 112, sy + 150), (sx - 120, sy + 150)],
        fill=(2, 8, 14, 175),
    )
    sh.polygon([(sx - 35, sy + 105), (sx - 20, sy - 80), (sx + 2, sy - 95), (sx + 18, sy + 105)],
               fill=(3, 9, 16, 170))
    sh.polygon([(sx + 40, sy + 105), (sx + 62, sy - 35), (sx + 78, sy - 45), (sx + 88, sy + 105)],
               fill=(3, 9, 16, 145))
    sh.polygon([(sx - 20, sy - 70), (sx - 150, sy + 15), (sx - 20, sy + 28)], fill=(2, 7, 13, 160))
    sh.polygon([(sx + 3, sy - 60), (sx + 150, sy + 15), (sx + 4, sy + 28)], fill=(2, 7, 13, 160))
    ship = ship.filter(ImageFilter.GaussianBlur(1.2))
    base = Image.alpha_composite(base.convert("RGBA"), ship).convert("RGB")

    # Main glass chassis.
    card = base.convert("RGBA")
    panel = (34, 36, w - 34, h - 34)
    _glass(card, panel, 48)
    _gradient_border(card, panel, 48, 5)

    # Ornate luxury HUD frame.
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    gold = (*GOLD, 190)
    teal = (*TEAL, 190)
    fd.line([(74, 72), (360, 72)], fill=gold, width=3)
    fd.line([(1176, 72), (1460, 72)], fill=teal, width=3)
    fd.line([(74, h - 72), (360, h - 72)], fill=teal, width=3)
    fd.line([(1176, h - 72), (1460, h - 72)], fill=gold, width=3)
    for x, y, col in ((78, 78, gold), (w-78, 78, teal), (78, h-78, teal), (w-78, h-78, gold)):
        dx = 38 if x < w/2 else -38
        dy = 38 if y < h/2 else -38
        fd.line([(x, y), (x + dx, y)], fill=col, width=4)
        fd.line([(x, y), (x, y + dy)], fill=col, width=4)
        fd.ellipse((x-7, y-7, x+7, y+7), fill=col)
    fd.ellipse((w//2-11, 58, w//2+11, 80), outline=gold, width=3)
    fd.ellipse((w//2-7, h-80, w//2+7, h-66), fill=teal)
    frame = frame.filter(ImageFilter.GaussianBlur(0.35))
    card.alpha_composite(frame)

    # Inner highlight and cinematic corner flares.
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(panel, 48, outline=(255, 255, 255, 42), width=2)
    od.line([(84, 106), (w - 84, 106)], fill=(255, 255, 255, 24), width=2)
    for px, py, col in ((112, 96, GOLD), (w - 118, 96, TEAL), (w - 108, h - 100, GOLD), (118, h - 100, TEAL)):
        od.ellipse((px - 5, py - 5, px + 5, py + 5), fill=(*col, 180))
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.5))
    card.alpha_composite(overlay)

    # Avatar medallion.
    cx, cy, d = 210, 280, 260
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((cx - d // 2 - 28, cy - d // 2 - 28, cx + d // 2 + 28, cy + d // 2 + 28),
               outline=(31, 182, 166, 95), width=12)
    halo = halo.filter(ImageFilter.GaussianBlur(12))
    card.alpha_composite(halo)
    _gradient_ring(card, (cx - d // 2 - 8, cy - d // 2 - 8, cx + d // 2 + 8, cy + d // 2 + 8), 7)

    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((d, d))
            card.paste(avatar, (cx - d // 2, cy - d // 2), _rounded((d, d), d // 2))
        except Exception as exc:
            log.warning("Profile avatar render failed: %s", exc)
    draw = ImageDraw.Draw(card, "RGBA")
    draw.ellipse((cx - d // 2, cy - d // 2, cx + d // 2, cy + d // 2), outline=GOLD, width=3)

    # Small anchor badge under avatar.
    badge = (cx, cy + d // 2 + 8)
    draw.ellipse((badge[0] - 30, badge[1] - 30, badge[0] + 30, badge[1] + 30),
                 fill=(7, 20, 27, 235), outline=GOLD, width=3)
    _anchor_glyph(draw, badge, 18, TEAL)

    # Identity HUD.
    draw.text((380, 116), "☠", font=_font(38), fill=GOLD)
    draw.text((430, 112), username[:26], font=_font(52), fill=INK)
    draw.text((432, 177), discriminator[:32], font=_font(26), fill=(116, 211, 221, 235))

    # Decorative captain crown.
    draw.text((430, 235), "♛", font=_font(38), fill=GOLD)

    # Level/rank capsule.
    capsule = (1070, 105, 1450, 225)
    _glass(card, capsule, 30)
    draw = ImageDraw.Draw(card, "RGBA")
    draw.text((1110, 124), f"LEVEL {level}", font=_font(44), fill=TEAL)
    draw.text((1112, 177), f"RANK #{rank}", font=_font(29), fill=GOLD)
    draw.text((1042, 130), "⚓", font=_font(42), fill=GOLD)

    # XP HUD.
    bar_x0, bar_y0, bar_x1, bar_y1 = 430, 292, 1450, 344
    draw.rounded_rectangle((bar_x0, bar_y0, bar_x1, bar_y1), 26,
                           fill=(2, 14, 20, 210), outline=(255, 255, 255, 40), width=2)
    ratio = 0.0 if progress_needed <= 0 else max(0.0, min(1.0, progress_current / progress_needed))
    filled = bar_x0 + int((bar_x1 - bar_x0) * ratio)
    if filled > bar_x0 + 8:
        draw.rounded_rectangle((bar_x0 + 3, bar_y0 + 3, filled, bar_y1 - 3), 22, fill=TEAL)
        shine = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd2 = ImageDraw.Draw(shine)
        sd2.rounded_rectangle((bar_x0 + 3, bar_y0 + 3, filled, bar_y0 + 13), 8, fill=(255, 255, 255, 52))
        card.alpha_composite(shine)
    draw = ImageDraw.Draw(card, "RGBA")
    draw.text((430, 366), f"{progress_current:,.0f} / {progress_needed:,.0f} XP", font=_font(31), fill=INK)
    next_xp = max(progress_needed, progress_current)
    if progress_current >= progress_needed:
        next_xp = progress_needed
    draw.text((1125, 373), f"NEXT: {next_xp:,.0f} XP", font=_font(21), fill=(116, 211, 221, 235))

    # Glass stat tiles.
    stats = [
        ("💬", "MESSAGES", f"{messages:,}", TEAL),
        ("ϟ", "TOTAL XP", f"{total_xp:,.0f}", GOLD),
        ("♛", "CREW RANK", f"#{rank}", GOLD),
        ("♜", "JOINED SERVER", joined_server, TEAL),
        ("◉", "ON DISCORD", joined_discord, TEAL),
    ]
    tile_y0, tile_y1 = 500, 710
    left, gap = 72, 18
    tile_w = 264
    for idx, (icon, label, value, accent) in enumerate(stats):
        x0 = left + idx * (tile_w + gap)
        x1 = x0 + tile_w
        _glass(card, (x0, tile_y0, x1, tile_y1), 25)
        draw = ImageDraw.Draw(card, "RGBA")
        draw.text((x0 + 22, tile_y0 + 25), icon, font=_font(28), fill=accent)
        draw.text((x0 + 64, tile_y0 + 27), label, font=_font(17), fill=MUTED)
        draw.text((x0 + 24, tile_y0 + 88), value[:24], font=_font(27), fill=INK)

    # Central anchor ornament — decorative only, no footer copy.
    ornament_y = 755
    draw = ImageDraw.Draw(card, "RGBA")
    draw.line([(w // 2 - 80, ornament_y), (w // 2 - 28, ornament_y)], fill=TEAL, width=2)
    draw.line([(w // 2 + 28, ornament_y), (w // 2 + 80, ornament_y)], fill=GOLD, width=2)
    _anchor_glyph(draw, (w // 2, ornament_y), 20, GOLD)

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
    """Premium cinematic glassmorphism level-up card for Discord."""
    w, h = 1200, 650
    base = Image.new("RGB", (w, h), (7, 13, 20))
    draw = ImageDraw.Draw(base)

    # Deep harbour gradient.
    for y in range(h):
        t = y / h
        draw.line([(0, y), (w, y)], fill=(7 + int(7*t), 13 + int(14*t), 20 + int(18*t)))

    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-180, -220, 560, 500), fill=(0, 110, 105))
    gd.ellipse((760, 270, 1380, 850), fill=(92, 63, 20))
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    base = Image.blend(base, glow, 0.38)

    # Outer glass panel + inner highlight.
    panel = (34, 34, w - 34, h - 34)
    _glass(base, panel, 38)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(panel, 38, outline=(255, 255, 255, 55), width=2)
    od.line([(72, 96), (w - 72, 96)], fill=(255, 255, 255, 28), width=1)
    base_rgba = base.convert("RGBA")
    base_rgba.alpha_composite(overlay)
    draw = ImageDraw.Draw(base_rgba, "RGBA")

    # Gold/teal cinematic edge accents.
    _gradient_border(base_rgba, (34, 34, w - 34, h - 34), 38, 3)

    # Avatar halo.
    cx, cy, d = 155, 190, 150
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((cx-d//2-16, cy-d//2-16, cx+d//2+16, cy+d//2+16), outline=(31, 182, 166, 85), width=8)
    halo = halo.filter(ImageFilter.GaussianBlur(8))
    base_rgba.alpha_composite(halo)
    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((d, d))
            base_rgba.paste(avatar, (cx-d//2, cy-d//2), _rounded((d, d), d//2))
        except Exception as exc:
            log.warning("Level-up avatar render failed: %s", exc)
    draw = ImageDraw.Draw(base_rgba, "RGBA")
    draw.ellipse((cx-d//2, cy-d//2, cx+d//2, cy+d//2), outline=TEAL, width=5)

    # Header / identity.
    draw.text((265, 82), "LEVEL UP", font=_font(24), fill=(180, 195, 204, 210))
    draw.text((265, 116), username[:26], font=_font(40), fill=INK)
    draw.text((265, 164), message[:62], font=_font(20), fill=(185, 201, 210, 235))

    # Level + rank display.
    draw.text((770, 82), f"LEVEL {level}", font=_font(54), fill=TEAL)
    draw.text((773, 145), f"RANK #{rank}", font=_font(30), fill=GOLD)

    # Progress panel.
    bx0, by0, bx1, by1 = 72, 330, w - 72, 378
    draw.rounded_rectangle((bx0, by0, bx1, by1), 24, fill=(255, 255, 255, 22), outline=(255,255,255,45), width=1)
    ratio = 0 if progress_needed <= 0 else max(0.0, min(1.0, progress_current / progress_needed))
    filled = bx0 + int((bx1 - bx0) * ratio)
    if filled > bx0 + 10:
        draw.rounded_rectangle((bx0, by0, filled, by1), 24, fill=TEAL)
    draw.text((72, 398), f"{format_xp(progress_current)} / {format_xp(progress_needed)} XP", font=_font(28), fill=INK)
    draw.text((w - 270, 403), f"{int(ratio * 100)}%", font=_font(22), fill=MUTED)

    # Stat glass tiles.
    tiles = [
        (72, 480, 318, 585, "TOTAL XP", format_xp(total_xp)),
        (336, 480, 582, 585, "CREW RANK", f"#{rank}"),
        (600, 480, 846, 585, "NEW LEVEL", str(level)),
        (864, 480, 1128, 585, "STATUS", "PROMOTED"),
    ]
    for x0, y0, x1, y1, label, value in tiles:
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.rounded_rectangle((x0, y0, x1, y1), 22, fill=(255,255,255,18), outline=(255,255,255,38), width=1)
        base_rgba.alpha_composite(layer)
        draw = ImageDraw.Draw(base_rgba, "RGBA")
        draw.text((x0 + 18, y0 + 16), label, font=_font(16), fill=MUTED)
        draw.text((x0 + 18, y0 + 48), value, font=_font(28), fill=INK)

    # Decorative anchor, but no footer text.
    draw.text((w - 78, h - 66), "⚓", font=_font(32), fill=(31, 182, 166, 180), anchor="mm")

    buffer = io.BytesIO()
    base_rgba.convert("RGB").save(buffer, format="PNG", optimize=True)
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
