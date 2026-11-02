/** The entry swings into its canonical room. Saved state also positions its
 * collider; camera movement cannot open or reach it. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 03:48:47
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';
import type { SitePart } from '@/systems/worldforge/bridge/interiorParts';
import { siteDoorKey, siteDoorLocalPose } from '@/systems/worldforge/bridge/sitePartTransform';
import { GroundFurnishingContext } from './GroundFurnishingContext';
import { useDoorLeafState } from './groundDoorStore';

export function BuildingDoor({ part, siteId, rotationY, doorZSign }: { part: SitePart; siteId: string; rotationY: number; doorZSign: number }) {
  const context = useContext(GroundFurnishingContext);
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useEffect(() => () => { if (typeof document !== 'undefined') document.body.style.cursor = 'auto'; }, []);
  // GG-580: this leaf renders when its own door changes, not when any door does.
  const { open, users } = useDoorLeafState(context?.doors, siteDoorKey(siteId, part));
  const { offset, rotationY: angle } = siteDoorLocalPose(part, doorZSign, open);
  const axisX = part.door?.axis === 'x';
  const length = axisX ? part.w : part.d, thickness = axisX ? part.d : part.w;
  const select = context?.onDoor ? (event: ThreeEvent<PointerEvent>) => {
    // Camera rotation must not open or close a door under the pointer.
    if (event.button !== 0) return;
    event.stopPropagation();
    // Give the resident already crossing the threshold right of way. Their
    // transient open must not toggle the player's separately saved door state.
    if (users?.length) return;
    const building = group.current?.parent;
    if (!building) return;
    const m = building.matrixWorld.elements;
    context.onDoor!({ siteId, part, transform: { groupX: m[12] + context.origin.x, groupZ: m[14] + context.origin.z,
      surfaceY: m[13], rotationY, doorZSign } });
  } : undefined;
  return <group ref={group} name="world3d:building-door" data-testid="building-door" position={[offset.x, offset.y, offset.z]} rotation={[0, angle, 0]}>
    <mesh onPointerDown={select} onPointerOver={select ? (event: ThreeEvent<PointerEvent>) => {
      // Keep a usable leaf's hint ahead of furnishings behind that leaf.
      event.stopPropagation();
      setHovered(true); document.body.style.cursor = 'pointer';
    } : undefined}
      onPointerOut={select ? () => { setHovered(false); document.body.style.cursor = 'auto'; } : undefined}>
      <boxGeometry args={[part.w, part.h, part.d]} />
      <meshStandardMaterial color={part.colorHex} roughness={0.85} />
      {/* Panels and iron rings make the usable leaf readable from both sides.
          The whole assembly follows the same swing as the collision box. */}
      {[-1, 1].flatMap(face => [-1, 1].map(row => <mesh key={`${face}-${row}`}
        position={axisX ? [0, row * part.h * 0.22, face * (thickness / 2 + 0.006)] : [face * (thickness / 2 + 0.006), row * part.h * 0.22, 0]}>
        <boxGeometry args={axisX ? [length * 0.7, part.h * 0.34, 0.012] : [0.012, part.h * 0.34, length * 0.7]} />
        <meshStandardMaterial color="#65462f" roughness={0.9} />
      </mesh>))}
      {[-1, 1].map(face => <mesh key={face} position={axisX ? [length * 0.28, -part.h * 0.05, face * (thickness / 2 + 0.035)] : [face * (thickness / 2 + 0.035), -part.h * 0.05, length * 0.28 * -doorZSign]}
        rotation={[0, axisX ? 0 : Math.PI / 2, 0]}>
        <torusGeometry args={[0.055, 0.012, 5, 12]} />
        <meshStandardMaterial color="#302b25" metalness={0.65} roughness={0.55} />
      </mesh>)}
    </mesh>
    {hovered && select && <Html center position={[0, part.h / 2 + 0.22, 0]} distanceFactor={8}>
      <div className="pointer-events-none whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-amber-100">{users?.length ? users.length === 1 ? `${users[0]} is using the door` : 'Residents are using the door' : open ? 'Close door' : 'Open door'}</div>
    </Html>}
  </group>;
}
