#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const settingsPath = path.join(repoRoot, "settings/short-form-video/_motion-graphics-settings.json");
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

const missingDescriptions = [];
for (const template of settings.templates || []) {
  for (const field of template.fields || []) {
    if (!String(field.description || "").trim()) {
      missingDescriptions.push(`${template.id}.${field.name}`);
    }
  }
}

assert.deepEqual(
  missingDescriptions,
  [],
  `Motion graphic configurable fields need descriptions for Scribe context: ${missingDescriptions.join(", ")}`,
);

console.log("motion graphic field descriptions: ok");
