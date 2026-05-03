#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


HOME_DIR = Path(os.environ.get("HOME", str(Path.home()))).expanduser()
LEGACY_NANO_BANANA_SCRIPT = (
    HOME_DIR
    / ".openclaw"
    / "workspace"
    / "skills"
    / "nano-banana-openrouter"
    / "scripts"
    / "generate_image.py"
)
NANO_BANANA_MODELS = {"google/gemini-3-pro-image-preview"}
OPENAI_CODEX_OAUTH_ONLY_MODELS = {"openai/gpt-image-2", "openai/gpt-image-1.5"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*m")
TARGET_SCENE_WIDTH = 1080
TARGET_SCENE_HEIGHT = 1920
SCENE_CANVAS_NAME_RE = re.compile(r"^scene-\d+-(?:uncaptioned|captioned)-1080x1920$")
SAFE_AGENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
API_KEY_BILLING_OPT_IN_ENV = "SHORT_FORM_ALLOW_OPENAI_API_KEY_BILLING"
OPENCLAW_IMAGE_TIMEOUT_ENV = "SHORT_FORM_OPENCLAW_IMAGE_TIMEOUT_MS"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Route dashboard image generation to Nano Banana or OpenClaw infer image generation.",
    )
    parser.add_argument("--prompt", "-p", required=True)
    parser.add_argument("--filename", "-f", required=True)
    parser.add_argument(
        "--input-image",
        "-i",
        action="append",
        dest="input_images",
        default=[],
    )
    parser.add_argument("--resolution", "-r", default="1K")
    parser.add_argument("--aspect-ratio", "-a", default="1:1")
    parser.add_argument("--model", "-m", required=True)
    return parser.parse_args()


def should_normalize_scene_canvas(path: Path) -> bool:
    return SCENE_CANVAS_NAME_RE.match(path.stem) is not None


def image_dimensions(path: Path) -> tuple[int, int] | None:
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None

    width: int | None = None
    height: int | None = None
    for line in result.stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith("pixelWidth:"):
            width = int(stripped.split(":", 1)[1].strip())
        elif stripped.startswith("pixelHeight:"):
            height = int(stripped.split(":", 1)[1].strip())
    if width is None or height is None:
        return None
    return width, height


def run_sips(command: list[str]) -> None:
    subprocess.run(command, check=True, capture_output=True, text=True)


def normalize_scene_canvas(path: Path) -> bool:
    if not should_normalize_scene_canvas(path):
        return False

    dimensions = image_dimensions(path)
    if dimensions == (TARGET_SCENE_WIDTH, TARGET_SCENE_HEIGHT):
        return False
    if dimensions is None:
        print(f"WARN: unable to inspect generated image dimensions for {path}; skipping scene canvas normalization.", file=sys.stderr)
        return False

    width, height = dimensions
    if width <= 0 or height <= 0:
        print(f"WARN: invalid generated image dimensions for {path}: {width}x{height}.", file=sys.stderr)
        return False

    tmp_path = path.with_name(f".{path.stem}.normalized-tmp{path.suffix}")
    shutil.copy2(path, tmp_path)
    try:
        scale_by_width = (TARGET_SCENE_WIDTH / width) >= (TARGET_SCENE_HEIGHT / height)
        if scale_by_width:
            run_sips(["sips", "--resampleWidth", str(TARGET_SCENE_WIDTH), str(tmp_path)])
        else:
            run_sips(["sips", "--resampleHeight", str(TARGET_SCENE_HEIGHT), str(tmp_path)])
        run_sips(["sips", "--cropToHeightWidth", str(TARGET_SCENE_HEIGHT), str(TARGET_SCENE_WIDTH), str(tmp_path)])
        normalized_dimensions = image_dimensions(tmp_path)
        if normalized_dimensions != (TARGET_SCENE_WIDTH, TARGET_SCENE_HEIGHT):
            raise RuntimeError(f"sips normalization produced {normalized_dimensions}, expected {TARGET_SCENE_WIDTH}x{TARGET_SCENE_HEIGHT}")
        tmp_path.replace(path)
    except Exception:
        try:
            tmp_path.unlink(missing_ok=True)
        finally:
            raise

    print(f"Normalized scene canvas: {path} -> {TARGET_SCENE_WIDTH}x{TARGET_SCENE_HEIGHT}")
    return True


def build_openclaw_size_hint(
    resolution: str | None,
    aspect_ratio: str | None,
) -> str | None:
    normalized_resolution = (resolution or "").strip().upper()
    normalized_aspect_ratio = (aspect_ratio or "").strip()
    return {
        ("1K", "1:1"): "1024x1024",
        ("1K", "16:9"): "1536x1024",
        ("1K", "9:16"): "1024x1536",
        ("4K", "1:1"): "2048x2048",
        ("4K", "16:9"): "3840x2160",
        ("4K", "9:16"): "2160x3840",
    }.get((normalized_resolution, normalized_aspect_ratio))


