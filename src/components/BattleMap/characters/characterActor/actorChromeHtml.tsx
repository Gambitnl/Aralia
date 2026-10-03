/**
 * @file characters/characterActor/actorChromeHtml.tsx
 * The renderer-agnostic half of a 3D actor's chrome: the defeat marker, the
 * temporary-HP badge, and the hover/selection nameplate.
 *
 * WHY THIS FILE EXISTS (task agora-a2b8, 2026-09-21): the WebGPU battle scene
 * (`BattleMap3DGpuScene.tsx`) needs the same readouts the WebGL actor has, but
 * it cannot mount `CharacterStatusBadges` as a whole — that component's HP pip
 * is built from `<meshStandardMaterial>`, which renders BLACK in a scene with
 * no lights (the node-path `LightsNode` never sees R3F-added lights, three
 * #30044). These three pieces have no such problem: a drei `<Html>` is a DOM
 * overlay positioned by projecting a world point, so it is identical on both
 * backends.
 *
 * So the split is by RENDERER DEPENDENCE, not by feature:
 *   - here          — pure `<Html>`, mounted unchanged by both paths,
 *   - CharacterStatusBadges — these three plus the WebGL-lit HP pip,
 *   - gpu/GpuActorChrome    — these three plus an unlit node-material pip.
 * The markup is written once; neither path carries a copy that can drift.
 *
 * Dependencies: react, @react-three/drei (Html), types/combat, ./actorTheme
 * Dependents: characterActor/CharacterStatusBadges.tsx,
 *             BattleMap/gpu/GpuActorChrome.tsx
 */

import React from 'react';
import { Html } from '@react-three/drei';
import type { CombatCharacter } from '../../../../types/combat';
import type { ActorTeamColors } from './actorTheme';

/**
 * Defeat marker.
 *
 * The body tint (actorStatusShading) is the primary cue, but it rides on a
 * GLSL shader patch that the WebGPU material swap drops — and a tint alone can
 * be read as "unusual armor" on an unfamiliar creature. This skull marker is
 * renderer-independent and unambiguous, and it sits at the HP pip so the eye
 * finds it in the same place it already looks for health.
 */
export const ActorDefeatedMarker: React.FC<{ character: CombatCharacter; pipY: number }> = ({
  character,
  pipY,
}) => (
  <Html position={[0, pipY + 0.34, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
    <span
      data-testid="character-defeated-marker-3d"
      aria-label={`${character.name} is defeated`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '999px',
        border: '1px solid #fca5a5',
        background: 'rgba(69, 10, 10, 0.92)',
        color: '#fee2e2',
        fontSize: '12px',
        lineHeight: 1,
        boxShadow: '0 0 12px rgba(220, 38, 38, 0.65)',
      }}
    >
      💀
    </span>
  </Html>
);

/**
 * Temporary-HP badge.
 *
 * Temporary HP is not part of the green health percentage. This cyan value
 * stays visible beside the HP pip in 3D so a camera orbit cannot hide whether
 * damage still has a separate buffer to consume first.
 */
export const ActorTempHpBadge: React.FC<{ character: CombatCharacter; pipY: number }> = ({
  character,
  pipY,
}) => (
  <Html position={[0.34, pipY, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
    <span
      data-testid="temporary-hit-points-badge-3d"
      aria-label={`${character.tempHP} temporary hit points`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '22px',
        padding: '2px 4px',
        borderRadius: '999px',
        border: '1px solid #a5f3fc',
        background: 'rgba(8, 51, 68, 0.95)',
        color: '#cffafe',
        fontSize: '8px',
        fontWeight: 900,
        lineHeight: 1,
        boxShadow: '0 0 10px rgba(34, 211, 238, 0.42)',
      }}
    >
      +{character.tempHP}
    </span>
  </Html>
);

export interface ActorNameplateProps {
  character: CombatCharacter;
  teamColors: ActorTeamColors;
  pipY: number;
  /** 0..1 current/max HP. */
  hpPercent: number;
  hpColor: string;
  /** Feet to the active player character while hovered, or null. */
  distanceToActive: number | null;
}

/**
 * The detailed nameplate — shown on hover, selection, or active turn.
 *
 * It repeats the temporary buffer beside current and maximum HP so the focused
 * actor exposes all three health values in one place.
 */
export const ActorNameplate: React.FC<ActorNameplateProps> = ({
  character,
  teamColors,
  pipY,
  hpPercent,
  hpColor,
  distanceToActive,
}) => (
  <Html position={[0, pipY + 0.3, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
    <div
      data-testid="character-nameplate-3d"
      style={{
        background: 'rgba(0,0,0,0.85)',
        padding: '3px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        fontSize: '11px',
        color: '#e6edf3',
        textAlign: 'center',
        borderLeft: `3px solid ${teamColors.nameAccent}`,
        minWidth: '70px',
      }}
    >
      <div style={{
        fontWeight: 600,
        fontSize: '10px',
        marginBottom: '2px',
        letterSpacing: '0.5px',
      }}>
        {character.name}
      </div>
      <div style={{
        width: '65px',
        height: '5px',
        background: '#1a1a2e',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${hpPercent * 100}%`,
          height: '100%',
          background: hpColor,
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: '8px', color: '#9ca3af', marginTop: '1px' }}>
        {character.currentHP}/{character.maxHP}
        {(character.tempHP ?? 0) > 0 ? ` + ${character.tempHP} temp` : ''}
      </div>
      {character.aerialMovement?.isFlying && (
        <div
          data-testid="aerial-altitude-nameplate"
          style={{ fontSize: '9px', color: '#7dd3fc', marginTop: '2px', fontWeight: 'bold' }}
        >
          Flying · {character.aerialMovement.altitudeFeet} ft
          {character.aerialMovement.canHover ? ' · hover' : ''}
        </div>
      )}
      {distanceToActive !== null && (
        <div style={{ fontSize: '9px', color: '#facc15', marginTop: '2px', fontWeight: 'bold' }}>
          Distance: {distanceToActive} ft
        </div>
      )}
    </div>
  </Html>
);

/**
 * HP bar color, shared so both render paths grade health identically.
 * Green above half, amber above a quarter, red below.
 */
export function actorHpColor(hpPercent: number): string {
  return hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';
}
