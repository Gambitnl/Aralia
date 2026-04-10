import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script repairs the strongest placeholder-like top-level spell defaults
 * found during the official-source review of the regenerated spell-reference batch.
 *
 * The point of this script is deliberately narrow:
 * - fix clearly evidenced top-level canonical facts
 * - keep the deeper effect-object modeling untouched for now
 * - keep JSON and markdown aligned so the parity collector reflects the repair
 *
 * Called manually by: Codex during the spell-truth arbitration lane
 * Depends on:
 * - `docs/tasks/spells/SPELL_REGENERATED_REFERENCE_OFFICIAL_CHECK.md`
 * - `public/data/spells/**`
 * - `docs/spells/reference/**`
 */

// ============================================================================
// Paths
// ============================================================================
// This section keeps the filesystem roots together so the repair can be rerun
// from anywhere without depending on the caller's working directory.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const SPELL_MARKDOWN_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');

// ============================================================================
// Repair Mapping
// ============================================================================
// This section stores only the top-level facts that were explicitly evidenced in
// the official verification report. It intentionally does not guess at deeper
// targeting/effect decomposition, because that is a separate modeling lane.
// ============================================================================

interface TopLevelRepair {
  school?: string;
  castingTime?: { value: number; unit: string; combatCostType: 'action' | 'bonus_action' | 'reaction' };
  range?: { type: 'self' | 'touch' | 'ranged' | 'special'; distance: number };
  duration?: {
    type: 'instantaneous' | 'timed' | 'special' | 'until_dispelled' | 'until_dispelled_or_triggered';
    value: number;
    unit: 'round' | 'minute' | 'hour' | 'day';
    concentration: boolean;
  };
  components?: {
    material: boolean;
    materialDescription?: string;
    materialCost?: number;
    isConsumed?: boolean;
  };
}

const REPAIRS: Record<string, TopLevelRepair> = {
  'level-4/find-greater-steed': {
    school: 'Conjuration',
    castingTime: { value: 10, unit: 'minute', combatCostType: 'action' },
    range: { type: 'ranged', distance: 30 },
  },
  'level-4/guardian-of-nature': {
    school: 'Transmutation',
    castingTime: { value: 1, unit: 'bonus_action', combatCostType: 'bonus_action' },
    range: { type: 'self', distance: 0 },
    duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
  },
  'level-4/shadow-of-moil': {
    school: 'Necromancy',
    range: { type: 'self', distance: 0 },
    duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
    components: { material: true },
  },
  'level-4/sickening-radiance': {
    range: { type: 'ranged', distance: 120 },
    duration: { type: 'timed', value: 10, unit: 'minute', concentration: true },
  },
  'level-4/storm-sphere': {
    range: { type: 'ranged', distance: 150 },
    duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
  },
  'level-4/summon-greater-demon': {
    school: 'Conjuration',
    range: { type: 'ranged', distance: 60 },
    duration: { type: 'timed', value: 1, unit: 'hour', concentration: true },
    components: { material: true },
  },
  'level-4/vitriolic-sphere': {
    range: { type: 'ranged', distance: 150 },
    components: { material: true },
  },
  'level-5/banishing-smite': {
    school: 'Conjuration',
    castingTime: { value: 1, unit: 'bonus_action', combatCostType: 'bonus_action' },
    range: { type: 'self', distance: 0 },
    duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
  },
  'level-5/control-winds': {
    school: 'Transmutation',
    range: { type: 'ranged', distance: 300 },
    duration: { type: 'timed', value: 1, unit: 'hour', concentration: true },
  },
  'level-4/galders-speedy-courier': {
    school: 'Conjuration',
    range: { type: 'ranged', distance: 10 },
    duration: { type: 'timed', value: 10, unit: 'minute', concentration: false },
  },
  'level-4/staggering-smite': {
    school: 'Enchantment',
    duration: { type: 'instantaneous', value: 0, unit: 'round', concentration: false },
  },
  'level-5/temporal-shunt': {
    school: 'Transmutation',
    castingTime: { value: 1, unit: 'reaction', combatCostType: 'reaction' },
    range: { type: 'ranged', distance: 120 },
    duration: { type: 'timed', value: 1, unit: 'round', concentration: false },
  },
  'level-7/tether-essence': {
    school: 'Necromancy',
    range: { type: 'ranged', distance: 60 },
    duration: { type: 'timed', value: 1, unit: 'hour', concentration: true },
    components: {
      material: true,
      materialDescription: 'a length of platinum cord worth at least 250 gp, which the spell consumes',
      materialCost: 250,
      isConsumed: true,
    },
  },
  'level-4/gravity-sinkhole': {
    range: { type: 'ranged', distance: 120 },
    components: { material: true, materialDescription: 'a black marble' },
  },
};

