#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const GENERATE_FROM_XML = "/Users/ittaisvidler/.openclaw/skills/xml-scene-images/scripts/generate_from_xml.py";
const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const tempDir = mkdtempSync(path.join(tmpdir(), "character-driven-routing-"));
try {
  const outputDir = path.join(tempDir, "out");
  mkdirSync(outputDir);
  const callsPath = path.join(tempDir, "calls.jsonl");
  const fakeGeneratorPath = path.join(tempDir, "fake-generate.py");
  const characterReferencePath = path.join(tempDir, "character-reference.png");
  const characterExtraReferencePath = path.join(tempDir, "character-extra-reference.png");
  const styleReferencePath = path.join(tempDir, "style-reference.png");
  writeFileSync(characterReferencePath, Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"));
  writeFileSync(characterExtraReferencePath, Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"));
  writeFileSync(styleReferencePath, Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"));

  writeFileSync(fakeGeneratorPath, `#!/usr/bin/env python3
import argparse, base64, json, os
parser = argparse.ArgumentParser()
parser.add_argument('--prompt', required=True)
parser.add_argument('--filename', required=True)
parser.add_argument('--resolution')
parser.add_argument('--aspect-ratio')
parser.add_argument('--model')
parser.add_argument('-i', '--input-image', action='append', default=[])
args = parser.parse_args()
with open(os.environ['CALLS_JSONL'], 'a', encoding='utf-8') as fh:
    fh.write(json.dumps({'filename': args.filename, 'prompt': args.prompt, 'input_images': args.input_image}) + '\\n')
with open(args.filename, 'wb') as fh:
    fh.write(base64.b64decode('${ONE_BY_ONE_PNG_BASE64}'))
`);
  chmodSync(fakeGeneratorPath, 0o755);

  const extraReferencesPath = path.join(tempDir, "style-references.json");
  writeFileSync(extraReferencesPath, JSON.stringify([
    {
      path: styleReferencePath,
      label: "Watercolor style swatch",
      usageType: "style",
      usageInstructions: "Use this reference for watercolor texture and muted operating-room lighting. STYLE_REFERENCE_SENTINEL.",
    },
    {
      path: characterExtraReferencePath,
      label: "Presenter character reference",
      usageType: "character-reference",
      usageInstructions: "Use this as the canonical recurring presenter character reference. CHARACTER_EXTRA_REFERENCE_SENTINEL.",
    },
  ], null, 2));

  const xmlPath = path.join(tempDir, "video.xml");
  writeFileSync(xmlPath, `
<video version="2">
  <topic>Character routing verification</topic>
  <script>Verify visual routing.</script>
  <assets>
    <image id="presenter" characterDriven="true"><prompt>Recurring presenter character explaining a facility upgrade.</prompt></image>
    <image id="empty-or" characterDriven="false"><prompt>Empty modern operating room with modular stainless-steel wall panels, surgical lights, ceiling-mounted equipment booms, integrated wall utilities, and no character.</prompt></image>
    <image id="missing-default"><prompt>Product-only close-up of a modular stainless steel panel, no person present.</prompt></image>
  </assets>
  <timeline>
    <visual id="v1" label="Presenter" start="0" end="1" imageId="presenter" />
    <visual id="v2" label="Empty OR" start="1" end="2" imageId="empty-or" />
    <visual id="v3" label="Missing defaults false" start="2" end="3" imageId="missing-default" />
  </timeline>
</video>
`.trim());

  const result = spawnSync("uv", [
    "run",
    "--with",
    "pillow",
    "python3",
    GENERATE_FROM_XML,
    xmlPath,
    "--output-dir",
    outputDir,
    "--generator-script",
    fakeGeneratorPath,
    "--extra-references-json",
    extraReferencesPath,
    "--style-extra",
    "Watercolor wash, soft pigment blooms, clean medical-industrial lighting. STYLE_EXTRA_SENTINEL. Use the attached references as the source of truth for this watercolor look.",
    "--force",
    "--skip-caption-overlay",
  ], {
    cwd: path.dirname(GENERATE_FROM_XML),
    env: { ...process.env, CALLS_JSONL: callsPath },
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  assert.equal(result.status, 0, `generate_from_xml failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);

  const calls = readFileSync(callsPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const byScene = new Map(calls.map((call) => [path.basename(call.filename), call]));
  const scene1 = byScene.get("scene-01-uncaptioned-1080x1920.png");
  const scene2 = byScene.get("scene-02-uncaptioned-1080x1920.png");
  const scene3 = byScene.get("scene-03-uncaptioned-1080x1920.png");

  assert.ok(scene1, "characterDriven=true scene should be generated");
  assert.ok(scene2, "characterDriven=false scene should be generated");
  assert.ok(scene3, "missing characterDriven scene should be generated");

  assert.ok(!scene1.input_images.includes(characterReferencePath), "true scene should not use the deprecated separate character-reference argument");
  assert.ok(scene1.input_images.includes(characterExtraReferencePath), "true scene should include character references from extraReferences JSON");
  assert.match(scene1.prompt, /CHARACTER_EXTRA_REFERENCE_SENTINEL/, "true scene should include character extra-reference prompt text");
  assert.doesNotMatch(scene1.prompt, /RECURRING_CHARACTER_PROMPT_SENTINEL/, "true scene should not include generic subject prompt text");

  for (const [label, scene] of [["false", scene2], ["missing", scene3]]) {
    assert.ok(!scene.input_images.includes(characterReferencePath), `${label} scene must not include the character reference image`);
    assert.ok(!scene.input_images.includes(characterExtraReferencePath), `${label} scene must not include character references from extraReferences JSON`);
    assert.doesNotMatch(scene.prompt, /CHARACTER_EXTRA_REFERENCE_SENTINEL/, `${label} scene must not include character extra-reference prompt text`);
    assert.doesNotMatch(scene.prompt, /RECURRING_CHARACTER_PROMPT_SENTINEL/, `${label} scene must not include subject/character prompt text`);
    assert.doesNotMatch(scene.prompt, /primary character reference/i, `${label} scene must not include primary character-reference prompt text`);
    assert.doesNotMatch(scene.prompt, /recurring woman|preserve her face|same outfit|wardrobe|same clothing/i, `${label} scene must not include character outfit/wardrobe prompt text`);
    assert.doesNotMatch(scene.prompt, /character identity|preserve identity/i, `${label} scene must not include character identity preservation text`);
    assert.ok(scene.input_images.includes(styleReferencePath), `${label} scene should still include non-character style reference images`);
    assert.match(scene.prompt, /STYLE_EXTRA_SENTINEL/, `${label} scene should preserve non-character style instructions`);
    assert.match(scene.prompt, /STYLE_REFERENCE_SENTINEL/, `${label} scene should preserve non-character style-reference guidance`);
  }

  const manifest = JSON.parse(readFileSync(path.join(outputDir, "manifest.json"), "utf-8"));
  assert.equal(manifest.scenes[0].character_driven, true, "manifest should record true character_driven");
  assert.equal(manifest.scenes[1].character_driven, false, "manifest should record false character_driven");
  assert.equal(manifest.scenes[2].character_driven, false, "manifest should default missing characterDriven to false");

  const noCharacterOutputDir = path.join(tempDir, "out-no-character-reference");
  mkdirSync(noCharacterOutputDir);
  const noCharacterCallsPath = path.join(tempDir, "calls-no-character-reference.jsonl");
  const noCharacterReferencesPath = path.join(tempDir, "style-references-no-character.json");
  writeFileSync(noCharacterReferencesPath, JSON.stringify([
    {
      path: styleReferencePath,
      label: "Watercolor style swatch",
      usageType: "style",
      usageInstructions: "Use this reference for watercolor texture and muted operating-room lighting. STYLE_REFERENCE_SENTINEL.",
    },
  ], null, 2));
  const noCharacterResult = spawnSync("uv", [
    "run",
    "--with",
    "pillow",
    "python3",
    GENERATE_FROM_XML,
    xmlPath,
    "--output-dir",
    noCharacterOutputDir,
    "--generator-script",
    fakeGeneratorPath,
    "--extra-references-json",
    noCharacterReferencesPath,
    "--style-extra",
    "Watercolor wash, soft pigment blooms, clean medical-industrial lighting. STYLE_EXTRA_SENTINEL.",
    "--only-scenes",
    "1",
    "--force",
    "--skip-caption-overlay",
  ], {
    cwd: path.dirname(GENERATE_FROM_XML),
    env: { ...process.env, CALLS_JSONL: noCharacterCallsPath },
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(noCharacterResult.status, 0, `generate_from_xml without character reference failed\nstdout:\n${noCharacterResult.stdout}\nstderr:\n${noCharacterResult.stderr}`);
  const noCharacterScene = JSON.parse(readFileSync(noCharacterCallsPath, "utf-8").trim());
  assert.ok(noCharacterScene.input_images.includes(styleReferencePath), "characterDriven=true without a character reference should keep non-character style references");
  assert.ok(!noCharacterScene.input_images.includes(characterExtraReferencePath), "characterDriven=true without a character reference must not invent a character reference");
  assert.doesNotMatch(noCharacterScene.prompt, /CHARACTER_EXTRA_REFERENCE_SENTINEL|primary character reference|subject identity/i, "characterDriven=true without a character reference must not include character prompt text");

  console.log("Verified characterDriven routing: true includes character extraReferences; false and missing suppress character references + subject prompt while preserving style refs/instructions.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
