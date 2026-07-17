// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:29:01
 * Dependents: components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file OpeningThreatScene3D.tsx
 *
 * Renders the same saved monster site, terrain memory, ecological traces, and
 * resolved bodies that the 2D battle map consumes. Every anchor comes from the
 * opening encounter context. The meshes add volume and material only; they do
 * not invent placement, identity, or outcome state.
 *
 * Deliberate boundary: active opening creatures continue through CharacterActor
 * because they are combatants. This layer renders bodies only after a receipt is
 * resolved, preventing static scene geometry from duplicating initiative actors.
 */
import React, { useMemo } from "react";
import type {
  BattleMapData,
  BattleMapEncounterContext,
  BattleMapOpeningEcologicalTrace,
  BattleMapOpeningTerrainImprint,
  BattleMapOpeningThreatEntity,
  Position,
} from "../../types/combat";

type OpeningContext = Extract<
  BattleMapEncounterContext,
  { kind: "opening-standoff" }
>;
type GroundSampler = (tileX: number, tileZ: number) => number;

export interface OpeningThreatScene3DFacts {
  context: OpeningContext;
  resolvedBodies: BattleMapOpeningThreatEntity[];
  focus: Position;
  siteCondition: "occupied" | "abandoned-disturbed" | "held-disturbed";
}

interface OpeningThreatScene3DProps {
  mapData: BattleMapData;
  groundSampler?: GroundSampler | null;
}

/**
 * Select the exact scene facts a 3D renderer may consume.
 *
 * Keeping this pure gives parity tests a strict boundary: an unresolved scene
 * has no static bodies, while a resolved return may only show entities whose
 * saved outcome leaves a physical presence at the location.
 */
export function selectOpeningThreatScene3DFacts(
  mapData: BattleMapData,
): OpeningThreatScene3DFacts | null {
  const context = mapData.encounterContext;
  if (context?.kind !== "opening-standoff") return null;

  const physicalOutcomeIds = new Set(
    (context.sceneResolution?.entityOutcomes ?? [])
      .filter(
        (outcome) =>
          outcome.status === "downed" || outcome.status === "holding-ground",
      )
      .map((outcome) => outcome.sourceEntityId),
  );
  const resolvedBodies = context.sceneResolution
    ? context.sourceEntities.filter((entity) =>
        physicalOutcomeIds.has(entity.entityId),
      )
    : [];
  const focusAnchors = [
    ...(context.activitySite ? [context.activitySite.position] : []),
    ...resolvedBodies.map((entity) => entity.position),
    ...(context.sceneResolution
      ? [context.sceneResolution.combatDisturbance.position]
      : []),
  ];
  const focus =
    focusAnchors.length > 0
      ? {
          x:
            focusAnchors.reduce((sum, point) => sum + point.x, 0) /
            focusAnchors.length,
          y:
            focusAnchors.reduce((sum, point) => sum + point.y, 0) /
            focusAnchors.length,
        }
      : { ...context.anchorTile };

  return {
    context,
    resolvedBodies,
    focus,
    siteCondition: context.sceneResolution?.activitySiteCondition ?? "occupied",
  };
}

/** Sample the continuous terrain under a saved tactical cell. */
function groundY(position: Position, sampler?: GroundSampler | null): number {
  return sampler?.(position.x + 0.5, position.y + 0.5) ?? 0;
}

/** Translate a saved cell anchor into the center of its 3D tile. */
function worldPosition(
  position: Position,
  sampler?: GroundSampler | null,
  lift = 0,
): [number, number, number] {
  return [
    position.x + 0.5,
    groundY(position, sampler) + lift,
    position.y + 0.5,
  ];
}

/** A low polygon ground mark that follows one source-authored anchor. */
const GroundDisc: React.FC<{
  position: Position;
  radiusX: number;
  radiusZ: number;
  color: string;
  opacity: number;
  sampler?: GroundSampler | null;
  rotation?: number;
}> = ({
  position,
  radiusX,
  radiusZ,
  color,
  opacity,
  sampler,
  rotation = 0,
}) => (
  <mesh
    position={worldPosition(position, sampler, 0.035)}
    rotation={[-Math.PI / 2, 0, rotation]}
    scale={[radiusX, radiusZ, 1]}
    receiveShadow
  >
    <circleGeometry args={[1, 11]} />
    <meshStandardMaterial
      color={color}
      roughness={1}
      transparent
      opacity={opacity}
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={-2}
    />
  </mesh>
);

