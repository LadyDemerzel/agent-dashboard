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
OPENCLAW_AUTH_PROBE_TIMEOUT_ENV = "SHORT_FORM_OPENCLAW_AUTH_PROBE_TIMEOUT_MS"


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


def resolve_runtime_config_path() -> Path:
    return Path(os.environ.get("OPENCLAW_CONFIG_PATH", HOME_DIR / ".openclaw" / "openclaw.json")).expanduser()


def load_runtime_config() -> dict[str, Any]:
    return load_json_file(resolve_runtime_config_path()) or {}


def configured_agent_ids(runtime_config: dict[str, Any] | None = None) -> list[str]:
    config = runtime_config if runtime_config is not None else load_runtime_config()
    agents = config.get("agents") if isinstance(config.get("agents"), dict) else {}
    agent_list = agents.get("list") if isinstance(agents.get("list"), list) else []
    ids: list[str] = []
    for entry in agent_list:
        if not isinstance(entry, dict):
            continue
        agent_id = entry.get("id")
        if isinstance(agent_id, str) and SAFE_AGENT_ID_RE.match(agent_id) and agent_id not in ids:
            ids.append(agent_id)
    return ids


def resolve_default_agent_id() -> str:
    config = load_runtime_config()
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


def codex_oauth_agent_candidates(runtime_config: dict[str, Any] | None = None) -> list[str]:
    runtime_config = runtime_config if runtime_config is not None else load_runtime_config()
    default_agent_id = resolve_default_agent_id()
    candidates = [default_agent_id]
    candidates.extend(agent_id for agent_id in configured_agent_ids(runtime_config) if agent_id not in candidates)
    # Dashboard jobs may be launched outside an OpenClaw agent turn. If the default
    # agent lacks portable Codex OAuth, prefer a configured team agent that has it
    # instead of falling through to direct API-key billing or failing with a
    # misleading OpenClaw auth-store error.
    for fallback_agent_id in ("ralph", "main"):
        if fallback_agent_id not in candidates:
            candidates.append(fallback_agent_id)
    return [agent_id for agent_id in candidates if agent_has_codex_oauth_profile(agent_id)]


def resolve_codex_oauth_agent_id() -> str | None:
    candidates = codex_oauth_agent_candidates()
    return candidates[0] if candidates else None

def is_usable_codex_oauth_profile(credential: dict[str, Any]) -> bool:
    if credential.get("provider") != "openai-codex" or credential.get("type") != "oauth":
        return False
    oauth_ref = credential.get("oauthRef")
    if isinstance(oauth_ref, dict) and oauth_ref.get("source") and oauth_ref.get("id"):
        return True
    # Some portable stores may still contain inline OAuth material. We do not copy
    # it into temporary dashboard configs, but its presence means the agent can
    # resolve Codex OAuth at runtime without API-key billing.
    return any(isinstance(credential.get(key), str) and credential.get(key).strip() for key in ("access", "refresh", "accessToken", "refreshToken"))


def agent_has_codex_oauth_profile(agent_id: str) -> bool:
    if not SAFE_AGENT_ID_RE.match(agent_id):
        return False
    auth_path = HOME_DIR / ".openclaw" / "agents" / agent_id / "agent" / "auth-profiles.json"
    store = load_json_file(auth_path) or {}
    profiles = store.get("profiles") if isinstance(store.get("profiles"), dict) else {}
    for credential in profiles.values():
        if not isinstance(credential, dict):
            continue
        if is_usable_codex_oauth_profile(credential):
            return True
    return False


