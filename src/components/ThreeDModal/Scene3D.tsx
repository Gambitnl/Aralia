import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Color, Mesh } from 'three';
import { Color as ThreeColor } from 'three';
import { BIOMES } from '../../constants';
import { SeededRandom } from '../../utils/random/seededRandom';
import type { PlayerCharacter } from '../../types';
import { getLightingForTime } from './lighting';
import CameraRig from './CameraRig';
import PlayerController from './PlayerController';
import Terrain from './Terrain';
import PropsLayer, { type TreeStats } from './PropsLayer';
import {
  createHeightSampler,
  createMoistureSampler,
  createSlopeSampler,
  getHeightRangeForBiome,
} from './terrainUtils';
import GridCellOutline from './GridCellOutline';
import EnemyUnit from './EnemyUnit';
import PartyUnit from './PartyUnit';
import SkyDome from './SkyDome';
import WaterPlane from './WaterPlane';
import LabGround from './LabGround';
import LabClouds from './LabClouds';
import LabGrass from './LabGrass';
import LabRocks from './LabRocks';

interface Scene3DProps {
  biomeId: string;
  gameTime: Date;
  playerSpeed: number;
  submapSeed: number;
  submapFootprintFt: number;
  environmentMode?: 'submap' | 'tree-lab';
  showGrid: boolean;
  partyMembers: PlayerCharacter[];
  isCombatMode: boolean;
  onPlayerPosition?: (position: { x: number; y: number; z: number }) => void;
  onPlayerSpeed?: (speedFeetPerRound: number) => void;
  onFps?: (fps: number) => void;
  pauseRender?: boolean;
  treeCountMultiplier?: number;
  rockCountMultiplier?: number;
  heroLineEnabled?: boolean;
  heroLineSpacing?: number;
  heroLineOffset?: { x: number; z: number };
  customTreeOptions?: Record<string, unknown> | null;
  customTreeEnabled?: boolean;
  customTreeOffset?: { x: number; z: number };
  customTreeScale?: number;
  comparisonTreeOptions?: Record<string, unknown> | null;
  comparisonTreeEnabled?: boolean;
  comparisonTreeOffset?: { x: number; z: number };
  comparisonTreeScale?: number;
  onCustomTreeStats?: (stats: TreeStats | null) => void;
  onComparisonTreeStats?: (stats: TreeStats | null) => void;
  lightingOverrides?: {
    sunAzimuth?: number;
    sunElevation?: number;
    sunIntensity?: number;
    ambientIntensity?: number;
    fogDensity?: number;
  };
  cameraFocusTarget?: { x: number; z: number } | null;
  cameraFocusHeightOffset?: number;
  cameraFocusRequestId?: number;
  cameraFocusDistance?: number;
  cameraFocusLock?: boolean;
  labGrassEnabled?: boolean;
  labGrassCount?: number;
  labFlowersEnabled?: boolean;
  labFlowerCount?: number;
  labRocksEnabled?: boolean;
  labRocksPerType?: number;
}

interface FpsTrackerProps {
  onFps?: (fps: number) => void;
  sampleWindow?: number;
}

const FpsTracker = ({ onFps, sampleWindow = 0.5 }: FpsTrackerProps) => {
  const accumulatorRef = useRef({ time: 0, frames: 0 });
  const lastFpsRef = useRef<number | null>(null);

  useFrame((_, delta) => {
    const accumulator = accumulatorRef.current;
    accumulator.time += delta;
    accumulator.frames += 1;

    // Emit FPS updates in a short window instead of every frame so the UI
    // overlay updates smoothly without adding extra render pressure.
    if (accumulator.time >= sampleWindow) {
      const fps = Math.round(accumulator.frames / accumulator.time);
      if (fps !== lastFpsRef.current) {
        lastFpsRef.current = fps;
        onFps?.(fps);
      }
      accumulator.time = 0;
      accumulator.frames = 0;
    }
  });

  return null;
};

