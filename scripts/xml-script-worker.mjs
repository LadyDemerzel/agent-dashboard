#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
const jobPath = isDirectRun ? process.argv[2] : null;
if (isDirectRun && !jobPath) process.exit(1);

const CAPTION_MAX_WORDS = 6;
const CAPTION_MIN_WORDS = 2;
const WEAK_END_WORDS = new Set([
  "a", "an", "the", "this", "that", "these", "those",
  "my", "your", "our", "their", "his", "her", "its",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "of", "in", "on", "at", "to", "for", "from", "with", "by", "into", "onto", "over", "under",
  "and", "but", "or", "so",
]);
const CLAUSE_START_WORDS = new Set([
  "and", "but", "or", "so", "because", "that", "which", "who", "when", "while", "if", "though", "although", "unless",
]);
const PREPOSITION_START_WORDS = new Set([
  "of", "in", "on", "at", "to", "for", "from", "with", "by", "into", "onto", "over", "under", "after", "before", "through", "around", "across",
]);
const AUXILIARY_START_WORDS = new Set([
  "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did", "have", "has", "had",
]);
const POSSESSIVE_START_WORDS = new Set(["my", "your", "our", "their", "his", "her", "its"]);
const MODIFIER_START_WORDS = new Set(["more", "less", "very", "really", "too", "so", "still", "just", "almost"]);

const AGENT_DASHBOARD_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const QWEN_RUNNER = path.join(HOME_DIR, ".openclaw", "workspace-ralph", "skills", "qwen3-voiceover", "scripts", "run.sh");
const FORCED_ALIGN_RUNNER = path.join(HOME_DIR, ".openclaw", "skills", "xml-scene-video", "scripts", "run_forced_align.sh");
const DETERMINISTIC_CAPTIONS_SCRIPT = path.join(AGENT_DASHBOARD_ROOT, "scripts", "deterministic_caption_chunks.py");
const CAPTION_SPACY_VENV = path.join(AGENT_DASHBOARD_ROOT, ".venv-caption-spacy");
const CAPTION_SPACY_PYTHON = path.join(CAPTION_SPACY_VENV, "bin", "python");
const CAPTION_SPACY_MODEL = "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl";
const OPENCLAW_CONFIG = path.join(HOME_DIR, ".openclaw", "openclaw.json");
const DEFAULT_VOICE_SELECTION = {
  id: "voice-calm-authority",
  name: "Female Calm Authority",
  mode: "voice-design",
  voiceDesignPrompt: "Adult female voice. Pitch: lower-register, smooth, and resonant. Tone: warm, grounded, confident, and highly articulate. Pacing: conversational, engaging, very fast-paced, but with natural pauses for emphasis. Emotion: friendly, encouraging, and knowledgeable, sounding like a trusted expert speaking one-on-one with a close friend. Volume: moderate, with an intimate, close-mic feel. Pronunciation is crisp and clear without sounding robotic.",
};
const DEFAULT_QWEN_VOICE_DESIGN_WARMUP_TEXT = "Hi there. Ready when you are.";
const DEFAULT_QWEN_VOICE_DESIGN_MAX_CHARS = 1200;
const DEFAULT_XML_TASK = "full";

function normalizeTask(value) {
  return value === "narration" || value === "captions" || value === "visuals" ? value : DEFAULT_XML_TASK;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function stripFrontMatter(content) {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match ? match[1] : content).trim();
}

function normalizeScriptText(content) {
  return stripFrontMatter(content)
    .replace(/\r/g, "")
    .trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error([`${command} exited with status ${result.status ?? "unknown"}`, result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join("\n\n"));
  }
  return result;
}

