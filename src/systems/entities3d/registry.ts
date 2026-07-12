/**
 * @file registry.ts — the modular part catalog.
 *
 * One PartDef per component (horns, snout, sword, cape…). Adding a part =
 * one definition in a parts/ file + one registerPart call (mirrors the
 * asset-forge "one file + registry entry" pattern).
 *
 * No fallbacks: unknown ids and malformed definitions throw.
 */
import type { PartDef } from './types';
import { ANCHORS } from './types';

const parts = new Map<string, PartDef>();

export function registerPart(def: PartDef): void {
  if (parts.has(def.id)) {
    throw new Error(`entities3d: part "${def.id}" is already registered`);
  }
  if (!ANCHORS.includes(def.anchor)) {
    throw new Error(`entities3d: part "${def.id}" has unknown anchor "${def.anchor}"`);
  }
  if (def.kind === 'field' && typeof def.buildField !== 'function') {
    throw new Error(`entities3d: field part "${def.id}" must define buildField`);
  }
  if (def.kind === 'mesh' && typeof def.buildMesh !== 'function') {
    throw new Error(`entities3d: mesh part "${def.id}" must define buildMesh`);
  }
  parts.set(def.id, def);
}

export function getPart(id: string): PartDef {
  const def = parts.get(id);
  if (!def) {
    throw new Error(`entities3d: unknown part "${id}"`);
  }
  return def;
}

export function allParts(): PartDef[] {
  return [...parts.values()];
}

export function resetRegistryForTests(): void {
  parts.clear();
}
