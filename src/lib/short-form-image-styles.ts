import fs from "fs";
import path from "path";

export type ShortFormStyleReferenceUsageType = "general" | "style" | "character" | "lighting" | "composition" | "palette";

export interface ShortFormStyleReferenceImage {
  id: string;
  label?: string;
  usageType: ShortFormStyleReferenceUsageType;
  usageInstructions: string;
  imageRelativePath: string;
  imageUrl?: string;
  uploadedAt?: string;
}

export interface ShortFormImageStyleTestImage {
  runId: string;
  cleanRelativePath?: string;
  previewRelativePath?: string;
  updatedAt?: string;
  cleanImageUrl?: string;
  previewImageUrl?: string;
}

export interface ShortFormImageStyle {
  id: string;
  name: string;
  description?: string;
  subjectPrompt: string;
  stylePrompt: string;
  headerPercent: number;
  testTopic: string;
  testCaption: string;
  testImagePrompt: string;
  references?: ShortFormStyleReferenceImage[];
  lastTestImage?: ShortFormImageStyleTestImage;
}

export interface ShortFormNanoBananaPromptTemplates {
  styleInstructionsTemplate: string;
  characterReferenceTemplate: string;
  sceneTemplate: string;
}

export interface ShortFormImageStyleSettings {
  defaultStyleId: string;
  styles: ShortFormImageStyle[];
  promptTemplates: ShortFormNanoBananaPromptTemplates;
}

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const SHORT_FORM_VIDEOS_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos"
);
const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_image-style-settings.json");
const STYLE_TESTS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_style-tests");
const STYLE_REFERENCE_IMAGES_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_style-reference-images");
const DEFAULT_STYLE_ID = "default-charcoal";

const LEGACY_PER_STYLE_PLACEHOLDER = "{{perStyleInstructionsBlock}}";
const LEGACY_EXTRA_REFERENCES_PLACEHOLDER = "{{extraReferencesBlock}}";
const LEGACY_TOPIC_LINE_PLACEHOLDER = "{{topicLine}}";
const LEGACY_SCRIPT_LINE_PLACEHOLDER = "{{scriptLine}}";
const LEGACY_ASSET_ID_LINE_PLACEHOLDER = "{{assetIdLine}}";
const LEGACY_ASSET_DERIVATION_LINE_PLACEHOLDER = "{{assetDerivationLine}}";
const LEGACY_EXTRA_DIRECTION_LINE_PLACEHOLDER = "{{extraDirectionLine}}";
const LEGACY_CONTINUITY_LINE_PLACEHOLDER = "{{continuityInstructionsLine}}";
const LEGACY_COMPOSITION_RULE = "CRITICAL COMPOSITION RULE: keep roughly the top {{headerPercent}} percent of the vertical frame available for later caption overlay, but render it as the real scene background continuing upward as a natural extension of the same environment rather than a separate header treatment.";
const LEGACY_SAFE_AREA_RULE = "Never interpret the caption-safe area as a literal header, banner, title card, plaque, boxed strip, abrupt empty strip, or separate top panel. Do not introduce any hard horizontal divider or clean rectangular block near the top. Keep foreground subjects and important props mostly below the safe area while letting the same background, lighting, atmosphere, and texture extend naturally all the way to the top.";
const LEGACY_STYLE_DIRECTION_RULE = "Visual style must remain consistent across every scene. Use the selected shared/per-style art direction for the actual medium, palette, rendering approach, mood, and finish; do not silently fall back to an unrelated house style.";

const STYLE_TEMPLATE_PER_STYLE_BLOCK = "Additional per-style art direction from the selected style: {{perStyleInstructions}}";
const STYLE_TEMPLATE_EXTRA_REFERENCES_BLOCK = "Additional attached reference images are provided alongside the primary character reference. Use each one only for the role described below:\n{{extraReferences}}";
const SCENE_TEMPLATE_TOPIC_BLOCK = "Topic context: {{topic}}.";
const SCENE_TEMPLATE_SCRIPT_BLOCK = "Full script context: {{script}}.";
const SCENE_TEMPLATE_ASSET_ID_BLOCK = "Asset id: {{assetId}}.";
const SCENE_TEMPLATE_ASSET_DERIVATION_BLOCK = "This asset is derived from asset {{assetDerivedFromId}}. Use the attached derived-from asset as a continuity/reference input when it is available, but keep the current asset prompt as the source of truth.";
const SCENE_TEMPLATE_EXTRA_DIRECTION_BLOCK = "Revision direction: {{extraDirection}}.";

