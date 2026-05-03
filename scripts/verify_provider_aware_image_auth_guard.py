#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import runpy
from pathlib import Path
from types import SimpleNamespace

SCRIPT_PATH = Path(__file__).with_name("provider-aware-image-generate.py")


def main() -> int:
    namespace = runpy.run_path(str(SCRIPT_PATH))
    prepare_openclaw_image_env = namespace["prepare_openclaw_image_env"]

    previous = {name: os.environ.get(name) for name in ("OPENAI_API_KEY", "CODEX_API_KEY", "SHORT_FORM_ALLOW_OPENAI_API_KEY_BILLING")}
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
        assert "auth" not in config, "guard config should not copy direct OpenAI auth profiles"
        assert config.get("models", {}).get("providers", {}).get("openai") is None, "guard config should not copy direct OpenAI provider config"
    finally:
        if temp_config_dir is not None:
            temp_config_dir.cleanup()
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    print("OK: default gpt-image-2 dashboard path strips API-key env and uses an OAuth-only OpenClaw config")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
