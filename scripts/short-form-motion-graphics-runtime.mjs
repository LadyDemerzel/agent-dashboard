import fs from "fs";
import path from "path";

const MOTION_GRAPHIC_PLACEHOLDER_PREFIX = "__motion_graphic_";

function finiteIndex(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function stripFrontMatter(content) {
  if (!String(content || "").startsWith("---")) return String(content || "").trim();
  const match = String(content || "").match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match ? match[1] : content).trim();
}

function resolveManifestMediaPath(value, baseDir) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(baseDir || process.cwd(), trimmed);
}

function sceneHasCurrentMotionGraphicVideo(scene, baseDir) {
  for (const key of ["motion_graphic_video", "preview_video"]) {
    const candidate = resolveManifestMediaPath(scene?.[key], baseDir);
    if (candidate && fs.existsSync(candidate)) return true;
  }
  return false;
}

function parseXmlAttributes(raw) {
  const attrs = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(raw || ""))) {
    attrs[match[1]] = match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function escapeXmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderXmlAttributes(attrs) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(([key, value]) => `${key}="${escapeXmlAttribute(value)}"`)
    .join(" ");
}

function motionGraphicIdFromScene(scene) {
  const explicit = typeof scene?.motion_graphic_id === "string" ? scene.motion_graphic_id.trim() : "";
  if (explicit) return explicit;
  const imageId = typeof scene?.image_id === "string" ? scene.image_id.trim() : "";
  return imageId.startsWith(MOTION_GRAPHIC_PLACEHOLDER_PREFIX)
    ? imageId.slice(MOTION_GRAPHIC_PLACEHOLDER_PREFIX.length)
    : "";
}

function motionGraphicScenesFromManifest(manifest, baseDir) {
  const byIndex = new Map();
  for (const scene of Array.isArray(manifest?.scenes) ? manifest.scenes : []) {
    const index = finiteIndex(scene?.index);
    if (index === null) continue;
    if (scene?.visual_type !== "motion_graphic") continue;
    const motionGraphicId = motionGraphicIdFromScene(scene);
    if (!motionGraphicId) continue;
    byIndex.set(index, {
      index,
      motionGraphicId,
      hasVideo: sceneHasCurrentMotionGraphicVideo(scene, baseDir),
    });
  }
  return byIndex;
}

function parseSourceMotionGraphicBlocks(sourceXml) {
  const blocks = new Map();
  const assetsBody = String(sourceXml || "").match(/<assets\b[^>]*>([\s\S]*?)<\/assets>/i)?.[1] || "";
  for (const match of assetsBody.matchAll(/<motionGraphic\b([^>]*)>[\s\S]*?<\/motionGraphic>/gi)) {
    const attrs = parseXmlAttributes(match[1] || "");
    const id = typeof attrs.id === "string" ? attrs.id.trim() : "";
    if (id && !blocks.has(id)) blocks.set(id, match[0].trim());
  }
  const timelineBody = String(sourceXml || "").match(/<timeline\b[^>]*>([\s\S]*?)<\/timeline>/i)?.[1] || "";
  let visualIndex = 0;
  for (const visualMatch of timelineBody.matchAll(/<visual\b([^>]*?)(?:\/>|>([\s\S]*?)<\/visual>)/gi)) {
    visualIndex += 1;
    const visualAttrs = parseXmlAttributes(visualMatch[1] || "");
    const visualBody = visualMatch[2] || "";
    const motionMatch = visualBody.match(/<motionGraphic\b([^>]*)>[\s\S]*?<\/motionGraphic>/i);
    if (!motionMatch) continue;
    const motionAttrs = parseXmlAttributes(motionMatch[1] || "");
    const id = String(motionAttrs.id || visualAttrs.motionGraphicId || visualAttrs.motionId || visualAttrs.motionGraphic || visualAttrs.id || `visual-${visualIndex}`).trim();
    if (id && !blocks.has(id)) blocks.set(id, motionMatch[0].trim());
  }
  return blocks;
}

