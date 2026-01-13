import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type { Color, Mesh } from 'three';
import { Color as ThreeColor } from 'three';
import { BIOMES } from '../../constants';
import { SeededRandom } from '../../utils/random/seededRandom';
import type { PlayerCharacter } from '../../types';
import { getLightingForTime } from './lighting';
import CameraRig from './CameraRig';
import PlayerController from './PlayerController';
import Terrain from './Terrain';
import PropsLayer from './PropsLayer';
import { createHeightSampler, getHeightRangeForBiome } from './terrainUtils';
import TileOutline from './TileOutline';
import EnemyUnit from './EnemyUnit';
import PartyUnit from './PartyUnit';
import SkyDome from './SkyDome';
import WaterPlane from './WaterPlane';

interface Scene3DProps {
  biomeId: string;
  gameTime: Date;
  playerSpeed: number;
  tileSeed: number;
  tileFootprintFt: number;
  showGrid: boolean;
  partyMembers: PlayerCharacter[];
  isCombatMode: boolean;
  onPlayerPosition?: (position: { x: number; y: number; z: number }) => void;
  onPlayerSpeed?: (speedFeetPerRound: number) => void;
}

const SceneContents = ({
  biomeId,
  gameTime,
  playerSpeed,
  tileSeed,
  tileFootprintFt,
  showGrid,
  partyMembers,
  isCombatMode,
  onPlayerPosition,
  onPlayerSpeed,
}: Scene3DProps) => {
  const playerRef = useRef<Mesh>(null);
  const partyPositionsRef = useRef<Array<{ x: number; y: number; z: number } | null>>([]);
  const halfSize = tileFootprintFt / 2;
  const biome = BIOMES[biomeId];

  const lighting = useMemo(
    () => getLightingForTime(gameTime, biomeId, biome?.rgbaColor),
    [gameTime, biomeId, biome?.rgbaColor]
  );
  const heightSampler = useMemo(
    () => createHeightSampler(tileSeed, biomeId, tileFootprintFt),
    [tileSeed, biomeId, tileFootprintFt]
  );
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
    const rng = new SeededRandom(tileSeed + 4242);
    const half = tileFootprintFt / 2;
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
  }, [tileFootprintFt, tileSeed]);
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
    if (biomeId === 'ocean') return 0;
    if (biomeId === 'swamp') return heightRange.min * 0.25;
    return null;
  }, [biomeId, heightRange.min]);
  const waterColor = useMemo<Color>(() => {
    if (biomeId === 'ocean') return new ThreeColor(0x1d4ed8);
    if (biomeId === 'swamp') return new ThreeColor(0x0f766e);
    return new ThreeColor(0x1d4ed8);
  }, [biomeId]);
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

  return (
    <>
      {!skyVisible && <color attach="background" args={[lighting.fogColor]} />}
      <fogExp2 attach="fog" args={[lighting.fogColor, lighting.fogDensity]} />
      <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity} />
      <hemisphereLight color={lighting.ambientColor} groundColor={lighting.biomeColor} intensity={0.35} />
      <directionalLight
        color={lighting.sunColor}
        intensity={lighting.sunIntensity}
        position={lighting.sunDirection.toArray()}
        castShadow
      />
      <SkyDome sunDirection={lighting.sunDirection} biomeId={biomeId} tint={lighting.biomeColor} visible={skyVisible} />
      <Terrain
        size={tileFootprintFt}
        heightSampler={heightSampler}
        color={lighting.biomeColor.clone().multiplyScalar(0.8)}
        showGrid={showGrid}
        gridSizeFt={5}
        heightRange={heightRange}
        heightColors={terrainColors}
      />
      {waterLevel !== null && (
        <WaterPlane size={tileFootprintFt} level={waterLevel} color={waterColor} />
      )}
      <PropsLayer
        tileSeed={tileSeed}
        biomeId={biomeId}
        size={tileFootprintFt}
        heightSampler={heightSampler}
        tint={lighting.biomeColor}
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
            tileHalfSize={halfSize}
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
        tileHalfSize={halfSize}
        heightSampler={heightSampler}
        onPositionChange={onPlayerPosition}
        onSpeedChange={onPlayerSpeed}
      />
      <CameraRig playerRef={playerRef} maxDistance={500} />
      <TileOutline
        playerRef={playerRef}
        gridSize={5}
        heightSampler={heightSampler}
        visible={showGrid}
      />
    </>
  );
};

const Scene3D = (props: Scene3DProps) => (
  <Canvas
    shadows
    camera={{ position: [0, 80, 160], fov: 55, near: 0.1, far: 20000 }}
    className="w-full h-full"
  >
    <SceneContents {...props} />
  </Canvas>
);

export default Scene3D;
