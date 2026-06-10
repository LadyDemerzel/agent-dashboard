#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable

import torch
from qwen_asr import Qwen3ForcedAligner

DEFAULT_ALIGNER_MODEL = "Qwen/Qwen3-ForcedAligner-0.6B"


def detect_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda:0"
    return "cpu"


def resolve_dtype(device: str, dtype: str) -> torch.dtype:
    if dtype != "auto":
        return {
            "float32": torch.float32,
            "float16": torch.float16,
            "bfloat16": torch.bfloat16,
        }[dtype]
    if device.startswith("cuda"):
        return torch.bfloat16
    return torch.float32


def load_text(args: argparse.Namespace) -> str:
    if args.text and args.text_file:
        raise SystemExit("Pass either --text or --text-file, not both.")
    if args.text_file:
        return Path(args.text_file).expanduser().read_text(encoding="utf-8").strip()
    if args.text:
        return args.text.strip()
    raise SystemExit("Forced alignment requires the known transcript. Pass --text or --text-file.")


def iter_alignment_items(result: Any) -> Iterable[Any]:
    if result is None:
        return []
    items = getattr(result, "items", None)
    if items is not None:
        return items
    if isinstance(result, list):
        return result
    return []


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Qwen3 forced alignment against a known transcript and emit word timestamps as JSON.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--language", default="English")
    parser.add_argument("--text")
    parser.add_argument("--text-file")
    parser.add_argument("--device", default="auto", help="auto, mps, cpu, cuda, or cuda:0")
    parser.add_argument("--dtype", choices=["auto", "float32", "float16", "bfloat16"], default="auto")
    parser.add_argument("--aligner-model", default=DEFAULT_ALIGNER_MODEL)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    audio_path = Path(args.audio).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not audio_path.exists():
        raise SystemExit(f"Audio file not found: {audio_path}")

    transcript_text = load_text(args)
    if not transcript_text:
        raise SystemExit("Forced alignment transcript was empty.")

    device = detect_device() if args.device == "auto" else args.device
    if device == "cuda":
        device = "cuda:0"
    dtype = resolve_dtype(device, args.dtype)

    print(f"Loading forced aligner: {args.aligner_model}")
    print(f"Device: {device}")
    print(f"DType: {dtype}")
    print(f"Transcript chars: {len(transcript_text)}")

    model = Qwen3ForcedAligner.from_pretrained(
        args.aligner_model,
        dtype=dtype,
        device_map=device,
    )

    result = model.align(
        audio=str(audio_path),
        text=transcript_text,
        language=args.language,
    )[0]

    items = []
    for item in iter_alignment_items(result):
        items.append(
            {
                "text": item.text,
                "start_time": float(item.start_time),
                "end_time": float(item.end_time),
            }
        )

    payload = {
        "audio": str(audio_path),
        "language": args.language,
        "text": transcript_text,
        "device": device,
        "dtype": str(dtype),
        "aligner_model": args.aligner_model,
        "alignment_mode": "forced-aligner-align",
        "items": items,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved alignment JSON: {output_path}")
    print(f"Aligned words: {len(items)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