def run_legacy_nano_banana(args: argparse.Namespace) -> int:
    command = [
        "uv",
        "run",
        str(LEGACY_NANO_BANANA_SCRIPT),
        "--prompt",
        args.prompt,
        "--filename",
        args.filename,
        "--resolution",
        args.resolution,
        "--aspect-ratio",
        args.aspect_ratio,
        "--model",
        args.model,
    ]
    for input_image in args.input_images:
        command.extend(["-i", input_image])
    result = subprocess.call(command)
    if result == 0:
        normalize_scene_canvas(Path(args.filename).expanduser().resolve())
    return result


def truthy_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def is_codex_oauth_only_openai_model(model: str) -> bool:
    return model.strip().lower() in OPENAI_CODEX_OAUTH_ONLY_MODELS


def load_json_file(path: Path) -> dict[str, Any] | None:
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else None
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Unable to parse JSON config at {path}: {exc}") from exc


def resolve_default_agent_id() -> str:
    config_path = Path(os.environ.get("OPENCLAW_CONFIG_PATH", HOME_DIR / ".openclaw" / "openclaw.json")).expanduser()
    config = load_json_file(config_path) or {}
    agents = config.get("agents") if isinstance(config.get("agents"), dict) else {}
    agent_list = agents.get("list") if isinstance(agents.get("list"), list) else []
    first_agent_id: str | None = None
    for entry in agent_list:
        if not isinstance(entry, dict):
            continue
        agent_id = entry.get("id")
        if not isinstance(agent_id, str) or not SAFE_AGENT_ID_RE.match(agent_id):
            continue
        first_agent_id = first_agent_id or agent_id
        if entry.get("default") is True:
            return agent_id
    return first_agent_id or "main"


def agent_has_codex_oauth_profile(agent_id: str) -> bool:
    if not SAFE_AGENT_ID_RE.match(agent_id):
        return False
    auth_path = HOME_DIR / ".openclaw" / "agents" / agent_id / "agent" / "auth-profiles.json"
    store = load_json_file(auth_path) or {}
    profiles = store.get("profiles") if isinstance(store.get("profiles"), dict) else {}
    for credential in profiles.values():
        if not isinstance(credential, dict):
            continue
        if credential.get("provider") == "openai-codex" and credential.get("type") == "oauth":
            return True
    return False


def build_codex_oauth_only_config(args: argparse.Namespace, agent_id: str) -> dict[str, Any]:
    timeout_ms = os.environ.get(OPENCLAW_IMAGE_TIMEOUT_ENV, "300000")
    return {
        "agents": {
            "list": [{"id": agent_id, "default": True}],
            "defaults": {
                "imageGenerationModel": {
                    "primary": args.model,
                    "timeoutMs": int(timeout_ms) if timeout_ms.isdigit() else 300000,
                },
                "mediaGenerationAutoProviderFallback": False,
            },
        },
    }


def prepare_openclaw_image_env(args: argparse.Namespace) -> tuple[dict[str, str], tempfile.TemporaryDirectory[str] | None]:
    env = os.environ.copy()
    if not is_codex_oauth_only_openai_model(args.model):
        return env, None

    if truthy_env(API_KEY_BILLING_OPT_IN_ENV):
        print(
            f"WARN: {API_KEY_BILLING_OPT_IN_ENV}=1; direct OpenAI API-key image billing is allowed for this run.",
            file=sys.stderr,
        )
        return env, None

    agent_id = resolve_default_agent_id()
    if not agent_has_codex_oauth_profile(agent_id):
        raise RuntimeError(
            f"Refusing to generate {args.model}: dashboard image generation defaults to Codex OAuth/subscription only, "
            f"but no OpenAI Codex OAuth profile is available for OpenClaw agent '{agent_id}'. "
            "A direct fallback would use OPENAI_API_KEY/CODEX_API_KEY and bill API usage. "
            f"Sign in with OpenAI Codex OAuth or set {API_KEY_BILLING_OPT_IN_ENV}=1 to explicitly allow API-key billing."
        )

    temp_dir = tempfile.TemporaryDirectory(prefix="short-form-openclaw-oauth-only-")
    config_path = Path(temp_dir.name) / "openclaw-oauth-only.json"
    config_path.write_text(
        json.dumps(build_codex_oauth_only_config(args, agent_id), indent=2) + "\n",
        encoding="utf-8",
    )
    config_path.chmod(0o600)

    env["OPENCLAW_CONFIG_PATH"] = str(config_path)
    env.pop("OPENAI_API_KEY", None)
    env.pop("CODEX_API_KEY", None)
    print(
        f"Using OpenClaw Codex OAuth-only image generation for {args.model}; OPENAI_API_KEY/CODEX_API_KEY are not passed to the child process.",
        file=sys.stderr,
    )
    return env, temp_dir


