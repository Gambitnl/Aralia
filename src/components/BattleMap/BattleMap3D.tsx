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
import React, { useMemo, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, Html, Environment } from '@react-three/drei';
import { EffectComposer, SSAO, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BattleMapData, CombatCharacter, BattleMapTile as BattleMapTileData } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import type { useTurnManager } from '../../hooks/combat/useTurnManager';
import type { useAbilitySystem } from '../../hooks/useAbilitySystem';

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
const ELEVATION_SCALE = 0.25;

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
    sunColor: 0xffd080, sunIntensity: 1.6,
    ambientColor: 0x304020, ambientIntensity: 0.4,
    hemisphereTop: 0x87ceeb, hemisphereBottom: 0x3a2a1a,
    fogColor: 0x8a9a7a, fogNear: 15, fogFar: 35,
  },
  cave: {
    sunColor: 0x404060, sunIntensity: 0.3,
    ambientColor: 0x101830, ambientIntensity: 0.2,
    hemisphereTop: 0x1a1a3a, hemisphereBottom: 0x0a0a1a,
    fogColor: 0x0a0a1a, fogNear: 6, fogFar: 18,
  },
  dungeon: {
    sunColor: 0xc89050, sunIntensity: 0.6,
    ambientColor: 0x202030, ambientIntensity: 0.3,
    hemisphereTop: 0x404050, hemisphereBottom: 0x1a1510,
    fogColor: 0x1a1520, fogNear: 10, fogFar: 25,
  },
  desert: {
    sunColor: 0xfff0d0, sunIntensity: 2.2,
    ambientColor: 0x806040, ambientIntensity: 0.5,
    hemisphereTop: 0xe8e0c8, hemisphereBottom: 0xc8a060,
    fogColor: 0xd8c8a0, fogNear: 20, fogFar: 40,
  },
  swamp: {
    sunColor: 0xa0b040, sunIntensity: 0.7,
    ambientColor: 0x203020, ambientIntensity: 0.25,
    hemisphereTop: 0x405030, hemisphereBottom: 0x2a2010,
    fogColor: 0x2a3020, fogNear: 8, fogFar: 20,
  },
};

// ---------------------------------------------------------------------------
// Terrain color mapping (placeholder until splat-map textures in Phase 1)
// ---------------------------------------------------------------------------

