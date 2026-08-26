// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:55:04
 * Dependents: components/BattleMap/BattleMap.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from "react";
import { ArrowRight, Bone, Leaf, MapPinned, UsersRound } from "lucide-react";
import type {
  Ability,
  BattleMapData,
  CombatCharacter,
  LightSource,
  Position,
} from "../../types/combat";
import { TILE_SIZE_PX } from "../../config/mapConfig";
import BattleMapOverlay from "./BattleMapOverlay";
import type { SpellMapArtifacts } from "./spellMapArtifacts";

/**
 * This component renders environmental, tactical, and evidentiary overlays on the battle map.
 *
 * It combines source-backed encounter imprints (tracks, combat disturbance churn, monster activity
 * sites, gatehouse/ford direction anchors, resident cluster markers), object fact review indicators,
 * and magical spell overlays (AoE templates, range cones, spell zones, teleport destinations, and damage numbers).
 *
 * Called by: BattleMap.tsx
 * Depends on: BattleMapOverlay.tsx for animated spell visuals and damage counters.
 */

export interface WorldOccupantGroup {
  position: Position;
  occupants: NonNullable<BattleMapData["worldOccupants"]>;
}

export interface OpeningTrackMark {
  x: number;
  y: number;
  rotation: number;
  side: number;
}

export interface EncounterMarkerData {
  label: string;
  className: string;
}

export interface BattleMapOverlaysProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  boardScale: number;
  showTargetableObjectFacts?: boolean;
  showWorldOccupants?: boolean;
  worldOccupantGroups: WorldOccupantGroup[];
  openingTrackMarks: OpeningTrackMark[];
  encounterMarker: EncounterMarkerData | null;
  encounterDirection: Position | null;
  damageNumbers?: any[];
  animations?: any[];
  spellZones?: any[];
  scheduledSpellEffects?: any[];
  movementDebuffs?: any[];
  activeLightSources?: LightSource[];
  showLightSourceMarkers?: boolean;
  lineOfSightOverlayVisible?: boolean;
  currentCharacterId?: string | null;
  spellMovementVisuals?: any[];
  spellDeliveryVisuals?: any[];
  spellMapArtifacts?: SpellMapArtifacts;
  /** Live AoE template from the targeting system: the tiles the chosen ability
   *  would cover, plus the ability itself for the label. This is the OBJECT
   *  BattleMapOverlay actually reads (.affectedTiles / .ability) and the one
   *  BattleMap has always passed straight from abilitySystem — the former
   *  `Position[] | null` here was a wrong declaration over correct runtime
   *  data, and it forced a cast at the layers/BattleMapMarkerLayer seam
   *  (agora-db71.3). */
  aoePreview?: {
    center: { x: number; y: number };
    affectedTiles: { x: number; y: number }[];
    ability: Ability;
  } | null;
  /** Active teleport destination-pick state; names which creature the blue
   *  destination tiles belong to. Same object shape BattleMapOverlay reads. */
  teleportDestinationPreview?: {
    targetId: string;
    affectedTiles: { x: number; y: number }[];
    ability: Ability;
  } | null;
  assignedTeleportDestinations?: Array<{
    targetId: string;
    targetName: string;
    destination: Position;
    abilityName: string;
  }>;
}

