import * as fs from 'node:fs';
import * as path from 'node:path';
import { nativeImage } from 'electron';
import { agentDir } from './persona';

/**
 * Custom agent avatars live next to the persona as a single fixed-name PNG:
 * ${COCO_HOME}/agents/<id>/icon.png
 *
 * The DB only stores the sentinel 'custom', so the file name never has to be
 * tracked (and the agent folder stays a self-contained backup unit).
 */
const ICON_FILE = 'icon.png';

/** Longest edge of the stored avatar; uploads are downscaled to this. */
const MAX_EDGE = 256;

export function agentIconPath(agentId: string): string {
  return path.join(agentDir(agentId), ICON_FILE);
}

/**
 * Decode a user-picked image, normalise it to a <=256px PNG and store it.
 * Throws when the file is not a decodable image so the error surfaces in the UI.
 */
export function saveUploadedIcon(agentId: string, sourcePath: string): void {
  const image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) {
    throw new Error('所选文件不是支持的图片格式，请选择 PNG 或 JPG 图片。');
  }

  const { width, height } = image.getSize();
  const longest = Math.max(width, height);
  const normalized =
    longest > MAX_EDGE
      ? image.resize({
          width: Math.round((width * MAX_EDGE) / longest),
          height: Math.round((height * MAX_EDGE) / longest),
        })
      : image;

  fs.mkdirSync(agentDir(agentId), { recursive: true });
  fs.writeFileSync(agentIconPath(agentId), normalized.toPNG());
}

/** Remove a stored avatar, if any. Best-effort: the DB row is the truth. */
export function removeIconFile(agentId: string): void {
  try {
    fs.rmSync(agentIconPath(agentId), { force: true });
  } catch {
    // Nothing to clean up.
  }
}

/** The stored avatar as a data URL, or null when the agent has no file. */
export function readIconDataUrl(agentId: string): string | null {
  try {
    const file = agentIconPath(agentId);
    if (!fs.existsSync(file)) return null;
    return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}
