#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.DASHBOARD_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const settingsDir = path.join(
  os.homedir(),
  "tenxsolo/business/content/deliverables/short-form-videos",
);

const settingsFiles = [
  "_workflow-settings.json",
  "_text-script-settings.json",
  "_xml-visual-planning-settings.json",
  "_image-style-settings.json",
  "_sound-design-settings.json",
].map((file) => path.join(settingsDir, file));

const backups = new Map(
  settingsFiles.map((file) => [
    file,
    fs.existsSync(file) ? fs.readFileSync(file) : null,
  ]),
);

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${options.method || "GET"} ${pathname} returned non-JSON ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok || body.success === false) {
    throw new Error(`${options.method || "GET"} ${pathname} failed ${response.status}: ${body.error || text.slice(0, 200)}`);
  }
  return body;
}

async function getSettings() {
  const body = await request("/api/short-form-videos/settings");
  if (!body.data) throw new Error("Settings response did not include data");
  return body.data;
}

async function patchSettings(payload) {
  const body = await request("/api/short-form-videos/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!body.data) throw new Error("PATCH response did not include data");
  return body.data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function appendSentinel(value, sentinel) {
  assert(typeof value === "string" && value.trim(), `Cannot append sentinel to non-string value for ${sentinel}`);
  return `${value}\n\n${sentinel}`;
}

function assertContains(value, sentinel, label) {
  assert(typeof value === "string" && value.includes(sentinel), `${label} did not persist sentinel`);
}

async function main() {
  const sentinelBase = `ralph-save-verify-${Date.now()}`;
  const initial = await getSettings();

  const workflowSentinel = `${sentinelBase}: help Scribe write a multi-scene vertical-video XML script`;
  const workflowPatch = Object.fromEntries(
    initial.definitions.map((definition) => [
      definition.key,
      appendSentinel(initial.prompts[definition.key], workflowSentinel),
    ]),
  );
  let data = await patchSettings({ prompts: workflowPatch });
  for (const definition of initial.definitions) {
    assertContains(data.prompts[definition.key], workflowSentinel, `workflow prompt ${definition.key} in PATCH response`);
  }
  data = await getSettings();
  for (const definition of initial.definitions) {
    assertContains(data.prompts[definition.key], workflowSentinel, `workflow prompt ${definition.key} after GET`);
  }

  const textSentinel = `${sentinelBase}: text-script`;
  data = await patchSettings({
    textScript: {
      ...initial.textScript,
      generatePrompt: appendSentinel(initial.textScript.generatePrompt, textSentinel),
      revisePrompt: appendSentinel(initial.textScript.revisePrompt, textSentinel),
      reviewPrompt: appendSentinel(initial.textScript.reviewPrompt, textSentinel),
    },
  });
  assertContains(data.textScript.generatePrompt, textSentinel, "text-script generate prompt");
  assertContains(data.textScript.revisePrompt, textSentinel, "text-script revise prompt");
  assertContains(data.textScript.reviewPrompt, textSentinel, "text-script review prompt");

  const xmlSentinel = `${sentinelBase}: xml-visual-planning`;
  data = await patchSettings({
    xmlVisualPlanning: {
      ...initial.xmlVisualPlanning,
      promptTemplate: appendSentinel(initial.xmlVisualPlanning.promptTemplate, xmlSentinel),
      revisionNotesPromptTemplate: appendSentinel(initial.xmlVisualPlanning.revisionNotesPromptTemplate, xmlSentinel),
    },
  });
  assertContains(data.xmlVisualPlanning.promptTemplate, xmlSentinel, "XML visual-planning prompt");
  assertContains(data.xmlVisualPlanning.revisionNotesPromptTemplate, xmlSentinel, "XML visual-planning revision prompt");

  const imageSentinel = `${sentinelBase}: image-templates`;
  data = await patchSettings({
    imageStyles: {
      promptTemplates: {
        styleInstructionsTemplate: appendSentinel(initial.imageStyles.promptTemplates.styleInstructionsTemplate, imageSentinel),
        characterReferenceTemplate: appendSentinel(initial.imageStyles.promptTemplates.characterReferenceTemplate, imageSentinel),
        sceneTemplate: appendSentinel(initial.imageStyles.promptTemplates.sceneTemplate, imageSentinel),
      },
    },
  });
  assertContains(data.imageStyles.promptTemplates.styleInstructionsTemplate, imageSentinel, "image style-instructions template");
  assertContains(data.imageStyles.promptTemplates.characterReferenceTemplate, imageSentinel, "image character-reference template");
  assertContains(data.imageStyles.promptTemplates.sceneTemplate, imageSentinel, "image scene template");

  const soundSentinel = `${sentinelBase}: sound-design`;
  data = await patchSettings({
    soundDesign: {
      promptTemplate: appendSentinel(initial.soundDesign.promptTemplate, soundSentinel),
      revisionPromptTemplate: appendSentinel(initial.soundDesign.revisionPromptTemplate, soundSentinel),
    },
  });
  assertContains(data.soundDesign.promptTemplate, soundSentinel, "sound-design prompt");
  assertContains(data.soundDesign.revisionPromptTemplate, soundSentinel, "sound-design revision prompt");

  console.log("Verified prompt-template saves for workflow, research, text-script, XML visual-planning, image, and sound-design settings.");
}

try {
  await main();
} finally {
  for (const [file, backup] of backups) {
    if (backup === null) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, backup);
    }
  }
}
