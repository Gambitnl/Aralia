import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CLASSES_DATA } from '../src/data/classes';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator.ts';

type SpellManifestEntry = {
  name: string;
  level: number;
  school: string;
  path: string;
};

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'data', 'spells_manifest.json');

const loadManifest = (): Record<string, SpellManifestEntry> => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error('spells_manifest.json not found; run regenerate-manifest first.');
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw);
};

const main = () => {
  const manifest = loadManifest();
  const manifestIds = new Set(Object.keys(manifest));

  const missingFromManifest: { classId: string; spellId: string }[] = [];
  Object.values(CLASSES_DATA).forEach((cls) => {
    if (!cls.spellcasting?.spellList) return;
    cls.spellcasting.spellList.forEach((id) => {
      const key = String(id);
      if (!manifestIds.has(key)) {
        missingFromManifest.push({ classId: cls.id, spellId: key });
      }
    });
  });

  const wrongPath: string[] = [];
  const missingSpellFiles: string[] = [];
  const invalidSpells: { id: string; issues: string[] }[] = [];

  for (const [id, entry] of Object.entries(manifest)) {
    if (typeof entry.level !== 'number') continue;

    if (!entry.path.includes(`/level-${entry.level}/`)) {
      wrongPath.push(id);
    }

    const relativePath = entry.path.startsWith('/') ? entry.path.substring(1) : entry.path;
    const spellFilePath = path.join(process.cwd(), 'public', relativePath);
    if (!fs.existsSync(spellFilePath)) {
      missingSpellFiles.push(id);
      continue;
    }

    try {
      const spell = JSON.parse(fs.readFileSync(spellFilePath, 'utf-8'));
      SpellValidator.parse(spell);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        invalidSpells.push({
          id,
          issues: e.issues.slice(0, 10).map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        invalidSpells.push({ id, issues: [message] });
      }
    }
  }

  if (
    missingFromManifest.length === 0 &&
    wrongPath.length === 0 &&
    missingSpellFiles.length === 0 &&
    invalidSpells.length === 0
  ) {
    console.log('[Spell Integrity] All checks passed: class lists match manifest, spell files exist, schema validates.');
    return;
  }

  console.error('[Spell Integrity] Issues detected:');
  if (missingFromManifest.length > 0) {
    console.error(`  - Class spell lists reference ${missingFromManifest.length} missing IDs:`);
    missingFromManifest.slice(0, 10).forEach((m) => console.error(`      ${m.classId}: ${m.spellId}`));
    if (missingFromManifest.length > 10) console.error(`      ...and ${missingFromManifest.length - 10} more`);
  }
  if (wrongPath.length > 0) {
    console.error(`  - Manifest entries with wrong level folder: ${wrongPath.length}`);
    console.error(`      ${wrongPath.slice(0, 10).join(', ')}` + (wrongPath.length > 10 ? ' ...' : ''));
  }
  if (missingSpellFiles.length > 0) {
    console.error(`  - Missing spell JSON files: ${missingSpellFiles.length}`);
    console.error(
      `      ${missingSpellFiles.slice(0, 10).join(', ')}` + (missingSpellFiles.length > 10 ? ' ...' : ''),
    );
  }
  if (invalidSpells.length > 0) {
    console.error(`  - Spells failing schema validation: ${invalidSpells.length}`);
    invalidSpells.slice(0, 5).forEach((s) => {
      console.error(`      ${s.id}`);
      s.issues.forEach((i) => console.error(`        - ${i}`));
    });
    if (invalidSpells.length > 5) console.error(`      ...and ${invalidSpells.length - 5} more`);
  }

  process.exit(1);
};

main();

