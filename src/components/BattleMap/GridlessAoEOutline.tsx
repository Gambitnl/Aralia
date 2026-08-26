/**
 * @file src/components/BattleMap/GridlessAoEOutline.tsx
 * Euclidean (gridless) area-of-effect outline for the 3D battle map. While an
 * area ability is aimed, the tile decals show the snapped tile set; this draws
 * the TRUE shape from calculateAffectedArea as a line loop just above the
 * ground, so a cone reads as a cone and a sphere as a circle (agora-79fa.2,
 * GG-211, 2026-09-13).
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { Ability, CombatCharacter, CombatState, Position } from '../../types/combat';
import { calculateAffectedArea } from '../../utils/combat/aoeCalculations';
import { resolveAoEParams } from '../../utils/spatial/targetingUtils';

const TILE_WORLD_SIZE = 1.0;
const LIFT = 0.06;

export interface GridlessAoEOutlineProps {
  aoePreview: CombatState['aoePreview'] | null | undefined;
  caster: CombatCharacter | null | undefined;
  groundSampler: ((x: number, z: number) => number) | null;
}

/**
 * Build the polygon the preview describes, in map units, or null when the
 * ability has no area. Uses the SAME parameter resolution as the tile preview
 * (resolveAoEParams: tiles -> feet, caster-origin cones and lines), so the
 * outline and the decals never disagree about size or aim.
 */
export function polygonForPreview(
  preview: { center: Position; ability: Ability } | null | undefined,
  caster: CombatCharacter | null | undefined,
) {
  const area = preview?.ability?.areaOfEffect;
  if (!preview || !area) return null;
  const params = resolveAoEParams(area, preview.center, caster ?? undefined, preview.ability.name);
  if (!params) return null;
  return calculateAffectedArea(params);
}

export const GridlessAoEOutline: React.FC<GridlessAoEOutlineProps> = ({ aoePreview, caster, groundSampler }) => {
  const geometry = useMemo(() => {
    const poly = polygonForPreview(aoePreview, caster ?? null);
    if (!poly || poly.vertices.length < 3) return null;
    const pts = poly.vertices.map((v) => {
      const x = (v.x + 0.5) * TILE_WORLD_SIZE;
      const z = (v.y + 0.5) * TILE_WORLD_SIZE;
      const y = (groundSampler ? groundSampler(x, z) : 0) + LIFT;
      return new THREE.Vector3(x, y, z);
    });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [aoePreview, caster, groundSampler]);

  const material = useMemo(() => new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, depthTest: false }), []);

  if (!geometry) return null;
  // eslint-disable-next-line react/no-unknown-property
  return <lineLoop geometry={geometry} material={material} renderOrder={50} />;
};

export default GridlessAoEOutline;
