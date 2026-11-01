/** The expedition uses the same race and equipped-gear body as town play.
 * Rendering a figure never owns footing, movement, resources or the save ledger. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 19:58:39
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useEffect, useMemo, useRef} from 'react';
import {Html} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {MeshStandardMaterial, type Material, type Mesh, type MeshToonMaterial, type Object3D} from 'three';
import type {PlayerCharacter} from '../../../types/character';
import {registerAllParts} from '../../../systems/entities3d/parts';
import {generateEntityBlueprint} from '../../../systems/entities3d/generateEntityBlueprint';
import {recipeFromCharacter} from '../../../systems/entities3d/recipeFromCharacter';
import {heightM} from '../../../systems/entities3d/types';
import {EntityModel} from '../characters/characterActor/EntityModel';

registerAllParts();

/** Reuse the source body's colors and geometry with the dungeon's lit material
 * response. Materials belong to this assembled figure and its existing disposal
 * lifecycle; town/combat material caches and character equipment are untouched. */
function adaptDungeonBodyMaterials(root: Object3D) {
  const replacements = new Map<Material, Material>();
  const adapt = (material: Material): Material => {
    const toon = material as MeshToonMaterial;
    if (!toon.isMeshToonMaterial) return material;
    const prior = replacements.get(material);
    if (prior) return prior;
    const next = new MeshStandardMaterial({
      color: toon.color, vertexColors: toon.vertexColors, map: toon.map,
      roughness: 0.85, metalness: 0, side: toon.side,
      transparent: toon.transparent, opacity: toon.opacity, alphaTest: toon.alphaTest,
      emissive: toon.emissive, emissiveMap: toon.emissiveMap,
      emissiveIntensity: toon.emissiveIntensity,
    });
    replacements.set(material, next);
    return next;
  };
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(adapt) : adapt(mesh.material);
  });
}

export function DungeonPartyFigure({character, position, cellFeet}: {
  character: PlayerCharacter;
  position: {x: number; z: number};
  cellFeet: number;
}) {
  const blueprint = useMemo(() => generateEntityBlueprint(recipeFromCharacter(character)), [character]);
  const animTimeRef = useRef(0);
  const downed = character.hp <= 0;
  useEffect(() => {animTimeRef.current = 0;}, [downed]);
  useFrame((_state, delta) => {animTimeRef.current += delta;});
  // Entity anatomy is authored in meters; dungeon scene units are source cells.
  // No oversized token scale or independent substitute character is introduced.
  const unitsPerMeter = 1 / (cellFeet * 0.3048);
  return <group position={[position.x, 0.015, position.z]} name={`dungeon-party:${character.id}`}>
    <group scale={unitsPerMeter} rotation={[0, Math.PI / 4, 0]}>
      <EntityModel adaptMaterials={adaptDungeonBodyMaterials} blueprint={blueprint} animState={downed ? 'death' : 'idle'} animTimeRef={animTimeRef} />
    </group>
    <Html style={{pointerEvents:'none'}} zIndexRange={[0,0]} position={[0,heightM(blueprint.frame)*unitsPerMeter+0.28,0]} center distanceFactor={13} occlude>
      <span data-testid="dungeon-player-marker" className="whitespace-nowrap rounded border border-amber-200/40 bg-stone-950/85 px-2 py-0.5 text-[10px] font-semibold text-amber-100 shadow-lg">
        {character.name}
      </span>
    </Html>
  </group>;
}
