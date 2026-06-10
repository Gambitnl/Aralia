/**
 * @file CharacterActor.tsx
 * 3D character representation for the combat map.
 *
 * Each CombatCharacter is rendered as a CharacterActor containing:
 * - Humanoid procedural model (placeholder until glTF models via Pixal3D pipeline)
 * - Animation state machine (idle sway, walk bob, attack, hit react, death)
 * - BG3-style selection decal (cyan/red ground ring)
 * - Active turn golden ring with pulse animation
 * - Enhanced nameplate with HP bar, name, and status
 * - Smooth position interpolation for movement
 *
 * Research references:
 * - BG3 character selection UI: screenshot analysis from design spec
 * - Three.js AnimationMixer: https://threejs.org/docs/#api/en/animation/AnimationMixer
 * - R3F useFrame for animation: https://r3f.docs.pmnd.rs/api/hooks#useframe
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Character System" section
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CombatCharacter } from '../../../types/combat';
import { getDistance } from '../../../utils/combat/combatUtils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;

// Animation states
type AnimationState = 'idle' | 'walk' | 'attack_melee' | 'attack_ranged' | 'cast_spell' | 'hit_react' | 'death';

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

// Defense badge labels stay tiny and fixed so the 3D actor can mirror the 2D
// token language without stealing space from the model, HP orb, or nameplate.
type DefenseBadgeKind = 'resistance' | 'vulnerability' | 'immunity';

interface DefenseBadgeConfig {
  kind: DefenseBadgeKind;
  label: string;
  tooltip: string;
  toneClass: string;
}

const formatDefenseTooltip = (title: string, primary?: string[], secondary?: string[]) => {
  const segments: string[] = [];

  if (primary?.length) {
    segments.push(`${title}: ${primary.join(', ')}`);
  }

  if (secondary?.length) {
    segments.push(`Non-magical ${title.toLowerCase()}: ${secondary.join(', ')}`);
  }

  return segments.join(' | ');
};

const buildDefenseBadges = (character: CombatCharacter): DefenseBadgeConfig[] => {
  const badges: DefenseBadgeConfig[] = [];

  const resistanceTooltip = formatDefenseTooltip('Resistance', character.resistances, character.nonMagicalResistances);
  if (resistanceTooltip) {
    badges.push({
      kind: 'resistance',
      label: 'R',
      tooltip: resistanceTooltip,
      toneClass: 'border-emerald-200/70 bg-emerald-950/90 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.24)]'
    });
  }

  const vulnerabilityTooltip = formatDefenseTooltip('Vulnerability', character.vulnerabilities);
  if (vulnerabilityTooltip) {
    badges.push({
      kind: 'vulnerability',
      label: 'V',
      tooltip: vulnerabilityTooltip,
      toneClass: 'border-rose-200/70 bg-rose-950/90 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.24)]'
    });
  }

  const immunityTooltip = formatDefenseTooltip('Immunity', character.immunities, character.nonMagicalImmunities);
  if (immunityTooltip) {
    badges.push({
      kind: 'immunity',
      label: 'I',
      tooltip: immunityTooltip,
      toneClass: 'border-sky-200/70 bg-sky-950/90 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.24)]'
    });
  }

  return badges;
};

const DefenseBadgeRow: React.FC<{ character: CombatCharacter }> = ({ character }) => {
  const defenseBadges = useMemo(() => buildDefenseBadges(character), [character]);

  if (defenseBadges.length === 0) {
    return null;
  }

  // This strip is the 3D counterpart to the 2D token-perimeter badges. It
  // stays compact and always visible so the renderer shows the same tactical
  // facts without replacing the existing HP/nameplate stack.
  return (
    <Html
      position={[0, 3.24, 0]}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div
        data-testid="character-defense-badges"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '2px 5px',
          borderRadius: '999px',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          background: 'rgba(2, 6, 23, 0.78)',
          boxShadow: '0 0 12px rgba(0, 0, 0, 0.32)',
          pointerEvents: 'none',
        }}
      >
        {defenseBadges.map(badge => (
          <span
            key={badge.kind}
            data-testid={`defense-badge-${badge.kind}`}
            title={badge.tooltip}
            aria-label={badge.tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              border: '1px solid currentColor',
              fontSize: '7px',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 0,
            }}
            className={badge.toneClass}
          >
            {badge.label}
          </span>
        ))}
      </div>
    </Html>
  );
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CharacterActorProps {
  character: CombatCharacter;
  allCharacters: CombatCharacter[];
  tileElevation: number;
  isSelected: boolean;
  isTurn: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  onClick: (character: CombatCharacter) => void;
  activeCharacterId?: string | null;
}

// ---------------------------------------------------------------------------
// Character archetype — determines visual loadout from class name
// ---------------------------------------------------------------------------

type CharacterArchetype = 'fighter' | 'caster' | 'rogue';

function getArchetype(className: string): CharacterArchetype {
  const name = className.toLowerCase();
  if (['wizard', 'sorcerer', 'warlock', 'cleric', 'druid'].includes(name)) return 'caster';
  if (['rogue', 'monk', 'bard', 'ranger'].includes(name)) return 'rogue';
  return 'fighter'; // Fighter, Paladin, Barbarian, unknown
}

// ---------------------------------------------------------------------------
// Race visual profile — skin tone, body proportions, and silhouette cues
// ---------------------------------------------------------------------------

/**
 * Derives a race-specific look from the character's race (carried in
 * `creatureTypes[1]` by createPlayerCombatCharacter, falling back to the name
 * for monster-style enemies like "Orc Reaver" / "Goblin Skulker").
 *
 * Team color still owns friend/foe (armor + ground ring stay team-colored);
 * race only changes exposed skin tone, overall build, and a cheap silhouette
 * cue (dwarf beard, tiefling horns), so tactical readability is preserved while
 * a dwarf / elf / orc / tiefling no longer look identical.
 */
