/**
 * @file characters/characterActor/models.tsx
 * Animation state + archetype/race derivation and the procedural creature
 * models (humanoid, beast, dragon, ooze, aberration) plus the BG3-style
 * selection decal and active-turn indicator. Extracted verbatim from
 * CharacterActor.tsx.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Animation states
export type AnimationState = 'idle' | 'walk' | 'attack_melee' | 'attack_ranged' | 'cast_spell' | 'hit_react' | 'death';

// ---------------------------------------------------------------------------
// Character archetype — determines visual loadout from class name
// ---------------------------------------------------------------------------

export type CharacterArchetype = 'fighter' | 'caster' | 'rogue';

export function getArchetype(className: string): CharacterArchetype {
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
export interface RaceVisual {
  skin: number;
  heightScale: number;
  buildScale: number;
  horns: boolean;
  beard: boolean;
  /** Body plan — non-humanoid forms render dedicated geometry. */
  form: 'humanoid' | 'beast' | 'dragon' | 'ooze' | 'aberration';
}

export function getRaceVisual(creatureTypes: string[] | undefined, name: string): RaceVisual {
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
  if (has('ooze') || has('slime') || has('pudding') || has('jelly') || has('gelatinous'))
    return { ...base, skin: 0x86a83e, heightScale: 1.0, buildScale: 1.0, form: 'ooze' }; // translucent blob
  if (has('aberration') || has('beholder') || has('mind flayer') || has('illithid') || has('aboleth'))
    return { ...base, skin: 0x6a4a8a, heightScale: 1.0, buildScale: 1.0, form: 'aberration' }; // floating eye + tentacles

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
export const BeastModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  animTime: number;
  furColor: number;
  idlePhase?: number;
}> = ({ teamColor, isPlayerTeam, animTime, furColor, idlePhase = 0 }) => {
  const breathe = Math.sin((animTime + idlePhase) * 2.2) * 0.008;
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
export const DragonModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  animTime: number;
  scaleColor: number;
  idlePhase?: number;
}> = ({ teamColor, isPlayerTeam, animTime, scaleColor, idlePhase = 0 }) => {
  const team = new THREE.Color(teamColor);
  const scale = new THREE.Color(scaleColor);
  const scaleDark = scale.clone().multiplyScalar(0.6);
  const emissiveIntensity = isPlayerTeam ? 0.12 : 0.5;
  const flap = Math.sin((animTime + idlePhase) * 3) * 0.35; // wing idle flap
  const breathe = Math.sin((animTime + idlePhase) * 1.8) * 0.01;

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
// Procedural ooze model (Ooze creatures)
// ---------------------------------------------------------------------------

/**
 * A low translucent wobbling blob so Oozes read as amorphous slime rather than
 * upright humanoids. The blob carries the team color (translucency keeps it
 * clearly non-armored); a darker nucleus hints at the engulfed-core look.
 */
export const OozeModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  animTime: number;
  slimeColor: number;
  idlePhase?: number;
}> = ({ teamColor, isPlayerTeam, animTime, slimeColor, idlePhase = 0 }) => {
  // Volume-ish preserving squish: x/z swell as y flattens
  const squish = Math.sin((animTime + idlePhase) * 2.6) * 0.06;
  const slime = new THREE.Color(slimeColor).lerp(new THREE.Color(teamColor), 0.45);
  const nucleus = new THREE.Color(slimeColor).multiplyScalar(0.45);
  const emissiveIntensity = isPlayerTeam ? 0.2 : 0.55;

  return (
    <group>
      {/* Main blob — flattened, translucent, wobbling */}
      <mesh position={[0, 0.14, 0]} scale={[1 + squish, 0.55 - squish * 0.5, 1 + squish]} castShadow>
        <sphereGeometry args={[0.26, 12, 10]} />
        <meshStandardMaterial
          color={slime}
          emissive={slime}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={0.72}
          roughness={0.15}
          metalness={0.0}
        />
      </mesh>
      {/* Nucleus — dark core visible through the translucent body */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={nucleus} roughness={0.6} />
      </mesh>
      {/* Pseudopods — small trailing lobes around the base */}
      {([[0.2, 0.04, 0.08], [-0.16, 0.04, 0.14], [-0.06, 0.04, -0.2]] as const).map(([px, py, pz], i) => (
        <mesh
          key={i}
          position={[px, py, pz]}
          scale={[1, 0.6 + Math.sin((animTime + idlePhase) * 2.6 + i * 2.1) * 0.15, 1]}
        >
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color={slime} transparent opacity={0.6} roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Procedural aberration model (Aberration creatures)
// ---------------------------------------------------------------------------

/**
 * A hovering eye-orb with hanging tentacles (beholder-like) so Aberrations read
 * as alien monsters. The orb carries the team color; the great eye and
 * tentacles use the alien skin tone. Bobs slowly to sell the levitation.
 */
export const AberrationModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  animTime: number;
  fleshColor: number;
  idlePhase?: number;
}> = ({ teamColor, isPlayerTeam, animTime, fleshColor, idlePhase = 0 }) => {
  const bob = Math.sin((animTime + idlePhase) * 1.6) * 0.03;
  const flesh = new THREE.Color(fleshColor);
  const fleshDark = flesh.clone().multiplyScalar(0.6);
  const emissiveIntensity = isPlayerTeam ? 0.15 : 0.55;

  return (
    <group position={[0, bob, 0]}>
      {/* Hovering body orb — team-colored */}
      <mesh position={[0, 0.46, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial
          color={teamColor}
          emissive={teamColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
      {/* Great central eye — white sclera + dark pupil facing forward (+Z) */}
      <mesh position={[0, 0.47, 0.15]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial color={0xe8e4d8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.47, 0.22]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={0x1a1020} roughness={0.2} />
      </mesh>
      {/* Eye stalks on top — short angled cones */}
      {([[-0.08, 0.35], [0.02, 0.0], [0.09, -0.3]] as const).map(([sx, tilt], i) => (
        <mesh key={i} position={[sx, 0.63, -0.02]} rotation={[tilt * 0.4, 0, -sx * 4]}>
          <coneGeometry args={[0.018, 0.12, 5]} />
          <meshStandardMaterial color={fleshDark} roughness={0.7} />
        </mesh>
      ))}
      {/* Hanging tentacles — slowly swaying cones below the orb */}
      {([[0.1, 0.06], [-0.1, 0.06], [0.06, -0.1], [-0.06, -0.1], [0, 0]] as const).map(([tx, tz], i) => (
        <mesh
          key={i}
          position={[tx, 0.24, tz]}
          rotation={[
            Math.sin((animTime + idlePhase) * 1.8 + i * 1.3) * 0.12 + tz * 0.6,
            0,
            Math.cos((animTime + idlePhase) * 1.8 + i * 1.3) * 0.12 - tx * 0.6,
          ]}
          castShadow
        >
          <coneGeometry args={[0.025, 0.26, 5]} />
          <meshStandardMaterial color={flesh} roughness={0.7} />
        </mesh>
      ))}
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
export const HumanoidModel: React.FC<{
  teamColor: number;
  isPlayerTeam: boolean;
  isAlive: boolean;
  animState: AnimationState;
  animTime: number;
  archetype: CharacterArchetype;
  race: RaceVisual;
  stance: { phase: number; lean: number; armL: number; armR: number };
}> = ({ teamColor, isPlayerTeam, isAlive, animState, animTime, archetype, race, stance }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Animation parameters — sway/breathe are phase-offset per character so the
  // battlefield doesn't bob in unison
  const idleSway = Math.sin(animTime * 1.5 + stance.phase) * 0.02;
  const idleBreathe = Math.sin(animTime * 2.0 + stance.phase) * 0.01;
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
        hitRecoil + (deathFall > 0 ? 0 : stance.lean),
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
        /* Caster: pointed wizard hat — tall and wide so "caster" reads at
           tactical zoom (GOAL #2), not just in close-ups */
        <group position={[0, 0.66, 0]}>
          {/* Brim */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.14, 12]} />
            <meshStandardMaterial color={armorDarker} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          {/* Cone */}
          <mesh position={[0, 0.13, 0]}>
            <coneGeometry args={[0.085, 0.26, 8]} />
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
        /* Fighter: half-sphere helmet + crest so the head silhouette differs
           from hat (caster) and hood (rogue) at tactical zoom */
        <group>
          <mesh position={[0, 0.63, 0]}>
            <sphereGeometry args={[0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={new THREE.Color(armorColor).multiplyScalar(0.6)}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
          {/* Front-to-back crest ridge */}
          <mesh position={[0, 0.71, 0]} castShadow>
            <boxGeometry args={[0.018, 0.07, 0.13]} />
            <meshStandardMaterial color={armorDarker} roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      )}

      {/* ---- LEFT ARM ---- */}
      <group
        position={[archetype === 'caster' ? -0.12 : -0.16, 0.38, 0]}
        rotation={[
          archetype === 'caster' ? -0.3 + idleSway : idleSway,
          0,
          (archetype === 'caster' ? -0.4 : -0.1 + idleSway * 0.5) + stance.armL,
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
          (archetype === 'caster' ? 0.3 : 0.1 - idleSway * 0.5) + stance.armR,
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
          /* Staff — tall wooden rod with glowing orb on top. Rises well above
             the head so the staff+orb silhouette reads at tactical zoom */
          <group position={[0, -0.08, 0.03]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.014, 0.018, 0.66, 6]} />
              <meshStandardMaterial color={0x5a3a18} roughness={0.7} metalness={0.0} />
            </mesh>
            {/* Glowing orb at staff top */}
            <mesh position={[0, 0.37, 0]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial
                color={armorColor}
                emissive={armorColor}
                emissiveIntensity={1.6}
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

      {/* ---- SHIELD + PAULDRONS (Fighter only) ---- */}
      {archetype === 'fighter' && (
        <>
          {/* Bigger shield so "sword and board" reads at tactical zoom */}
          <mesh position={[-0.22, 0.34, 0.06]} rotation={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.024, 0.22, 0.18]} />
            <meshStandardMaterial
              color={new THREE.Color(armorColor).multiplyScalar(0.8)}
              roughness={0.4}
              metalness={0.5}
            />
          </mesh>
          {/* Shoulder pauldrons — widen the upper silhouette vs the slim rogue
              and robed caster */}
          {[-0.15, 0.15].map((sx, i) => (
            <mesh key={i} position={[sx, 0.49, 0]} castShadow>
              <sphereGeometry args={[0.065, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={armorDark} roughness={0.4} metalness={0.6} />
            </mesh>
          ))}
        </>
      )}

      {/* ---- CASTER: shoulder cape ---- */}
      {archetype === 'caster' && (
        <mesh position={[0, 0.48, -0.05]} castShadow>
          <boxGeometry args={[0.26, 0.08, 0.04]} />
          <meshStandardMaterial color={armorDarker} roughness={0.8} />
        </mesh>
      )}

      {/* ---- ROGUE: belt with buckle + back cape ---- */}
      {archetype === 'rogue' && (
        <>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[0.19, 0.025, 0.13]} />
            <meshStandardMaterial color={0x4a3a1a} roughness={0.6} metalness={0.2} />
          </mesh>
          {/* Short trailing cape — gives the slim profile a distinct swept
              shape at tactical zoom without bulking it toward fighter */}
          <mesh position={[0, 0.36, -0.09]} rotation={[0.18, 0, 0]} castShadow>
            <boxGeometry args={[0.17, 0.3, 0.015]} />
            <meshStandardMaterial
              color={isPlayerTeam ? new THREE.Color(0x3a2210) : new THREE.Color(0x140808)}
              roughness={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Selection decal (BG3-style ground ring)
// ---------------------------------------------------------------------------

export const SelectionDecal: React.FC<{
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
      <ringGeometry args={[0.32, 0.46, 32]} />
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

export const TurnIndicator: React.FC<{ active: boolean }> = ({ active }) => {
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
        <ringGeometry args={[0.43, 0.62, 32]} />
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
