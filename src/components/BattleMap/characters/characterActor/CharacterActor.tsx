/**
 * @file characters/characterActor/CharacterActor.tsx
 * The CharacterActor component: composes the procedural models, selection /
 * turn indicators, defense + condition badges, HP pip, and nameplate into one
 * 3D combat-map actor with position interpolation and animation state.
 * Extracted verbatim from the original CharacterActor.tsx (now a facade).
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CombatCharacter } from '../../../../types/combat';
import { getDistance } from '../../../../utils/combat/combatUtils';
import { useFresnelRim } from '../useFresnelRim';
import { DefenseBadgeRow } from './defenseBadges';
import { ConditionBadgeRow } from './conditionBadges';
import {
  type AnimationState,
  getArchetype,
  getRaceVisual,
  BeastModel,
  DragonModel,
  OozeModel,
  AberrationModel,
  HumanoidModel,
  SelectionDecal,
  TurnIndicator,
} from './models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;

// Team colors — warm/heroic for players, cold/hostile for enemies
const TEAM_COLORS = {
  player: {
    primary: 0xd4a017,    // Gold armor
    selection: 0xfbbf24,  // Bright amber ring
    nameAccent: '#d4a017',
    groundGlow: 0xffd060, // Warm amber ground light
  },
  enemy: {
    primary: 0xcc1111,    // Vivid crimson armor
    selection: 0xff2020,  // Bright red ring
    nameAccent: '#ff4444',
    groundGlow: 0xff1100, // Intense red ground light
  },
  neutral: {
    primary: 0xeab308,    // Yellow
    selection: 0xfbbf24,  // Light yellow
    nameAccent: '#eab308',
    groundGlow: 0xffcc00,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CharacterActorProps {
  character: CombatCharacter;
  allCharacters: CombatCharacter[];
  tileElevation: number;
  /** Sampled terrain surface height at the actor's tile center — the same
   * formula the terrain mesh is built from. Falls back to tile elevation. */
  groundY?: number;
  isSelected: boolean;
  isTurn: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  onClick: (character: CombatCharacter) => void;
  activeCharacterId?: string | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CharacterActor: React.FC<CharacterActorProps> = ({
  character,
  allCharacters,
  tileElevation,
  groundY,
  isSelected,
  isTurn,
  isTargetable,
  targetingMode,
  onClick,
  activeCharacterId
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [hovered, setHovered] = useState(false);
  const animTimeRef = useRef(0);
  const prevHPRef = useRef(character.currentHP);

  const { x, y } = character.position;
  const isPlayer = character.team === 'player';
  const isAlive = character.currentHP > 0;
  const teamKey = isPlayer ? 'player' : character.team === 'enemy' ? 'enemy' : 'neutral';
  const teamColors = TEAM_COLORS[teamKey];
  const archetype = useMemo(() => getArchetype(character.class?.name ?? ''), [character.class?.name]);
  const raceVisual = useMemo(
    () => getRaceVisual(character.creatureTypes, character.name),
    [character.creatureTypes, character.name],
  );
  // Fresnel rim on the model meshes (GOAL #7). Re-runs when the body plan or
  // identity changes so rebuilt mesh trees get patched too.
  useFresnelRim(modelGroupRef, [raceVisual.form, character.id]);
  // Per-character idle stance (GOAL #8): seeded lean + arm-angle offsets and a
  // sway/breathe phase so units don't stand and breathe in lockstep.
  const stance = useMemo(() => {
    let h = 0;
    for (let i = 0; i < character.id.length; i++) {
      h = ((h << 5) - h) + character.id.charCodeAt(i);
      h |= 0;
    }
    const r = (n: number) => {
      const x = Math.sin(h + n * 374761) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      phase: r(1) * Math.PI * 2,
      lean: (r(2) - 0.5) * 0.10,
      armL: (r(3) - 0.5) * 0.22,
      armR: (r(4) - 0.5) * 0.18,
    };
  }, [character.id]);
  // Creature size category → overall scale, so Large+ enemies (ogres, trolls,
  // dragons) physically tower over Medium humanoids instead of all matching.
  const sizeScale = useMemo(() => {
    switch (character.stats?.size) {
      case 'Large': return 1.55;
      case 'Huge': return 2.15;
      case 'Gargantuan': return 2.9;
      default: return 1.0; // Tiny/Small/Medium
    }
  }, [character.stats?.size]);

  const activeCharacter = useMemo(() => {
    if (!activeCharacterId) return undefined;
    return allCharacters.find(c => c.id === activeCharacterId);
  }, [allCharacters, activeCharacterId]);

  const distanceToActive = useMemo(() => {
    if (
      hovered &&
      activeCharacter &&
      activeCharacter.team === 'player' &&
      character.team === 'enemy' &&
      activeCharacter.id !== character.id
    ) {
      return getDistance(character.position, activeCharacter.position) * 5; // 5 ft per tile
    }
    return null;
  }, [activeCharacter, character.position, character.team, character.id, hovered]);

  // Compute facing direction — face toward nearest enemy (or seeded random fallback)
  const facingRotation = useMemo(() => {
    const enemies = allCharacters.filter(c =>
      c.team !== character.team && c.currentHP > 0
    );
    if (enemies.length === 0) {
      // Seeded pseudo-random from character ID
      let hash = 0;
      for (let i = 0; i < character.id.length; i++) {
        hash = ((hash << 5) - hash) + character.id.charCodeAt(i);
        hash |= 0;
      }
      return (Math.abs(hash) % 628) / 100; // 0 to ~6.28 (2π)
    }
    // Find nearest enemy
    let nearest = enemies[0];
    let minDist = Infinity;
    for (const e of enemies) {
      const dx = e.position.x - x;
      const dy = e.position.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = e; }
    }
    // atan2 to face nearest enemy — R3F Z+ is "forward"
    const dx = nearest.position.x - x;
    const dy = nearest.position.y - y;
    return Math.atan2(dx, dy);
  }, [character.id, character.team, x, y, allCharacters]);

  // Detect HP changes to trigger hit_react animation
  useEffect(() => {
    if (character.currentHP < prevHPRef.current && character.currentHP > 0) {
      setAnimState('hit_react');
      animTimeRef.current = 0;
    } else if (character.currentHP <= 0) {
      setAnimState('death');
      animTimeRef.current = 0;
    }
    prevHPRef.current = character.currentHP;
  }, [character.currentHP]);

  // Animation tick
  useFrame((_, delta) => {
    animTimeRef.current += delta;

    // Auto-return to idle after timed animations
    if (animState === 'hit_react' && animTimeRef.current > 0.5) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (animState === 'attack_melee' && animTimeRef.current > 0.8) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (animState === 'cast_spell' && animTimeRef.current > 1.0) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
  });

  // Target highlight color
  const showTargetHighlight = isTargetable && targetingMode;

  // Ground height: prefer the sampled terrain surface (exact match with the
  // rendered mesh — no hovering over carved banks); fall back to tile elevation.
  const elevation = groundY ?? tileElevation * ELEVATION_SCALE;

  // HP percentage for health bar
  const hpPercent = Math.max(0, character.currentHP / character.maxHP);
  const hpColor = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';

  return (
    <group
      ref={groupRef}
      position={[
        x * TILE_SIZE + TILE_SIZE / 2,
        elevation,
        y * TILE_SIZE + TILE_SIZE / 2,
      ]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(character);
      }}
      onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Selection decal — always-on BG3 style ground ring for team identity */}
      <SelectionDecal
        color={showTargetHighlight ? 0xff4444 : teamColors.selection}
        visible={isSelected || isTurn || showTargetHighlight}
        pulse={showTargetHighlight || isTurn}
        baseOpacity={isSelected || isTurn ? 0.90 : 0.50}
      />

      {/* Facing wedge — small ground pointer on the team ring showing which way
          the unit faces (GOAL #9); rotates with the model's facing. */}
      {isAlive && (
        <group rotation={[0, facingRotation, 0]}>
          <mesh position={[0, 0.03, 0.60]} rotation={[-Math.PI / 2, 0, 0]}>
            {/* thetaStart -π/2 puts the triangle's point outward (+Z = forward) */}
            <circleGeometry args={[0.19, 3, -Math.PI / 2]} />
            <meshStandardMaterial
              color={teamColors.selection}
              emissive={teamColors.selection}
              emissiveIntensity={1.5}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Active turn golden ring */}
      <TurnIndicator active={isTurn} />

      {/* Team-colored ground glow — most readable team indicator at tactical distance */}
      <pointLight
        color={teamColors.groundGlow}
        intensity={isPlayer ? 0.7 : 1.0}
        distance={3.2}
        position={[0, 0.05, 0]}
      />

      {/* Defense badges stay on the actor itself so the 3D map exposes the
          same resistance / vulnerability / immunity facts as the 2D token. */}
      <DefenseBadgeRow character={character} />

      {/* Active condition chips (GOAL #19) — the buff/debuff half of the
          status story, below the HP pip. */}
      <ConditionBadgeRow character={character} />

      {/* Character model — scaled to TRUE world proportions (Remy 2026-07-01:
          "characters shouldn't be almost as big as a tree"). At 1 tile = 5 ft,
          2.2× puts a human at ~1.4 units ≈ 7 ft — figures stand under the
          canopy instead of rivaling it. Readability is carried by the team
          rings, fresnel rim (task 73), and indicators, not by giant models
          (the old 3.7× made characters near canopy height). */}
      <group
        ref={modelGroupRef}
        scale={[
          2.2 * raceVisual.buildScale * sizeScale,
          2.2 * raceVisual.heightScale * sizeScale,
          2.2 * raceVisual.buildScale * sizeScale,
        ]}
        rotation={[0, facingRotation, 0]}
      >
        {raceVisual.form === 'beast' ? (
          <BeastModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            animTime={animTimeRef.current}
            furColor={raceVisual.skin}
            idlePhase={stance.phase}
          />
        ) : raceVisual.form === 'dragon' ? (
          <DragonModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            animTime={animTimeRef.current}
            scaleColor={raceVisual.skin}
            idlePhase={stance.phase}
          />
        ) : raceVisual.form === 'ooze' ? (
          <OozeModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            animTime={animTimeRef.current}
            slimeColor={raceVisual.skin}
            idlePhase={stance.phase}
          />
        ) : raceVisual.form === 'aberration' ? (
          <AberrationModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            animTime={animTimeRef.current}
            fleshColor={raceVisual.skin}
            idlePhase={stance.phase}
          />
        ) : (
          <HumanoidModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            isAlive={isAlive}
            animState={isAlive ? animState : 'death'}
            animTime={animTimeRef.current}
            archetype={archetype}
            race={raceVisual}
            stance={stance}
          />
        )}
      </group>

      {/* Target reticle glow when targetable */}
      {showTargetHighlight && (
        <pointLight
          color={0xef4444}
          intensity={0.5}
          distance={2}
          position={[0, 0.5, 0]}
        />
      )}

      {/* Always-visible HP pip — sphere + team ring, positioned above the 2.2× scaled model */}
      <group position={[0, 1.85, 0]}>
        {/* HP color sphere — glows team-appropriate health color */}
        <mesh>
          <sphereGeometry args={[0.18, 10, 8]} />
          <meshStandardMaterial
            color={hpColor}
            emissive={hpColor}
            emissiveIntensity={1.0}
            transparent
            opacity={0.95}
          />
        </mesh>
        {/* Team ring — larger for visibility at 20+ unit distance */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <ringGeometry args={[0.20, 0.36, 20]} />
          <meshStandardMaterial
            color={teamColors.selection}
            emissive={teamColors.selection}
            emissiveIntensity={1.2}
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Nameplate — shown on hover, selection, or active turn (BG3 style) */}
      {(isSelected || isTurn || hovered) && (
        <Html
          position={[0, 2.15, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            padding: '3px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            fontSize: '11px',
            color: '#e6edf3',
            textAlign: 'center',
            borderLeft: `3px solid ${teamColors.nameAccent}`,
            minWidth: '70px',
          }}>
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
            </div>
            {distanceToActive !== null && (
              <div style={{ fontSize: '9px', color: '#facc15', marginTop: '2px', fontWeight: 'bold' }}>
                Distance: {distanceToActive} ft
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default CharacterActor;
