#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import spacy
from spacy.language import Language
from spacy.tokens import Doc, Token

PUNCT_BREAKS = {",", ".", ";", "—", "–", "-", "?", "!", ":"}
HARD_BREAK_PUNCTUATION = {
    ",": "forced-comma",
    ".": "forced-sentence-end",
    "!": "forced-sentence-end",
    "?": "forced-sentence-end",
}
COORD_CONJ = {"and", "but", "or", "for", "nor"}
SUBORD_CONJ = {"because", "if", "although", "though", "while", "when", "unless", "since"}
PREPOSITIONS = {
    "about", "above", "across", "after", "against", "around", "at", "before", "behind", "below", "beneath",
    "beside", "between", "by", "during", "for", "from", "in", "inside", "into", "near", "of", "off", "on",
    "onto", "over", "through", "to", "toward", "under", "underneath", "until", "up", "upon", "with", "within",
    "without",
}
NUMERIC_FOLLOWERS = {
    "%", "percent", "percentage", "times", "x", "year", "years", "month", "months", "week", "weeks", "day", "days",
    "hour", "hours", "minute", "minutes", "second", "seconds", "point", "points", "degree", "degrees", "lb", "lbs",
    "pound", "pounds", "kg", "kgs", "kilogram", "kilograms",
}
SPACY_MODEL_CANDIDATES = ["en_core_web_sm", "en_core_web_md", "en_core_web_lg"]
NAMED_SPAN_CONNECTORS = {"of", "the", "and", "&"}
WORD_RE = re.compile(r"\d+(?:,\d{3})+(?:\.\d+)?|[A-Za-z0-9]+(?:[’'\-][A-Za-z0-9]+)*")
WEAK_LEADING_POS = {"ADP", "PART", "SCONJ", "CCONJ"}
WEAK_TRAILING_POS = {"ADP", "PART", "SCONJ", "CCONJ", "DET"}
PREFERRED_BOUNDARY_REASONS = {
    "punctuation",
    "coordinating-conjunction",
    "subordinating-conjunction",
    "clause-start",
    "clause-end",
}
STRUCTURAL_FALLBACK_REASONS = {"noun-phrase-end", "entity-end", "preposition-before", "numeric-start"}


@dataclass
class ScriptWord:
    index: int
    text: str
    norm: str
    start: int
    end: int
    token_start_i: int
    token_end_i: int


@dataclass
class CaptionChunk:
    index: int
    text: str
    start: float
    end: float
    word_count: int
    token_start: int
    token_end: int
    rules_applied: list[str]


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.replace("’", "'").lower())


def load_nlp() -> tuple[Language, str]:
    requested = (os.environ.get("DETERMINISTIC_CAPTION_SPACY_MODEL") or "").strip()
    candidates = [requested] if requested else []
    candidates.extend(name for name in SPACY_MODEL_CANDIDATES if name not in candidates)
    for name in candidates:
        try:
            return spacy.load(name), name
        except Exception:
            continue
    nlp = spacy.blank("en")
    if "sentencizer" not in nlp.pipe_names:
        nlp.add_pipe("sentencizer")
    return nlp, "spacy.blank('en')"


def iter_script_words(doc: Doc) -> list[ScriptWord]:
    words: list[ScriptWord] = []
    non_space_tokens = [token for token in doc if not token.is_space]
    token_cursor = 0

    for idx, match in enumerate(WORD_RE.finditer(doc.text)):
        text = match.group(0)
        norm = normalize_token(text)
        if not norm:
            continue
        start = match.start()
        end = match.end()

        while token_cursor < len(non_space_tokens) and non_space_tokens[token_cursor].idx + len(non_space_tokens[token_cursor].text) <= start:
            token_cursor += 1

        overlapping: list[Token] = []
        scan = token_cursor
        while scan < len(non_space_tokens) and non_space_tokens[scan].idx < end:
            overlapping.append(non_space_tokens[scan])
            scan += 1

        if not overlapping:
            continue

        words.append(
            ScriptWord(
                index=idx,
                text=text,
                norm=norm,
                start=start,
                end=end,
                token_start_i=overlapping[0].i,
                token_end_i=overlapping[-1].i + 1,
            )
        )
    return words


def token_i_to_word_index(words: list[ScriptWord]) -> dict[int, int]:
    mapping: dict[int, int] = {}
    for word in words:
        for token_i in range(word.token_start_i, word.token_end_i):
            mapping[token_i] = word.index
    return mapping


