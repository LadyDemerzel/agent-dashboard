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
    parser.add_argument("--animation-preset", default="stable-pop")
    parser.add_argument("--animation-config-json")
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

BUILT_IN_ANIMATION_CONFIGS: dict[str, dict[str, Any]] = {
    "none": {
        "version": 1,
        "layoutMode": "stable",
        "timing": {"mode": "word-relative", "multiplier": 1, "minMs": 120, "maxMs": 1000, "fixedMs": 240},
        "colors": {"outlineColorMode": "style-outline", "shadowColorMode": "style-shadow", "glowColorMode": "style-active-word"},
        "motion": {
            "scale": {"keyframes": [{"time": 0, "value": 1}, {"time": 1, "value": 1}]},
            "translateXEm": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "translateYEm": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "extraOutlineWidth": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "extraBlur": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "glowStrength": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "shadowOpacityMultiplier": {"keyframes": [{"time": 0, "value": 1}, {"time": 1, "value": 1}]},
        },
    },
    "stable-pop": {
        "version": 1,
        "layoutMode": "stable",
        "timing": {"mode": "word-relative", "multiplier": 1, "minMs": 120, "maxMs": 240, "fixedMs": 240},
        "colors": {"outlineColorMode": "style-active-word", "shadowColorMode": "style-active-word", "glowColorMode": "style-active-word"},
        "motion": {
            "scale": {"keyframes": [{"time": 0, "value": 1, "easing": "linear"}, {"time": 0.16, "value": 1.18, "easing": "ease-out-cubic"}, {"time": 1, "value": 1, "easing": "ease-out-cubic"}]},
            "translateXEm": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "translateYEm": {"keyframes": [{"time": 0, "value": 0, "easing": "linear"}, {"time": 0.16, "value": -0.11, "easing": "ease-out-cubic"}, {"time": 1, "value": 0, "easing": "ease-out-cubic"}]},
            "extraOutlineWidth": {"keyframes": [{"time": 0, "value": 1.1}, {"time": 0.5, "value": 0.5, "easing": "ease-out-cubic"}, {"time": 1, "value": 0, "easing": "ease-out-cubic"}]},
            "extraBlur": {"keyframes": [{"time": 0, "value": 1.8}, {"time": 0.5, "value": 1.1, "easing": "ease-out-cubic"}, {"time": 1, "value": 0.6, "easing": "ease-out-cubic"}]},
            "glowStrength": {"keyframes": [{"time": 0, "value": 0.14}, {"time": 0.35, "value": 0.24, "easing": "ease-out-cubic"}, {"time": 1, "value": 0.06, "easing": "ease-out-cubic"}]},
            "shadowOpacityMultiplier": {"keyframes": [{"time": 0, "value": 0.95}, {"time": 0.45, "value": 1.12, "easing": "ease-out-cubic"}, {"time": 1, "value": 0.88, "easing": "ease-out-cubic"}]},
        },
    },
    "fluid-pop": {
        "version": 1,
        "layoutMode": "fluid",
        "timing": {"mode": "word-relative", "multiplier": 1, "minMs": 120, "maxMs": 240, "fixedMs": 240},
        "colors": {"outlineColorMode": "style-active-word", "shadowColorMode": "style-active-word", "glowColorMode": "style-active-word"},
        "motion": {
            "scale": {"keyframes": [{"time": 0, "value": 1, "easing": "linear"}, {"time": 0.16, "value": 1.18, "easing": "ease-out-cubic"}, {"time": 1, "value": 1, "easing": "ease-out-cubic"}]},
            "translateXEm": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "translateYEm": {"keyframes": [{"time": 0, "value": 0, "easing": "linear"}, {"time": 0.16, "value": -0.11, "easing": "ease-out-cubic"}, {"time": 1, "value": 0, "easing": "ease-out-cubic"}]},
            "extraOutlineWidth": {"keyframes": [{"time": 0, "value": 1.1}, {"time": 0.5, "value": 0.5, "easing": "ease-out-cubic"}, {"time": 1, "value": 0, "easing": "ease-out-cubic"}]},
            "extraBlur": {"keyframes": [{"time": 0, "value": 1.8}, {"time": 0.5, "value": 1.1, "easing": "ease-out-cubic"}, {"time": 1, "value": 0.6, "easing": "ease-out-cubic"}]},
            "glowStrength": {"keyframes": [{"time": 0, "value": 0.14}, {"time": 0.35, "value": 0.24, "easing": "ease-out-cubic"}, {"time": 1, "value": 0.06, "easing": "ease-out-cubic"}]},
            "shadowOpacityMultiplier": {"keyframes": [{"time": 0, "value": 0.95}, {"time": 0.45, "value": 1.12, "easing": "ease-out-cubic"}, {"time": 1, "value": 0.88, "easing": "ease-out-cubic"}]},
        },
    },
    "pulse": {
        "version": 1,
        "layoutMode": "stable",
        "timing": {"mode": "word-relative", "multiplier": 1, "minMs": 180, "maxMs": 320, "fixedMs": 320},
        "colors": {"outlineColorMode": "style-outline", "shadowColorMode": "style-shadow", "glowColorMode": "style-active-word"},
        "motion": {
            "scale": {"keyframes": [{"time": 0, "value": 1.03}, {"time": 0.25, "value": 1.08, "easing": "ease-out-quad"}, {"time": 0.5, "value": 1.03, "easing": "ease-in-out-cubic"}, {"time": 0.75, "value": 0.98, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 1.03, "easing": "ease-in-out-cubic"}]},
            "translateXEm": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "translateYEm": {"keyframes": [{"time": 0, "value": -0.03}, {"time": 1, "value": -0.03}]},
            "extraOutlineWidth": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "extraBlur": {"keyframes": [{"time": 0, "value": 0.2}, {"time": 0.5, "value": 0.4, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 0.2, "easing": "ease-in-out-cubic"}]},
            "glowStrength": {"keyframes": [{"time": 0, "value": 0.18}, {"time": 0.5, "value": 0.36, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 0.18, "easing": "ease-in-out-cubic"}]},
            "shadowOpacityMultiplier": {"keyframes": [{"time": 0, "value": 1}, {"time": 0.5, "value": 1.16, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 1, "easing": "ease-in-out-cubic"}]},
        },
    },
    "glow": {
        "version": 1,
        "layoutMode": "stable",
        "timing": {"mode": "word-relative", "multiplier": 1, "minMs": 160, "maxMs": 300, "fixedMs": 300},
        "colors": {"outlineColorMode": "style-active-word", "shadowColorMode": "style-active-word", "glowColorMode": "style-active-word"},
        "motion": {
            "scale": {"keyframes": [{"time": 0, "value": 1.02}, {"time": 0.5, "value": 1.06, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 1.02, "easing": "ease-in-out-cubic"}]},
            "translateXEm": {"keyframes": [{"time": 0, "value": 0}, {"time": 1, "value": 0}]},
            "translateYEm": {"keyframes": [{"time": 0, "value": -0.015}, {"time": 1, "value": -0.015}]},
            "extraOutlineWidth": {"keyframes": [{"time": 0, "value": 0.5}, {"time": 0.5, "value": 0.85, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 0.5, "easing": "ease-in-out-cubic"}]},
            "extraBlur": {"keyframes": [{"time": 0, "value": 0.8}, {"time": 0.5, "value": 1.2, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 0.8, "easing": "ease-in-out-cubic"}]},
            "glowStrength": {"keyframes": [{"time": 0, "value": 0.55}, {"time": 0.5, "value": 0.9, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 0.55, "easing": "ease-in-out-cubic"}]},
            "shadowOpacityMultiplier": {"keyframes": [{"time": 0, "value": 1.15}, {"time": 0.5, "value": 1.35, "easing": "ease-in-out-cubic"}, {"time": 1, "value": 1.15, "easing": "ease-in-out-cubic"}]},
        },
    },
}


