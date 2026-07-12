/**
 * @file parts/index.ts — registers the whole modular part catalog.
 *
 * Adding a part: define it in the matching family file (or a new one) and
 * include it in that file's exported array. This registrar is idempotent so
 * tests and app entry points can both call it safely.
 */
import { registerPart, allParts } from '../registry';
import { FIELD_PARTS } from './fieldParts';
import { HEAD_PARTS } from './headParts';
import { WEAPON_PARTS } from './gearWeapons';
import { ARMOR_PARTS } from './gearArmor';
import { WING_PARTS } from './wingParts';

export function registerAllParts(): void {
  const registered = new Set(allParts().map((p) => p.id));
  for (const def of [...FIELD_PARTS, ...HEAD_PARTS, ...WEAPON_PARTS, ...ARMOR_PARTS, ...WING_PARTS]) {
    if (!registered.has(def.id)) {
      registerPart(def);
    }
  }
}
