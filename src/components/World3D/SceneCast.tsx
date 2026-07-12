// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:33:34
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
 * folk (castMemberRecipe below is the one place that decides this).
 *
 * Positions are scene-local: the streamed scene origin is centered on the spawn
 * `start`, so scene-space (0, surfaceY, 0) is the ground at the player's feet.
 * The cast is arranged around that point so the ground camera frames the group.
 */
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { heightM } from '@/systems/entities3d/types';
import type { EntityRecipe } from '@/systems/entities3d/types';
import { Entity3D } from '@/systems/entities3d/three/Entity3D';

registerAllParts();

export interface SceneCastMember {
  id: string;
  name: string;
  /** The player's own figure (stands at the near edge). */
  isPlayer?: boolean;
  /** The stranger who speaks first — label carries the highlight. */
  isSpeaker?: boolean;
  /** Real identity when known (player sheet / rich NPC). */
  recipe?: EntityRecipe;
}

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

/**
 * Whether a cast figure is click-to-talk interactive: only NPC figures, and only
 * when a select handler is wired. The player's own figure is NEVER clickable —
 * you don't open a conversation with yourself. Pure so the contract is testable
 * without an R3F render.
 */
export function figureIsInteractive(member: SceneCastMember, hasHandler: boolean): boolean {
  return hasHandler && !member.isPlayer;
}

/**
 * The one place an unspecified cast member becomes a body: an unarmed human
 * commoner, deterministic per member id. Members with real identities carry
 * their own recipe.
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

const Figure: React.FC<{
  member: SceneCastMember & { pos: [number, number, number] };
  surfaceY: number;
  onSelectNpc?: (npcId: string) => void;
}> = ({ member, surfaceY, onSelectNpc }) => {
  const [x, , z] = member.pos;
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

  return (
    <group
      position={[x, surfaceY, z]}
      rotation={[0, facing, 0]}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* The generated body, idling in place (pointer events bubble up).
          Opening scenes can stage several figures at once, so their soft-body
          fields use a conversational-distance resolution and a gentle idle
          refresh. Labels, clicks, gear, eyes, and facing remain full-frame. */}
      <Entity3D
        blueprint={blueprint}
        walking={false}
        resolutionScale={0.6}
        fieldUpdateHz={6}
      />
      {/* Name label floating above the head. */}
      <Html center position={[0, labelY, 0]} distanceFactor={12}>
        <div
          data-testid={`scene-cast-label-${member.id}`}
          data-player={member.isPlayer ? 'true' : 'false'}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'Outfit, sans-serif',
            padding: '2px 7px',
            borderRadius: '4px',
            background: member.isPlayer ? 'rgba(37, 99, 235, 0.82)' : 'rgba(9, 19, 28, 0.82)',
            border: '1px solid rgba(148, 163, 184, 0.5)',
          }}
        >
          {member.isPlayer ? `${member.name} (you)` : interactive ? `💬 ${member.name}` : member.name}
        </div>
      </Html>
    </group>
  );
};

/**
 * Render the staged cast. Returns null when there's no one to stage (the normal
 * case once the opening is over and the player wanders off).
 */
const SceneCast: React.FC<SceneCastProps> = ({ cast, surfaceY = 0, onSelectNpc }) => {
  const placed = useMemo(() => layoutCast(cast), [cast]);
  if (placed.length === 0) return null;
  return (
    <group data-testid="scene-cast">
      {placed.map((m) => (
        <Figure key={m.id} member={m} surfaceY={surfaceY} onSelectNpc={onSelectNpc} />
      ))}
    </group>
  );
};

export default SceneCast;
