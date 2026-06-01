import fs from "fs";

export interface XmlVisualEditState {
  number: number;
  visualId?: string;
  imageId?: string;
  prompt?: string;
  basedOn?: string;
  motionGraphicXml?: string;
}

export interface SaveXmlVisualEditsInput {
  sceneIndex: number;
  visualId?: string;
  imageId?: string;
  prompt?: string;
  basedOn?: string;
  motionGraphicXml?: string;
}

interface XmlNode {
  tagName: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  start: number;
  openEnd: number;
  closeStart?: number;
  end?: number;
  selfClosing?: boolean;
}

interface XmlDocument {
  tagName: "#document";
  children: XmlNode[];
}

const FRONT_MATTER_RE = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

function splitFrontMatter(content: string) {
  const match = content.match(FRONT_MATTER_RE);
  if (!match) return { prefix: "", body: content };
  return { prefix: match[0], body: content.slice(match[0].length) };
}

function decodeXml(value: string) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXmlText(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}

function parseXmlAttributes(raw: string) {
  const attributes: Record<string, string> = {};
  for (const match of raw.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    const key = match[1]?.trim();
    if (key) attributes[key] = decodeXml(match[3] || "");
  }
  return attributes;
}

function parseXmlElementName(rawTag: string) {
  return rawTag.match(/^<\s*\/?\s*([A-Za-z_:][\w:.-]*)/)?.[1] || "";
}

function parseXmlDocument(xml: string): XmlDocument {
  const document: XmlDocument = { tagName: "#document", children: [] };
  const stack: Array<XmlDocument | XmlNode> = [document];
  const tagPattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<[^>]+>/g;

  for (const match of xml.matchAll(tagPattern)) {
    const rawTag = match[0];
    const start = match.index || 0;
    if (rawTag.startsWith("<!--") || rawTag.startsWith("<?") || rawTag.startsWith("<![CDATA[") || rawTag.startsWith("<!")) {
      continue;
    }

    if (/^<\s*\//.test(rawTag)) {
      const tagName = parseXmlElementName(rawTag);
      const node = stack.pop();
      if (!node || node.tagName === "#document" || node.tagName !== tagName) {
        throw new Error(`Invalid XML: unexpected closing tag </${tagName}>.`);
      }
      const elementNode = node as XmlNode;
      elementNode.closeStart = start;
      elementNode.end = start + rawTag.length;
      continue;
    }

    const tagName = parseXmlElementName(rawTag);
    if (!tagName) throw new Error(`Invalid XML: could not parse tag at offset ${start}.`);
    const selfClosing = /\/\s*>$/.test(rawTag);
    const attrSource = rawTag
      .replace(/^<\s*[A-Za-z_:][\w:.-]*/, "")
      .replace(/\/?\s*>$/, "");
    const node: XmlNode = {
      tagName,
      attributes: parseXmlAttributes(attrSource),
      children: [],
      start,
      openEnd: start + rawTag.length,
      closeStart: selfClosing ? start + rawTag.length : undefined,
      end: selfClosing ? start + rawTag.length : undefined,
      selfClosing,
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }

  if (stack.length !== 1) {
    const unclosed = stack[stack.length - 1];
    throw new Error(`Invalid XML: unclosed <${unclosed.tagName}> element.`);
  }

  return document;
}

function getDirectChildren(node: XmlDocument | XmlNode | undefined, tagName?: string) {
  return (node?.children || []).filter((child) => !tagName || child.tagName === tagName);
}

function getFirstDirectChild(node: XmlDocument | XmlNode | undefined, tagName: string) {
  return getDirectChildren(node, tagName)[0];
}

function getVideoRoot(document: XmlDocument) {
  const roots = getDirectChildren(document).filter((child) => child.tagName !== "");
  if (roots.length !== 1 || roots[0].tagName !== "video") {
    throw new Error("XML visual plan must have a single <video> root element.");
  }
  return roots[0];
}

function getInnerText(xml: string, node: XmlNode | undefined) {
  if (!node || !Number.isInteger(node.openEnd) || !Number.isInteger(node.closeStart)) return "";
  return decodeXml(xml.slice(node.openEnd, node.closeStart));
}

function replaceInnerText(xml: string, node: XmlNode, nextText: string) {
  if (!Number.isInteger(node.openEnd) || !Number.isInteger(node.closeStart)) {
    throw new Error(`Cannot update <${node.tagName}> text because it is not a normal XML element.`);
  }
  return `${xml.slice(0, node.openEnd)}${escapeXmlText(nextText)}${xml.slice(node.closeStart)}`;
}

function replaceOpeningTagAttribute(xml: string, node: XmlNode, name: string, nextValue: string) {
  const attributes = { ...node.attributes };
  if (nextValue.trim()) {
    attributes[name] = nextValue.trim();
  } else {
    delete attributes[name];
  }
  const attrText = Object.entries(attributes)
    .map(([key, value]) => `${key}="${escapeXmlAttribute(value)}"`)
    .join(" ");
  const nextOpen = `<${node.tagName}${attrText ? ` ${attrText}` : ""}${node.selfClosing ? " />" : ">"}`;
  return `${xml.slice(0, node.start)}${nextOpen}${xml.slice(node.openEnd)}`;
}

function replaceNodeXml(xml: string, node: XmlNode, nextXml: string) {
  if (!Number.isInteger(node.end)) {
    throw new Error(`Cannot replace <${node.tagName}> because it is not closed.`);
  }
  return `${xml.slice(0, node.start)}${nextXml.trim()}${xml.slice(node.end)}`;
}

function parsePlan(content: string) {
  const { prefix, body } = splitFrontMatter(content);
  const document = parseXmlDocument(body);
  const root = getVideoRoot(document);
  return { prefix, body, root };
}

function findVisual(root: XmlNode, sceneIndex: number, visualId?: string) {
  const timeline = getFirstDirectChild(root, "timeline");
  const visuals = getDirectChildren(timeline, "visual");
  return visualId?.trim()
    ? visuals.find((visual) => visual.attributes.id === visualId.trim())
    : visuals[sceneIndex - 1];
}

function findImageAsset(root: XmlNode, imageId: string) {
  const assets = getFirstDirectChild(root, "assets");
  const assetImage = getDirectChildren(assets, "image").find((image) => image.attributes.id === imageId);
  if (assetImage) return assetImage;

  const timeline = getFirstDirectChild(root, "timeline");
  for (const visual of getDirectChildren(timeline, "visual")) {
    const inlineImage = getFirstDirectChild(visual, "image");
    if (!inlineImage) continue;
    const inlineImageId = inlineImage.attributes.id?.trim() || visual.attributes.id?.trim();
    if (inlineImageId === imageId || visual.attributes.id?.trim() === imageId) return inlineImage;
  }
  return undefined;
}

function validateMotionGraphicXml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Motion graphic XML cannot be empty.");
  const wrapped = `<root>${trimmed}</root>`;
  const document = parseXmlDocument(wrapped);
  const root = getDirectChildren(document, "root")[0];
  const children = getDirectChildren(root);
  if (children.length !== 1 || children[0].tagName !== "motionGraphic") {
    throw new Error("Motion graphic XML must contain exactly one <motionGraphic> element.");
  }
  return trimmed;
}

