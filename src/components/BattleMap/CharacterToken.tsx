// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:58:06
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CharacterToken.tsx
 * Component to display a character's token on the battle map.
 *
 * CURRENT FUNCTIONALITY:
 * - Renders character tokens with team-based coloring
 * - Displays status effects as badge overlays
 * - Shows compact resistance / vulnerability / immunity badges with tooltips
 * - Shows concentration indicator for spellcasters
 * - Implements selection and targeting states
 * - Uses React.memo for basic render optimization
 *
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM elements for each token (could batch with canvas)
 * - Status effect badges recreated for every render
 * - No level-of-detail scaling based on distance from camera
 * - CSS transforms recalculated even for static positions
 * - Tooltip creation overhead for every token
 */
import React, { useMemo } from "react";
import type {
  CombatCharacter,
  OpeningThreatBodyPosture,
  Position,
  WorldforgeOpeningThreatSource,
} from "../../types/combat";
import { TILE_SIZE_PX } from "../../config/mapConfig";
import Tooltip from "../Tooltip";
import {
  getStatusEffectIcon,
  getCharacterSizeMultiplier,
} from "../../utils/combatUtils";
import { Z_INDEX } from "../../styles/zIndex";
import { getCreatureTokenVisual } from "../../utils/visuals/combatIconVisuals";

interface CharacterTokenProps {
  character: CombatCharacter;
  position: { x: number; y: number };
  isSelected: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  isTurn: boolean;
  onCharacterClick: (char: CombatCharacter) => void;
}

type DefenseBadgeKind = "resistance" | "vulnerability" | "immunity";

interface DefenseBadgeConfig {
  kind: DefenseBadgeKind;
  label: string;
  tooltip: string;
  positionClass: string;
  toneClass: string;
}

const formatDefenseTooltip = (
  title: string,
  primary?: string[],
  secondary?: string[],
) => {
  const segments: string[] = [];

  if (primary?.length) {
    segments.push(`${title}: ${primary.join(", ")}`);
  }

  if (secondary?.length) {
    segments.push(
      `Non-magical ${title.toLowerCase()}: ${secondary.join(", ")}`,
    );
  }

  return segments.join(" | ");
};

const buildDefenseBadges = (
  character: CombatCharacter,
): DefenseBadgeConfig[] => {
  const badges: DefenseBadgeConfig[] = [];

  const resistanceTooltip = formatDefenseTooltip(
    "Resistance",
    character.resistances,
    character.nonMagicalResistances,
  );
  if (resistanceTooltip) {
    badges.push({
      kind: "resistance",
      label: "R",
      tooltip: resistanceTooltip,
      // The badges stay on the token perimeter so the center icon, status row,
      // and concentration marker keep their current spacing.
      positionClass: "left-0 top-0",
      toneClass:
        "border-emerald-200/70 bg-emerald-950/90 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.24)]",
    });
  }

  const vulnerabilityTooltip = formatDefenseTooltip(
    "Vulnerability",
    character.vulnerabilities,
  );
  if (vulnerabilityTooltip) {
    badges.push({
      kind: "vulnerability",
      label: "V",
      tooltip: vulnerabilityTooltip,
      positionClass: "left-0 top-1/2 -translate-y-1/2",
      toneClass:
        "border-rose-200/70 bg-rose-950/90 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.24)]",
    });
  }

  const immunityTooltip = formatDefenseTooltip(
    "Immunity",
    character.immunities,
    character.nonMagicalImmunities,
  );
  if (immunityTooltip) {
    badges.push({
      kind: "immunity",
      label: "I",
      tooltip: immunityTooltip,
      positionClass: "left-0 bottom-0",
      toneClass:
        "border-sky-200/70 bg-sky-950/90 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.24)]",
    });
  }

  return badges;
};

