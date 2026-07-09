// One villager figure: a clothed body box under a skin-toned head, sized from a
// parametric OccupantBody so a crowd reads as a population rather than clones.
//
// This is the single figure renderer shared by the (formerly baked) static
// roster path and the live InteriorOccupants layer. Its box geometry mirrors
// exactly what `interiorParts.buildInteriorParts` used to bake for occupants:
// a body box (shoulderWidth x bodyHeight x depth, clothing color) with a head
// box (0.85*headSize x headSize x 0.8*headSize, skin color) stacked on top,
// both resting on the group origin (the figure's floor).
import React from 'react';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { OccupantBody } from '@/systems/worldforge/bridge/interiorParts';

const SHADOWS = WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS;

export interface OccupantFigureProps {
  /** Parametric body (per-person proportions + palette), in meters + hex. */
  body: OccupantBody;
  /** Age band ('child' | 'adult' | 'elder'); body dims already encode it. */
  ageBand?: string;
  /** Scene-space position of the figure's FEET (floor surface). */
  position: [number, number, number];
  /** Facing yaw about +Y, radians. */
  rotationY?: number;
}

/**
 * Render one occupant. The body box sits centered above the origin, the head
 * box on top of it — the figure's feet are at the group origin so `position`
 * places it directly on the floor (surfaceY + storey elevation).
 */
const OccupantFigure: React.FC<OccupantFigureProps> = ({ body, position, rotationY = 0 }) => {
  const headH = body.headSizeM;
  const bodyH = Math.max(0.1, body.heightM - headH);
  return (
    <group position={position} rotation={[0, rotationY, 0]} userData={{ isOccupant: true }}>
      <mesh position={[0, bodyH * 0.5, 0]} castShadow={SHADOWS} receiveShadow={SHADOWS}>
        <boxGeometry args={[body.shoulderWidthM, bodyH, body.depthM]} />
        <meshStandardMaterial color={body.clothingHex} />
      </mesh>
      <mesh position={[0, bodyH + headH * 0.5, 0]} castShadow={SHADOWS} receiveShadow={SHADOWS}>
        <boxGeometry args={[body.headSizeM * 0.85, headH, body.headSizeM * 0.8]} />
        <meshStandardMaterial color={body.skinToneHex} />
      </mesh>
    </group>
  );
};

export default OccupantFigure;