export const BattleMapOverlays: React.FC<BattleMapOverlaysProps> = ({
  mapData,
  characters,
  boardScale,
  showTargetableObjectFacts = false,
  showWorldOccupants = true,
  worldOccupantGroups,
  openingTrackMarks,
  encounterMarker,
  encounterDirection,
  damageNumbers = [],
  animations = [],
  spellZones = [],
  scheduledSpellEffects = [],
  movementDebuffs = [],
  activeLightSources = [],
  showLightSourceMarkers = true,
  lineOfSightOverlayVisible = false,
  currentCharacterId = null,
  spellMovementVisuals = [],
  spellDeliveryVisuals = [],
  spellMapArtifacts,
  aoePreview = null,
  teleportDestinationPreview = null,
  assignedTeleportDestinations = [],
}) => {
  return (
    <>
      {/* ==================================================================== */}
      {/* Targetable Object Facts Harness Layer                                */}
      {/* ==================================================================== */}
      {/* Visual harness identifying source-backed catalog props and features */}
      {showTargetableObjectFacts &&
        (mapData.targetableObjects ?? []).map((targetObject) => {
          const sourceKind = targetObject.source?.kind;
          const isProp = sourceKind === "worldforge-prop";
          return (
            <div
              key={`targetable-object-fact-${targetObject.id}`}
              data-testid="targetable-object-fact-marker"
              data-source-kind={sourceKind ?? "unclassified"}
              title={`Target fact: ${targetObject.name}`}
              className={`pointer-events-none absolute z-[8] h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 shadow-[0_0_7px_rgba(0,0,0,0.85)] ${
                isProp
                  ? "rotate-45 rounded-sm border-amber-300 bg-amber-500/10"
                  : "rounded-full border-cyan-300 bg-cyan-500/10"
              }`}
              style={{
                left:
                  targetObject.position.x * TILE_SIZE_PX +
                  TILE_SIZE_PX / 2,
                top:
                  targetObject.position.y * TILE_SIZE_PX +
                  TILE_SIZE_PX / 2,
              }}
            >
              <span
                className={`absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  isProp ? "bg-amber-100" : "bg-cyan-100"
                }`}
              />
            </div>
          );
        })}

      {/* ==================================================================== */}
      {/* World Residents & Ambient Occupants                                  */}
      {/* ==================================================================== */}
      {showWorldOccupants &&
        worldOccupantGroups.map((group) => {
          const movingCount = group.occupants.filter(
            (occupant) => occupant.moving,
          ).length;
          const names = group.occupants.map((occupant) => occupant.name);
          const summary =
            names.length > 3
              ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
              : names.join(", ");
          return (
            <div
              key={`world-occupants-${group.position.x}-${group.position.y}`}
              data-testid="world-occupant-marker"
              data-occupant-count={group.occupants.length}
              data-moving-count={movingCount}
              aria-label={`${group.occupants.length} source resident${group.occupants.length === 1 ? "" : "s"}: ${summary}`}
              title={summary}
              className={`pointer-events-none absolute z-[12] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-violet-950/90 text-violet-100 shadow-[0_0_8px_rgba(0,0,0,0.95)] ${
                movingCount > 0
                  ? "border-fuchsia-300 ring-1 ring-fuchsia-300/60"
                  : "border-violet-300"
              }`}
              style={{
                left: group.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                top: group.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
              }}
            >
              <UsersRound size={11} strokeWidth={2.5} aria-hidden="true" />
              {group.occupants.length > 1 && (
                <span className="absolute -right-1.5 -top-1.5 flex min-h-3 min-w-3 items-center justify-center rounded-full border border-violet-100 bg-violet-500 px-0.5 text-[7px] font-black leading-none text-white">
                  {group.occupants.length}
                </span>
              )}
            </div>
          );
        })}

      {/* ==================================================================== */}
      {/* Authored Opening Standoff Imprints & Disturbance                     */}
      {/* ==================================================================== */}
      {mapData.encounterContext?.kind === "opening-standoff" &&
        mapData.encounterContext.terrainImprints?.length && (
          <svg
            data-testid="opening-terrain-imprints"
            className="pointer-events-none absolute left-0 top-0 z-[9] overflow-visible"
            width={mapData.dimensions.width * TILE_SIZE_PX}
            height={mapData.dimensions.height * TILE_SIZE_PX}
            aria-label="Source-authored monster occupation imprints"
          >
            {mapData.encounterContext.terrainImprints.map((imprint) => {
              const start = {
                x: imprint.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                y: imprint.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
              };
              const end = {
                x: imprint.endPosition.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                y: imprint.endPosition.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
              };
              const rotation =
                Math.atan2(imprint.direction.y, imprint.direction.x) *
                (180 / Math.PI);
              const halfLength =
                (imprint.extentCells.length * TILE_SIZE_PX) / 2;
              const halfWidth =
                (imprint.extentCells.width * TILE_SIZE_PX) / 2;
              const tangent = {
                x: -imprint.direction.y,
                y: imprint.direction.x,
              };
              const furrowOffset =
                imprint.extentCells.width * TILE_SIZE_PX * 0.22;
              const routeMidpoint = {
                x:
                  (start.x + end.x) / 2 +
                  tangent.x * TILE_SIZE_PX * 0.4,
                y:
                  (start.y + end.y) / 2 +
                  tangent.y * TILE_SIZE_PX * 0.4,
              };
              return (
                <g
                  key={imprint.id}
                  data-testid="opening-terrain-imprint"
                  data-imprint-kind={imprint.kind}
                  data-imprint-age={imprint.ageBand}
                  aria-label={imprint.label}
                >
                  <title>{imprint.label}</title>
                  {imprint.kind === "flattened-ground" && (
                    <g
                      transform={`translate(${start.x} ${start.y}) rotate(${rotation})`}
                    >
                      <path
                        d={`M ${-halfLength * 0.94} ${-halfWidth * 0.18} Q ${-halfLength * 0.62} ${-halfWidth * 0.92} 0 ${-halfWidth * 0.78} Q ${halfLength * 0.82} ${-halfWidth * 0.7} ${halfLength * 0.96} ${halfWidth * 0.08} Q ${halfLength * 0.68} ${halfWidth * 0.88} ${-halfLength * 0.08} ${halfWidth * 0.74} Q ${-halfLength * 0.82} ${halfWidth * 0.66} ${-halfLength * 0.94} ${-halfWidth * 0.18} Z`}
                        fill="rgba(91, 70, 43, 0.38)"
                        stroke="rgba(170, 132, 79, 0.28)"
                        strokeWidth="1.2"
                      />
                      <path
                        d={`M ${-halfLength * 0.7} ${-halfWidth * 0.26} Q 0 ${-halfWidth * 0.58} ${halfLength * 0.72} ${-halfWidth * 0.12} M ${-halfLength * 0.6} ${halfWidth * 0.28} Q 0 ${halfWidth * 0.52} ${halfLength * 0.65} ${halfWidth * 0.18}`}
                        fill="none"
                        stroke="rgba(190, 145, 83, 0.27)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      {[
                        [-0.7, -0.38, 5, 2, -18],
                        [-0.42, 0.42, 4, 1.8, 22],
                        [-0.08, -0.48, 5.5, 2.2, 8],
                        [0.28, 0.38, 4.5, 1.8, -12],
                        [0.62, -0.3, 5, 2, 28],
                        [0.75, 0.25, 3.8, 1.6, -30],
                      ].map(
                        (
                          [
                            xFactor,
                            yFactor,
                            radiusX,
                            radiusY,
                            leafRotation,
                          ],
                          index,
                        ) => (
                          <ellipse
                            key={`${imprint.id}:leaf-litter:${index}`}
                            cx={halfLength * xFactor}
                            cy={halfWidth * yFactor}
                            rx={radiusX}
                            ry={radiusY}
                            transform={`rotate(${leafRotation} ${halfLength * xFactor} ${halfWidth * yFactor})`}
                            fill={
                              index % 2 === 0
                                ? "rgba(150, 111, 61, 0.55)"
                                : "rgba(104, 82, 47, 0.62)"
                            }
                          />
                        ),
                      )}
                    </g>
                  )}
                  {imprint.kind === "trampled-run" && (
                    <>
                      <path
                        d={`M ${start.x} ${start.y} Q ${routeMidpoint.x} ${routeMidpoint.y} ${end.x} ${end.y}`}
                        fill="none"
                        stroke="rgba(91, 66, 38, 0.38)"
                        strokeWidth={Math.max(
                          8,
                          imprint.extentCells.width *
                            TILE_SIZE_PX *
                            0.66,
                        )}
                        strokeLinecap="round"
                      />
                      <path
                        d={`M ${start.x} ${start.y} Q ${routeMidpoint.x} ${routeMidpoint.y} ${end.x} ${end.y}`}
                        fill="none"
                        stroke="rgba(170, 126, 70, 0.24)"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {imprint.kind === "drag-furrow" && (
                    <>
                      {[-1, 1].map((side) => (
                        <path
                          key={`${imprint.id}:furrow:${side}`}
                          d={`M ${start.x + tangent.x * furrowOffset * side} ${start.y + tangent.y * furrowOffset * side} Q ${routeMidpoint.x + tangent.x * furrowOffset * side * 0.7} ${routeMidpoint.y + tangent.y * furrowOffset * side * 0.7} ${end.x + tangent.x * furrowOffset * side} ${end.y + tangent.y * furrowOffset * side}`}
                          fill="none"
                          stroke="rgba(89, 59, 31, 0.68)"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                        />
                      ))}
                      <path
                        d={`M ${start.x} ${start.y} Q ${routeMidpoint.x} ${routeMidpoint.y} ${end.x} ${end.y}`}
                        fill="none"
                        stroke="rgba(171, 128, 75, 0.24)"
                        strokeWidth={1.2}
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {imprint.kind === "refuse-scatter" && (
                    <g
                      transform={`translate(${start.x} ${start.y}) rotate(${rotation})`}
                    >
                      <path
                        d="M -13 -5 l 7 -3 l 2 5 l -7 3 Z"
                        fill="#80603b"
                        stroke="#2a1d13"
                        strokeWidth="1"
                      />
                      <path
                        d="M 4 -9 l 9 3 l -2 4 l -8 -2 Z"
                        fill="#5f472f"
                        stroke="#241911"
                        strokeWidth="1"
                      />
                      <path
                        d="M -4 5 l 10 -1 l 1 3 l -9 2 Z"
                        fill="#a17a48"
                        stroke="#2c1e13"
                        strokeWidth="1"
                      />
                      <circle
                        cx="13"
                        cy="7"
                        r="2.7"
                        fill="#d0b27d"
                        stroke="#35271b"
                        strokeWidth="1"
                      />
                      <circle
                        cx="-15"
                        cy="8"
                        r="2"
                        fill="#b99865"
                        stroke="#35271b"
                        strokeWidth="1"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}

      {/* Combat disturbance churn from resolved standoff encounters */}
      {mapData.encounterContext?.kind === "opening-standoff" &&
        mapData.encounterContext.sceneResolution &&
        (() => {
          const disturbance =
            mapData.encounterContext.sceneResolution.combatDisturbance;
          const center = {
            x: disturbance.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            y: disturbance.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
          };
          const halfLength =
            (disturbance.extentCells.length * TILE_SIZE_PX) / 2;
          const halfWidth =
            (disturbance.extentCells.width * TILE_SIZE_PX) / 2;
          const rotation =
            Math.atan2(
              disturbance.direction.y,
              disturbance.direction.x,
            ) *
            (180 / Math.PI);
          return (
            <svg
              data-testid="opening-combat-disturbance"
              data-disturbance-severity={disturbance.severity}
              className="pointer-events-none absolute left-0 top-0 z-[10] overflow-visible"
              width={mapData.dimensions.width * TILE_SIZE_PX}
              height={mapData.dimensions.height * TILE_SIZE_PX}
              aria-label="Source-authored combat disturbance"
            >
              <g
                transform={`translate(${center.x} ${center.y}) rotate(${rotation})`}
              >
                <path
                  d={`M ${-halfLength} ${-halfWidth * 0.12} Q ${-halfLength * 0.66} ${-halfWidth * 0.9} ${-halfLength * 0.12} ${-halfWidth * 0.7} Q ${halfLength * 0.5} ${-halfWidth} ${halfLength} ${-halfWidth * 0.16} Q ${halfLength * 0.72} ${halfWidth * 0.78} ${halfLength * 0.08} ${halfWidth * 0.66} Q ${-halfLength * 0.58} ${halfWidth} ${-halfLength} ${-halfWidth * 0.12} Z`}
                  fill="rgba(65, 43, 30, 0.1)"
                  stroke="rgba(185, 132, 79, 0.2)"
                  strokeWidth="0.8"
                />
                {[
                  { along: -0.58, across: -0.18, scale: 0.32 },
                  { along: -0.08, across: 0.22, scale: 0.38 },
                  { along: 0.52, across: -0.12, scale: 0.3 },
                ].map((patch, index) => {
                  const patchLength = halfLength * patch.scale;
                  const patchWidth =
                    halfWidth * (0.52 + (index % 2) * 0.16);
                  return (
                    <g
                      key={`combat-churn-patch-${index}`}
                      transform={`translate(${halfLength * patch.along} ${halfWidth * patch.across}) rotate(${index === 1 ? 12 : index === 2 ? -9 : -18})`}
                    >
                      <path
                        d={`M ${-patchLength} ${-patchWidth * 0.1} Q ${-patchLength * 0.48} ${-patchWidth} ${patchLength * 0.12} ${-patchWidth * 0.68} Q ${patchLength} ${-patchWidth * 0.42} ${patchLength * 0.82} ${patchWidth * 0.42} Q ${patchLength * 0.18} ${patchWidth} ${-patchLength * 0.72} ${patchWidth * 0.62} Z`}
                        fill={
                          disturbance.severity === "heavy"
                            ? "rgba(66, 40, 28, 0.55)"
                            : "rgba(76, 53, 35, 0.42)"
                        }
                        stroke="rgba(176, 126, 75, 0.28)"
                        strokeWidth="0.8"
                      />
                      <path
                        d={`M ${-patchLength * 0.7} ${patchWidth * 0.18} Q 0 ${-patchWidth * 0.46} ${patchLength * 0.68} ${patchWidth * 0.08}`}
                        fill="none"
                        stroke="rgba(207, 160, 101, 0.32)"
                        strokeLinecap="round"
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}
                <path
                  d={`M ${-halfLength * 0.82} ${-halfWidth * 0.24} Q ${-halfLength * 0.22} ${halfWidth * 0.42} ${halfLength * 0.72} ${-halfWidth * 0.3} M ${-halfLength * 0.58} ${halfWidth * 0.44} Q 0 ${-halfWidth * 0.42} ${halfLength * 0.84} ${halfWidth * 0.22}`}
                  fill="none"
                  stroke="rgba(211, 169, 111, 0.28)"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
                {[-0.72, -0.28, 0.18, 0.62].map((offset, index) => (
                  <ellipse
                    key={`combat-churn-scuff-${index}`}
                    cx={halfLength * offset}
                    cy={
                      (index % 2 === 0 ? -1 : 1) * halfWidth * 0.38
                    }
                    rx={4.5 + (index % 2) * 1.5}
                    ry={2.2}
                    fill="rgba(42, 28, 20, 0.72)"
                    transform={`rotate(${index % 2 === 0 ? -18 : 24} ${halfLength * offset} ${(index % 2 === 0 ? -1 : 1) * halfWidth * 0.38})`}
                  />
                ))}
              </g>
            </svg>
          );
        })()}

      {/* Opening activity site (bedding, cache, remains) */}
      {mapData.encounterContext?.kind === "opening-standoff" &&
        mapData.encounterContext.activitySite &&
        (() => {
          const site = mapData.encounterContext.activitySite;
          const siteCondition =
            mapData.encounterContext.sceneResolution?.activitySiteCondition;
          const abandoned = siteCondition === "abandoned-disturbed";
          const hasRemains = site.contents.includes("gnawed-remains");
          return (
            <div
              key={site.id}
              data-testid="opening-monster-site"
              data-site-kind={site.kind}
              data-site-age={site.ageBand}
              data-site-condition={siteCondition ?? "occupied"}
              aria-label={`${site.label}; ${siteCondition ?? "occupied"} WorldForge activity site`}
              title={site.label}
              className="pointer-events-none absolute z-[11] h-10 w-11"
              style={{
                left: site.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                top: site.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                transform: `translate(-50%, -50%) scale(${1 / Math.max(boardScale, 0.65)})`,
                transformOrigin: "center",
              }}
            >
              {site.kind === "claimed-cache" ? (
                <>
                  <span
                    className={`absolute bottom-0 left-0.5 h-6 w-10 bg-[#777b68]/90 shadow-[0_3px_5px_rgba(0,0,0,0.9)] ${abandoned ? "rotate-[14deg] -translate-x-1" : "-rotate-6"}`}
                    style={{
                      clipPath:
                        "polygon(5% 22%, 73% 5%, 100% 31%, 88% 90%, 27% 100%, 0 70%)",
                    }}
                  />
                  <span
                    className={`absolute bottom-2 left-1 h-2.5 w-4 rounded-full border border-stone-900 bg-emerald-950 shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${abandoned ? "-translate-x-2 rotate-[26deg]" : "-rotate-12"}`}
                  >
                    <span className="absolute right-0 top-0 h-full w-1 rounded-full bg-stone-500/80" />
                  </span>
                  <span
                    className={`absolute bottom-2 left-4 h-4 w-6 border border-stone-950 bg-[#875835] shadow-[0_2px_3px_rgba(0,0,0,0.9)] ${abandoned ? "translate-x-1 rotate-[24deg]" : "rotate-3"}`}
                  >
                    <span className="absolute left-1/3 top-0 h-full w-px bg-amber-200/35" />
                    <span className="absolute right-1/3 top-0 h-full w-px bg-amber-200/35" />
                    <span className="absolute left-0 top-1/2 h-px w-full bg-stone-950/70" />
                  </span>
                  <span
                    className={`absolute bottom-[1.35rem] left-[0.95rem] h-1.5 w-6 border border-stone-950 bg-[#8a5b35] shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${abandoned ? "-translate-y-2 translate-x-2 rotate-[38deg]" : "-rotate-6"}`}
                  />
                </>
              ) : site.kind === "feeding-site" ? (
                <>
                  <span className="absolute bottom-1 left-1 h-7 w-9 -rotate-6 rounded-[45%] bg-red-950/45 shadow-[inset_0_0_8px_rgba(0,0,0,0.85)]" />
                  <Bone
                    className="absolute bottom-2 left-2 -rotate-[28deg] text-stone-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                    size={20}
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  <Bone
                    className="absolute bottom-1 right-1 rotate-[32deg] text-stone-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                    size={17}
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </>
              ) : (
                <>
                  <span className="absolute bottom-1 left-1 h-8 w-9 -rotate-6 rounded-[48%] border border-emerald-950/80 bg-emerald-950/45 shadow-[inset_0_0_8px_rgba(0,0,0,0.9)]" />
                  <Leaf
                    className="absolute bottom-2 left-2 -rotate-[28deg] text-emerald-200/85 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                    size={20}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <Leaf
                    className="absolute bottom-1 right-1 rotate-[35deg] text-lime-200/70 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </>
              )}
              {hasRemains && site.kind !== "feeding-site" && (
                <Bone
                  className="absolute -right-0.5 bottom-0.5 rotate-[24deg] text-stone-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                  size={16}
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              )}
              {abandoned && (
                <>
                  <span className="absolute -bottom-0.5 -left-1 h-px w-5 rotate-[28deg] bg-amber-200/65 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                  <span className="absolute -right-1 bottom-1 h-1.5 w-2.5 -rotate-[18deg] bg-[#6e4b2d] shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                  <span className="absolute right-1 top-0 h-1 w-2 rotate-[34deg] bg-stone-400/80 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                </>
              )}
            </div>
          );
        })()}

      {/* ==================================================================== */}
      {/* Track Trails and Ecological Traces                                   */}
      {/* ==================================================================== */}
      {openingTrackMarks.length > 0 && (
        <svg
          data-testid="opening-track-trail"
          className="pointer-events-none absolute left-0 top-0 z-[12] overflow-visible"
          width={mapData.dimensions.width * TILE_SIZE_PX}
          height={mapData.dimensions.height * TILE_SIZE_PX}
          aria-hidden="true"
        >
          {openingTrackMarks.map((mark, index) => (
            <g
              key={`opening-track-mark-${index}`}
              transform={`translate(${mark.x * TILE_SIZE_PX + TILE_SIZE_PX / 2} ${mark.y * TILE_SIZE_PX + TILE_SIZE_PX / 2}) rotate(${mark.rotation})`}
            >
              <ellipse
                cx={mark.side * 2.4}
                cy="-2.5"
                rx="2.1"
                ry="3.9"
                fill="rgba(148, 107, 59, 0.88)"
                stroke="rgba(38,25,15,0.72)"
                strokeWidth="0.7"
              />
              <ellipse
                cx={mark.side * -2}
                cy="4"
                rx="1.9"
                ry="3.5"
                fill="rgba(126, 87, 46, 0.88)"
                stroke="rgba(38,25,15,0.72)"
                strokeWidth="0.7"
              />
            </g>
          ))}
        </svg>
      )}

      {mapData.encounterContext?.kind === "opening-standoff" &&
        mapData.encounterContext.ecologicalTraces.map((trace) => {
          const isTrack = trace.kind === "tracks";
          const isScrape =
            trace.kind === "scent-mark" ||
            trace.kind === "territorial-scrape";
          return (
            <div
              key={trace.id}
              data-testid="opening-ecological-trace"
              data-trace-kind={trace.kind}
              data-trace-age={trace.ageBand ?? "unknown"}
              aria-label={trace.label}
              title={trace.label}
              className={`pointer-events-none absolute z-[13] h-6 w-6 ${
                trace.ageBand === "weathered"
                  ? "opacity-55"
                  : trace.ageBand === "recent"
                    ? "opacity-80"
                    : "opacity-100"
              }`}
              style={{
                left: trace.position.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                top: trace.position.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
                transform: `translate(-50%, -50%) scale(${1 / Math.max(boardScale, 0.65)})`,
              }}
            >
              {isTrack ? (
                <>
                  <span className="absolute left-[6px] top-[3px] h-2.5 w-1.5 -rotate-12 rounded-[55%] bg-[#2c1c11] shadow-[0_1px_1px_rgba(205,160,93,0.25)]" />
                  <span className="absolute bottom-[3px] right-[6px] h-2.5 w-1.5 rotate-12 rounded-[55%] bg-[#3c2818] shadow-[0_1px_1px_rgba(205,160,93,0.22)]" />
                </>
              ) : isScrape ? (
                <>
                  <span className="absolute left-1 top-1 h-px w-4 rotate-[18deg] bg-[#c09254]/70 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                  <span className="absolute left-1 top-2.5 h-px w-4 rotate-[12deg] bg-[#9e7040]/75 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                  <span className="absolute left-1 top-4 h-px w-3.5 rotate-[7deg] bg-[#79502c]/80 shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                  <span className="absolute bottom-0.5 right-1 h-1.5 w-3 rounded-[50%] bg-[#402818]/75" />
                </>
              ) : (
                <>
                  <span className="absolute left-2 top-0 h-5 w-0.5 rotate-[38deg] bg-[#4f3822] shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                  <span className="absolute right-2 top-1 h-5 w-0.5 -rotate-[32deg] bg-[#72502d] shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
                  <span className="absolute bottom-1 left-0.5 h-1.5 w-2.5 -rotate-12 rounded-[60%] bg-[#5d713b]/80" />
                  <span className="absolute right-0.5 top-1 h-1.5 w-2 rotate-12 rounded-[60%] bg-[#7d8b49]/70" />
                </>
              )}
            </div>
          );
        })}

      {/* ==================================================================== */}
      {/* Encounter Source Anchor Indicator                                    */}
      {/* ==================================================================== */}
      {encounterMarker && mapData.encounterContext && (
        <div
          data-testid="encounter-source-anchor"
          aria-label={
            mapData.encounterContext.kind === "opening-standoff"
              ? `${encounterMarker.label}; marks the party's exact source-world position; arrow points toward the source-authored threat approach`
              : `${encounterMarker.label}; arrow points from the exterior or near side toward the interior or far side`
          }
          className="pointer-events-none absolute z-[16]"
          style={{
            left:
              mapData.encounterContext.anchorTile.x * TILE_SIZE_PX +
              TILE_SIZE_PX / 2,
            top:
              mapData.encounterContext.anchorTile.y * TILE_SIZE_PX +
              TILE_SIZE_PX / 2,
            transform: `translate(-50%, ${
              mapData.encounterContext.kind === "opening-standoff" ||
              mapData.encounterContext.kind === "settlement-watch" ||
              mapData.encounterContext.kind === "settlement-state-patrol"
                ? "-220%"
                : "-120%"
            }) scale(${1 / Math.max(boardScale, 0.01)})`,
            transformOrigin: "center",
          }}
        >
          <div
            className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-[0_0_12px_rgba(0,0,0,0.9)] ${encounterMarker.className}`}
          >
            <MapPinned size={15} strokeWidth={2.5} aria-hidden="true" />
            {encounterDirection && (
              <ArrowRight
                size={13}
                strokeWidth={3}
                aria-hidden="true"
                className="absolute -right-4 top-1.5"
                style={{
                  transform: `rotate(${Math.atan2(
                    encounterDirection.y,
                    encounterDirection.x,
                  )}rad)`,
                  transformOrigin: "center",
                }}
              />
            )}
            <span
              className={`absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${encounterMarker.className}`}
            >
              {encounterMarker.label}
            </span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Battle Map Spell & VFX Layer                                         */}
      {/* ==================================================================== */}
      <BattleMapOverlay
        mapData={mapData}
        characters={characters}
        damageNumbers={damageNumbers}
        animations={animations}
        spellZones={spellZones}
        scheduledSpellEffects={scheduledSpellEffects}
        movementDebuffs={movementDebuffs}
        activeLightSources={activeLightSources}
        showLightSourceMarkers={showLightSourceMarkers}
        showLineOfSightCone={lineOfSightOverlayVisible}
        lineOfSightOriginCharacterId={currentCharacterId}
        spellMovementVisuals={spellMovementVisuals}
        spellDeliveryVisuals={spellDeliveryVisuals}
        spellMapArtifacts={spellMapArtifacts}
        aoePreview={aoePreview}
        teleportDestinationPreview={teleportDestinationPreview}
        assignedTeleportDestinations={assignedTeleportDestinations}
      />
    </>
  );
};

export default BattleMapOverlays;
