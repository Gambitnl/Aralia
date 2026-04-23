import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { Color, Mesh } from 'three';
import { ACESFilmicToneMapping, Color as ThreeColor, DoubleSide, SRGBColorSpace } from 'three';
import { BIOMES } from '../../constants';
import { SeededRandom } from '../../utils/random/seededRandom';
import type { PlayerCharacter } from '../../types';
import { getLightingForTime } from './lighting';
import CameraRig from './CameraRig';
import PlayerController from './PlayerController';
import Terrain from './Terrain';
import EnhancedTerrain from './EnhancedTerrain';
import TextureSplatting from './TextureSplatting';
import PropsLayer, { type TreeStats } from './PropsLayer';
import type { SceneEntity } from './sceneEntities';
import {
  createTerrainSamplers,
} from './terrainUtils';
import GridCellOutline from './GridCellOutline';
import EnemyUnit from './EnemyUnit';
import NpcUnit from './NpcUnit';
import PartyUnit from './PartyUnit';
import SkyDome from './SkyDome';
import EnhancedSkyDome from './EnhancedSkyDome';
import TakramSkySystem from './TakramSkySystem';
import WaterPlane from './WaterPlane';
import EnhancedWaterPlane from './EnhancedWaterPlane';
import LabGround from './LabGround';
import LabClouds from './LabClouds';
import LabGrass from './LabGrass';
import LabRocks from './LabRocks';
import PostProcessingPipeline from './PostProcessingPipeline';

interface Scene3DProps {
  biomeId: string;
  gameTime: Date;
  playerSpeed: number;
  submapSeed: number;
  submapFootprintFt: number;
  /** Rendering safety switch for debugging. */
  renderQuality?: 'safe' | 'enhanced';
  environmentMode?: 'submap' | 'tree-lab';
  showGrid: boolean;
  partyMembers: PlayerCharacter[];
  isCombatMode: boolean;
  onPlayerPosition?: (position: { x: number; y: number; z: number }) => void;
  onPlayerSpeed?: (speedFeetPerRound: number) => void;
  onFrameTime?: (ms: number) => void;
  onEntityHover?: (entity: SceneEntity | null) => void;
  onEntitySelect?: (entity: SceneEntity | null) => void;
  hoveredEntityId?: string | null;
  selectedEntityId?: string | null;
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
  /**
   * 'legacy'  — current EnhancedSkyDome + LabClouds + PostProcessingPipeline (default)
   * 'takram'  — @takram/three-atmosphere sky + @takram/three-clouds volumetric clouds
   *             (disables PostProcessingPipeline to avoid double-render conflict)
   */
  skyMode?: 'legacy' | 'takram';
  takramCloudCoverage?: number;
  /** Sky Lab debug toggles — only used when skyMode='takram' */
  takramCorrectAltitude?: boolean;
  takramGround?: boolean;
  takramStars?: boolean;
  /** When false, disables the @react-three/postprocessing EffectComposer in takram mode. */
  takramEffectComposer?: boolean;
  /** Exposure multiplier for the Takram sky's ACES tone mapping pass (default 6). */
  takramExposure?: number;
  /** Show procedural moon (opposite sun) in Takram mode. */
  takramMoon?: boolean;
  /** Altitude multiplier for cloud layers (default 1.0). */
  takramCloudAltitude?: number;
  /** Sky-cam debug mode: snaps the camera to orbit a point in the cloud layer so clouds are visible looking upward. */
  takramSkyCam?: boolean;
  labGrassEnabled?: boolean;
  labGrassCount?: number;
  labFlowersEnabled?: boolean;
  labFlowerCount?: number;
  labRocksEnabled?: boolean;
  labRocksPerType?: number;
}

interface FrameTimeTrackerProps {
  onFrameTime?: (ms: number) => void;
  sampleWindow?: number;
}

/**
 * Reports average frame time in milliseconds using performance.now().
 * Unlike RAF-delta-based FPS counters, this isn't capped at vsync (60 Hz)
 * and reveals actual render cost. 16.6ms = 60fps, >33ms = noticeable stutter.
 */