def first_token_for_word(doc: Doc, word: ScriptWord) -> Token:
    return doc[word.token_start_i]


def last_token_for_word(doc: Doc, word: ScriptWord) -> Token:
    return doc[word.token_end_i - 1]


def has_parser(doc: Doc) -> bool:
    return bool(doc) and doc.has_annotation("DEP") and doc.has_annotation("POS")


def token_looks_named(token: Token) -> bool:
    text = token.text.strip()
    if not text or token.is_space or token.is_punct:
        return False
    if token.pos_ == "PROPN":
        return True
    if re.fullmatch(r"[A-Z]{2,}(?:[A-Z0-9&.\-/]*[A-Z0-9])?", text):
        return True
    return bool(re.fullmatch(r"[A-Z][A-Za-z0-9&.\-/]+", text)) and any(ch.isalpha() for ch in text[1:])


def token_is_numericish(token: Token) -> bool:
    text = token.text.strip()
    return bool(text) and (token.like_num or token.pos_ == "NUM" or any(ch.isdigit() for ch in text))


def token_has_digits(token: Token) -> bool:
    return any(ch.isdigit() for ch in token.text)


def splits_numeric_phrase(prev_token: Token, next_token: Token) -> bool:
    prev_lower = prev_token.text.lower()
    next_lower = next_token.text.lower()
    if token_is_numericish(prev_token) and (token_is_numericish(next_token) or next_lower in NUMERIC_FOLLOWERS or next_token.dep_ in {"npadvmod", "quantmod"}):
        return True
    if prev_lower in NUMERIC_FOLLOWERS and token_is_numericish(next_token):
        return True
    return False


