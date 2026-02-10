#!/usr/bin/env npx tsx
/**
 * Lists all slice-of-life settings/activities already used for race portraits.
 *
 * Source: public/assets/images/races/race-image-status.json (stored prompts).
 *
 * Output:
 * - scripts/audits/slice-of-life-settings.md
 * - scripts/audits/slice-of-life-settings.json
 */

import fs from 'fs';
import path from 'path';

type Entry = {
  race: string;
  gender: string;
  prompt: string;
  downloadedAt?: string;
  imagePath?: string;
};

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, 'public', 'assets', 'images', 'races', 'race-image-status.json');
const OUT_MD = path.join(ROOT, 'scripts', 'audits', 'slice-of-life-settings.md');
const OUT_JSON = path.join(ROOT, 'scripts', 'audits', 'slice-of-life-settings.json');

function extractLine(prompt: string, label: string): string | null {
  if (typeof prompt !== 'string' || !prompt) return null;
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, 'mi');
  return prompt.match(re)?.[1]?.trim() ?? null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function main() {
  if (!fs.existsSync(STATUS_PATH)) {
    console.error(`[slice-of-life] Missing status file: ${STATUS_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')) as { entries?: Entry[] };
  const entries = Array.isArray(raw.entries) ? raw.entries : [];

  const rows = entries.map((e) => {
    const role = extractLine(e.prompt, 'Role') ?? extractLine(e.prompt, 'Slice-of-life action') ?? '';
    const background = extractLine(e.prompt, 'Background') ?? '';
    return {
      race: e.race,
      gender: e.gender,
      role,
      background,
      downloadedAt: e.downloadedAt ?? '',
      imagePath: e.imagePath ?? '',
    };
  });

  // Unique activities/settings list.
  const uniqueRoles = new Map<string, string>();
  const uniqueBackgrounds = new Map<string, string>();
  for (const r of rows) {
    if (r.role) uniqueRoles.set(normalize(r.role), r.role);
    if (r.background) uniqueBackgrounds.set(normalize(r.background), r.background);
  }

  const rolesList = [...uniqueRoles.values()].sort((a, b) => a.localeCompare(b));
  const backgroundsList = [...uniqueBackgrounds.values()].sort((a, b) => a.localeCompare(b));

  const md = [
    '# Slice-of-Life Settings Used (Race Portraits)',
    '',
    `Generated from: \`${path.relative(ROOT, STATUS_PATH).replace(/\\/g, '/')}\``,
    '',
    '## Unique Roles / Activities',
    '',
    ...rolesList.map((x) => `- ${x}`),
    '',
    '## Unique Backgrounds',
    '',
    ...backgroundsList.map((x) => `- ${x}`),
    '',
    '## Per Image (Race, Gender -> Role / Background)',
    '',
    ...rows
      .slice()
      .sort((a, b) => `${a.race}:${a.gender}`.localeCompare(`${b.race}:${b.gender}`))
      .map((r) => `- ${r.race} (${r.gender}): ${r.role || '(no role found)'}${r.background ? ` | ${r.background}` : ''}`),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, md, 'utf8');
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ uniqueRoles: rolesList, uniqueBackgrounds: backgroundsList, rows }, null, 2) + '\n',
    'utf8'
  );

  console.log(`[slice-of-life] Wrote ${path.relative(ROOT, OUT_MD)} and ${path.relative(ROOT, OUT_JSON)}`);
}

main();
