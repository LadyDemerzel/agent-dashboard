#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

_BOOTSTRAP_ENV_KEY = "AGENT_DASHBOARD_PILLOW_BOOTSTRAPPED"


def ensure_pillow_runtime() -> None:
    if os.environ.get(_BOOTSTRAP_ENV_KEY) == "1":
        return

    try:
        import PIL  # noqa: F401
        return
    except ModuleNotFoundError as error:
        if error.name != "PIL":
            raise

    uv_path = shutil.which("uv")
    if not uv_path:
        raise ModuleNotFoundError(
            "Pillow is required for caption overlay rendering. Install Pillow or install uv so the script can bootstrap Pillow automatically."
        )

    env = os.environ.copy()
    env[_BOOTSTRAP_ENV_KEY] = "1"
    script_path = str(Path(sys.argv[0]).resolve())
    result = subprocess.run(
        [uv_path, "run", "--with", "pillow", "python3", script_path, *sys.argv[1:]],
        env=env,
        check=False,
    )
    raise SystemExit(result.returncode)
