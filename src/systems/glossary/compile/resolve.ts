/**
 * Term resolution for the glossary compiler: id/alias → renderable target.
 * Mirrors the loadability rule the legacy renderer used (spells need
 * hasSpellJson, everything else needs a filePath); grouping/container
 * nodes never resolve.
 */

import type { TermRef } from '../contentModel';
import type { ResolveContext } from './compileEntry';

export interface BundleEntryLike {
  id: string;
  title: string;
  category: string;
  aliases?: string[];
  seeAlso?: string[];
  filePath?: string;
  hasSpellJson?: boolean;
  subEntries?: BundleEntryLike[];
}

const normalizeAlias = (alias: string): string =>
  alias.toLowerCase().replace(/\s+/g, '_');

export function isRenderable(entry: BundleEntryLike): boolean {
  return entry.category === 'Spells' ? !!entry.hasSpellJson : !!entry.filePath;
}

export function buildResolveContext(
  bundle: BundleEntryLike[],
): ResolveContext {
  const targets = new Map<string, TermRef>();

  const walk = (entries: BundleEntryLike[]) => {
    for (const entry of entries) {
      if (isRenderable(entry)) {
        const ref: TermRef = {
          id: entry.id,
          kind: entry.category === 'Spells' ? 'spell' : 'entry',
        };
        targets.set(entry.id, ref);
        for (const alias of entry.aliases ?? []) {
          targets.set(normalizeAlias(alias), ref);
        }
      }
      if (entry.subEntries) walk(entry.subEntries);
    }
  };
  walk(bundle);

  return {
    resolve: (token) => targets.get(token) ?? targets.get(normalizeAlias(token)) ?? null,
  };
}