const DefenseBadge: React.FC<DefenseBadgeConfig> = ({
  kind,
  label,
  tooltip,
  positionClass,
  toneClass,
}) => (
  <Tooltip content={tooltip}>
    <span
      data-testid={`defense-badge-${kind}`}
      className={`absolute flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[6px] font-black uppercase leading-none tracking-tight ${positionClass} ${toneClass}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
      aria-label={tooltip}
    >
      {label}
    </span>
  </Tooltip>
);

const LEGACY_OPENING_ROLE_PRESENTATIONS = {
  "contact-lead": {
    tokenRadius: "44% 44% 52% 52%",
    portraitTransform: "scale(1.14) translateY(-2%)",
  },
  "screen-left": {
    tokenRadius: "58% 42% 52% 48%",
    portraitTransform: "scale(1.18) translateX(-5%) rotate(-8deg)",
  },
  "screen-right": {
    tokenRadius: "42% 58% 48% 52%",
    portraitTransform: "scale(1.18) translateX(5%) rotate(8deg)",
  },
  "escape-guard": {
    tokenRadius: "40% 40% 50% 50%",
    portraitTransform: "scale(1.08) translateY(3%)",
  },
  "pack-scout": {
    tokenRadius: "54% 46% 58% 42%",
    portraitTransform: "scale(1.12) translate(-3%, 5%) rotate(-5deg)",
  },
  "scent-flanker": {
    tokenRadius: "50% 46% 58% 42%",
    portraitTransform: "scale(1.2) translate(4%, 7%) rotate(6deg)",
  },
} as const;

const OPENING_ROLE_LABELS = {
  "contact-lead": "Contact lead",
  "screen-left": "Left screen",
  "screen-right": "Right screen",
  "escape-guard": "Escape guard",
  "pack-scout": "Pack scout",
  "scent-flanker": "Scent flanker",
} as const;

interface BodyGeometry {
  torso: React.CSSProperties;
  head: React.CSSProperties;
  leftLeg: React.CSSProperties;
  rightLeg: React.CSSProperties;
}

type HumanoidOpeningPosture = Exclude<
  OpeningThreatBodyPosture,
  "low-scout" | "scenting"
>;

/**
 * Deliberately asymmetric top-down geometry. The head portrait is now a small
 * identity detail on a body, rather than the entire creature. Posture controls
 * occupied shape while carried equipment produces readable same-species edges.
 */
const HUMANOID_BODY_GEOMETRY: Record<HumanoidOpeningPosture, BodyGeometry> = {
  upright: {
    torso: {
      left: 13,
      top: 14,
      width: 18,
      height: 22,
      borderRadius: "46% 46% 34% 34%",
    },
    head: { left: 13, top: 3, width: 18, height: 18 },
    leftLeg: {
      left: 14,
      top: 32,
      width: 6,
      height: 10,
      transform: "rotate(7deg)",
    },
    rightLeg: {
      left: 24,
      top: 32,
      width: 6,
      height: 10,
      transform: "rotate(-7deg)",
    },
  },
  "crouched-left": {
    torso: {
      left: 10,
      top: 16,
      width: 22,
      height: 18,
      borderRadius: "56% 38% 38% 48%",
      transform: "rotate(-11deg)",
    },
    head: { left: 8, top: 6, width: 17, height: 17 },
    leftLeg: {
      left: 9,
      top: 29,
      width: 7,
      height: 12,
      transform: "rotate(28deg)",
    },
    rightLeg: {
      left: 25,
      top: 29,
      width: 7,
      height: 10,
      transform: "rotate(-19deg)",
    },
  },
  "crouched-right": {
    torso: {
      left: 12,
      top: 16,
      width: 22,
      height: 18,
      borderRadius: "38% 56% 48% 38%",
      transform: "rotate(11deg)",
    },
    head: { left: 19, top: 6, width: 17, height: 17 },
    leftLeg: {
      left: 12,
      top: 29,
      width: 7,
      height: 10,
      transform: "rotate(19deg)",
    },
    rightLeg: {
      left: 28,
      top: 29,
      width: 7,
      height: 12,
      transform: "rotate(-28deg)",
    },
  },
  "rear-lean": {
    torso: {
      left: 11,
      top: 17,
      width: 22,
      height: 20,
      borderRadius: "38% 38% 52% 52%",
      transform: "rotate(4deg)",
    },
    head: { left: 17, top: 8, width: 17, height: 17 },
    leftLeg: {
      left: 10,
      top: 32,
      width: 7,
      height: 10,
      transform: "rotate(20deg)",
    },
    rightLeg: {
      left: 27,
      top: 32,
      width: 7,
      height: 10,
      transform: "rotate(-20deg)",
    },
  },
};

interface OpeningThreatBodyProps {
  source: WorldforgeOpeningThreatSource & {
    bodyState: NonNullable<WorldforgeOpeningThreatSource["bodyState"]>;
  };
  portraitSrc?: string;
  fallbackContent: React.ReactNode;
  isSelected: boolean;
  isTargetable: boolean;
  isTurn: boolean;
  hpPct: number;
  hpColor: string;
  /** Return-site bodies are physical world evidence, not selectable combatants. */
  isDowned?: boolean;
}

/** Render one source-authored miniature with no role badge or colored role ring. */
const OpeningThreatBody: React.FC<OpeningThreatBodyProps> = ({
  source,
  portraitSrc,
  fallbackContent,
  isSelected,
  isTargetable,
  isTurn,
  hpPct,
  hpColor,
  isDowned = false,
}) => {
  const { bodyState } = source;
  const beast =
    bodyState.posture === "low-scout" || bodyState.posture === "scenting";
  const humanoidGeometry = beast
    ? null
    : HUMANOID_BODY_GEOMETRY[bodyState.posture as HumanoidOpeningPosture];
  const facingDegrees =
    (Math.atan2(bodyState.facingDirection.z, bodyState.facingDirection.x) *
      180) /
      Math.PI +
    90;
  // A downed quadruped must fall across its travel axis; reusing the humanoid
  // slump made the wolf read as a tiny upright seed at battlefield scale.
  const downedRotation = isDowned ? (beast ? 90 : 18) : 0;
  const downedScaleY = beast ? 0.82 : 0.72;
  const emphasis = isSelected
    ? "drop-shadow(0 0 6px #fbbf24)"
    : isTargetable
      ? "drop-shadow(0 0 5px #ef4444)"
      : isTurn
        ? "drop-shadow(0 0 5px rgba(251,191,36,0.75))"
        : "drop-shadow(0 2px 2px rgba(0,0,0,0.75))";
  const portrait = portraitSrc ? (
    <img src={portraitSrc} alt="" className="h-full w-full object-cover" />
  ) : (
    fallbackContent
  );

  return (
    <span
      data-testid="opening-threat-body"
      data-opening-role={source.socialRole}
      data-body-posture={bodyState.posture}
      data-carried-profile={bodyState.carriedProfile}
      data-facing-degrees={facingDegrees.toFixed(1)}
      data-body-outcome={isDowned ? "downed" : "active"}
      className={`pointer-events-none absolute left-1/2 top-1/2 z-[18] h-11 w-11 -translate-x-1/2 -translate-y-1/2 overflow-visible ${isDowned ? "opacity-90" : ""}`}
      style={{
        filter: isDowned
          ? `${emphasis} grayscale(0.28) brightness(0.86)`
          : emphasis,
      }}
      aria-label={`${source.monsterName} ${source.monsterOrdinal}: ${OPENING_ROLE_LABELS[source.socialRole]}, ${bodyState.posture}, ${bodyState.carriedProfile}${isDowned ? ", downed at the resolved site" : ""}`}
    >
      {isDowned && (
        <span className="absolute left-[3px] top-[17px] h-[18px] w-[38px] -rotate-6 rounded-[50%] bg-black/55 blur-[2px]" />
      )}
      <span
        className="absolute inset-0"
        style={{
          transform: `rotate(${facingDegrees + downedRotation}deg)${isDowned ? ` scaleY(${downedScaleY})` : ""}`,
          transformOrigin: "22px 22px",
        }}
      >
        <span className="absolute left-[6px] top-[34px] h-[7px] w-8 rounded-full bg-black/55 blur-[1px]" />

        {beast ? (
          <>
            <span className="absolute left-[7px] top-[17px] h-[17px] w-[30px] rounded-[62%_42%_48%_58%] border-2 border-red-200/80 bg-[#536d59]" />
            <span className="absolute left-[2px] top-[20px] h-[4px] w-[12px] origin-right -rotate-[24deg] rounded-full bg-[#3b5142]" />
            <span
              className={`absolute h-[17px] w-[17px] overflow-hidden rounded-[58%_48%_52%_42%] border-2 border-red-300 bg-slate-800 ${
                bodyState.posture === "scenting"
                  ? "left-[27px] top-[10px]"
                  : "left-[25px] top-[14px]"
              }`}
            >
              {portrait}
            </span>
            <span className="absolute left-[10px] top-[31px] h-[8px] w-[4px] rotate-[18deg] rounded-full bg-[#3b5142]" />
            <span className="absolute left-[28px] top-[30px] h-[9px] w-[4px] -rotate-[18deg] rounded-full bg-[#3b5142]" />
            {bodyState.posture === "scenting" && (
              <span className="absolute left-[39px] top-[15px] h-[3px] w-[6px] rounded-full bg-[#17231d]" />
            )}
          </>
        ) : (
          <>
            <span
              className="absolute border-2 border-red-200/80 bg-[#65734a]"
              style={humanoidGeometry?.torso}
            />
            <span
              className="absolute rounded-full bg-[#39482f]"
              style={humanoidGeometry?.leftLeg}
            />
            <span
              className="absolute rounded-full bg-[#39482f]"
              style={humanoidGeometry?.rightLeg}
            />
            <span
              className="absolute z-[2] flex items-center justify-center overflow-hidden rounded-[48%_52%_46%_54%] border-2 border-red-300 bg-slate-800 text-[8px] font-black text-white"
              style={humanoidGeometry?.head}
            >
              {portrait}
            </span>
          </>
        )}

        {bodyState.carriedProfile === "salvage-pack" && (
          <span
            data-testid="opening-threat-carried-salvage-pack"
            className="absolute left-[27px] top-[19px] h-[17px] w-[11px] rotate-[8deg] rounded-sm border-2 border-[#f0ca83] bg-[#94623a] shadow-sm"
          />
        )}
        {bodyState.carriedProfile === "long-tool" && (
          <span
            data-testid="opening-threat-carried-long-tool"
            className="absolute left-[7px] top-[5px] h-[37px] w-[3px] -rotate-[13deg] rounded-full bg-[#a8834f] shadow-sm"
          >
            <span className="absolute -top-[3px] -left-[2px] h-[7px] w-[7px] rotate-45 border-l-2 border-t-2 border-slate-200 bg-slate-500" />
          </span>
        )}
        {bodyState.carriedProfile === "buckler" && (
          <span
            data-testid="opening-threat-carried-buckler"
            className="absolute left-[29px] top-[18px] h-[15px] w-[15px] rounded-full border-2 border-[#d7c38a] bg-[#596878] shadow-[inset_0_0_0_3px_rgba(20,30,40,0.45)]"
          />
        )}
        {bodyState.carriedProfile === "rolled-bedding" && (
          <span
            data-testid="opening-threat-carried-rolled-bedding"
            className="absolute left-[7px] top-[27px] h-[9px] w-[30px] rounded-full border border-[#d6b06f] bg-[#70483b] shadow-sm"
          />
        )}
      </span>

      {hpPct < 1 && !isDowned && (
        <span className="absolute -bottom-[3px] left-[5px] h-[3px] w-[34px] overflow-hidden rounded-full bg-black/70">
          <span
            className="block h-full rounded-full"
            style={{ width: `${hpPct * 100}%`, backgroundColor: hpColor }}
          />
        </span>
      )}
    </span>
  );
};

/**
 * Draw a resolved source body directly from map history.
 *
 * This wrapper intentionally has no click, initiative, health, or targeting
 * behavior. It reuses the same source-authored silhouette as active combat so
 * a return visit can show a body without resurrecting it as an enemy token.
 */
export const OpeningThreatWorldBody: React.FC<{
  source: WorldforgeOpeningThreatSource;
  position: Position;
}> = ({ source, position }) => {
  if (!source.bodyState) return null;
  return (
    <div
      data-testid="opening-aftermath-body-fact"
      className="pointer-events-none absolute z-[17] h-6 w-6 scale-110"
      style={{
        left: `${position.x * TILE_SIZE_PX}px`,
        top: `${position.y * TILE_SIZE_PX}px`,
        width: `${TILE_SIZE_PX}px`,
        height: `${TILE_SIZE_PX}px`,
      }}
    >
      <OpeningThreatBody
        source={
          source as WorldforgeOpeningThreatSource & {
            bodyState: NonNullable<WorldforgeOpeningThreatSource["bodyState"]>;
          }
        }
        fallbackContent={
          <span className="text-[8px] font-black text-stone-100">
            {source.monsterName.slice(0, 1)}
          </span>
        }
        isSelected={false}
        isTargetable={false}
        isTurn={false}
        hpPct={0}
        hpColor="#78716c"
        isDowned
      />
    </div>
  );
};

const CharacterToken: React.FC<CharacterTokenProps> = React.memo(
  ({
    character,
    position,
    isSelected,
    isTargetable,
    targetingMode,
    isTurn,
    onCharacterClick,
  }) => {
    const multiplier = getCharacterSizeMultiplier(character.stats.size);
    const defenseBadges = buildDefenseBadges(character);
    const tokenVisual = useMemo(
      () => getCreatureTokenVisual(character),
      [character],
    );
    const openingSource =
      character.worldSource?.kind === "worldforge-opening-threat"
        ? character.worldSource
        : null;
    const openingRole = openingSource
      ? LEGACY_OPENING_ROLE_PRESENTATIONS[openingSource.socialRole]
      : null;
    const openingBodySource = openingSource?.bodyState
      ? (openingSource as WorldforgeOpeningThreatSource & {
          bodyState: NonNullable<WorldforgeOpeningThreatSource["bodyState"]>;
        })
      : null;

    // Memoized container style: only recalculates when position, size, or interaction
    // state changes — prevents redundant style-object allocation on unrelated renders.
    const style = useMemo(
      (): React.CSSProperties => ({
        position: "absolute",
        left: `${position.x * TILE_SIZE_PX}px`,
        top: `${position.y * TILE_SIZE_PX}px`,
        width: `${TILE_SIZE_PX * multiplier}px`,
        height: `${TILE_SIZE_PX * multiplier}px`,
        // Glide between tiles instead of teleporting: position-only so size and
        // interaction styling don't animate along for the ride.
        transition: "left 0.35s ease-in-out, top 0.35s ease-in-out",
        zIndex: Z_INDEX.CONTENT_OVERLAY_LOW,
        cursor: targetingMode ? "crosshair" : "pointer",
      }),
      [position.x, position.y, multiplier, targetingMode],
    );

    // Memoized token circle style: only recalculates when visual state changes.
    const tokenStyle = useMemo((): React.CSSProperties => {
      // Bright faction rings + a thin light halo: the old dark-red-on-dark-slate
      // enemy ring disappeared entirely against the painted forest, which made
      // hostiles effectively invisible on the board.
      let borderColor = "#9CA3AF"; // gray-400 default
      if (character.team === "player")
        borderColor = "#60A5FA"; // blue-400
      else borderColor = "#EF4444"; // red-500 for enemy team
      if (isTargetable) borderColor = "#F87171";
      if (isSelected) borderColor = "#FBBF24";
      const halo = "0 0 0 1.5px rgba(255,255,255,0.4)";

      return {
        width: "80%",
        height: "80%",
        borderRadius: openingRole?.tokenRadius ?? "50%",
        border: `3px solid ${borderColor}`,
        backgroundColor: "#1F2937",
        overflow: "hidden",
        boxShadow: isSelected
          ? `${halo}, 0 0 10px #FBBF24, 0 0 20px #FBBF24`
          : isTargetable
            ? `${halo}, 0 0 10px #EF4444`
            : `${halo}, 0 2px 4px rgba(0,0,0,0.6)`,
        transform: isSelected ? "scale(1.1)" : "scale(1.0)",
        animation: isTurn ? "pulseTurn 2s infinite" : "none",
      };
    }, [character.team, isSelected, isTargetable, isTurn, openingRole]);

    // HP arc around the token rim: state-at-a-glance without opening a sheet.
    const hpPct = Math.max(
      0,
      Math.min(
        1,
        character.maxHP > 0 ? character.currentHP / character.maxHP : 0,
      ),
    );
    const hpColor =
      hpPct > 0.5 ? "#34D399" : hpPct > 0.25 ? "#FBBF24" : "#F87171";
    const handleActivate = () => onCharacterClick(character);

    return (
      <div
        style={style}
        className="relative flex items-center justify-center pointer-events-auto"
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleActivate();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Select ${character.name}`}
      >
        <Tooltip
          content={`${character.name} (Armor Class: ${character.class.id === "fighter" ? 18 : 12}, Hit Points: ${character.currentHP}/${character.maxHP})`}
        >
          {openingBodySource ? (
            <OpeningThreatBody
              source={openingBodySource}
              portraitSrc={tokenVisual.src}
              fallbackContent={tokenVisual.fallbackContent}
              isSelected={isSelected}
              isTargetable={isTargetable}
              isTurn={isTurn}
              hpPct={hpPct}
              hpColor={hpColor}
            />
          ) : (
            <div
              style={tokenStyle}
              className="flex items-center justify-center font-bold text-white text-lg"
            >
              {tokenVisual.src ? (
                <img
                  src={tokenVisual.src}
                  alt=""
                  className="h-full w-full object-cover"
                  data-testid={
                    openingRole ? "opening-threat-posture" : undefined
                  }
                  data-opening-role={openingSource?.socialRole}
                  style={
                    openingRole
                      ? {
                          transform: openingRole.portraitTransform,
                          transformOrigin: "center",
                        }
                      : undefined
                  }
                />
              ) : (
                tokenVisual.fallbackContent
              )}
            </div>
          )}
        </Tooltip>

        {/* HP arc hugging the ring: green → amber → red as the combatant drops,
          starting at 12 o'clock and sweeping clockwise. */}
        {hpPct < 1 && !openingBodySource && (
          <svg
            viewBox="0 0 36 36"
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="16.5"
              fill="none"
              stroke={hpColor}
              strokeWidth="2.4"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${hpPct * 100} 100`}
            />
          </svg>
        )}

        {/* Defense badges stay tiny and pinned to the perimeter so they expose
          the important damage traits without growing the token footprint or
          colliding with the center icon. The 3D renderer still needs a separate
          parity pass, so this slice deliberately stops at the 2D token layer. */}
        {defenseBadges.map((badge) => (
          <DefenseBadge key={badge.kind} {...badge} />
        ))}

        {/* Status effect badges hover near the token to visualize buffs/debuffs without opening a sheet. */}
        {character.statusEffects.length > 0 && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {character.statusEffects.map((effect, idx) => (
              <Tooltip
                key={`${effect.id}-${idx}`}
                content={`${effect.name} (${effect.duration}t)`}
              >
                <span
                  className="w-6 h-6 rounded-full bg-gray-900 border border-white/40 flex items-center justify-center text-xs"
                  style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.45)" }}
                  aria-label={`${effect.name} status marker`}
                >
                  {getStatusEffectIcon(effect)}
                </span>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Concentration Indicator: Shows a pulsing crystal orb if the character is maintaining a spell. */}
        {character.concentratingOn && (
          <Tooltip
            content={`Concentrating on ${character.concentratingOn.spellName}`}
          >
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-900 border border-purple-400 flex items-center justify-center text-xs shadow-md"
              style={{
                animation: "pulse 2s infinite",
                zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM,
              }}
              aria-label={`Concentrating on ${character.concentratingOn.spellName}`}
            >
              🔮
            </div>
          </Tooltip>
        )}
      </div>
    );
  },
);

CharacterToken.displayName = "CharacterToken";

export default CharacterToken;