def collect_codex_oauth_profile_ids(agent_id: str, runtime_config: dict[str, Any]) -> list[str]:
    if not SAFE_AGENT_ID_RE.match(agent_id):
        return []

    auth_path = HOME_DIR / ".openclaw" / "agents" / agent_id / "agent" / "auth-profiles.json"
    store = load_json_file(auth_path) or {}
    store_profiles = store.get("profiles") if isinstance(store.get("profiles"), dict) else {}

    configured_auth = runtime_config.get("auth") if isinstance(runtime_config.get("auth"), dict) else {}
    configured_order = configured_auth.get("order") if isinstance(configured_auth.get("order"), dict) else {}
    preferred: list[str] = []
    for provider in ("openai-codex", "openai"):
        entries = configured_order.get(provider)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if isinstance(entry, str) and entry not in preferred:
                preferred.append(entry)

    available: list[str] = []
    for profile_id, credential in store_profiles.items():
        if not isinstance(profile_id, str) or not isinstance(credential, dict):
            continue
        if is_usable_codex_oauth_profile(credential):
            available.append(profile_id)

    ordered: list[str] = []
    for profile_id in preferred:
        if profile_id in available and profile_id not in ordered:
            ordered.append(profile_id)

    # Prefer identity-scoped profiles over legacy/default managed profiles. A stale
    # `openai-codex:default` can exist beside a working identity profile; if the
    # temporary config drops auth.order, OpenClaw may pick the stale default first.
    for profile_id in sorted(available, key=lambda value: (value.endswith(":default"), value)):
        if profile_id not in ordered:
            ordered.append(profile_id)

    return ordered


def build_codex_oauth_auth_config(agent_id: str, runtime_config: dict[str, Any]) -> dict[str, Any] | None:
    profile_ids = collect_codex_oauth_profile_ids(agent_id, runtime_config)
    if not profile_ids:
        return None

    auth_path = HOME_DIR / ".openclaw" / "agents" / agent_id / "agent" / "auth-profiles.json"
    store = load_json_file(auth_path) or {}
    store_profiles = store.get("profiles") if isinstance(store.get("profiles"), dict) else {}

    profiles: dict[str, dict[str, Any]] = {}
    for profile_id in profile_ids:
        credential = store_profiles.get(profile_id)
        profile: dict[str, Any] = {"provider": "openai-codex", "mode": "oauth"}
        if isinstance(credential, dict) and isinstance(credential.get("email"), str):
            profile["email"] = credential["email"]
        profiles[profile_id] = profile

    return {
        "profiles": profiles,
        "order": {
            "openai-codex": profile_ids,
            # The OpenAI image provider transparently routes openai/gpt-image-* through
            # openai-codex OAuth when this order is present. Without it, a legacy
            # default profile can shadow the working identity profile and surface as
            # "No API key found for provider openai-codex".
            "openai": profile_ids,
        },
    }