def protected_ranges(doc: Doc, words: list[ScriptWord]) -> list[tuple[int, int]]:
    token_to_word = token_i_to_word_index(words)
    ranges: list[tuple[int, int]] = []

    def add_token_range(start_token_i: int, end_token_i_exclusive: int):
        indices = [token_to_word[i] for i in range(start_token_i, end_token_i_exclusive) if i in token_to_word]
        if len(indices) >= 2:
            ranges.append((min(indices), max(indices) + 1))

    def add_compact_subtree(token: Token, *, max_words: int = 5):
        indices = sorted({token_to_word[t.i] for t in token.subtree if t.i in token_to_word})
        if 2 <= len(indices) <= max_words:
            ranges.append((indices[0], indices[-1] + 1))

    for ent in doc.ents:
        if ent.label_ in {"PERSON", "ORG", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART", "FAC"}:
            add_token_range(ent.start, ent.end)

    tokens = list(doc)
    seq_start: int | None = None
    seq_named_count = 0
    for i, token in enumerate(tokens):
        lower = token.text.lower()
        if token_looks_named(token):
            seq_start = i if seq_start is None else seq_start
            seq_named_count += 1
            continue
        if (
            seq_start is not None
            and lower in NAMED_SPAN_CONNECTORS
            and i + 1 < len(tokens)
            and token_looks_named(tokens[i + 1])
        ):
            continue
        if seq_start is not None and seq_named_count >= 2:
            add_token_range(seq_start, i)
        seq_start = None
        seq_named_count = 0
    if seq_start is not None and seq_named_count >= 2:
        add_token_range(seq_start, len(tokens))

    if has_parser(doc):
        for chunk in doc.noun_chunks:
            add_token_range(chunk.start, chunk.end)

        for token in doc:
            if token.pos_ == "AUX":
                add_compact_subtree(token, max_words=4)

            if token.pos_ == "ADP":
                add_compact_subtree(token, max_words=5)

            if token.dep_ in {"acomp", "attr", "oprd"}:
                add_compact_subtree(token, max_words=5)
    else:
        start = None
        for i, token in enumerate(tokens):
            looks_propn = token.text[:1].isupper() and token.text.isalpha()
            if looks_propn:
                start = i if start is None else start
            else:
                if start is not None and i - start >= 2:
                    add_token_range(start, i)
                start = None
        if start is not None and len(tokens) - start >= 2:
            add_token_range(start, len(tokens))

    merged: list[tuple[int, int]] = []
    for start, end in sorted(ranges):
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
        else:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
    return merged


def inside_protected_boundary(boundary_word_index: int, protected: list[tuple[int, int]]) -> bool:
    return any(start < boundary_word_index < end for start, end in protected)


def attached_phrase_starts(doc: Doc, words: list[ScriptWord]) -> set[int]:
    token_to_word = token_i_to_word_index(words)
    starts: set[int] = set()

    for token in doc:
        if token.dep_ not in {"prep", "xcomp"}:
            continue
        indices = sorted({token_to_word[t.i] for t in token.subtree if t.i in token_to_word})
        if 2 <= len(indices) <= 5:
            starts.add(indices[0])

    return starts


def add_boundary_after_token(doc: Doc, token_to_word: dict[int, int], token: Token, callback) -> int | None:
    for next_token_i in range(token.i + 1, len(doc)):
        boundary_word_index = token_to_word.get(next_token_i)
        if boundary_word_index is not None:
            callback(boundary_word_index)
            return boundary_word_index
    return None



def forced_punctuation_boundaries(doc: Doc, words: list[ScriptWord]) -> dict[int, str]:
    token_to_word = token_i_to_word_index(words)
    boundaries: dict[int, str] = {}

    for token in doc:
        reason = HARD_BREAK_PUNCTUATION.get(token.text)
        if reason is None:
            continue
        boundary = add_boundary_after_token(doc, token_to_word, token, lambda boundary_word_index: boundary_word_index)
        if boundary is None or not (0 < boundary < len(words)):
            continue
        boundaries.setdefault(boundary, reason)

    return boundaries



def candidate_breakpoints(doc: Doc, words: list[ScriptWord]) -> dict[int, list[str]]:
    reasons: dict[int, list[str]] = {}
    token_to_word = token_i_to_word_index(words)

    def add(boundary_word_index: int, reason: str):
        if boundary_word_index <= 0 or boundary_word_index >= len(words):
            return
        reasons.setdefault(boundary_word_index, []).append(reason)

    def add_before_token(token: Token, reason: str):
        boundary_word_index = token_to_word.get(token.i)
        if boundary_word_index is not None:
            add(boundary_word_index, reason)

    def add_after_token(token: Token, reason: str):
        add_boundary_after_token(doc, token_to_word, token, lambda boundary_word_index: add(boundary_word_index, reason))

    def subtree_word_indices(token: Token) -> list[int]:
        return sorted({token_to_word[t.i] for t in token.subtree if t.i in token_to_word})

    for token in doc:
        if token.text in PUNCT_BREAKS:
            add_after_token(token, "punctuation")

    for word in words:
        token = first_token_for_word(doc, word)
        lower = token.text.lower()
        if lower in COORD_CONJ:
            add(word.index, "coordinating-conjunction")
        if lower in SUBORD_CONJ:
            add(word.index, "subordinating-conjunction")
        if word.index > 0 and token_has_digits(token):
            previous = last_token_for_word(doc, words[word.index - 1])
            if not token_is_numericish(previous):
                add(word.index, "numeric-start")

    if has_parser(doc):
        for token in doc:
            if token.dep_ in {"advcl", "relcl", "acl", "acl:relcl"}:
                indices = subtree_word_indices(token)
                if len(indices) >= 2:
                    add(indices[0], "clause-start")
                    add(indices[-1] + 1, "clause-end")

            if token.pos_ == "ADP" and not token.is_punct:
                previous = token.nbor(-1) if token.i > 0 else None
                if previous and (token.dep_ == "prt" or previous.pos_ in {"AUX", "VERB"}):
                    add_after_token(token, "preposition-after")
                else:
                    add_before_token(token, "preposition-before")

        for ent in doc.ents:
            if ent.label_ in {"PERSON", "ORG", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART", "FAC"} and len(ent) >= 2:
                add_before_token(ent[0], "entity-start")
                add_after_token(ent[-1], "entity-end")

        for chunk in doc.noun_chunks:
            if len(chunk) >= 2:
                add_before_token(chunk[0], "noun-phrase-start")
                add_after_token(chunk[-1], "noun-phrase-end")

    return reasons


def boundary_meta(
    doc: Doc,
    words: list[ScriptWord],
    boundary: int,
    start: int,
    end: int,
    reasons: dict[int, list[str]],
    protected: list[tuple[int, int]],
    attached_starts: set[int],
) -> dict[str, Any]:
    chunk_len = boundary - start
    remaining = end - boundary
    boundary_reasons = sorted(set(reasons.get(boundary, [])))
    prev_token = last_token_for_word(doc, words[boundary - 1])
    next_token = first_token_for_word(doc, words[boundary]) if boundary < len(words) else None
    next_lower = next_token.text.lower() if next_token is not None else ""
    prev_lower = prev_token.text.lower()
    is_subordinating_break = "subordinating-conjunction" in boundary_reasons
    splits_protected = inside_protected_boundary(boundary, protected)
    splits_numeric = bool(next_token is not None and token_is_numericish(prev_token) and splits_numeric_phrase(prev_token, next_token))
    weak_trailing = prev_token.pos_ in WEAK_TRAILING_POS or prev_lower in PREPOSITIONS or prev_token.dep_ in {"cc", "mark"}
    weak_leading = bool(
        next_token is not None
        and (next_token.pos_ in WEAK_LEADING_POS or next_lower in PREPOSITIONS)
        and not (is_subordinating_break and next_lower in SUBORD_CONJ)
    )
    attached_start = boundary in attached_starts
    preferred = any(reason in PREFERRED_BOUNDARY_REASONS for reason in boundary_reasons)

    return {
        "boundary": boundary,
        "chunk_len": chunk_len,
        "remaining": remaining,
        "reasons": boundary_reasons,
        "next_lower": next_lower,
        "preferred": preferred,
        "splits_protected": splits_protected,
        "splits_numeric": splits_numeric,
        "weak_trailing": weak_trailing,
        "weak_leading": weak_leading,
        "attached_start": attached_start,
    }


def is_viable_boundary(boundary: int, start: int, end: int, max_words: int, min_words: int) -> bool:
    chunk_len = boundary - start
    remaining = end - boundary
    if chunk_len < min_words or chunk_len > max_words:
        return False
    if 0 < remaining < min_words:
        return False
    return True


def preferred_division_for(
    doc: Doc,
    words: list[ScriptWord],
    start: int,
    end: int,
    max_words: int,
    min_words: int,
    reasons: dict[int, list[str]],
    protected: list[tuple[int, int]],
    attached_starts: set[int],
) -> tuple[int, list[str]] | None:
    hard_end = min(end, start + max_words)
    target = max(min_words, round(max_words * 0.7))

    for boundary in range(hard_end, start + min_words - 1, -1):
        if not is_viable_boundary(boundary, start, end, max_words, min_words):
            continue
        meta = boundary_meta(doc, words, boundary, start, end, reasons, protected, attached_starts)
        if not meta["preferred"] or meta["splits_numeric"]:
            continue
        if (
            meta["splits_protected"]
            and boundary != hard_end
            and "subordinating-conjunction" not in meta["reasons"]
            and "clause-start" not in meta["reasons"]
            and "punctuation" not in meta["reasons"]
        ):
            continue
        if meta["weak_trailing"] and "punctuation" not in meta["reasons"]:
            continue
        if (
            meta["weak_leading"]
            and "subordinating-conjunction" not in meta["reasons"]
            and "coordinating-conjunction" not in meta["reasons"]
            and "punctuation" not in meta["reasons"]
        ):
            continue

        chunk_len = meta["chunk_len"]
        remaining = meta["remaining"]
        if remaining <= max_words and chunk_len <= remaining and chunk_len >= max(min_words, round(max_words / 3)):
            return boundary, meta["reasons"]
        if chunk_len >= target and (remaining == 0 or chunk_len <= round(max(remaining, min_words) * 1.2)):
            return boundary, meta["reasons"]
        if (
            {"punctuation", "subordinating-conjunction"} & set(meta["reasons"])
            and chunk_len >= target
            and remaining >= min_words
        ):
            return boundary, meta["reasons"]

    return None


def secondary_division_for(
    doc: Doc,
    words: list[ScriptWord],
    start: int,
    end: int,
    max_words: int,
    min_words: int,
    reasons: dict[int, list[str]],
    protected: list[tuple[int, int]],
    attached_starts: set[int],
) -> tuple[int, list[str]]:
    hard_end = min(end, start + max_words)
    target = max(min_words, round(max_words * 0.7))
    best_candidate: tuple[tuple[int, int, int, int, int], int, list[str]] | None = None

    def structural_priority(meta: dict[str, Any]) -> int:
        boundary_reasons = meta["reasons"]
        if "numeric-start" in boundary_reasons and meta["remaining"] <= max_words:
            return 4
        if "preposition-before" in boundary_reasons or "preposition-after" in boundary_reasons or "entity-end" in boundary_reasons:
            return 2
        if "noun-phrase-end" in boundary_reasons and meta["remaining"] <= max_words:
            return 1
        return 0

    for boundary in range(start + min_words, hard_end + 1):
        if not is_viable_boundary(boundary, start, end, max_words, min_words):
            continue
        meta = boundary_meta(doc, words, boundary, start, end, reasons, protected, attached_starts)
        if meta["splits_numeric"]:
            continue
        if meta["splits_protected"] and boundary != hard_end:
            continue

        safety = 0
        if meta["splits_protected"]:
            safety -= 2
        if meta["weak_trailing"]:
            safety -= 2
        if meta["weak_leading"]:
            safety -= 1 if meta["next_lower"] == "to" else 2
        if meta["attached_start"]:
            safety -= 1 if meta["next_lower"] == "to" else 2

        ranking = (
            structural_priority(meta),
            1 if boundary == hard_end and safety > -3 else 0,
            safety,
            -abs(meta["chunk_len"] - target),
            boundary,
        )
        candidate = (ranking, boundary, meta["reasons"])
        if best_candidate is None or candidate[0] > best_candidate[0]:
            best_candidate = candidate

    if best_candidate is not None:
        _, boundary, boundary_reasons = best_candidate
        return boundary, boundary_reasons or ["best-fallback"]
    return hard_end, ["forced-max-words"]


def divide_span(
    doc: Doc,
    words: list[ScriptWord],
    start: int,
    end: int,
    max_words: int,
    min_words: int,
    reasons: dict[int, list[str]],
    protected: list[tuple[int, int]],
    attached_starts: set[int],
    *,
    final_reason: str,
) -> list[tuple[int, int, list[str]]]:
    if end - start <= max_words:
        return [(start, end, [final_reason])]

    preferred = preferred_division_for(doc, words, start, end, max_words, min_words, reasons, protected, attached_starts)
    if preferred is not None:
        boundary, boundary_reasons = preferred
    else:
        boundary, boundary_reasons = secondary_division_for(doc, words, start, end, max_words, min_words, reasons, protected, attached_starts)

    applied = sorted(set(boundary_reasons or ["best-fallback"]))
    if inside_protected_boundary(boundary, protected):
        applied.append("hard-cap-protected-split")
    return [
        (start, boundary, sorted(set(applied))),
        *divide_span(doc, words, boundary, end, max_words, min_words, reasons, protected, attached_starts, final_reason=final_reason),
    ]


def choose_chunks(doc: Doc, words: list[ScriptWord], max_words: int, *, final_reason: str = "end-of-script") -> list[tuple[int, int, list[str]]]:
    protected = protected_ranges(doc, words)
    attached_starts = attached_phrase_starts(doc, words)
    reasons = candidate_breakpoints(doc, words)
    forced_boundaries = forced_punctuation_boundaries(doc, words)

    chunks: list[tuple[int, int, list[str]]] = []
    start = 0
    ordered_forced_boundaries = sorted(forced_boundaries)
    for boundary in [*ordered_forced_boundaries, len(words)]:
        if boundary <= start:
            continue
        span_final_reason = forced_boundaries.get(boundary, final_reason)
        chunks.extend(
            divide_span(
                doc,
                words,
                start,
                boundary,
                max_words,
                2,
                reasons,
                protected,
                attached_starts,
                final_reason=span_final_reason,
            )
        )
        start = boundary

    return chunks


def alignment_words(payload: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for item in payload.get("items") or []:
        text = str(item.get("text") or "").strip()
        norm = normalize_token(text)
        if not norm:
            continue
        try:
            start = float(item.get("start_time", 0.0))
            end = float(item.get("end_time", start))
        except Exception:
            continue
        result.append({"text": text, "norm": norm, "start": start, "end": end})
    return result


def match_times(chunk_words: list[ScriptWord], aligned: list[dict[str, Any]], cursor: int, previous_end: float) -> tuple[float, float, int]:
    matches = []
    search_cursor = cursor
    for word in chunk_words:
        found = None
        for i in range(search_cursor, len(aligned)):
            if aligned[i]["norm"] == word.norm:
                found = i
                break
        if found is None:
            continue
        matches.append(aligned[found])
        search_cursor = found + 1

    if matches:
        start = matches[0]["start"]
        end = matches[-1]["end"]
        return round(start, 3), round(max(start + 0.05, end), 3), search_cursor

    start = previous_end
    end = round(previous_end + 0.6, 3)
    return round(start, 3), end, cursor


def build_captions(script_text: str, alignment_payload: dict[str, Any], max_words: int) -> tuple[list[CaptionChunk], dict[str, Any]]:
    nlp, model_name = load_nlp()
    doc = nlp(script_text)
    words = iter_script_words(doc)
    aligned = alignment_words(alignment_payload)

    sentence_ranges: list[tuple[int, int]] = []
    for sent in doc.sents:
        sent_word_indices = [word.index for word in words if sent.start < word.token_end_i and word.token_start_i < sent.end]
        if not sent_word_indices:
            continue
        sentence_ranges.append((sent_word_indices[0], sent_word_indices[-1] + 1))
    if not sentence_ranges and words:
        sentence_ranges = [(0, len(words))]

    raw_chunks: list[tuple[int, int, list[str]]] = []
    for sentence_index, (sentence_start, sentence_end) in enumerate(sentence_ranges, start=1):
        sentence_words = words[sentence_start:sentence_end]
        if not sentence_words:
            continue
        sentence_text = script_text[sentence_words[0].start:sentence_words[-1].end]
        sentence_doc = nlp(sentence_text)
        sentence_local_words = iter_script_words(sentence_doc)
        sentence_chunks = choose_chunks(sentence_doc, sentence_local_words, max_words, final_reason="sentence-end")
        for local_start, local_end, rules in sentence_chunks:
            raw_chunks.append((sentence_start + local_start, sentence_start + local_end, sorted(set([*rules, f"sentence-{sentence_index}"]))))

    captions: list[CaptionChunk] = []
    cursor = 0
    previous_end = 0.0
    for index, (start_i, end_i, rules) in enumerate(raw_chunks, start=1):
        chunk_words = words[start_i:end_i]
        if not chunk_words:
            continue
        text = script_text[chunk_words[0].start:chunk_words[-1].end].strip(" \n\t")
        start, end, cursor = match_times(chunk_words, aligned, cursor, previous_end)
        if index == 1:
            start = 0.0
        if end <= start:
            end = round(start + 0.6, 3)
        captions.append(CaptionChunk(
            index=index,
            text=text,
            start=start,
            end=end,
            word_count=len(chunk_words),
            token_start=start_i,
            token_end=end_i,
            rules_applied=rules,
        ))
        previous_end = end

    runtime = {
        "spacyModel": model_name,
        "spacyVersion": spacy.__version__,
        "spacyPipeline": list(nlp.pipe_names),
        "spacyHasParser": has_parser(doc),
        "spacyHasNer": doc.has_annotation("ENT_IOB") and doc.has_annotation("ENT_TYPE"),
        "spacyFallback": model_name == "spacy.blank('en')",
        "sentenceCount": len(sentence_ranges),
    }
    return captions, runtime


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build deterministic caption chunks from alignment output.")
    parser.add_argument("--alignment", required=True)
    parser.add_argument("--script-file")
    parser.add_argument("--script-text")
    parser.add_argument("--max-words", type=int, default=6)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.script_text and not args.script_file:
        raise SystemExit("Provide --script-text or --script-file")

    script_text = args.script_text or Path(args.script_file).read_text(encoding="utf-8")
    alignment_payload = json.loads(Path(args.alignment).read_text(encoding="utf-8"))
    captions, runtime = build_captions(script_text, alignment_payload, max(2, min(12, args.max_words)))

    payload = {
        "schemaVersion": "2026-04-deterministic-captions-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "script": script_text,
        "captionMaxWords": max(2, min(12, args.max_words)),
        **runtime,
        "captions": [
            {
                "id": f"caption-{chunk.index}",
                "index": chunk.index,
                "text": chunk.text,
                "start": chunk.start,
                "end": chunk.end,
                "wordCount": chunk.word_count,
                "tokenStart": chunk.token_start,
                "tokenEnd": chunk.token_end,
                "rulesApplied": chunk.rules_applied,
            }
            for chunk in captions
        ],
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(str(output))


if __name__ == "__main__":
    main()