const SceneContents = ({
  biomeId,
  gameTime,
  playerSpeed,
  submapSeed,
  submapFootprintFt,
  showGrid,
  partyMembers,
  isCombatMode,
  onPlayerPosition,
  onPlayerSpeed,
  onFps,
  treeCountMultiplier,
  rockCountMultiplier,
  heroLineEnabled,
  heroLineSpacing,
  heroLineOffset,
  customTreeOptions,
  customTreeEnabled,
  customTreeOffset,
  customTreeScale,
  comparisonTreeOptions,
  comparisonTreeEnabled,
  comparisonTreeOffset,
  comparisonTreeScale,
  onCustomTreeStats,
  onComparisonTreeStats,
  lightingOverrides,
  cameraFocusTarget,
  cameraFocusHeightOffset,
  cameraFocusRequestId,
  cameraFocusDistance,
  cameraFocusLock,
  environmentMode = 'submap',
  labGrassEnabled,
  labGrassCount,
  labFlowersEnabled,
  labFlowerCount,
  labRocksEnabled,
  labRocksPerType,
}: Scene3DProps) => {
  const playerRef = useRef<Mesh>(null);
  const partyPositionsRef = useRef<Array<{ x: number; y: number; z: number } | null>>([]);
  const submapHalfSize = submapFootprintFt / 2;
  const biome = BIOMES[biomeId];
  const isTreeLab = environmentMode === 'tree-lab';
  // Capture the player's initial spawn location once so we can keep a permanent
  // "no-props" bubble around the entry point without re-rolling prop placement
  // every time the player moves.
  const [spawnSafeCenter, setSpawnSafeCenter] = useState<{ x: number; z: number } | null>(null);
  // Tuned safe radius to keep the starting area visually clear and collision-free.
  const playerSpawnSafeRadius = 50;

  const lighting = useMemo(
    () => getLightingForTime(gameTime, biomeId, biome?.rgbaColor),
    [gameTime, biomeId, biome?.rgbaColor]
  );
  const sunDirection = useMemo(() => {
    const base = lighting.sunDirection.clone();
    // Allow the test harness to override sun position so artists can light
    // trees without waiting for a specific in-game time of day.
    if (lightingOverrides?.sunAzimuth !== undefined || lightingOverrides?.sunElevation !== undefined) {
      const azimuth = ((lightingOverrides?.sunAzimuth ?? 0) * Math.PI) / 180;
      const elevation = ((lightingOverrides?.sunElevation ?? 45) * Math.PI) / 180;
      base.set(
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth)
      );
    }
    return base.normalize();
  }, [lighting.sunDirection, lightingOverrides?.sunAzimuth, lightingOverrides?.sunElevation]);
  const sunIntensity = lightingOverrides?.sunIntensity ?? lighting.sunIntensity;
  const ambientIntensity = lightingOverrides?.ambientIntensity ?? lighting.ambientIntensity;
  const fogDensity = lightingOverrides?.fogDensity ?? lighting.fogDensity;
  const heightSampler = useMemo(() => {
    // Tree-lab mode uses a large ground plane so there are no visible tile edges.
    // Keeping height flat also makes tree shape iteration easier to judge.
    if (isTreeLab) return () => 0;
    return createHeightSampler(submapSeed, biomeId, submapFootprintFt);
  }, [biomeId, isTreeLab, submapFootprintFt, submapSeed]);
  const moistureSampler = useMemo(() => {
    if (isTreeLab) return () => 0;
    return createMoistureSampler(submapSeed, biomeId, submapFootprintFt);
  }, [biomeId, isTreeLab, submapFootprintFt, submapSeed]);
  const slopeSampler = useMemo(() => {
    if (isTreeLab) return () => 0;
    return createSlopeSampler(heightSampler, 8);
  }, [heightSampler, isTreeLab]);
  const heightRange = useMemo(() => getHeightRangeForBiome(biomeId), [biomeId]);
  const terrainColors = useMemo(() => {
    const base = lighting.biomeColor.clone();
    return {
      low: base.clone().multiplyScalar(0.45),
      mid: base.clone().multiplyScalar(0.85),
      high: base.clone().lerp(new ThreeColor(0xffffff), 0.45),
    };
  }, [lighting.biomeColor]);
  const enemyPositions = useMemo(() => {
    const rng = new SeededRandom(submapSeed + 4242);
    const half = submapFootprintFt / 2;
    const spawnRange = half * 0.7;
    const positions: Array<{ x: number; z: number }> = [];
    const minDistance = 200;

    for (let i = 0; i < 3; i += 1) {
      let x = 0;
      let z = 0;
      let attempts = 0;

      do {
        x = (rng.next() * 2 - 1) * spawnRange;
        z = (rng.next() * 2 - 1) * spawnRange;
        attempts += 1;
      } while (Math.hypot(x, z) < minDistance && attempts < 8);

      positions.push({ x, z });
    }

    return positions;
  }, [submapFootprintFt, submapSeed]);
  const partyOffsets = useMemo(() => {
    const baseOffsets = [
      { x: -10, z: -10 },
      { x: 10, z: -10 },
      { x: -10, z: 10 },
      { x: 10, z: 10 },
      { x: 0, z: -15 },
      { x: 0, z: 15 },
      { x: -15, z: 0 },
      { x: 15, z: 0 },
    ];

    return partyMembers.slice(1).map((_, index) => {
      const ring = Math.floor(index / baseOffsets.length) + 1;
      const offset = baseOffsets[index % baseOffsets.length];
      return { x: offset.x * ring, z: offset.z * ring };
    });
  }, [partyMembers]);
  const skyVisible = biomeId !== 'cave' && biomeId !== 'dungeon';
  const waterLevel = useMemo(() => {
    if (isTreeLab) return null;
    if (biomeId === 'ocean') return 0;
    if (biomeId === 'swamp') return heightRange.min * 0.25;
    return null;
  }, [biomeId, heightRange.min, isTreeLab]);
  const waterColor = useMemo<Color>(() => {
    if (biomeId === 'ocean') return new ThreeColor(0x1d4ed8);
    if (biomeId === 'swamp') return new ThreeColor(0x0f766e);
    return new ThreeColor(0x1d4ed8);
  }, [biomeId]);
  const fogColor = useMemo(() => {
    // Match ez-tree's demo vibe in the lab: a bright sky-blue fog reads as
    // atmosphere instead of "white void" behind a small terrain tile.
    if (isTreeLab) return new ThreeColor(0x94b9f8);
    return lighting.fogColor;
  }, [isTreeLab, lighting.fogColor]);
  const partyProfiles = useMemo(() => {
    const meleeClasses = new Set(['fighter', 'barbarian', 'paladin', 'ranger', 'rogue', 'monk']);
    const supportClasses = new Set(['cleric', 'druid', 'bard']);

    return partyMembers.slice(1).map((member) => {
      const classId = member.class?.id;
      let preferredRange = 45;
      if (classId && meleeClasses.has(classId)) preferredRange = 10;
      else if (classId && supportClasses.has(classId)) preferredRange = 20;
      return {
        preferredRange,
        speed: member.speed ?? playerSpeed,
      };
    });
  }, [partyMembers, playerSpeed]);
  useEffect(() => {
    partyPositionsRef.current.length = partyOffsets.length;
  }, [partyOffsets.length]);

  useEffect(() => {
    // Only snapshot the spawn position once. If we kept updating this center,
    // props would appear to "follow" or shift as the player moves, which is not
    // what we want for a static environment scatter.
    if (spawnSafeCenter || !playerRef.current) return;
    const { x, z } = playerRef.current.position;
    setSpawnSafeCenter({ x, z });
  }, [spawnSafeCenter]);

  const focusTarget = useMemo(() => {
    if (!cameraFocusTarget) return null;
    // Lift the focus point to the terrain surface so the camera can lock onto
    // tree crowns without drifting below the ground plane.
    const y = heightSampler(cameraFocusTarget.x, cameraFocusTarget.z) + (cameraFocusHeightOffset ?? 12);
    return { x: cameraFocusTarget.x, y, z: cameraFocusTarget.z };
  }, [cameraFocusHeightOffset, cameraFocusTarget, heightSampler]);

  return (
    <>
      <FpsTracker onFps={onFps} />
      {!skyVisible && <color attach="background" args={[lighting.fogColor]} />}
      <fogExp2 attach="fog" args={[fogColor, fogDensity]} />
      <ambientLight color={lighting.ambientColor} intensity={ambientIntensity} />
      <hemisphereLight color={lighting.ambientColor} groundColor={lighting.biomeColor} intensity={0.35} />
      <directionalLight
        color={lighting.sunColor}
        intensity={sunIntensity}
        position={sunDirection.toArray()}
        castShadow
      />
      <SkyDome sunDirection={sunDirection} biomeId={biomeId} tint={lighting.biomeColor} visible={skyVisible} />
      {isTreeLab ? (
        <>
          <LabGround
          // Make the ground much larger than the movement bounds so the user
          // never sees a "floating square tile" while iterating on trees.
          size={Math.max(20000, submapFootprintFt * 8)}
          tint={lighting.biomeColor.clone().multiplyScalar(0.85)}
        />
          <LabClouds size={Math.max(6000, submapFootprintFt * 3)} height={240} />
          <LabGrass
            seed={submapSeed}
            grassEnabled={labGrassEnabled}
            flowersEnabled={labFlowersEnabled}
            grassCount={labGrassCount}
            flowerCountPerColor={labFlowerCount}
            radius={Math.min(600, submapHalfSize * 0.85)}
            avoidCenter={spawnSafeCenter ?? { x: 0, z: 0 }}
            avoidRadius={playerSpawnSafeRadius}
          />
          <LabRocks
            seed={submapSeed}
            enabled={labRocksEnabled}
            countPerType={labRocksPerType}
            radius={Math.min(350, submapHalfSize * 0.7)}
            avoidCenter={spawnSafeCenter ?? { x: 0, z: 0 }}
            avoidRadius={playerSpawnSafeRadius}
          />
        </>
      ) : (
        <Terrain
          size={submapFootprintFt}
          heightSampler={heightSampler}
          slopeSampler={slopeSampler}
          moistureSampler={moistureSampler}
          color={lighting.biomeColor.clone().multiplyScalar(0.8)}
          showGrid={showGrid}
          gridSizeFt={5}
          heightRange={heightRange}
          heightColors={terrainColors}
        />
      )}
      {waterLevel !== null && (
        <WaterPlane size={submapFootprintFt} level={waterLevel} color={waterColor} />
      )}
      <PropsLayer
        submapSeed={submapSeed}
        biomeId={biomeId}
        size={submapFootprintFt}
        heightSampler={heightSampler}
        tint={lighting.biomeColor}
        // If the spawn position hasn't been sampled yet, default to origin; once
        // captured, keep using that fixed point to reserve a clear spawn zone.
        spawnCenter={spawnSafeCenter ?? { x: 0, z: 0 }}
        spawnSafeRadius={playerSpawnSafeRadius}
        treeCountMultiplier={treeCountMultiplier}
        rockCountMultiplier={rockCountMultiplier}
        heroLineEnabled={heroLineEnabled}
        heroLineSpacing={heroLineSpacing}
        heroLineOffset={heroLineOffset}
        customTreeOptions={customTreeOptions}
        customTreeEnabled={customTreeEnabled}
        customTreeOffset={customTreeOffset}
        customTreeScale={customTreeScale}
        comparisonTreeOptions={comparisonTreeOptions}
        comparisonTreeEnabled={comparisonTreeEnabled}
        comparisonTreeOffset={comparisonTreeOffset}
        comparisonTreeScale={comparisonTreeScale}
        onCustomTreeStats={onCustomTreeStats}
        onComparisonTreeStats={onComparisonTreeStats}
      />
      {partyOffsets.map((offset, index) => {
        const member = partyMembers[index + 1];
        const key = member?.id ?? `party-${index}`;
        const profile = partyProfiles[index];
        const cappedSpeed = Math.min(profile?.speed ?? playerSpeed, playerSpeed);
        return (
          <PartyUnit
            key={key}
            playerRef={playerRef}
            positionsRef={partyPositionsRef}
            unitIndex={index}
            offset={offset}
            heightSampler={heightSampler}
            submapHalfSize={submapHalfSize}
            showOutline={showGrid}
            playerSpeed={cappedSpeed}
            enemyPositions={enemyPositions}
            behaviorMode={isCombatMode ? 'combat' : 'explore'}
            preferredRange={profile?.preferredRange ?? 30}
          />
        );
      })}
      {enemyPositions.map((enemy, index) => (
        <EnemyUnit
          key={`enemy-${index}`}
          position={enemy}
          heightSampler={heightSampler}
          showOutline={showGrid}
        />
      ))}
      <mesh ref={playerRef} position={[0, 3, 0]} castShadow>
        <boxGeometry args={[3, 6, 3]} />
        <meshStandardMaterial color={0xf59e0b} roughness={0.45} />
      </mesh>
      <PlayerController
        playerRef={playerRef}
        speedFeetPerRound={playerSpeed}
        submapHalfSize={submapHalfSize}
        heightSampler={heightSampler}
        onPositionChange={onPlayerPosition}
        onSpeedChange={onPlayerSpeed}
      />
      <CameraRig
        playerRef={playerRef}
        maxDistance={500}
        focusTarget={focusTarget}
        focusRequestId={cameraFocusRequestId}
        focusDistance={cameraFocusDistance}
        lockOnFocus={cameraFocusLock}
      />
      <GridCellOutline
        playerRef={playerRef}
        gridSize={5}
        heightSampler={heightSampler}
        visible={showGrid}
      />
    </>
  );
};

const Scene3D = ({ pauseRender = false, ...props }: Scene3DProps) => (
  <Canvas
    shadows
    camera={{ position: [0, 80, 160], fov: 55, near: 0.1, far: 20000 }}
    dpr={[1, 1.5]}
    gl={{ antialias: false, powerPreference: 'high-performance' }}
    frameloop={pauseRender ? 'never' : 'always'}
    className="w-full h-full"
  >
    <SceneContents {...props} />
  </Canvas>
);

export default Scene3D;
