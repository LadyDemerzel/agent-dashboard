#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shlex
import subprocess
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parent
QWEN_RUNNER = Path(
    os.environ.get(
        "XML_SCENE_VIDEO_QWEN_RUNNER",
        "/Users/ittaisvidler/.openclaw/workspace-ralph/skills/qwen3-voiceover/scripts/run.sh",
    )
)
FORCED_ALIGN_RUNNER = BASE_DIR / "run_forced_align.sh"
ACESTEP_REPO = Path("/Users/ittaisvidler/.openclaw/tools/ACE-Step-1.5")
DEFAULT_FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
DEFAULT_TTS_ENGINE = "qwen"
DEFAULT_TTS_VOICE = "Eddy (English (US))"
DEFAULT_TTS_RATE = 185
DEFAULT_VOICE_SPEAKER = "Aiden"
DEFAULT_VOICE_INSTRUCT = (
    "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, "
    "speak only English, no other languages or non-speech sounds."
)
DEFAULT_FPS = 30
DEFAULT_MUSIC_PAD_SECONDS = 6
DEFAULT_ACESTEP_GENERATED_LOOP_SECONDS = 20
DEFAULT_ACESTEP_URL = "http://127.0.0.1:8011"
DEFAULT_MUSIC_PROMPT = (
    "instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, "
    "airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, "
    "no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice"
)
DEFAULT_MUSIC_VOLUME = 0.38
DEFAULT_ACESTEP_POLL_SECONDS = 5.0
DEFAULT_ACESTEP_TIMEOUT_SECONDS = 60 * 45
DEFAULT_ASR_LANGUAGE = "English"
DEFAULT_QWEN_VOICE_DESIGN_WARMUP_TEXT = "Hi there. Ready when you are."
DEFAULT_SCENE_LOOKAHEAD = 12
MIN_SCENE_DURATION = 0.45
FRAME_WIDTH = 1080
FRAME_HEIGHT = 1920
DEFAULT_PAD_COLOR = "0x000000"
# Animated zoom needs extra source resolution so zoompan's integer crop steps do not read as shake.
ANIMATED_ZOOM_SUPERSAMPLE = 4


def vertical_frame_normalize_filter(*, pad_color: str = DEFAULT_PAD_COLOR) -> str:
    """Fit an image/video into the canonical 9:16 frame without distorting it.

    Scene image providers do not all return the requested 1080x1920 raster. For example,
    gpt-image-2 can return 1024x1536 or 768x1376 plates even when the dashboard filename
    says 1080x1920. Scaling those directly to 1080:1920 stretches the subject. We instead
    preserve the source aspect ratio and pad any extra area.
    """

    return (
        f"scale={FRAME_WIDTH}:{FRAME_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={FRAME_WIDTH}:{FRAME_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color={pad_color},"
        "setsar=1"
    )


@dataclass
class CameraMotion:
    pan_x: float | None = None
    pan_y: float | None = None
    zoom: float | None = None
    zoom_start: float | None = None
    zoom_end: float | None = None
    shake: float | None = None

    def is_explicit(self) -> bool:
        return any(
            value is not None
            for value in (self.pan_x, self.pan_y, self.zoom, self.zoom_start, self.zoom_end, self.shake)
        )

    def as_manifest(self) -> dict[str, float] | None:
        payload: dict[str, float] = {}
        if self.pan_x is not None:
            payload["pan_x"] = self.pan_x
        if self.pan_y is not None:
            payload["pan_y"] = self.pan_y
        if self.zoom is not None:
            payload["zoom"] = self.zoom
        if self.zoom_start is not None:
            payload["zoom_start"] = self.zoom_start
        if self.zoom_end is not None:
            payload["zoom_end"] = self.zoom_end
        if self.shake is not None:
            payload["shake"] = self.shake
        return payload or None


@dataclass
class Scene:
    index: int
    text: str
    image_prompt: str
    duration_hint: str | None = None
    reference_previous_scene_image: bool = False
    camera_motion: CameraMotion = field(default_factory=CameraMotion)
    image_id: str | None = None
    based_on_image_id: str | None = None
    visual_id: str | None = None
    visual_type: str = "image"

    def is_motion_graphic(self) -> bool:
        return self.visual_type == "motion_graphic"


@dataclass
class AlignedWord:
    text: str
    norm: str
    start_time: float
    end_time: float


@dataclass
class CaptionSection:
    index: int
    text: str
    start: float
    end: float


def run(cmd: list[str], *, quiet: bool = False) -> None:
    if not quiet:
        print("RUN:", " ".join(shlex.quote(c) for c in cmd), flush=True)
    subprocess.run(
        cmd,
        check=True,
        stdout=(subprocess.DEVNULL if quiet else None),
        stderr=(subprocess.DEVNULL if quiet else None),
    )


def ffprobe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nk=1:nw=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def parse_bool_attr(raw: str | None, *, default: bool = False) -> bool:
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise SystemExit(f"Invalid boolean scene attribute value: {raw!r}")


def parse_optional_float_attr(raw: str | None, label: str) -> float | None:
    if raw is None or not raw.strip():
        return None
    try:
        return float(raw.strip())
    except ValueError as exc:
        raise SystemExit(f"Invalid numeric value for {label}: {raw!r}") from exc


def parse_xml(path: Path) -> tuple[str | None, str | None, list[Scene]]:
    root = ET.fromstring(path.read_text(encoding="utf-8"))
    if root.tag != "video":
        raise SystemExit("Root element must be <video>")
    topic_el = root.find("topic")
    topic = topic_el.text.strip() if topic_el is not None and topic_el.text else None
    script_el = root.find("script")
    full_script = " ".join(script_el.text.split()) if script_el is not None and script_el.text and script_el.text.strip() else None
    scenes: list[Scene] = []

    legacy_scenes = root.findall("scene")
    if legacy_scenes:
        for i, el in enumerate(legacy_scenes, start=1):
            text_el = el.find("text")
            image_el = el.find("image")
            if text_el is None or not (text_el.text or "").strip():
                raise SystemExit(f"Scene {i} missing <text>")
            if image_el is None or not (image_el.text or "").strip():
                raise SystemExit(f"Scene {i} missing <image>")
            scenes.append(
                Scene(
                    i,
                    " ".join(text_el.text.split()),
                    " ".join(image_el.text.split()),
                    el.attrib.get("duration"),
                    parse_bool_attr(el.attrib.get("referencePreviousSceneImage"), default=False),
                    CameraMotion(
                        pan_x=parse_optional_float_attr(el.attrib.get("cameraPanX"), f"scene {i} cameraPanX"),
                        pan_y=parse_optional_float_attr(el.attrib.get("cameraPanY"), f"scene {i} cameraPanY"),
                        zoom=parse_optional_float_attr(el.attrib.get("cameraZoom"), f"scene {i} cameraZoom"),
                        zoom_start=parse_optional_float_attr(el.attrib.get("cameraZoomStart"), f"scene {i} cameraZoomStart"),
                        zoom_end=parse_optional_float_attr(el.attrib.get("cameraZoomEnd"), f"scene {i} cameraZoomEnd"),
                        shake=parse_optional_float_attr(el.attrib.get("cameraShake"), f"scene {i} cameraShake"),
                    ),
                )
            )
        return topic, full_script, scenes

    assets: dict[str, dict[str, str | None]] = {}
    assets_el = root.find("assets")
    if assets_el is not None:
        for image_el in assets_el.findall("image"):
            image_id = (image_el.attrib.get("id") or "").strip()
            prompt_el = image_el.find("prompt")
            prompt = " ".join(prompt_el.text.split()) if prompt_el is not None and prompt_el.text and prompt_el.text.strip() else None
            if not image_id or not prompt:
                raise SystemExit("Each <assets><image> must include id and <prompt>")
            assets[image_id] = {
                "prompt": prompt,
                "based_on": (image_el.attrib.get("basedOn") or "").strip() or None,
            }

    timeline_el = root.find("timeline")
    if timeline_el is not None:
        for i, el in enumerate(timeline_el.findall("visual"), start=1):
            label = (el.attrib.get("label") or "").strip() or f"Visual {i}"
            image_id = (el.attrib.get("imageId") or "").strip()
            motion_graphic_id = (el.attrib.get("motionGraphicId") or el.attrib.get("motionId") or el.attrib.get("motionGraphic") or "").strip()
            visual_type = (el.attrib.get("visualType") or el.attrib.get("type") or "").strip()
            is_motion_graphic = visual_type == "motion_graphic" or bool(motion_graphic_id)
            if image_id and image_id in assets:
                asset = assets[image_id]
                scene_image_id = image_id
            elif is_motion_graphic and motion_graphic_id:
                scene_image_id = f"__motion_graphic_{motion_graphic_id}"
                asset = {
                    "prompt": f"Deterministic motion graphic poster for {motion_graphic_id}",
                    "based_on": None,
                }
            else:
                raise SystemExit(f"Visual {i} references missing imageId {image_id!r}")
            start = (el.attrib.get("start") or "").strip()
            end = (el.attrib.get("end") or "").strip()
            duration_hint = f"{start}:{end}" if start and end else None
            scenes.append(
                Scene(
                    i,
                    label,
                    str(asset.get("prompt") or ""),
                    duration_hint,
                    False,
                    CameraMotion(
                        pan_x=parse_optional_float_attr(el.attrib.get("cameraPanX"), f"visual {i} cameraPanX"),
                        pan_y=parse_optional_float_attr(el.attrib.get("cameraPanY"), f"visual {i} cameraPanY"),
                        zoom=parse_optional_float_attr(el.attrib.get("cameraZoom"), f"visual {i} cameraZoom"),
                        zoom_start=parse_optional_float_attr(el.attrib.get("cameraZoomStart"), f"visual {i} cameraZoomStart"),
                        zoom_end=parse_optional_float_attr(el.attrib.get("cameraZoomEnd"), f"visual {i} cameraZoomEnd"),
                        shake=parse_optional_float_attr(el.attrib.get("cameraShake"), f"visual {i} cameraShake"),
                    ),
                    image_id=scene_image_id,
                    based_on_image_id=str(asset.get("based_on") or "") or None,
                    visual_id=(el.attrib.get("id") or f"visual-{i}").strip(),
                    visual_type="motion_graphic" if is_motion_graphic else "image",
                )
            )

    if not scenes:
        raise SystemExit("No scenes found")
    return topic, full_script, scenes