const DEFAULT_INLINE_SHARED_STYLE_RULES = [
  "Keep every image as one cohesive full-frame composition with no separate header, banner, boxed strip, or hard horizontal divider.",
  "No tiling, split panels, framed prints, inset cards, mockups, collage layouts, or floating rectangles unless explicitly requested.",
  "Characters should never be cut off unless the crop is clearly motivated by the left, right, or bottom edge of the frame.",
];

const DEFAULT_INLINE_GREENSCREEN_STYLE_RULES = [
  "CRITICAL BACKGROUND RULE: render the character and all foreground props against a uniform pure chroma-key green background (#00FF00 or equivalent vivid studio greenscreen) that fills the entire frame edge to edge.",
  "The greenscreen should stay distinctly green, not cyan/teal/blue-green: keep blue in the backdrop as close to zero as possible so the background does not drift toward aqua.",
  "The greenscreen should read like a single flat digital/studio fill: no realistic environment, scenic background, textured backdrop, painted strokes, gradient background, corner darkening, mottled noise, shadows cast onto a wall, floor reflections, haze, smoke, or colored light spill in the green area.",
  "Keep the subject fully in front of the greenscreen with clean silhouette separation, crisp but natural edges, minimal semi-transparent wisps, and no motion blur or smeared edges that would make chroma keying difficult.",
  "Avoid green clothing, green accessories, green makeup, green props, or green translucent objects on the subject. Prefer wardrobe and props that contrast strongly against green.",
  "When greenscreen output is requested, any instruction about background continuation, scenic atmosphere, or matching the reference background is overridden. Match only the artistic treatment on the foreground subject and props, never inherit the reference background itself.",
];

