/**
 * This script makes implicit spell range/area units explicit in the runtime spell JSON files.
 *
 * It exists because the spell model now supports unit-bearing geometry, but a large part of
 * the live corpus still relies on older numeric fields like `range.distance = 60` or
 * `areaOfEffect.size = 20` without saying whether those numbers are feet, miles, or inches.
 * The glossary and gate checker render from the JSON layer, so the runtime corpus has to carry
 * those units directly instead of relying on formatter assumptions.
 *
 * Called manually during spell-truth normalization.
 * Reads from the spell reference markdown tree in `docs/spells/reference` for
 * structured/canonical unit hints.
 * Writes to the spell JSON tree in `public/data/spells` by adding only missing unit fields.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Paths And Shared Types
// ============================================================================
// These paths keep the script anchored to the two data surfaces involved in this
// backfill: the runtime spell JSON files and their matching spell reference docs.
// ============================================================================

const ROOT = process.cwd();
const SPELLS_ROOT = path.join(ROOT, 'public', 'data', 'spells');
const REFERENCES_ROOT = path.join(ROOT, 'docs', 'spells', 'reference');

type DistanceUnit = 'feet' | 'miles' | 'inches';
type SpatialMeasuredUnit = DistanceUnit | 'gallons' | 'minutes';

type SpellJson = Record<string, unknown>;
type LooseRecord = Record<string, unknown>;

type BackfillStats = {
  changedFiles: number;
  changedFields: number;
  unresolved: string[];
};

// ============================================================================
// Small Parsing Helpers
// ============================================================================
// The spell reference docs use a stable `- **Label**: value` format. These helpers
// let the script pull unit hints out of that surface without trying to understand
// the whole markdown file.
// ============================================================================

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readText = (filePath: string) => fs.readFileSync(filePath, 'utf8');

const writeText = (filePath: string, value: string) => fs.writeFileSync(filePath, value, 'utf8');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const getLabelValue = (markdown: string, label: string): string | undefined => {
  const match = markdown.match(new RegExp(`^- \\*\\*${escapeRegex(label)}\\*\\*:\\s*(.*)$`, 'mi'));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
};

const normalizeDistanceUnit = (raw: string | undefined): DistanceUnit | undefined => {
  const value = normalizeWhitespace(raw ?? '').toLowerCase();
  if (!value) return undefined;
  if (value === 'ft' || value === 'ft.' || value === 'foot' || value === 'feet') return 'feet';
  if (value === 'mile' || value === 'miles') return 'miles';
  if (value === 'inch' || value === 'inches') return 'inches';
  return undefined;
};

const normalizeMeasuredUnit = (raw: string | undefined): SpatialMeasuredUnit | undefined => {
  const distanceUnit = normalizeDistanceUnit(raw);
  if (distanceUnit) return distanceUnit;

  const value = normalizeWhitespace(raw ?? '').toLowerCase();
  if (!value) return undefined;
  if (value === 'gallon' || value === 'gallons') return 'gallons';
  if (value === 'minute' || value === 'minutes') return 'minutes';
  return undefined;
};

const getCanonicalRangeAreaLine = (markdown: string): string | undefined => {
  const match = markdown.match(/^Range\/Area:\s*(.+)$/mi);
  return match?.[1]?.trim() || undefined;
};

const inferUnitFromCanonicalRangeArea = (markdown: string): DistanceUnit | undefined => {
  const value = getCanonicalRangeAreaLine(markdown)?.toLowerCase();
  if (!value) return undefined;
  if (/\bmiles?\b/.test(value)) return 'miles';
  if (/\binches?\b/.test(value)) return 'inches';
  if (/\bft\.|\bfeet\b|\bfoot\b/.test(value)) return 'feet';
  return undefined;
};

// ============================================================================
// Reference-Driven Unit Inference
// ============================================================================
// The backfill prefers the structured markdown layer first, because that is the
// interpreted spell surface. If the structured block does not expose the unit yet,
// the script falls back to the canonical `Range/Area` line. Only plain geometry
// values default to feet, because that was the repo's long-standing convention.
// ============================================================================

const inferRangeUnit = (markdown: string): DistanceUnit | undefined => {
  return (
    normalizeDistanceUnit(getLabelValue(markdown, 'Range Distance Unit')) ??
    normalizeDistanceUnit(getLabelValue(markdown, 'Targeting Range Unit')) ??
    normalizeDistanceUnit(getLabelValue(markdown, 'Range Unit')) ??
    inferUnitFromCanonicalRangeArea(markdown)
  );
};

const inferAreaSizeUnit = (markdown: string): DistanceUnit => {
  return (
    normalizeDistanceUnit(getLabelValue(markdown, 'Area Size Unit')) ??
    normalizeDistanceUnit(getLabelValue(markdown, 'Area Unit')) ??
    'feet'
  );
};

const inferAreaHeightUnit = (markdown: string): DistanceUnit => {
  return normalizeDistanceUnit(getLabelValue(markdown, 'Area Height Unit')) ?? 'feet';
};

const inferAreaWidthUnit = (markdown: string): DistanceUnit => {
  return normalizeDistanceUnit(getLabelValue(markdown, 'Area Width Unit')) ?? 'feet';
};

const inferAreaThicknessUnit = (markdown: string): DistanceUnit => {
  return normalizeDistanceUnit(getLabelValue(markdown, 'Area Thickness Unit')) ?? 'feet';
};

const inferSpatialFormUnit = (
  markdown: string,
  index: number,
  fieldLabel: 'Size' | 'Height' | 'Width' | 'Thickness' | 'Segment Width' | 'Segment Height',
): DistanceUnit | undefined => {
  return normalizeDistanceUnit(getLabelValue(markdown, `Spatial Form ${index} ${fieldLabel} Unit`));
};

const inferSpatialMeasuredUnit = (markdown: string, index: number): SpatialMeasuredUnit | undefined => {
  return normalizeMeasuredUnit(getLabelValue(markdown, `Spatial Detail ${index} Unit`));
};

// ============================================================================
// Object Utilities
// ============================================================================
// JSON objects preserve insertion order, so these helpers rebuild the small nested
// objects we touch and place each new unit field directly after its numeric field.
// That keeps the runtime JSON readable instead of appending every unit key at the end.
// ============================================================================

const isPlainObject = (value: unknown): value is LooseRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const insertAfterKey = <T extends LooseRecord>(source: T, afterKey: string, newKey: string, newValue: unknown): T => {
  if (Object.prototype.hasOwnProperty.call(source, newKey)) return source;

  const next: LooseRecord = {};
  let inserted = false;

  for (const [key, value] of Object.entries(source)) {
    next[key] = value;
    if (key === afterKey) {
      next[newKey] = newValue;
      inserted = true;
    }
  }

  if (!inserted) {
    next[newKey] = newValue;
  }

  return next as T;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

// ============================================================================
// Per-Spell Backfill
// ============================================================================
// This section applies the minimal additive change to each spell: it only adds
// missing unit fields and leaves already-explicit units alone.
// ============================================================================

const backfillSpell = (spell: SpellJson, markdown: string, spellId: string): { changed: boolean; changedFields: number; unresolved: string[] } => {
  let changed = false;
  let changedFields = 0;
  const unresolved: string[] = [];

  const range = isPlainObject(spell.range) ? spell.range : undefined;
  if (range) {
    const distance = toNumber(range.distance);
    if (distance && !range.distanceUnit) {
      const unit = inferRangeUnit(markdown);
      if (!unit) {
        unresolved.push(`${spellId}: range.distanceUnit`);
      } else {
        spell.range = insertAfterKey(range, 'distance', 'distanceUnit', unit);
        changed = true;
        changedFields += 1;
      }
    }
  }

  const targeting = isPlainObject(spell.targeting) ? spell.targeting : undefined;
  if (targeting) {
    const targetingRange = toNumber(targeting.range);
    if (targetingRange && !targeting.rangeUnit) {
      const unit = inferRangeUnit(markdown);
      if (!unit) {
        unresolved.push(`${spellId}: targeting.rangeUnit`);
      } else {
        spell.targeting = insertAfterKey(targeting, 'range', 'rangeUnit', unit);
        changed = true;
        changedFields += 1;
      }
    }

    const nextTargeting = isPlainObject(spell.targeting) ? spell.targeting : targeting;
    const areaOfEffect = isPlainObject(nextTargeting.areaOfEffect) ? nextTargeting.areaOfEffect : undefined;
    if (areaOfEffect) {
      const size = toNumber(areaOfEffect.size);
      if (size && !areaOfEffect.sizeUnit) {
        nextTargeting.areaOfEffect = insertAfterKey(areaOfEffect, 'size', 'sizeUnit', inferAreaSizeUnit(markdown));
        changed = true;
        changedFields += 1;
      }

      const withSizeUnit = isPlainObject(nextTargeting.areaOfEffect) ? nextTargeting.areaOfEffect : areaOfEffect;
      const height = toNumber(withSizeUnit.height);
      if (height && !withSizeUnit.heightUnit) {
        nextTargeting.areaOfEffect = insertAfterKey(withSizeUnit, 'height', 'heightUnit', inferAreaHeightUnit(markdown));
        changed = true;
        changedFields += 1;
      }

      const withHeightUnit = isPlainObject(nextTargeting.areaOfEffect) ? nextTargeting.areaOfEffect : withSizeUnit;
      const width = toNumber(withHeightUnit.width);
      if (width && !withHeightUnit.widthUnit) {
        nextTargeting.areaOfEffect = insertAfterKey(withHeightUnit, 'width', 'widthUnit', inferAreaWidthUnit(markdown));
        changed = true;
        changedFields += 1;
      }

      const withWidthUnit = isPlainObject(nextTargeting.areaOfEffect) ? nextTargeting.areaOfEffect : withHeightUnit;
      const thickness = toNumber(withWidthUnit.thickness);
      if (thickness && !withWidthUnit.thicknessUnit) {
        nextTargeting.areaOfEffect = insertAfterKey(withWidthUnit, 'thickness', 'thicknessUnit', inferAreaThicknessUnit(markdown));
        changed = true;
        changedFields += 1;
      }
    }

    const spatialDetails = isPlainObject(nextTargeting.spatialDetails) ? nextTargeting.spatialDetails : undefined;
    if (spatialDetails) {
      if (Array.isArray(spatialDetails.forms)) {
        spatialDetails.forms = spatialDetails.forms.map((form, index) => {
          if (!isPlainObject(form)) return form;
          const formIndex = index + 1;
          let nextForm = form;

          const size = toNumber(nextForm.size);
          if (size && !nextForm.sizeUnit) {
            const unit = inferSpatialFormUnit(markdown, formIndex, 'Size') ?? 'feet';
            nextForm = insertAfterKey(nextForm, 'size', 'sizeUnit', unit);
            changed = true;
            changedFields += 1;
          }

          const height = toNumber(nextForm.height);
          if (height && !nextForm.heightUnit) {
            const unit = inferSpatialFormUnit(markdown, formIndex, 'Height') ?? 'feet';
            nextForm = insertAfterKey(nextForm, 'height', 'heightUnit', unit);
            changed = true;
            changedFields += 1;
          }

          const width = toNumber(nextForm.width);
          if (width && !nextForm.widthUnit) {
            const unit = inferSpatialFormUnit(markdown, formIndex, 'Width') ?? 'feet';
            nextForm = insertAfterKey(nextForm, 'width', 'widthUnit', unit);
            changed = true;
            changedFields += 1;
          }

          const thickness = toNumber(nextForm.thickness);
          if (thickness && !nextForm.thicknessUnit) {
            const unit = inferSpatialFormUnit(markdown, formIndex, 'Thickness') ?? 'feet';
            nextForm = insertAfterKey(nextForm, 'thickness', 'thicknessUnit', unit);
            changed = true;
            changedFields += 1;
          }

          const segmentWidth = toNumber(nextForm.segmentWidth);
          if (segmentWidth && !nextForm.segmentWidthUnit) {
            const unit = inferSpatialFormUnit(markdown, formIndex, 'Segment Width') ?? 'feet';
            nextForm = insertAfterKey(nextForm, 'segmentWidth', 'segmentWidthUnit', unit);
            changed = true;
            changedFields += 1;
          }

          const segmentHeight = toNumber(nextForm.segmentHeight);
          if (segmentHeight && !nextForm.segmentHeightUnit) {
            const unit = inferSpatialFormUnit(markdown, formIndex, 'Segment Height') ?? 'feet';
            nextForm = insertAfterKey(nextForm, 'segmentHeight', 'segmentHeightUnit', unit);
            changed = true;
            changedFields += 1;
          }

          return nextForm;
        });
      }

      if (Array.isArray(spatialDetails.measuredDetails)) {
        spatialDetails.measuredDetails = spatialDetails.measuredDetails.map((detail, index) => {
          if (!isPlainObject(detail)) return detail;

          const kind = normalizeWhitespace(String(detail.kind ?? '')).toLowerCase();
          const value = toNumber(detail.value);

          // Count-style details intentionally stay unitless. They describe how many
          // panels, pillars, or servants exist, not a distance that the engine has
          // to measure spatially.
          if (!value || detail.unit || kind === 'count') {
            return detail;
          }

          const unit = inferSpatialMeasuredUnit(markdown, index + 1);
          if (!unit) {
            unresolved.push(`${spellId}: targeting.spatialDetails.measuredDetails[${index}].unit`);
            return detail;
          }

          changed = true;
          changedFields += 1;
          return insertAfterKey(detail, 'value', 'unit', unit);
        });
      }
    }
  }

  return { changed, changedFields, unresolved };
};

// ============================================================================
// Script Orchestration
// ============================================================================
// This walks the spell corpus, applies the additive backfill, and prints a small
// report so the caller can see how close the corpus is to explicit geometry truth.
// ============================================================================

const collectSpellJsonPaths = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSpellJsonPaths(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results.sort();
};

const getReferencePathForSpell = (spellJsonPath: string) => {
  const levelDir = path.basename(path.dirname(spellJsonPath));
  const fileName = path.basename(spellJsonPath, '.json');
  return path.join(REFERENCES_ROOT, levelDir, `${fileName}.md`);
};

const main = () => {
  const dryRun = process.argv.includes('--dry-run');
  const stats: BackfillStats = { changedFiles: 0, changedFields: 0, unresolved: [] };

  for (const spellJsonPath of collectSpellJsonPaths(SPELLS_ROOT)) {
    const spell = JSON.parse(readText(spellJsonPath)) as SpellJson;
    const referencePath = getReferencePathForSpell(spellJsonPath);
    const markdown = fs.existsSync(referencePath) ? readText(referencePath) : '';
    const spellId = String(spell.id ?? path.basename(spellJsonPath, '.json'));

    const result = backfillSpell(spell, markdown, spellId);
    stats.changedFields += result.changedFields;
    stats.unresolved.push(...result.unresolved);

    if (!result.changed) continue;

    stats.changedFiles += 1;
    if (!dryRun) {
      writeText(spellJsonPath, `${JSON.stringify(spell, null, 2)}\n`);
    }
  }

  console.log(`Spell files changed: ${stats.changedFiles}`);
  console.log(`Unit fields added: ${stats.changedFields}`);
  console.log(`Unresolved fields: ${stats.unresolved.length}`);

  if (stats.unresolved.length) {
    console.log('\nUnresolved unit fields:');
    for (const entry of stats.unresolved) {
      console.log(`- ${entry}`);
    }
    process.exitCode = 1;
  }
};

main();