def scene_image(images_dir: Path, index: int) -> Path:
    candidates = [
        images_dir / f"scene-{index:02d}-uncaptioned-1080x1920.png",
        images_dir / f"scene-{index:02d}.png",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise SystemExit(
        f"Missing uncaptioned image for scene {index}: tried {', '.join(str(c) for c in candidates)}"
    )


def cleanup_stale_motion_graphic_videos(images_dir: Path, scenes: list[Scene]) -> list[str]:
    current_motion_indexes = {scene.index for scene in scenes if scene.is_motion_graphic()}
    removed: list[str] = []
    for candidate in sorted(images_dir.glob("scene-*-motion-graphic.mp4")):
        match = re.match(r"^scene-(\d+)-motion-graphic\.mp4$", candidate.name)
        if not match:
            continue
        index = int(match.group(1))
        if index in current_motion_indexes:
            continue
        try:
            candidate.unlink()
            removed.append(str(candidate))
        except OSError:
            pass
    return removed


def scene_motion_graphic_video(images_dir: Path, scene: Scene) -> Path | None:
    if not scene.is_motion_graphic():
        return None
    candidate = images_dir / f"scene-{scene.index:02d}-motion-graphic.mp4"
    return candidate if candidate.exists() else None


def normalize_motion_graphic_video(src: Path, duration: float, out_path: Path, fps: int) -> dict[str, object]:
    ensure_dir(out_path.parent)
    normalized = vertical_frame_normalize_filter(pad_color="black")
    source_duration = ffprobe_duration(src)
    pad_seconds = max(0.0, duration - source_duration)
    video_filter = normalized
    if pad_seconds > (1 / max(1, fps)):
        video_filter = f"{video_filter},tpad=stop_mode=clone:stop_duration={pad_seconds:.3f}"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-vf",
            video_filter,
            "-t",
            f"{duration:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(fps),
            "-movflags",
            "+faststart",
            str(out_path),
        ],
        quiet=True,
    )
    return {
        "mode": "motion_graphic_template",
        "source_motion_graphic_video": str(src),
        "source_duration": source_duration,
        "duration": duration,
        "hold_last_frame_seconds": pad_seconds,
        "fps": fps,
    }


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def http_json(method: str, url: str, payload: dict | None = None, timeout: int = 60) -> dict:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def ace_step_health(base_url: str) -> dict | None:
    try:
        return http_json("GET", urllib.parse.urljoin(base_url.rstrip("/") + "/", "health"), timeout=10)
    except Exception:
        return None


def ensure_ace_step_server(base_url: str, work_dir: Path) -> Path:
    health = ace_step_health(base_url)
    if health and health.get("code") == 200:
        return work_dir / "ace-step-server.log"

    if not ACESTEP_REPO.exists():
        raise SystemExit(
            f"ACE-Step repo not found at {ACESTEP_REPO}. Clone and install it before generating music."
        )

    ensure_dir(work_dir)
    log_path = work_dir / "ace-step-server.log"
    host = urllib.parse.urlparse(base_url).hostname or "127.0.0.1"
    port = urllib.parse.urlparse(base_url).port or 8011
    cmd = [
        "bash",
        "-lc",
        (
            f"cd {shlex.quote(str(ACESTEP_REPO))} && "
            f"ACESTEP_API_HOST={shlex.quote(host)} "
            f"ACESTEP_API_PORT={port} "
            f"uv run acestep-api --host {shlex.quote(host)} --port {port}"
        ),
    ]
    with open(log_path, "ab") as logf:
        subprocess.Popen(
            cmd,
            stdout=logf,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    deadline = time.time() + 90
    while time.time() < deadline:
        health = ace_step_health(base_url)
        if health and health.get("code") == 200:
            return log_path
        time.sleep(2)
    raise SystemExit(f"ACE-Step API did not become ready at {base_url}; see {log_path}")


def download_file(url: str, dest: Path) -> None:
    ensure_dir(dest.parent)
    with urllib.request.urlopen(url, timeout=600) as resp, open(dest, "wb") as out:
        out.write(resp.read())


def generate_music_with_ace_step(
    *,
    output: Path,
    seconds: int,
    prompt: str,
    base_url: str,
    work_dir: Path,
    thinking: bool,
    force: bool,
) -> tuple[Path, Path]:
    if output.exists() and not force:
        return output, work_dir / "ace-step-server.log"

    log_path = ensure_ace_step_server(base_url, work_dir)
    release_url = urllib.parse.urljoin(base_url.rstrip("/") + "/", "release_task")
    query_url = urllib.parse.urljoin(base_url.rstrip("/") + "/", "query_result")

    payload = {
        "prompt": prompt,
        "lyrics": "[Instrumental]",
        "instrumental": True,
        "vocal_language": "en",
        "audio_duration": max(10, int(seconds)),
        "inference_steps": 8,
        "thinking": bool(thinking),
        "batch_size": 1,
        "audio_format": "wav",
        "use_random_seed": True,
    }
    release = http_json("POST", release_url, payload=payload, timeout=180)
    if release.get("code") != 200 or not release.get("data", {}).get("task_id"):
        raise SystemExit(f"ACE-Step release_task failed: {json.dumps(release, indent=2)}")
    task_id = release["data"]["task_id"]
    print(f"ACE-Step task queued: {task_id}", flush=True)

    deadline = time.time() + DEFAULT_ACESTEP_TIMEOUT_SECONDS
    while time.time() < deadline:
        time.sleep(DEFAULT_ACESTEP_POLL_SECONDS)
        status = http_json("POST", query_url, payload={"task_id_list": [task_id]}, timeout=180)
        data = status.get("data") or []
        if not data:
            continue
        item = data[0]
        state = item.get("status")
        if state == 0:
            print(f"ACE-Step task {task_id}: running", flush=True)
            continue
        if state == 2:
            raise SystemExit(f"ACE-Step task failed: {json.dumps(item, indent=2)}")
        if state == 1:
            raw_result = item.get("result")
            parsed = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
            if not parsed:
                raise SystemExit(f"ACE-Step task completed without audio payload: {json.dumps(item, indent=2)}")
            audio_entry = parsed[0]
            rel_file = audio_entry.get("file")
            if not rel_file:
                raise SystemExit(f"ACE-Step response missing file URL: {json.dumps(audio_entry, indent=2)}")
            download_url = urllib.parse.urljoin(base_url.rstrip("/") + "/", rel_file.lstrip("/"))
            tmp_download = output.with_suffix(".download")
            download_file(download_url, tmp_download)
            run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(tmp_download),
                    "-ar",
                    "48000",
                    "-ac",
                    "2",
                    str(output),
                ],
                quiet=True,
            )
            tmp_download.unlink(missing_ok=True)
            return output, log_path
    raise SystemExit(f"ACE-Step task timed out after {DEFAULT_ACESTEP_TIMEOUT_SECONDS} seconds")