function addOrUpdateMotionGraphicVisual(fullVisualTag, motionGraphicId, motionGraphicBlock) {
  const normalizedBlock = typeof motionGraphicBlock === "string" && motionGraphicBlock.trim()
    ? motionGraphicBlock.trim().replace(/\n/g, "\n    ")
    : "";
  const wasSelfClosing = /\/>\s*$/.test(String(fullVisualTag || ""));
  const withAttrs = fullVisualTag.replace(/<visual\b([^>]*?)(\/?)>/i, (_tag, rawAttrs, selfClosing) => {
    const attrs = parseXmlAttributes(rawAttrs || "");
    attrs.visualType = "motion_graphic";
    delete attrs.motionGraphicId;
    delete attrs.motionId;
    delete attrs.motionGraphic;

    const placeholderId = `${MOTION_GRAPHIC_PLACEHOLDER_PREFIX}${motionGraphicId}`;
    if (attrs.imageId === placeholderId) {
      delete attrs.imageId;
    }

    const renderedAttrs = renderXmlAttributes(attrs);
    return `<visual${renderedAttrs ? ` ${renderedAttrs}` : ""}${selfClosing && !normalizedBlock ? " /" : ""}>`;
  });
  if (!normalizedBlock || /<motionGraphic\b/i.test(withAttrs)) return withAttrs;
  if (wasSelfClosing) {
    return withAttrs.replace(/>\s*$/, `>\n    ${normalizedBlock}\n  </visual>`);
  }
  return withAttrs.replace(/<\/visual>\s*$/i, `  ${normalizedBlock}\n  </visual>`);
}

function removePlaceholderImageAssets(xml, motionGraphicIds) {
  let next = String(xml || "");
  for (const id of motionGraphicIds) {
    const placeholderId = `${MOTION_GRAPHIC_PLACEHOLDER_PREFIX}${id}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`\\s*<image\\b(?=[^>]*\\bid=["']${placeholderId}["'])[^>]*>[\\s\\S]*?<\\/image>`, "gi"), "");
    next = next.replace(new RegExp(`\\s*<image\\b(?=[^>]*\\bid=["']${placeholderId}["'])[^>]*/>`, "gi"), "");
  }
  return next;
}

export function hydrateMotionGraphicVisualTypes(xml, sceneManifest, options = {}) {
  const motionScenes = motionGraphicScenesFromManifest(sceneManifest, options.baseDir);
  if (motionScenes.size === 0) {
    return { xml, hydratedIndexes: [], injectedMotionGraphicIds: [], removedPlaceholderImageIds: [] };
  }

  const sourceMotionGraphicBlocks = options.sourceXml
    ? parseSourceMotionGraphicBlocks(stripFrontMatter(options.sourceXml))
    : new Map();

  const hydratedIndexes = [];
  const hydratedMotionGraphicIds = [];
  let visualIndex = 0;
  let nextXml = String(xml || "").replace(/<visual\b([^>]*?)(?:\/>|>[\s\S]*?<\/visual>)/gi, (full) => {
    visualIndex += 1;
    const motionScene = motionScenes.get(visualIndex);
    if (!motionScene) return full;
    hydratedIndexes.push(visualIndex);
    hydratedMotionGraphicIds.push(motionScene.motionGraphicId);
    return addOrUpdateMotionGraphicVisual(full, motionScene.motionGraphicId, sourceMotionGraphicBlocks.get(motionScene.motionGraphicId));
  });

  const uniqueMotionGraphicIds = [...new Set(hydratedMotionGraphicIds)];
  nextXml = removePlaceholderImageAssets(nextXml, uniqueMotionGraphicIds);

  return {
    xml: nextXml,
    hydratedIndexes,
    injectedMotionGraphicIds: uniqueMotionGraphicIds.filter((id) => sourceMotionGraphicBlocks.has(id)),
    removedPlaceholderImageIds: uniqueMotionGraphicIds.map((id) => `${MOTION_GRAPHIC_PLACEHOLDER_PREFIX}${id}`),
  };
}

export function hydrateRuntimeXmlMotionGraphicsFromManifest(runtimeXmlPath, sceneManifestPath, options = {}) {
  if (!runtimeXmlPath || !sceneManifestPath || !fs.existsSync(runtimeXmlPath) || !fs.existsSync(sceneManifestPath)) {
    return [];
  }

  const manifest = JSON.parse(fs.readFileSync(sceneManifestPath, "utf-8"));
  const sourceXml = options.sourceXmlPath && fs.existsSync(options.sourceXmlPath)
    ? fs.readFileSync(options.sourceXmlPath, "utf-8")
    : undefined;
  const runtimeXml = fs.readFileSync(runtimeXmlPath, "utf-8");
  const { xml, hydratedIndexes } = hydrateMotionGraphicVisualTypes(runtimeXml, manifest, {
    baseDir: path.dirname(sceneManifestPath),
    sourceXml,
  });

  if (hydratedIndexes.length > 0 && xml !== runtimeXml) {
    fs.writeFileSync(runtimeXmlPath, xml.trimEnd() + "\n", "utf-8");
  }
  return hydratedIndexes;
}