function runStreaming(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flushLines = (buffer, handler) => {
      const lines = buffer.split(/\r?\n/);
      const remainder = lines.pop() || "";
      for (const line of lines) {
        handler(line);
      }
      return remainder;
    };

    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      stdoutBuffer += text;
      stdoutBuffer = flushLines(stdoutBuffer, (line) => options.onStdoutLine?.(line));
    });

    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      stderrBuffer += text;
      stderrBuffer = flushLines(stderrBuffer, (line) => options.onStderrLine?.(line));
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (stdoutBuffer) options.onStdoutLine?.(stdoutBuffer);
      if (stderrBuffer) options.onStderrLine?.(stderrBuffer);
      if (code !== 0) {
        reject(new Error([`${command} exited with status ${code ?? "unknown"}`, stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n")));
        return;
      }
      resolve({ stdout, stderr, status: code ?? 0 });
    });
  });
}

function ensureCaptionSpacyPython() {
  const probeArgs = ["-c", "import spacy; nlp = spacy.load('en_core_web_sm'); print(nlp.meta.get('version', 'unknown'))"];
  if (fs.existsSync(CAPTION_SPACY_PYTHON)) {
    try {
      run(CAPTION_SPACY_PYTHON, probeArgs);
      return CAPTION_SPACY_PYTHON;
    } catch {
      // Rebuild below if the env exists but is incomplete or broken.
    }
  }

  ensureDir(path.dirname(CAPTION_SPACY_VENV));
  run("uv", ["venv", "--python", "3.12", CAPTION_SPACY_VENV], { cwd: AGENT_DASHBOARD_ROOT });
  run("uv", [
    "pip",
    "install",
    "--python",
    CAPTION_SPACY_PYTHON,
    "spacy>=3.8,<3.9",
    CAPTION_SPACY_MODEL,
  ], { cwd: AGENT_DASHBOARD_ROOT });
  run(CAPTION_SPACY_PYTHON, probeArgs);
  return CAPTION_SPACY_PYTHON;
}

function splitSentences(text) {
  const sentences = [];
  const regex = /[^.!?]+[.!?]+|[^.!?]+$/g;
  for (const match of text.match(regex) || []) {
    const sentence = match.trim();
    if (sentence) sentences.push(sentence);
  }
  return sentences;
}

function sentenceWordMatches(sentence) {
  return Array.from(sentence.matchAll(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g));
}