const DEFAULT_NANO_BANANA_PROMPT_TEMPLATES: ShortFormNanoBananaPromptTemplates = {
  styleInstructionsTemplate: [
    "Keep the same subject identity and overall look: {{subjectPrompt}}.",
    "If a primary character reference image is attached, treat it as the source of truth for the recurring character's face, hair, body proportions, skin tone, and signature outfit/wardrobe styling. Preserve the same outfit, colors, silhouette, and accessories across scenes unless the scene direction explicitly calls for a deliberate outfit change.",
    "Visual style must remain consistent across every scene. Use the selected editable style-instructions template plus per-style art direction for the actual medium, palette, rendering approach, mood, and finish; do not silently fall back to an unrelated house style.",
    "CRITICAL COMPOSITION RULE: keep roughly the top {{headerPercent}} percent of the vertical frame available for later caption overlay by leaving that area compositionally quieter inside the same full-frame image, not by adding a separate header treatment or boxed panel.",
    "The entire image must read as one unified full-bleed composition. Do not create a framed print, white border, paper margin, inset panel, floating portrait rectangle, mockup card, collage layout, picture-in-picture, split tile, or sticker-cutout subject pasted over a separate background.",
    "Never interpret the caption-safe area as a literal header, banner, title card, plaque, boxed strip, abrupt empty strip, or separate top panel. Do not introduce any hard horizontal divider or clean rectangular block near the top. Keep foreground subjects and important props mostly below the safe area while the same full-frame plate continues cleanly to the top edge.",
    "If the scene suggests comparison, anatomy emphasis, or multiple ideas, solve it within one cohesive scene using pose, depth, lighting, and integrated visual cues rather than divider lines, before/after cards, boxed inserts, or framed sub-images.",
    "CRITICAL: generate clean artwork only with no text, letters, subtitles, labels, logos, UI chrome, speech bubbles, or watermarks anywhere in the image.",
    ...DEFAULT_INLINE_SHARED_STYLE_RULES,
    ...DEFAULT_INLINE_GREENSCREEN_STYLE_RULES,
    STYLE_TEMPLATE_PER_STYLE_BLOCK,
    STYLE_TEMPLATE_EXTRA_REFERENCES_BLOCK,
  ].join("\n\n"),
  characterReferenceTemplate: [
    "Create a single consistent character reference for a TikTok educational image series.",
    "Subject: {{subjectPrompt}}.",
    "Frame the subject in a clear side-profile portrait suitable as a visual identity reference for later scenes.",
    "Treat the visible hairstyle, outfit, and accessories in this character reference as part of the stable identity package that later scenes should preserve unless a later scene explicitly requests a change.",
    "The image must feel like one unified full-frame scene, not a bordered print, floating card, or paper insert.",
    "Generate clean artwork only: absolutely no text, letters, subtitles, labels, UI chrome, or watermark.",
    "{{styleInstructionsBlock}}",
  ].join("\n\n"),
  sceneTemplate: [
    SCENE_TEMPLATE_TOPIC_BLOCK,
    SCENE_TEMPLATE_SCRIPT_BLOCK,
    "Generate one reusable image asset for a short-form educational video.",
    SCENE_TEMPLATE_ASSET_ID_BLOCK,
    "Primary image asset direction: {{assetPrompt}}.",
    SCENE_TEMPLATE_ASSET_DERIVATION_BLOCK,
    "Treat this as reusable source art that may be referenced by multiple timeline visuals, so do not optimize it around a single visual label, caption, or beat name.",
    "Honor the requested framing and viewpoint cues from the asset prompt. If a primary character reference is attached, preserve the same outfit from that reference unless the asset prompt explicitly changes wardrobe.",
    SCENE_TEMPLATE_EXTRA_DIRECTION_BLOCK,
    "{{continuityInstructions}}",
    "Make the core idea instantly understandable at a glance and visually scroll-stopping.",
    "Interpret the asset prompt as a single cohesive composition even if the wording suggests comparison, split-screen, before/after, overlay, anatomy callout, or editorial insert. Prefer one integrated scene with natural depth and subtle embedded cues instead of separate panels or boxed elements.",
    "The generated image itself must contain no text, letters, subtitles, labels, logos, UI chrome, or watermark; captions will be overlaid later outside the model.",
    "{{styleInstructionsBlock}}",
  ].join("\n\n"),
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const DEFAULT_STYLE: ShortFormImageStyle = {
  id: DEFAULT_STYLE_ID,
  name: "Default charcoal",
  description: "Preserves the current dark charcoal house look used by the direct dashboard workflow.",
  subjectPrompt: "same androgynous high-fashion model across all scenes, sharp eye area, defined cheekbones, elegant neutral styling",
  stylePrompt:
    "Clean dramatic high-contrast pencil-and-charcoal illustration, premium modern TikTok aesthetic, dark smoky atmospheric background, restrained vivid red accents only on the key focal area, minimal clutter.",
  headerPercent: 28,
  testTopic: "Facial posture reset",
  testCaption: "Your jawline changes when posture changes",
  testImagePrompt:
    "Single full-frame side-profile portrait in a dark studio, subtle posture cue through neck alignment, premium charcoal illustration, natural negative space near the top.",
  references: [],
};

const ALLOWED_REFERENCE_USAGE_TYPES: ShortFormStyleReferenceUsageType[] = [
  "general",
  "style",
  "character",
  "lighting",
  "composition",
  "palette",
];

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function clampHeaderPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_STYLE.headerPercent;
  return Math.min(45, Math.max(15, Math.round(numeric)));
}

function isSafeRelativeMediaPath(relativePath: string, baseDir: string) {
  const resolved = path.resolve(baseDir, relativePath);
  return resolved === baseDir || resolved.startsWith(`${baseDir}${path.sep}`);
}

