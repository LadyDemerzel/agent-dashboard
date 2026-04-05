import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { randomUUID } from "crypto";
import {
  getDefaultShortFormNanoBananaPromptTemplates,
  getEffectiveShortFormStylePrompt,
  getShortFormStyleReferenceImagesDir,
  getShortFormStyleTestsDir,
  saveShortFormImageStyleTestResult,
  type ShortFormImageStyle,
  type ShortFormNanoBananaPromptTemplates,
  type ShortFormStyleReferenceImage,
  type ShortFormStyleReferenceUsageType,
} from "@/lib/short-form-image-styles";

export const dynamic = "force-dynamic";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const XML_SCENE_IMAGES_SCRIPT = path.join(HOME_DIR, ".openclaw", "skills", "xml-scene-images", "scripts", "generate_from_xml.py");
const DEFAULT_IMAGE_MODEL = "google/gemini-3-pro-image-preview";
const DEFAULT_IMAGE_RESOLUTION = "1K";
const DEFAULT_IMAGE_ASPECT_RATIO = "9:16";
const DEFAULT_IMAGE_STYLE_PRESET = "dark-charcoal-natural-header";
const ALLOWED_REFERENCE_USAGE_TYPES: ShortFormStyleReferenceUsageType[] = ["general", "style", "character", "lighting", "composition", "palette"];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveStyleReferencePath(relativePath: string) {
  const baseDir = path.resolve(getShortFormStyleReferenceImagesDir());
  const absolutePath = path.resolve(baseDir, relativePath);
  if (absolutePath !== baseDir && !absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error(`Invalid style reference path: ${relativePath}`);
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Style reference image not found: ${relativePath}`);
  }
  return absolutePath;
}

function normalizeReferences(value: unknown): ShortFormStyleReferenceImage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((reference, index) => {
    if (!reference || typeof reference !== "object" || Array.isArray(reference)) return [];
    const item = reference as Record<string, unknown>;
    const imageRelativePath = typeof item.imageRelativePath === "string" ? item.imageRelativePath.trim() : "";
    if (!imageRelativePath) return [];

    return [{
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `reference-${index + 1}`,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : undefined,
      usageType:
        typeof item.usageType === "string" && ALLOWED_REFERENCE_USAGE_TYPES.includes(item.usageType as ShortFormStyleReferenceUsageType)
          ? (item.usageType as ShortFormStyleReferenceUsageType)
          : "general",
      usageInstructions:
        typeof item.usageInstructions === "string" && item.usageInstructions.trim()
          ? item.usageInstructions.trim()
          : "Use this reference as supporting visual context when helpful.",
      imageRelativePath,
      uploadedAt: typeof item.uploadedAt === "string" && item.uploadedAt.trim() ? item.uploadedAt.trim() : undefined,
    } satisfies ShortFormStyleReferenceImage];
  });
}


function normalizePromptTemplates(value: unknown): ShortFormNanoBananaPromptTemplates {
  const defaults = getDefaultShortFormNanoBananaPromptTemplates();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;

  const obj = value as Record<string, unknown>;
  return {
    styleInstructionsTemplate:
      typeof obj.styleInstructionsTemplate === "string" && obj.styleInstructionsTemplate.trim()
        ? obj.styleInstructionsTemplate.trim()
        : defaults.styleInstructionsTemplate,
    characterReferenceTemplate:
      typeof obj.characterReferenceTemplate === "string" && obj.characterReferenceTemplate.trim()
        ? obj.characterReferenceTemplate.trim()
        : defaults.characterReferenceTemplate,
    sceneTemplate:
      typeof obj.sceneTemplate === "string" && obj.sceneTemplate.trim()
        ? obj.sceneTemplate.trim()
        : defaults.sceneTemplate,
  };
}

function validateStyle(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("style is required");
  }

  const style = value as Partial<ShortFormImageStyle>;
  const id = typeof style.id === "string" ? style.id.trim() : "";
  const name = typeof style.name === "string" ? style.name.trim() : "";
  const subjectPrompt = typeof style.subjectPrompt === "string" ? style.subjectPrompt.trim() : "";
  const stylePrompt = typeof style.stylePrompt === "string" ? style.stylePrompt.trim() : "";

  if (!id || !name || !subjectPrompt) {
    throw new Error("style must include id, name, and subjectPrompt");
  }

  return {
    id,
    name,
    description: typeof style.description === "string" ? style.description.trim() : undefined,
    subjectPrompt,
    stylePrompt,
    headerPercent: Number.isFinite(Number(style.headerPercent)) ? Math.max(15, Math.min(45, Math.round(Number(style.headerPercent)))) : 28,
    testTopic: typeof style.testTopic === "string" && style.testTopic.trim() ? style.testTopic.trim() : "Style test",
    testCaption: typeof style.testCaption === "string" && style.testCaption.trim() ? style.testCaption.trim() : "Style test caption",
    testImagePrompt: typeof style.testImagePrompt === "string" && style.testImagePrompt.trim() ? style.testImagePrompt.trim() : "Single full-frame portrait for style testing.",
    references: normalizeReferences(style.references),
  } satisfies ShortFormImageStyle;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const style = validateStyle(body.style);
    const commonConstraints = typeof body.commonConstraints === "string" ? body.commonConstraints.trim() : "";
    if (!commonConstraints) {
      return NextResponse.json({ success: false, error: "commonConstraints is required" }, { status: 400 });
    }

    const runId = randomUUID();
    const runDir = path.join(getShortFormStyleTestsDir(), runId);
    const outputDir = path.join(runDir, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    const topic = collapseWhitespace(style.testTopic);
    const caption = collapseWhitespace(style.testCaption);
    const imagePrompt = collapseWhitespace(style.testImagePrompt);
    const effectiveStylePrompt = getEffectiveShortFormStylePrompt(style);
    const xmlPath = path.join(runDir, "style-test.xml");
    fs.writeFileSync(
      xmlPath,
      [
        "<video>",
        `  <topic>${escapeXml(topic)}</topic>`,
        `  <script>${escapeXml(caption)}</script>`,
        "  <scene>",
        `    <text>${escapeXml(caption)}</text>`,
        `    <image>${escapeXml(imagePrompt)}</image>`,
        "  </scene>",
        "</video>",
        "",
      ].join("\n"),
      "utf-8"
    );

    const promptTemplates = normalizePromptTemplates(body.promptTemplates);
    const characterReference = style.references.find((reference) => reference.usageType === "character");
    const extraReferences = style.references
      .filter((reference) => reference.id !== characterReference?.id)
      .map((reference) => ({
        path: resolveStyleReferencePath(reference.imageRelativePath),
        label: reference.label,
        usageType: reference.usageType,
        usageInstructions: reference.usageInstructions,
      }));
    const extraReferencesJsonPath = path.join(runDir, "style-references.json");
    fs.writeFileSync(extraReferencesJsonPath, JSON.stringify(extraReferences, null, 2), "utf-8");

    const args = [
      "run",
      "--with",
      "pillow",
      "python3",
      XML_SCENE_IMAGES_SCRIPT,
      xmlPath,
      "--output-dir",
      outputDir,
      "--model",
      DEFAULT_IMAGE_MODEL,
      "--resolution",
      DEFAULT_IMAGE_RESOLUTION,
      "--aspect-ratio",
      DEFAULT_IMAGE_ASPECT_RATIO,
      "--style-preset",
      DEFAULT_IMAGE_STYLE_PRESET,
      "--subject",
      style.subjectPrompt,
      "--common-constraints",
      commonConstraints,
      "--style-extra",
      effectiveStylePrompt,
      "--header-percent",
      String(style.headerPercent),
      "--extra-references-json",
      extraReferencesJsonPath,
      "--force",
    ];

    const promptTemplatesJsonPath = path.join(runDir, "nano-banana-prompt-templates.json");
    fs.writeFileSync(promptTemplatesJsonPath, JSON.stringify(promptTemplates, null, 2), "utf-8");
    args.push("--prompt-templates-json", promptTemplatesJsonPath);

    if (characterReference) {
      args.push("--character-reference", resolveStyleReferencePath(characterReference.imageRelativePath));
    }

    const result = spawnSync("uv", args, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 8 * 60 * 1000,
    });

    if (result.status !== 0) {
      const message = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join("\n\n") || "Style test generation failed";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }

    const cleanRelativePath = `${runId}/output/scene-01-uncaptioned-1080x1920.png`;
    const previewRelativePath = `${runId}/output/scene-01-captioned-1080x1920.png`;
    const cleanPath = path.join(getShortFormStyleTestsDir(), cleanRelativePath);
    const previewPath = path.join(getShortFormStyleTestsDir(), previewRelativePath);

    if (!fs.existsSync(cleanPath) && !fs.existsSync(previewPath)) {
      return NextResponse.json({ success: false, error: "Style test finished but no test image was created" }, { status: 500 });
    }

    const cleanImageUrl = fs.existsSync(cleanPath) ? `/api/short-form-videos/settings/style-tests/${cleanRelativePath}?v=${Date.now()}` : undefined;
    const previewImageUrl = fs.existsSync(previewPath) ? `/api/short-form-videos/settings/style-tests/${previewRelativePath}?v=${Date.now()}` : undefined;
    const updatedAt = new Date().toISOString();

    saveShortFormImageStyleTestResult(style.id, {
      runId,
      ...(cleanImageUrl ? { cleanRelativePath } : {}),
      ...(previewImageUrl ? { previewRelativePath } : {}),
      updatedAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        runId,
        ...(cleanImageUrl ? { cleanImageUrl, cleanRelativePath } : {}),
        ...(previewImageUrl ? { previewImageUrl, previewRelativePath } : {}),
        updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to run style test" },
      { status: 500 }
    );
  }
}