function normalizeCaptionText(value) {
  return String(value || "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "")
    .trim();
}

function getSentenceWords(sentence) {
  return sentenceWordMatches(sentence).map((match) => {
    const start = match.index ?? 0;
    const raw = String(match[0] || "");
    return {
      raw,
      norm: normalizeToken(raw),
      start,
      end: start + raw.length,
    };
  }).filter((word) => word.norm);
}

function getChunkLengthScore(length) {
  switch (length) {
    case 1:
      return -4;
    case 2:
      return 0.7;
    case 3:
      return 1.8;
    case 4:
      return 1.9;
    case 5:
      return 1.3;
    case 6:
      return 0.7;
    default:
      return -10;
  }
}

function scoreChunk(words, startIndex, endIndex, sentence) {
  const length = endIndex - startIndex;
  const firstWord = words[startIndex]?.norm || "";
  const secondWord = words[startIndex + 1]?.norm || "";
  const lastWord = words[endIndex - 1]?.norm || "";
  const gapAfter = endIndex < words.length ? sentence.slice(words[endIndex - 1].end, words[endIndex].start) : "";

  let score = getChunkLengthScore(length);

  if (WEAK_END_WORDS.has(lastWord)) {
    score -= length >= 5 ? 1.2 : 2.8;
  }

  if (/[,:;—-]/.test(gapAfter)) {
    score += 1.4;
  }

  if (PREPOSITION_START_WORDS.has(firstWord) && length >= 2 && length <= 4) {
    score += 1.2;
  }

  if (CLAUSE_START_WORDS.has(firstWord) && length >= 2 && length <= 4) {
    score += 0.9;
  }

  if (AUXILIARY_START_WORDS.has(firstWord) && length >= 2 && length <= 4) {
    score += 1.1;
  }

  if (AUXILIARY_START_WORDS.has(firstWord) && ["that", "this", "one", "your", "our", "the"].includes(secondWord)) {
    score += 0.5;
  }

  if (POSSESSIVE_START_WORDS.has(firstWord) && length >= 4) {
    score -= 1.1;
  }

  if (MODIFIER_START_WORDS.has(firstWord) && length >= 2 && length <= 3) {
    score += 1.1;
  }

  if ((firstWord === "and" || firstWord === "but" || firstWord === "or") && length === 1) {
    score -= 1.5;
  }

  return score;
}

function chooseChunkBoundaries(sentence) {
  const words = getSentenceWords(sentence);
  if (words.length === 0) return [];

  const bestScoreFrom = Array(words.length + 1).fill(Number.NEGATIVE_INFINITY);
  const nextBoundary = Array(words.length + 1).fill(-1);
  bestScoreFrom[words.length] = 0;

  for (let index = words.length - 1; index >= 0; index -= 1) {
    for (let size = 1; size <= CAPTION_MAX_WORDS && index + size <= words.length; size += 1) {
      const nextIndex = index + size;
      const remaining = words.length - nextIndex;
      if (remaining > 0 && remaining < CAPTION_MIN_WORDS) continue;

      const candidateScore = scoreChunk(words, index, nextIndex, sentence) + bestScoreFrom[nextIndex];
      if (candidateScore > bestScoreFrom[index]) {
        bestScoreFrom[index] = candidateScore;
        nextBoundary[index] = nextIndex;
      }
    }
  }

  const boundaries = [];
  let cursor = 0;
  while (cursor < words.length) {
    const nextIndex = nextBoundary[cursor];
    if (nextIndex <= cursor) break;
    boundaries.push([cursor, nextIndex]);
    cursor = nextIndex;
  }

  return boundaries.length > 0 ? boundaries : [[0, words.length]];
}

function chunkSentence(sentence, sentenceIndex) {
  const words = getSentenceWords(sentence);
  return chooseChunkBoundaries(sentence)
    .map(([startIndex, endIndex]) => {
      const start = words[startIndex]?.start ?? 0;
      const end = words[endIndex - 1]?.end ?? start;
      const text = normalizeCaptionText(sentence.slice(start, end));
      return text ? { sentence: sentenceIndex + 1, text } : null;
    })
    .filter(Boolean);
}

function normalizeToken(value) {
  return String(value || "")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/(^[^a-z0-9']+|[^a-z0-9']+$)/g, "")
    .replace(/'/g, "");
}

function getTranscriptWordTokens(scriptText) {
  return sentenceWordMatches(scriptText).map((match) => ({
    text: String(match[0] || "").replace(/[‘’]/g, "'"),
    norm: normalizeToken(match[0] || ""),
  })).filter((item) => item.norm);
}

function restoreAlignmentTranscriptTokens(scriptText, alignmentPayload) {
  if (!alignmentPayload || !Array.isArray(alignmentPayload.items)) return alignmentPayload;

  const transcriptTokens = getTranscriptWordTokens(scriptText);
  let transcriptCursor = 0;
  const items = alignmentPayload.items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const currentText = String(item.text || "").trim();
    const currentNorm = normalizeToken(currentText);
    if (!currentNorm) return item;

    let replacement;
    for (let index = transcriptCursor; index < transcriptTokens.length; index += 1) {
      if (transcriptTokens[index].norm === currentNorm) {
        replacement = transcriptTokens[index].text;
        transcriptCursor = index + 1;
        break;
      }
    }

    return replacement && replacement !== currentText
      ? { ...item, text: replacement }
      : item;
  });

  return { ...alignmentPayload, items };
}