const TERRAIN_COLORS: Record<string, number> = {
  grass: 0x3a5a28,
  rock: 0x6a6a6a,
  water: 0x1a4a6a,
  difficult: 0x5a4a20,
  wall: 0x4a4a4a,
  floor: 0x6a6050,
  sand: 0xc8a860,
  mud: 0x4a3a20,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Ground plane built from tile data — placeholder for Phase 1's terrain mesh */
const TerrainPlane: React.FC<{
  mapData: BattleMapData;
  validMoves: Set<string>;
  activePath: { id: string }[];
  actionMode: 'move' | 'ability' | null;
  onTileClick: (tile: BattleMapTileData) => void;
}> = ({ mapData, validMoves, activePath, actionMode, onTileClick }) => {

  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach(p => set.add(p.id));
    return set;
  }, [activePath]);

  const tiles = useMemo(() => Array.from(mapData.tiles.values()), [mapData]);

  return (
    <group>
      {tiles.map(tile => {
        const { x, y } = tile.coordinates;
        const elevation = tile.elevation * ELEVATION_SCALE;
        const isValidMove = actionMode === 'move' && validMoves.has(tile.id);
        const isInPath = activePathSet.has(tile.id);

        // Base terrain color
        let color = TERRAIN_COLORS[tile.terrain] ?? 0x3a5a28;

        // Highlight valid moves and path
        if (isInPath) {
          color = 0x4488ff;
        } else if (isValidMove) {
          color = 0x22aa44;
        }

        return (
          <mesh
            key={tile.id}
            position={[x * TILE_WORLD_SIZE, elevation / 2, y * TILE_WORLD_SIZE]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onTileClick(tile);
            }}
            receiveShadow
          >
            <boxGeometry args={[
              TILE_WORLD_SIZE * 0.98,
              Math.max(elevation, 0.1),
              TILE_WORLD_SIZE * 0.98
            ]} />
            <meshStandardMaterial
              color={color}
              roughness={0.8}
              metalness={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
};

/** Character token rendered as a simple capsule — placeholder for Phase 2's glTF models */
const CharacterMarker: React.FC<{
  character: CombatCharacter;
  isSelected: boolean;
  isTurn: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  onClick: (character: CombatCharacter) => void;
}> = ({ character, isSelected, isTurn, isTargetable, targetingMode, onClick }) => {
  const { x, y } = character.position;
  const isPlayer = character.team === 'player';
  const isAlive = character.currentHP > 0;

  // Base color by team
  let baseColor = isPlayer ? 0x3b82f6 : 0x991b1b;
  if (isSelected) baseColor = 0xfbbf24;
  if (isTargetable && targetingMode) baseColor = 0xef4444;

  // Selection ring color
  const ringColor = isPlayer ? 0x60a5fa : 0xef4444;
  const showRing = isSelected || isTurn;

  return (
    <group position={[x * TILE_WORLD_SIZE, 0.5, y * TILE_WORLD_SIZE]}>
      {/* Character body — capsule placeholder */}
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick(character);
        }}
        castShadow
      >
        <capsuleGeometry args={[0.15, 0.5, 8, 16]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.4}
          metalness={0.2}
          emissive={isTurn ? baseColor : 0x000000}
          emissiveIntensity={isTurn ? 0.3 : 0}
        />
      </mesh>

      {/* Selection / turn ring on ground */}
      {showRing && (
        <mesh
          position={[0, -0.45, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.3, 0.38, 32]} />
          <meshStandardMaterial
            color={isTurn ? 0xfbbf24 : ringColor}
            emissive={isTurn ? 0xfbbf24 : ringColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Nameplate — HTML overlay */}
      <Html
        position={[0, 0.7, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          fontSize: '11px',
          color: '#e6edf3',
          textAlign: 'center',
          borderLeft: `3px solid ${isPlayer ? '#3b82f6' : '#ef4444'}`,
        }}>
          <div style={{ fontWeight: 600 }}>{character.name}</div>
          <div style={{
            width: '60px',
            height: '4px',
            background: '#1a1a2e',
            borderRadius: '2px',
            marginTop: '2px',
          }}>
            <div style={{
              width: `${Math.max(0, (character.currentHP / character.maxHP) * 100)}%`,
              height: '100%',
              background: character.currentHP / character.maxHP > 0.5 ? '#22c55e'
                : character.currentHP / character.maxHP > 0.25 ? '#eab308' : '#ef4444',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </Html>
    </group>
  );
};

/** Lighting rig driven by biome presets */
const SceneLighting: React.FC<{ biome: string }> = ({ biome }) => {
  const preset = BIOME_LIGHTING[biome] ?? BIOME_LIGHTING.forest;
  const directionalRef = useRef<THREE.DirectionalLight>(null);

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
        position={[10, 15, 10]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {/* Rim/fill light from opposite side */}
      <directionalLight
        color={0x8888ff}
        intensity={0.3}
        position={[-8, 4, -6]}
      />
    </>
  );
};

/** Postprocessing stack — SSAO + Bloom + Vignette for BG3 atmosphere */
const PostProcessingStack: React.FC = () => (
  <EffectComposer>
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
    <div style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas
        shadows
        camera={{
          fov: 50,
          near: 0.1,
          far: 100,
          position: [
            cameraTarget[0] + 12,
            14,
            cameraTarget[2] + 12,
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
        <SceneLighting biome={biome} />

        {/* Camera controls — BG3-style orbit */}
        <MapControls
          target={[cameraTarget[0], 0, cameraTarget[2]]}
          minDistance={8}
          maxDistance={25}
          minPolarAngle={Math.PI * 0.15}  // ~27° from horizon (prevent going under)
          maxPolarAngle={Math.PI * 0.42}   // ~75° from horizon (prevent top-down)
          enableDamping
          dampingFactor={0.08}
          screenSpacePanning={false}
        />

        {/* Terrain */}
        <TerrainPlane
          mapData={mapData}
          validMoves={validMoves}
          activePath={activePath}
          actionMode={actionMode}
          onTileClick={handleTileClick}
        />

        {/* Characters */}
        {characters.map(character => {
          const charTileId = `${character.position.x}-${character.position.y}`;
          const isTargetable = validTargetSet.has(charTileId);

          return (
            <CharacterMarker
              key={character.id}
              character={character}
              isSelected={selectedCharacterId === character.id}
              isTurn={turnState.currentCharacterId === character.id}
              isTargetable={isTargetable}
              targetingMode={abilitySystem.targetingMode}
              onClick={handleCharacterClick}
            />
          );
        })}

        {/* Postprocessing */}
        <PostProcessingStack />
      </Canvas>
    </div>
  );
};

export default BattleMap3D;