def sanitize_narration_text(text: str) -> str:
    cleaned = " ".join(text.replace("’", "'").replace("–", "-").replace("—", "-").split())
    cleaned = cleaned.replace("-", " ")
    cleaned = re.sub(r"\s*&\s*", " and ", cleaned)
    cleaned = re.sub(r"\s*/\s*", " or ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.strip(" .")


def build_narration_transcript(scenes: list[Scene], full_script: str | None = None) -> tuple[list[dict[str, Any]], str]:
    scene_entries: list[dict[str, Any]] = []
    full_parts: list[str] = []

    for scene in scenes:
        narration_text = sanitize_narration_text(scene.text)
        if narration_text and not re.search(r"[.!?]$", narration_text):
            narration_text = f"{narration_text}."
        scene_entries.append(
            {
                "scene": scene.index,
                "caption_text": scene.text,
                "narration_text": narration_text,
                "caption_tokens": tokenize_for_alignment(scene.text),
                "narration_tokens": tokenize_for_alignment(narration_text),
            }
        )
        if narration_text:
            full_parts.append(narration_text)

    derived_full_script = " ".join(full_parts).strip()
    if full_script:
        return scene_entries, " ".join(full_script.split()).strip()
    return scene_entries, derived_full_script


def prepare_full_voice_audio(input_path: Path, output_path: Path) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-af",
            "highpass=f=70,lowpass=f=9000,alimiter=limit=0.95",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(output_path),
        ],
        quiet=True,
    )


def generate_full_voice_qwen(script_text: str, out_path: Path, mode: str, speaker: str, instruct: str) -> None:
    if not QWEN_RUNNER.exists():
        raise SystemExit(f"Qwen3-TTS runner not found: {QWEN_RUNNER}")
    text_file = out_path.with_suffix(".txt")
    text_file.write_text(script_text + "\n", encoding="utf-8")
    raw_path = out_path.with_name(out_path.stem + "-raw.wav")
    cmd = [
        "bash",
        str(QWEN_RUNNER),
        "--mode",
        mode,
        "--language",
        "English",
        "--instruct",
        instruct,
        "--text-file",
        str(text_file),
        "--output",
        str(raw_path),
    ]
    if mode == "voice-design":
        cmd.extend(["--warmup-text", DEFAULT_QWEN_VOICE_DESIGN_WARMUP_TEXT])
    if mode == "custom-voice":
        cmd[4:4] = ["--speaker", speaker]
    run(cmd)
    prepare_full_voice_audio(raw_path, out_path)
    raw_path.unlink(missing_ok=True)


def generate_full_voice_say(script_text: str, out_path: Path, voice_name: str, rate: int) -> None:
    tmp_aiff = out_path.with_suffix(".aiff")
    run(
        [
            "say",
            "-v",
            voice_name,
            "-r",
            str(rate),
            "-o",
            str(tmp_aiff),
            script_text,
        ]
    )
    prepare_full_voice_audio(tmp_aiff, out_path)
    tmp_aiff.unlink(missing_ok=True)


def generate_full_voice(
    script_text: str,
    out_path: Path,
    tts_engine: str,
    tts_voice: str,
    tts_rate: int,
    qwen_mode: str,
    qwen_speaker: str,
    qwen_instruct: str,
    force: bool,
) -> None:
    if out_path.exists() and not force:
        return
    if tts_engine == "qwen":
        generate_full_voice_qwen(script_text, out_path, qwen_mode, qwen_speaker, qwen_instruct)
        return
    if tts_engine == "say":
        generate_full_voice_say(script_text, out_path, tts_voice, tts_rate)
        return
    raise SystemExit(f"Unsupported tts engine: {tts_engine}")


def force_align_audio(audio_path: Path, output_json: Path, language: str, transcript_path: Path, force: bool) -> dict[str, Any]:
    if output_json.exists() and not force:
        return json.loads(output_json.read_text(encoding="utf-8"))
    if not FORCED_ALIGN_RUNNER.exists():
        raise SystemExit(f"Forced aligner runner not found: {FORCED_ALIGN_RUNNER}")
    run(
        [
            "bash",
            str(FORCED_ALIGN_RUNNER),
            "--audio",
            str(audio_path),
            "--output",
            str(output_json),
            "--language",
            language,
            "--text-file",
            str(transcript_path),
        ]
    )
    return json.loads(output_json.read_text(encoding="utf-8"))


def normalize_token(value: str) -> str:
    value = value.replace("’", "'")
    value = re.sub(r"(^[^\w']+|[^\w']+$)", "", value.lower())
    return value


def tokenize_for_alignment(text: str) -> list[str]:
    return [normalize_token(m.group(0)) for m in re.finditer(r"[A-Za-z0-9']+", text) if normalize_token(m.group(0))]


def relaxed_token_match(expected: str, actual: str) -> bool:
    if expected == actual:
        return True
    if not expected or not actual:
        return False
    exp_simple = expected.replace("'", "")
    act_simple = actual.replace("'", "")
    if exp_simple == act_simple:
        return True
    if len(exp_simple) >= 4 and len(act_simple) >= 4 and (exp_simple.startswith(act_simple) or act_simple.startswith(exp_simple)):
        return True
    return False


def alignment_words(payload: dict[str, Any]) -> list[AlignedWord]:
    items: list[AlignedWord] = []
    for item in payload.get("items") or []:
        text = str(item.get("text") or "").strip()
        norm = normalize_token(text)
        if not norm:
            continue
        items.append(
            AlignedWord(
                text=text,
                norm=norm,
                start_time=float(item.get("start_time", 0.0)),
                end_time=float(item.get("end_time", 0.0)),
            )
        )
    return items


def estimate_scene_starts(
    scenes: list[Scene],
    first_word_starts: list[float | None],
    total_duration: float,
) -> list[float]:
    n = len(scenes)
    word_weights = [max(1, len(tokenize_for_alignment(scene.text))) for scene in scenes]
    starts: list[float | None] = [None] * n
    starts[0] = 0.0
    for i in range(1, n):
        starts[i] = first_word_starts[i]

    known: list[tuple[int, float]] = [(0, 0.0)]
    for idx in range(1, n):
        if starts[idx] is not None:
            known.append((idx, float(starts[idx])))
    known.append((n, total_duration))
    known.sort(key=lambda item: item[0])

    for (left_idx, left_time), (right_idx, right_time) in zip(known, known[1:]):
        gap_scenes = right_idx - left_idx - 1
        if gap_scenes <= 0:
            continue
        segment_weights = word_weights[left_idx:right_idx]
        total_weight = sum(segment_weights)
        consumed = 0.0
        for scene_idx in range(left_idx + 1, right_idx):
            consumed += word_weights[scene_idx - 1]
            starts[scene_idx] = left_time + (right_time - left_time) * (consumed / total_weight)

    resolved = [float(value or 0.0) for value in starts]
    for i in range(1, len(resolved)):
        if resolved[i] < resolved[i - 1] + MIN_SCENE_DURATION:
            resolved[i] = resolved[i - 1] + MIN_SCENE_DURATION
    if resolved[-1] > total_duration:
        resolved[-1] = max(0.0, total_duration - MIN_SCENE_DURATION)
    return resolved