// ============================================================================
// Shared Rendering Helpers
// ============================================================================
// This section mirrors the current markdown field vocabulary. The goal is not
// to redesign the spell docs while fixing this bucket; the goal is to keep the
// repaired JSON and markdown aligned in the existing structured format.
// ============================================================================

const FIELD_GROUPS: string[][] = [
  ['Level', 'School', 'Ritual', 'Classes', 'Sub-Classes'],
  ['Casting Time Value', 'Casting Time Unit', 'Combat Cost', 'Reaction Trigger'],
  ['Range Type', 'Range Distance', 'Targeting Type', 'Targeting Max', 'Valid Targets', 'Target Filter Creature Types', 'Line of Sight'],
  ['Verbal', 'Somatic', 'Material', 'Material Description', 'Material Cost GP', 'Consumed'],
  ['Duration Type', 'Duration Value', 'Duration Unit', 'Concentration'],
  ['Effect Type', 'Utility Type', 'Save Stat', 'Save Outcome', 'Damage Dice', 'Damage Type', 'Healing Dice', 'Temporary HP', 'Terrain Type', 'Defense Type', 'Light Bright Radius', 'Light Dim Radius'],
];

function normalizeBoolean(value: unknown): string {
  return value ? 'true' : 'false';
}

function normalizeNumber(value: unknown): string {
  return typeof value === 'number' ? String(value) : '';
}

function normalizeList(value: unknown): string {
  return Array.isArray(value) ? value.map((entry) => String(entry)).join(', ') : '';
}

function normalizeOptionalList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return 'None';
  return value.map((entry) => String(entry)).join(', ');
}

function normalizeOptionalText(value: unknown): string {
  if (typeof value !== 'string') return 'None';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'None';
}

function getPrimaryEffect(spell: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(spell.effects) || spell.effects.length === 0) return null;
  const first = spell.effects[0];
  return typeof first === 'object' && first !== null ? first as Record<string, unknown> : null;
}

