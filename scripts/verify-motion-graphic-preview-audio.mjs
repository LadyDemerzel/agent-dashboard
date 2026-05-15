#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routePath = path.join(repoRoot, "src/app/api/short-form-videos/settings/motion-graphics-preview/route.ts");
const settingsViewPath = path.join(repoRoot, "src/components/short-form-video/ShortFormVideoSettingsView.tsx");
const soundDesignPath = path.join(repoRoot, "src/lib/short-form-sound-design.ts");

const route = fs.readFileSync(routePath, "utf-8");
const settingsView = fs.readFileSync(settingsViewPath, "utf-8");
const soundDesign = fs.readFileSync(soundDesignPath, "utf-8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(
  route.includes("renderMotionGraphicPreviewSoundEffects"),
  "Motion graphics preview route does not render deterministic preview SFX.",
);
assert(
  route.includes("runMuxVideoWithAudio") && route.includes("-map") && route.includes("1:a:0"),
  "Motion graphics preview route does not mux rendered SFX into the MP4 preview.",
);
assert(
  route.includes("soundEffectsPreviewSourceHash") && route.includes("getShortFormSoundDesignSettings"),
  "Motion graphics preview cache key is not tied to the sound library/source.",
);
assert(
  route.includes("sound-effects.json"),
  "Motion graphics preview route does not persist audio render metadata for graceful no-asset caching.",
);
assert(
  soundDesign.includes("deterministic-motion-graphic-preview-internal-sfx"),
  "Sound-design preview helper does not mark renderer-owned deterministic preview SFX.",
);
assert(
  soundDesign.includes("resolveMotionGraphicPreviewSoundEffects")
    && soundDesign.includes("renderMotionGraphicPreviewSoundEffects")
    && soundDesign.includes("selectCompatibleAsset(event, compatibleAssets)"),
  "Motion-graphic preview SFX helper is missing semantic library resolution/rendering.",
);
assert(
  settingsView.includes("deterministicSoundEffects: template.deterministicSoundEffects || []"),
  "Settings preview key does not include deterministic SFX changes.",
);

const selectedPreviewBlock = settingsView.match(/selectedMotionTemplatePreview\?\.videoUrl[\s\S]*?<video[\s\S]*?\/>/)?.[0] || "";
assert(selectedPreviewBlock, "Could not find selected motion-template preview video block.");
assert(!/\bmuted\b/.test(selectedPreviewBlock), "Selected motion-template preview video is still muted.");

console.log("motion graphic settings preview audio verification passed");