interface RaceVisual {
  skin: number;
  heightScale: number;
  buildScale: number;
  horns: boolean;
  beard: boolean;
  /** Body plan — non-humanoid forms render dedicated geometry. */
  form: 'humanoid' | 'beast' | 'dragon';
}

function getRaceVisual(creatureTypes: string[] | undefined, name: string): RaceVisual {
  // Match against the whole creature-type array plus the name so both player
  // races (['Humanoid','Elf']) and monster enemies (['Undead'] / 'Skeleton') read.
  const hay = `${(creatureTypes ?? []).join(' ')} ${name}`.toLowerCase();
  const has = (s: string) => hay.includes(s);
  const base: RaceVisual = { skin: 0xd4a57b, heightScale: 1.0, buildScale: 1.0, horns: false, beard: false, form: 'humanoid' };

  // --- Non-humanoid enemy creature forms (checked first) ---
  if (has('undead') || has('skeleton') || has('zombie') || has('ghoul') || has('wraith') || has('lich'))
    return { ...base, skin: 0xccc6ad, heightScale: 1.02, buildScale: 0.72 }; // gaunt, bone-pale
  if (has('beast') || has('wolf') || has('bear') || has('boar') || has('hound'))
    return { ...base, skin: 0x6f5538, heightScale: 0.95, buildScale: 1.0, form: 'beast' }; // quadruped
  if ((has('dragon') || has('wyvern') || has('drake')) && !has('dragonborn'))
    return { ...base, skin: 0x7a2b2b, heightScale: 1.0, buildScale: 1.0, form: 'dragon' }; // winged

  // Order: strongest / most specific cue first.
  if (has('goliath') || has('giant') || has('firbolg') || has('minotaur') || has('loxodon') || has('ogre') || has('troll')) return { ...base, skin: 0x9aa7b0, heightScale: 1.24, buildScale: 1.32 };
  if (has('dwarf') || has('duergar')) return { ...base, skin: 0xc9885a, heightScale: 0.82, buildScale: 1.24, beard: true };
  if (has('orc') || has('bugbear') || has('hobgoblin')) return { ...base, skin: 0x8fa36b, heightScale: 1.12, buildScale: 1.26 };
  if (has('goblin') || has('kobold')) return { ...base, skin: 0x9bbf5a, heightScale: 0.74, buildScale: 0.96 };
  if (has('tiefling') || has('infernal') || has('abyssal') || has('chthonic')) return { ...base, skin: 0xb24a68, heightScale: 1.04, horns: true };
  if (has('dragonborn') || has('lizardfolk') || has('yuan')) return { ...base, skin: 0x5f9a63, heightScale: 1.1, buildScale: 1.16 };
  if (has('drow') || has('shadar')) return { ...base, skin: 0x7163a0, heightScale: 1.08, buildScale: 0.86 };
  if (has('elf') || has('eladrin') || has('fairy')) return { ...base, skin: 0xe9d6bd, heightScale: 1.1, buildScale: 0.84 };
  if (has('halfling') || has('gnome') || has('kender') || has('harengon')) return { ...base, skin: 0xd9a878, heightScale: 0.7, buildScale: 0.94 };
  return base; // human / default
}

