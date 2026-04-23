// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: manual addition; the dependency sync tool skips scripts.
 * Dependents: scripts/generateSpellGateReport.ts, src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, src/components/Glossary/spellGateChecker/spellGateDataTypes.ts, src/components/Glossary/spellGateChecker/useSpellGateChecks.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellValidator } from "../src/systems/spells/validation/spellValidator";
import { isAttackRollModifierEffect, type EffectDuration } from "../src/types/spells";

/**
 * Shared helpers for comparing spell attack-roll rider rows against runtime
 * spell JSON.
 *
 * Why this exists:
 * the gate checker needs one consistent way to read the structured rider lines
 * in the markdown block and one consistent way to read the live runtime rider
 * effects. Keeping that logic here avoids making the audit script, the gate
 * report generator, and the glossary panel each invent their own slightly
 * different rider parsing rules.
 */

// ============================================================================
// Text normalization
// ============================================================================
// The rider lane should ignore punctuation-only differences so the gate
// checker can focus on the actual mechanics instead of layout noise.
// ============================================================================

export function normalizeAttackRollText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAttackRollComparisonValue(value: string): string {
  const normalized = normalizeAttackRollText(value);
  if (!normalized || normalized.toLowerCase() === "none") {
    return "";
  }

  return normalized;
}

// ============================================================================
// Structured field parsing
// ============================================================================
// The structured markdown keeps attack-roll riders as several labeled rows. We
// collect those row values so the gate checker can compare them against the
// live runtime spell JSON without guessing at the spell's intended mechanic.
// ============================================================================

type AttackRollRiderFields = {
  modifier?: string;
  direction?: string;
  attackKind?: string;
  consumption?: string;
  duration?: string;
  dice?: string;
  value?: string;
  attackerFilter?: string;
  notes?: string;
};

export interface RuntimeAttackRollRiderSummary {
  value: string;
  riders: string[];
}

function parseStructuredAttackRollFields(markdown: string): AttackRollRiderFields {
  const fields: AttackRollRiderFields = {};
  const fieldRegex = /^- \*\*Attack Roll ([^*]+)\*\*:\s*(.*)$/gm;

  for (const match of markdown.matchAll(fieldRegex)) {
    const fieldName = (match[1] ?? "").trim().toLowerCase();
    const fieldValue = normalizeAttackRollComparisonValue((match[2] ?? "").trim());
    if (!fieldValue) {
      continue;
    }

    if (fieldName === "modifier") {
      fields.modifier = fieldValue;
    } else if (fieldName === "direction") {
      fields.direction = fieldValue;
    } else if (fieldName === "kind") {
      fields.attackKind = fieldValue;
    } else if (fieldName === "consumption") {
      fields.consumption = fieldValue;
    } else if (fieldName === "duration") {
      fields.duration = fieldValue;
    } else if (fieldName === "dice") {
      fields.dice = fieldValue;
    } else if (fieldName === "value") {
      fields.value = fieldValue;
    } else if (fieldName === "attacker filter") {
      fields.attackerFilter = fieldValue;
    } else if (fieldName === "notes") {
      fields.notes = fieldValue;
    }
  }

  return fields;
}

function formatDuration(duration?: EffectDuration): string {
  if (!duration) {
    return "";
  }

  if (duration.type === "special") {
    return "special duration";
  }

  if (typeof duration.value !== "number") {
    return duration.type;
  }

  const unit = duration.type === "rounds"
    ? duration.value === 1 ? "Round" : "Rounds"
    : duration.value === 1 ? "Minute" : "Minutes";

  return `${duration.value} ${unit}`;
}

function formatAttackRollValue(fields: AttackRollRiderFields): string {
  const modifierWord = fields.modifier === "advantage"
    ? "Advantage"
    : fields.modifier === "disadvantage"
      ? "Disadvantage"
      : fields.modifier === "bonus"
        ? "Bonus"
        : "Penalty";

  const valueWord = fields.dice
    ? fields.dice
    : fields.value
      ? fields.value
      : "";

  const kindWord = fields.attackKind === "weapon"
    ? "weapon attack"
    : fields.attackKind === "melee_weapon"
      ? "melee weapon attack"
      : fields.attackKind === "ranged_weapon"
        ? "ranged weapon attack"
        : fields.attackKind === "spell"
          ? "spell attack"
          : "attack";

  const attackTiming = fields.consumption === "first_attack"
    ? "first"
    : fields.consumption === "while_active"
      ? ""
      : "next";

  let label = "";
  if (fields.direction === "incoming") {
    if (fields.consumption === "while_active") {
      label = `${modifierWord}${valueWord ? ` ${valueWord}` : ""} on ${kindWord}s against this creature for the spell's duration`;
    } else {
      label = `${modifierWord}${valueWord ? ` ${valueWord}` : ""} on the ${attackTiming} ${kindWord} against this creature`;
    }
  } else {
    if (fields.consumption === "while_active") {
      label = `${modifierWord}${valueWord ? ` ${valueWord}` : ""} on this creature's ${kindWord}s for the spell's duration`;
    } else {
      label = `${modifierWord}${valueWord ? ` ${valueWord}` : ""} on this creature's ${attackTiming} ${kindWord}`;
    }
  }

  const durationLabel = normalizeAttackRollComparisonValue(fields.duration ?? "");
  if (durationLabel && fields.consumption !== "while_active" && !label.toLowerCase().includes(durationLabel.toLowerCase())) {
    label = `${label} for ${durationLabel}`;
  }

  return normalizeAttackRollText(label);
}

// ============================================================================
// Structured markdown reader
// ============================================================================
// This reader keeps the rider comparison close to the structured markdown
// fields, because the gate checker needs to know when the top block is missing
// the rider facts entirely versus when the runtime JSON is the part that is
// behind.
// ============================================================================

export function readStructuredAttackRollRiders(markdown: string): RuntimeAttackRollRiderSummary {
  const fields = parseStructuredAttackRollFields(markdown);
  const hasAnyField = Object.values(fields).some((value) => typeof value === "string" && value.trim().length > 0);
  if (!hasAnyField) {
    return { value: "", riders: [] };
  }

  const label = formatAttackRollValue(fields);
  return {
    value: label,
    riders: [label],
  };
}

// ============================================================================
// Runtime spell JSON formatter
// ============================================================================
// This formatter reads the live spell JSON and turns each rider effect into the
// same kind of readable string that the structured markdown comparison uses.
// ============================================================================

export function formatRuntimeAttackRollRiders(spell: unknown): RuntimeAttackRollRiderSummary {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) {
    return { value: "", riders: [] };
  }

  const riders = parsed.data.effects
    .filter(isAttackRollModifierEffect)
    .map((effect) => {
      const rider = effect.attackRollModifier;
      return formatAttackRollValue({
        modifier: rider.modifier,
        direction: rider.direction,
        attackKind: rider.attackKind,
        consumption: rider.consumption,
        duration: formatDuration(rider.duration),
        dice: rider.dice,
        value: typeof rider.value === "number" ? String(rider.value) : "",
        attackerFilter: rider.attackerFilter ? JSON.stringify(rider.attackerFilter) : "",
        notes: rider.notes || "",
      });
    });

  return {
    value: riders.join(" | "),
    riders,
  };
}
