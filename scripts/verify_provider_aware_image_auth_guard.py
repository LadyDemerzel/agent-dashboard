#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import runpy
import subprocess
import tempfile
from pathlib import Path
from types import SimpleNamespace

SCRIPT_PATH = Path(__file__).with_name("provider-aware-image-generate.py")


def main() -> int:
    namespace = runpy.run_path(str(SCRIPT_PATH))
    prepare_openclaw_image_env = namespace["prepare_openclaw_image_env"]
    openclaw_edit_rejected_reference_images = namespace["openclaw_edit_rejected_reference_images"]
    build_openclaw_command = namespace["build_openclaw_command"]
    script_globals = prepare_openclaw_image_env.__globals__
    original_home_dir = script_globals["HOME_DIR"]
    original_probe = script_globals["probe_openclaw_codex_oauth_resolution"]

    with tempfile.TemporaryDirectory(prefix="provider-aware-auth-fallback-") as temp_home:
        temp_home_path = Path(temp_home)
        openclaw_dir = temp_home_path / ".openclaw"
        (openclaw_dir / "agents" / "main" / "agent").mkdir(parents=True)
        (openclaw_dir / "agents" / "ralph" / "agent").mkdir(parents=True)
        (openclaw_dir / "openclaw.json").write_text(json.dumps({
            "agents": {"list": [{"id": "main", "default": True}, {"id": "ralph"}]}
        }), encoding="utf-8")
        (openclaw_dir / "agents" / "main" / "agent" / "auth-profiles.json").write_text(json.dumps({
            "profiles": {
                "openai-codex:default": {
                    "type": "oauth",
                    "provider": "openai-codex",
                    "email": "ittai@shapertech.io"
                }
            }
        }), encoding="utf-8")
        (openclaw_dir / "agents" / "ralph" / "agent" / "auth-profiles.json").write_text(json.dumps({
            "profiles": {
                "openai-codex:ittai@shapertech.io": {
                    "type": "oauth",
                    "provider": "openai-codex",
                    "email": "ittai@shapertech.io",
                    "oauthRef": {"source": "openclaw-credentials", "provider": "openai-codex", "id": "fake-portable-oauth-ref"},
                }
            }
        }), encoding="utf-8")
        previous_config_path = os.environ.get("OPENCLAW_CONFIG_PATH")
        script_globals["HOME_DIR"] = temp_home_path
        os.environ["OPENCLAW_CONFIG_PATH"] = str(openclaw_dir / "openclaw.json")
        script_globals["probe_openclaw_codex_oauth_resolution"] = lambda env, agent_id: (True, f"fake probe resolved {agent_id}")
        try:
            args = SimpleNamespace(model="openai/gpt-image-2")
            env, fake_temp_config_dir = prepare_openclaw_image_env(args)
            try:
                fallback_config = json.loads(Path(env["OPENCLAW_CONFIG_PATH"]).read_text(encoding="utf-8"))
                selected_agent = fallback_config["agents"]["list"][0]["id"]
                assert selected_agent == "ralph", "guard should use a configured fallback agent when the default agent lacks Codex OAuth"
            finally:
                if fake_temp_config_dir is not None:
                    fake_temp_config_dir.cleanup()
        finally:
            script_globals["probe_openclaw_codex_oauth_resolution"] = original_probe
            script_globals["HOME_DIR"] = original_home_dir
            if previous_config_path is None:
                os.environ.pop("OPENCLAW_CONFIG_PATH", None)
            else:
                os.environ["OPENCLAW_CONFIG_PATH"] = previous_config_path

    previous = {name: os.environ.get(name) for name in ("OPENAI_API_KEY", "CODEX_API_KEY", "SHORT_FORM_ALLOW_OPENAI_API_KEY_BILLING")}

    script_globals["probe_openclaw_codex_oauth_resolution"] = lambda env, agent_id: (False, "No API key found for provider \"openai-codex\" (simulated)")
    os.environ.pop("SHORT_FORM_ALLOW_OPENAI_API_KEY_BILLING", None)
    try:
        try:
            prepare_openclaw_image_env(SimpleNamespace(model="openai/gpt-image-2"))
        except RuntimeError as error:
            message = str(error)
            assert "could not resolve an OAuth access token" in message, "failing auth probe should block before image generation"
            assert "OPENAI_API_KEY/CODEX_API_KEY" in message, "auth failure should mention API keys stayed out of the child env"
            assert "openai-codex" in message, "auth failure should preserve the real provider name"
        else:
            raise AssertionError("failing OpenClaw Codex OAuth probe did not stop image generation")
    finally:
        script_globals["probe_openclaw_codex_oauth_resolution"] = original_probe
    os.environ["OPENAI_API_KEY"] = "fake-openai-key-that-must-not-propagate"
    os.environ["CODEX_API_KEY"] = "fake-codex-key-that-must-not-propagate"
    os.environ.pop("SHORT_FORM_ALLOW_OPENAI_API_KEY_BILLING", None)

    temp_config_dir = None
    try:
        args = SimpleNamespace(model="openai/gpt-image-2")
        env, temp_config_dir = prepare_openclaw_image_env(args)
        assert "OPENAI_API_KEY" not in env, "OPENAI_API_KEY propagated to OpenClaw child env"
        assert "CODEX_API_KEY" not in env, "CODEX_API_KEY propagated to OpenClaw child env"

        config_path = Path(env["OPENCLAW_CONFIG_PATH"])
        config = json.loads(config_path.read_text(encoding="utf-8"))
        defaults = config["agents"]["defaults"]
        image_model = defaults["imageGenerationModel"]
        assert image_model["primary"] == "openai/gpt-image-2", "guard config changed the requested model"
        assert defaults["mediaGenerationAutoProviderFallback"] is False, "guard config allows image-provider fallback"
        auth = config.get("auth")
        assert isinstance(auth, dict), "guard config must preserve OpenClaw OAuth profile routing metadata"
        auth_profiles = auth.get("profiles")
        assert isinstance(auth_profiles, dict) and auth_profiles, "guard config must include OAuth profile metadata"
        for profile_id, profile in auth_profiles.items():
            assert profile_id.startswith("openai-codex:"), f"unexpected non-Codex profile copied: {profile_id}"
            assert profile.get("provider") == "openai-codex", f"unexpected provider copied for {profile_id}"
            assert profile.get("mode") == "oauth", f"unexpected non-OAuth profile copied: {profile_id}"
            assert "key" not in profile and "apiKey" not in profile and "token" not in profile, f"secret material copied into guard config: {profile_id}"
        for provider in ("openai-codex", "openai"):
            order = auth.get("order", {}).get(provider)
            assert isinstance(order, list) and order, f"guard config must route {provider} through Codex OAuth profiles"
            assert all(profile_id in auth_profiles for profile_id in order), f"guard config has unknown {provider} auth order entries"
        assert config.get("models", {}).get("providers", {}).get("openai") is None, "guard config should not copy direct OpenAI provider config"

        providers_result = subprocess.run(
            ["/opt/homebrew/bin/openclaw", "infer", "image", "providers", "--json"],
            check=True,
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        providers = json.loads(providers_result.stdout)
        openai_provider = next((entry for entry in providers if entry.get("id") == "openai"), None)
        assert openai_provider is not None, "OpenClaw providers did not list the OpenAI image provider"
        assert openai_provider.get("configured") is True, "OAuth-only guard config did not make OpenAI image provider configured"
        assert openai_provider.get("selected") is True, "OAuth-only guard config did not select the requested OpenAI image provider"

        rejected = subprocess.CompletedProcess(
            args=[],
            returncode=1,
            stdout='OpenAI Codex image generation failed (HTTP 400): The image data you provided does not represent a valid image.',
            stderr='[type=invalid_request_error, code=invalid_value]',
        )
        assert openclaw_edit_rejected_reference_images(rejected), "reference-image rejection should trigger text-to-image fallback"

        command = build_openclaw_command(
            SimpleNamespace(
                model="openai/gpt-image-2",
                prompt="Generate an empty operating room; do not add a character.",
                resolution="1K",
                aspect_ratio="9:16",
            ),
            Path("/tmp/out.png"),
            input_images=[],
            prompt="fallback prompt; do not invent a character unless explicitly asked",
        )
        assert command[3] == "generate", "fallback command should switch from image edit to text-to-image generate"
        assert "--file" not in command, "fallback command must omit rejected image attachments"
        assert "do not invent a character" in command[command.index("--prompt") + 1], "fallback prompt should preserve non-character intent"
    finally:
        if temp_config_dir is not None:
            temp_config_dir.cleanup()
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    print("OK: default gpt-image-2 dashboard path strips API-key env, selects a Codex-OAuth-capable agent, preserves OAuth routing, and falls back from rejected image edits to text-to-image generation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