def derive_scene_timings(
    scenes: list[Scene],
    alignment_payload: dict[str, Any],
    total_voice_duration: float,
    last_hold_ms: int,
) -> tuple[list[float], dict[str, Any]]:
    aligned = alignment_words(alignment_payload)
    if not aligned:
        raise SystemExit("Forced alignment returned no word timestamps.")

    matched_by_scene: dict[int, list[AlignedWord]] = {scene.index: [] for scene in scenes}
    aligned_cursor = 0
    missing_expected: list[dict[str, Any]] = []
    expected_tokens_by_scene = {scene.index: tokenize_for_alignment(scene.text) for scene in scenes}

    for scene in scenes:
        for token in expected_tokens_by_scene[scene.index]:
            found = None
            upper = min(len(aligned), aligned_cursor + DEFAULT_SCENE_LOOKAHEAD)
            for pos in range(aligned_cursor, upper):
                if token == aligned[pos].norm:
                    found = pos
                    break
            if found is None:
                for pos in range(aligned_cursor, upper):
                    if relaxed_token_match(token, aligned[pos].norm):
                        found = pos
                        break
            if found is None:
                missing_expected.append({"scene": scene.index, "token": token})
                continue
            matched_by_scene[scene.index].append(aligned[found])
            aligned_cursor = found + 1

    first_word_starts: list[float | None] = []
    for scene in scenes:
        words = matched_by_scene[scene.index]
        first_word_starts.append(words[0].start_time if words else None)

    expected_token_count = sum(len(tokens) for tokens in expected_tokens_by_scene.values())
    matched_token_count = sum(len(matched_by_scene[scene.index]) for scene in scenes)
    coverage_ratio = (matched_token_count / expected_token_count) if expected_token_count else 1.0
    unmatched_scene_count = sum(1 for start in first_word_starts if start is None)

    alignment_strategy = "forced-alignment-boundaries"
    alignment_warning = None
    fallback_reason = None

    if coverage_ratio < 0.6:
        alignment_strategy = "proportional-fallback"
        fallback_reason = f"Low alignment token coverage ({matched_token_count}/{expected_token_count}, {coverage_ratio:.0%})"
    elif unmatched_scene_count > max(1, len(scenes) // 3):
        alignment_strategy = "proportional-fallback"
        fallback_reason = f"Too many scenes had no aligned first word ({unmatched_scene_count}/{len(scenes)})"

    if alignment_strategy == "proportional-fallback":
        alignment_warning = (
            "Forced alignment confidence was too low to trust raw scene boundary anchors, "
            "so scene timing fell back to proportional allocation across the full narration duration."
        )
        scene_starts = estimate_scene_starts(scenes, [None] * len(scenes), total_voice_duration)
    else:
        scene_starts = estimate_scene_starts(scenes, first_word_starts, total_voice_duration)

    tail_end = total_voice_duration + (last_hold_ms / 1000.0)
    scene_durations: list[float] = []
    for i in range(len(scenes)):
        start = scene_starts[i]
        end = scene_starts[i + 1] if i < len(scenes) - 1 else tail_end
        if end < start + MIN_SCENE_DURATION:
            end = start + MIN_SCENE_DURATION
        scene_durations.append(end - start)

    debug = {
        "aligned_text": alignment_payload.get("text"),
        "alignment_mode": alignment_payload.get("alignment_mode", "unknown"),
        "aligned_word_count": len(aligned),
        "expected_token_count": expected_token_count,
        "matched_token_count": matched_token_count,
        "coverage_ratio": coverage_ratio,
        "alignment_strategy": alignment_strategy,
        "alignment_warning": alignment_warning,
        "fallback_reason": fallback_reason,
        "missing_expected_tokens": missing_expected,
        "matched_word_counts": {str(scene.index): len(matched_by_scene[scene.index]) for scene in scenes},
        "scene_first_word_starts": first_word_starts,
        "scene_boundary_starts": scene_starts,
        "scene_end_time": tail_end,
    }
    return scene_durations, debug


def durations_from_timeline_hints(
    scenes: list[Scene],
    last_hold_ms: int,
    total_voice_duration: float,
) -> tuple[list[float] | None, dict[str, Any] | None]:
    starts: list[float] = []
    ends: list[float] = []
    fallback_reason: str | None = None
    max_scene_duration = max(8.0, total_voice_duration * 0.35)
    max_gap_duration = 4.0
    max_end_time = total_voice_duration + max(1.5, last_hold_ms / 1000.0)

    for scene in scenes:
        if not scene.duration_hint or ":" not in scene.duration_hint:
            return None, None
        start_raw, end_raw = scene.duration_hint.split(":", 1)
        try:
            start = float(start_raw)
            end = float(end_raw)
        except ValueError:
            return None, None
        starts.append(start)
        ends.append(end)

    previous_start = None
    previous_end = None
    for index, (start, end) in enumerate(zip(starts, ends), start=1):
        if start < 0 or end <= start:
            fallback_reason = f"Visual {index} has invalid start/end timing ({start:.2f} → {end:.2f})."
            break
        if previous_start is not None and start < previous_start:
            fallback_reason = f"Visual {index} starts earlier than the prior visual, so XML timeline timing is not monotonic."
            break
        if previous_end is not None and end < previous_end:
            fallback_reason = f"Visual {index} ends earlier than the prior visual, so XML timeline timing is not monotonic."
            break
        if previous_end is not None and start - previous_end > max_gap_duration:
            fallback_reason = f"Visual {index} leaves an excessive gap ({start - previous_end:.2f}s) in the XML timeline."
            break
        if end - start > max_scene_duration:
            fallback_reason = f"Visual {index} duration ({end - start:.2f}s) is implausibly long for a caption chunk and likely reflects broken XML timing."
            break
        previous_start = start
        previous_end = end

    if fallback_reason is None and starts and starts[0] > 1.0:
        fallback_reason = f"The first XML timeline visual starts too late ({starts[0]:.2f}s) to trust as narration timing."
    if fallback_reason is None and ends and ends[-1] > max_end_time:
        fallback_reason = f"The XML timeline extends past the narration runtime ({ends[-1]:.2f}s vs {total_voice_duration:.2f}s audio)."

    if fallback_reason is not None:
        return None, {
            "alignment_strategy": "xml-timeline-rejected",
            "alignment_warning": (
                "XML timeline hints were rejected as unreliable, so the renderer fell back to forced-alignment-based timing."
            ),
            "fallback_reason": fallback_reason,
            "scene_boundary_starts": starts,
            "scene_end_time": ends[-1] + (last_hold_ms / 1000.0 if ends else 0),
            "matched_token_count": None,
            "expected_token_count": None,
            "coverage_ratio": None,
        }

    caption_active_durations: list[float] = []
    durations: list[float] = []
    final_visual_end = ends[-1]
    for index, (start, end) in enumerate(zip(starts, ends)):
        duration = max(MIN_SCENE_DURATION, end - start)
        caption_active_durations.append(duration)
        durations.append(duration)
    return durations, {
        "alignment_strategy": "xml-timeline",
        "alignment_warning": None,
        "fallback_reason": None,
        "scene_boundary_starts": starts,
        "scene_end_time": final_visual_end,
        "timeline_starts": starts,
        "timeline_ends": ends,
        "caption_active_durations": caption_active_durations,
        "matched_token_count": None,
        "expected_token_count": None,
        "coverage_ratio": None,
    }


def load_caption_sections(path_value: str | None) -> list[CaptionSection]:
    if not path_value:
        return []
    payload = json.loads(Path(path_value).expanduser().resolve().read_text(encoding="utf-8"))
    raw = payload.get("captions") if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        return []
    sections: list[CaptionSection] = []
    for index, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            continue
        text_value = str(item.get("text") or "").strip()
        try:
            start = float(item.get("start", 0.0))
            end = float(item.get("end", 0.0))
        except Exception:
            continue
        if not text_value or end <= start:
            continue
        sections.append(CaptionSection(index=index, text=text_value, start=start, end=end))
    return sections


def ass_timestamp(seconds: float) -> str:
    total = max(0.0, float(seconds))
    hours = int(total // 3600)
    minutes = int((total % 3600) // 60)
    secs = total - (hours * 3600) - (minutes * 60)
    return f"{hours}:{minutes:02d}:{secs:05.2f}"


def escape_ass_text(text: str) -> str:
    return text.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}").replace("\n", r"\N")


def normalize_hex_color(value: str | None, fallback: str) -> str:
    raw = str(value or "").strip().upper()
    if re.fullmatch(r"#[0-9A-F]{6}", raw):
        return raw
    return fallback


def ass_color(hex_color: str, *, alpha: float = 0.0) -> str:
    normalized = normalize_hex_color(hex_color, "#FFFFFF")
    alpha_byte = int(round(max(0.0, min(1.0, alpha)) * 255))
    red = int(normalized[1:3], 16)
    green = int(normalized[3:5], 16)
    blue = int(normalized[5:7], 16)
    return f"&H{alpha_byte:02X}{blue:02X}{green:02X}{red:02X}"


def sanitize_ass_style_text(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[\r\n,]", " ", str(value or "")).strip()
    return cleaned or fallback


def clamp_caption_font_size(value: Any, fallback: int = 72) -> int:
    try:
        parsed = int(round(float(value)))
    except Exception:
        parsed = fallback
    return max(24, min(160, parsed))


@dataclass
class CaptionStyleConfig:
    font_family: str
    font_size: int
    active_word_color: str
    spoken_word_color: str
    upcoming_word_color: str
    outline_color: str
    outline_width: float
    shadow_color: str
    shadow_strength: float
    background_enabled: bool
    background_color: str
    background_opacity: float
    background_padding: int
    background_radius: int
    animation_preset: str = "word-highlight"


def load_caption_style_config(raw_json: str | None, font_path: str) -> CaptionStyleConfig:
    payload: dict[str, Any] = {}
    if raw_json:
        try:
            parsed = json.loads(raw_json)
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            payload = {}
    fallback_font_family = sanitize_ass_style_text(Path(font_path).stem.replace("-", " "), "Arial")
    try:
        outline_width = float(payload.get("outlineWidth", 4))
    except Exception:
        outline_width = 4.0
    try:
        shadow_strength = float(payload.get("shadowStrength", 1))
    except Exception:
        shadow_strength = 1.0
    try:
        background_opacity = float(payload.get("backgroundOpacity", 0.45))
    except Exception:
        background_opacity = 0.45
    try:
        background_padding = int(round(float(payload.get("backgroundPadding", 20))))
    except Exception:
        background_padding = 20
    try:
        background_radius = int(round(float(payload.get("backgroundRadius", 24))))
    except Exception:
        background_radius = 24
    return CaptionStyleConfig(
        font_family=sanitize_ass_style_text(str(payload.get("fontFamily") or ""), fallback_font_family),
        font_size=clamp_caption_font_size(payload.get("fontSize", 72), 72),
        active_word_color=normalize_hex_color(payload.get("activeWordColor"), "#FFFFFF"),
        spoken_word_color=normalize_hex_color(payload.get("spokenWordColor"), "#D8D8D8"),
        upcoming_word_color=normalize_hex_color(payload.get("upcomingWordColor"), "#767676"),
        outline_color=normalize_hex_color(payload.get("outlineColor"), "#000000"),
        outline_width=max(0.0, min(12.0, outline_width)),
        shadow_color=normalize_hex_color(payload.get("shadowColor"), "#000000"),
        shadow_strength=max(0.0, min(8.0, shadow_strength)),
        background_enabled=bool(payload.get("backgroundEnabled", False)),
        background_color=normalize_hex_color(payload.get("backgroundColor"), "#000000"),
        background_opacity=max(0.0, min(1.0, background_opacity)),
        background_padding=max(0, min(96, background_padding)),
        background_radius=max(0, min(96, background_radius)),
        animation_preset="word-highlight",
    )


def align_caption_word_starts(caption: CaptionSection, aligned_words: list[AlignedWord], cursor: int) -> tuple[list[tuple[str, float]], int]:
    display_words = caption.text.split()
    if not display_words:
        return [], cursor

    known_starts: list[float | None] = [None] * len(display_words)
    next_cursor = cursor
    search_cursor = cursor

    for index, word in enumerate(display_words):
        norm = normalize_token(word)
        if not norm:
            continue
        found: int | None = None
        upper = min(len(aligned_words), search_cursor + max(DEFAULT_SCENE_LOOKAHEAD, len(display_words) * 4))
        for pos in range(search_cursor, upper):
            if relaxed_token_match(norm, aligned_words[pos].norm):
                found = pos
                break
        if found is None:
            upper = min(len(aligned_words), search_cursor + 96)
            for pos in range(search_cursor, upper):
                if relaxed_token_match(norm, aligned_words[pos].norm):
                    found = pos
                    break
        if found is None:
            continue
        known_starts[index] = aligned_words[found].start_time
        search_cursor = found + 1
        next_cursor = found + 1

    total_words = len(display_words)
    span_end = max(caption.end, caption.start + 0.08)
    resolved: list[float] = [caption.start] * total_words
    known_indices = [i for i, value in enumerate(known_starts) if value is not None]

    if not known_indices:
        step = max(0.08, (span_end - caption.start) / max(1, total_words))
        resolved = [caption.start + step * i for i in range(total_words)]
    else:
        first_known = known_indices[0]
        first_time = max(caption.start, min(span_end, float(known_starts[first_known] or caption.start)))
        for i in range(0, first_known + 1):
            fraction = 0.0 if first_known == 0 else (i / first_known)
            resolved[i] = caption.start + (first_time - caption.start) * fraction
        for left_idx, right_idx in zip(known_indices, known_indices[1:]):
            left_time = max(caption.start, min(span_end, float(known_starts[left_idx] or caption.start)))
            right_time = max(left_time, min(span_end, float(known_starts[right_idx] or span_end)))
            for i in range(left_idx, right_idx + 1):
                fraction = 0.0 if right_idx == left_idx else ((i - left_idx) / (right_idx - left_idx))
                resolved[i] = left_time + (right_time - left_time) * fraction
        last_known = known_indices[-1]
        last_time = max(caption.start, min(span_end, float(known_starts[last_known] or caption.start)))
        for i in range(last_known, total_words):
            fraction = 0.0 if total_words - 1 == last_known else ((i - last_known) / (total_words - 1 - last_known))
            resolved[i] = last_time + (span_end - last_time) * fraction

    resolved[0] = caption.start
    min_gap = 0.02
    for i in range(1, len(resolved)):
        resolved[i] = max(resolved[i], resolved[i - 1] + min_gap)
    if len(resolved) > 1 and resolved[-1] >= span_end:
        overflow = resolved[-1] - max(caption.start, span_end - min_gap)
        if overflow > 0:
            for i in range(len(resolved) - 1, 0, -1):
                resolved[i] = max(caption.start + min_gap * i, resolved[i] - overflow)
    resolved = [max(caption.start, min(span_end - 0.01, value)) for value in resolved]

    return list(zip(display_words, resolved)), next_cursor


def build_word_highlight_ass_text(words: list[str], active_index: int, style: CaptionStyleConfig) -> str:
    pieces: list[str] = []
    for index, word in enumerate(words):
        if index < active_index:
            color = style.spoken_word_color
            extra = r"\fscx100\fscy100"
        elif index == active_index:
            color = style.active_word_color
            extra = r"\fscx108\fscy108"
        else:
            color = style.upcoming_word_color
            extra = r"\fscx100\fscy100"
        pieces.append(f"{{\\1c{ass_color(color)}{extra}}}{escape_ass_text(word)}")
    return r"\h".join(pieces)


def write_ass_subtitles(
    captions: list[CaptionSection],
    alignment_payload: dict[str, Any],
    out_path: Path,
    style: CaptionStyleConfig,
) -> dict[str, Any]:
    aligned = alignment_words(alignment_payload)
    style_line = (
        "Style: Default,"
        f"{style.font_family},{style.font_size},"
        f"{ass_color(style.active_word_color)},{ass_color(style.spoken_word_color)},"
        f"{ass_color(style.outline_color)},{ass_color(style.background_color, alpha=(1.0 - style.background_opacity))},"
        f"-1,0,0,0,100,100,0,0,{3 if style.background_enabled else 1},"
        f"{style.outline_width:.1f},{style.shadow_strength:.1f},2,72,72,{max(120, 180 + style.background_padding)},1"
    )
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    event_count = 0
    alignment_cursor = 0
    for caption in captions:
        timed_words, alignment_cursor = align_caption_word_starts(caption, aligned, alignment_cursor)
        if not timed_words:
            lines.append(f"Dialogue: 0,{ass_timestamp(caption.start)},{ass_timestamp(caption.end)},Default,,0,0,0,,{escape_ass_text(caption.text)}\n")
            event_count += 1
            continue
        words = [word for word, _ in timed_words]
        starts = [start for _, start in timed_words]
        starts[0] = caption.start
        for idx, start in enumerate(starts):
            end = starts[idx + 1] if idx + 1 < len(starts) else caption.end
            end = max(start + 0.02, min(caption.end, end))
            if end <= start:
                continue
            text = build_word_highlight_ass_text(words, idx, style)
            lines.append(f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},Default,,0,0,0,,{text}\n")
            event_count += 1
    out_path.write_text("".join(lines), encoding="utf-8")
    return {
        "ass_path": str(out_path),
        "style": {
            "font_family": style.font_family,
            "font_size": style.font_size,
            "active_word_color": style.active_word_color,
            "spoken_word_color": style.spoken_word_color,
            "upcoming_word_color": style.upcoming_word_color,
            "outline_color": style.outline_color,
            "outline_width": style.outline_width,
            "shadow_color": style.shadow_color,
            "shadow_strength": style.shadow_strength,
            "background_enabled": style.background_enabled,
            "background_color": style.background_color,
            "background_opacity": style.background_opacity,
            "background_padding": style.background_padding,
            "background_radius": style.background_radius,
            "animation_preset": style.animation_preset,
        },
        "event_count": event_count,
    }


def burn_ass_subtitles(video_path: Path, ass_path: Path, out_path: Path, fonts_dir: str | None = None) -> None:
    ensure_dir(out_path.parent)
    filter_value = f"subtitles={ass_path}"
    if fonts_dir:
        filter_value += f":fontsdir={fonts_dir}"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vf",
            filter_value,
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
    )

def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def resolve_zoom_value(value: float | None, fallback: float, *, allow_absolute: bool = True) -> tuple[float, str]:
    if value is None:
        return fallback, "implicit"
    normalized = max(0.0, value)
    if allow_absolute and normalized >= 1.0:
        return normalized, "absolute"
    return 1.0 + normalized, "delta"


def motion_params(scene: Scene, duration: float) -> tuple[str, str, str, dict[str, Any]]:
    safe_duration = max(duration, 0.01)

    if not scene.camera_motion.is_explicit():
        return "(in_w-out_w)/2", "(in_h-out_h)/2", "1.0000", {
            "mode": "static-no-motion",
            "start_zoom": 1.0,
            "end_zoom": 1.0,
            "pan_x": 0.0,
            "pan_y": 0.0,
            "zoom": 0.0,
            "zoom_start": 0.0,
            "zoom_end": 0.0,
            "zoom_animation": False,
            "shake": 0.0,
        }

    pan_x = clamp(scene.camera_motion.pan_x or 0.0, -1.0, 1.0)
    pan_y = clamp(scene.camera_motion.pan_y or 0.0, -1.0, 1.0)
    static_zoom_input = max(0.0, scene.camera_motion.zoom or 0.0)
    explicit_zoom_animation = scene.camera_motion.zoom_start is not None or scene.camera_motion.zoom_end is not None
    static_zoom, static_zoom_semantics = resolve_zoom_value(scene.camera_motion.zoom, 1.0)
    start_zoom, zoom_start_semantics = resolve_zoom_value(
        scene.camera_motion.zoom_start,
        static_zoom,
    )
    end_zoom, zoom_end_semantics = resolve_zoom_value(
        scene.camera_motion.zoom_end,
        static_zoom,
    )
    shake = clamp(max(0.0, scene.camera_motion.shake or 0.0), 0.0, 1.0)

    max_zoom_gain = max(0.0, static_zoom - 1.0, start_zoom - 1.0, end_zoom - 1.0)
    base_buffer = min(0.35, max(abs(pan_x), abs(pan_y)) * 0.18 + shake * 0.10 + max_zoom_gain * 0.35)
    start_zoom += base_buffer
    end_zoom += base_buffer
    if explicit_zoom_animation:
        zoom_expr = f"{start_zoom:.4f}+{(end_zoom - start_zoom):.4f}*t/{safe_duration:.3f}"
        motion_mode = "xml-explicit-animated-zoom"
    else:
        zoom_expr = f"{start_zoom:.4f}"
        motion_mode = "xml-explicit-static-zoom"

    drift_x = f"(({pan_x:.4f})*0.92*(in_w-out_w)/2)*(t/{safe_duration:.3f})"
    drift_y = f"(({pan_y:.4f})*0.92*(in_h-out_h)/2)*(t/{safe_duration:.3f})"
    shake_x = ""
    shake_y = ""
    if shake > 0:
        shake_x = (
            f" + (({shake:.4f})*0.18*(in_w-out_w)/2)*sin(6.2831853*1.7*t)"
            f" + (({shake:.4f})*0.09*(in_w-out_w)/2)*sin(6.2831853*4.3*t+0.7)"
        )
        shake_y = (
            f" + (({shake:.4f})*0.16*(in_h-out_h)/2)*sin(6.2831853*1.3*t+1.2)"
            f" + (({shake:.4f})*0.08*(in_h-out_h)/2)*sin(6.2831853*3.7*t+0.2)"
        )

    xexpr = f"max(0,min(in_w-out_w,(in_w-out_w)/2 + {drift_x}{shake_x}))"
    yexpr = f"max(0,min(in_h-out_h,(in_h-out_h)/2 + {drift_y}{shake_y}))"
    return xexpr, yexpr, zoom_expr, {
        "mode": motion_mode,
        "pan_x": pan_x,
        "pan_y": pan_y,
        "zoom": static_zoom_input,
        "zoom_start": scene.camera_motion.zoom_start if scene.camera_motion.zoom_start is not None else static_zoom_input,
        "zoom_end": scene.camera_motion.zoom_end if scene.camera_motion.zoom_end is not None else static_zoom_input,
        "zoom_animation": explicit_zoom_animation,
        "shake": shake,
        "start_zoom": start_zoom,
        "end_zoom": end_zoom,
        "zoom_semantics": {
            "zoom": static_zoom_semantics,
            "zoom_start": zoom_start_semantics,
            "zoom_end": zoom_end_semantics,
        },
    }


def create_motion_scene(src: Path, duration: float, out_path: Path, scene: Scene, fps: int) -> dict[str, Any]:
    xexpr, yexpr, zoom, motion_meta = motion_params(scene, duration)
    normalize_vf = vertical_frame_normalize_filter()
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(src),
    ]
    if motion_meta["zoom_animation"]:
        total_frames = max(1, int(round(duration * fps)))
        progress_den = max(total_frames - 1, 1)
        progress_expr = f"(on/{progress_den})"
        time_expr = f"(on/{fps:.3f})"
        zoom = f"{motion_meta['start_zoom']:.4f}+{(motion_meta['end_zoom'] - motion_meta['start_zoom']):.4f}*{progress_expr}"

        width_delta = "(iw-iw/zoom)"
        height_delta = "(ih-ih/zoom)"
        drift_x = f"(({motion_meta['pan_x']:.4f})*0.92*({width_delta})/2)*{progress_expr}"
        drift_y = f"(({motion_meta['pan_y']:.4f})*0.92*({height_delta})/2)*{progress_expr}"
        shake_x = ""
        shake_y = ""
        if motion_meta["shake"] > 0:
            shake_x = (
                f" + (({motion_meta['shake']:.4f})*0.18*({width_delta})/2)*sin(6.2831853*1.7*{time_expr})"
                f" + (({motion_meta['shake']:.4f})*0.09*({width_delta})/2)*sin(6.2831853*4.3*{time_expr}+0.7)"
            )
            shake_y = (
                f" + (({motion_meta['shake']:.4f})*0.16*({height_delta})/2)*sin(6.2831853*1.3*{time_expr}+1.2)"
                f" + (({motion_meta['shake']:.4f})*0.08*({height_delta})/2)*sin(6.2831853*3.7*{time_expr}+0.2)"
            )
        xexpr = f"max(0,min({width_delta},({width_delta})/2 + {drift_x}{shake_x}))"
        yexpr = f"max(0,min({height_delta},({height_delta})/2 + {drift_y}{shake_y}))"
        vf = (
            f"{normalize_vf},"
            f"scale=w=iw*{ANIMATED_ZOOM_SUPERSAMPLE}:h=ih*{ANIMATED_ZOOM_SUPERSAMPLE}:flags=lanczos,"
            f"zoompan=z='{zoom}':x='{xexpr}':y='{yexpr}':d=1:s={FRAME_WIDTH}x{FRAME_HEIGHT}:fps={fps},"
            f"fps={fps},format=yuv420p"
        )
        ffmpeg_cmd[4:4] = ["-framerate", str(fps)]
    else:
        vf = (
            f"{normalize_vf},"
            f"scale=w='trunc({FRAME_WIDTH}*({zoom})/2)*2':h='trunc({FRAME_HEIGHT}*({zoom})/2)*2':eval=frame,"
            f"crop={FRAME_WIDTH}:{FRAME_HEIGHT}:x='{xexpr}':y='{yexpr}',fps={fps},format=yuv420p"
        )

    ffmpeg_cmd.extend(
        [
            "-vf",
            vf,
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
    )
    run(ffmpeg_cmd, quiet=True)
    return {
        **motion_meta,
        "x_expression": xexpr,
        "y_expression": yexpr,
        "zoom_expression": zoom,
    }



def overlay_caption(video_path: Path, overlay_path: Path, out_path: Path, caption_duration: float | None = None) -> None:
    overlay_filter = "[0:v][1:v]overlay=0:0:shortest=1[v]"
    if caption_duration is not None:
        safe_duration = max(0.0, caption_duration)
        overlay_filter = f"[0:v][1:v]overlay=0:0:enable='between(t,0,{safe_duration:.3f})':shortest=1[v]"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-loop",
            "1",
            "-i",
            str(overlay_path),
            "-filter_complex",
            overlay_filter,
            "-map",
            "[v]",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_path),
        ],
        quiet=True,
    )


