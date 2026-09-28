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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 15:21:24
 * Dependents: components/BattleMap/BattleMapTokens.tsx, components/BattleMap/index.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
} from "../../utils/combat";
import { Z_INDEX } from "../../styles/zIndex";
import { getCreatureTokenVisual } from "../../utils/visuals/combatIconVisuals";
import { resolveConditionVisual } from "../../utils/visuals/conditionPalette";
import { resolveControlPose } from "./controlOptionPose";
import { resolveActorBodyShading } from "./characters/actorStatusShading";

interface CharacterTokenProps {
  character: CombatCharacter;
  position: { x: number; y: number };
  isSelected: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  isTurn: boolean;
  onCharacterClick: (char: CombatCharacter) => void;
  /**
   * VIZ-3 (agora-75ed.3): the live CSS scale of the board frame, so the token
   * can pick a level of detail. The board is scaled by one CSS transform on an
   * ancestor, so a 32 px token is 4.8 px on screen at the 0.15 minimum zoom —
   * every perimeter badge there is sub-pixel noise and the disc itself is
   * unfindable. Geometry stays tile-locked; only decoration DENSITY and ring
   * WEIGHT respond to this.
   *
   * Optional and undefined-means-full on purpose: every existing caller (tests,
   * scenario harnesses, the design labs) keeps the pre-VIZ-3 full-detail token
   * until it opts in by passing a real scale.
   */
  boardScale?: number;
}

/**
 * Detail tiers (VIZ-3). Measured in EFFECTIVE on-screen pixels of the token
 * square, i.e. `TILE_SIZE_PX * sizeMultiplier * boardScale`.
 *
 * - `full`    — the perimeter cluster is legible; render every badge.
 * - `minimal` — badges would be illegible AND would collide with the neighbors
 *               they overhang, so the token falls back to cues that cost no
 *               layout space at all: the status/defeat body wash and a
 *               counter-weighted keyline that keeps the disc findable.
 *
 * 30 px is the boundary because the perimeter slots below are laid out against
 * the 32 px tile: at the default 100% zoom every badge still shows.
 */
const FULL_DETAIL_MIN_PX = 30;

/**
 * Ring/keyline weight multiplier for a shrunken board. Pure LOD: at 0.15 zoom
 * the shipped 4 px faction band and 4 px white keyline render at 0.6 px each
 * and disappear into the painted terrain (proof:
 * `.agent/scratch/agora-75ed.3/before-zoom-min-tokens.png` contains no findable
 * combatant). Counter-weighting turns the token into a saturated dot with a
 * white halo instead. Capped so the band never eats the whole disc.
 */
const ringWeight = (boardScale: number | undefined) =>
  boardScale && boardScale > 0 && boardScale < 1
    ? Math.min(3.2, 1 / boardScale)
    : 1;

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
      // VIZ-3 slotting (agora-75ed.3). The three badges used to be pinned
      // `left-0 top-0` / `left-0 top-1/2` / `left-0 bottom-0` at 14 px each on a
      // 32 px token, so their vertical ranges were 0-14, 9-23 and 18-32: any
      // creature with all three damage traits drew them 5 px on top of each
      // other. They are now a 10 px LEFT COLUMN at three disjoint offsets
      // (0-10, 11-21, 22-32) that stays entirely inside the token square, which
      // also frees the right column for the concentration and temporary-HP
      // cues and the strip below for the status row.
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
      positionClass: "left-0 top-[11px]",
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
      positionClass: "left-0 top-[22px]",
      toneClass:
        "border-sky-200/70 bg-sky-950/90 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.24)]",
    });
  }

  return badges;
};

/**
 * How many status icons the row draws before collapsing the rest into a "+N"
 * chip. Three 14 px chips plus the overflow chip fit inside 46 px, which keeps
 * the strip from overhanging the neighboring tiles the way the old uncapped
 * 24 px row did.
 */
const STATUS_ROW_MAX = 3;

interface StatusMarker {
  key: string;
  name: string;
  icon: string;
  tooltip: string;
  /** Chip border color from the shared palette (agora-f821.29). */
  color: string;
}

/**
 * The 2D token's status row, merged from BOTH status sources.
 *
 * `statusEffects[]` is what spells and abilities push; `conditions[]` is the
 * rules-level 5e condition list the combat engine maintains. The token used to
 * read only the first, so a Poisoned or Restrained creature showed no marker at
 * all on the board while the 3D actor (which reads both, via
 * `actorStatusShading.statusNames`) shaded its body. Conditions come first and
 * win the dedupe because the rules condition is the stronger statement.
 */