function resolveStyleTestImageVersion(relativePath: string) {
  const absolutePath = path.join(getShortFormStyleTestsDir(), relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;
  return Math.round(fs.statSync(absolutePath).mtimeMs);
}

function resolveStyleReferenceImageVersion(relativePath: string) {
  const absolutePath = path.join(getShortFormStyleReferenceImagesDir(), relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;
  return Math.round(fs.statSync(absolutePath).mtimeMs);
}

function hydrateStyleReference(value: unknown, index: number): ShortFormStyleReferenceImage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const obj = value as Record<string, unknown>;
  const imageRelativePath = typeof obj.imageRelativePath === "string" ? obj.imageRelativePath.trim() : "";
  if (!imageRelativePath || !isSafeRelativeMediaPath(imageRelativePath, getShortFormStyleReferenceImagesDir())) {
    return null;
  }

  const version = resolveStyleReferenceImageVersion(imageRelativePath);
  const usageType = typeof obj.usageType === "string" && ALLOWED_REFERENCE_USAGE_TYPES.includes(obj.usageType as ShortFormStyleReferenceUsageType)
    ? (obj.usageType as ShortFormStyleReferenceUsageType)
    : "general";

  return {
    id:
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim()
        : `${slugify(typeof obj.label === "string" ? obj.label : "reference") || "reference"}-${index + 1}`,
    label: typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : undefined,
    usageType,
    usageInstructions:
      typeof obj.usageInstructions === "string" && obj.usageInstructions.trim()
        ? obj.usageInstructions.trim()
        : "Use this reference as supporting visual context when helpful.",
    imageRelativePath,
    ...(typeof obj.uploadedAt === "string" && obj.uploadedAt.trim() ? { uploadedAt: obj.uploadedAt.trim() } : {}),
    ...(version !== null ? { imageUrl: `/api/short-form-videos/settings/style-references/${imageRelativePath}?v=${version}` } : {}),
  };
}

function persistStyleReference(value: unknown, index: number): ShortFormStyleReferenceImage | null {
  const normalized = hydrateStyleReference(value, index);
  if (!normalized) return null;
  return {
    id: normalized.id,
    ...(normalized.label ? { label: normalized.label } : {}),
    usageType: normalized.usageType,
    usageInstructions: normalized.usageInstructions,
    imageRelativePath: normalized.imageRelativePath,
    ...(normalized.uploadedAt ? { uploadedAt: normalized.uploadedAt } : {}),
  };
}

function hydrateStyleTestImage(value: unknown): ShortFormImageStyleTestImage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const obj = value as Record<string, unknown>;
  const runId = typeof obj.runId === "string" ? obj.runId.trim() : "";
  if (!runId) return undefined;

  const cleanRelativePath = typeof obj.cleanRelativePath === "string" && obj.cleanRelativePath.trim()
    ? obj.cleanRelativePath.trim()
    : undefined;
  const previewRelativePath = typeof obj.previewRelativePath === "string" && obj.previewRelativePath.trim()
    ? obj.previewRelativePath.trim()
    : undefined;

  if (!cleanRelativePath && !previewRelativePath) return undefined;

  const cleanVersion = cleanRelativePath ? resolveStyleTestImageVersion(cleanRelativePath) : null;
  const previewVersion = previewRelativePath ? resolveStyleTestImageVersion(previewRelativePath) : null;

  return {
    runId,
    ...(typeof obj.updatedAt === "string" && obj.updatedAt.trim() ? { updatedAt: obj.updatedAt.trim() } : {}),
    ...(cleanRelativePath && cleanVersion !== null
      ? {
          cleanRelativePath,
          cleanImageUrl: `/api/short-form-videos/settings/style-tests/${cleanRelativePath}?v=${cleanVersion}`,
        }
      : {}),
    ...(previewRelativePath && previewVersion !== null
      ? {
          previewRelativePath,
          previewImageUrl: `/api/short-form-videos/settings/style-tests/${previewRelativePath}?v=${previewVersion}`,
        }
      : {}),
  };
}

function persistStyleTestImage(value: unknown): ShortFormImageStyleTestImage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const obj = value as Record<string, unknown>;
  const runId = typeof obj.runId === "string" ? obj.runId.trim() : "";
  if (!runId) return undefined;

  const cleanRelativePath = typeof obj.cleanRelativePath === "string" && obj.cleanRelativePath.trim()
    ? obj.cleanRelativePath.trim()
    : undefined;
  const previewRelativePath = typeof obj.previewRelativePath === "string" && obj.previewRelativePath.trim()
    ? obj.previewRelativePath.trim()
    : undefined;

  if (!cleanRelativePath && !previewRelativePath) return undefined;

  return {
    runId,
    ...(typeof obj.updatedAt === "string" && obj.updatedAt.trim() ? { updatedAt: obj.updatedAt.trim() } : {}),
    ...(cleanRelativePath ? { cleanRelativePath } : {}),
    ...(previewRelativePath ? { previewRelativePath } : {}),
  };
}

