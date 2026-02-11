import fs from "fs";
import path from "path";

/**
 * Delete a deliverable and all its companion files
 * (versions, status log, feedback).
 * Also removes the parent directory if it becomes empty.
 */
export function deleteDeliverable(filePath: string): { deleted: string[] } {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ".md");

  const companions = [
    filePath,
    path.join(dir, `${base}-versions.json`),
    path.join(dir, `${base}-status-log.json`),
    path.join(dir, `${base}-feedback.json`),
  ];

  const deleted: string[] = [];
  for (const file of companions) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      deleted.push(path.basename(file));
    }
  }

  // Clean up empty parent directory (e.g. date folders for x-posts)
  try {
    const remaining = fs.readdirSync(dir);
    if (remaining.length === 0) {
      fs.rmdirSync(dir);
      deleted.push(`${path.basename(dir)}/`);
    }
  } catch {
    // Directory may not exist or have permissions issues — ignore
  }

  return { deleted };
}
