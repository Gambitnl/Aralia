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
import React, { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
// MapControls now handled by CameraController
import { ContactShadows } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { BattleMapData, CombatCharacter } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { TerrainMesh, GridOverlay, GrassLayer, WaterSystem, DecorationProps, GroundScatter, EzTreeLayer } from './terrain';
import { CharacterActor } from './characters';
import { CameraController } from './camera';
import { VFXSystem, LivingWorld } from './vfx';

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
}

const BIOME_LIGHTING: Record<string, BiomeLighting> = {
  forest: {
    sunColor: 0xffe0a0, sunIntensity: 2.2,
    ambientColor: 0x203018, ambientIntensity: 0.3,
    hemisphereTop: 0x87ceeb, hemisphereBottom: 0x3a2a1a,
    fogColor: 0x6a7a5a, fogNear: 12, fogFar: 32,
  },
  cave: {
    sunColor: 0x404060, sunIntensity: 0.3,
    ambientColor: 0x101830, ambientIntensity: 0.2,
    hemisphereTop: 0x1a1a3a, hemisphereBottom: 0x0a0a1a,
    fogColor: 0x0a0a1a, fogNear: 6, fogFar: 20,
  },
  dungeon: {
    sunColor: 0xc89050, sunIntensity: 0.6,
    ambientColor: 0x202030, ambientIntensity: 0.3,
    hemisphereTop: 0x404050, hemisphereBottom: 0x1a1510,
    fogColor: 0x1a1520, fogNear: 8, fogFar: 24,
  },
  desert: {
    sunColor: 0xfff0d0, sunIntensity: 2.2,
    ambientColor: 0x806040, ambientIntensity: 0.5,
    hemisphereTop: 0xe8e0c8, hemisphereBottom: 0xc8a060,
    fogColor: 0xd8c8a0, fogNear: 14, fogFar: 35,
  },
  swamp: {
    sunColor: 0xa0b040, sunIntensity: 0.7,
    ambientColor: 0x203020, ambientIntensity: 0.25,
    hemisphereTop: 0x405030, hemisphereBottom: 0x2a2010,
    fogColor: 0x2a3020, fogNear: 8, fogFar: 22,
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
    if (directionalRef.current) {
      directionalRef.current.target.position.set(cx, 0, cz);
      directionalRef.current.target.updateMatrixWorld();
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
        position={[cx + 12, 16, cz + 12]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.001}
      />
      {/* Cool fill light from opposite side for warm/cool contrast */}
      <directionalLight
        color={0x6080c0}
        intensity={0.4}
        position={[cx - 8, 4, cz - 6]}
      />
    </>
  );
};

/** Procedural gradient sky dome — prevents fade-to-void at map edges */
const SkyDome: React.FC<{ biome: string }> = ({ biome }) => {
  const skyMaterial = useMemo(() => {
    // Per-biome sky colors
    const skyPresets: Record<string, { top: string; horizon: string; bottom: string }> = {
      forest:  { top: '#4a7ab5', horizon: '#8ab4d4', bottom: '#5a6a4a' },
      cave:    { top: '#0a0a1a', horizon: '#1a1a3a', bottom: '#0a0a0a' },
      dungeon: { top: '#2a2030', horizon: '#3a3040', bottom: '#1a1510' },
      desert:  { top: '#6a8ac0', horizon: '#d8c8a0', bottom: '#c8a060' },
      swamp:   { top: '#2a3a2a', horizon: '#4a5a3a', bottom: '#2a2a1a' },
    };
    const p = skyPresets[biome] ?? skyPresets.forest;

    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor:     { value: new THREE.Color(p.top) },
        uHorizonColor: { value: new THREE.Color(p.horizon) },
        uBottomColor:  { value: new THREE.Color(p.bottom) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
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
    <mesh material={skyMaterial} renderOrder={-1}>
      <sphereGeometry args={[45, 32, 16]} />
    </mesh>
  );
};

/** Postprocessing stack — SSAO + Bloom + Vignette for BG3 atmosphere */
const PostProcessingStack: React.FC = () => (
  <EffectComposer enableNormalPass>
    <SSAO
      blendFunction={BlendFunction.MULTIPLY}
      samples={30}
      rings={4}
      radius={0.5}
      intensity={1.5}
    />
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

  // Target selection — same as 2D BattleMap
  const { validTargetSet } = useTargetSelection({
    selectedAbility: abilitySystem.selectedAbility,
    targetingMode: abilitySystem.targetingMode,
    isValidTarget: abilitySystem.isValidTarget,
    aoePreview: abilitySystem.aoePreview,
    currentCharacter,
    mapData,
    characters,
  });

  // Camera target — center of the map, or active character
  const cameraTarget = useMemo(() => {
    if (!mapData) return [0, 0, 0] as const;
    const cx = (mapData.dimensions.width / 2) * TILE_WORLD_SIZE;
    const cz = (mapData.dimensions.height / 2) * TILE_WORLD_SIZE;
    return [cx, 0, cz] as const;
  }, [mapData]);

  // Detect biome from mapData
  const biome = useMemo(() => {
    if (!mapData) return 'forest';
    return (mapData as BattleMapData & { biome?: string }).biome ?? 'forest';
  }, [mapData]);

  if (!mapData) {
    return <div className="text-gray-400">Generating 3D battlefield...</div>;
  }

  return (
    <div style={{ width: '100%', flex: '1 1 0%', minHeight: '300px', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas
        shadows
        camera={{
          fov: 50,
          near: 0.1,
          far: 100,
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
        <SkyDome biome={biome} />

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
        />
        <GridOverlay
          mapData={mapData}
          validMoves={validMoves}
          activePath={activePath}
          actionMode={actionMode}
        />
        <GrassLayer mapData={mapData} />
        <WaterSystem mapData={mapData} />
        <DecorationProps mapData={mapData} />
        <EzTreeLayer mapData={mapData} />
        <GroundScatter mapData={mapData} />

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
              isSelected={selectedCharacterId === character.id}
              isTurn={turnState.currentCharacterId === character.id}
              isTargetable={isTargetable}
              targetingMode={abilitySystem.targetingMode}
              onClick={handleCharacterClick}
            />
          );
        })}

        {/* VFX — spell zones, weapon trails, damage numbers, AoE preview */}
        <VFXSystem
          mapData={mapData}
          characters={characters}
          aoePreviewTiles={abilitySystem.aoePreview?.affectedTiles
            ? new Set(abilitySystem.aoePreview.affectedTiles.map(
                (p: { x: number; y: number }) => `${p.x}-${p.y}`
              ))
            : undefined}
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