function normalizeStyle(value: unknown, index: number): ShortFormImageStyle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const rawName = typeof obj.name === "string" ? obj.name.trim() : "";
  const name = rawName || `Style ${index + 1}`;
  const rawId = typeof obj.id === "string" ? obj.id.trim() : "";
  const id = rawId || `${slugify(name) || "style"}-${index + 1}`;
  const subjectPrompt = typeof obj.subjectPrompt === "string" ? obj.subjectPrompt.trim() : "";
  const stylePrompt = typeof obj.stylePrompt === "string" ? obj.stylePrompt.trim() : "";

  if (!subjectPrompt) return null;

  const references: ShortFormStyleReferenceImage[] = (Array.isArray(obj.references) ? obj.references : [])
    .map((reference, referenceIndex) => hydrateStyleReference(reference, referenceIndex))
    .filter((reference): reference is ShortFormStyleReferenceImage => Boolean(reference))
    .map((reference, referenceIndex, allReferences): ShortFormStyleReferenceImage => {
      if (reference.usageType !== "character") return reference;
      const firstCharacterIndex = allReferences.findIndex((item) => item.usageType === "character");
      return referenceIndex === firstCharacterIndex ? reference : { ...reference, usageType: "general" };
    });

  return {
    id,
    name,
    description: typeof obj.description === "string" && obj.description.trim() ? obj.description.trim() : undefined,
    subjectPrompt,
    stylePrompt,
    headerPercent: clampHeaderPercent(obj.headerPercent),
    testTopic:
      typeof obj.testTopic === "string" && obj.testTopic.trim()
        ? obj.testTopic.trim()
        : DEFAULT_STYLE.testTopic,
    testCaption:
      typeof obj.testCaption === "string" && obj.testCaption.trim()
        ? obj.testCaption.trim()
        : DEFAULT_STYLE.testCaption,
    testImagePrompt:
      typeof obj.testImagePrompt === "string" && obj.testImagePrompt.trim()
        ? obj.testImagePrompt.trim()
        : DEFAULT_STYLE.testImagePrompt,
    references,
    lastTestImage: hydrateStyleTestImage(obj.lastTestImage),
  };
}

function normalizeStyleForStorage(value: unknown, index: number): ShortFormImageStyle | null {
  const normalized = normalizeStyle(value, index);
  if (!normalized) return null;

  const obj = value as Record<string, unknown>;

  return {
    ...normalized,
    references: (normalized.references || [])
      .map((reference, referenceIndex) => persistStyleReference(reference, referenceIndex))
      .filter((reference): reference is ShortFormStyleReferenceImage => Boolean(reference)),
    lastTestImage: persistStyleTestImage(obj.lastTestImage),
  };
}

function dedupeStyles(styles: ShortFormImageStyle[]) {
  const seen = new Set<string>();
  return styles.filter((style) => {
    if (seen.has(style.id)) return false;
    seen.add(style.id);
    return true;
  });
}

function normalizePromptTemplateValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function splitPromptTemplateBlocks(value: string) {
  return value
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function dedupePromptBlocks(blocks: string[]) {
  const seen = new Set<string>();
  const normalizedBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedBlocks.push(trimmed);
  }

  return normalizedBlocks;
}

function insertBlocksBeforePlaceholder(blocks: string[], placeholder: string, insertions: string[]) {
  const index = blocks.findIndex((block) => block === placeholder);
  if (index === -1) {
    return [...blocks, ...insertions];
  }
  return [...blocks.slice(0, index), ...insertions, ...blocks.slice(index)];
}

