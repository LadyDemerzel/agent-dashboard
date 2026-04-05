import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getShortFormStyleReferenceImagesDir } from "@/lib/short-form-image-styles";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const styleId = typeof formData.get("styleId") === "string" ? String(formData.get("styleId")).trim() : "style";
    const label = typeof formData.get("label") === "string" ? String(formData.get("label")).trim() : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: "Unsupported file type" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.length) {
      return NextResponse.json({ success: false, error: "Uploaded file is empty" }, { status: 400 });
    }

    const baseDir = getShortFormStyleReferenceImagesDir();
    const styleDirName = slugify(styleId) || "style";
    const styleDir = path.join(baseDir, styleDirName);
    fs.mkdirSync(styleDir, { recursive: true });

    const extension = EXT_BY_CONTENT_TYPE[file.type] || path.extname(file.name || "").toLowerCase() || ".png";
    const baseName = slugify(label || file.name || "reference") || "reference";
    const fileName = `${baseName}-${randomUUID()}${extension}`;
    const absolutePath = path.join(styleDir, fileName);
    fs.writeFileSync(absolutePath, bytes);

    const relativePath = path.relative(baseDir, absolutePath).split(path.sep).join("/");
    return NextResponse.json({
      success: true,
      data: {
        imageRelativePath: relativePath,
        imageUrl: `/api/short-form-videos/settings/style-references/${relativePath}?v=${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to upload style reference image" },
      { status: 500 }
    );
  }
}