function buildStructuredFieldMap(spell: Record<string, unknown>): Map<string, string> {
  const fields = new Map<string, string>();
  const primaryEffect = getPrimaryEffect(spell);
  const castingTime = (spell.castingTime ?? {}) as Record<string, unknown>;
  const range = (spell.range ?? {}) as Record<string, unknown>;
  const targeting = (spell.targeting ?? {}) as Record<string, unknown>;
  const components = (spell.components ?? {}) as Record<string, unknown>;
  const duration = (spell.duration ?? {}) as Record<string, unknown>;
  const combatCost = (castingTime.combatCost ?? {}) as Record<string, unknown>;
  const filter = (targeting.filter ?? {}) as Record<string, unknown>;

  fields.set('Level', normalizeNumber(spell.level));
  fields.set('School', typeof spell.school === 'string' ? spell.school : '');
  fields.set('Ritual', normalizeBoolean(spell.ritual));
  fields.set('Classes', normalizeList(spell.classes));
  fields.set('Sub-Classes', normalizeOptionalList(spell.subClasses));

  fields.set('Casting Time Value', normalizeNumber(castingTime.value));
  fields.set('Casting Time Unit', typeof castingTime.unit === 'string' ? castingTime.unit : '');
  fields.set('Combat Cost', typeof combatCost.type === 'string' ? combatCost.type : '');

  const reactionTrigger = typeof castingTime.reactionCondition === 'string' && castingTime.reactionCondition.trim()
    ? castingTime.reactionCondition.trim()
    : typeof combatCost.condition === 'string'
      ? combatCost.condition.trim()
      : '';
  if (reactionTrigger) {
    fields.set('Reaction Trigger', reactionTrigger);
  }

  fields.set('Range Type', typeof range.type === 'string' ? range.type : '');
  if (typeof range.distance === 'number' && range.distance > 0) {
    fields.set('Range Distance', String(range.distance));
  }

  fields.set('Targeting Type', typeof targeting.type === 'string' ? targeting.type : '');
  if (typeof targeting.maxTargets === 'number' && targeting.maxTargets > 1) {
    fields.set('Targeting Max', String(targeting.maxTargets));
  }
  fields.set('Valid Targets', normalizeList(targeting.validTargets));
  if (Array.isArray(filter.creatureTypes) && filter.creatureTypes.length > 0) {
    fields.set('Target Filter Creature Types', normalizeList(filter.creatureTypes));
  }
  fields.set('Line of Sight', normalizeBoolean(targeting.lineOfSight));

  fields.set('Verbal', normalizeBoolean(components.verbal));
  fields.set('Somatic', normalizeBoolean(components.somatic));
  fields.set('Material', normalizeBoolean(components.material));
  if (components.material && typeof components.materialDescription === 'string' && components.materialDescription.trim()) {
    fields.set('Material Description', components.materialDescription);
  }
  if (typeof components.materialCost === 'number' && components.materialCost > 0) {
    fields.set('Material Cost GP', String(components.materialCost));
  }
  if (components.isConsumed === true) {
    fields.set('Consumed', 'true');
  }

  fields.set('Duration Type', typeof duration.type === 'string' ? duration.type : '');
  if (typeof duration.value === 'number' && duration.value > 0) {
    fields.set('Duration Value', String(duration.value));
  }
  if (typeof duration.unit === 'string' && typeof duration.value === 'number' && duration.value > 0) {
    fields.set('Duration Unit', duration.unit);
  }
  fields.set('Concentration', normalizeBoolean(duration.concentration));

  if (primaryEffect) {
    const condition = (primaryEffect.condition ?? {}) as Record<string, unknown>;
    const damage = (primaryEffect.damage ?? {}) as Record<string, unknown>;
    const healing = (primaryEffect.healing ?? {}) as Record<string, unknown>;
    const light = (primaryEffect.light ?? {}) as Record<string, unknown>;

    fields.set('Effect Type', typeof primaryEffect.type === 'string' ? primaryEffect.type : '');
    if (typeof primaryEffect.utilityType === 'string' && primaryEffect.utilityType.trim()) {
      fields.set('Utility Type', primaryEffect.utilityType);
    }
    if (condition.type === 'save') {
      fields.set('Save Stat', typeof condition.saveType === 'string' ? condition.saveType : 'None');
      fields.set('Save Outcome', typeof condition.saveEffect === 'string' ? condition.saveEffect : 'none');
    }
    if (primaryEffect.type === 'DAMAGE') {
      fields.set('Damage Dice', typeof damage.dice === 'string' ? damage.dice : '');
      fields.set('Damage Type', typeof damage.type === 'string' ? damage.type : '');
    }
    if (primaryEffect.type === 'HEALING') {
      fields.set('Healing Dice', typeof healing.dice === 'string' ? healing.dice : '');
      if (typeof healing.isTemporaryHp === 'boolean') {
        fields.set('Temporary HP', normalizeBoolean(healing.isTemporaryHp));
      }
    }
    if (typeof primaryEffect.terrainType === 'string' && primaryEffect.terrainType.trim()) {
      fields.set('Terrain Type', primaryEffect.terrainType);
    }
    if (typeof primaryEffect.defenseType === 'string' && primaryEffect.defenseType.trim()) {
      fields.set('Defense Type', primaryEffect.defenseType);
    }
    if (primaryEffect.type === 'UTILITY' && primaryEffect.utilityType === 'light') {
      if (typeof light.brightRadius === 'number' && light.brightRadius > 0) {
        fields.set('Light Bright Radius', String(light.brightRadius));
      }
      if (typeof light.dimRadius === 'number' && light.dimRadius > 0) {
        fields.set('Light Dim Radius', String(light.dimRadius));
      }
    }
  }

  return fields;
}

