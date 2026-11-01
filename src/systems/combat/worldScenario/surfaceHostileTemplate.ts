/**
 * Resolve a source-placed creature before the proximity handoff builds enemies.
 * The ground table owns its declaration; the bestiary owns executable stats.
 * A disagreement is visible missing content, never permission to scale a fallback.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:35:38
 * Dependents: components/World3D/hooks/useInPlaceCombatTransition.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundHostile } from '../../worldforge/bridge/groundChunkLoader';
import type { Monster } from '../../../types';
import { declaredGroundHostileChallengeRating } from '../../worldforge/bridge/groundHostiles';
import { ensureMonsterRegistryLoaded, getMonster } from '../../../data/adapters/runtimeMonsterRegistry';
import { formatChallengeRating, parseChallengeRating } from '../../../utils/combat/createEnemyFromMonster';

export type SurfaceHostileTemplateResult =
  | { status: 'ready'; monster: Monster }
  | { status: 'source-gap'; detail: string };

export async function resolveSurfaceHostileTemplate(
  hostile: Pick<GroundHostile, 'id' | 'name' | 'monsterId'>,
): Promise<SurfaceHostileTemplateResult> {
  if (!hostile.id?.trim() || !hostile.monsterId?.trim() || !hostile.name?.trim()) {
    return { status: 'source-gap', detail: 'The source creature is missing its identity or bestiary template.' };
  }
  await ensureMonsterRegistryLoaded();
  const data = getMonster(hostile.monsterId);
  if (!data) {
    return { status: 'source-gap', detail: `Its ${hostile.monsterId} bestiary template is unavailable.` };
  }
  const rawCR = data.baseStats?.cr;
  const hasValidCR = typeof rawCR === 'number'
    ? Number.isFinite(rawCR) && rawCR >= 0
    : typeof rawCR === 'string' && /^(?:\d+(?:\.\d+)?|\d+\/\d+)$/.test(rawCR.trim());
  // Validate the original fraction before display formatting: formatting a
  // malformed "1/0" first would otherwise conceal the bad denominator as CR1.
  const numericCR = typeof rawCR === 'number' ? rawCR : parseChallengeRating(rawCR);
  const cr = formatChallengeRating(numericCR);
  if (!hasValidCR || !data.id?.trim() || numericCR === undefined || numericCR < 0 || !Number.isFinite(data.maxHP) || data.maxHP <= 0 || !Number.isFinite(data.armorClass)) {
    return { status: 'source-gap', detail: `Its ${data.name} bestiary profile has incomplete combat statistics.` };
  }
  const declaredCR = declaredGroundHostileChallengeRating(hostile);
  if (declaredCR !== undefined && parseChallengeRating(declaredCR) !== numericCR) {
    return {
      status: 'source-gap',
      detail: `Its source declares CR ${declaredCR}, but the ${data.name} template is CR ${cr}.`,
    };
  }
  return {
    status: 'ready',
    monster: { id: data.id, name: hostile.name, quantity: 1, cr, description: `Source-placed ${hostile.name}.` },
  };
}