export function readXmlVisualEditStates(scriptPath: string): XmlVisualEditState[] {
  if (!fs.existsSync(scriptPath)) return [];
  const { body, root } = parsePlan(fs.readFileSync(scriptPath, "utf-8"));
  const assets = getFirstDirectChild(root, "assets");
  const timeline = getFirstDirectChild(root, "timeline");
  const imageAssets = new Map<string, XmlNode>();
  for (const image of getDirectChildren(assets, "image")) {
    const imageId = image.attributes.id?.trim();
    if (imageId) imageAssets.set(imageId, image);
  }

  return getDirectChildren(timeline, "visual").map((visual, index) => {
    const inlineImage = getFirstDirectChild(visual, "image");
    const visualId = visual.attributes.id?.trim() || undefined;
    const inlineImageId = inlineImage ? (inlineImage.attributes.id?.trim() || visualId) : undefined;
    if (inlineImage && inlineImageId) {
      imageAssets.set(inlineImageId, inlineImage);
      if (visualId) imageAssets.set(visualId, inlineImage);
    }
    const rawImageId = visual.attributes.imageId?.trim();
    const imageId = inlineImageId || rawImageId;
    const image = imageId ? imageAssets.get(imageId) : undefined;
    const prompt = image ? getInnerText(body, getFirstDirectChild(image, "prompt")).trim() : undefined;
    const motionGraphic = getFirstDirectChild(visual, "motionGraphic");
    return {
      number: index + 1,
      visualId,
      imageId: imageId || undefined,
      prompt,
      basedOn: image?.attributes.basedOn?.trim() || "",
      motionGraphicXml: motionGraphic && Number.isInteger(motionGraphic.end)
        ? body.slice(motionGraphic.start, motionGraphic.end).trim()
        : undefined,
    };
  });
}

