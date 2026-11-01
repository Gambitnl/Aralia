/**
 * @file src/components/World3D/SceneCast.tsx
 *
 * Renders the **staged cast** of an in-world scene — the player plus the 1–3
 * opening-situation strangers — standing in a conversational cluster at the
 * spawn point, each with a floating name label.
 *
 * Figures are REAL generated entities (src/systems/entities3d): the player
 * renders their actual race + class + equipped gear, rich NPCs render their
 * class and worn gear. A member without a recipe renders as an unarmed human
 * commoner — the same default the NPC generator itself uses for unspecified
 * folk. The UI-neutral contract and fallback now live in systems/entities3d,
 * keeping the entity engine independent from this renderer.
 *
 * Positions are scene-local: the streamed scene origin is centered on the spawn
 * `start`, so scene-space (0, surfaceY, 0) is the ground at the player's feet.
 * The cast is arranged around that point so the ground camera frames the group.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:46:33
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { SceneCastNameplate } from './SceneCastNameplate';
import { createCastLabelProjectors, type CastLabelProjector } from './sceneCastLabelLayout';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { heightM } from '@/systems/entities3d/types';
import { Entity3D } from '@/systems/entities3d/three/Entity3D';
import { gameBodyOptions } from '@/systems/entities3d/three/assembleEntity';
import { isWebGpuWorldEnabled } from './webgpuWorldFlag';
import { adaptWorldEntityForWebGpu } from './worldEntityGpu';

/** ADR 0009 step 2: the WebGPU world rebuilds the GLSL toon materials. */
const ADAPT_MATERIALS = isWebGpuWorldEnabled() ? adaptWorldEntityForWebGpu : undefined;
import {
  figureIsInteractive,
  castMemberRecipe,
  layoutCast,
  type SceneCastMember,
} from '@/systems/entities3d/sceneCastUtils';

registerAllParts();

// Preserve SceneCast's public type export for existing UI callers while the
// source of truth lives in the engine-owned contract above.
export type { SceneCastMember } from '@/systems/entities3d/sceneCastUtils';

interface SceneCastProps {
  cast: SceneCastMember[];
  /** Scene-space Y (m) of the ground at the spawn; figures stand on it. */
  surfaceY?: number;
  /**
   * Click-to-talk: invoked with an NPC figure's id when the player clicks it in
   * the 3D world. The player's own figure is never clickable. When omitted the
   * figures are inert (e.g. a non-interactive diorama / test render).
   */
  onSelectNpc?: (npcId: string) => void;
}

const Figure: React.FC<{
  member: SceneCastMember & { pos: [number, number, number] };
  calculateLabelPosition: CastLabelProjector;
  surfaceY: number;
  onSelectNpc?: (npcId: string) => void;
}> = ({ member, surfaceY, onSelectNpc, calculateLabelPosition }) => {
  const [x, y, z] = member.pos;
  // Face the cluster centre so the group reads as "in conversation".
  const facing = Math.atan2(-x, -z);

  const blueprint = useMemo(() => generateEntityBlueprint(castMemberRecipe(member)), [member]);
  const labelY = heightM(blueprint.frame) + 0.45;

  // Click-to-talk: only NPC figures are interactive, and only when a handler is
  // wired. The player's own figure is inert (you don't talk to yourself). The
  // affordance is the 💬 label + pointer cursor (the generated body's material
  // is shared, so no per-figure emissive tint).
  const interactive = figureIsInteractive(member, typeof onSelectNpc === 'function');
  const handlePointerDown = interactive
    ? (e: ThreeEvent<PointerEvent>) => {
        // Camera gestures may start on a body too. Only a primary click is speech.
        if (e.button !== 0) return;
        // Stop the event reaching MapControls so a talk-click never also pans
        // the camera.
        e.stopPropagation();
        onSelectNpc!(member.id);
      }
    : undefined;
  const handlePointerOver = interactive
    ? (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
      }
    : undefined;
  const handlePointerOut = interactive
    ? () => {
        if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
      }
    : undefined;

  // Explicit positions retain each person's own footing across scene origins.
  return (
    <group
      name={`scene-cast:${member.id}`}
      position={[x, member.position ? y : surfaceY, z]}
      rotation={[0, facing, 0]}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* The generated body, idling in place (pointer events bubble up).
          Opening scenes can stage several figures at once, so their soft-body
          fields use a conversational-distance resolution and a gentle idle
          refresh. Labels, clicks, gear, eyes, and facing remain full-frame.
          Skinned by default (skeleton pivot flip 2026-08-18). */}
      <Entity3D
        adaptMaterials={ADAPT_MATERIALS}
        blueprint={blueprint}
        walking={false}
        resolutionScale={0.6}
        fieldUpdateHz={6}
        {...gameBodyOptions(blueprint)}
      />
      {/* Name label floating above the head. */}
      {/* Match the player nameplate: readable labels must not grow over faces
          when a normal close camera orbit brings the group nearer. */}
      <Html center position={[0, labelY, 0]} calculatePosition={calculateLabelPosition} style={{ pointerEvents: 'none' }}>
        <SceneCastNameplate
          id={member.id}
          name={member.name}
          isPlayer={member.isPlayer}
          onTalk={interactive ? () => onSelectNpc!(member.id) : undefined}
        />
      </Html>
    </group>
  );
};

/**
 * Render the staged cast. Returns null when there's no one to stage (the normal
 * case once the opening is over and the player wanders off).
 */
const SceneCast: React.FC<SceneCastProps> = ({ cast, surfaceY = 0, onSelectNpc }) => {
  const canvas = useThree(state => state.gl.domElement);
  const placed = useMemo(() => layoutCast(cast), [cast]);
  const labelProjector = useMemo(() => createCastLabelProjectors(placed.map(member => member.id), () => {
    // Read only this canvas's existing player captions. Moving a badge must not
    // hide the authoritative footing/water warning or move anyone's body.
    const origin = canvas.getBoundingClientRect();
    // Drei's captions are siblings of the inner canvas wrapper. Prefer the
    // world's explicit layer; the R3F root also covers isolated scene previews.
    const captionRoot = canvas.closest('[data-testid="world3d-scene-layer"]') ?? canvas.parentElement?.parentElement;
    return Array.from(captionRoot?.querySelectorAll('[data-testid="player-avatar-label"], [data-testid="ground-footing-unavailable"], [data-testid="ground-water-notice"]') ?? []).map(node => {
      const rect = node.getBoundingClientRect();
      return {x:rect.left-origin.left,y:rect.top-origin.top,width:rect.width,height:rect.height};
    });
  }), [placed, canvas]);
  if (placed.length === 0) return null;
  return (
    <group data-testid="scene-cast">
      {placed.map((m) => (
        <Figure key={m.id} member={m} surfaceY={surfaceY} onSelectNpc={onSelectNpc} calculateLabelPosition={labelProjector(m.id)} />
      ))}
    </group>
  );
};

export default SceneCast;