def clamp_number(value: Any, fallback: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except Exception:
        return fallback
    return max(minimum, min(maximum, parsed))


def normalize_animation_easing(value: Any, fallback: str = "linear") -> str:
    return value if value in {"linear", "ease-in-quad", "ease-out-quad", "ease-in-out-quad", "ease-out-cubic", "ease-in-out-cubic", "ease-out-back"} else fallback


def normalize_animation_color_mode(value: Any, fallback: str) -> str:
    return value if value in {"style-active-word", "style-outline", "style-shadow", "custom"} else fallback


def normalize_animation_track(value: Any, fallback: dict[str, Any], minimum: float, maximum: float) -> dict[str, Any]:
    frames = []
    if isinstance(value, dict) and isinstance(value.get("keyframes"), list):
        frames = value.get("keyframes") or []
    elif isinstance(value, list):
        frames = value
    normalized = []
    fallback_frames = fallback.get("keyframes") or [{"time": 0, "value": 0}, {"time": 1, "value": 0}]
    for index, frame in enumerate(frames):
        if not isinstance(frame, dict):
            continue
        fallback_frame = fallback_frames[min(index, len(fallback_frames) - 1)]
        time_value = round(clamp_number(frame.get("time"), 0 if index == 0 else 1, 0, 1), 4)
        normalized.append({
            "time": time_value,
            "value": round(clamp_number(frame.get("value"), fallback_frame.get("value", 0), minimum, maximum), 4),
            "easing": normalize_animation_easing(frame.get("easing"), fallback_frame.get("easing", "linear")),
        })
    normalized.sort(key=lambda item: (item["time"], item["value"]))
    if not normalized:
        normalized = [dict(frame) for frame in fallback_frames]
    if normalized[0]["time"] > 0:
        normalized.insert(0, {**normalized[0], "time": 0})
    if normalized[-1]["time"] < 1:
        normalized.append({**normalized[-1], "time": 1})
    return {"keyframes": normalized}


def normalize_animation_config(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    obj = value if isinstance(value, dict) else {}
    timing = obj.get("timing") if isinstance(obj.get("timing"), dict) else {}
    colors = obj.get("colors") if isinstance(obj.get("colors"), dict) else {}
    motion = obj.get("motion") if isinstance(obj.get("motion"), dict) else {}
    return {
        "version": 1,
        "layoutMode": "fluid" if obj.get("layoutMode") == "fluid" else fallback.get("layoutMode", "stable"),
        "timing": {
            "mode": "fixed" if timing.get("mode") == "fixed" else fallback["timing"].get("mode", "word-relative"),
            "multiplier": round(clamp_number(timing.get("multiplier"), fallback["timing"].get("multiplier", 1), 0.1, 4), 3),
            "minMs": int(round(clamp_number(timing.get("minMs"), fallback["timing"].get("minMs", 120), 40, 2000))),
            "maxMs": int(round(clamp_number(timing.get("maxMs"), fallback["timing"].get("maxMs", 240), 40, 2000))),
            "fixedMs": int(round(clamp_number(timing.get("fixedMs"), fallback["timing"].get("fixedMs", 240), 40, 2000))),
        },
        "colors": {
            "outlineColorMode": normalize_animation_color_mode(colors.get("outlineColorMode"), fallback["colors"].get("outlineColorMode", "style-outline")),
            "outlineColor": normalize_hex(str(colors.get("outlineColor") or fallback["colors"].get("outlineColor") or "#FFFFFF"), str(fallback["colors"].get("outlineColor") or "#FFFFFF")),
            "shadowColorMode": normalize_animation_color_mode(colors.get("shadowColorMode"), fallback["colors"].get("shadowColorMode", "style-shadow")),
            "shadowColor": normalize_hex(str(colors.get("shadowColor") or fallback["colors"].get("shadowColor") or "#FFFFFF"), str(fallback["colors"].get("shadowColor") or "#FFFFFF")),
            "glowColorMode": normalize_animation_color_mode(colors.get("glowColorMode"), fallback["colors"].get("glowColorMode", "style-active-word")),
            "glowColor": normalize_hex(str(colors.get("glowColor") or fallback["colors"].get("glowColor") or "#FFFFFF"), str(fallback["colors"].get("glowColor") or "#FFFFFF")),
        },
        "motion": {
            "scale": normalize_animation_track(motion.get("scale"), fallback["motion"]["scale"], 0.2, 4),
            "translateXEm": normalize_animation_track(motion.get("translateXEm"), fallback["motion"]["translateXEm"], -4, 4),
            "translateYEm": normalize_animation_track(motion.get("translateYEm"), fallback["motion"]["translateYEm"], -4, 4),
            "extraOutlineWidth": normalize_animation_track(motion.get("extraOutlineWidth"), fallback["motion"]["extraOutlineWidth"], 0, 16),
            "extraBlur": normalize_animation_track(motion.get("extraBlur"), fallback["motion"]["extraBlur"], 0, 20),
            "glowStrength": normalize_animation_track(motion.get("glowStrength"), fallback["motion"]["glowStrength"], 0, 2.5),
            "shadowOpacityMultiplier": normalize_animation_track(motion.get("shadowOpacityMultiplier"), fallback["motion"]["shadowOpacityMultiplier"], 0, 4),
        },
    }


def get_builtin_animation_config(preset: str) -> dict[str, Any]:
    name = str(preset or "stable-pop").strip()
    if name == "word-highlight" or name == "pop":
        name = "stable-pop"
    fallback = BUILT_IN_ANIMATION_CONFIGS.get(name) or BUILT_IN_ANIMATION_CONFIGS["stable-pop"]
    return normalize_animation_config(fallback, fallback)


def apply_animation_easing(easing: str, value: float) -> float:
    t = clamp01(value)
    if easing == "ease-in-quad":
        return t * t
    if easing == "ease-out-quad":
        return 1 - ((1 - t) * (1 - t))
    if easing == "ease-in-out-quad":
        return 2 * t * t if t < 0.5 else 1 - (((-2 * t + 2) ** 2) / 2)
    if easing == "ease-out-cubic":
        return 1 - ((1 - t) ** 3)
    if easing == "ease-in-out-cubic":
        return 4 * t * t * t if t < 0.5 else 1 - (((-2 * t + 2) ** 3) / 2)
    if easing == "ease-out-back":
        c1 = 1.70158
        c3 = c1 + 1
        return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2))
    return t