function buildCaptionPlan(scriptText, alignmentPayload) {
  const alignedItems = Array.isArray(alignmentPayload?.items) ? alignmentPayload.items : [];
  const alignedWords = alignedItems
    .map((item) => ({
      text: String(item?.text || "").trim(),
      norm: normalizeToken(item?.text || ""),
      start: Number(item?.start_time || 0),
      end: Number(item?.end_time || 0),
    }))
    .filter((item) => item.norm && Number.isFinite(item.start) && Number.isFinite(item.end));

  const chunks = splitSentences(scriptText)
    .flatMap((sentence, sentenceIndex) => chunkSentence(sentence, sentenceIndex));

  let cursor = 0;
  const planned = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const words = chunk.text.split(/\s+/).map((token) => normalizeToken(token)).filter(Boolean);
    const matched = [];
    for (const token of words) {
      let found = -1;
      for (let i = cursor; i < alignedWords.length; i += 1) {
        if (alignedWords[i].norm === token) {
          found = i;
          break;
        }
      }
      if (found === -1) continue;
      matched.push(alignedWords[found]);
      cursor = found + 1;
    }

    const previousEnd = index > 0 ? planned[index - 1]?.end ?? 0 : 0;
    const start = matched[0]?.start ?? previousEnd;
    const end = matched[matched.length - 1]?.end ?? Math.max(start + 0.5, previousEnd + 0.5);
    planned.push({
      id: `caption-${index + 1}`,
      sentence: chunk.sentence,
      text: chunk.text,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      wordCount: words.length,
    });
  }

  return planned.map((chunk, index) => ({
    ...chunk,
    start: index === 0 ? 0 : chunk.start,
    end: chunk.end > chunk.start ? chunk.end : Number((chunk.start + 0.5).toFixed(3)),
  }));
}

function getGatewayConfig() {
  let url = "http://127.0.0.1:18789";
  let token = "";
  if (fs.existsSync(OPENCLAW_CONFIG)) {
    try {
      const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, "utf-8"));
      if (config.gateway?.port) url = `http://127.0.0.1:${config.gateway.port}`;
      if (config.hooks?.token) token = config.hooks.token;
    } catch {}
  }
  return { url, token };
}

