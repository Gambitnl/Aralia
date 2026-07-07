/**
 * Shared, resolve-aware term-link helpers used by both the PHB ingest
 * (scripts/ingestPhbGlossary.ts) and the legacy-markup codemod
 * (scripts/glossary/fix-legacy-entry-markup.ts).
 *
 * The glossary compiler (src/systems/glossary/compile/compileEntry.ts) treats
 * any `[[id|display]]` whose id doesn't resolve as an error. These helpers let
 * the build pipeline emit links that always resolve — repairing echo-corrupted
 * ids, rewriting underscore spell ids to their real hyphenated form, and
 * unlinking anything with no target to plain text (content preserved).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const normalizeToken = (t: string): string =>
  t.toLowerCase().replace(/\s+/g, '_');

/**
 * Build the set of resolvable term ids the way the runtime resolver does, but
 * from the on-disk source of truth so it works during the build (before the
 * glossary bundle exists):
 *   - every entry JSON under public/data/glossary/entries/** with a filePath
 *     contributes its id and its normalized aliases;
 *   - every spell in public/data/spells_manifest.json that has a spell JSON
 *     file contributes its (hyphenated) id and normalized aliases.
 */
export function buildResolvableIdSet(root: string): Set<string> {
  const set = new Set<string>();
  const entriesBase = path.join(root, 'public/data/glossary/entries');

  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json') && e.name !== '.generated-manifest.json') {
        let j: any;
        try {
          j = JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch {
          continue;
        }
        // Mirror the runtime resolver: a non-spell entry is renderable if it
        // has a filePath (i.e. it is a real entry file). We don't require a
        // `markdown` field — rich-schema entries (races) and structured
        // `content[]` entries (lockpicking, traps) are valid link targets too.
        if (j && j.id) {
          set.add(j.id);
          for (const a of j.aliases ?? []) set.add(normalizeToken(a));
        }
      }
    }
  };
  if (fs.existsSync(entriesBase)) walk(entriesBase);

  // Spells (hyphenated ids).
  const manifestPath = path.join(root, 'public/data/spells_manifest.json');
  const spellsDir = path.join(root, 'public/data/spells');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const [id, spell] of Object.entries<any>(manifest)) {
      if (typeof spell.level !== 'number') continue;
      const file = path.join(spellsDir, `level-${spell.level}`, `${id}.json`);
      if (fs.existsSync(file)) {
        set.add(id);
        for (const a of spell.aliases ?? []) set.add(normalizeToken(a));
      }
    }
  } catch {
    /* spells manifest optional */
  }
  return set;
}

/**
 * Repair an echo-corrupted token: `hit_points Points` -> `hit_points`,
 * `artisan_s_tools's Tools` -> `artisan_s_tools`, `saving_throw throw` ->
 * `saving_throw`. Cuts at the first space (the tail is an echoed display
 * fragment, never part of the id) and strips a trailing apostrophe echo.
 */
export function repairToken(token: string): string {
  let t = token.trim();
  const sp = t.indexOf(' ');
  if (sp >= 0) t = t.slice(0, sp);
  t = t.replace(/['’].*$/, '');
  return t;
}

export interface TermLinkEmitter {
  /** True if `token` (as-is or normalized) resolves to renderable content. */
  resolves(token: string): boolean;
  /**
   * Emit `[[id|display]]` for a resolving link, or plain display text if the
   * token cannot be resolved by any repair. Never drops the display text.
   */
  emit(token: string, display: string): string;
}

export function makeEmitter(resolvableIds: Set<string>): TermLinkEmitter {
  const resolves = (token: string): boolean => {
    const t = token.trim();
    return resolvableIds.has(t) || resolvableIds.has(normalizeToken(t));
  };
  const emit = (token: string, display: string): string => {
    const disp = display.trim();
    const raw = token.trim();
    const link = (id: string) =>
      disp && normalizeToken(disp) !== id ? `[[${id}|${disp}]]` : `[[${id}]]`;

    if (resolves(raw)) return link(raw);

    const repaired = repairToken(raw);
    if (repaired !== raw && resolves(repaired)) return link(repaired);

    // Spell/kebab ids are hyphenated in the data (cure-wounds) while glossary
    // markdown links use underscores (cure_wounds). Rewrite to the real id.
    const hyphen = repaired.replace(/_/g, '-');
    if (resolvableIds.has(hyphen)) return link(hyphen);

    // Nothing resolves: unlink to plain display text (content preserved).
    return disp || raw.replace(/[_-]/g, ' ');
  };
  return { resolves, emit };
}

/**
 * Rewrite all term-link shorthand already present in a markdown string —
 * `[[id]]`, `[[id|display]]`, `{{id}}`, and `<g t="id">display</g>` — through
 * the emitter, so unresolvable/corrupted links are repaired or unlinked.
 * Idempotent.
 */
export function repairMarkdownLinks(md: string, emitter: TermLinkEmitter): string {
  let out = md;
  out = out.replace(/<g\s+t="([^"]+)"(?:\s+c="[^"]*")?>([\s\S]*?)<\/g>/g, (_, t, d) =>
    emitter.emit(t, d),
  );
  out = out.replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (_, t, d) => emitter.emit(t, d ?? ''));
  out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, d) => emitter.emit(t, d ?? ''));
  return out;
}

/**
 * Filter a seeAlso token array to resolvable targets, repairing echo-corrupted
 * tokens first. Unresolvable tokens are dropped (they'd render as dead links).
 */
export function repairSeeAlso(seeAlso: string[], emitter: TermLinkEmitter): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of seeAlso ?? []) {
    let id: string | null = null;
    if (emitter.resolves(raw)) id = raw.trim();
    else {
      const repaired = repairToken(raw);
      if (emitter.resolves(repaired)) id = repaired;
      else {
        const hyphen = repaired.replace(/_/g, '-');
        if (emitter.resolves(hyphen)) id = hyphen;
      }
    }
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