// ---------------------------------------------------------------------------
// Procedural quadruped model (Beast creatures)
// ---------------------------------------------------------------------------

/**
 * A simple four-legged creature (wolf/hound/bear) so Beasts read as animals
 * rather than low humanoids. Built facing +Z to match the humanoid (the actor
 * group applies facing). The body carries the team color (friend/foe stays
 * obvious); head/legs/tail use the fur tone.
 */
const BeastModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  animTime: number;
  furColor: number;
}> = ({ teamColor, isPlayerTeam, animTime, furColor }) => {
  const breathe = Math.sin(animTime * 2.2) * 0.008;
  const fur = new THREE.Color(furColor);
  const furDark = fur.clone().multiplyScalar(0.7);
  const emissiveIntensity = isPlayerTeam ? 0.12 : 0.6;

  return (
    <group position={[0, breathe, 0]}>
      {/* Body — team-colored so friend/foe still reads at a glance */}
      <mesh position={[0, 0.24, 0]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.42]} />
        <meshStandardMaterial color={teamColor} emissive={teamColor} emissiveIntensity={emissiveIntensity} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Haunches — slight rise at the rear */}
      <mesh position={[0, 0.27, -0.16]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.16]} />
        <meshStandardMaterial color={furDark} roughness={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.3, 0.26]} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.16]} />
        <meshStandardMaterial color={fur} roughness={0.8} />
      </mesh>
      {/* Snout */}
      <mesh position={[0, 0.26, 0.37]} castShadow>
        <boxGeometry args={[0.07, 0.07, 0.1]} />
        <meshStandardMaterial color={furDark} roughness={0.8} />
      </mesh>
      {/* Ears */}
      {[-0.045, 0.045].map((x, i) => (
        <mesh key={i} position={[x, 0.4, 0.24]} rotation={[-0.2, 0, 0]}>
          <coneGeometry args={[0.03, 0.07, 4]} />
          <meshStandardMaterial color={furDark} roughness={0.85} />
        </mesh>
      ))}
      {/* Legs */}
      {([[0.07, 0.15], [-0.07, 0.15], [0.07, -0.15], [-0.07, -0.15]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.11, z]} castShadow>
          <boxGeometry args={[0.05, 0.22, 0.06]} />
          <meshStandardMaterial color={furDark} roughness={0.85} />
        </mesh>
      ))}
      {/* Tail — swept up and back */}
      <mesh position={[0, 0.32, -0.26]} rotation={[0.9, 0, 0]} castShadow>
        <coneGeometry args={[0.035, 0.22, 6]} />
        <meshStandardMaterial color={fur} roughness={0.85} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Procedural winged-dragon model (Dragon creatures)
// ---------------------------------------------------------------------------

/**
 * A winged, long-necked, four-legged dragon so true Dragons read as iconic
 * monsters (pair with a Large/Huge `stats.size` to make them loom). Faces +Z.
 * The body/wings carry the team color so friend/foe stays readable; scales use
 * a darker shade. Wings give a slow idle flap.
 */
const DragonModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  animTime: number;
  scaleColor: number;
}> = ({ teamColor, isPlayerTeam, animTime, scaleColor }) => {
  const team = new THREE.Color(teamColor);
  const scale = new THREE.Color(scaleColor);
  const scaleDark = scale.clone().multiplyScalar(0.6);
  const emissiveIntensity = isPlayerTeam ? 0.12 : 0.5;
  const flap = Math.sin(animTime * 3) * 0.35; // wing idle flap
  const breathe = Math.sin(animTime * 1.8) * 0.01;

  return (
    <group position={[0, breathe, 0]}>
      {/* Body */}
      <mesh position={[0, 0.34, -0.02]} castShadow>
        <boxGeometry args={[0.26, 0.22, 0.5]} />
        <meshStandardMaterial color={team} emissive={team} emissiveIntensity={emissiveIntensity} roughness={0.55} metalness={0.15} />
      </mesh>
      {/* Neck — angled up toward the head */}
      <mesh position={[0, 0.5, 0.26]} rotation={[0.7, 0, 0]} castShadow>
        <boxGeometry args={[0.12, 0.26, 0.12]} />
        <meshStandardMaterial color={scaleDark} roughness={0.7} />
      </mesh>
      {/* Head + snout */}
      <mesh position={[0, 0.64, 0.36]} castShadow>
        <boxGeometry args={[0.14, 0.13, 0.16]} />
        <meshStandardMaterial color={scale} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.61, 0.47]} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.12]} />
        <meshStandardMaterial color={scaleDark} roughness={0.7} />
      </mesh>
      {/* Horns */}
      {[-0.045, 0.045].map((x, i) => (
        <mesh key={i} position={[x, 0.72, 0.32]} rotation={[-0.6, 0, 0]}>
          <coneGeometry args={[0.022, 0.1, 5]} />
          <meshStandardMaterial color={0x201018} roughness={0.6} />
        </mesh>
      ))}
      {/* Wings — large membranes that idle-flap (team-colored for friend/foe) */}
      {([-1, 1] as const).map((side, i) => (
        <mesh
          key={i}
          position={[side * 0.16, 0.46, -0.04]}
          rotation={[0.1, side * 0.3, side * (0.5 + flap)]}
          castShadow
        >
          <boxGeometry args={[0.5, 0.02, 0.34]} />
          <meshStandardMaterial color={team} emissive={team} emissiveIntensity={emissiveIntensity * 0.8} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Legs */}
      {([[0.1, 0.16], [-0.1, 0.16], [0.1, -0.16], [-0.1, -0.16]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.13, z]} castShadow>
          <boxGeometry args={[0.07, 0.26, 0.08]} />
          <meshStandardMaterial color={scaleDark} roughness={0.75} />
        </mesh>
      ))}
      {/* Tail — long, tapering, swept back */}
      <mesh position={[0, 0.3, -0.4]} rotation={[-1.3, 0, 0]} castShadow>
        <coneGeometry args={[0.07, 0.5, 6]} />
        <meshStandardMaterial color={scale} roughness={0.7} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Procedural humanoid model (placeholder for glTF)
// ---------------------------------------------------------------------------

/**
 * Class-aware humanoid shape built from primitives.
 * - Fighter: heavy armor + sword + shield
 * - Caster: flowing robes + tall staff (no shield)
 * - Rogue: hooded cowl + dual daggers (no shield)
 */
const HumanoidModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  isAlive: boolean;
  animState: AnimationState;
  animTime: number;
  archetype: CharacterArchetype;
  race: RaceVisual;
}> = ({ teamColor, isPlayerTeam, isAlive, animState, animTime, archetype, race }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Animation parameters
  const idleSway = Math.sin(animTime * 1.5) * 0.02;
  const idleBreathe = Math.sin(animTime * 2.0) * 0.01;
  const walkBob = animState === 'walk' ? Math.abs(Math.sin(animTime * 8)) * 0.05 : 0;
  const attackSwing = animState === 'attack_melee'
    ? Math.sin(Math.min(animTime * 4, Math.PI)) * 0.8 : 0;
  const hitRecoil = animState === 'hit_react'
    ? Math.sin(Math.min(animTime * 6, Math.PI)) * 0.15 : 0;
  const deathFall = animState === 'death'
    ? Math.min(animTime * 2, Math.PI / 2) : 0;

  const skinColor = race.skin;
  const armorColor = teamColor;
  const armorDark = new THREE.Color(armorColor).multiplyScalar(0.7);
  const armorDarker = new THREE.Color(armorColor).multiplyScalar(0.5);
  const robeColor = archetype === 'caster'
    ? new THREE.Color(armorColor).lerp(new THREE.Color(0x1a0a30), 0.4) // Deep purple-tinted
    : armorColor;

  return (
    <group
      ref={groupRef}
      rotation={[
        deathFall > 0 ? -deathFall : 0,
        0,
        hitRecoil,
      ]}
      position={[0, walkBob + idleBreathe, 0]}
    >
      {/* ---- TORSO ---- */}
      {archetype === 'caster' ? (
        /* Caster: flowing robe — enemy emits strongly to cut through any lighting */
        <mesh position={[0, 0.30, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.14, 0.35, 8]} />
          <meshStandardMaterial
            color={robeColor}
            emissive={robeColor}
            emissiveIntensity={isPlayerTeam ? 0.15 : 0.75}
            roughness={0.8}
            metalness={0.0}
          />
        </mesh>
      ) : archetype === 'rogue' ? (
        /* Rogue: slim leather armor — warm brown for players, near-black with red glow for enemies */
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.18, 0.26, 0.12]} />
          <meshStandardMaterial
            color={isPlayerTeam ? new THREE.Color(0x7a4a22) : new THREE.Color(0x1a0808)}
            emissive={isPlayerTeam ? new THREE.Color(0x5a3010) : new THREE.Color(0xcc1111)}
            emissiveIntensity={isPlayerTeam ? 0.15 : 0.75}
            roughness={0.75}
            metalness={0.1}
          />
        </mesh>
      ) : (
        /* Fighter: chunky plate armor — enemy emits strongly to cut through any lighting */
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.24, 0.28, 0.15]} />
          <meshStandardMaterial
            color={armorColor}
            emissive={armorColor}
            emissiveIntensity={isPlayerTeam ? 0.15 : 0.75}
            roughness={0.4}
            metalness={0.5}
          />
        </mesh>
      )}

      {/* ---- HEAD ---- */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} metalness={0.0} />
      </mesh>

      {/* ---- RACE SILHOUETTE CUES ---- */}
      {/* Dwarf beard — downward cone under the chin */}
      {race.beard && (
        <mesh position={[0, 0.47, 0.035]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.075, 0.13, 8]} />
          <meshStandardMaterial color={0x6b4a2a} roughness={0.95} />
        </mesh>
      )}
      {/* Tiefling horns — a pair of dark cones swept up and back from the brow */}
      {race.horns && (
        <group position={[0, 0.63, -0.005]}>
          <mesh position={[-0.05, 0.01, 0]} rotation={[-0.5, 0, -0.35]} castShadow>
            <coneGeometry args={[0.022, 0.12, 6]} />
            <meshStandardMaterial color={0x241015} roughness={0.6} />
          </mesh>
          <mesh position={[0.05, 0.01, 0]} rotation={[-0.5, 0, 0.35]} castShadow>
            <coneGeometry args={[0.022, 0.12, 6]} />
            <meshStandardMaterial color={0x241015} roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* ---- HEADGEAR ---- */}
      {archetype === 'caster' ? (
        /* Caster: pointed wizard hat */
        <group position={[0, 0.66, 0]}>
          {/* Brim */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.11, 12]} />
            <meshStandardMaterial color={armorDarker} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          {/* Cone */}
          <mesh position={[0, 0.06, 0]}>
            <coneGeometry args={[0.06, 0.14, 8]} />
            <meshStandardMaterial color={armorDarker} roughness={0.8} />
          </mesh>
        </group>
      ) : archetype === 'rogue' ? (
        /* Rogue: hood/cowl — warm dark brown for players, near-black for enemies */
        <mesh position={[0, 0.62, -0.01]}>
          <sphereGeometry args={[0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
          <meshStandardMaterial color={isPlayerTeam ? new THREE.Color(0x4a2a12) : new THREE.Color(0x0d0505)} roughness={0.8} />
        </mesh>
      ) : (
        /* Fighter: half-sphere helmet */
        <mesh position={[0, 0.63, 0]}>
          <sphereGeometry args={[0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={new THREE.Color(armorColor).multiplyScalar(0.6)}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      )}

      {/* ---- LEFT ARM ---- */}
      <group
        position={[archetype === 'caster' ? -0.12 : -0.16, 0.38, 0]}
        rotation={[
          archetype === 'caster' ? -0.3 + idleSway : idleSway,
          0,
          archetype === 'caster' ? -0.4 : -0.1 + idleSway * 0.5,
        ]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.05, 0.20, 0.05]} />
          <meshStandardMaterial
            color={archetype === 'caster' ? robeColor : skinColor}
            roughness={0.7}
          />
        </mesh>
        {/* Rogue: left-hand dagger */}
        {archetype === 'rogue' && (
          <mesh position={[0, -0.15, 0.02]} castShadow>
            <boxGeometry args={[0.015, 0.12, 0.008]} />
            <meshStandardMaterial color={0xaaaaaa} roughness={0.3} metalness={0.9} />
          </mesh>
        )}
      </group>

      {/* ---- RIGHT ARM + WEAPON ---- */}
      <group
        position={[archetype === 'caster' ? 0.12 : 0.16, 0.38, 0]}
        rotation={[
          archetype === 'caster' ? 0.2 + attackSwing * 0.3 : attackSwing,
          0,
          archetype === 'caster' ? 0.3 : 0.1 - idleSway * 0.5,
        ]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.05, 0.20, 0.05]} />
          <meshStandardMaterial
            color={archetype === 'caster' ? robeColor : skinColor}
            roughness={0.7}
          />
        </mesh>
        {archetype === 'caster' ? (
          /* Staff — tall wooden rod with glowing orb on top */
          <group position={[0, -0.08, 0.03]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.012, 0.015, 0.50, 6]} />
              <meshStandardMaterial color={0x5a3a18} roughness={0.7} metalness={0.0} />
            </mesh>
            {/* Glowing orb at staff top */}
            <mesh position={[0, 0.28, 0]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <meshStandardMaterial
                color={armorColor}
                emissive={armorColor}
                emissiveIntensity={1.0}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        ) : archetype === 'rogue' ? (
          /* Rogue: right-hand dagger — shorter than a sword */
          <mesh position={[0, -0.15, 0.02]} castShadow>
            <boxGeometry args={[0.015, 0.12, 0.008]} />
            <meshStandardMaterial color={0xaaaaaa} roughness={0.3} metalness={0.9} />
          </mesh>
        ) : (
          /* Fighter: broadsword */
          <mesh position={[0, -0.18, 0.02]} castShadow>
            <boxGeometry args={[0.025, 0.22, 0.012]} />
            <meshStandardMaterial color={0x888888} roughness={0.3} metalness={0.8} />
          </mesh>
        )}
      </group>

      {/* ---- LEGS ---- */}
      {archetype === 'caster' ? (
        /* Caster: robe skirt hides legs — just the robe bottom peeks */
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.16, 0.15, 8]} />
          <meshStandardMaterial color={robeColor} roughness={0.8} />
        </mesh>
      ) : (
        <>
          {/* Left leg */}
          <group position={[-0.06, 0.1, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.2, 0.08]} />
              <meshStandardMaterial
                color={archetype === 'rogue' ? (isPlayerTeam ? new THREE.Color(0x5a3410) : new THREE.Color(0x100505)) : armorDark}
                roughness={0.6}
                metalness={archetype === 'rogue' ? 0.0 : 0.2}
              />
            </mesh>
          </group>
          {/* Right leg */}
          <group position={[0.06, 0.1, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.2, 0.08]} />
              <meshStandardMaterial
                color={archetype === 'rogue' ? (isPlayerTeam ? new THREE.Color(0x5a3410) : new THREE.Color(0x100505)) : armorDark}
                roughness={0.6}
                metalness={archetype === 'rogue' ? 0.0 : 0.2}
              />
            </mesh>
          </group>
        </>
      )}

      {/* ---- SHIELD (Fighter only) ---- */}
      {archetype === 'fighter' && (
        <mesh position={[-0.20, 0.32, 0.06]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.02, 0.16, 0.13]} />
          <meshStandardMaterial
            color={new THREE.Color(armorColor).multiplyScalar(0.8)}
            roughness={0.4}
            metalness={0.5}
          />
        </mesh>
      )}

      {/* ---- CASTER: shoulder cape ---- */}
      {archetype === 'caster' && (
        <mesh position={[0, 0.48, -0.05]} castShadow>
          <boxGeometry args={[0.26, 0.08, 0.04]} />
          <meshStandardMaterial color={armorDarker} roughness={0.8} />
        </mesh>
      )}

      {/* ---- ROGUE: belt with buckle ---- */}
      {archetype === 'rogue' && (
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.19, 0.025, 0.13]} />
          <meshStandardMaterial color={0x4a3a1a} roughness={0.6} metalness={0.2} />
        </mesh>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Selection decal (BG3-style ground ring)
