import path from "path";

const SETTINGS_DIR = path.join(process.cwd(), "settings", "short-form-video");

export function getVersionedShortFormSettingsPath(filename: string) {
  return path.join(SETTINGS_DIR, filename);
}
