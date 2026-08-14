// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 18:32:11
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 23 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file BattleMap3D.tsx
 * 3D rendering frontend for the tactical combat map, using react-three-fiber.
 *
 * This component is the 3D equivalent of BattleMap.tsx. It consumes the same
 * hooks and props but renders a Three.js scene instead of HTML/CSS grid.
 *
 * Architecture:
 * - All game logic stays in shared hooks (useBattleMap, useTurnManager, etc.)
 * - This component is purely a rendering layer
 * - Can be toggled with the 2D BattleMap via RenderModeToggle
 *
 * Research references:
 * - R3F TypeScript setup: https://r3f.docs.pmnd.rs/api/typescript
 * - drei controls: https://drei.docs.pmnd.rs/controls/introduction
 * - Postprocessing: https://react-postprocessing.docs.pmnd.rs/effects/ssao
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { canUseDevTools } from '../../utils/core';
import { Z_INDEX } from '../../styles/zIndex';
import { Canvas } from '@react-three/fiber';
// MapControls now handled by CameraController
import { ContactShadows, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, N8AO, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Animation, BattleMapData, BattleMapTile, CombatCharacter, CombatState, LightSource, SpellEffectAnimationData, TargetableMapObject } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import { useVisibility } from '../../hooks/combat/useVisibility';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { TerrainMesh, GridOverlay, GrassLayer, FordStones, DecorationProps, GroundScatter, EzTreeLayer, TerrainApron, GroundMist, makeTerrainHeightSampler } from './terrain';
/* Straight from its own module, not through the barrel: this is arithmetic on
 * the map, not a scene component, and the 3D suites replace the whole barrel
 * with stub components. A scene that cannot compute how far it can see is not
 * a scene worth testing. */
import { resolveHorizon } from './terrain/apronField';
import VolumeArenaGround, { ARENA_HEIGHTFIELD_INSET_TILES, type ArenaSurface } from './terrain/VolumeArenaGround';
import VolumeArenaWater from './terrain/VolumeArenaWater';
import { CharacterActor } from './characters';
import TargetingDecals from './TargetingDecals';
import { CameraController } from './camera';
import { VFXSystem, LivingWorld } from './vfx';
import { selectVisibilityObserver } from './visibilityObserverPolicy';
import { SpellArtifact3DMarker } from './SpellArtifact3DMarker';
import { buildSpellMapArtifactMarkers, type SpellMapArtifacts } from './spellMapArtifacts';
import { isWebGpuBattleMapEnabled } from './webgpuBattleMapFlag';
import OpeningThreatScene3D, { selectOpeningThreatScene3DFacts } from './OpeningThreatScene3D';
import { PerfProbe } from '../../devtools/perf';

// Experimental WebGPU render path (opt-in via ?gpu=1). Lazily imported so
// `three/webgpu` + TSL are never pulled onto the default WebGL battle-map path.
const BattleMap3DGpuScene = React.lazy(() => import('./BattleMap3DGpuScene'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BattleMap3DProps {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  /** Non-creature summon/control records rendered as explicit 3D markers. */
  spellMapArtifacts?: SpellMapArtifacts;
  combatState: {
    turnManager: ReturnType<typeof useTurnManager>;
    turnState: ReturnType<typeof useTurnManager>['turnState'];
    abilitySystem: ReturnType<typeof useAbilitySystem>;
    isCharacterTurn: (id: string) => boolean;
    onCharacterUpdate: (character: CombatCharacter) => void;
  };
}

// Tile size in world units (1 tile = 1 unit in 3D space)
const TILE_WORLD_SIZE = 1.0;

interface TargetableObject3DMarkerProps {
  targetObject: TargetableMapObject;
  isTargetable: boolean;
  groundY: number;
}

const TargetableObject3DMarker: React.FC<TargetableObject3DMarkerProps> = ({ targetObject, isTargetable, groundY }) => {
  const color = isTargetable ? '#facc15' : '#94a3b8';
  const position: [number, number, number] = [
    targetObject.position.x + 0.5,
    groundY + 0.1,
    targetObject.position.y + 0.5
  ];

  return (
    <group position={position}>
      {isTargetable && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.34, 0.48, 36]} />
          <meshBasicMaterial color={color} transparent opacity={0.52} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.38, 0.34, 0.38]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isTargetable ? 0.42 : 0.12} roughness={0.64} />
      </mesh>
      <Html center distanceFactor={12} position={[0, 0.74, 0]} zIndexRange={[58, 18]}>
        {/* Registered targetable objects need their own 3D handle because they
            are not actors or spell artifacts, but object-targeting spells still
            need visible selectable things on the map. */}
        <div
          data-testid={`targetable-object-3d-${targetObject.id}`}
          title={`${targetObject.name ?? targetObject.id} object${isTargetable ? ' - valid spell target' : ''}`}
          className={`pointer-events-none rounded border px-1.5 py-0.5 text-[10px] font-black leading-none shadow-[0_0_10px_rgba(15,23,42,0.8)] ${
            isTargetable
              ? 'border-yellow-100 bg-amber-300 text-amber-950'
              : 'border-slate-200/70 bg-slate-950/88 text-slate-100'
          }`}
        >
          OBJ
        </div>
      </Html>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Per-biome lighting presets
// ---------------------------------------------------------------------------

interface BiomeLighting {
  sunColor: number;
  sunIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  hemisphereTop: number;
  hemisphereBottom: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  /** Optional sun offset from map center [dx, y, dz] — lower Y = longer shadows */
  sunPos?: [number, number, number];
  /**
   * The BELOW-GRADE BOUNCE. See `SceneLighting`.
   *
   * A neutral counter-key from the opposite azimuth, aimed at the surfaces a
   * flat board never had: the inside of a crater. Optional, because the two
   * enclosed biomes light their interiors with pooled point lights already and
   * a second sun in a cave is a contradiction.
   */
  bounceColor?: number;
  bounceIntensity?: number;
}

const BIOME_LIGHTING: Record<string, BiomeLighting> = {
  forest: {
    sunColor: 0xffe0a0, sunIntensity: 2.2,
    ambientColor: 0x2c3a24, ambientIntensity: 0.45,
    hemisphereTop: 0x87ceeb, hemisphereBottom: 0x3a2a1a,
    // The ground has an inside now, and this preset was built for a board with
    // none. See SceneLighting's bounce note.
    bounceColor: 0xcacdd1, bounceIntensity: 0.85,
    // Fog pushed back so the battlefield reads clearly at tactical zoom; fog now
    // only hazes the far map edges instead of swallowing the play area.
    // Hue: cool airy sage — the old 0x8fa07a khaki tinted every horizon and
    // water edge like dust; distance haze should read as atmosphere.
    fogColor: 0x9db8b0, fogNear: 22, fogFar: 60,
  },
  cave: {
    // Readability pass: cave was never actually lit before (biome bug rendered it
    // as forest), so its preset was far too dark to see the battlefield. Lifted
    // ambient/sun to keep a dark, enclosed mood while making combat readable.
    sunColor: 0x6070a0, sunIntensity: 0.5,
    ambientColor: 0x2a3850, ambientIntensity: 0.6,
    hemisphereTop: 0x2a2a4a, hemisphereBottom: 0x12121f,
    fogColor: 0x0a0a1a, fogNear: 10, fogFar: 30,
  },
  dungeon: {
    sunColor: 0xc89050, sunIntensity: 0.6,
    ambientColor: 0x202030, ambientIntensity: 0.3,
    hemisphereTop: 0x404050, hemisphereBottom: 0x1a1510,
    fogColor: 0x1a1520, fogNear: 8, fogFar: 24,
  },
  desert: {
    // Harsh-light character (GOAL #55): near-white stronger sun, reduced warm
    // fill, and a lower sun angle so props/characters cast long hard shadows
    // across the sand instead of the soft photo-studio look.
    sunColor: 0xfff6e4, sunIntensity: 2.9,
    ambientColor: 0x806040, ambientIntensity: 0.32,
    hemisphereTop: 0xe8e0c8, hemisphereBottom: 0xc8a060,
    // Fog pushed back now that the ground apron hides the open map edge; far
    // sand fades into the warm horizon haze instead of a hard cliff into void.
    fogColor: 0xd8c8a0, fogNear: 24, fogFar: 70,
    sunPos: [16, 11, 8],
    // Sand is bright and bounces hard; a pit in a dune is not a black hole.
    bounceColor: 0xd6d2c8, bounceIntensity: 1.05,
  },
  swamp: {
    // Readability nudge (kept murky/green on purpose); fog pushed back a little
    // so the battlefield reads past the immediate foreground.
    sunColor: 0xa0b040, sunIntensity: 0.9,
    ambientColor: 0x2a3a24, ambientIntensity: 0.42,
    hemisphereTop: 0x405030, hemisphereBottom: 0x2a2010,
    fogColor: 0x2a3020, fogNear: 12, fogFar: 34,
    // Overcast and murky, so less of it — but still not none.
    bounceColor: 0xb9bcbb, bounceIntensity: 0.6,
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Lighting rig driven by biome presets. `shadowHalf` is the half-extent of
 *  the shadow frustum in world units — derived from the map size so the whole
 *  battlefield casts/receives shadows (a fixed ±25 silently cut shadows off
 *  outside the center region once the map grew past 40×30). */
const SceneLighting: React.FC<{ biome: string; mapCenter: readonly [number, number, number]; shadowHalf?: number }> = ({ biome, mapCenter, shadowHalf = 25 }) => {
  const preset = BIOME_LIGHTING[biome] ?? BIOME_LIGHTING.forest;
  /* `?bounce=0` puts the rig back the way it was before the ground had an
   * inside, so the crater-interior A/B is one page reload apart instead of one
   * git checkout apart. Dev surfaces only; 1 everywhere else. */
  const bounceScale = useMemo(() => {
    if (typeof window === 'undefined' || !canUseDevTools()) return 1;
    const raw = new URLSearchParams(window.location.search).get('bounce');
    if (raw === null) return 1;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.max(0, v) : 1;
  }, []);
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const cx = mapCenter?.[0] ?? 0;
  const cz = mapCenter?.[2] ?? 0;
  // Accent point-light pools were laid out for a 40×30 map; spread them with it.
  const accentSpread = shadowHalf / 25;

  // Point directional light at map center so shadow frustum covers the battlefield
  React.useEffect(() => {
    // The ref target can be absent in mocked or partially mounted scenes, so
    // keep the alignment update guarded instead of assuming the light target exists.
    const target = directionalRef.current?.target;
    if (target) {
      target.position.set(cx, 0, cz);
      target.updateMatrixWorld();
    }
  }, [cx, cz]);

  return (
    <>
      <ambientLight color={preset.ambientColor} intensity={preset.ambientIntensity} />
      <hemisphereLight
        args={[preset.hemisphereTop, preset.hemisphereBottom, 0.4]}
      />
      <directionalLight
        ref={directionalRef}
        color={preset.sunColor}
        intensity={preset.sunIntensity}
        position={[
          cx + (preset.sunPos?.[0] ?? 12) * accentSpread,
          (preset.sunPos?.[1] ?? 16) * accentSpread,
          cz + (preset.sunPos?.[2] ?? 12) * accentSpread,
        ]}
        castShadow
        // 2048² shadow map: A/B-captured against 4096² on the SAME generated
        // scene at the tactical orbit pose (.agent/scratch/ab-shadow-{4096,2048}.png)
        // — shadow edges are visually identical at this zoom, but the per-frame
        // shadow raster cost drops ~4×.
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={Math.max(60, shadowHalf * 2.4)}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      {/* Cool fill light from opposite side for warm/cool contrast */}
      <directionalLight
        color={0x6080c0}
        intensity={0.4}
        position={[cx - 8, 4, cz - 6]}
      />

      {/* THE BELOW-GRADE BOUNCE — a NEUTRAL counter-key, low and from the
          opposite azimuth.

          These presets were authored for a board with no inside. Nothing on a
          heightfield ever faced away from the sun AND away from the sky at
          once, so a rig of one warm key, one cool 0.4 fill and 0.45 of dark
          GREEN ambient was enough. The arena is voxels now: an eight-metre
          bore under this rig read as a silhouette with no material in it at
          all, which is the same fault the sandbox hit twice and cured twice.
          Its cure is the one copied here — the round-4 lesson that ambience
          may not carry a HUE (a saturated fill repaints the shade side of a
          wall instead of darkening it) and the round-5 lesson that the fix for
          near-black shade is to lift its VALUE with a near-neutral term.

          It is a directional and not more hemisphere on purpose. A hemisphere
          light is driven by the normal's Y, so raising it brightens the flat
          top of the board — the surface that is already lit — far more than a
          crater's vertical walls. A low counter-key does the opposite: the
          open ground barely moves because it is saturated by the key, and the
          faces that gain are exactly the ones turned away from it. */}
      {preset.bounceIntensity !== undefined && bounceScale > 0 && (
        <directionalLight
          color={preset.bounceColor ?? 0xcacdd1}
          intensity={preset.bounceIntensity * bounceScale}
          position={[
            cx - (preset.sunPos?.[0] ?? 12) * accentSpread * 0.8,
            (preset.sunPos?.[1] ?? 16) * accentSpread * 0.35,
            cz - (preset.sunPos?.[2] ?? 12) * accentSpread * 0.8,
          ]}
        />
      )}

      {/* Biome accent point-lights — pooled torch (dungeon) / crystal (cave) glow
          for underground drama: warm/cool light pools with darker space between,
          instead of flat uniform ambient. Only for enclosed biomes. */}
      {(biome === 'cave' || biome === 'dungeon') &&
        (biome === 'dungeon'
          ? [[9, 6], [-9, -6], [7, -8], [-8, 8]]
          : [[9, 6], [-9, -6], [7, -8], [-8, 8]]
        ).map(([ox, oz], i) => (
          <pointLight
            key={i}
            color={biome === 'dungeon' ? 0xff7a2a : 0x46b2e6}
            intensity={biome === 'dungeon' ? 9 : 7}
            distance={biome === 'dungeon' ? 13 : 15}
            decay={2}
            position={[cx + ox * accentSpread, 2.6, cz + oz * accentSpread]}
          />
        ))}
    </>
  );
};

/**
 * Procedural gradient sky dome.
 *
 * The horizon band is NOT a per-biome colour any more — it is the scene's fog
 * colour, passed in. It was a duplicated hex, and the duplicate had drifted:
 * the forest preset still said `#8fa07a` (khaki) while `BIOME_LIGHTING.forest`
 * had moved to `0x9db8b0` (sage). Two different colours meeting along the
 * dome's equator draw a dead-straight line across the entire frame at every
 * camera azimuth — measured at 11.3 luma on the same scanline from all eight
 * orbit angles. That line is half of the "cliff down to nothingness".
 *
 * The radius comes from the apron's reach for the same reason: a dome smaller
 * than the ground it covers has the ground poking out of it.
 */
const SkyDome: React.FC<{
  biome: string;
  mapCenter: readonly [number, number, number];
  fogColor: number;
  radius: number;
}> = ({ biome, mapCenter, fogColor, radius }) => {
  const skyMaterial = useMemo(() => {
    // Only the ZENITH is a biome choice; the horizon is the fog it meets.
    const skyTops: Record<string, string> = {
      forest:  '#5a86c0',
      cave:    '#0a0a18',
      dungeon: '#241a2c',
      desert:  '#6a8ac0',
      swamp:   '#2a3a2a',
    };
    const horizon = new THREE.Color(fogColor);
    // Below the horizon the dome is only ever seen through fogged ground, so
    // it is the fog colour taken down a stop rather than a fourth palette.
    const bottom = horizon.clone().multiplyScalar(0.62);

    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor:     { value: new THREE.Color(skyTops[biome] ?? skyTops.forest) },
        uHorizonColor: { value: horizon },
        uBottomColor:  { value: bottom },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          // Key the gradient to the dome's own latitude (object space) so it
          // stays correct no matter where the dome is centered or how large it
          // is — lets us recenter on the map and enlarge it freely.
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 color;
          if (h > 0.0) {
            color = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.5, h));
          } else {
            color = mix(uHorizonColor, uBottomColor, smoothstep(0.0, -0.3, h));
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, [biome, fogColor]);

  React.useEffect(() => () => skyMaterial.dispose(), [skyMaterial]);

  return (
    <mesh
      material={skyMaterial}
      renderOrder={-1}
      position={[mapCenter[0], 0, mapCenter[2]]}
    >
      <sphereGeometry args={[radius, 48, 24]} />
    </mesh>
  );
};

/**
 * Postprocessing stack — N8AO + Bloom + tone mapping + Vignette.
 *
 * SSAO history: the postprocessing SSAOEffect needed enableNormalPass, and
 * under WebGL2 with three r170 + @react-three/postprocessing 3.x that
 * combination fired `GL_INVALID_OPERATION: Read and write depth stencil
 * attachments cannot be the same image` on every frame (gap #1). N8AO
 * reconstructs normals from depth in its own pass, so it needs no
 * NormalPass and sidesteps the bug entirely.
 *
 * Tone mapping MUST live in this stack: while mounted, EffectComposer sets
 * `gl.toneMapping = NoToneMapping`, silently disabling the ACESFilmic
 * setting on the Canvas — that un-tone-mapped output was the "raw 3D, not
 * composited" look (GOAL #60). The ToneMapping effect restores ACES at the
 * end of the chain.
 */
const PostProcessingStack: React.FC<{ biome: string }> = ({ biome }) => {
  const dark = biome === 'cave' || biome === 'dungeon';
  return (
    <EffectComposer>
      {/* Half-res + performance mode keeps the 60fps gate; radius/falloff are
          world units tuned to ~1-tile creases (rocks, tree roots, wall bases). */}
      <N8AO
        halfRes
        quality="performance"
        aoRadius={1.8}
        distanceFalloff={3.5}
        intensity={dark ? 2.2 : 3.2}
      />
      {/* Threshold lowered from 0.8 so additive daylight motes and bright
          highlights actually cross it (GOAL #57 residual); mipmapBlur gives
          the soft wide halo instead of a tight ring. Dark biomes get a lower
          threshold + more intensity so torch/crystal pools glow. */}
      <Bloom
        mipmapBlur
        luminanceThreshold={dark ? 0.45 : 0.62}
        luminanceSmoothing={0.25}
        intensity={dark ? 0.9 : 0.65}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette
        offset={0.3}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BattleMap3D: React.FC<BattleMap3DProps> = ({ mapData, characters, spellMapArtifacts, combatState }) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn } = combatState;

  // Use the SAME hooks as the 2D BattleMap — shared game logic
  const battleMapState = useBattleMap(mapData, characters, turnManager, abilitySystem);

  const {
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    handleTileClick,
    handleCharacterClick,
  } = battleMapState;

  const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
  const selectedCharacter = characters.find(c => c.id === selectedCharacterId) ?? null;

  // WebGPU opt-in held in STATE (not read per-render) so the error panel's
  // "Use WebGL instead" button can remount the WebGL scene in place. The
  // callback also strips gpu=1 from the URL so a reload stays on WebGL.
  const [gpuMode, setGpuMode] = React.useState<boolean>(isWebGpuBattleMapEnabled);
  const handleUseWebGL = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('gpu');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch { /* URL manipulation is cosmetic; the remount below is the real switch */ }
    setGpuMode(false);
  }, []);
  // The viewer policy is shared with the 2D map so the same spell-lit battlefield
  // does not reveal different tiles purely because the player changed render mode.
  const visibilityObserverSelection = selectVisibilityObserver({
    selectedCharacterId,
    currentCharacterId: turnState.currentCharacterId,
    characters
  });
  const visibilityObserverId = visibilityObserverSelection.observerId;
  // 3D uses the same visibility calculation as the 2D map. This bridge keeps
  // the rule source shared while letting the VFX layer decide how dark, dim,
  // bright, and hidden tiles should look in world space.
  const visibilityState = useMemo(() => ({
    isActive: true,
    characters,
    turnState,
    selectedCharacterId,
    selectedAbilityId: null,
    actionMode,
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: turnManager.reactiveTriggers || [],
    activeLightSources: (turnManager.activeLightSources || []) as LightSource[],
    mapData: mapData ?? undefined
  } as unknown as CombatState), [actionMode, characters, mapData, selectedCharacterId, turnManager.activeLightSources, turnManager.reactiveTriggers, turnState]);
  const visibility = useVisibility({
    combatState: visibilityState,
    activeCharacterId: visibilityObserverId
  });
  const assignedTeleportDestinations = useMemo(() => {
    const assignment = abilitySystem.pendingTeleportAssignment;
    if (!assignment) return [];

    return Object.entries(assignment.destinationsByTargetId).map(([targetId, destination]) => {
      const target = characters.find(character => character.id === targetId);
      return {
        targetId,
        targetName: target?.name ?? targetId,
        destination,
        abilityName: assignment.ability.name
      };
    });
  }, [abilitySystem.pendingTeleportAssignment, characters]);

  // Live AoE preview when hovering tiles while targeting — same flow the 2D
  // map drives from BattleMapTile onMouseEnter. Without this, previewAoE was
  // never called in 3D, so the AoE template never appeared while aiming an
  // area ability (GOAL #15).
  const handleTileHover = useCallback((tile: BattleMapTile) => {
    if (!abilitySystem?.previewAoE || !abilitySystem.targetingMode || !mapData) return;
    const caster = characters.find(c => c.id === turnState.currentCharacterId);
    if (caster) {
      abilitySystem.previewAoE(tile.coordinates, caster);
    }
  }, [abilitySystem, characters, mapData, turnState.currentCharacterId]);

  // Target selection — same as 2D BattleMap
  const { aoeSet, validTargetSet, teleportDestinationSet } = useTargetSelection({
    selectedAbility: abilitySystem.selectedAbility,
    targetingMode: abilitySystem.targetingMode,
    isValidTarget: abilitySystem.isValidTarget,
    aoePreview: abilitySystem.aoePreview,
    teleportDestinationPreview: abilitySystem.teleportDestinationPreview,
    currentCharacter,
    mapData,
    characters,
  });

  // Dev-only: expose targeting-set sizes so the headless capture rig can
  // distinguish "decals broken" from "set legitimately empty" (gap #29 proof).
  useEffect(() => {
    if (typeof window === 'undefined' || !canUseDevTools()) return;
    (window as unknown as { __bm3dTargetSets?: unknown }).__bm3dTargetSets = {
      mode: abilitySystem.targetingMode,
      valid: validTargetSet.size,
      validKeys: [...validTargetSet].slice(0, 20),
      teleport: teleportDestinationSet.size,
      aoe: aoeSet.size,
      aoeKeys: [...aoeSet].slice(0, 20),
    };
  }, [abilitySystem.targetingMode, validTargetSet, teleportDestinationSet, aoeSet]);

  // Camera target — center of the map, or active character
  const cameraTarget = useMemo(() => {
    if (!mapData) return [0, 0, 0] as const;
    const cx = (mapData.dimensions.width / 2) * TILE_WORLD_SIZE;
    const cz = (mapData.dimensions.height / 2) * TILE_WORLD_SIZE;
    return [cx, 0, cz] as const;
  }, [mapData]);

  /* The voxel arena. Built in a worker on map change; until it lands, the
   * heightfield IS the drawn ground and everything reads that. See
   * VolumeArenaGround. */
  const [arenaSurface, setArenaSurface] = React.useState<ArenaSurface | null>(null);
  React.useEffect(() => {
    setArenaSurface(null);
    firedImpactsRef.current.clear();
  }, [mapData]);

  /* ------------------------------------------------------ CARVING IN COMBAT */

  /* Animations are a list, not a stream: it is re-rendered while an effect is
   * on screen and the same crater would be dug on every frame of it. */
  const firedImpactsRef = React.useRef<Set<string>>(new Set());
  const animations = turnManager.animations as Animation[] | undefined;

  React.useEffect(() => {
    if (!arenaSurface || !animations) return;
    for (const anim of animations) {
      if (anim.type !== 'spell_effect') continue;
      if (firedImpactsRef.current.has(anim.id)) continue;
      const impact = (anim.data as SpellEffectAnimationData | undefined)?.groundImpact;
      const at = anim.endPosition;
      if (!impact || !at) continue;
      firedImpactsRef.current.add(anim.id);
      /* Tile centres. A blast is aimed at a SQUARE and the square's middle is
       * where the charge sat; digging at the corner puts the crater a metre
       * off, which reads as the spell having missed. */
      arenaSurface.carve(at.x + 0.5, at.y + 0.5, impact.radiusM, impact.depthM);
    }
  }, [animations, arenaSurface]);

  // Heightfield surface — the same formula the terrain mesh is built from.
  const heightfieldSampler = useMemo(() => {
    if (!mapData) return null;
    const { width, height } = mapData.dimensions;
    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    return makeTerrainHeightSampler(grid, width, height, mapData.seed ?? 42);
  }, [mapData]);

  /* THE DRAWN GROUND, and the only height anything in this scene should use.
   *
   * Actors, tokens, decals, the grid, grass, scatter and props all sit ON the
   * ground, and the ground is whichever of the two surfaces the camera can see:
   * the volume inside the arena, the heightfield across the rim ramp and out
   * into the fringe. That is not a fallback between two candidates — it is the
   * literal definition of the visible surface, which is the higher of the two,
   * and the volume sampler reports -Infinity exactly where it draws nothing.
   */
  const groundSampler = useMemo(() => {
    if (!heightfieldSampler) return null;
    if (!arenaSurface) return heightfieldSampler;
    const vol = arenaSurface.sampleY;
    return (tileX: number, tileZ: number): number => {
      const v = vol(tileX, tileZ);
      const h = heightfieldSampler(tileX, tileZ);
      return Number.isFinite(v) && v > h ? v : h;
    };
  }, [heightfieldSampler, arenaSurface]);

  // Keep scene-wide helpers centered on the map's horizontal midpoint, but
  // calculate a separate terrain-aware camera spawn. Raising the entire scene
  // center would float the apron, sky, and distant terrain; only the camera
  // needs to follow the local WorldForge surface.
  const initialCameraPosition = useMemo(() => {
    const [centerX, , centerZ] = cameraTarget;
    const spawnX = centerX + 8;
    const spawnZ = centerZ + 8;
    const anchorY = groundSampler?.(centerX, centerZ) ?? 0;
    const spawnGroundY = groundSampler?.(spawnX, spawnZ) ?? anchorY;

    // The camera clears both the point it is looking at and the point it is
    // standing over. This prevents a steep nearby ridge from swallowing the
    // first frame even when the map center itself is comparatively low.
    return [spawnX, Math.max(anchorY, spawnGroundY) + 10, spawnZ] as const;
  }, [cameraTarget, groundSampler]);

  // Detect biome from mapData. The generator stores it on `theme`; older callers
  // may pass `biome`. Reading the wrong field silently fell back to 'forest', so
  // every biome rendered with forest lighting/fog/sky/apron — fixed here.
  const biome = useMemo(() => {
    if (!mapData) return 'forest';
    const m = mapData as BattleMapData & { biome?: string };
    return m.biome ?? m.theme ?? 'forest';
  }, [mapData]);
  const spellArtifactMarkers = useMemo(
    () => buildSpellMapArtifactMarkers(spellMapArtifacts, characters),
    [characters, spellMapArtifacts]
  );
  // The renderer consumes the same opening context as 2D. This selection is
  // also reflected into hidden capture metadata so the visual harness can fail
  // before taking a flattering but semantically incomplete canvas image.
  const openingSceneFacts3D = useMemo(
    () => (mapData ? selectOpeningThreatScene3DFacts(mapData) : null),
    [mapData]
  );

  // Half the map diagonal in world units — the single scale everything
  // map-size-coupled derives from (shadow frustum, apron, fog, camera far).
  // Hard-tuned constants from the 40×30 era (half-diag 25) silently broke when
  // the battlefield quadrupled to 80×60 (half-diag 50).
  const mapHalfDiag = useMemo(() => {
    const w = mapData?.dimensions.width ?? 40;
    const h = mapData?.dimensions.height ?? 30;
    return (Math.hypot(w, h) / 2) * TILE_WORLD_SIZE;
  }, [mapData]);
  /* The scene's distance budget: how far the ground goes, how far you can see
   * through the air, how big the sky is, and where the far plane sits. These
   * four have to be ORDERED, and they were four unrelated constants in four
   * places — with fog saturating at 125 world units and the sky dome only 140
   * across on a board whose camera orbits out to 120. Resolved together, from
   * the map, in `apronField`. */
  const horizon = useMemo(
    () => resolveHorizon(mapData ?? { dimensions: { width: 40, height: 30 } }),
    [mapData],
  );

  if (!mapData) {
    return <div className="text-gray-400">Generating 3D battlefield...</div>;
  }

  // Opt-in WebGPU render path (?gpu=1). WebGL is the default and is NOT changed
  // by this slice. Game logic above (shared hooks) is fully reused; only the
  // render layer swaps. FAIL-FAST: with gpu=1 and no real WebGPU adapter the GPU
  // scene shows an error panel (never a silent WebGL2 fallback); its
  // "Use WebGL instead" button is the one explicit USER action that remounts
  // this WebGL scene. See BattleMap3DGpuScene for the documented parity gaps.
  if (gpuMode) {
    return (
      <React.Suspense fallback={<div className="text-gray-400">Loading WebGPU battlefield…</div>}>
        <BattleMap3DGpuScene
          mapData={mapData}
          characters={characters}
          activeCharacter={currentCharacter ?? null}
          selectedCharacter={selectedCharacter}
          validMoves={validMoves}
          activePath={activePath}
          actionMode={actionMode}
          aoeSet={aoeSet}
          onCameraSelectCharacter={handleCharacterClick ? (id) => {
            const char = characters.find(c => c.id === id);
            if (char) handleCharacterClick(char);
          } : undefined}
          onUseWebGL={handleUseWebGL}
        />
      </React.Suspense>
    );
  }

  // The combat view supplies the available windowpane size; this wrapper fills
  // that box so the Three.js canvas resizes with the encounter instead of
  // collapsing into a short, content-sized strip. Some teaching surfaces pair
  // it with a much taller sidebar, however, and CSS grid stretch can then make
  // `h-full` several pages high. Cap only that pathological stretch at one
  // viewport: normal combat panes remain unchanged, while the initial camera
  // target cannot land thousands of pixels below the visible screen.
  return (
    <div
      className="relative h-full min-h-[320px] w-full overflow-hidden rounded-lg bg-slate-950"
      style={{ flex: '1 1 0%', maxHeight: '100dvh' }}
    >
      {openingSceneFacts3D && (
        <span
          hidden
          aria-hidden="true"
          data-testid="opening-threat-scene-3d-facts"
          data-scene-continuity={openingSceneFacts3D.context.sceneContinuity ?? 'authored'}
          data-body-count={openingSceneFacts3D.resolvedBodies.length}
          data-terrain-imprint-count={openingSceneFacts3D.context.terrainImprints?.length ?? 0}
          data-trace-count={openingSceneFacts3D.context.ecologicalTraces.length}
          data-site-condition={openingSceneFacts3D.siteCondition}
          data-has-disturbance={Boolean(openingSceneFacts3D.context.sceneResolution?.combatDisturbance)}
          data-focus-x={openingSceneFacts3D.focus.x.toFixed(3)}
          data-focus-ground-y={(groundSampler?.(
            openingSceneFacts3D.focus.x + 0.5,
            openingSceneFacts3D.focus.y + 0.5
          ) ?? 0).toFixed(3)}
          data-focus-z={openingSceneFacts3D.focus.y.toFixed(3)}
        />
      )}
      {visibilityObserverSelection.sharedSenses && (
        <div
          className="pointer-events-none absolute left-3 top-3 rounded-full border border-cyan-300/80 bg-slate-950/88 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.38)]"
          style={{ zIndex: Z_INDEX.COMBAT_OVERLAY }}
        >
          {/* This 3D overlay mirrors the 2D map label so render-mode switching
              does not hide the fact that visibility is currently being measured
              from the familiar instead of the caster. */}
          Viewing through {visibilityObserverSelection.sharedSenses.observerName}
        </div>
      )}
      {abilitySystem.targetingMode && abilitySystem.targetValidationReason && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-3 top-12 z-[var(--z-index-submap-overlay)] max-w-[18rem] rounded border border-rose-300/70 bg-slate-950/90 px-3 py-2 text-xs font-semibold leading-snug text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.28)]"
        >
          {abilitySystem.targetValidationReason}
        </div>
      )}
      <Canvas
        className="h-full w-full"
        shadows
        camera={{
          fov: 50,
          // Near and far come as a PAIR from the horizon setup: the far plane
          // has to contain the sky dome, and depth precision is the ratio of
          // the two, so pushing the horizon out without lifting the near plane
          // off 0.1 would buy the distance and pay for it in z-fighting on the
          // board. Orbit controls clamp the camera 5 units from its target.
          near: horizon.cameraNear,
          far: horizon.cameraFar,
          position: initialCameraPosition,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <PerfProbe id="battlemap" label="Battle Map" />
        {/* Sky dome. Its horizon band is the fog colour and its radius contains
            the apron, so ground → haze → sky is one continuous value. */}
        <SkyDome
          biome={biome}
          mapCenter={cameraTarget}
          fogColor={BIOME_LIGHTING[biome]?.fogColor ?? 0x9db8b0}
          radius={horizon.skyRadius}
        />

        {/* THE GROUND, CONTINUED. One mesh from the edge of the heightfield's
            fringe to the horizon, built from the same height function the
            fringe is, with ring spacing that grows from about a tile to about a
            hundred. It replaces two things: a decorative ridge band that
            floated on the scene, and a flat fog-coloured quad whose far edge
            drew the straight line against the sky that Remy circled
            (2026-08-10, "shouldn't have a 'cliff down to nothingness'"). */}
        <TerrainApron mapData={mapData} />

        {/* Fog. The COLOUR is the biome's, from the lighting preset. The
            DISTANCES come from the apron profile, because fog far and apron
            reach are one decision: fog is how far you can see and the apron is
            what there is to see. The old pair saturated at 125 world units on a
            board the camera orbits 120 units away from, which is why the
            overview read as a sheet of haze. */}
        <fog
          attach="fog"
          args={[
            BIOME_LIGHTING[biome]?.fogColor ?? 0x9db8b0,
            horizon.fogNear,
            horizon.fogFar,
          ]}
        />

        {/* Lighting rig */}
        <SceneLighting biome={biome} mapCenter={cameraTarget} shadowHalf={mapHalfDiag + 8} />

        {/* Camera controller — BG3-style orbit with snap-to-character and cinematic cam.
            Its zoom ceiling comes from the same horizon contract as fog, so a
            legal overview can never move its camera target beyond fogFar. */}
        <CameraController
          mapCenter={cameraTarget}
          groundYAt={groundSampler ?? undefined}
          activeCharacter={currentCharacter ?? null}
          selectedCharacter={selectedCharacter}
          characters={characters}
          cinematicEnabled={true}
          maxDistance={horizon.cameraMaxDistance}
          onCameraSelectCharacter={handleCharacterClick ? (id) => {
            const char = characters.find(c => c.id === id);
            if (char) handleCharacterClick(char);
          } : undefined}
        />

        {/* Terrain system — continuous heightfield mesh with vegetation and water */}
        <TerrainMesh
          mapData={mapData}
          validMoves={validMoves}
          activePath={activePath}
          actionMode={actionMode}
          onTileClick={handleTileClick}
          // Gated on targetingMode: an attached onPointerMove makes R3F
          // raycast the whole heightfield per mouse move — only pay that
          // while the player is actually aiming.
          onTileHover={abilitySystem.targetingMode ? handleTileHover : undefined}
          // The volume ground covers the playable rect; the heightfield keeps
          // its border band across the rim ramp and its fringe run-out. The
          // hole only opens once the volume is on screen.
          interiorHoleInsetTiles={ARENA_HEIGHTFIELD_INSET_TILES}
          interiorHoleActive={arenaSurface !== null}
        />
        {/* The arena as matter — voxels, surface nets, the substance material.
            Ground with an inside, and the surface every other layer stands on. */}
        <VolumeArenaGround
          mapData={mapData}
          onSurface={setArenaSurface}
          onTileClick={handleTileClick}
          onTileHover={abilitySystem.targetingMode ? handleTileHover : undefined}
        />
        <GridOverlay
          mapData={mapData}
          validMoves={validMoves}
          activePath={activePath}
          actionMode={actionMode}
          surfaceY={groundSampler ?? undefined}
        />
        {/* Ability-targeting tile decals (gap #29): the 3D scene previously
            gave ZERO visual response to targeting mode — the sets existed
            but only fed character isTargetable flags. 2D color parity. */}
        <TargetingDecals
          validTargetSet={validTargetSet}
          teleportDestinationSet={teleportDestinationSet}
          aoeSet={aoeSet}
          targetingMode={abilitySystem.targetingMode}
          groundSampler={groundSampler}
        />
        <GrassLayer mapData={mapData} surfaceY={groundSampler ?? undefined} />
        {/* Water is a QUANTITY now: a conservative shallow-water field over the
            bed the voxels derive, with a boundary source and an exact ledger.
            It cannot exist before the volume it rests on, and nothing else
            draws water in the meantime — a plane pinned to tile elevation for
            one second and then replaced is a flicker, not a stand-in. */}
        {arenaSurface && (
          <VolumeArenaWater
            mapData={mapData}
            handle={arenaSurface.handle}
            columnTopY={arenaSurface.columnTopY}
            lastCarve={arenaSurface.carveWindow}
          />
        )}
        <FordStones mapData={mapData} />
        <DecorationProps mapData={mapData} surfaceY={groundSampler ?? undefined} />
        <EzTreeLayer mapData={mapData} surfaceY={groundSampler ?? undefined} />
        <GroundScatter mapData={mapData} surfaceY={groundSampler ?? undefined} />

        {/* Saved opening ecology and aftermath. This layer owns only static
            world facts; live combatants remain CharacterActor instances. */}
        <OpeningThreatScene3D mapData={mapData} groundSampler={groundSampler} />

        {/* Low-hanging animated mist — biome-gated (swamp thick, forest faint,
            cave/dungeon subtle, desert none). Flat depth-tested layers pool in
            hollows while hills and props rise clear of them (GOAL #56). */}
        <GroundMist mapData={mapData} />

        {/* Contact shadows — soft ground darkening under objects (replaces broken SSAO) */}
        <ContactShadows
          position={[cameraTarget[0], 0.01, cameraTarget[2]]}
          opacity={0.4}
          scale={mapData.dimensions.width + 2}
          blur={2}
          far={4}
          resolution={512}
          color="#1a1a0a"
        />

        {/* Characters — CharacterActor with animation state machine and BG3-style selection */}
        {characters.map(character => {
          const charTileId = `${character.position.x}-${character.position.y}`;
          const isTargetable = validTargetSet.has(charTileId);
          const charTile = mapData.tiles.get(charTileId);

          return (
            <CharacterActor
              key={character.id}
              character={character}
              allCharacters={characters}
              tileElevation={charTile?.elevation ?? 0}
              groundY={groundSampler
                ? groundSampler(character.position.x + 0.5, character.position.y + 0.5)
                : undefined}
              isSelected={selectedCharacterId === character.id}
              isTurn={turnState.currentCharacterId === character.id}
              isTargetable={isTargetable}
              targetingMode={abilitySystem.targetingMode}
              onClick={handleCharacterClick}
              activeCharacterId={turnState.currentCharacterId}
            />
          );
        })}

        {/* VFX — spell zones, weapon trails, damage numbers, AoE preview */}
        {/* Non-creature spell artifacts are not actors, but they still need a
            spatial handle in 3D for helpers, animated servants/objects,
            guardians, entrances, and caster-centered emanations. */}
        {spellArtifactMarkers.map((marker, index) => (
          <SpellArtifact3DMarker
            key={marker.id}
            marker={marker}
            offsetIndex={index}
            groundY={groundSampler
              ? groundSampler(marker.position.x + 0.5, marker.position.y + 0.5)
              : 0}
          />
        ))}

        {(mapData.targetableObjects ?? []).map(targetObject => {
          const targetTileId = `${targetObject.position.x}-${targetObject.position.y}`;

          // Handles are aiming UI, not scenery. Only objects the current
          // ability can actually target get a marker — an idle map shows the
          // object itself (tree, boulder), never a handle cube.
          if (!validTargetSet.has(targetTileId)) return null;

          return (
            <TargetableObject3DMarker
              key={`targetable-object-3d-${targetObject.id}`}
              targetObject={targetObject}
              isTargetable={validTargetSet.has(targetTileId)}
              groundY={groundSampler
                ? groundSampler(targetObject.position.x + 0.5, targetObject.position.y + 0.5)
                : 0}
            />
          );
        })}

        <VFXSystem
          mapData={mapData}
          characters={characters}
          spellZones={combatState.turnManager.spellZones || []}
          scheduledSpellEffects={combatState.turnManager.scheduledSpellEffects || []}
          movementDebuffs={combatState.turnManager.movementDebuffs || []}
          activeLightSources={(combatState.turnManager.activeLightSources || []) as LightSource[]}
          lightLevels={visibility.lightLevels}
          visibleTiles={visibility.visibleTiles}
          // Share the same floating combat feedback used by the 2D map so
          // damage, healing, and miss outcomes remain visible in 3D mode.
          damageNumbers={combatState.turnManager.damageNumbers || []}
          spellMovementVisuals={combatState.turnManager.spellMovementVisuals || []}
          spellDeliveryVisuals={combatState.turnManager.spellDeliveryVisuals || []}
          teleportDestinationPreviewTiles={teleportDestinationSet}
          teleportDestinationPreviewTarget={abilitySystem.teleportDestinationPreview
            ? characters.find(character => character.id === abilitySystem.teleportDestinationPreview?.targetId)
            : undefined}
          teleportDestinationPreviewAbilityName={abilitySystem.teleportDestinationPreview?.ability.name}
          assignedTeleportDestinations={assignedTeleportDestinations}
          targetingMode={abilitySystem.targetingMode}
        />

        {/* Living world — ambient particles, fireflies, weather */}
        <LivingWorld mapData={mapData} />

        {/* Postprocessing */}
        <PostProcessingStack biome={biome} />
      </Canvas>
    </div>
  );
};

export default BattleMap3D;
