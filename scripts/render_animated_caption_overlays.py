#!/usr/bin/env python3
import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont

CANVAS_WIDTH = 1080
CANVAS_HEIGHT = 1920
DEFAULT_HORIZONTAL_PADDING = 80
DEFAULT_BOTTOM_MARGIN = 220
SYSTEM_FONT_DIR = Path("/System/Library/Fonts/Supplemental")
CAPTION_FONT_WEIGHT_SUFFIX_RE = r"\s+(thin|hairline|extra\s*light|ultra\s*light|light|book|regular|normal|medium|semi\s*bold|semibold|demi\s*bold|bold|extra\s*bold|ultra\s*bold|black|heavy)\s*$"
FONT_CANDIDATES = {
    "arial": [SYSTEM_FONT_DIR / "Arial.ttf", SYSTEM_FONT_DIR / "Arial Bold.ttf"],
    "helvetica": [SYSTEM_FONT_DIR / "Arial.ttf", SYSTEM_FONT_DIR / "Arial Bold.ttf"],
    "avenir": [SYSTEM_FONT_DIR / "Arial.ttf", SYSTEM_FONT_DIR / "Arial Bold.ttf"],
    "verdana": [SYSTEM_FONT_DIR / "Verdana.ttf", SYSTEM_FONT_DIR / "Verdana Bold.ttf"],
    "trebuchet": [SYSTEM_FONT_DIR / "Trebuchet MS.ttf", SYSTEM_FONT_DIR / "Trebuchet MS Bold.ttf"],
    "times": [SYSTEM_FONT_DIR / "Times New Roman.ttf", SYSTEM_FONT_DIR / "Times New Roman Bold.ttf"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render animated transparent caption overlay PNGs from caption timeline JSON.")
    parser.add_argument("--timeline-json", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--font-family", default="Arial Bold")
    parser.add_argument("--font-path")
    parser.add_argument("--font-size", type=int, default=72)
    parser.add_argument("--font-weight", type=int, default=700)
    parser.add_argument("--word-spacing", type=float, default=0.0)
    parser.add_argument("--horizontal-padding", type=int, default=DEFAULT_HORIZONTAL_PADDING)
    parser.add_argument("--active-word-color", default="#FFFFFF")
    parser.add_argument("--spoken-word-color", default="#D0D0D0")
    parser.add_argument("--upcoming-word-color", default="#5E5E5E")
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
    parser.add_argument("--animation-preset", default="stable-pop", choices=["none", "stable-pop", "fluid-pop", "pulse", "glow"])
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--width", type=int, default=CANVAS_WIDTH)
    parser.add_argument("--height", type=int, default=CANVAS_HEIGHT)
    parser.add_argument("--bottom-margin", type=int, default=DEFAULT_BOTTOM_MARGIN)
    return parser.parse_args()


def normalize_hex(value: str, fallback: str) -> str:
    try:
        ImageColor.getrgb(value)
        return value.upper()
    except Exception:
        return fallback


def clamp_font_weight(value: Any, fallback: int = 700) -> int:
    try:
        parsed = int(round(float(value)))
    except Exception:
        parsed = fallback
    return max(100, min(900, int(round(parsed / 100) * 100)))


def sanitize_font_family(font_family: str) -> str:
    family = str(font_family or "").strip()
    while family and re.search(CAPTION_FONT_WEIGHT_SUFFIX_RE, family, flags=re.IGNORECASE):
        family = re.sub(CAPTION_FONT_WEIGHT_SUFFIX_RE, "", family, flags=re.IGNORECASE).strip()
    return family or "Arial"


def rgba(value: str, alpha: float = 1.0) -> tuple[int, int, int, int]:
    red, green, blue = ImageColor.getrgb(value)
    safe_alpha = max(0, min(255, int(round(alpha * 255))))
    return red, green, blue, safe_alpha


def order_font_candidates(candidates: list[Path], font_weight: int) -> list[Path]:
    prefer_bold = font_weight >= 600

    def score(candidate: Path) -> tuple[int, str]:
        name = candidate.name.lower()
        is_bold = any(token in name for token in ["bold", "black", "heavy", "semibold", "demibold"])
        return (0 if is_bold == prefer_bold else 1, name)

    return sorted(candidates, key=score)


def resolve_font_path(font_family: str, font_path: str | None, font_weight: int = 700) -> Path | None:
    if font_path:
        candidate = Path(font_path).expanduser().resolve()
        if candidate.exists():
            return candidate

    family = sanitize_font_family(font_family).lower()
    safe_weight = clamp_font_weight(font_weight)
    for key, candidates in FONT_CANDIDATES.items():
        if key in family:
            for candidate in order_font_candidates(candidates, safe_weight):
                if candidate.exists():
                    return candidate

    fallback_candidates = [SYSTEM_FONT_DIR / "Arial.ttf", SYSTEM_FONT_DIR / "Arial Bold.ttf"]
    for fallback in order_font_candidates(fallback_candidates, safe_weight):
        if fallback.exists():
            return fallback

    return None


def load_font_from_path(font_path: Path | None, font_size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if font_path:
        try:
            return ImageFont.truetype(str(font_path), font_size)
        except Exception:
            pass
    return ImageFont.load_default()


def text_bbox(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    stroke_width: int = 0,
    anchor: str | None = None,
) -> tuple[int, int, int, int]:
    return draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width, anchor=anchor)


def measure_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, stroke_width: int = 0) -> tuple[int, int]:
    bbox = text_bbox(draw, text, font, stroke_width)
    return max(0, bbox[2] - bbox[0]), max(0, bbox[3] - bbox[1])


def measure_text_advance(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
    try:
        return max(0.0, float(draw.textlength(text, font=font)))
    except Exception:
        return float(measure_text(draw, text, font)[0])


def measure_baseline_text_metrics(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    stroke_width: int = 0,
) -> dict[str, Any]:
    bbox = text_bbox(draw, text, font, stroke_width, anchor="ls")
    return {
        "bbox": bbox,
        "width": max(0, bbox[2] - bbox[0]),
        "height": max(0, bbox[3] - bbox[1]),
        "ascent": max(0, -bbox[1]),
        "descent": max(0, bbox[3]),
    }


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def ease_out_cubic(value: float) -> float:
    t = clamp01(value)
    return 1.0 - ((1.0 - t) ** 3)


def pop_curve(progress: float) -> tuple[float, float]:
    t = clamp01(progress)
    pop_in_portion = 0.16
    peak_scale = 1.18
    peak_lift_em = 0.11

    if t <= pop_in_portion:
        grow_t = ease_out_cubic(t / pop_in_portion)
        return (
            1.0 + ((peak_scale - 1.0) * grow_t),
            peak_lift_em * grow_t,
        )

    settle_t = ease_out_cubic((t - pop_in_portion) / (1.0 - pop_in_portion))
    return (
        peak_scale + ((1.0 - peak_scale) * settle_t),
        peak_lift_em + ((0.0 - peak_lift_em) * settle_t),
    )


def max_active_scale(preset: str) -> float:
    if preset in {"stable-pop", "fluid-pop"}:
        return 1.18
    if preset == "pulse":
        return 1.08
    if preset == "glow":
        return 1.06
    if preset == "none":
        return 1.0
    return 1.14


def active_scale(preset: str, progress: float) -> float:
    t = clamp01(progress)
    if preset in {"stable-pop", "fluid-pop"}:
        return pop_curve(t)[0]
    if preset == "pulse":
        return 1.04 + (0.04 * math.sin(t * math.pi))
    if preset == "glow":
        return 1.02 + (0.04 * math.sin(t * math.pi))
    if preset == "none":
        return 1.0
    if t < 0.35:
        return 1.14
    if t < 0.75:
        return 1.08
    return 1.0


def active_lift(preset: str, progress: float, font_size: int) -> float:
    t = clamp01(progress)
    em = max(1.0, float(font_size))
    if preset in {"stable-pop", "fluid-pop"}:
        return em * pop_curve(t)[1]
    if preset == "pulse":
        return em * (0.018 + (0.012 * math.sin(t * math.pi)))
    if preset == "glow":
        return em * 0.015
    return 0.0


def active_glow_strength(preset: str, progress: float) -> float:
    t = max(0.0, min(1.0, progress))
    pulse = math.sin(t * math.pi)
    if preset == "glow":
        return 0.55 + (0.35 * pulse)
    if preset == "pulse":
        return 0.18 + (0.18 * pulse)
    return 0.0


def split_words(text: str) -> list[str]:
    return [word for word in str(text or "").strip().split() if word]


def resolve_space_width(base_space_width: float, word_spacing: float) -> float:
    return max(1.0, float(base_space_width) + float(word_spacing))


def build_wrapped_lines(
    draw: ImageDraw.ImageDraw,
    words: list[str],
    font: ImageFont.ImageFont,
    max_width: int,
    stroke_width: int,
    args: argparse.Namespace,
) -> list[list[dict[str, Any]]]:
    if not words:
        return []

    space_advance = resolve_space_width(measure_text_advance(draw, " ", font), args.word_spacing)
    lines: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    current_width = 0.0

    for word in words:
        word_width, word_height = measure_text(draw, word, font, stroke_width)
        word_advance = measure_text_advance(draw, word, font)
        item = {
            "text": word,
            "baseWidth": word_width,
            "baseHeight": word_height,
            "baseAdvance": word_advance,
        }
        candidate_width = word_advance if not current else current_width + space_advance + word_advance
        if current and candidate_width > max_width:
            lines.append(current)
            current = [item]
            current_width = word_advance
        else:
            current.append(item)
            current_width = candidate_width

    if current:
        lines.append(current)

    return lines


def compute_line_metrics(
    draw: ImageDraw.ImageDraw,
    line: list[dict[str, Any]],
    font: ImageFont.ImageFont,
    scaled_font: ImageFont.ImageFont,
    base_stroke_width: int,
    scaled_stroke_width: int,
    space_advance: float,
    preset: str,
) -> dict[str, Any]:
    base_line_advance = 0.0
    max_line_advance = 0.0
    max_ascent = 0
    max_descent = 0
    max_word_growth = 0.0

    for index, item in enumerate(line):
        if index > 0:
            base_line_advance += space_advance
        base_line_advance += item["baseAdvance"]
        base_metrics = measure_baseline_text_metrics(draw, item["text"], font, base_stroke_width)
        scaled_metrics = measure_baseline_text_metrics(draw, item["text"], scaled_font, scaled_stroke_width)
        scaled_advance = measure_text_advance(draw, item["text"], scaled_font)
        max_word_growth = max(max_word_growth, scaled_advance - item["baseAdvance"])
        max_ascent = max(max_ascent, base_metrics["ascent"], scaled_metrics["ascent"])
        max_descent = max(max_descent, base_metrics["descent"], scaled_metrics["descent"])

    max_line_advance = base_line_advance + (max(0.0, max_word_growth) if preset == "fluid-pop" else 0.0)
    return {
        "baseAdvance": base_line_advance,
        "maxAdvance": max_line_advance,
        "ascent": max_ascent,
        "descent": max_descent,
        "height": max_ascent + max_descent,
    }


def fit_layout(draw: ImageDraw.ImageDraw, words: list[str], args: argparse.Namespace) -> tuple[dict[str, Any], str | None]:
    resolved_font_path = resolve_font_path(args.font_family, args.font_path, args.font_weight)
    base_stroke_width = max(0, int(round(args.outline_width)))
    shadow_extra = int(round(max(abs(float(args.shadow_offset_x)), abs(float(args.shadow_offset_y))) + max(0.0, float(args.shadow_blur)) * 2.0))
    box_extra = max(12, int(round(max(28, int(args.font_size)) * max(0.0, max_active_scale(args.animation_preset) - 1.0))) + max(4, shadow_extra))
    safe_inset = max(0, int(args.horizontal_padding)) + (max(0, int(args.background_padding)) if args.background_enabled else 0) + box_extra
    max_text_width = max(120, args.width - (safe_inset * 2))
    chosen_layout: dict[str, Any] | None = None

    size = max(28, int(args.font_size))
    while size >= 30:
        font = load_font_from_path(resolved_font_path, size)
        lines = build_wrapped_lines(draw, words, font, max_text_width, base_stroke_width, args)
        line_base_advances: list[float] = []
        line_max_advances: list[float] = []
        line_heights: list[int] = []
        line_ascents: list[int] = []
        line_descents: list[int] = []
        scaled_font = load_font_from_path(resolved_font_path, max(30, int(round(size * max_active_scale(args.animation_preset)))))
        scaled_stroke_width = max(base_stroke_width, int(round(base_stroke_width * max_active_scale(args.animation_preset))))
        space_advance = resolve_space_width(measure_text_advance(draw, " ", font), args.word_spacing)
        for line in lines:
            metrics = compute_line_metrics(draw, line, font, scaled_font, base_stroke_width, scaled_stroke_width, space_advance, args.animation_preset)
            line_base_advances.append(metrics["baseAdvance"])
            line_max_advances.append(metrics["maxAdvance"])
            line_ascents.append(metrics["ascent"])
            line_descents.append(metrics["descent"])
            line_heights.append(metrics["height"])

        if lines and len(lines) <= 4 and all(width <= max_text_width for width in line_max_advances):
            line_spacing = max(10, int(round(size * 0.18)))
            total_height = sum(line_heights) + (line_spacing * (len(lines) - 1 if len(lines) > 1 else 0))
            chosen_layout = {
                "fontSize": size,
                "lineSpacing": line_spacing,
                "lineBaseAdvances": line_base_advances,
                "lineMaxAdvances": line_max_advances,
                "lineHeights": line_heights,
                "lineAscents": line_ascents,
                "lineDescents": line_descents,
                "maxLineWidth": max(line_max_advances) if line_max_advances else 0,
                "totalHeight": total_height,
                "lines": lines,
                "baseStrokeWidth": base_stroke_width,
                "spaceAdvance": space_advance,
            }
            break
        size -= 4

    if chosen_layout is None:
        size = 30
        font = load_font_from_path(resolved_font_path, size)
        lines = build_wrapped_lines(draw, words, font, max_text_width, base_stroke_width, args)
        line_spacing = max(10, int(round(size * 0.18)))
        line_base_advances: list[float] = []
        line_max_advances: list[float] = []
        line_heights: list[int] = []
        line_ascents: list[int] = []
        line_descents: list[int] = []
        scaled_font = load_font_from_path(resolved_font_path, max(30, int(round(size * max_active_scale(args.animation_preset)))))
        scaled_stroke_width = max(base_stroke_width, int(round(base_stroke_width * max_active_scale(args.animation_preset))))
        space_advance = resolve_space_width(measure_text_advance(draw, " ", font), args.word_spacing)
        for line in lines:
            metrics = compute_line_metrics(draw, line, font, scaled_font, base_stroke_width, scaled_stroke_width, space_advance, args.animation_preset)
            line_base_advances.append(metrics["baseAdvance"])
            line_max_advances.append(metrics["maxAdvance"])
            line_ascents.append(metrics["ascent"])
            line_descents.append(metrics["descent"])
            line_heights.append(metrics["height"])
        chosen_layout = {
            "fontSize": size,
            "lineSpacing": line_spacing,
            "lineBaseAdvances": line_base_advances,
            "lineMaxAdvances": line_max_advances,
            "lineHeights": line_heights,
            "lineAscents": line_ascents,
            "lineDescents": line_descents,
            "maxLineWidth": max(line_max_advances) if line_max_advances else 0,
            "totalHeight": sum(line_heights) + (line_spacing * (len(lines) - 1 if len(lines) > 1 else 0)),
            "lines": lines,
            "baseStrokeWidth": base_stroke_width,
            "spaceAdvance": space_advance,
        }

    return chosen_layout, str(resolved_font_path) if resolved_font_path else None


def resolve_word_state(word_index: int, active_index: int, word_count: int) -> str:
    if active_index >= word_count:
        return "spoken"
    if word_index < active_index:
        return "spoken"
    if word_index == active_index:
        return "active"
    return "upcoming"


def animation_window_seconds(preset: str, duration: float) -> float:
    if preset == "none":
        return max(0.0, duration)
    base = {
        "stable-pop": 0.24,
        "fluid-pop": 0.24,
        "pulse": 0.32,
        "glow": 0.30,
    }.get(preset, duration)
    return max(0.08, min(duration, base)) if duration > 0 else 0.0


def animation_progress(preset: str, word_start: float, word_end: float, sample_time: float) -> float:
    if preset == "none":
        return 0.0
    duration = max(0.001, word_end - word_start)
    window = animation_window_seconds(preset, duration)
    if window <= 0:
        return 1.0
    return max(0.0, min(1.0, (sample_time - word_start) / window))


def resolve_entry_state(caption: dict[str, Any], preset: str, sample_time: float) -> tuple[int, float] | None:
    words = caption.get("words") if isinstance(caption, dict) else None
    if not isinstance(words, list) or not words:
        return None

    safe_caption_start = max(0.0, float(caption.get("start", 0) or 0))
    safe_caption_end = max(safe_caption_start + 0.05, float(caption.get("end", safe_caption_start + 0.05) or (safe_caption_start + 0.05)))
    if sample_time < safe_caption_start or sample_time >= safe_caption_end:
        return None

    first_word_start = max(safe_caption_start, float(words[0].get("start", safe_caption_start) or safe_caption_start))
    if sample_time < first_word_start:
        return -1, 0.0

    for index, word in enumerate(words):
        word_start = max(safe_caption_start, float(word.get("start", safe_caption_start) or safe_caption_start))
        word_end = max(word_start + 0.05, float(word.get("end", word_start + 0.05) or (word_start + 0.05)))
        if word_start <= sample_time < word_end:
            return index, animation_progress(preset, word_start, word_end, sample_time)

        next_word = words[index + 1] if index + 1 < len(words) else None
        hold_end = float(next_word.get("start", safe_caption_end) or safe_caption_end) if next_word else safe_caption_end
        hold_end = min(safe_caption_end, max(word_end, hold_end))
        if word_end <= sample_time < hold_end:
            return index + 1, 0.0

    return len(words), 0.0


def build_frame_entries(captions: list[dict[str, Any]], preset: str, fps: float) -> list[dict[str, Any]]:
    safe_fps = max(12.0, min(60.0, float(fps or 30.0)))
    entries: list[dict[str, Any]] = []
    for caption in captions:
        words = caption.get("words") if isinstance(caption, dict) else None
        if not isinstance(words, list) or not words:
            continue

        safe_caption_start = max(0.0, float(caption.get("start", 0) or 0))
        safe_caption_end = max(safe_caption_start + 0.05, float(caption.get("end", safe_caption_start + 0.05) or (safe_caption_start + 0.05)))
        start_frame = max(0, int(math.floor(safe_caption_start * safe_fps)))
        end_frame = max(start_frame + 1, int(math.ceil(safe_caption_end * safe_fps)))

        for frame_index in range(start_frame, end_frame):
            frame_start = frame_index / safe_fps
            frame_end = (frame_index + 1) / safe_fps
            sample_time = min(safe_caption_end - 0.0001, max(safe_caption_start, frame_start + (0.5 / safe_fps)))
            state = resolve_entry_state(caption, preset, sample_time)
            if state is None:
                continue
            active_index, progress = state
            entry_start = max(safe_caption_start, frame_start)
            entry_end = min(safe_caption_end, frame_end)
            if entry_end <= entry_start + 0.0001:
                continue
            entries.append({
                "captionId": caption.get("id") or f"caption-{caption.get('index', len(entries) + 1)}",
                "captionIndex": int(caption.get("index", len(entries) + 1) or (len(entries) + 1)),
                "text": caption.get("text") or "",
                "start": entry_start,
                "end": entry_end,
                "activeIndex": active_index,
                "progress": progress,
                "frameIndex": frame_index,
            })

    return [entry for entry in entries if entry["end"] > entry["start"] + 0.0001]


def render_entry(entry: dict[str, Any], caption_lookup: dict[str, dict[str, Any]], args: argparse.Namespace) -> Image.Image:
    caption = caption_lookup[entry["captionId"]]
    words = [str(word.get("text") or "").strip() for word in caption.get("words") or []]
    words = [word for word in words if word]
    image = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    text_layer = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    glow_layer = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    measure_surface = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    measure_draw = ImageDraw.Draw(measure_surface)
    shadow_draw = ImageDraw.Draw(shadow_layer)
    text_draw = ImageDraw.Draw(text_layer)
    glow_draw = ImageDraw.Draw(glow_layer)
    base_draw = ImageDraw.Draw(image)

    layout, resolved_font_path = fit_layout(measure_draw, words, args)
    font_path_obj = Path(resolved_font_path) if resolved_font_path else None
    font_cache: dict[int, ImageFont.ImageFont] = {}

    def get_font(size: int) -> ImageFont.ImageFont:
        safe_size = max(24, int(size))
        if safe_size not in font_cache:
            font_cache[safe_size] = load_font_from_path(font_path_obj, safe_size)
        return font_cache[safe_size]

    shadow_extra = int(round(max(abs(float(args.shadow_offset_x)), abs(float(args.shadow_offset_y))) + max(0.0, float(args.shadow_blur)) * 2.0))
    box_extra = max(12, int(round(layout["fontSize"] * max(0.0, max_active_scale(args.animation_preset) - 1.0))) + max(4, shadow_extra))
    top_y = int(round(args.height - args.bottom_margin - layout["totalHeight"]))
    safe_left = max(0, int(args.horizontal_padding)) + (max(0, int(args.background_padding)) if args.background_enabled else 0) + box_extra
    left_x = max(safe_left, int(round((args.width - layout["maxLineWidth"]) / 2)))

    if args.background_enabled:
        base_draw.rounded_rectangle(
            [
                left_x - args.background_padding - box_extra,
                top_y - args.background_padding,
                left_x + layout["maxLineWidth"] + args.background_padding + box_extra,
                top_y + layout["totalHeight"] + args.background_padding,
            ],
            radius=max(0, int(args.background_radius)),
            fill=rgba(args.background_color, max(0.0, min(1.0, args.background_opacity))),
        )

    word_counter = 0
    line_y = top_y
    fluid_pop = args.animation_preset == "fluid-pop"
    for line_index, line in enumerate(layout["lines"]):
        line_height = layout["lineHeights"][line_index]
        line_ascent = layout["lineAscents"][line_index]
        baseline_y = line_y + line_ascent
        progress = float(entry.get("progress", 0.0) or 0.0)
        line_words: list[dict[str, Any]] = []
        current_line_width = 0.0

        for word_index_on_line, item in enumerate(line):
            text = item["text"]
            global_word_index = word_counter + word_index_on_line
            state = resolve_word_state(global_word_index, int(entry.get("activeIndex", -1)), len(words))
            scale = active_scale(args.animation_preset, progress) if state == "active" else 1.0
            font_size = int(round(layout["fontSize"] * scale))
            stroke_width = max(0, int(round(layout["baseStrokeWidth"] * max(1.0, scale))))
            font = get_font(font_size)
            metrics = measure_baseline_text_metrics(measure_draw, text, font, stroke_width)
            advance_width = measure_text_advance(measure_draw, text, font) if fluid_pop else item["baseAdvance"]
            current_line_width += advance_width
            if word_index_on_line > 0:
                current_line_width += layout["spaceAdvance"]
            line_words.append({
                "text": text,
                "state": state,
                "scale": scale,
                "font": font,
                "strokeWidth": stroke_width,
                "metrics": metrics,
                "advanceWidth": advance_width,
            })

        cursor_x = (args.width - (current_line_width if fluid_pop else layout["lineBaseAdvances"][line_index])) / 2
        for word_index_on_line, line_word in enumerate(line_words):
            if word_index_on_line > 0:
                cursor_x += layout["spaceAdvance"]

            state = line_word["state"]
            fill_color = (
                args.active_word_color if state == "active"
                else args.spoken_word_color if state == "spoken"
                else args.upcoming_word_color
            )
            outline_color = args.outline_color
            shadow_color = args.shadow_color
            glow_strength = active_glow_strength(args.animation_preset, progress) if state == "active" else 0.0
            if state == "active" and args.animation_preset == "glow":
                outline_color = args.active_word_color
                shadow_color = args.active_word_color

            slot_width = line_word["advanceWidth"] if fluid_pop else line[word_index_on_line]["baseAdvance"]
            draw_left = cursor_x + max(0.0, (slot_width - line_word["metrics"]["width"]) / 2)
            draw_x = draw_left - line_word["metrics"]["bbox"][0]
            draw_baseline_y = baseline_y - active_lift(args.animation_preset, progress, layout["fontSize"] if state == "active" else 0)

            if glow_strength > 0:
                glow_alpha = min(0.9, glow_strength)
                glow_stroke = line_word["strokeWidth"] + 4
                glow_draw.text(
                    (draw_x, draw_baseline_y),
                    line_word["text"],
                    font=line_word["font"],
                    fill=rgba(args.active_word_color, 0.22 * glow_alpha),
                    stroke_width=glow_stroke,
                    stroke_fill=rgba(args.active_word_color, 0.48 * glow_alpha),
                    anchor="ls",
                )

            shadow_strength = max(0.0, float(args.shadow_strength))
            if shadow_strength > 0:
                shadow_alpha = min(0.9, 0.18 + (shadow_strength * 0.06) + (glow_strength * 0.08))
                shadow_offset_x = float(args.shadow_offset_x)
                shadow_offset_y = float(args.shadow_offset_y)
                shadow_draw.text(
                    (draw_x + shadow_offset_x, draw_baseline_y + shadow_offset_y),
                    line_word["text"],
                    font=line_word["font"],
                    fill=rgba(shadow_color, shadow_alpha),
                    stroke_width=line_word["strokeWidth"],
                    stroke_fill=rgba(shadow_color, shadow_alpha),
                    anchor="ls",
                )

            text_draw.text(
                (draw_x, draw_baseline_y),
                line_word["text"],
                font=line_word["font"],
                fill=rgba(fill_color, 1.0),
                stroke_width=line_word["strokeWidth"],
                stroke_fill=rgba(outline_color, 1.0),
                anchor="ls",
            )

            cursor_x += slot_width

        word_counter += len(line)
        line_y += line_height + layout["lineSpacing"]

    if glow_layer.getbbox():
        image = Image.alpha_composite(image, glow_layer.filter(ImageFilter.GaussianBlur(radius=4)))
    if shadow_layer.getbbox():
        shadow_blur = max(0.0, float(args.shadow_blur))
        image = Image.alpha_composite(image, shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur)))
    image = Image.alpha_composite(image, text_layer)
    return image


def main() -> None:
    args = parse_args()
    timeline_path = Path(args.timeline_json).expanduser().resolve()
    payload = json.loads(timeline_path.read_text(encoding="utf-8"))
    captions = payload.get("captions") if isinstance(payload, dict) else None
    if not isinstance(captions, list):
        raise SystemExit("Timeline JSON must contain a top-level 'captions' array")

    args.active_word_color = normalize_hex(args.active_word_color, "#FFFFFF")
    args.spoken_word_color = normalize_hex(args.spoken_word_color, "#D0D0D0")
    args.upcoming_word_color = normalize_hex(args.upcoming_word_color, "#5E5E5E")
    args.outline_color = normalize_hex(args.outline_color, "#000000")
    args.shadow_color = normalize_hex(args.shadow_color, "#000000")
    args.background_color = normalize_hex(args.background_color, "#000000")
    args.font_weight = clamp_font_weight(args.font_weight)
    args.fps = max(12.0, min(60.0, float(args.fps or 30.0)))

    normalized_captions: list[dict[str, Any]] = []
    caption_lookup: dict[str, dict[str, Any]] = {}
    for index, raw_caption in enumerate(captions, start=1):
        if not isinstance(raw_caption, dict):
            continue
        caption_id = str(raw_caption.get("id") or f"caption-{index}")
        words = raw_caption.get("words") if isinstance(raw_caption.get("words"), list) else []
        normalized_words = []
        for word in words:
            if not isinstance(word, dict):
                continue
            text = str(word.get("text") or "").strip()
            start = float(word.get("start", 0) or 0)
            end = float(word.get("end", 0) or 0)
            if not text or end <= start:
                continue
            normalized_words.append({"text": text, "start": start, "end": end})
        if not normalized_words:
            continue
        normalized = {
            "id": caption_id,
            "index": int(raw_caption.get("index", index) or index),
            "text": str(raw_caption.get("text") or " ".join(word["text"] for word in normalized_words)).strip(),
            "start": float(raw_caption.get("start", normalized_words[0]["start"]) or normalized_words[0]["start"]),
            "end": float(raw_caption.get("end", normalized_words[-1]["end"]) or normalized_words[-1]["end"]),
            "words": normalized_words,
        }
        normalized_captions.append(normalized)
        caption_lookup[caption_id] = normalized

    entries = build_frame_entries(normalized_captions, args.animation_preset, args.fps)
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    rendered_entries: list[dict[str, Any]] = []
    render_cache: dict[str, str] = {}
    for render_index, entry in enumerate(entries, start=1):
        progress = round(float(entry.get("progress", 0.0) or 0.0), 4)
        render_key = json.dumps([
            entry.get("captionId"),
            int(entry.get("activeIndex", -1)),
            progress,
        ])
        relative_path = render_cache.get(render_key)
        if relative_path is None:
            image = render_entry(entry, caption_lookup, args)
            output_path = output_dir / f"overlay-{len(render_cache) + 1:04d}.png"
            image.save(output_path)
            relative_path = output_path.name
            render_cache[render_key] = relative_path
        rendered_entries.append({
            "captionId": entry["captionId"],
            "captionIndex": entry["captionIndex"],
            "start": round(float(entry["start"]), 3),
            "end": round(float(entry["end"]), 3),
            "activeIndex": int(entry.get("activeIndex", -1)),
            "progress": progress,
            "frameIndex": int(entry.get("frameIndex", render_index - 1)),
            "relativePath": relative_path,
        })

    manifest = {
        "schemaVersion": "2026-04-animated-caption-overlays-v1",
        "width": args.width,
        "height": args.height,
        "bottomMargin": args.bottom_margin,
        "animationPreset": args.animation_preset,
        "fps": round(float(args.fps), 3),
        "fontWeight": int(args.font_weight),
        "wordSpacing": round(float(args.word_spacing), 3),
        "renderedImageCount": len(render_cache),
        "entryCount": len(rendered_entries),
        "entries": rendered_entries,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(str(manifest_path))


if __name__ == "__main__":
    main()
