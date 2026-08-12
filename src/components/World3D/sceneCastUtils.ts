/**
 * @file sceneCastUtils.ts
 * Pure helpers for 3D Scene Cast layout and recipe resolution.
 *
 * Extracted from SceneCast.tsx to decouple non-component helper exports
 * from TSX files, ensuring React Fast Refresh works cleanly in Vite.
 */
import type { EntityRecipe } from '@/systems/entities3d/types';
import type { SceneCastMember } from './SceneCast';

/**
 * Whether a cast figure is click-to-talk interactive: only NPC figures, and only
 * when a select handler is wired.
 */
export function figureIsInteractive(member: SceneCastMember, hasHandler: boolean): boolean {
  return hasHandler && !member.isPlayer;
}

/**
 * The one place an unspecified cast member becomes a body: an unarmed human
 * commoner, deterministic per member id.
 */
export function castMemberRecipe(member: SceneCastMember): EntityRecipe {
  if (member.recipe) return member.recipe;
  return {
    kind: 'humanoid',
    raceId: 'human',
    classId: 'fighter', // classId only tints accents; commoners carry no gear
    seed: `cast:${member.id}`,
    gearOverride: [],
  };
}

/**
 * Lay the cast out as a small face-to-face cluster: the player at the near edge
 * (+Z, toward the camera) and the NPCs in a shallow arc opposite, facing back.
 */
export function layoutCast(cast: SceneCastMember[]): Array<SceneCastMember & { pos: [number, number, number] }> {
  const player = cast.find((c) => c.isPlayer);
  const npcs = cast.filter((c) => !c.isPlayer);

  const out: Array<SceneCastMember & { pos: [number, number, number] }> = [];
  if (player) out.push({ ...player, pos: [0, 0, 2.2] });

  // Arc the NPCs across the far side, centered, ~3 m from the player.
  const n = npcs.length;
  const spread = 1.4; // metres between adjacent NPCs
  npcs.forEach((npc, i) => {
    const x = (i - (n - 1) / 2) * spread;
    const z = -1.0 - Math.abs(i - (n - 1) / 2) * 0.25; // gentle arc, ends pull back
    out.push({ ...npc, pos: [x, 0, z] });
  });

  return out;
}
