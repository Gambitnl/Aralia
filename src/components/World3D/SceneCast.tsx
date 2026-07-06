/**
 * @file src/components/World3D/SceneCast.tsx
 *
 * Renders the **staged cast** of an in-world scene — the player plus the 1–3
 * opening-situation strangers — as simple humanoid figures standing in a
 * conversational cluster at the spawn point, each with a floating name label.
 *
 * This is what makes the opening "situation" actually *visible* in the 3D world
 * instead of only existing as a floating conversation panel: the player spawns
 * looking at the people the predicament is about. Figures are deliberately
 * lightweight (a tapered body + head, no skeleton/animation) — the goal is
 * presence and framing, not the full combat CharacterActor.
 *
 * Positions are scene-local: the streamed scene origin is centered on the spawn
 * `start`, so scene-space (0, surfaceY, 0) is the ground at the player's feet.
 * The cast is arranged around that point so the ground camera frames the group.
 */
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

export interface SceneCastMember {
  id: string;
  name: string;
  /** The player's own figure (distinct colour, stands at the near edge). */
  isPlayer?: boolean;
  /** The stranger who speaks first — given a subtle highlight. */
  isSpeaker?: boolean;
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

const PLAYER_COLOR = '#3b82f6'; // steel blue — the player reads as "you"
const NPC_COLOR = '#c2683a'; // tan/brown — matches the instanced townsfolk
const SPEAKER_COLOR = '#d9a441'; // warm amber — the one addressing you

const BODY_HEIGHT = 1.35;
const HEAD_RADIUS = 0.2;

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
  const color = member.isPlayer ? PLAYER_COLOR : member.isSpeaker ? SPEAKER_COLOR : NPC_COLOR;
  const [x, , z] = member.pos;
  // Face the cluster centre so the group reads as "in conversation".
  const facing = Math.atan2(-x, -z);

  // Click-to-talk: only NPC figures are interactive, and only when a handler is
  // wired. The player's own figure is inert (you don't talk to yourself).
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
      {/* Body — a tapered cylinder standing on the ground. */}
      <mesh position={[0, BODY_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, BODY_HEIGHT, 10]} />
        <meshStandardMaterial
          color={color}
          roughness={0.8}
          emissive={interactive ? color : '#000000'}
          emissiveIntensity={interactive ? 0.12 : 0}
        />
      </mesh>
      {/* Head. */}
      <mesh position={[0, BODY_HEIGHT + HEAD_RADIUS * 0.9, 0]} castShadow>
        <sphereGeometry args={[HEAD_RADIUS, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Name label floating above the head. */}
      <Html center position={[0, BODY_HEIGHT + HEAD_RADIUS * 2 + 0.45, 0]} distanceFactor={12}>
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
