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

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label} did not persist exactly`);
}

function assertNotContains(value, sentinel, label) {
  assert(typeof value === "string", `${label} is not a string`);
  assert(!value.includes(sentinel), `${label} unexpectedly reintroduced ${sentinel}`);
}

const visualRegenerationRule = [
  "Plan Visuals regeneration rule:",
  "- If xml-script.md already exists, read it first.",
  "- The regenerated Plan Visuals XML must make meaningful body-level changes from the existing XML.",
  "- Rewriting the same XML with only front matter/status/timestamp changes is invalid.",
].join("\n");

function removeVisualRegenerationRule(value) {
  assert(typeof value === "string", "Cannot remove visual regeneration rule from non-string prompt template");
  return value
    .replaceAll(visualRegenerationRule, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const sentinelBase = `ralph-save-verify-${Date.now()}`;
  const initial = await getSettings();

  const partialWorkflowSentinel = `${sentinelBase}: partial-workflow-template`;
  let data = await patchSettings({
    prompts: {
      hooksGenerate: appendSentinel(
        initial.prompts.hooksGenerate,
        partialWorkflowSentinel,
      ),
    },
  });
  assertContains(
    data.prompts.hooksGenerate,
    partialWorkflowSentinel,
    "single workflow prompt partial save",
  );
  assertEqual(
    data.prompts.hooksMore,
    initial.prompts.hooksMore,
    "adjacent workflow prompt after partial save",
  );

  const partialTextSentinel = `${sentinelBase}: partial-text-script-template`;
  data = await patchSettings({
    textScript: {
      generatePrompt: appendSentinel(
        initial.textScript.generatePrompt,
        partialTextSentinel,
      ),
    },
  });
  assertContains(
    data.textScript.generatePrompt,
    partialTextSentinel,
    "single text-script prompt partial save",
  );
  assertEqual(
    data.textScript.revisePrompt,
    initial.textScript.revisePrompt,
    "adjacent text-script prompt after partial save",
  );

  const partialXmlSentinel = `${sentinelBase}: partial-xml-template`;
  data = await patchSettings({
    xmlVisualPlanning: {
      planningGuidelinesTemplate: appendSentinel(
        initial.xmlVisualPlanning.planningGuidelinesTemplate,
        partialXmlSentinel,
      ),
    },
  });
  assertContains(
    data.xmlVisualPlanning.planningGuidelinesTemplate,
    partialXmlSentinel,
    "single XML visual-planning guidelines prompt partial save",
  );
  assertEqual(
    data.xmlVisualPlanning.promptTemplate,
    initial.xmlVisualPlanning.promptTemplate,
    "adjacent XML visual-planning generate prompt after guidelines partial save",
  );
  assertEqual(
    data.xmlVisualPlanning.revisePromptTemplate,
    initial.xmlVisualPlanning.revisePromptTemplate,
    "adjacent XML visual-planning revise prompt after guidelines partial save",
  );
  data = await patchSettings({
    xmlVisualPlanning: {
      promptTemplate: appendSentinel(
        initial.xmlVisualPlanning.promptTemplate,
        partialXmlSentinel,
      ),
    },
  });
  assertContains(
    data.xmlVisualPlanning.promptTemplate,
    partialXmlSentinel,
    "single XML visual-planning generate prompt partial save",
  );
  assertContains(
    data.xmlVisualPlanning.planningGuidelinesTemplate,
    partialXmlSentinel,
    "XML visual-planning guidelines prompt after generate partial save",
  );
  assertEqual(
    data.xmlVisualPlanning.revisePromptTemplate,
    initial.xmlVisualPlanning.revisePromptTemplate,
    "adjacent XML visual-planning revise prompt after generate partial save",
  );
  data = await patchSettings({
    xmlVisualPlanning: {
      revisePromptTemplate: appendSentinel(
        initial.xmlVisualPlanning.revisePromptTemplate,
        partialXmlSentinel,
      ),
    },
  });
  assertContains(
    data.xmlVisualPlanning.revisePromptTemplate,
    partialXmlSentinel,
    "single XML visual-planning revise prompt partial save",
  );
  assertContains(
    data.xmlVisualPlanning.planningGuidelinesTemplate,
    partialXmlSentinel,
    "XML visual-planning guidelines prompt after revise partial save",
  );
  assertContains(
    data.xmlVisualPlanning.promptTemplate,
    partialXmlSentinel,
    "XML visual-planning generate prompt after revise partial save",
  );

  const partialSoundSentinel = `${sentinelBase}: partial-sound-template`;
  data = await patchSettings({
    soundDesign: {
      promptTemplate: appendSentinel(
        initial.soundDesign.promptTemplate,
        partialSoundSentinel,
      ),
    },
  });
  assertContains(
    data.soundDesign.promptTemplate,
    partialSoundSentinel,
    "single sound-design prompt partial save",
  );
  assertEqual(
    data.soundDesign.revisionPromptTemplate,
    initial.soundDesign.revisionPromptTemplate,
    "adjacent sound-design prompt after partial save",
  );

  const partialImageSentinel = `${sentinelBase}: partial-image-template`;
  data = await patchSettings({
    imageStyles: {
      promptTemplates: {
        sceneTemplate: appendSentinel(
          initial.imageStyles.promptTemplates.sceneTemplate,
          partialImageSentinel,
        ),
      },
    },
  });
  assertContains(
    data.imageStyles.promptTemplates.sceneTemplate,
    partialImageSentinel,
    "single image prompt template partial save",
  );
  assertEqual(
    data.imageStyles.promptTemplates.styleInstructionsTemplate,
    initial.imageStyles.promptTemplates.styleInstructionsTemplate,
    "adjacent image prompt template after partial save",
  );

  const workflowSentinel = `${sentinelBase}: help Scribe write a multi-scene vertical-video XML script`;
  const workflowPatch = Object.fromEntries(
    initial.definitions.map((definition) => [
      definition.key,
      appendSentinel(initial.prompts[definition.key], workflowSentinel),
    ]),
  );
  data = await patchSettings({ prompts: workflowPatch });
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
      planningGuidelinesTemplate: appendSentinel(initial.xmlVisualPlanning.planningGuidelinesTemplate, xmlSentinel),
      promptTemplate: appendSentinel(initial.xmlVisualPlanning.promptTemplate, xmlSentinel),
      revisePromptTemplate: appendSentinel(initial.xmlVisualPlanning.revisePromptTemplate, xmlSentinel),
    },
  });
  assertContains(data.xmlVisualPlanning.planningGuidelinesTemplate, xmlSentinel, "XML visual-planning guidelines prompt");
  assertContains(data.xmlVisualPlanning.promptTemplate, xmlSentinel, "XML visual-planning prompt");
  assertContains(data.xmlVisualPlanning.revisePromptTemplate, xmlSentinel, "XML visual-planning revise prompt");
  data = await patchSettings({
    xmlVisualPlanning: {
      ...data.xmlVisualPlanning,
      promptTemplate: `${data.xmlVisualPlanning.promptTemplate}\n\n${visualRegenerationRule}`,
      revisePromptTemplate: `${data.xmlVisualPlanning.revisePromptTemplate}\n\n${visualRegenerationRule}`,
    },
  });
  assertContains(data.xmlVisualPlanning.promptTemplate, visualRegenerationRule, "XML visual-planning prompt with regeneration rule");
  assertContains(data.xmlVisualPlanning.revisePromptTemplate, visualRegenerationRule, "XML visual-planning revise prompt with regeneration rule");
  data = await patchSettings({
    xmlVisualPlanning: {
      ...data.xmlVisualPlanning,
      promptTemplate: removeVisualRegenerationRule(data.xmlVisualPlanning.promptTemplate),
      revisePromptTemplate: removeVisualRegenerationRule(data.xmlVisualPlanning.revisePromptTemplate),
    },
  });
  assertNotContains(data.xmlVisualPlanning.promptTemplate, "Plan Visuals regeneration rule:", "XML visual-planning prompt after removing regeneration rule");
  assertNotContains(data.xmlVisualPlanning.revisePromptTemplate, "Plan Visuals regeneration rule:", "XML visual-planning revise prompt after removing regeneration rule");
  data = await getSettings();
  assertNotContains(data.xmlVisualPlanning.promptTemplate, "Plan Visuals regeneration rule:", "XML visual-planning prompt after GET");
  assertNotContains(data.xmlVisualPlanning.revisePromptTemplate, "Plan Visuals regeneration rule:", "XML visual-planning revise prompt after GET");
  const exactXmlGuidelinesPrompt = `${sentinelBase}: exact XML guidelines prompt`;
  const exactXmlPrompt = `${sentinelBase}: exact XML generate prompt`;
  const exactXmlRevisePrompt = `${sentinelBase}: exact XML revise prompt`;
  data = await patchSettings({
    xmlVisualPlanning: {
      ...data.xmlVisualPlanning,
      planningGuidelinesTemplate: exactXmlGuidelinesPrompt,
      promptTemplate: exactXmlPrompt,
      revisePromptTemplate: exactXmlRevisePrompt,
    },
  });
  assertEqual(data.xmlVisualPlanning.planningGuidelinesTemplate, exactXmlGuidelinesPrompt, "XML visual-planning guidelines prompt exact save");
  assertEqual(data.xmlVisualPlanning.promptTemplate, exactXmlPrompt, "XML visual-planning prompt exact save");
  assertEqual(data.xmlVisualPlanning.revisePromptTemplate, exactXmlRevisePrompt, "XML visual-planning revise prompt exact save");
  data = await getSettings();
  assertEqual(data.xmlVisualPlanning.planningGuidelinesTemplate, exactXmlGuidelinesPrompt, "XML visual-planning guidelines prompt exact save after GET");
  assertEqual(data.xmlVisualPlanning.promptTemplate, exactXmlPrompt, "XML visual-planning prompt exact save after GET");
  assertEqual(data.xmlVisualPlanning.revisePromptTemplate, exactXmlRevisePrompt, "XML visual-planning revise prompt exact save after GET");

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