const buildStatusMarkers = (character: CombatCharacter): StatusMarker[] => {
  const seen = new Set<string>();
  const out: StatusMarker[] = [];

  for (const condition of character.conditions ?? []) {
    const name = String(condition.name);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Conditions carry no `icon` field, so the old synthetic-StatusEffect call
    // fell straight through to the type switch and returned the SAME skull for
    // every condition on the board. The palette keys off the name instead.
    const visual = resolveConditionVisual(name);
    out.push({
      key: `condition-${key}`,
      name,
      icon: visual.icon,
      color: visual.chipColor,
      tooltip: condition.source ? `${name} (${condition.source})` : name,
    });
  }

  character.statusEffects.forEach((effect, index) => {
    const key = String(effect.name).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      key: `status-${effect.id}-${index}`,
      name: effect.name,
      // Keeps an explicit `effect.icon` when the effect carries one.
      icon: getStatusEffectIcon(effect),
      color: resolveConditionVisual(effect.name).chipColor,
      tooltip: `${effect.name} (${effect.duration}t)`,
    });
  });

  return out;
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
      className={`absolute flex h-2.5 w-2.5 items-center justify-center rounded-full border text-[6px] font-black uppercase leading-none tracking-tight ${positionClass} ${toneClass}`}
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
    boardScale,
  }) => {
    const multiplier = getCharacterSizeMultiplier(character.stats.size);
    const defenseBadges = buildDefenseBadges(character);
    // VIZ-3 level of detail. `undefined` scale = caller has not opted in, so
    // nothing about the pre-VIZ-3 token changes for it.
    const effectivePx =
      boardScale === undefined
        ? Number.POSITIVE_INFINITY
        : TILE_SIZE_PX * multiplier * boardScale;
    const fullDetail = effectivePx >= FULL_DETAIL_MIN_PX;
    const weight = ringWeight(boardScale);

    // VIZ-3 body cue. `resolveActorBodyShading` is the SAME table the 3D actor
    // shades its body with (agora-8aa9); reusing it is what makes a poisoned or
    // burning creature read the same in both renderers instead of only in 3D.
    // Before this, the 2D token read `character.statusEffects` alone, so every
    // actor carrying a 5e `conditions[]` entry — which is what the combat
    // engine and the `?actorstatus=1` fixture actually populate — rendered as a
    // healthy token (proof: `.agent/scratch/agora-75ed.3/before-probe.json`,
    // where Poisoned Skulker / Burning Magus / Frozen Brute all report
    // `parts: []`). The wash costs no layout space, so unlike a badge it
    // survives every zoom level.
    const bodyShading = resolveActorBodyShading(character);
    const isDowned = character.currentHP <= 0 && character.maxHP > 0;
    const tintCss =
      bodyShading.tintColor === null
        ? null
        : `#${bodyShading.tintColor.toString(16).padStart(6, "0")}`;

    // The merged, deduplicated marker list the capped icon row draws from.
    // `conditions` first because the rules-level condition is the stronger
    // statement when a spell also left a same-named status behind.
    const statusMarkers = useMemo(() => buildStatusMarkers(character), [
      character,
    ]);
    // G7 shared pose contract: an active control-option directive (approach /
    // flee / drop / grovel / halt) poses the token. Resolution is cached per
    // statusEffects array; null = base look (fallback), and status expiry
    // restores the base look through the CSS transition below.
    const controlPose = resolveControlPose(character.statusEffects);
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
      // Readability over a busy painted forest is the whole job here. A thin
      // faction ring on a dark disc vanished into the foliage, so every token
      // now carries a double keyline (dark hairline + bright white ring) that
      // reads over ANY background, plus a drop shadow to lift it off the art.
      // The faction color is a thick, saturated band so team identity still
      // reads at a glance: green = party, red = enemy.
      let borderColor = "#9CA3AF"; // gray-400 neutral default
      if (character.team === "player")
        borderColor = "#22C55E"; // green-500 party
      else borderColor = "#EF4444"; // red-500 enemy
      if (isTargetable) borderColor = "#F87171";
      if (isSelected) borderColor = "#FBBF24";

      // Layered outward from the token edge: dark hairline hugs the faction
      // band, a bold white ring guarantees contrast on dark foliage, and a
      // faint dark edge separates the white from any bright patch behind it.
      // VIZ-3: every radius is multiplied by `weight` (1 at 100% zoom and
      // above, up to 3.2 as the board shrinks) so the halo survives the board's
      // CSS downscale instead of collapsing to a sub-pixel line.
      const r = (px: number) => `${(px * weight).toFixed(2)}px`;
      const keyline =
        `0 0 0 ${r(1.5)} rgba(0,0,0,0.92), 0 0 0 ${r(4)} rgba(255,255,255,0.95), 0 0 0 ${r(5.5)} rgba(0,0,0,0.5)`;
      const drop = "0 3px 8px 2px rgba(0,0,0,0.65)";
      // A status wash needs an outer ring too, or it is invisible the moment
      // the disc is small enough that the portrait is a smudge.
      const statusRing = tintCss ? `, 0 0 0 ${r(7.5)} ${tintCss}` : "";

      return {
        width: "92%",
        height: "92%",
        borderRadius: openingRole?.tokenRadius ?? "50%",
        border: `${(4 * weight).toFixed(2)}px solid ${borderColor}`,
        backgroundColor: "#111827",
        overflow: "hidden",
        boxShadow: isSelected
          ? `${keyline}, ${drop}, 0 0 12px 3px #FBBF24${statusRing}`
          : isTargetable
            ? `${keyline}, ${drop}, 0 0 12px 3px #EF4444${statusRing}`
            : `${keyline}, ${drop}${statusRing}`,
        // Control-option pose (G7): composed after the selection scale so both
        // read together; the transition makes apply AND restore smooth without
        // blocking anything. VIZ-3 appends the defeat slump last so a downed
        // creature is not just a recolor — it lies over.
        transform:
          `${isSelected ? "scale(1.12)" : "scale(1.0)"}` +
          `${controlPose ? ` ${controlPose.token2d.transform}` : ""}` +
          `${isDowned ? " rotate(14deg) scaleY(0.74)" : ""}`,
        // Desaturation is the shared 3D number, so 2D and 3D agree on how far
        // a defeated or petrified body drops out of the living palette.
        filter:
          [
            controlPose && controlPose.token2d.filter !== "none"
              ? controlPose.token2d.filter
              : null,
            bodyShading.desaturate > 0
              ? `saturate(${(1 - bodyShading.desaturate).toFixed(2)})`
              : null,
            isDowned ? "brightness(0.72)" : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        transition: "transform 0.3s ease, filter 0.3s ease",
        // A corpse does not take turns; the pulse read as "still active".
        animation: isTurn && !isDowned ? "pulseTurn 2s infinite" : "none",
      };
    }, [
      character.team,
      isSelected,
      isTargetable,
      isTurn,
      openingRole,
      controlPose,
      weight,
      tintCss,
      bodyShading.desaturate,
      isDowned,
    ]);

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
              className="relative flex items-center justify-center font-bold text-white text-lg"
              /* Stable handle for the VIZ-3 tests, which assert the ring weight
                 and the defeat slump that the token's inline style carries. */
              data-testid="token-disc"
              data-control-pose={controlPose?.id}
              aria-label={controlPose ? controlPose.label : undefined}
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
              {/* VIZ-3 status wash. Same hue and strength the 3D body takes, so
                a Poisoned actor is green in both renderers. It sits over the
                portrait rather than beside it, which is why it survives the
                board downscale that erases every perimeter badge. */}
              {tintCss && (
                <span
                  data-testid="token-status-wash"
                  data-token-status={isDowned ? "defeated" : "condition"}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[inherit]"
                  style={{
                    backgroundColor: tintCss,
                    opacity: bodyShading.tintStrength,
                  }}
                />
              )}
            </div>
          )}
        </Tooltip>

        {/* VIZ-3 defeat marker. A combatant at 0 HP used to render an ordinary
          faction ring plus a ZERO-LENGTH HP arc, i.e. nothing at all: the
          `?actorstatus=1` Fallen Reaver was pixel-identical to a healthy enemy
          at 300% zoom (proof: before-zoom-max-tokens.png). The slump and wash
          above carry the state at any size; this glyph names it when the token
          is large enough to read one. */}
        {isDowned && !openingBodySource && fullDetail && (
          <span
            data-testid="downed-token-marker"
            aria-label={`${character.name} is down`}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
            style={{ zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM }}
          >
            💀
          </span>
        )}

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

        {/* Aerial altitude is a real combat-state badge, not a scenario label.
          Keeping it above the token makes a flying creature's vertical square
          readable on the flat 2D board while its horizontal footprint remains
          anchored to the same selectable cell. Grounded creatures add nothing. */}
        {character.aerialMovement?.isFlying && fullDetail && (
          <span
            data-testid="aerial-altitude-badge"
            aria-label={`${character.name} flying at ${character.aerialMovement.altitudeFeet} feet`}
            className="pointer-events-none absolute left-1/2 top-[-16px] -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-200 bg-sky-950/95 px-1.5 py-0.5 text-[8px] font-black leading-none text-sky-100 shadow-md"
            style={{ zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM }}
          >
            ↟ {character.aerialMovement.altitudeFeet} ft
          </span>
        )}

        {/* Temporary HP is a separate cyan buffer rather than extra green HP.
          Keep its exact value beside the token so absorption and replacement
          remain readable without opening an inspector or inferring from an arc. */}
        {/* VIZ-3 re-slot: this used to sit at `right-[-8px] top-1/2`, which put
          its 14 px box across the concentration orb's `-top-1 -right-1` corner
          whenever a caster also held a buffer. The right column is now split —
          concentration owns the upper half, this owns the lower. */}
        {(character.tempHP ?? 0) > 0 && fullDetail && (
          <span
            data-testid="temporary-hit-points-badge"
            aria-label={`${character.tempHP} temporary hit points`}
            className="pointer-events-none absolute right-[-7px] bottom-0 rounded-full border border-cyan-200 bg-cyan-950/95 px-1 py-0.5 text-[8px] font-black leading-none text-cyan-100 shadow-md"
            style={{ zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM }}
          >
            +{character.tempHP}
          </span>
        )}

        {/* Defense badges stay tiny and pinned to the perimeter so they expose
          the important damage traits without growing the token footprint or
          colliding with the center icon. The 3D renderer still needs a separate
          parity pass, so this slice deliberately stops at the 2D token layer. */}
        {fullDetail &&
          defenseBadges.map((badge) => (
            <DefenseBadge key={badge.kind} {...badge} />
          ))}

        {/* Status effect badges hover near the token to visualize buffs/debuffs
          without opening a sheet.

          VIZ-3 (agora-75ed.3) changed three things and preserved the rest:
          (1) the row is CAPPED. It was an uncapped `flex gap-1` of 24 px chips
              centered under a 32 px token, so four effects drew an 108 px strip
              that ran a full tile into BOTH neighbors. Three 14 px chips plus a
              "+N" overflow chip keep the strip inside 46 px.
          (2) the chips sit lower (`bottom-[-17px]`) so they clear the defense
              column, which now ends at the token's bottom edge.
          (3) it is a MERGED row: 5e `conditions[]` join `statusEffects[]`, so a
              condition applied by the combat engine finally shows on the 2D
              token. Only the icon row is capped — the wash on the disc always
              carries the highest-severity cue, at any zoom. */}
        {statusMarkers.length > 0 && fullDetail && (
          <div
            data-testid="status-effect-row"
            className="absolute bottom-[-17px] left-1/2 flex -translate-x-1/2 items-center gap-[2px]"
            style={{ zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM }}
          >
            {statusMarkers.slice(0, STATUS_ROW_MAX).map((marker) => (
              <Tooltip key={marker.key} content={marker.tooltip}>
                <span
                  data-testid={`status-marker-${marker.name}`}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-gray-900 text-[8px] leading-none"
                  style={{
                    boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                    // Ruled conditions ring themselves in their own color; the
                    // rest share the palette's one neutral until sheet q4.
                    borderColor: marker.color,
                  }}
                  aria-label={`${marker.name} status marker`}
                >
                  {marker.icon}
                </span>
              </Tooltip>
            ))}
            {statusMarkers.length > STATUS_ROW_MAX && (
              <Tooltip
                content={statusMarkers
                  .slice(STATUS_ROW_MAX)
                  .map((marker) => marker.name)
                  .join(", ")}
              >
                <span
                  data-testid="status-effect-overflow"
                  className="flex h-3.5 items-center justify-center rounded-full border border-white/40 bg-gray-900 px-[3px] text-[7px] font-black leading-none text-white"
                  aria-label={`${statusMarkers.length - STATUS_ROW_MAX} more status markers`}
                >
                  +{statusMarkers.length - STATUS_ROW_MAX}
                </span>
              </Tooltip>
            )}
          </div>
        )}

        {/* Concentration Indicator: Shows a pulsing crystal orb if the character is maintaining a spell. */}
        {character.concentratingOn && fullDetail && (
          <Tooltip
            content={`Concentrating on ${character.concentratingOn.spellName}`}
          >
            <div
              className="absolute top-0 right-[-7px] h-3.5 w-3.5 rounded-full bg-purple-900 border border-purple-400 flex items-center justify-center text-[8px] shadow-md"
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