// ---------------------------------------------------------------------------

const SelectionDecal: React.FC<{
  color: number;
  visible: boolean;
  pulse: boolean;
  baseOpacity?: number;
}> = ({ color, visible, pulse, baseOpacity = 0.85 }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    if (pulse && visible) {
      const scale = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      ringRef.current.scale.setScalar(scale);
    } else {
      ringRef.current.scale.setScalar(1.0);
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      {/* Thicker/brighter idle ring so EVERY unit has a clearly readable
          team-colored circle at tactical zoom (not just the selected one). */}
      <ringGeometry args={[0.42, 0.60, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={visible ? 1.4 : 1.0}
        transparent
        opacity={visible ? baseOpacity : 0.62}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Active turn indicator (golden ring with rotation animation)
// ---------------------------------------------------------------------------

const TurnIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pillarMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const arrowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!groupRef.current || !active) return;
    // Pulse pillar opacity and emissive
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 2.5) * 0.3;
    if (pillarMatRef.current) {
      pillarMatRef.current.opacity = pulse;
      pillarMatRef.current.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 2.5) * 0.5;
    }
    // Bob the arrow indicator
    if (groupRef.current) {
      groupRef.current.children[1].position.y = 4.8 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }
    if (arrowMatRef.current) {
      arrowMatRef.current.opacity = 0.8 + Math.sin(state.clock.elapsedTime * 2.5) * 0.2;
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {/* Tall vertical beam — visible at 20+ units */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 5.0, 8]} />
        <meshStandardMaterial
          ref={pillarMatRef}
          color={0xfbbf24}
          emissive={0xfbbf24}
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      {/* Downward-pointing chevron arrow — bobbing above pillar */}
      <group position={[0, 4.8, 0]}>
        {/* Main arrow cone pointing down */}
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.45, 8]} />
          <meshStandardMaterial
            ref={arrowMatRef}
            color={0xfbbf24}
            emissive={0xfbbf24}
            emissiveIntensity={2.0}
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        {/* Second arrow cone slightly above for chevron look */}
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.32, 8]} />
          <meshStandardMaterial
            color={0xfbbf24}
            emissive={0xfbbf24}
            emissiveIntensity={2.0}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Wide ground ring — enhanced for visibility */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.80, 32]} />
        <meshStandardMaterial
          color={0xfbbf24}
          emissive={0xfbbf24}
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CharacterActor: React.FC<CharacterActorProps> = ({
  character,
  allCharacters,
  tileElevation,
  isSelected,
  isTurn,
  isTargetable,
  targetingMode,
  onClick,
  activeCharacterId
}) => {
  const groupRef = useRef<THREE.Group>(null);
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

  // Elevation from tile data — match terrain mesh (ELEVATION_SCALE = 0.3)
  const elevation = tileElevation * ELEVATION_SCALE;

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

      {/* Character model — scaled up so the party reads as the focal point
          rather than being dwarfed by terrain/trees (GOAL #3). */}
      <group
        scale={[
          3.7 * raceVisual.buildScale * sizeScale,
          3.7 * raceVisual.heightScale * sizeScale,
          3.7 * raceVisual.buildScale * sizeScale,
        ]}
        rotation={[0, facingRotation, 0]}
      >
        {raceVisual.form === 'beast' ? (
          <BeastModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            animTime={animTimeRef.current}
            furColor={raceVisual.skin}
          />
        ) : raceVisual.form === 'dragon' ? (
          <DragonModel
            teamColor={teamColors.primary}
            isPlayerTeam={isPlayer}
            animTime={animTimeRef.current}
            scaleColor={raceVisual.skin}
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

      {/* Always-visible HP pip — sphere + team ring, positioned above the 3.7× scaled model */}
      <group position={[0, 3.05, 0]}>
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
          position={[0, 3.5, 0]}
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
