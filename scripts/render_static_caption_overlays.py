#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any

from pillow_runtime import ensure_pillow_runtime

ensure_pillow_runtime()

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont

CANVAS_WIDTH = 1080
CANVAS_HEIGHT = 1920
DEFAULT_HORIZONTAL_PADDING = 80
DEFAULT_BOTTOM_MARGIN = 220
SYSTEM_FONT_DIR = Path("/System/Library/Fonts/Supplemental")
FONT_CANDIDATES = {
    "arial bold": [SYSTEM_FONT_DIR / "Arial Bold.ttf", SYSTEM_FONT_DIR / "Arial.ttf"],
    "arial": [SYSTEM_FONT_DIR / "Arial.ttf", SYSTEM_FONT_DIR / "Arial Bold.ttf"],
    "helvetica": [SYSTEM_FONT_DIR / "Arial Bold.ttf", SYSTEM_FONT_DIR / "Arial.ttf"],
    "avenir": [SYSTEM_FONT_DIR / "Arial Bold.ttf", SYSTEM_FONT_DIR / "Arial.ttf"],
    "verdana": [SYSTEM_FONT_DIR / "Verdana Bold.ttf", SYSTEM_FONT_DIR / "Verdana.ttf"],
    "trebuchet": [SYSTEM_FONT_DIR / "Trebuchet MS Bold.ttf", SYSTEM_FONT_DIR / "Trebuchet MS.ttf"],
    "times": [SYSTEM_FONT_DIR / "Times New Roman Bold.ttf", SYSTEM_FONT_DIR / "Times New Roman.ttf"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render static transparent caption overlay PNGs from caption JSON.")
    parser.add_argument("--captions-json", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--font-family", default="Arial Bold")
    parser.add_argument("--font-path")
    parser.add_argument("--font-size", type=int, default=72)
    parser.add_argument("--horizontal-padding", type=int, default=DEFAULT_HORIZONTAL_PADDING)
    parser.add_argument("--text-color", default="#FFFFFF")
    parser.add_argument("--outline-color", default="#000000")
    parser.add_argument("--outline-width", type=float, default=3.0)
    parser.add_argument("--shadow-color", default="#000000")
    parser.add_argument("--shadow-strength", type=float, default=1.0)
    parser.add_argument("--shadow-blur", type=float, default=2.0)
    parser.add_argument("--shadow-offset-x", type=float, default=0.0)
    parser.add_argument("--shadow-offset-y", type=float, default=3.0)
    parser.add_argument("--background-enabled", action="store_true")
    parser.add_argument("--background-color", default="#000000")
    parser.add_argument("--background-opacity", type=float, default=0.0)
    parser.add_argument("--background-padding", type=int, default=20)
    parser.add_argument("--background-radius", type=int, default=24)
    parser.add_argument("--width", type=int, default=CANVAS_WIDTH)
    parser.add_argument("--height", type=int, default=CANVAS_HEIGHT)
    parser.add_argument("--bottom-margin", type=int, default=DEFAULT_BOTTOM_MARGIN)
    return parser.parse_args()


def normalize_hex(value: str, fallback: str) -> str:
    try:
        ImageColor.getrgb(value)
        return value
    except Exception:
        return fallback


def rgba(value: str, alpha: float = 1.0) -> tuple[int, int, int, int]:
    red, green, blue = ImageColor.getrgb(value)
    safe_alpha = max(0, min(255, int(round(alpha * 255))))
    return red, green, blue, safe_alpha


def resolve_font_path(font_family: str, font_path: str | None) -> Path | None:
    if font_path:
        candidate = Path(font_path).expanduser().resolve()
        if candidate.exists():
            return candidate

    family = (font_family or "").strip().lower()
    for key, candidates in FONT_CANDIDATES.items():
        if key in family:
            for candidate in candidates:
                if candidate.exists():
                    return candidate

    for fallback in [SYSTEM_FONT_DIR / "Arial Bold.ttf", SYSTEM_FONT_DIR / "Arial.ttf"]:
        if fallback.exists():
            return fallback

    return None


def load_font(font_family: str, font_path: str | None, font_size: int) -> tuple[ImageFont.FreeTypeFont | ImageFont.ImageFont, str | None]:
    resolved = resolve_font_path(font_family, font_path)
    if resolved:
        try:
            return ImageFont.truetype(str(resolved), font_size), str(resolved)
        except Exception:
            pass
    return ImageFont.load_default(), None


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    bbox = draw.multiline_textbbox((0, 0), text, font=font, align="center", spacing=8, stroke_width=0)
    return max(0, bbox[2] - bbox[0])


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.strip().split()
    if not words:
        return []

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if text_width(draw, candidate, font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def fit_text(draw: ImageDraw.ImageDraw, text: str, font_family: str, font_path: str | None, font_size: int, max_width: int) -> tuple[ImageFont.ImageFont, list[str], str | None]:
    size = max(28, font_size)
    last_font, resolved_font_path = load_font(font_family, font_path, size)
    last_lines = wrap_text(draw, text, last_font, max_width)
    while size > 30:
        font, resolved_font_path = load_font(font_family, font_path, size)
        lines = wrap_text(draw, text, font, max_width)
        if all(text_width(draw, line, font) <= max_width for line in lines) and len(lines) <= 4:
            return font, lines, resolved_font_path
        last_font, last_lines = font, lines
        size -= 4
    return last_font, last_lines, resolved_font_path


def render_overlay(caption: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    shadow_draw = ImageDraw.Draw(shadow_layer)
    shadow_extra = int(round(max(abs(float(args.shadow_offset_x)), abs(float(args.shadow_offset_y))) + max(0.0, float(args.shadow_blur)) * 2.0))
    safe_inset = max(0, int(args.horizontal_padding)) + (max(0, int(args.background_padding)) if args.background_enabled else 0) + max(0, shadow_extra)
    max_text_width = max(120, args.width - (safe_inset * 2))
    font, lines, resolved_font_path = fit_text(draw, str(caption.get("text", "")).strip(), args.font_family, args.font_path, args.font_size, max_text_width)
    if not lines:
        raise ValueError("Caption text is empty")

    line_spacing = max(10, int(round(args.font_size * 0.18)))
    multiline = "\n".join(lines)
    stroke_width = max(0, int(round(args.outline_width)))
    text_bbox = draw.multiline_textbbox(
        (0, 0),
        multiline,
        font=font,
        align="center",
        spacing=line_spacing,
        stroke_width=stroke_width,
    )
    box_width = text_bbox[2] - text_bbox[0]
    box_height = text_bbox[3] - text_bbox[1]
    x = max(safe_inset, int(round((args.width - box_width) / 2)))
    y = int(round(args.height - args.bottom_margin - box_height))

    padding = max(0, int(args.background_padding))
    if args.background_enabled:
        background_rect = [
            x - padding,
            y - padding,
            x + box_width + padding,
            y + box_height + padding,
        ]
        draw.rounded_rectangle(
            background_rect,
            radius=max(0, int(args.background_radius)),
            fill=rgba(args.background_color, max(0.0, min(1.0, args.background_opacity))),
        )

    shadow_strength = max(0.0, float(args.shadow_strength))
    if shadow_strength > 0:
        shadow_alpha = min(0.9, 0.22 + (shadow_strength * 0.06))
        shadow_draw.multiline_text(
            (x + float(args.shadow_offset_x), y + float(args.shadow_offset_y)),
            multiline,
            font=font,
            fill=rgba(args.shadow_color, shadow_alpha),
            align="center",
            spacing=line_spacing,
            stroke_width=stroke_width,
            stroke_fill=rgba(args.shadow_color, shadow_alpha),
        )

    if shadow_layer.getbbox():
        image = Image.alpha_composite(image, shadow_layer.filter(ImageFilter.GaussianBlur(radius=max(0.0, float(args.shadow_blur)))))
        draw = ImageDraw.Draw(image)

    draw.multiline_text(
        (x, y),
        multiline,
        font=font,
        fill=rgba(args.text_color, 1.0),
        align="center",
        spacing=line_spacing,
        stroke_width=stroke_width,
        stroke_fill=rgba(args.outline_color, 1.0),
    )

    index = int(caption.get("index", 0) or 0)
    output_path = output_dir / f"caption-{index:03d}.png"
    image.save(output_path)
    return {
        "id": caption.get("id") or f"caption-{index}",
        "index": index,
        "text": caption.get("text") or "",
        "start": float(caption.get("start", 0) or 0),
        "end": float(caption.get("end", 0) or 0),
        "relativePath": output_path.name,
        "fontPath": resolved_font_path,
    }


def main() -> None:
    args = parse_args()
    captions_path = Path(args.captions_json).expanduser().resolve()
    payload = json.loads(captions_path.read_text(encoding="utf-8"))
    captions = payload.get("captions") if isinstance(payload, dict) else None
    if not isinstance(captions, list):
        raise SystemExit("Caption JSON must contain a top-level 'captions' array")

    args.text_color = normalize_hex(args.text_color, "#FFFFFF")
    args.outline_color = normalize_hex(args.outline_color, "#000000")
    args.shadow_color = normalize_hex(args.shadow_color, "#000000")
    args.background_color = normalize_hex(args.background_color, "#000000")

    rendered: list[dict[str, Any]] = []
    for raw_caption in captions:
        if not isinstance(raw_caption, dict):
            continue
        text = str(raw_caption.get("text", "")).strip()
        start = float(raw_caption.get("start", 0) or 0)
        end = float(raw_caption.get("end", 0) or 0)
        index = int(raw_caption.get("index", len(rendered) + 1) or (len(rendered) + 1))
        if not text or end <= start:
            continue
        rendered.append(render_overlay({**raw_caption, "text": text, "start": start, "end": end, "index": index}, args))

    manifest = {
        "schemaVersion": "2026-04-static-caption-overlays-v1",
        "width": args.width,
        "height": args.height,
        "bottomMargin": args.bottom_margin,
        "entries": rendered,
    }
    manifest_path = Path(args.output_dir).expanduser().resolve() / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(str(manifest_path))


if __name__ == "__main__":
    main()