function toHeadingName(rawName: unknown, fallbackSpellId: string): string {
  if (typeof rawName === 'string' && rawName.trim()) return rawName.trim();
  return fallbackSpellId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function renderSpellMarkdown(spellId: string, spell: Record<string, unknown>): string {
  const headingName = toHeadingName(spell.name, spellId);
  const structuredFields = buildStructuredFieldMap(spell);
  const lines: string[] = [`# ${headingName}`];

  for (const group of FIELD_GROUPS) {
    const groupLines: string[] = [];
    for (const fieldName of group) {
      if (!structuredFields.has(fieldName)) continue;
      groupLines.push(`- **${fieldName}**: ${structuredFields.get(fieldName) ?? ''}`);
    }
    if (groupLines.length === 0) continue;
    lines.push(...groupLines, '');
  }

  lines.push(`- **Description**: ${normalizeOptionalText(spell.description)}`);
  lines.push(`- **Higher Levels**: ${normalizeOptionalText(spell.higherLevels)}`);
  return `${lines.join('\n').trimEnd()}\n`;
}

// ============================================================================
// Repair Application
// ============================================================================
// This section applies the top-level repair map to the chosen spell JSON files,
// then rewrites the matching markdown references from the updated JSON so the
// parity layer stays in sync immediately.
// ============================================================================

function applyRepair(levelFolder: string, spellId: string, repair: TopLevelRepair): void {
  const jsonPath = path.join(SPELL_JSON_ROOT, levelFolder, `${spellId}.json`);
  const markdownPath = path.join(SPELL_MARKDOWN_ROOT, levelFolder, `${spellId}.md`);
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;

  if (repair.school) {
    parsed.school = repair.school;
  }

  if (repair.castingTime) {
    const castingTime = (parsed.castingTime ?? {}) as Record<string, unknown>;
    const combatCost = (castingTime.combatCost ?? {}) as Record<string, unknown>;
    castingTime.value = repair.castingTime.value;
    castingTime.unit = repair.castingTime.unit;
    combatCost.type = repair.castingTime.combatCostType;
    castingTime.combatCost = combatCost;
    parsed.castingTime = castingTime;
  }

  if (repair.range) {
    const range = (parsed.range ?? {}) as Record<string, unknown>;
    range.type = repair.range.type;
    range.distance = repair.range.distance;
    parsed.range = range;
  }

  if (repair.duration) {
    parsed.duration = {
      ...(parsed.duration as Record<string, unknown> ?? {}),
      type: repair.duration.type,
      value: repair.duration.value,
      unit: repair.duration.unit,
      concentration: repair.duration.concentration,
    };
  }

  if (repair.components) {
    const components = (parsed.components ?? {}) as Record<string, unknown>;
    components.material = repair.components.material;
    if (repair.components.materialDescription !== undefined) {
      components.materialDescription = repair.components.materialDescription;
    }
    if (repair.components.materialCost !== undefined) {
      components.materialCost = repair.components.materialCost;
    }
    if (repair.components.isConsumed !== undefined) {
      components.isConsumed = repair.components.isConsumed;
    }
    parsed.components = components;
  }

  fs.writeFileSync(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, renderSpellMarkdown(spellId, parsed), 'utf8');
  console.log(`Repaired top-level defaults for ${levelFolder}/${spellId}`);
}

// ============================================================================
// Execution
// ============================================================================
// This section applies the grouped repair pass in a stable order so the run is
// easy to audit and easy to repeat later if the map changes.
// ============================================================================

for (const [key, repair] of Object.entries(REPAIRS)) {
  const [levelFolder, spellId] = key.split('/');
  applyRepair(levelFolder, spellId, repair);
}