const FrameTimeTracker = ({ onFrameTime, sampleWindow = 0.5 }: FrameTimeTrackerProps) => {
  const stateRef = useRef({ totalMs: 0, frames: 0, prevTime: 0 });
  const lastValueRef = useRef<number | null>(null);

  useFrame(() => {
    const now = performance.now();
    const s = stateRef.current;

    if (s.prevTime === 0) {
      s.prevTime = now;
      return;
    }

    s.totalMs += now - s.prevTime;
    s.frames += 1;
    s.prevTime = now;

    if (s.totalMs >= sampleWindow * 1000) {
      const avgMs = +(s.totalMs / s.frames).toFixed(1);
      if (avgMs !== lastValueRef.current) {
        lastValueRef.current = avgMs;
        onFrameTime?.(avgMs);
      }
      s.totalMs = 0;
      s.frames = 0;
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
  renderQuality = 'enhanced',
  showGrid,
  partyMembers,
  isCombatMode,
  onPlayerPosition,
  onPlayerSpeed,
  onFrameTime,
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
  onEntityHover,
  onEntitySelect,
  hoveredEntityId,
  selectedEntityId,
  skyMode = 'legacy',
  takramCloudCoverage = 0.5,
  takramCorrectAltitude = true,
  takramGround = false,
  takramStars = true,
  takramEffectComposer = true,
  takramExposure = 6,
  takramMoon = true,
  takramCloudAltitude = 1,
  takramSkyCam = false,
}: Scene3DProps) => {
  const playerRef = useRef<Mesh>(null);
  const partyPositionsRef = useRef<Array<{ x: number; y: number; z: number } | null>>([]);
  const submapHalfSize = submapFootprintFt / 2;
  const biome = BIOMES[biomeId];
  const isTreeLab = environmentMode === 'tree-lab';
  const isSafeRender = renderQuality === 'safe';
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
  // Scene lighting sun direction — clamped above horizon for directional light.
  const sunDirection = useMemo(() => {
    const base = lighting.sunDirection.clone();
    // Allow the test harness to override sun position so artists can light
    // trees without waiting for a specific in-game time of day.
    // In Takram mode the time slider drives the sun position so the
    // physically-based atmosphere responds to time-of-day changes.
    if (
      skyMode !== 'takram' &&
      (lightingOverrides?.sunAzimuth !== undefined || lightingOverrides?.sunElevation !== undefined)
    ) {
      const azimuth = ((lightingOverrides?.sunAzimuth ?? 0) * Math.PI) / 180;
      const elevation = ((lightingOverrides?.sunElevation ?? 45) * Math.PI) / 180;
      base.set(
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth)
      );
    }
    return base.normalize();
  }, [lighting.sunDirection, lightingOverrides?.sunAzimuth, lightingOverrides?.sunElevation, skyMode]);
  // True astronomical sun direction for the Takram atmosphere — unclamped so
  // the sun actually dips below the horizon, enabling sunset, night sky, stars, and moon.
  const takramSunDirection = useMemo(
    () => lighting.trueSunDirection.clone().normalize(),
    [lighting.trueSunDirection]
  );
  const sunIntensity = lightingOverrides?.sunIntensity ?? lighting.sunIntensity;
  const ambientIntensity = lightingOverrides?.ambientIntensity ?? lighting.ambientIntensity;
  const fogDensity = lightingOverrides?.fogDensity ?? lighting.fogDensity;

  // In takram mode, boost toneMappingExposure so Bruneton's low relative-luminance
  // sky values (0.01–0.1) become visible after ACES tone mapping.
  // At night the exposure ramps down so the sky goes properly dark and stars
  // become visible instead of amplifying residual scattering glow.
  // In legacy mode, restore the default exposure of 1.0.
  const { gl } = useThree();
  const takramEffectiveExposure = useMemo(() => {
    if (skyMode !== 'takram') return 1.0;
    // takramSunDirection.y < 0 means sun below horizon.
    const sunY = takramSunDirection.y;
    // Smoothly ramp: full exposure when sun above ~10°, minimum (~1.5×) when
    // sun is well below horizon (-0.2 or lower).
    const t = Math.max(0, Math.min(1, (sunY + 0.2) / 0.35)); // 0 at sunY≤-0.2, 1 at sunY≥0.15
    const nightExposure = 1.5;
    return nightExposure + t * (takramExposure - nightExposure);
  }, [skyMode, takramExposure, takramSunDirection.y]);
  useEffect(() => {
    gl.toneMappingExposure = takramEffectiveExposure;
  }, [gl, takramEffectiveExposure]);
  const terrainSamplers = useMemo(() => {
    // Tree-lab mode uses a large ground plane so there are no visible tile edges.
    // Keeping height flat also makes tree shape iteration easier to judge.
    if (isTreeLab) {
      return createTerrainSamplers(submapSeed, 'plains', submapFootprintFt);
    }
    return createTerrainSamplers(submapSeed, biomeId, submapFootprintFt);
  }, [biomeId, isTreeLab, submapFootprintFt, submapSeed]);
  const heightSampler = useMemo(() => (isTreeLab ? () => 0 : terrainSamplers.heightSampler), [isTreeLab, terrainSamplers.heightSampler]);
  const moistureSampler = useMemo(() => (isTreeLab ? () => 0.4 : terrainSamplers.moistureSampler), [isTreeLab, terrainSamplers.moistureSampler]);
  const slopeSampler = useMemo(() => (isTreeLab ? () => 0 : terrainSamplers.slopeSampler), [isTreeLab, terrainSamplers.slopeSampler]);
  const featureSampler = useMemo(() => terrainSamplers.featureSampler, [terrainSamplers.featureSampler]);
  const heightRange = useMemo(() => terrainSamplers.heightRange, [terrainSamplers.heightRange]);
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
        const masks = featureSampler(x, z);
        const blocked = masks.path > 0.25 || masks.river > 0.3 || masks.clearing > 0.55;
        if (blocked) continue;
      } while (Math.hypot(x, z) < minDistance && attempts < 14);

      positions.push({ x, z });
    }

    return positions;
  }, [featureSampler, submapFootprintFt, submapSeed]);
  const creatureEntities = useMemo<SceneEntity[]>(() => {
    const rng = new SeededRandom(submapSeed + 4343);
    const labels = ['Wolf', 'Boar', 'Giant Spider', 'Bandit', 'Goblin Scout'];

    return enemyPositions.map((enemy, index) => ({
      id: `tile_creature_${submapSeed}_${index}`,
      kind: 'creature',
      label: rng.pick(labels),
      position: enemy,
      interactRadiusFt: 18,
    }));
  }, [enemyPositions, submapSeed]);
  const npcEntities = useMemo<SceneEntity[]>(() => {
    if (isTreeLab) return [];

    const rng = new SeededRandom(submapSeed + 9191);
    const labels = ['Traveler', 'Forager', 'Scout', 'Pilgrim', 'Wanderer'];
    const half = submapFootprintFt / 2;
    const spawnRange = half * 0.65;
    const positions: SceneEntity[] = [];
    const minDistanceFromOrigin = 220;
    const minDistanceBetween = 180;

    const count = biomeId === 'cave' || biomeId === 'dungeon' ? 0 : 2;
    for (let i = 0; i < count; i += 1) {
      let x = 0;
      let z = 0;
      let attempts = 0;

      do {
        x = (rng.next() * 2 - 1) * spawnRange;
        z = (rng.next() * 2 - 1) * spawnRange;
        attempts += 1;
        const tooCloseToOrigin = Math.hypot(x, z) < minDistanceFromOrigin;
        const tooCloseToNpc = positions.some((npc) => Math.hypot(npc.position.x - x, npc.position.z - z) < minDistanceBetween);
        const masks = featureSampler(x, z);
        const preferPath = masks.path > 0.2 || masks.clearing > 0.25;
        const blocked = masks.river > 0.35;
        if (!tooCloseToOrigin && !tooCloseToNpc && preferPath && !blocked) break;
      } while (attempts < 12);

      positions.push({
        id: `tile_npc_${submapSeed}_${i}`,
        kind: 'npc',
        label: rng.pick(labels),
        position: { x, z },
        interactRadiusFt: 20,
      });
    }

    return positions;
  }, [biomeId, featureSampler, isTreeLab, submapFootprintFt, submapSeed]);
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
      <FrameTimeTracker onFrameTime={onFrameTime} />
      {!skyVisible && <color attach="background" args={[lighting.fogColor]} />}
      {/* In "safe" mode, we intentionally reduce atmospheric effects to debug geometry/material issues. */}
      {!isSafeRender && <fogExp2 attach="fog" args={[fogColor, fogDensity]} />}
      <ambientLight color={lighting.ambientColor} intensity={ambientIntensity} />
      <hemisphereLight 
        color={lighting.ambientColor} 
        groundColor={lighting.biomeColor} 
        intensity={0.18} 
      />
      {/* NOTE: "AO" as a light tends to blow out the scene; keep disabled unless we swap to real SSAO. */}
      <directionalLight
        color={lighting.sunColor}
        intensity={sunIntensity}
        position={sunDirection.toArray()}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />
      {!isSafeRender && skyMode === 'takram' && (
        <TakramSkySystem
          sunDirection={takramSunDirection}
          visible={skyVisible}
          cloudCoverage={takramCloudCoverage}
          qualityPreset="low"
          correctAltitude={takramCorrectAltitude}
          ground={takramGround}
          starsEnabled={takramStars}
          moonEnabled={takramMoon}
          effectComposerEnabled={takramEffectComposer}
          exposure={takramEffectiveExposure}
          cloudAltitude={takramCloudAltitude}
        />
      )}
      {!isSafeRender && skyMode === 'legacy' && (
        <EnhancedSkyDome
          sunDirection={sunDirection}
          biomeId={biomeId}
          tint={lighting.biomeColor}
          visible={skyVisible}
          gameTime={gameTime}
          cloudCoverage={0.6}
          windSpeed={1.0}
        />
      )}
      {isTreeLab ? (
        <>
          <LabGround
          // Make the ground much larger than the movement bounds so the user
          // never sees a "floating square tile" while iterating on trees.
          size={Math.max(20000, submapFootprintFt * 8)}
          tint={lighting.biomeColor.clone().multiplyScalar(0.85)}
        />
          {skyMode === 'legacy' && (
            <LabClouds size={Math.max(6000, submapFootprintFt * 3)} height={240} />
          )}
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
        <>
          {isSafeRender ? (
            // Flat, bright fallback ground so we can debug camera/controls/lighting even if terrain shaders break.
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[submapFootprintFt, submapFootprintFt, 1, 1]} />
                <meshStandardMaterial
                  color={0x94a3b8}
                  emissive={new ThreeColor(0x111827)}
                  roughness={0.95}
                  metalness={0.02}
                  side={DoubleSide}
                  map={null}
                />
              </mesh>
              <gridHelper args={[submapFootprintFt, Math.max(10, Math.round(submapFootprintFt / 300))]} position={[0, 0.05, 0]} />
              <axesHelper args={[80]} />
            </>
          ) : (
            <TextureSplatting
              size={submapFootprintFt}
              heightSampler={heightSampler}
              moistureSampler={moistureSampler}
              slopeSampler={slopeSampler}
              featureSampler={featureSampler}
              color={lighting.biomeColor.clone().multiplyScalar(0.8)}
              showGrid={showGrid}
              gridSizeFt={5}
              heightRange={heightRange}
              heightColors={terrainColors}
              biomeId={biomeId}
              textureScale={0.5}
            />
          )}
        </>
      )}
      {waterLevel !== null && (
        <EnhancedWaterPlane 
          size={submapFootprintFt} 
          level={waterLevel} 
          color={waterColor} 
          opacity={0.75}
          waveIntensity={0.4}
          gameTime={gameTime}
        />
      )}
      <PropsLayer
        submapSeed={submapSeed}
        biomeId={biomeId}
        size={submapFootprintFt}
        heightSampler={heightSampler}
        slopeSampler={isTreeLab ? undefined : slopeSampler}
        moistureSampler={isTreeLab ? undefined : moistureSampler}
        featureSampler={isTreeLab ? undefined : featureSampler}
        heightRange={heightRange}
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
      {npcEntities.map((npc) => (
        <NpcUnit
          key={npc.id}
          id={npc.id}
          label={npc.label}
          position={npc.position}
          heightSampler={heightSampler}
          showOutline={showGrid}
          playerRef={playerRef}
          isHovered={hoveredEntityId === npc.id}
          isSelected={selectedEntityId === npc.id}
          onHoverStart={() => onEntityHover?.(npc)}
          onHoverEnd={() => onEntityHover?.(null)}
          onSelect={() => onEntitySelect?.(npc)}
        />
      ))}
      {creatureEntities.map((enemy) => (
        <EnemyUnit
          key={enemy.id}
          id={enemy.id}
          label={enemy.label}
          position={enemy.position}
          heightSampler={heightSampler}
          showOutline={showGrid}
          playerRef={playerRef}
          isHovered={hoveredEntityId === enemy.id}
          isSelected={selectedEntityId === enemy.id}
          onHoverStart={() => onEntityHover?.(enemy)}
          onHoverEnd={() => onEntityHover?.(null)}
          onSelect={() => onEntitySelect?.(enemy)}
        />
      ))}
      <mesh ref={playerRef} position={[0, 3, 0]} castShadow>
        <boxGeometry args={[3, 6, 3]} />
        <meshStandardMaterial color={0xf59e0b} roughness={0.45} map={null} />
      </mesh>
      <PlayerController
        playerRef={playerRef}
        speedFeetPerRound={playerSpeed}
        submapHalfSize={submapHalfSize}
        heightSampler={heightSampler}
        onPositionChange={onPlayerPosition}
        onSpeedChange={onPlayerSpeed}
      />
      {/* In takram sky mode allow tilting camera past horizontal so the user
          can look upward and verify volumetric clouds are rendering. The
          default (Math.PI * 0.48 ≈ 86°) blocks any upward view of the sky.
          skyCam snaps the orbit target into the cloud layer (~400m) for a
          direct under-cloud view. */}
      <CameraRig
        playerRef={playerRef}
        maxDistance={500}
        maxPolarAngle={skyMode === 'takram' ? Math.PI * 0.85 : Math.PI * 0.48}
        skyCam={skyMode === 'takram' && takramSkyCam}
        skyCamAltitude={400}
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
      {/* PostProcessingPipeline (three-stdlib) is legacy-only — it conflicts with
          @react-three/postprocessing's EffectComposer used in Takram mode. */}
      {!isSafeRender && skyMode === 'legacy' && (
        <PostProcessingPipeline
          enabled={true}
          bloomIntensity={0.15}
          bloomThreshold={0.85}
          bloomRadius={0.12}
          fxaaEnabled={true}
        />
      )}
      {/* Note: In takram mode the EffectComposer (with Clouds + ToneMapping) lives
          inside TakramSkySystem, not here. It must be a child of <Atmosphere> so
          that <Clouds> can access AtmosphereContext for sun direction / ECEF matrix. */}
    </>
  );
};

const Scene3D = ({ pauseRender = false, ...props }: Scene3DProps) => (
  <Canvas
    shadows
    camera={{ position: [0, 80, 160], fov: 55, near: 0.1, far: 20000 }}
    dpr={[1, 2]}
    gl={{ 
      antialias: true, 
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    }}
    frameloop={pauseRender ? 'never' : 'always'}
    onCreated={({ gl }) => {
      // Stabilize lighting perception across GPUs/drivers and avoid "inside the sun" visuals.
      gl.outputColorSpace = SRGBColorSpace;
      gl.toneMapping = ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.0;
    }}
    onPointerMissed={() => props.onEntitySelect?.(null)}
    className="w-full h-full"
  >
    <SceneContents {...props} />
  </Canvas>
);

export default Scene3D;