def evaluate_animation_track(track: dict[str, Any], progress: float) -> float:
    frames = track.get("keyframes") or [{"time": 0, "value": 0}, {"time": 1, "value": 0}]
    t = clamp01(progress)
    if t <= frames[0]["time"]:
        return float(frames[0]["value"])
    for index in range(1, len(frames)):
        previous = frames[index - 1]
        current = frames[index]
        if t <= current["time"]:
            span = max(0.0001, float(current["time"]) - float(previous["time"]))
            local = apply_animation_easing(str(current.get("easing") or "linear"), (t - float(previous["time"])) / span)
            return float(previous["value"]) + ((float(current["value"]) - float(previous["value"])) * local)
    return float(frames[-1]["value"])


def get_animation_track_peak_value(track: dict[str, Any]) -> float:
    frames = track.get("keyframes") or []
    return max([float(frame.get("value", 0)) for frame in frames] or [0.0])


def get_animation_track_max_abs(track: dict[str, Any]) -> float:
    frames = track.get("keyframes") or []
    return max([abs(float(frame.get("value", 0))) for frame in frames] or [0.0])


def get_max_active_scale(animation_config: dict[str, Any]) -> float:
    return max(1.0, get_animation_track_peak_value(animation_config["motion"]["scale"]))


def resolve_animation_duration_seconds(animation_config: dict[str, Any], word_duration_seconds: float) -> float:
    safe_duration = max(0.04, word_duration_seconds or 0.04)
    timing = animation_config["timing"]
    if timing["mode"] == "fixed":
        return max(0.04, min(safe_duration, float(timing["fixedMs"]) / 1000.0))
    requested = safe_duration * float(timing["multiplier"])
    return max(float(timing["minMs"]) / 1000.0, min(safe_duration, float(timing["maxMs"]) / 1000.0, requested))


