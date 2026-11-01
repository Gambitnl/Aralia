/** Show an actually burning, owned torch at the ground figure's existing hand
 * pose. Inventory alone never creates a flame. Fuel and expiry remain owned by
 * carriedItemLight and the world clock; this component only projects them.
 * The flame is a sibling of the measured body, so visual light geometry does
 * not silently change doorway, water or personal-space admission. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:34:25
 * Dependents: components/World3D/PlayerAvatar.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {useOptionalGameState} from '../../state/GameContext';
import {activeCarriedTorches} from '../../systems/underdark/carriedItemLight';
import type {EntityHandle} from '../../systems/entities3d/three/assembleEntity';
import type {PlayerCharacter} from '../../types/character';
import {isTwoHandedWeapon} from '../../utils/character/defense';

type Props = {character: PlayerCharacter; handle: EntityHandle};

function HeldTorch({handle, sourceId, hand, rangeM}: {
  handle: EntityHandle; sourceId: string; hand: 'handR'|'handL'; rangeM: number;
}) {
  const root=useRef<THREE.Group>(null);
  // PlayerAvatar advances its existing gait at -0.75. Follow that actual pose
  // afterwards, including the assembled model's facing, without moving feet.
  useFrame(()=>{
    const group=root.current, anchor=handle.pose?.anchors[hand];
    if(!group||!anchor)return;
    handle.group.updateMatrix();
    group.position.copy(anchor.pos).applyMatrix4(handle.group.matrix);
    group.quaternion.copy(handle.group.quaternion).multiply(anchor.quat);
  },-.5);
  return <group ref={root} name={`world3d:carried-torch:${sourceId}:${hand}`} data-testid="ground-carried-torch">
    {/* Same wood/flame palette and simple shape as the existing dungeon torch.
        Here distances are ground meters, rather than dungeon grid cells. */}
    <mesh position={[0,.18,0]}><cylinderGeometry args={[.035,.045,.55,6]}/><meshStandardMaterial color="#734a25"/></mesh>
    <mesh position={[0,.52,0]}><sphereGeometry args={[.09,8,6]}/><meshBasicMaterial color="#ffc76b"/></mesh>
    <pointLight position={[0,.52,0]} color="#ffb55e" intensity={2.8} distance={rangeM} decay={2}/>
  </group>;
}

export default function GroundCarriedTorch({character,handle}:Props) {
  const context=useOptionalGameState();
  const source=context&&activeCarriedTorches(context.state).find(light=>light.bearerId===character.id);
  if(!source)return null;
  const equipped=character.equippedItems;
  // Do not invent a third hand or draw through an equipped weapon. The wider
  // ignition/equip hand policy remains separate; existing saves are not edited.
  const twoHanded=isTwoHandedWeapon(equipped?.MainHand)||isTwoHandedWeapon(equipped?.OffHand);
  const hand=!twoHanded&&!equipped?.MainHand?'handR':!twoHanded&&!equipped?.OffHand?'handL':null;
  if(!hand)return null;
  return <HeldTorch handle={handle} sourceId={source.id} hand={hand}
    rangeM={(source.brightRadius!+source.dimRadius!)*.3048}/>;
}