/** Draw a worn line between the exact start and end cells of an imprint. */
const GroundRun: React.FC<{
  imprint: BattleMapOpeningTerrainImprint;
  sampler?: GroundSampler | null;
}> = ({ imprint, sampler }) => {
  const dx = imprint.endPosition.x - imprint.position.x;
  const dz = imprint.endPosition.y - imprint.position.y;
  const length = Math.max(0.6, Math.hypot(dx, dz));
  const angle = Math.atan2(dz, dx);
  const midpoint = {
    x: (imprint.position.x + imprint.endPosition.x) / 2,
    y: (imprint.position.y + imprint.endPosition.y) / 2,
  };
  const isFurrow = imprint.kind === "drag-furrow";
  const width = Math.max(
    0.16,
    Math.min(imprint.extentCells.width, isFurrow ? 0.34 : 0.72),
  );

  return (
    <group
      position={worldPosition(midpoint, sampler, 0.04)}
      rotation={[0, -angle, 0]}
    >
      {isFurrow ? (
        [-0.13, 0.13].map((offset) => (
          <mesh
            key={offset}
            position={[0, 0, offset]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[length, 0.055]} />
            <meshStandardMaterial
              color="#251a12"
              roughness={1}
              transparent
              opacity={0.66}
              depthWrite={false}
            />
          </mesh>
        ))
      ) : (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[length, width]} />
            <meshStandardMaterial
              color="#493621"
              roughness={1}
              transparent
              opacity={0.38}
              depthWrite={false}
            />
          </mesh>
          {[-0.36, -0.12, 0.14, 0.38].map((along, index) => (
            <mesh
              key={along}
              position={[
                along * length,
                0.025,
                index % 2 === 0 ? -width * 0.2 : width * 0.2,
              ]}
              rotation={[-Math.PI / 2, 0, index % 2 === 0 ? -0.25 : 0.25]}
              scale={[0.16, 0.08, 1]}
            >
              <circleGeometry args={[1, 8]} />
              <meshStandardMaterial
                color="#211810"
                roughness={1}
                transparent
                opacity={0.72}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};

/** Project one saved occupation imprint without adding renderer-only objects. */
const TerrainImprint3D: React.FC<{
  imprint: BattleMapOpeningTerrainImprint;
  sampler?: GroundSampler | null;
}> = ({ imprint, sampler }) => {
  if (imprint.kind === "trampled-run" || imprint.kind === "drag-furrow") {
    return <GroundRun imprint={imprint} sampler={sampler} />;
  }

  if (imprint.kind === "refuse-scatter") {
    const offsets: Array<[number, number, number]> = [
      [-0.28, 0.02, -0.12],
      [0.08, 0.03, 0.2],
      [0.31, 0.02, -0.18],
      [-0.06, 0.025, -0.31],
    ];
    return (
      <group
        position={worldPosition(imprint.position, sampler, 0.04)}
        name="opening-refuse-scatter-3d"
      >
        {offsets.map(([x, y, z], index) => (
          <mesh
            key={`${x}-${z}`}
            position={[x, y, z]}
            rotation={[0.2 * index, 0.7 * index, 0.15 * index]}
            castShadow
          >
            {index % 2 === 0 ? (
              <dodecahedronGeometry args={[0.09, 0]} />
            ) : (
              <boxGeometry args={[0.17, 0.045, 0.09]} />
            )}
            <meshStandardMaterial
              color={index % 2 === 0 ? "#6c5a3d" : "#715033"}
              roughness={0.96}
            />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <GroundDisc
      position={imprint.position}
      radiusX={Math.max(0.7, imprint.extentCells.length / 2)}
      radiusZ={Math.max(0.5, imprint.extentCells.width / 2)}
      color="#3b2d1d"
      opacity={0.44}
      sampler={sampler}
      rotation={-Math.atan2(imprint.direction.y, imprint.direction.x)}
    />
  );
};

/** Physical saved clue geometry; no floating glyphs or magical color coding. */
const EcologicalTrace3D: React.FC<{
  trace: BattleMapOpeningEcologicalTrace;
  sampler?: GroundSampler | null;
}> = ({ trace, sampler }) => {
  const base = worldPosition(trace.position, sampler, 0.05);
  if (trace.kind === "disturbed-vegetation") {
    return (
      <group position={base} name="opening-disturbed-vegetation-3d">
        {[-0.22, 0, 0.2].map((offset, index) => (
          <mesh
            key={offset}
            position={[offset, 0.08, index % 2 === 0 ? -0.1 : 0.1]}
            rotation={[0, 0, index % 2 === 0 ? 1.1 : -0.9]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.028, 0.38, 6]} />
            <meshStandardMaterial color="#59452d" roughness={1} />
          </mesh>
        ))}
      </group>
    );
  }

  const marks = trace.kind === "tracks" ? [-0.16, 0.16] : [-0.22, 0, 0.22];
  return (
    <group position={base} name={`opening-${trace.kind}-3d`}>
      {marks.map((offset, index) => (
        <mesh
          key={offset}
          position={[offset, 0, index % 2 === 0 ? -0.06 : 0.08]}
          rotation={[-Math.PI / 2, 0, index % 2 === 0 ? -0.28 : 0.22]}
          scale={[0.15, trace.kind === "tracks" ? 0.08 : 0.045, 1]}
        >
          <circleGeometry args={[1, 8]} />
          <meshStandardMaterial
            color="#241910"
            roughness={1}
            transparent
            opacity={trace.ageBand === "weathered" ? 0.34 : 0.64}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/** Saved cache/rest site with condition expressed through physical displacement. */
const ActivitySite3D: React.FC<{
  facts: OpeningThreatScene3DFacts;
  sampler?: GroundSampler | null;
}> = ({ facts, sampler }) => {
  const site = facts.context.activitySite;
  if (!site) return null;
  const disturbed = facts.siteCondition !== "occupied";

  return (
    <group
      position={worldPosition(site.position, sampler, 0.04)}
      rotation={[0, disturbed ? 0.45 : 0.08, 0]}
      name="opening-activity-site-3d"
    >
      {site.contents.includes("flattened-ground") && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          scale={[0.95, 0.65, 1]}
          receiveShadow
        >
          <circleGeometry args={[1, 12]} />
          <meshStandardMaterial
            color="#3c2e20"
            roughness={1}
            transparent
            opacity={0.58}
            depthWrite={false}
          />
        </mesh>
      )}
      {site.contents.includes("salvaged-container") && (
        <group
          position={disturbed ? [0.25, 0.18, -0.14] : [0.12, 0.2, 0.03]}
          rotation={[disturbed ? 0.22 : 0, 0.35, disturbed ? 0.3 : 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.56, 0.36, 0.42]} />
            <meshStandardMaterial color="#6e4930" roughness={0.88} />
          </mesh>
          <mesh
            position={[0, 0.2, disturbed ? -0.32 : 0]}
            rotation={[disturbed ? 0.85 : 0, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.58, 0.06, 0.44]} />
            <meshStandardMaterial color="#8b633c" roughness={0.9} />
          </mesh>
        </group>
      )}
      {site.contents.includes("torn-bedding") && (
        <group
          position={disturbed ? [-0.4, 0.05, 0.18] : [-0.3, 0.05, 0.12]}
          rotation={[0, disturbed ? -0.55 : -0.2, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.76, 0.07, 0.42]} />
            <meshStandardMaterial color="#6f4338" roughness={1} />
          </mesh>
          {disturbed && (
            <mesh
              position={[-0.45, 0.03, 0.12]}
              rotation={[0, 0.38, 0.12]}
              castShadow
            >
              <boxGeometry args={[0.36, 0.045, 0.24]} />
              <meshStandardMaterial color="#8a5b4c" roughness={1} />
            </mesh>
          )}
        </group>
      )}
      {site.contents.includes("gnawed-remains") && (
        <group
          position={disturbed ? [0.02, 0.08, 0.55] : [0.32, 0.08, 0.36]}
          rotation={[0, 0.6, 0]}
        >
          {[-0.14, 0.14].map((offset) => (
            <mesh
              key={offset}
              position={[offset, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.035, 0.035, 0.34, 7]} />
              <meshStandardMaterial color="#c9b98f" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

/** Static physical remains for one resolved source creature. */
const ResolvedBody3D: React.FC<{
  entity: BattleMapOpeningThreatEntity;
  sampler?: GroundSampler | null;
}> = ({ entity, sampler }) => {
  const bodyState = entity.bodyState;
  if (!bodyState) return null;
  const beast =
    bodyState.posture === "low-scout" || bodyState.posture === "scenting";
  const facing = Math.atan2(
    bodyState.facingDirection.z,
    bodyState.facingDirection.x,
  );

  return (
    <group
      position={worldPosition(entity.position, sampler, 0.06)}
      rotation={[0, -facing + (beast ? Math.PI / 2 : 0.28), 0]}
      scale={beast ? [1.12, 1.12, 1.12] : [1.22, 1.22, 1.22]}
      name={`opening-resolved-body-3d-${entity.monsterName.toLowerCase()}-${entity.entityId}`}
    >
      <mesh
        position={[0, 0.035, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.78, beast ? 0.42 : 0.5, 1]}
        receiveShadow
      >
        <circleGeometry args={[1, 12]} />
        <meshStandardMaterial
          color="#17140f"
          roughness={1}
          transparent
          opacity={0.58}
          depthWrite={false}
        />
      </mesh>
      {beast ? (
        <>
          {/* A wolf needs a long chest, muzzle, ears, four legs, and tail in
              silhouette. A single capsule made it indistinguishable from a
              dropped bedroll at tactical distance. */}
          <mesh
            position={[-0.06, 0.23, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.22, 0.64, 4, 9]} />
            <meshStandardMaterial color="#4d514b" roughness={0.96} />
          </mesh>
          <mesh position={[0.37, 0.25, 0]} scale={[1.22, 0.9, 0.9]} castShadow>
            <dodecahedronGeometry args={[0.21, 0]} />
            <meshStandardMaterial color="#424640" roughness={0.96} />
          </mesh>
          <mesh
            position={[0.58, 0.21, 0]}
            scale={[1.35, 0.72, 0.78]}
            castShadow
          >
            <dodecahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial color="#343934" roughness={1} />
          </mesh>
          {[-0.13, 0.13].map((side) => (
            <mesh
              key={side}
              position={[0.36, 0.43, side]}
              rotation={[0, 0, side < 0 ? -0.2 : 0.2]}
              castShadow
            >
              <coneGeometry args={[0.085, 0.27, 6]} />
              <meshStandardMaterial color="#353934" roughness={1} />
            </mesh>
          ))}
          {[
            [-0.3, -0.25, 0.95],
            [-0.24, 0.25, -0.95],
            [0.22, -0.26, 1.08],
            [0.27, 0.25, -1.08],
          ].map(([x, z, roll]) => (
            <mesh
              key={`${x}-${z}`}
              position={[x, 0.13, z]}
              rotation={[Math.PI / 2, 0, roll]}
              castShadow
            >
              <cylinderGeometry args={[0.045, 0.065, 0.46, 7]} />
              <meshStandardMaterial color="#3e433e" roughness={1} />
            </mesh>
          ))}
          <mesh
            position={[-0.5, 0.18, 0.08]}
            rotation={[0.15, 0.3, 1.18]}
            castShadow
          >
            <coneGeometry args={[0.065, 0.56, 7]} />
            <meshStandardMaterial color="#3a3f3a" roughness={1} />
          </mesh>
        </>
      ) : (
        <>
          {/* The goblin is a downed humanoid, not another green capsule: cloth
              torso, oversized head and ears, four splayed limbs, and a dropped
              salvage pack make species and prior role legible without a label. */}
          <mesh
            position={[-0.1, 0.2, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.2, 0.48, 4, 8]} />
            <meshStandardMaterial color="#713928" roughness={0.98} />
          </mesh>
          <mesh
            position={[0.46, 0.25, 0]}
            scale={[1.08, 0.96, 0.98]}
            castShadow
          >
            <dodecahedronGeometry args={[0.255, 0]} />
            <meshStandardMaterial color="#789b4d" roughness={0.98} />
          </mesh>
          {[-0.22, 0.22].map((side) => (
            <mesh
              key={side}
              position={[0.46, 0.27, side]}
              rotation={[side < 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}
              castShadow
            >
              <coneGeometry args={[0.12, 0.42, 6]} />
              <meshStandardMaterial color="#86a958" roughness={1} />
            </mesh>
          ))}
          {[
            [0, -0.37, 0.95],
            [0.04, 0.37, -0.95],
            [-0.42, -0.3, 1.15],
            [-0.38, 0.31, -1.15],
          ].map(([x, z, roll], index) => (
            <mesh
              key={`${x}-${z}`}
              position={[x, 0.13, z]}
              rotation={[Math.PI / 2, 0, roll]}
              castShadow
            >
              <cylinderGeometry
                args={[
                  index < 2 ? 0.045 : 0.055,
                  0.065,
                  index < 2 ? 0.5 : 0.56,
                  7,
                ]}
              />
              <meshStandardMaterial
                color={index < 2 ? "#687d48" : "#3c352a"}
                roughness={1}
              />
            </mesh>
          ))}
          {[-0.43, 0.43].map((side) => (
            <mesh key={side} position={[0.02, 0.125, side]} castShadow>
              <dodecahedronGeometry args={[0.085, 0]} />
              <meshStandardMaterial color="#789b4d" roughness={1} />
            </mesh>
          ))}
          {[-0.34, 0.34].map((side) => (
            <mesh key={side} position={[-0.48, 0.12, side]} castShadow>
              <dodecahedronGeometry args={[0.095, 0]} />
              <meshStandardMaterial color="#25241f" roughness={1} />
            </mesh>
          ))}
          {bodyState.carriedProfile === "salvage-pack" && (
            <group position={[-0.58, 0.15, 0.5]} rotation={[0.16, 0.28, -0.2]}>
              <mesh castShadow>
                <boxGeometry args={[0.38, 0.25, 0.22]} />
                <meshStandardMaterial color="#9b693a" roughness={0.94} />
              </mesh>
              <mesh position={[0, 0.03, 0.125]} castShadow>
                <boxGeometry args={[0.28, 0.045, 0.035]} />
                <meshStandardMaterial color="#3d2b20" roughness={1} />
              </mesh>
            </group>
          )}
          {bodyState.carriedProfile === "long-tool" && (
            <mesh
              position={[0, 0.12, -0.34]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.025, 0.025, 1.05, 7]} />
              <meshStandardMaterial color="#846540" roughness={1} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
};

/** Combat-authored churn rendered as separate local scars, never one mud decal. */
const CombatDisturbance3D: React.FC<{
  facts: OpeningThreatScene3DFacts;
  sampler?: GroundSampler | null;
}> = ({ facts, sampler }) => {
  const disturbance = facts.context.sceneResolution?.combatDisturbance;
  if (!disturbance) return null;
  const angle = -Math.atan2(disturbance.direction.y, disturbance.direction.x);
  const scale = disturbance.severity === "heavy" ? 1 : 0.72;
  const offsets: Array<[number, number, number, number]> = [
    [-0.58, -0.12, 0.64, 0.34],
    [0.02, 0.18, 0.78, 0.42],
    [0.58, -0.08, 0.58, 0.3],
  ];

  return (
    <group
      position={worldPosition(disturbance.position, sampler, 0.045)}
      rotation={[0, angle, 0]}
      name="opening-combat-disturbance-3d"
    >
      {offsets.map(([along, across, radiusX, radiusZ], index) => (
        <mesh
          key={along}
          position={[
            along * disturbance.extentCells.length * 0.44,
            0.006 * index,
            across * disturbance.extentCells.width,
          ]}
          rotation={[-Math.PI / 2, 0, index % 2 === 0 ? -0.2 : 0.17]}
          scale={[radiusX * scale, radiusZ * scale, 1]}
          receiveShadow
        >
          <circleGeometry args={[1, 9]} />
          <meshStandardMaterial
            color={index === 1 ? "#3b281c" : "#4a3322"}
            roughness={1}
            transparent
            opacity={0.56}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[-0.34, 0.28].map((offset, index) => (
        <mesh
          key={offset}
          position={[
            offset * disturbance.extentCells.length,
            0.03,
            index === 0 ? -0.22 : 0.24,
          ]}
          rotation={[-Math.PI / 2, 0, index === 0 ? -0.35 : 0.28]}
        >
          <planeGeometry args={[0.72, 0.035]} />
          <meshStandardMaterial
            color="#c19a66"
            roughness={1}
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/** Render all static opening-scene facts from one shared tactical read model. */
const OpeningThreatScene3D: React.FC<OpeningThreatScene3DProps> = ({
  mapData,
  groundSampler,
}) => {
  const facts = useMemo(
    () => selectOpeningThreatScene3DFacts(mapData),
    [mapData],
  );
  if (!facts) return null;

  return (
    <group name="opening-threat-scene-3d">
      {(facts.context.terrainImprints ?? []).map((imprint) => (
        <TerrainImprint3D
          key={imprint.id}
          imprint={imprint}
          sampler={groundSampler}
        />
      ))}
      {facts.context.ecologicalTraces.map((trace) => (
        <EcologicalTrace3D
          key={trace.id}
          trace={trace}
          sampler={groundSampler}
        />
      ))}
      <CombatDisturbance3D facts={facts} sampler={groundSampler} />
      <ActivitySite3D facts={facts} sampler={groundSampler} />
      {facts.resolvedBodies.map((entity) => (
        <ResolvedBody3D
          key={entity.entityId}
          entity={entity}
          sampler={groundSampler}
        />
      ))}
    </group>
  );
};

export default OpeningThreatScene3D;