async function spawnAuthoringAttempt(job, model, attemptIndex) {
  const { url, token } = getGatewayConfig();
  if (!token) {
    throw new Error("Hooks token not found in config");
  }

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: job.prompt,
      agentId: "scribe",
      name: `xml-script-${job.projectId}-attempt-${attemptIndex + 1}`,
      sessionKey: `hook:short-form:${job.projectId}:xml-script:${job.runId}:attempt-${attemptIndex + 1}`,
      wakeMode: "now",
      deliver: false,
      model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

function hasFreshArtifact(filePath, requestedAt) {
  if (!fs.existsSync(filePath)) return false;
  const requestedAtMs = Date.parse(requestedAt || new Date().toISOString());
  try {
    return fs.statSync(filePath).mtimeMs > requestedAtMs + 1000;
  } catch {
    return false;
  }
}

async function waitForFile(filePath, requestedAt, timeoutMs = 10 * 60_000, pollMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (hasFreshArtifact(filePath, requestedAt)) return true;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return hasFreshArtifact(filePath, requestedAt);
}

async function main() {
  const job = readJson(jobPath);
  const task = normalizeTask(job.task);
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  const attempts = [];
  const startedAt = new Date().toISOString();
  const voiceDir = path.join(job.workDir, "voice");
  const alignmentDir = path.join(job.workDir, "alignment");
  const captionsDir = path.join(job.workDir, "captions");
  const authoringDir = path.join(job.workDir, "authoring");
  const transcriptPath = path.join(voiceDir, "text-script.txt");
  const audioPath = path.join(voiceDir, "narration-full.wav");
  const voiceSelectionPath = path.join(voiceDir, "voice-selection.json");
  const alignmentInputPath = path.join(alignmentDir, "alignment-input.json");
  const alignmentOutputPath = path.join(alignmentDir, "word-timestamps.json");
  const captionPlanPath = path.join(captionsDir, "caption-sections.json");
  const promptPath = path.join(authoringDir, "xml-authoring-prompt.txt");

  let liveProgress;
  const updateStatus = (overrides = {}) => {
    writeJson(statusPath, {
      status: "running",
      runId: job.runId,
      projectId: job.projectId,
      task,
      startedAt,
      attempts,
      ...(liveProgress ? { progress: liveProgress } : {}),
      ...overrides,
    });
  };

  updateStatus();

  try {
    ensureDir(voiceDir);
    ensureDir(alignmentDir);
    ensureDir(captionsDir);
    ensureDir(authoringDir);

    const scriptText = normalizeScriptText(fs.readFileSync(job.textScriptPath, "utf-8"));
    if (!scriptText) {
      throw new Error("Text script file was empty after stripping front matter.");
    }

    fs.writeFileSync(transcriptPath, `${scriptText}\n`, "utf-8");

    const selectedVoice = job.selectedVoice && typeof job.selectedVoice === "object"
      ? {
          id: typeof job.selectedVoice.id === "string" && job.selectedVoice.id.trim() ? job.selectedVoice.id.trim() : DEFAULT_VOICE_SELECTION.id,
          name: typeof job.selectedVoice.name === "string" && job.selectedVoice.name.trim() ? job.selectedVoice.name.trim() : DEFAULT_VOICE_SELECTION.name,
          mode: job.selectedVoice.mode === "custom-voice" ? "custom-voice" : "voice-design",
          voiceDesignPrompt:
            typeof job.selectedVoice.voiceDesignPrompt === "string" && job.selectedVoice.voiceDesignPrompt.trim()
              ? job.selectedVoice.voiceDesignPrompt.trim()
              : DEFAULT_VOICE_SELECTION.voiceDesignPrompt,
          speaker:
            typeof job.selectedVoice.speaker === "string" && job.selectedVoice.speaker.trim()
              ? job.selectedVoice.speaker.trim()
              : undefined,
          legacyInstruct:
            typeof job.selectedVoice.legacyInstruct === "string" && job.selectedVoice.legacyInstruct.trim()
              ? job.selectedVoice.legacyInstruct.trim()
              : undefined,
          source: typeof job.selectedVoice.source === "string" ? job.selectedVoice.source : undefined,
          resolvedVoiceId: typeof job.selectedVoice.resolvedVoiceId === "string" ? job.selectedVoice.resolvedVoiceId : undefined,
        }
      : DEFAULT_VOICE_SELECTION;

    if (task === "full" || task === "narration") {
      writeJson(voiceSelectionPath, selectedVoice);
      attempts.push({ step: "narration", startedAt: new Date().toISOString(), voice: selectedVoice });
      liveProgress = { step: "narration", label: "Preparing narration audio", percent: 0 };
      updateStatus();
      await runStreaming("bash", [
        QWEN_RUNNER,
        "--mode",
        selectedVoice.mode,
        ...(selectedVoice.mode === "custom-voice" && selectedVoice.speaker ? ["--speaker", selectedVoice.speaker] : []),
        "--language",
        "English",
        "--instruct",
        selectedVoice.mode === "custom-voice"
          ? (selectedVoice.legacyInstruct || selectedVoice.voiceDesignPrompt || DEFAULT_VOICE_SELECTION.voiceDesignPrompt)
          : selectedVoice.voiceDesignPrompt,
        ...(selectedVoice.mode === "voice-design"
          ? [
              "--warmup-text",
              DEFAULT_QWEN_VOICE_DESIGN_WARMUP_TEXT,
              "--max-chars",
              String(DEFAULT_QWEN_VOICE_DESIGN_MAX_CHARS),
            ]
          : []),
        "--text-file",
        transcriptPath,
        "--output",
        audioPath,
      ], {
        onStdoutLine: (line) => {
          attempts[attempts.length - 1].lastOutput = line;
          const warmupMatch = line.match(/Generating warmup utterance/i);
          if (warmupMatch) {
            liveProgress = { step: "narration", label: "Generating warmup utterance", percent: 5 };
            updateStatus();
            return;
          }
          const chunkMatch = line.match(/Generating chunk (\d+)\/(\d+)/i);
          if (chunkMatch) {
            const current = Number(chunkMatch[1]);
            const total = Number(chunkMatch[2]);
            const percent = total > 0 ? Math.max(8, Math.min(95, Math.round((current / total) * 95))) : 0;
            liveProgress = { step: "narration", label: `Generating narration chunk ${current}/${total}`, current, total, percent };
            attempts[attempts.length - 1].progress = { current, total, percent };
            updateStatus();
          }
        },
      });
      attempts[attempts.length - 1].finishedAt = new Date().toISOString();
      attempts[attempts.length - 1].output = audioPath;
      liveProgress = { step: "narration", label: "Narration audio ready", percent: 100 };
      updateStatus();

      writeJson(alignmentInputPath, { audio: audioPath, transcript: transcriptPath, text: scriptText, language: "English" });
      attempts.push({ step: "alignment", startedAt: new Date().toISOString() });
      liveProgress = undefined;
      updateStatus();
      run("bash", [FORCED_ALIGN_RUNNER, "--audio", audioPath, "--output", alignmentOutputPath, "--language", "English", "--text-file", transcriptPath]);
      attempts[attempts.length - 1].finishedAt = new Date().toISOString();
      attempts[attempts.length - 1].output = alignmentOutputPath;
      updateStatus();
    }

    if (task === "captions" || task === "visuals" || task === "full") {
      if (!fs.existsSync(alignmentOutputPath)) {
        throw new Error("Missing forced alignment JSON. Run Narration Audio first so caption planning has alignment timings to reuse.");
      }
    }

    if (task === "captions" || task === "full") {
      const rawAlignmentPayload = readJson(alignmentOutputPath);
      const alignmentPayload = restoreAlignmentTranscriptTokens(scriptText, rawAlignmentPayload);
      writeJson(alignmentOutputPath, alignmentPayload);
      attempts.push({ step: "captions", startedAt: new Date().toISOString() });
      const captionPython = ensureCaptionSpacyPython();
      run(captionPython, [
        DETERMINISTIC_CAPTIONS_SCRIPT,
        "--alignment",
        alignmentOutputPath,
        "--script-file",
        transcriptPath,
        "--max-words",
        String(job.captionMaxWords || CAPTION_MAX_WORDS),
        "--output",
        captionPlanPath,
      ]);
      attempts[attempts.length - 1].finishedAt = new Date().toISOString();
      attempts[attempts.length - 1].output = captionPlanPath;
      updateStatus();
    }

    if (task === "visuals" || task === "full") {
      if (!fs.existsSync(captionPlanPath)) {
        throw new Error("Missing deterministic caption JSON. Run Plan Captions first so visual planning can reuse the existing caption timing artifact.");
      }
      fs.writeFileSync(promptPath, job.prompt, "utf-8");
      updateStatus();
      const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0 ? job.preferredModels : ["codex/gpt-5.4"];
      let verified = false;
      for (let index = 0; index < models.length; index += 1) {
        const model = models[index];
        const attempt = { step: "xml-authoring", model, startedAt: new Date().toISOString() };
        attempts.push(attempt);
        updateStatus();
        try {
          attempt.spawnResult = await spawnAuthoringAttempt(job, model, index);
          verified = await waitForFile(job.xmlScriptPath, job.requestedAt);
          attempt.verified = verified;
          attempt.finishedAt = new Date().toISOString();
          if (verified) break;
        } catch (error) {
          attempt.error = error instanceof Error ? error.message : String(error);
          attempt.finishedAt = new Date().toISOString();
        }
      }

      if (!verified) {
        throw new Error("XML authoring finished without writing a fresh xml-script.md artifact.");
      }
    }

    writeJson(statusPath, { status: "verified", runId: job.runId, projectId: job.projectId, task, startedAt, verifiedAt: new Date().toISOString(), attempts });
  } catch (error) {
    writeJson(statusPath, {
      status: "failed",
      runId: job.runId,
      projectId: job.projectId,
      task,
      startedAt,
      failedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
      attempts,
      ...(liveProgress ? { progress: liveProgress } : {}),
    });
  }
}

if (isDirectRun) {
  main().catch(() => process.exit(1));
}

export { buildCaptionPlan, chunkSentence, splitSentences };