def resolve_animation_progress(animation_config: dict[str, Any], word_start: float, word_end: float, sample_time: float) -> float:
    word_duration = max(0.04, word_end - word_start)
    sample_seconds = clamp01((sample_time - word_start) / word_duration) * word_duration
    animation_duration = resolve_animation_duration_seconds(animation_config, word_duration)
    return clamp01(sample_seconds / max(0.04, animation_duration))


def resolve_animation_frame(animation_config: dict[str, Any], word_progress: float, word_duration_seconds: float) -> dict[str, float]:
    progress = clamp01(word_progress)
    _ = word_duration_seconds
    return {
        "scale": evaluate_animation_track(animation_config["motion"]["scale"], progress),
        "translateXEm": evaluate_animation_track(animation_config["motion"]["translateXEm"], progress),
        "translateYEm": evaluate_animation_track(animation_config["motion"]["translateYEm"], progress),
        "extraOutlineWidth": evaluate_animation_track(animation_config["motion"]["extraOutlineWidth"], progress),
        "extraBlur": evaluate_animation_track(animation_config["motion"]["extraBlur"], progress),
        "glowStrength": evaluate_animation_track(animation_config["motion"]["glowStrength"], progress),
        "shadowOpacityMultiplier": evaluate_animation_track(animation_config["motion"]["shadowOpacityMultiplier"], progress),
    }