function normalizeStyleInstructionsTemplate(template: string) {
  let blocks = splitPromptTemplateBlocks(template)
    .flatMap((block) => {
      if (block === LEGACY_PER_STYLE_PLACEHOLDER) {
        return [STYLE_TEMPLATE_PER_STYLE_BLOCK];
      }

      if (block === LEGACY_EXTRA_REFERENCES_PLACEHOLDER) {
        return [STYLE_TEMPLATE_EXTRA_REFERENCES_BLOCK];
      }

      if (block === LEGACY_COMPOSITION_RULE) {
        return [
          "CRITICAL COMPOSITION RULE: keep roughly the top {{headerPercent}} percent of the vertical frame available for later caption overlay by leaving that area compositionally quieter inside the same full-frame image, not by adding a separate header treatment or boxed panel.",
        ];
      }

      if (block === LEGACY_STYLE_DIRECTION_RULE) {
        return [
          "Visual style must remain consistent across every scene. Use the selected editable style-instructions template plus per-style art direction for the actual medium, palette, rendering approach, mood, and finish; do not silently fall back to an unrelated house style.",
        ];
      }

      if (block === LEGACY_SAFE_AREA_RULE) {
        return [
          "Never interpret the caption-safe area as a literal header, banner, title card, plaque, boxed strip, abrupt empty strip, or separate top panel. Do not introduce any hard horizontal divider or clean rectangular block near the top. Keep foreground subjects and important props mostly below the safe area while the same full-frame plate continues cleanly to the top edge.",
        ];
      }

      return [
        block
          .replace(LEGACY_PER_STYLE_PLACEHOLDER, STYLE_TEMPLATE_PER_STYLE_BLOCK)
          .replace(LEGACY_EXTRA_REFERENCES_PLACEHOLDER, STYLE_TEMPLATE_EXTRA_REFERENCES_BLOCK)
          .trim(),
      ].filter(Boolean);
    });

  blocks = insertBlocksBeforePlaceholder(blocks, STYLE_TEMPLATE_PER_STYLE_BLOCK, DEFAULT_INLINE_SHARED_STYLE_RULES);
  blocks = insertBlocksBeforePlaceholder(blocks, STYLE_TEMPLATE_PER_STYLE_BLOCK, DEFAULT_INLINE_GREENSCREEN_STYLE_RULES);

  return dedupePromptBlocks(blocks).join("\n\n");
}

function normalizeSceneTemplate(template: string) {
  let blocks = splitPromptTemplateBlocks(template).flatMap((block) => {
    if (block === LEGACY_TOPIC_LINE_PLACEHOLDER) {
      return [SCENE_TEMPLATE_TOPIC_BLOCK];
    }

    if (block === LEGACY_SCRIPT_LINE_PLACEHOLDER) {
      return [SCENE_TEMPLATE_SCRIPT_BLOCK];
    }

    if (block === LEGACY_ASSET_ID_LINE_PLACEHOLDER) {
      return [SCENE_TEMPLATE_ASSET_ID_BLOCK];
    }

    if (block === LEGACY_ASSET_DERIVATION_LINE_PLACEHOLDER) {
      return [SCENE_TEMPLATE_ASSET_DERIVATION_BLOCK];
    }

    if (block === LEGACY_EXTRA_DIRECTION_LINE_PLACEHOLDER) {
      return [SCENE_TEMPLATE_EXTRA_DIRECTION_BLOCK];
    }

    if (block === LEGACY_CONTINUITY_LINE_PLACEHOLDER) {
      return ["{{continuityInstructions}}"];
    }

    if (block === "Create scene {{sceneNumber}} for a short-form educational video.") {
      return [
        "Generate one reusable image asset for a short-form educational video.",
        SCENE_TEMPLATE_ASSET_ID_BLOCK,
      ];
    }

    if (block === "Scene goal: {{sceneText}}.") {
      return [
        "Treat this as reusable source art that may be referenced by multiple timeline visuals, so do not optimize it around a single visual label, caption, or beat name.",
      ];
    }

    if (block === "Scene image direction: {{sceneImagePrompt}}.") {
      return [
        "Primary image asset direction: {{assetPrompt}}.",
        SCENE_TEMPLATE_ASSET_DERIVATION_BLOCK,
      ];
    }

    if (block === "Honor the requested framing and viewpoint cues from the scene direction. If a primary character reference is attached, preserve the same outfit from that reference unless the current scene direction explicitly changes wardrobe.") {
      return [
        "Honor the requested framing and viewpoint cues from the asset prompt. If a primary character reference is attached, preserve the same outfit from that reference unless the asset prompt explicitly changes wardrobe.",
      ];
    }

    if (block === "Interpret the scene direction as a single cohesive composition even if the wording suggests comparison, split-screen, before/after, overlay, anatomy callout, or editorial insert. Prefer one integrated scene with natural depth and subtle embedded cues instead of separate panels or boxed elements.") {
      return [
        "Interpret the asset prompt as a single cohesive composition even if the wording suggests comparison, split-screen, before/after, overlay, anatomy callout, or editorial insert. Prefer one integrated scene with natural depth and subtle embedded cues instead of separate panels or boxed elements.",
      ];
    }

    return [
      block
        .replace(LEGACY_TOPIC_LINE_PLACEHOLDER, SCENE_TEMPLATE_TOPIC_BLOCK)
        .replace(LEGACY_SCRIPT_LINE_PLACEHOLDER, SCENE_TEMPLATE_SCRIPT_BLOCK)
        .replace(LEGACY_ASSET_ID_LINE_PLACEHOLDER, SCENE_TEMPLATE_ASSET_ID_BLOCK)
        .replace(LEGACY_ASSET_DERIVATION_LINE_PLACEHOLDER, SCENE_TEMPLATE_ASSET_DERIVATION_BLOCK)
        .replace(LEGACY_EXTRA_DIRECTION_LINE_PLACEHOLDER, SCENE_TEMPLATE_EXTRA_DIRECTION_BLOCK)
        .replace(LEGACY_CONTINUITY_LINE_PLACEHOLDER, "{{continuityInstructions}}")
        .replace("{{sceneImagePrompt}}", "{{assetPrompt}}")
        .replace("{{sceneText}}", "{{assetPrompt}}")
        .replace("{{sceneNumber}}", "{{assetId}}")
        .trim(),
    ].filter(Boolean);
  });

  blocks = insertBlocksBeforePlaceholder(blocks, SCENE_TEMPLATE_EXTRA_DIRECTION_BLOCK, [
    SCENE_TEMPLATE_ASSET_ID_BLOCK,
    SCENE_TEMPLATE_ASSET_DERIVATION_BLOCK,
  ]);

  return dedupePromptBlocks(blocks).join("\n\n");
}

