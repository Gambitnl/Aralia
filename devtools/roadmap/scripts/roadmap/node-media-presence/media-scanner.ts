import * as fs from 'fs';
import * as path from 'path';

// Technical: file extensions recognised as roadmap preview media.
const MEDIA_EXTENSIONS = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg']);

/**
 * Technical: scans a directory and returns the bare stems of all recognised
 * media files (e.g. "spell-axis-engine" from "spell-axis-engine.png").
 * Layman: produces the lookup set used to stamp hasMedia on roadmap nodes.
 */
export function buildMediaSet(mediaDir: string): Set<string> {
  try {
    const files = fs.readdirSync(mediaDir) as string[];
    const stems = new Set<string>();
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (MEDIA_EXTENSIONS.has(ext)) {
        stems.add(path.basename(file, ext));
      }
    }
    return stems;
  } catch {
    return new Set();
  }
}

/**
 * Technical: checks whether a node id has a media file in the pre-built set.
 * Layman: returns true if this node has a capture ready to show.
 */
export function hasMediaFile(nodeId: string, mediaSet: Set<string>): boolean {
  return mediaSet.has(nodeId);
}