export function saveXmlVisualEdits(scriptPath: string, input: SaveXmlVisualEditsInput) {
  if (!fs.existsSync(scriptPath)) throw new Error("XML visual plan does not exist yet.");
  if (!Number.isInteger(input.sceneIndex) || input.sceneIndex <= 0) {
    throw new Error("A valid scene index is required.");
  }

  const raw = fs.readFileSync(scriptPath, "utf-8");
  const parsed = parsePlan(raw);
  const { prefix } = parsed;
  let { body, root } = parsed;
  const visual = findVisual(root, input.sceneIndex, input.visualId);
  if (!visual) throw new Error(`Visual ${input.visualId || input.sceneIndex} was not found in the XML plan.`);

  const visualId = visual.attributes.id?.trim() || undefined;
  const inlineImage = getFirstDirectChild(visual, "image");
  const inlineImageId = inlineImage ? (inlineImage.attributes.id?.trim() || visualId) : undefined;
  const imageId = inlineImageId || visual.attributes.imageId?.trim();
  if (input.imageId?.trim() && imageId !== input.imageId.trim() && visual.attributes.imageId?.trim() !== input.imageId.trim()) {
    throw new Error(`Visual ${visualId || input.sceneIndex} points to image ${imageId || "(none)"}, not requested image ${input.imageId}.`);
  }

  let changed = false;

  if (input.prompt !== undefined || input.basedOn !== undefined) {
    if (!imageId) throw new Error(`Visual ${visualId || input.sceneIndex} has no imageId.`);
    const image = inlineImage || findImageAsset(root, imageId);
    if (!image) throw new Error(`Image asset ${imageId} was not found in the XML plan.`);

    if (input.prompt !== undefined) {
      const promptElement = getFirstDirectChild(image, "prompt");
      if (!promptElement) throw new Error(`Image asset ${imageId} has no <prompt>.`);
      const nextPrompt = input.prompt.trim();
      if (!nextPrompt) throw new Error("Image prompt cannot be empty.");
      if (getInnerText(body, promptElement).trim() !== nextPrompt) {
        body = replaceInnerText(body, promptElement, nextPrompt);
        changed = true;
      }
    }

    if (input.basedOn !== undefined) {
      ({ body, root } = parsePlan(`${prefix}${body}`));
      const refreshedVisual = findVisual(root, input.sceneIndex, input.visualId);
      const refreshedInlineImage = refreshedVisual ? getFirstDirectChild(refreshedVisual, "image") : undefined;
      const refreshedImageId = refreshedInlineImage
        ? (refreshedInlineImage.attributes.id?.trim() || refreshedVisual?.attributes.id?.trim())
        : refreshedVisual?.attributes.imageId?.trim();
      const refreshedImage = refreshedInlineImage || (refreshedImageId ? findImageAsset(root, refreshedImageId) : undefined);
      if (!refreshedImage) throw new Error(`Image asset ${imageId} was not found after prompt update.`);
      const nextBasedOn = input.basedOn.trim();
      if ((refreshedImage.attributes.basedOn || "").trim() !== nextBasedOn) {
        body = replaceOpeningTagAttribute(body, refreshedImage, "basedOn", nextBasedOn);
        changed = true;
      }
    }
  }

  if (input.motionGraphicXml !== undefined) {
    const nextMotionGraphicXml = validateMotionGraphicXml(input.motionGraphicXml);
    ({ body, root } = parsePlan(`${prefix}${body}`));
    const refreshedVisual = findVisual(root, input.sceneIndex, input.visualId);
    const motionGraphic = getFirstDirectChild(refreshedVisual, "motionGraphic");
    if (!motionGraphic) throw new Error(`Visual ${visualId || input.sceneIndex} has no inline <motionGraphic>.`);
    const currentMotionGraphicXml = body.slice(motionGraphic.start, motionGraphic.end).trim();
    if (currentMotionGraphicXml !== nextMotionGraphicXml) {
      body = replaceNodeXml(body, motionGraphic, nextMotionGraphicXml);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(scriptPath, `${prefix}${body.trim()}\n`, "utf-8");
  }

  return { changed };
}
