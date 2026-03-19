// devtools/roadmap/src/spell-branch/axis-engine.ts
import type {
  SpellCanonicalProfile,
  AxisId,
  AxisChoice,
  AxisState,
  AxisValue,
  AxisEngineResult,
} from './types';
import { resolveComponentCombination } from './vsm-tree';

// Ordered list of all supported axes.
// Add new axes here when data is ready — no other changes needed.
const ALL_AXES: AxisId[] = [
  'class',
  'level',
  'school',
  'castingTime',
  'effectType',
  'concentration',
  'ritual',
  'aiArbitration',
  'requirements',
  'targetingType',
  'attackType',
];

const AXIS_LABELS: Record<AxisId, string> = {
  class: 'Class',
  level: 'Level',
  school: 'School',
  castingTime: 'Casting Time',
  effectType: 'Effect Type',
  concentration: 'Concentration',
  ritual: 'Ritual',
  aiArbitration: 'AI Arbitration',
  requirements: 'Requirements',
  targetingType: 'Targeting Type',
  attackType: 'Attack Type',
};

// Binary axes use Yes / No / Either — not raw field values.
const BINARY_AXES = new Set<AxisId>([
  'concentration',
  'ritual',
  'aiArbitration',
]);

/**
 * Extracts all values a given spell contributes to a given axis.
 * Returns an array because some axes (class, effectType) are multi-value.
 * Returns null if this axis is binary — handled separately.
 */
function extractValues(
  spell: SpellCanonicalProfile,
  axisId: AxisId
): string[] | null {
  switch (axisId) {
    case 'class':
      return spell.classes;
    case 'level':
      return [String(spell.level)];
    case 'school':
      return [spell.school];
    case 'castingTime':
      return [spell.castingTimeUnit];
    case 'effectType':
      return spell.effectTypes;
    case 'targetingType':
      return [spell.targetingType];
    case 'attackType':
      return [spell.attackType];
    case 'requirements':
      return [resolveComponentCombination(spell.components)];
    // Binary axes handled separately
    case 'concentration':
    case 'ritual':
    case 'aiArbitration':
      return null;
    default:
      return [];
  }
}

function getBinaryValue(
  spell: SpellCanonicalProfile,
  axisId: AxisId
): boolean {
  switch (axisId) {
    case 'concentration':
      return spell.concentration;
    case 'ritual':
      return spell.ritual;
    case 'aiArbitration':
      return spell.arbitrationRequired;
    default:
      return false;
  }
}

/**
 * Returns true if a spell matches the given choice.
 */
function spellMatchesChoice(
  spell: SpellCanonicalProfile,
  choice: AxisChoice
): boolean {
  if (choice.value === 'either') return true;

  if (BINARY_AXES.has(choice.axisId)) {
    const boolValue = getBinaryValue(spell, choice.axisId);
    return choice.value === 'yes' ? boolValue : !boolValue;
  }

  const values = extractValues(spell, choice.axisId);
  return values !== null && values.includes(choice.value);
}

/**
 * Builds an AxisState for a binary axis from the current filtered set.
 */
function buildBinaryAxisState(
  axisId: AxisId,
  spells: SpellCanonicalProfile[]
): AxisState {
  const yesCount = spells.filter((s) => getBinaryValue(s, axisId)).length;
  const noCount = spells.length - yesCount;
  return {
    axisId,
    label: AXIS_LABELS[axisId],
    values: [
      { value: 'yes', label: 'Yes', count: yesCount },
      { value: 'no', label: 'No', count: noCount },
      { value: 'either', label: 'Either', count: spells.length },
    ],
  };
}

/**
 * Builds an AxisState for a multi-value axis from the current filtered set.
 * Only values that exist in the filtered set are returned (no phantom entries).
 */
function buildMultiValueAxisState(
  axisId: AxisId,
  spells: SpellCanonicalProfile[]
): AxisState {
  const countMap = new Map<string, number>();
  for (const spell of spells) {
    const values = extractValues(spell, axisId);
    if (!values) continue;
    for (const v of values) {
      if (v === '' || v == null) continue;
      countMap.set(v, (countMap.get(v) ?? 0) + 1);
    }
  }
  const values: AxisValue[] = Array.from(countMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }));

  return { axisId, label: AXIS_LABELS[axisId], values };
}

/**
 * Core engine. Pure function — no side effects.
 *
 * Given the full profile set and all choices made so far:
 * - Filters the spell set by applying all choices in order
 * - Returns the filtered set, its count, and the next available axes
 *   (already-chosen axes are excluded; values are computed from filtered set only)
 */
export function computeAxisEngine(
  allProfiles: SpellCanonicalProfile[],
  choices: AxisChoice[]
): AxisEngineResult {
  // Apply choices sequentially to filter the spell set
  let filteredSpells = allProfiles;
  for (const choice of choices) {
    filteredSpells = filteredSpells.filter((s) =>
      spellMatchesChoice(s, choice)
    );
  }

  // Determine which axes have already been chosen (excluding 'either' choices
  // since 'either' dismisses the axis without filtering)
  const chosenAxes = new Set(choices.map((c) => c.axisId));

  // Build available axes from the remaining, unchosen axes
  const availableAxes: AxisState[] = [];
  for (const axisId of ALL_AXES) {
    if (chosenAxes.has(axisId)) continue;

    const state = BINARY_AXES.has(axisId)
      ? buildBinaryAxisState(axisId, filteredSpells)
      : buildMultiValueAxisState(axisId, filteredSpells);

    // Only include axes that have at least one meaningful value
    if (state.values.length > 0) {
      availableAxes.push(state);
    }
  }

  return {
    filteredSpells,
    availableAxes,
    spellCount: filteredSpells.length,
  };
}