function normalizePromptTemplates(value: unknown): ShortFormNanoBananaPromptTemplates {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_NANO_BANANA_PROMPT_TEMPLATES,
      styleInstructionsTemplate: normalizeStyleInstructionsTemplate(DEFAULT_NANO_BANANA_PROMPT_TEMPLATES.styleInstructionsTemplate),
    };
  }

  const obj = value as Record<string, unknown>;
  return {
    styleInstructionsTemplate: normalizeStyleInstructionsTemplate(
      normalizePromptTemplateValue(obj.styleInstructionsTemplate, DEFAULT_NANO_BANANA_PROMPT_TEMPLATES.styleInstructionsTemplate),
    ),
    characterReferenceTemplate: normalizePromptTemplateValue(obj.characterReferenceTemplate, DEFAULT_NANO_BANANA_PROMPT_TEMPLATES.characterReferenceTemplate),
    sceneTemplate: normalizeSceneTemplate(normalizePromptTemplateValue(obj.sceneTemplate, DEFAULT_NANO_BANANA_PROMPT_TEMPLATES.sceneTemplate)),
  };
}

function defaultSettings(): ShortFormImageStyleSettings {
  return {
    defaultStyleId: DEFAULT_STYLE_ID,
    styles: [DEFAULT_STYLE],
    promptTemplates: normalizePromptTemplates(undefined),
  };
}

function normalizeSettings(value: unknown): ShortFormImageStyleSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSettings();
  }

  const obj = value as Record<string, unknown>;
  const styles = dedupeStyles(
    (Array.isArray(obj.styles) ? obj.styles : [])
      .map((style, index) => normalizeStyle(style, index))
      .filter((style): style is ShortFormImageStyle => Boolean(style))
  );

  const normalizedStyles = styles.length > 0 ? styles : [DEFAULT_STYLE];
  const requestedDefaultStyleId = typeof obj.defaultStyleId === "string" ? obj.defaultStyleId.trim() : "";
  const defaultStyleId = normalizedStyles.some((style) => style.id === requestedDefaultStyleId)
    ? requestedDefaultStyleId
    : normalizedStyles[0].id;

  return {
    defaultStyleId,
    styles: normalizedStyles,
    promptTemplates: normalizePromptTemplates(obj.promptTemplates),
  };
}

