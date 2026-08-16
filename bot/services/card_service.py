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
    xp_current: int,
    xp_needed: int,
    total_xp: int,
    rank: int,
    messages: int,
    voice_time: str,
    joined_server: str,
    joined_discord: str,
) -> io.BytesIO:
    """Render the profile card and return it as an in-memory PNG."""
    card = _backdrop()
    _glass(card, (32, 32, WIDTH - 32, HEIGHT - 32), 34)
    draw = ImageDraw.Draw(card)

    # Avatar
    avatar_box = (72, 92, 232, 252)
    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((160, 160))
            card.paste(avatar, (avatar_box[0], avatar_box[1]), _rounded((160, 160), 80))
        except Exception as exc:  # pragma: no cover - broken CDN image
            log.warning("Avatar render failed: %s", exc)
    draw.ellipse(avatar_box, outline=TEAL, width=4)

    # Identity
    draw.text((264, 92), username[:22], font=_font(46), fill=INK)
    draw.text((264, 148), discriminator[:32], font=_font(22), fill=MUTED)

    # Level / rank badges
    draw.text((WIDTH - 300, 84), f"LEVEL {level}", font=_font(34), fill=TEAL)
    draw.text((WIDTH - 300, 128), f"RANK #{rank}", font=_font(26), fill=GOLD)

    # XP progress bar
    bar_x0, bar_y0, bar_x1, bar_y1 = 264, 196, WIDTH - 72, 226
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], 15, fill=(255, 255, 255, 30))
    ratio = 0 if xp_needed <= 0 else max(0.0, min(1.0, xp_current / xp_needed))
    filled = bar_x0 + int((bar_x1 - bar_x0) * ratio)
    if filled > bar_x0 + 4:
        draw.rounded_rectangle([bar_x0, bar_y0, filled, bar_y1], 15, fill=TEAL)
    draw.text(
        (bar_x0, bar_y1 + 10),
        f"{xp_current:,}/{xp_needed:,} XP  ·  {total_xp:,} total",
        font=_font(20),
        fill=MUTED,
    )

    # Stat row
    stats = [
        ("MESSAGES", f"{messages:,}"),
        ("VOICE", voice_time),
        ("JOINED SERVER", joined_server),
        ("ON DISCORD", joined_discord),
    ]
    x = 72
    for label, value in stats:
        draw.text((x, 296), label, font=_font(18), fill=MUTED)
        draw.text((x, 320), value, font=_font(26), fill=INK)
        x += 228

    buffer = io.BytesIO()
    card.save(buffer, format="PNG", optimize=True)
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
    """Render a welcome/goodbye banner card. `title`/`subtitle` are already
    template-rendered plain text (placeholders resolved by the caller)."""
    card = _backdrop(background_bytes)
    _glass(card, (32, 32, WIDTH - 32, HEIGHT - 32), 34)
    draw = ImageDraw.Draw(card)

    # Centered avatar
    size = 176
    ax = (WIDTH - size) // 2
    ay = 56
    if avatar_bytes:
        try:
            avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGB").resize((size, size))
            card.paste(avatar, (ax, ay), _rounded((size, size), size // 2))
        except Exception as exc:  # pragma: no cover - broken CDN image
            log.warning("Avatar render failed: %s", exc)
    draw.ellipse((ax, ay, ax + size, ay + size), outline=TEAL, width=5)

    # Title / subtitle, centered
    def _centered(text: str, y: int, size_: int, fill) -> None:
        font = _font(size_)
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        draw.text(((WIDTH - w) / 2, y), text, font=font, fill=fill)

    _centered(title[:40], 250, 40, INK)
    _centered(subtitle[:60], 300, 22, MUTED)

    buffer = io.BytesIO()
    card.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer
