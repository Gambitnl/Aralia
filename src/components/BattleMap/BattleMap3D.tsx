// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:57:37
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 11 files
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
import { canUseDevTools } from '../../utils/permissions';
import { Canvas } from '@react-three/fiber';
// MapControls now handled by CameraController
import { ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile, CombatCharacter, CombatState, LightSource } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import { useVisibility } from '../../hooks/combat/useVisibility';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { TerrainMesh, GridOverlay, GrassLayer, WaterSystem, DecorationProps, GroundScatter, EzTreeLayer, DistantTerrain, GroundMist, makeTerrainHeightSampler } from './terrain';
import { CharacterActor } from './characters';
import TargetingDecals from './TargetingDecals';
import { CameraController } from './camera';
import { VFXSystem, LivingWorld } from './vfx';
import { selectVisibilityObserver } from './visibilityObserverPolicy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BattleMap3DProps {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
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
}

const BIOME_LIGHTING: Record<string, BiomeLighting> = {
  forest: {
    sunColor: 0xffe0a0, sunIntensity: 2.2,
    ambientColor: 0x2c3a24, ambientIntensity: 0.45,
    hemisphereTop: 0x87ceeb, hemisphereBottom: 0x3a2a1a,
    // Fog pushed back so the battlefield reads clearly at tactical zoom; fog now
    // only hazes the far map edges instead of swallowing the play area.
    fogColor: 0x8fa07a, fogNear: 22, fogFar: 60,
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
  },
  swamp: {
    // Readability nudge (kept murky/green on purpose); fog pushed back a little
    // so the battlefield reads past the immediate foreground.
    sunColor: 0xa0b040, sunIntensity: 0.9,
    ambientColor: 0x2a3a24, ambientIntensity: 0.42,
    hemisphereTop: 0x405030, hemisphereBottom: 0x2a2010,
    fogColor: 0x2a3020, fogNear: 12, fogFar: 34,
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Lighting rig driven by biome presets */
const SceneLighting: React.FC<{ biome: string; mapCenter: readonly [number, number, number] }> = ({ biome, mapCenter }) => {
  const preset = BIOME_LIGHTING[biome] ?? BIOME_LIGHTING.forest;
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const cx = mapCenter?.[0] ?? 0;
  const cz = mapCenter?.[2] ?? 0;

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
          cx + (preset.sunPos?.[0] ?? 12),
          preset.sunPos?.[1] ?? 16,
          cz + (preset.sunPos?.[2] ?? 12),
        ]}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      {/* Cool fill light from opposite side for warm/cool contrast */}
      <directionalLight
        color={0x6080c0}
        intensity={0.4}
        position={[cx - 8, 4, cz - 6]}
      />

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
            position={[cx + ox, 2.6, cz + oz]}
          />
        ))}
    </>
  );
};

/** Procedural gradient sky dome — prevents fade-to-void at map edges. Centered
 *  on the map and enlarged so the distant-terrain ridge band sits inside it. */
const SkyDome: React.FC<{ biome: string; mapCenter: readonly [number, number, number] }> = ({ biome, mapCenter }) => {
  const skyMaterial = useMemo(() => {
    // Per-biome sky colors
    const skyPresets: Record<string, { top: string; horizon: string; bottom: string }> = {
      // horizon matches forest fogColor (0x8fa07a) so the fogged ground apron
      // blends into the sky at the horizon instead of showing a hard seam.
      forest:  { top: '#5a86c0', horizon: '#8fa07a', bottom: '#5a6a4a' },
      // horizon = each biome's fogColor so the fogged ground apron blends into
      // the sky at the horizon (no hard seam). top stays biome-appropriate.
      cave:    { top: '#0a0a18', horizon: '#0a0a1a', bottom: '#060608' },
      dungeon: { top: '#241a2c', horizon: '#1a1520', bottom: '#120d10' },
      desert:  { top: '#6a8ac0', horizon: '#d8c8a0', bottom: '#c8a060' },
      swamp:   { top: '#2a3a2a', horizon: '#2a3020', bottom: '#1a1f14' },
    };
    const p = skyPresets[biome] ?? skyPresets.forest;

    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor:     { value: new THREE.Color(p.top) },
        uHorizonColor: { value: new THREE.Color(p.horizon) },
        uBottomColor:  { value: new THREE.Color(p.bottom) },
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
  }, [biome]);

  return (
    <mesh
      material={skyMaterial}
      renderOrder={-1}
      position={[mapCenter[0], 0, mapCenter[2]]}
    >
      <sphereGeometry args={[140, 48, 24]} />
    </mesh>
  );
};

/**
 * Postprocessing stack — Bloom + Vignette for BG3 atmosphere.
 *
 * SSAO + enableNormalPass were removed: under WebGL2 with three r170 +
 * @react-three/postprocessing 3.x, that combination caused glBlitFramebuffer
 * to fire `GL_INVALID_OPERATION: Read and write depth stencil attachments
 * cannot be the same image` on every rendered frame, eventually exhausting
 * the WebGL context. ContactShadows (mounted in the main scene) provides
 * the soft ground darkening SSAO used to give.
 */
const PostProcessingStack: React.FC = () => (
  <EffectComposer>
    <Bloom
      luminanceThreshold={0.8}
      luminanceSmoothing={0.3}
      intensity={0.4}
    />
    <Vignette
      offset={0.3}
      darkness={0.6}
      blendFunction={BlendFunction.NORMAL}
    />
  </EffectComposer>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BattleMap3D: React.FC<BattleMap3DProps> = ({ mapData, characters, combatState }) => {
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

  // Ground-height sampler — the same surface formula the terrain mesh is built
  // from, so actors stand exactly on the rendered ground (GOAL #10 / gap #27:
  // raw tile elevation hovers over banks carved by water basins).
  const groundSampler = useMemo(() => {
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

  // Detect biome from mapData. The generator stores it on `theme`; older callers
  // may pass `biome`. Reading the wrong field silently fell back to 'forest', so
  // every biome rendered with forest lighting/fog/sky/apron — fixed here.
  const biome = useMemo(() => {
    if (!mapData) return 'forest';
    const m = mapData as BattleMapData & { biome?: string };
    return m.biome ?? m.theme ?? 'forest';
  }, [mapData]);

  if (!mapData) {
    return <div className="text-gray-400">Generating 3D battlefield...</div>;
  }

  // The combat view supplies the available windowpane size; this wrapper fills
  // that box so the Three.js canvas resizes with the encounter instead of
  // collapsing into a short, content-sized strip.
  return (
    <div
      className="relative h-full min-h-[320px] w-full overflow-hidden rounded-lg bg-slate-950"
      style={{ flex: '1 1 0%' }}
    >
      {visibilityObserverSelection.sharedSenses && (
        <div className="pointer-events-none absolute left-3 top-3 z-[var(--z-index-submap-overlay)] rounded-full border border-cyan-300/80 bg-slate-950/88 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.38)]">
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
          near: 0.1,
          // Far plane pushed out so the enlarged sky dome and the distant-terrain
          // ridge band (out to ~radius 92 around the map center) are not clipped.
          far: 220,
          position: [
            cameraTarget[0] + 8,
            10,
            cameraTarget[2] + 8,
          ],
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
        {/* Sky dome — gradient background prevents fade-to-void */}
        <SkyDome biome={biome} mapCenter={cameraTarget} />

        {/* Distant terrain — procedural ridge band ringing the battlefield so the
            map reads as part of a larger landscape (rolling hills/mesas on open
            biomes, dark cavern walls on cave/dungeon) instead of a flat slab in
            fog. Sits on the apron and dissolves into the scene fog. */}
        <DistantTerrain mapData={mapData} />

        {/* Ground apron — a large biome-colored plane at sea level beyond the map
            edges. On open biomes (desert/cave/dungeon) the terrain plane otherwise
            ends in a hard cliff over the sky void; this extends the ground outward
            so it fades into fog. Sits below micro-noise terrain dips to avoid
            z-fighting inside the playable area. Color matches the biome fog so the
            apron→horizon transition is seamless. */}
        <mesh
          position={[cameraTarget[0], -0.15, cameraTarget[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={-1}
        >
          <planeGeometry args={[260, 260]} />
          <meshStandardMaterial
            color={BIOME_LIGHTING[biome]?.fogColor ?? 0x8fa07a}
            roughness={1}
            metalness={0}
          />
        </mesh>

        {/* Fog */}
        <fog
          attach="fog"
          args={[
            BIOME_LIGHTING[biome]?.fogColor ?? 0x8a9a7a,
            BIOME_LIGHTING[biome]?.fogNear ?? 15,
            BIOME_LIGHTING[biome]?.fogFar ?? 35,
          ]}
        />

        {/* Lighting rig */}
        <SceneLighting biome={biome} mapCenter={cameraTarget} />

        {/* Camera controller — BG3-style orbit with snap-to-character and cinematic cam */}
        <CameraController
          mapCenter={cameraTarget}
          activeCharacter={currentCharacter ?? null}
          selectedCharacter={selectedCharacter}
          characters={characters}
          cinematicEnabled={true}
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
        />
        <GridOverlay
          mapData={mapData}
          validMoves={validMoves}
          activePath={activePath}
          actionMode={actionMode}
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
        <GrassLayer mapData={mapData} />
        <WaterSystem mapData={mapData} />
        <DecorationProps mapData={mapData} />
        <EzTreeLayer mapData={mapData} />
        <GroundScatter mapData={mapData} />

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
        <PostProcessingStack />
      </Canvas>
    </div>
  );
};

export default BattleMap3D;