def concat_videos(paths: list[Path], output: Path) -> None:
    list_path = output.parent / "concat-videos.txt"
    list_path.write_text("".join(f"file '{p}'\n" for p in paths), encoding="utf-8")
    run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_path), "-c", "copy", str(output)],
        quiet=True,
    )


def pad_video_tail(video_path: Path, target_duration: float) -> None:
    current_duration = ffprobe_duration(video_path)
    pad_seconds = target_duration - current_duration
    if pad_seconds <= (1 / 30.0):
        return
    padded_path = video_path.with_name(video_path.stem + "-padded" + video_path.suffix)
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vf",
            f"tpad=stop_mode=clone:stop_duration={pad_seconds:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(padded_path),
        ],
        quiet=True,
    )
    padded_path.replace(video_path)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate a finished short-form video from XML + scene images.")
    p.add_argument("--xml", required=True)
    p.add_argument("--images-dir", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--work-dir")
    p.add_argument("--music")
    p.add_argument("--music-prompt", default=DEFAULT_MUSIC_PROMPT)
    p.add_argument("--music-volume", type=float, default=DEFAULT_MUSIC_VOLUME)
    p.add_argument("--no-music", action="store_true")
    p.add_argument("--music-thinking", action="store_true")
    p.add_argument("--ace-step-url", default=DEFAULT_ACESTEP_URL)
    p.add_argument("--font-path", default=DEFAULT_FONT)
    p.add_argument("--tts-engine", choices=["qwen", "say"], default=DEFAULT_TTS_ENGINE)
    p.add_argument("--tts-voice", default=DEFAULT_TTS_VOICE)
    p.add_argument("--tts-rate", type=int, default=DEFAULT_TTS_RATE)
    p.add_argument("--qwen-mode", choices=["custom-voice", "voice-design"], default="custom-voice")
    p.add_argument("--voice-speaker", default=DEFAULT_VOICE_SPEAKER)
    p.add_argument("--voice-instruct", default=DEFAULT_VOICE_INSTRUCT)
    p.add_argument("--asr-language", default=DEFAULT_ASR_LANGUAGE)
    p.add_argument("--last-hold-ms", type=int, default=650)
    p.add_argument("--fps", type=int, default=DEFAULT_FPS)
    p.add_argument("--existing-voice")
    p.add_argument("--existing-alignment")
    p.add_argument("--captions-json")
    p.add_argument("--caption-style-json")
    p.add_argument(
        "--burn-in-captions",
        action="store_true",
        help="Opt in to legacy ASS subtitle burn-in. By default this script renders a caption-free base video so callers can apply their own caption layer.",
    )
    p.add_argument("--force", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    xml_path = Path(args.xml).expanduser().resolve()
    images_dir = Path(args.images_dir).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    work_dir = Path(args.work_dir).expanduser().resolve() if args.work_dir else output.parent / (output.stem + "-artifacts")
    ensure_dir(work_dir)
    ensure_dir(output.parent)

    topic, xml_full_script, scenes = parse_xml(xml_path)

    voice_dir = work_dir / "voice"
    overlay_dir = work_dir / "caption-overlays"
    motion_dir = work_dir / "motion-scenes"
    captioned_dir = motion_dir / "captioned-scenes"
    music_dir = work_dir / "music"
    alignment_dir = work_dir / "alignment"
    for d in [voice_dir, overlay_dir, motion_dir, captioned_dir, music_dir, alignment_dir]:
        ensure_dir(d)

    removed_stale_motion_graphic_videos = cleanup_stale_motion_graphic_videos(images_dir, scenes)

    image_inputs: list[Path] = []
    for scene in scenes:
        image_inputs.append(scene_image(images_dir, scene.index))

    scene_transcript, full_script = build_narration_transcript(scenes, xml_full_script)
    script_path = voice_dir / "voiceover-script.txt"
    script_path.write_text(full_script + "\n", encoding="utf-8")
    scene_transcript_path = voice_dir / "scene-transcript.json"
    scene_transcript_path.write_text(json.dumps({"scenes": scene_transcript}, indent=2), encoding="utf-8")

    combined_voice = Path(args.existing_voice).expanduser().resolve() if args.existing_voice else (voice_dir / "voiceover-full.wav")
    if not args.existing_voice:
        generate_full_voice(
            full_script,
            combined_voice,
            args.tts_engine,
            args.tts_voice,
            args.tts_rate,
            args.qwen_mode,
            args.voice_speaker,
            args.voice_instruct,
            args.force,
        )

    alignment_input_path = alignment_dir / "alignment-input.json"
    alignment_input_path.write_text(
        json.dumps(
            {
                "audio": str(combined_voice),
                "language": args.asr_language,
                "text": full_script,
                "text_source": "xml-script" if xml_full_script else "scene-captions-fallback",
                "scene_transcript": scene_transcript,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    alignment_json = Path(args.existing_alignment).expanduser().resolve() if args.existing_alignment else (alignment_dir / "word-timestamps.json")
    alignment_payload = json.loads(alignment_json.read_text(encoding="utf-8")) if args.existing_alignment else force_align_audio(combined_voice, alignment_json, args.asr_language, script_path, args.force)
    caption_sections = load_caption_sections(args.captions_json)
    caption_style = load_caption_style_config(args.caption_style_json, args.font_path)
    total_voice_duration = ffprobe_duration(combined_voice)
    hinted_durations, hinted_debug = durations_from_timeline_hints(scenes, args.last_hold_ms, total_voice_duration)
    if hinted_durations is not None and hinted_debug is not None:
        scene_durations, timing_debug = hinted_durations, hinted_debug
    else:
        even_duration = max(MIN_SCENE_DURATION, (total_voice_duration + (args.last_hold_ms / 1000.0)) / max(1, len(scenes)))
        scene_durations = [even_duration for _ in scenes]
        timing_debug = {
            "alignment_strategy": "even-visual-fallback",
            "alignment_warning": "Visual XML had no reliable start/end hints; durations were distributed evenly across the narration.",
        }

    caption_active_durations = [max(0.0, caption.end - caption.start) for caption in caption_sections]
    caption_burn_in_enabled = bool(args.burn_in_captions and caption_sections)

    total_seconds = sum(scene_durations)

    manifest = {
        "schema_version": "2026-06-full-frame-visuals-v1",
        "topic": topic,
        "xml": str(xml_path),
        "images_dir": str(images_dir),
        "work_dir": str(work_dir),
        "output": str(output),
        "tts_engine": args.tts_engine,
        "voice_source": "existing-artifact" if args.existing_voice else "generated-during-final-video",
        "alignment_source": "existing-artifact" if args.existing_alignment else "generated-during-final-video",
        "tts_voice": args.tts_voice if args.tts_engine == "say" else (args.voice_speaker if args.qwen_mode == "custom-voice" and not args.existing_voice else None),
        "tts_rate": args.tts_rate if args.tts_engine == "say" else None,
        "qwen_mode": args.qwen_mode if args.tts_engine == "qwen" and not args.existing_voice else None,
        "voice_instruct": args.voice_instruct if args.tts_engine == "qwen" and not args.existing_voice else None,
        "asr_language": args.asr_language,
        "timing_source": timing_debug.get("alignment_strategy") if isinstance(timing_debug, dict) and timing_debug.get("alignment_strategy") else "qwen-forced-aligner",
        "text_source": "xml-script" if xml_full_script else "scene-captions-fallback",
        "full_script": str(script_path),
        "scene_transcript_json": str(scene_transcript_path),
        "combined_voice": str(combined_voice),
        "voice_duration": total_voice_duration,
        "alignment_input_json": str(alignment_input_path),
        "alignment_json": str(alignment_json),
        "alignment": timing_debug,
        "scene_durations": scene_durations,
        "caption_active_durations": caption_active_durations,
        "captions_json": str(Path(args.captions_json).expanduser().resolve()) if args.captions_json else None,
        "caption_sections": [{"index": c.index, "text": c.text, "start": c.start, "end": c.end} for c in caption_sections],
        "caption_burn_in_requested": bool(args.burn_in_captions),
        "caption_burn_in_enabled": caption_burn_in_enabled,
        "caption_burn_in_reason": (
            "enabled by --burn-in-captions"
            if caption_burn_in_enabled
            else (
                "captions-json was provided, but ASS burn-in is disabled so the base render stays caption-free"
                if caption_sections
                else "no caption sections were provided"
            )
        ),
        "caption_style": {
            "font_family": caption_style.font_family,
            "font_size": caption_style.font_size,
            "active_word_color": caption_style.active_word_color,
            "spoken_word_color": caption_style.spoken_word_color,
            "upcoming_word_color": caption_style.upcoming_word_color,
            "outline_color": caption_style.outline_color,
            "outline_width": caption_style.outline_width,
            "shadow_color": caption_style.shadow_color,
            "shadow_strength": caption_style.shadow_strength,
            "background_enabled": caption_style.background_enabled,
            "background_color": caption_style.background_color,
            "background_opacity": caption_style.background_opacity,
            "background_padding": caption_style.background_padding,
            "background_radius": caption_style.background_radius,
            "animation_preset": caption_style.animation_preset,
        },
        "scenes": [
            {
                "index": s.index,
                "text": s.text,
                "image": str(img),
                "visual_type": s.visual_type,
                "motion_graphic_source_video": str(scene_motion_graphic_video(images_dir, s)) if scene_motion_graphic_video(images_dir, s) else None,
                "motion_video": str(motion_dir / f"scene-{s.index:02d}.mp4"),
                "background_composite_video": str(motion_dir / f"scene-{s.index:02d}-composited.mp4"),
                "duration": dur,
                "reference_previous_scene_image": s.reference_previous_scene_image,
                "camera_motion": s.camera_motion.as_manifest(),
            }
            for s, img, dur in zip(scenes, image_inputs, scene_durations)
        ],
        "stale_motion_graphic_videos_removed": removed_stale_motion_graphic_videos,
        "pipeline_stage": "timing-derived",
    }
    (work_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    scene_videos: list[Path] = []
    current_time = 0.0
    for scene, img, dur in zip(scenes, image_inputs, scene_durations):
        motion_graphic_src = scene_motion_graphic_video(images_dir, scene)
        motion = motion_dir / f"scene-{scene.index:02d}.mp4"
        if motion_graphic_src:
            motion_meta = normalize_motion_graphic_video(motion_graphic_src, dur, motion, args.fps)
        else:
            motion_meta = create_motion_scene(img, dur, motion, scene, args.fps)
        scene_videos.append(motion)

        for manifest_scene in manifest["scenes"]:
            if manifest_scene.get("index") == scene.index:
                manifest_scene["applied_motion"] = motion_meta
                manifest_scene["scene_start"] = round(current_time, 3)
                manifest_scene["scene_end"] = round(current_time + dur, 3)
                if motion_graphic_src:
                    manifest_scene["visual_type"] = "motion_graphic"
                    manifest_scene["final_video_input"] = str(motion_graphic_src)
                break
        current_time += dur

    visual_only = motion_dir / "visual-only.mp4"
    concat_videos(scene_videos, visual_only)
    pad_video_tail(visual_only, max(total_seconds, total_voice_duration))

    subtitled_visual = visual_only
    if caption_burn_in_enabled:
        subtitled_visual = motion_dir / "visual-with-captions.mp4"
        ass_path = work_dir / "captions.ass"
        ass_manifest = write_ass_subtitles(caption_sections, alignment_payload, ass_path, caption_style)
        burn_ass_subtitles(
            visual_only,
            ass_path,
            subtitled_visual,
            str(Path(args.font_path).expanduser().resolve().parent) if args.font_path else None,
        )
        manifest["caption_ass"] = ass_manifest

    total_seconds = sum(scene_durations)
    music_path = None
    ace_step_log = music_dir / "ace-step-server.log"

    if args.no_music:
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(subtitled_visual),
                "-i",
                str(combined_voice),
                "-filter_complex",
                "[1:a]loudnorm=I=-16:TP=-1.5:LRA=7,highpass=f=70,lowpass=f=9000,alimiter=limit=0.95[a]",
                "-map",
                "0:v",
                "-map",
                "[a]",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                "-shortest",
                str(output),
            ]
        )
    else:
        music_path = Path(args.music).expanduser().resolve() if args.music else music_dir / "background-music-ace-step.wav"
        if not music_path.exists() or (music_path == music_dir / "background-music-ace-step.wav" and args.force):
            requested_music_seconds = math.ceil(total_seconds) + DEFAULT_MUSIC_PAD_SECONDS
            generated_music_seconds = max(10, min(requested_music_seconds, DEFAULT_ACESTEP_GENERATED_LOOP_SECONDS))
            if args.music:
                raise SystemExit(f"Music file not found: {music_path}")
            if generated_music_seconds < requested_music_seconds:
                print(
                    "ACE-Step music generation capped "
                    f"from {requested_music_seconds}s to {generated_music_seconds}s; "
                    "the final mix loops and trims the track to full video length.",
                    flush=True,
                )
            music_path, ace_step_log = generate_music_with_ace_step(
                output=music_path,
                seconds=generated_music_seconds,
                prompt=args.music_prompt,
                base_url=args.ace_step_url,
                work_dir=music_dir,
                thinking=args.music_thinking,
                force=args.force,
            )

        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(subtitled_visual),
                "-i",
                str(combined_voice),
                "-stream_loop",
                "-1",
                "-i",
                str(music_path),
                "-filter_complex",
                (
                    f"[1:a]loudnorm=I=-16:TP=-1.5:LRA=7,highpass=f=70,lowpass=f=9000,alimiter=limit=0.95,asplit=2[vo_sc][vo_mix];"
                    f"[2:a]atrim=0:{total_seconds:.3f},afade=t=in:st=0:d=1.2,"
                    f"afade=t=out:st={max(1, total_seconds - 2.2):.3f}:d=2.0,"
                    f"highpass=f=40,lowpass=f=12000,volume={args.music_volume:.3f}[m0];"
                    f"[m0][vo_sc]sidechaincompress=threshold=0.032:ratio=6:attack=12:release=260:makeup=2[m];"
                    f"[vo_mix][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]"
                ),
                "-map",
                "0:v",
                "-map",
                "[a]",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                "-shortest",
                str(output),
            ]
        )

    manifest.update(
        {
            "music": None if args.no_music else str(music_path),
            "music_prompt": None if args.no_music or args.music else args.music_prompt,
            "music_volume": None if args.no_music else args.music_volume,
            "music_requested_seconds": None if args.no_music or args.music else math.ceil(total_seconds) + DEFAULT_MUSIC_PAD_SECONDS,
            "music_generated_seconds": None if args.no_music or args.music else max(10, min(math.ceil(total_seconds) + DEFAULT_MUSIC_PAD_SECONDS, DEFAULT_ACESTEP_GENERATED_LOOP_SECONDS)),
            "ace_step_url": args.ace_step_url if not args.no_music and not args.music else None,
            "ace_step_log": str(ace_step_log) if ace_step_log else None,
            "visual_only": str(visual_only),
            "subtitled_visual": str(subtitled_visual),
            "pipeline_stage": "completed",
        }
    )
    (work_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"DONE: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
