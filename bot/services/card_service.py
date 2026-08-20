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