def resolve_animation_color(mode: str, palette: dict[str, str], custom_color: str | None) -> str:
    if mode == "custom" and custom_color and re.match(r"^#[0-9A-Fa-f]{6}$", custom_color):
        return custom_color.upper()
    if mode == "style-outline":
        return palette["outlineColor"]
    if mode == "style-shadow":
        return palette["shadowColor"]
    return palette["activeWordColor"]


def get_animation_config(args: argparse.Namespace) -> dict[str, Any]:
    fallback = get_builtin_animation_config(getattr(args, "animation_preset", "stable-pop"))
    raw_json = getattr(args, "animation_config_json", None)
    if not raw_json:
        return fallback
    try:
        parsed = json.loads(raw_json)
    except Exception:
        return fallback
    return normalize_animation_config(parsed, fallback)


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
    animation_config: dict[str, Any],
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

    max_line_advance = base_line_advance + (max(0.0, max_word_growth) if animation_config.get("layoutMode") == "fluid" else 0.0)
    return {
        "baseAdvance": base_line_advance,
        "maxAdvance": max_line_advance,
        "ascent": max_ascent,
        "descent": max_descent,
        "height": max_ascent + max_descent,
    }


def fit_layout(draw: ImageDraw.ImageDraw, words: list[str], args: argparse.Namespace) -> tuple[dict[str, Any], str | None]:
    animation_config = getattr(args, "animation_config", None) or get_animation_config(args)
    resolved_font_path = resolve_font_path(args.font_family, args.font_path, args.font_weight)
    base_stroke_width = max(0, int(round(args.outline_width)))
    shadow_extra = int(round(max(abs(float(args.shadow_offset_x)), abs(float(args.shadow_offset_y))) + max(0.0, float(args.shadow_blur)) * 2.0))
    box_extra = max(12, int(round(max(28, int(args.font_size)) * max(0.0, get_max_active_scale(animation_config) - 1.0))) + max(4, shadow_extra))
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
        scaled_font = load_font_from_path(resolved_font_path, max(30, int(round(size * get_max_active_scale(animation_config)))))
        scaled_stroke_width = max(base_stroke_width, int(round(base_stroke_width * get_max_active_scale(animation_config))))
        space_advance = resolve_space_width(measure_text_advance(draw, " ", font), args.word_spacing)
        for line in lines:
            metrics = compute_line_metrics(draw, line, font, scaled_font, base_stroke_width, scaled_stroke_width, space_advance, animation_config)
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
        scaled_font = load_font_from_path(resolved_font_path, max(30, int(round(size * get_max_active_scale(animation_config)))))
        scaled_stroke_width = max(base_stroke_width, int(round(base_stroke_width * get_max_active_scale(animation_config))))
        space_advance = resolve_space_width(measure_text_advance(draw, " ", font), args.word_spacing)
        for line in lines:
            metrics = compute_line_metrics(draw, line, font, scaled_font, base_stroke_width, scaled_stroke_width, space_advance, animation_config)
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


def resolve_entry_state(caption: dict[str, Any], animation_config: dict[str, Any], sample_time: float) -> tuple[int, float, float] | None:
    words = caption.get("words") if isinstance(caption, dict) else None
    if not isinstance(words, list) or not words:
        return None

    safe_caption_start = max(0.0, float(caption.get("start", 0) or 0))
    safe_caption_end = max(safe_caption_start + 0.05, float(caption.get("end", safe_caption_start + 0.05) or (safe_caption_start + 0.05)))
    if sample_time < safe_caption_start or sample_time >= safe_caption_end:
        return None

    first_word_start = max(safe_caption_start, float(words[0].get("start", safe_caption_start) or safe_caption_start))
    if sample_time < first_word_start:
        return -1, 0.0, 0.05

    for index, word in enumerate(words):
        word_start = max(safe_caption_start, float(word.get("start", safe_caption_start) or safe_caption_start))
        word_end = max(word_start + 0.05, float(word.get("end", word_start + 0.05) or (word_start + 0.05)))
        word_duration = max(0.05, word_end - word_start)
        if word_start <= sample_time < word_end:
            return index, resolve_animation_progress(animation_config, word_start, word_end, sample_time), word_duration

        next_word = words[index + 1] if index + 1 < len(words) else None
        hold_end = float(next_word.get("start", safe_caption_end) or safe_caption_end) if next_word else safe_caption_end
        hold_end = min(safe_caption_end, max(word_end, hold_end))
        if word_end <= sample_time < hold_end:
            next_duration = max(0.05, float(next_word.get("end", word_end + 0.05) or (word_end + 0.05)) - float(next_word.get("start", word_end) or word_end)) if next_word else word_duration
            return index + 1, 0.0, next_duration

    return len(words), 0.0, max(0.05, safe_caption_end - safe_caption_start)


