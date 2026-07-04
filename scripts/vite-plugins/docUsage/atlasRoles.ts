import fs from 'fs';

export function loadAtlasRoles(exportPath: string): { roles: Map<string, string>; atlasMissing: boolean } {
  const roles = new Map<string, string>();
  let raw: string;
  try { raw = fs.readFileSync(exportPath, 'utf-8'); } catch { return { roles, atlasMissing: true }; }
  try {
    const parsed = JSON.parse(raw);
    for (const d of parsed.documents || []) {
      if (d && d.relativePath && d.docRole) roles.set(String(d.relativePath).replace(/\\/g, '/'), String(d.docRole));
    }
  } catch { return { roles, atlasMissing: true }; }
  return { roles, atlasMissing: false };
}