function normalizeSettingsForStorage(value: unknown): ShortFormImageStyleSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSettings();
  }

  const obj = value as Record<string, unknown>;
  const styles = dedupeStyles(
    (Array.isArray(obj.styles) ? obj.styles : [])
      .map((style, index) => normalizeStyleForStorage(style, index))
      .filter((style): style is ShortFormImageStyle => Boolean(style))
  );

  const normalizedStyles = styles.length > 0 ? styles : [DEFAULT_STYLE];
  const requestedDefaultStyleId = typeof obj.defaultStyleId === "string" ? obj.defaultStyleId.trim() : "";
  const defaultStyleId = normalizedStyles.some((style) => style.id === requestedDefaultStyleId)
    ? requestedDefaultStyleId
    : normalizedStyles[0].id;

  return {
    defaultStyleId,
    styles: normalizedStyles,
    promptTemplates: normalizePromptTemplates(obj.promptTemplates),
  };
}

export function getShortFormImageStyleSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return defaultSettings();

  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")));
  } catch {
    return defaultSettings();
  }
}

export function saveShortFormImageStyleSettings(nextSettings: ShortFormImageStyleSettings) {
  ensureSettingsDir();
  const normalizedForStorage = normalizeSettingsForStorage(nextSettings);
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(normalizedForStorage, null, 2), "utf-8");
  return normalizeSettings(normalizedForStorage);
}

export function saveShortFormImageStyleTestResult(styleId: string, testImage: ShortFormImageStyleTestImage) {
  const current = getShortFormImageStyleSettings();
  const nextSettings: ShortFormImageStyleSettings = {
    ...current,
    styles: current.styles.map((style) => (style.id === styleId ? { ...style, lastTestImage: testImage } : style)),
  };

  return saveShortFormImageStyleSettings(nextSettings);
}

export function getEffectiveShortFormStylePrompt(style: Pick<ShortFormImageStyle, "stylePrompt" | "references">) {
  const explicitPrompt = typeof style.stylePrompt === "string" ? style.stylePrompt.trim() : "";
  const references = Array.isArray(style.references) ? style.references : [];
  const hasReferences = references.length > 0;
  const hasCharacterReference = references.some((reference) => reference?.usageType === "character");

  const referenceGuidance = hasReferences
    ? [
        "Use the attached style/reference images as the primary source of truth for the visual medium, palette, rendering approach, lighting, and finish.",
        "Match the reference-driven look faithfully and keep it consistent across every scene.",
        "Do not impose a dark charcoal, monochrome, smoky, or red-accent house style unless those traits are clearly present in the attached references.",
        ...(hasCharacterReference
          ? [
              "When a primary character reference is attached, treat its face, hair, body proportions, and outfit as canonical. Preserve the same clothing, wardrobe silhouette, colors, and accessories across every scene unless the scene direction explicitly requests a change.",
            ]
          : []),
      ].join(" ")
    : "";

  return [explicitPrompt, referenceGuidance].filter(Boolean).join(" ").trim();
}

export function resolveShortFormImageStyle(styleId?: string | null) {
  const settings = getShortFormImageStyleSettings();
  const style = settings.styles.find((item) => item.id === styleId) || settings.styles.find((item) => item.id === settings.defaultStyleId) || settings.styles[0];
  const effectiveStylePrompt = getEffectiveShortFormStylePrompt(style);

  return {
    settings,
    style,
    resolvedStyleId: style.id,
    effectiveStylePrompt,
    combinedStylePrompt: effectiveStylePrompt,
  };
}

export function getDefaultShortFormNanoBananaPromptTemplates() {
  return normalizePromptTemplates(undefined);
}

export function normalizeShortFormNanoBananaPromptTemplates(value: unknown) {
  return normalizePromptTemplates(value);
}

export function getShortFormStyleTestsDir() {
  fs.mkdirSync(STYLE_TESTS_DIR, { recursive: true });
  return STYLE_TESTS_DIR;
}

export function getShortFormStyleReferenceImagesDir() {
  fs.mkdirSync(STYLE_REFERENCE_IMAGES_DIR, { recursive: true });
  return STYLE_REFERENCE_IMAGES_DIR;
}