def build_frame_entries(captions: list[dict[str, Any]], animation_config: dict[str, Any], fps: float) -> list[dict[str, Any]]:
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
            state = resolve_entry_state(caption, animation_config, sample_time)
            if state is None:
                continue
            active_index, progress, word_duration_seconds = state
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
                "wordDurationSeconds": round(float(word_duration_seconds), 4),
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
    animation_config = getattr(args, "animation_config", None) or get_animation_config(args)
    box_extra = max(12, int(round(layout["fontSize"] * max(0.0, get_max_active_scale(animation_config) - 1.0))) + max(4, shadow_extra))
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
    fluid_pop = animation_config.get("layoutMode") == "fluid"
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
            animation_frame = resolve_animation_frame(animation_config, progress if state == "active" else 0.0, float(entry.get("wordDurationSeconds", 0.05) or 0.05))
            scale = float(animation_frame["scale"]) if state == "active" else 1.0
            font_size = int(round(layout["fontSize"] * scale))
            stroke_width = max(0, int(round((layout["baseStrokeWidth"] + (animation_frame["extraOutlineWidth"] if state == "active" else 0.0)) * max(1.0, scale))))
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
            palette = {
                "activeWordColor": args.active_word_color,
                "outlineColor": args.outline_color,
                "shadowColor": args.shadow_color,
            }
            outline_color = resolve_animation_color(
                animation_config["colors"]["outlineColorMode"],
                palette,
                animation_config["colors"].get("outlineColor"),
            ) if state == "active" else args.outline_color
            shadow_color = resolve_animation_color(
                animation_config["colors"]["shadowColorMode"],
                palette,
                animation_config["colors"].get("shadowColor"),
            ) if state == "active" else args.shadow_color
            glow_color = resolve_animation_color(
                animation_config["colors"]["glowColorMode"],
                palette,
                animation_config["colors"].get("glowColor"),
            ) if state == "active" else args.active_word_color
            glow_strength = float(animation_frame["glowStrength"]) if state == "active" else 0.0

            slot_width = line_word["advanceWidth"] if fluid_pop else line[word_index_on_line]["baseAdvance"]
            draw_left = cursor_x + max(0.0, (slot_width - line_word["metrics"]["width"]) / 2)
            draw_x = draw_left - line_word["metrics"]["bbox"][0] + ((float(animation_frame["translateXEm"]) * layout["fontSize"]) if state == "active" else 0.0)
            draw_baseline_y = baseline_y - ((float(animation_frame["translateYEm"]) * layout["fontSize"]) if state == "active" else 0.0)

            if glow_strength > 0:
                glow_alpha = min(0.9, glow_strength)
                glow_stroke = line_word["strokeWidth"] + 4
                glow_draw.text(
                    (draw_x, draw_baseline_y),
                    line_word["text"],
                    font=line_word["font"],
                    fill=rgba(glow_color, 0.22 * glow_alpha),
                    stroke_width=glow_stroke,
                    stroke_fill=rgba(glow_color, 0.48 * glow_alpha),
                    anchor="ls",
                )

            shadow_strength = max(0.0, float(args.shadow_strength))
            if shadow_strength > 0:
                shadow_alpha = min(0.95, (0.18 + (shadow_strength * 0.06) + (glow_strength * 0.08)) * (float(animation_frame["shadowOpacityMultiplier"]) if state == "active" else 1.0))
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
        shadow_blur = max(0.0, float(args.shadow_blur)) + max(0.0, float(getattr(args, "max_extra_shadow_blur", 0.0)))
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
    args.animation_preset = str(args.animation_preset or "stable-pop").strip() or "stable-pop"
    args.animation_config = get_animation_config(args)
    args.max_extra_shadow_blur = max(0.0, get_animation_track_peak_value(args.animation_config["motion"]["extraBlur"]))

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

    entries = build_frame_entries(normalized_captions, args.animation_config, args.fps)
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
        "animationConfig": args.animation_config,
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