def strip_ansi(value: str) -> str:
    return ANSI_ESCAPE_RE.sub("", value)


def parse_openclaw_json(stdout: str) -> Any:
    cleaned = strip_ansi(stdout).strip()
    if not cleaned:
        return None
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start_index = cleaned.find("{")
    end_index = cleaned.rfind("}")
    if start_index != -1 and end_index > start_index:
        try:
            return json.loads(cleaned[start_index : end_index + 1])
        except json.JSONDecodeError:
            return None
    return None


def collect_candidate_paths(value: Any) -> list[Path]:
    candidates: list[Path] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for child in node.values():
                visit(child)
            return
        if isinstance(node, list):
            for child in node:
                visit(child)
            return
        if not isinstance(node, str):
            return

        candidate = Path(node).expanduser()
        suffix = candidate.suffix.lower()
        if suffix not in IMAGE_EXTENSIONS:
            return
        if candidate.is_absolute() or candidate.exists():
            candidates.append(candidate.resolve())

    visit(value)
    return candidates


def resolve_output_path(requested_output: Path, json_payload: Any) -> Path | None:
    candidates: list[Path] = []
    if requested_output.exists():
        candidates.append(requested_output)

    candidates.extend(collect_candidate_paths(json_payload))
    candidates.extend(
        sorted(
            path.resolve()
            for path in requested_output.parent.glob(f"{requested_output.stem}*")
            if path.suffix.lower() in IMAGE_EXTENSIONS and path.is_file()
        )
    )

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.exists() and resolved.is_file():
            return resolved
    return None


def find_openclaw_bin() -> str:
    for candidate in (
        os.environ.get("OPENCLAW_BIN"),
        "/opt/homebrew/bin/openclaw",
        "/usr/local/bin/openclaw",
        shutil.which("openclaw"),
    ):
        if candidate and Path(candidate).exists():
            return str(candidate)
    return "openclaw"


def run_openclaw_infer(args: argparse.Namespace) -> int:
    requested_output = Path(args.filename).expanduser().resolve()
    requested_output.parent.mkdir(parents=True, exist_ok=True)

    try:
        env, temp_config_dir = prepare_openclaw_image_env(args)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    is_edit = len(args.input_images) > 0
    command = [
        find_openclaw_bin(),
        "infer",
        "image",
        "edit" if is_edit else "generate",
        "--model",
        args.model,
        "--prompt",
        args.prompt,
        "--output",
        str(requested_output),
        "--output-format",
        "png",
        "--timeout-ms",
        os.environ.get(OPENCLAW_IMAGE_TIMEOUT_ENV, "300000"),
        "--json",
    ]

    if args.resolution:
        command.extend(["--resolution", args.resolution])
    if args.aspect_ratio:
        command.extend(["--aspect-ratio", args.aspect_ratio])

    size_hint = build_openclaw_size_hint(args.resolution, args.aspect_ratio)
    if size_hint:
        command.extend(["--size", size_hint])

    for input_image in args.input_images:
        command.extend(["--file", str(Path(input_image).expanduser().resolve())])

    print(
        "RUN [openclaw-infer-image]:",
        " ".join(subprocess.list2cmdline([part]) for part in command),
        flush=True,
    )
    try:
        result = subprocess.run(command, capture_output=True, text=True, env=env)
    finally:
        if temp_config_dir is not None:
            temp_config_dir.cleanup()
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
        if result.stderr:
            print(
                result.stderr,
                end="" if result.stderr.endswith("\n") else "\n",
                file=sys.stderr,
            )
        return result.returncode

    json_payload = parse_openclaw_json(result.stdout)
    written_output = resolve_output_path(requested_output, json_payload)
    if written_output is None:
        print(
            "OpenClaw image generation succeeded but no image file could be resolved.",
            file=sys.stderr,
        )
        if result.stdout:
            print(result.stdout, file=sys.stderr)
        return 1

    if written_output != requested_output:
        shutil.copyfile(written_output, requested_output)

    normalize_scene_canvas(requested_output)

    print(f"Image saved: {requested_output}")
    print(f"MEDIA: {requested_output}")
    return 0


def main() -> int:
    args = parse_args()
    if args.model in NANO_BANANA_MODELS:
        return run_legacy_nano_banana(args)
    return run_openclaw_infer(args)


if __name__ == "__main__":
    raise SystemExit(main())