def build_codex_oauth_only_config(args: argparse.Namespace, agent_id: str, runtime_config: dict[str, Any] | None = None) -> dict[str, Any]:
    timeout_ms = os.environ.get(OPENCLAW_IMAGE_TIMEOUT_ENV, "300000")
    runtime_config = runtime_config if runtime_config is not None else load_runtime_config()
    config: dict[str, Any] = {
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
    auth_config = build_codex_oauth_auth_config(agent_id, runtime_config)
    if auth_config is not None:
        config["auth"] = auth_config
    return config


def resolve_openclaw_dist_dir() -> Path:
    bin_path = Path(find_openclaw_bin()).expanduser()
    try:
        package_dir = bin_path.resolve().parent
    except FileNotFoundError:
        package_dir = Path("/opt/homebrew/lib/node_modules/openclaw")
    dist_dir = package_dir / "dist"
    if dist_dir.is_dir():
        return dist_dir
    return Path("/opt/homebrew/lib/node_modules/openclaw/dist")


def build_openclaw_auth_probe_script() -> str:
    return r'''
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const distDir = process.argv[1];
const agentId = process.env.SHORT_FORM_OPENCLAW_PROBE_AGENT_ID || 'main';

try {
  const { resolveApiKeyForProvider } = await import(
    pathToFileURL(path.join(distDir, 'plugin-sdk', 'provider-auth-runtime.js')).href
  );
  const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const agentDir = path.join(process.env.HOME || '', '.openclaw', 'agents', agentId, 'agent');
  const auth = await resolveApiKeyForProvider({ provider: 'openai-codex', cfg, agentDir });
  console.log(JSON.stringify({
    ok: Boolean(auth?.apiKey),
    agentId,
    agentDir,
    source: auth?.source,
    mode: auth?.mode,
    profileId: auth?.profileId
  }));
  if (!auth?.apiKey) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    agentId,
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
}
'''


def probe_openclaw_codex_oauth_resolution(env: dict[str, str], agent_id: str) -> tuple[bool, str]:
    probe_env = env.copy()
    probe_env["SHORT_FORM_OPENCLAW_PROBE_AGENT_ID"] = agent_id
    timeout_raw = os.environ.get(OPENCLAW_AUTH_PROBE_TIMEOUT_ENV, "30000")
    timeout_seconds = max(1, int(timeout_raw) // 1000) if timeout_raw.isdigit() else 30
    try:
        result = subprocess.run(
            ["node", "--input-type=module", "-e", build_openclaw_auth_probe_script(), str(resolve_openclaw_dist_dir())],
            capture_output=True,
            text=True,
            env=probe_env,
            timeout=timeout_seconds,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"OpenClaw Codex OAuth probe could not run for agent '{agent_id}': {exc}"

    detail = (result.stdout or result.stderr or "").strip()
    try:
        payload = json.loads(strip_ansi(detail)) if detail else {}
    except json.JSONDecodeError:
        payload = {}
    if result.returncode == 0 and payload.get("ok") is True:
        profile_id = payload.get("profileId") or "unknown-profile"
        mode = payload.get("mode") or "unknown-mode"
        return True, f"agent '{agent_id}' resolved {profile_id} ({mode})"
    message = payload.get("message") if isinstance(payload.get("message"), str) else detail
    return False, message or f"OpenClaw Codex OAuth probe failed for agent '{agent_id}' with exit code {result.returncode}"

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

    runtime_config = load_runtime_config()
    default_agent_id = resolve_default_agent_id()
    candidates = codex_oauth_agent_candidates(runtime_config)
    if not candidates:
        configured = ", ".join(configured_agent_ids(runtime_config)) or "none"
        raise RuntimeError(
            f"Refusing to generate {args.model}: dashboard image generation defaults to Codex OAuth/subscription only, "
            f"but no OpenAI Codex OAuth profile is available for the default OpenClaw agent '{default_agent_id}' "
            f"or configured fallback agents ({configured}). "
            "A direct fallback would use OPENAI_API_KEY/CODEX_API_KEY and bill API usage. "
            "Run `openclaw models status --agent main --probe --probe-provider openai-codex` to verify Codex OAuth, "
            "or sign in/copy a portable OpenAI Codex OAuth profile for the agent that runs dashboard jobs. "
            f"Set {API_KEY_BILLING_OPT_IN_ENV}=1 only if direct OpenAI API-key billing is intended."
        )

    temp_dir = tempfile.TemporaryDirectory(prefix="short-form-openclaw-oauth-only-")
    config_path = Path(temp_dir.name) / "openclaw-oauth-only.json"
    env.pop("OPENAI_API_KEY", None)
    env.pop("CODEX_API_KEY", None)

    probe_failures: list[str] = []
    for agent_id in candidates:
        config_path.write_text(
            json.dumps(build_codex_oauth_only_config(args, agent_id, runtime_config), indent=2) + "\n",
            encoding="utf-8",
        )
        config_path.chmod(0o600)
        env["OPENCLAW_CONFIG_PATH"] = str(config_path)
        probe_ok, probe_detail = probe_openclaw_codex_oauth_resolution(env, agent_id)
        if not probe_ok:
            probe_failures.append(f"{agent_id}: {probe_detail}")
            continue
        agent_note = f" via agent '{agent_id}'" if agent_id != default_agent_id else ""
        print(
            f"Using OpenClaw Codex OAuth-only image generation for {args.model}{agent_note}; OPENAI_API_KEY/CODEX_API_KEY are not passed to the child process. Auth probe: {probe_detail}.",
            file=sys.stderr,
        )
        return env, temp_dir

    temp_dir.cleanup()
    failure_detail = "; ".join(probe_failures[-3:]) or "no probe details"
    raise RuntimeError(
        f"Refusing to generate {args.model}: OpenAI Codex OAuth profile metadata exists, but OpenClaw could not resolve an OAuth access token "
        f"from the temporary dashboard config without OPENAI_API_KEY/CODEX_API_KEY. Probe failures: {failure_detail}. "
        "Run `openclaw models status --agent main --probe --probe-provider openai-codex` to verify or refresh the Codex OAuth login."
    )

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


def openclaw_edit_rejected_reference_images(result: subprocess.CompletedProcess[str]) -> bool:
    combined = f"{result.stdout or ''}\n{result.stderr or ''}".lower()
    return (
        "does not represent a valid image" in combined
        or ("invalid_request_error" in combined and "invalid_value" in combined)
    )


def build_openclaw_command(
    args: argparse.Namespace,
    requested_output: Path,
    *,
    input_images: list[str],
    prompt: str | None = None,
) -> list[str]:
    is_edit = len(input_images) > 0
    command = [
        find_openclaw_bin(),
        "infer",
        "image",
        "edit" if is_edit else "generate",
        "--model",
        args.model,
        "--prompt",
        prompt or args.prompt,
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

    for input_image in input_images:
        command.extend(["--file", str(Path(input_image).expanduser().resolve())])

    return command


def print_command(command: list[str]) -> None:
    print(
        "RUN [openclaw-infer-image]:",
        " ".join(subprocess.list2cmdline([part]) for part in command),
        flush=True,
    )


def openclaw_image_timeout_seconds() -> int:
    timeout_raw = os.environ.get(OPENCLAW_IMAGE_TIMEOUT_ENV, "300000")
    timeout_ms = int(timeout_raw) if timeout_raw.isdigit() else 300000
    return max(1, timeout_ms // 1000) + 30


def run_openclaw_command(command: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    print_command(command)
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=env,
            timeout=openclaw_image_timeout_seconds(),
        )
    except subprocess.TimeoutExpired as exc:
        stderr = exc.stderr or ""
        if isinstance(stderr, bytes):
            stderr = stderr.decode("utf-8", errors="replace")
        stdout = exc.stdout or ""
        if isinstance(stdout, bytes):
            stdout = stdout.decode("utf-8", errors="replace")
        return subprocess.CompletedProcess(
            args=command,
            returncode=124,
            stdout=stdout,
            stderr=(
                stderr
                + f"\nOpenClaw image generation exceeded {openclaw_image_timeout_seconds()}s; "
                "terminating this image attempt so the workflow can fail clearly instead of hanging."
            ),
        )


def emit_failed_openclaw_result(result: subprocess.CompletedProcess[str]) -> None:
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.stderr:
        print(
            result.stderr,
            end="" if result.stderr.endswith("\n") else "\n",
            file=sys.stderr,
        )


def run_openclaw_infer(args: argparse.Namespace) -> int:
    requested_output = Path(args.filename).expanduser().resolve()
    requested_output.parent.mkdir(parents=True, exist_ok=True)

    try:
        env, temp_config_dir = prepare_openclaw_image_env(args)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    try:
        command = build_openclaw_command(args, requested_output, input_images=args.input_images)
        result = run_openclaw_command(command, env)
        if (
            result.returncode != 0
            and args.input_images
            and is_codex_oauth_only_openai_model(args.model)
            and openclaw_edit_rejected_reference_images(result)
        ):
            emit_failed_openclaw_result(result)
            print(
                "WARN: OpenClaw Codex image edit rejected reference image data; retrying once without --file attachments.",
                file=sys.stderr,
            )
            command = build_openclaw_command(
                args,
                requested_output,
                input_images=[],
                prompt=args.prompt,
            )
            result = run_openclaw_command(command, env)
    finally:
        if temp_config_dir is not None:
            temp_config_dir.cleanup()

    if result.returncode != 0:
        emit_failed_openclaw_result(result)
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
