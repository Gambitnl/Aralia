import fs from 'fs';
import path from 'path';

/**
 * This script fills in missing spell geometry unit fields by reading the spell
 * reference markdown that already exists beside the runtime JSON.
 *
 * It exists because the spell model now supports explicit units for range and
 * area geometry, but much of the corpus still relied on the older implicit
 * "feet unless stated otherwise" convention. The broader markdown-to-JSON sync
 * script touches many unrelated spell fields, so this narrower tool only adds
 * unit fields that are currently missing.
 *
 * Called manually during the spell-truth range/area lane.
 * Depends on: `docs/spells/reference` for the interpreted and canonical values,
 * and `public/data/spells` for the runtime JSON that the glossary renders.
 */

// ============================================================================
// Paths And Small Shared Helpers
// ============================================================================
// This section locates the spell JSON corpus and the matching spell reference
// markdown files, then provides a few tiny helpers for normalization.
// ============================================================================

const SPELLS_ROOT = path.join(process.cwd(), 'public', 'data', 'spells');
const REFERENCES_ROOT = path.join(process.cwd(), 'docs', 'spells', 'reference');

type DistanceUnit = 'feet' | 'miles' | 'inches';
type SpatialMeasuredUnit = DistanceUnit | 'gallons' | 'minutes';

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const isNilish = (value: string | undefined | null) => {
  if (value == null) return true;
  const normalized = normalizeWhitespace(String(value)).toLowerCase();
  return normalized === '' || normalized === 'none' || normalized === 'n/a' || normalized === 'na' || normalized === 'null';
};

const normalizeDistanceUnit = (raw: string | undefined | null): DistanceUnit | undefined => {
  if (isNilish(raw)) return undefined;
  const value = normalizeWhitespace(String(raw)).toLowerCase();
  if (value === 'foot' || value === 'feet' || value === 'ft' || value === 'ft.') return 'feet';
  if (value === 'mile' || value === 'miles' || value === 'm') return 'miles';
  if (value === 'inch' || value === 'inches' || value === 'in') return 'inches';
  return undefined;
};

const normalizeMeasuredUnit = (raw: string | undefined | null): SpatialMeasuredUnit | undefined => {
  const distanceUnit = normalizeDistanceUnit(raw);
  if (distanceUnit) return distanceUnit;
  if (isNilish(raw)) return undefined;
  const value = normalizeWhitespace(String(raw)).toLowerCase();
  if (value === 'gallon' || value === 'gallons') return 'gallons';
  if (value === 'minute' || value === 'minutes') return 'minutes';
  return undefined;
};

const listSpellFiles = () =>
  fs
    .readdirSync(SPELLS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('level-'))
    .flatMap(levelDir => {
      const levelPath = path.join(SPELLS_ROOT, levelDir.name);
      return fs
        .readdirSync(levelPath)
        .filter(fileName => fileName.endsWith('.json'))
        .map(fileName => ({
          level: levelDir.name,
          jsonPath: path.join(levelPath, fileName),
          referencePath: path.join(REFERENCES_ROOT, levelDir.name, fileName.replace(/\.json$/i, '.md')),
        }));
    });

// ============================================================================
// Markdown Parsing
// ============================================================================
// The reference markdown already stores the interpreted spell fields we trust
// for this lane. This parser reads those labeled lines and also captures the
// raw canonical `Range/Area` line as a fallback when the structured block does
// not spell the unit out directly.
// ============================================================================

type ReferenceContext = {
  fields: Record<string, string>;
  canonicalRangeArea?: string;
  spatialDetailUnits: Map<string, SpatialMeasuredUnit>;
};

const parseReferenceContext = (referencePath: string): ReferenceContext | undefined => {
  if (!fs.existsSync(referencePath)) return undefined;

  const text = fs.readFileSync(referencePath, 'utf8');
  const fields: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const match = /^- \*\*(.+?)\*\*: ?(.*)$/.exec(line);
    if (!match) continue;
    fields[match[1].trim()] = match[2].trim();
  }

  const spatialDetailUnits = new Map<string, SpatialMeasuredUnit>();

  // Pair each structured spatial detail label with its explicit unit so runtime
  // measured details can inherit it without guessing.
  for (let index = 1; index <= 50; index += 1) {
    const label = fields[`Spatial Detail ${index} Label`];
    const unit = normalizeMeasuredUnit(fields[`Spatial Detail ${index} Unit`]);
    if (label && unit) {
      spatialDetailUnits.set(label, unit);
    }
  }

  let canonicalRangeArea: string | undefined;
  const canonicalMatch = /<!--([\s\S]*?)-->/.exec(text);
  if (canonicalMatch) {
    const rangeMatch = /Range\/Area:\s*(.+)/.exec(canonicalMatch[1]);
    canonicalRangeArea = rangeMatch ? normalizeWhitespace(rangeMatch[1]) : undefined;
  }

  return { fields, canonicalRangeArea, spatialDetailUnits };
};

// ============================================================================
// Unit Resolution
// ============================================================================
// This section turns the structured markdown and canonical header clues into a
// concrete unit choice for each runtime field. The resolution order is:
// 1. explicit structured field unit
// 2. canonical `Range/Area` line
// 3. conservative fallback (`feet`) only for geometry fields that are already
//    stored numerically in the runtime model.
// ============================================================================

const inferDistanceUnitFromCanonicalRange = (rangeArea: string | undefined): DistanceUnit | undefined => {
  if (!rangeArea) return undefined;
  if (/\bmile\b|\bmiles\b/i.test(rangeArea)) return 'miles';
  if (/\bfeet\b|\bfoot\b|\bft\./i.test(rangeArea)) return 'feet';
  if (/\binch\b|\binches\b/i.test(rangeArea)) return 'inches';
  return undefined;
};

const resolveRangeUnit = (context: ReferenceContext | undefined): DistanceUnit | undefined => {
  if (!context) return undefined;
  return (
    normalizeDistanceUnit(context.fields['Range Distance Unit']) ??
    normalizeDistanceUnit(context.fields['Targeting Range Unit']) ??
    normalizeDistanceUnit(context.fields['Range Unit']) ??
    inferDistanceUnitFromCanonicalRange(context.canonicalRangeArea)
  );
};

const resolveTargetingRangeUnit = (context: ReferenceContext | undefined): DistanceUnit | undefined => {
  if (!context) return undefined;
  return (
    normalizeDistanceUnit(context.fields['Targeting Range Unit']) ??
    normalizeDistanceUnit(context.fields['Range Distance Unit']) ??
    normalizeDistanceUnit(context.fields['Range Unit']) ??
    inferDistanceUnitFromCanonicalRange(context.canonicalRangeArea)
  );
};

const resolveAreaUnit = (context: ReferenceContext | undefined, fieldName: string): DistanceUnit | undefined => {
  if (!context) return undefined;

  const structuredFieldMap: Record<string, string> = {
    sizeUnit: 'Area Size Unit',
    heightUnit: 'Area Height Unit',
    widthUnit: 'Area Width Unit',
    thicknessUnit: 'Area Thickness Unit',
  };

  return normalizeDistanceUnit(context.fields[structuredFieldMap[fieldName]]) ?? 'feet';
};

const resolveSpatialMeasuredUnit = (
  context: ReferenceContext | undefined,
  label: string | undefined,
  kind: string | undefined
): SpatialMeasuredUnit | undefined => {
  if (!context || !label) return undefined;
  const structuredUnit = context.spatialDetailUnits.get(label);
  if (structuredUnit) return structuredUnit;

  const normalizedKind = normalizeWhitespace(kind ?? '').toLowerCase();
  if (normalizedKind === 'count') return undefined;
  if (normalizedKind === 'time') return 'minutes';
  if (normalizedKind === 'thickness') return 'inches';
  return 'feet';
};

// ============================================================================
// Ordered Object Mutation
// ============================================================================
// JSON key order is part of how these data files stay readable. These helpers
// insert unit fields immediately after the numeric fields they describe instead
// of appending everything at the end of the object.
// ============================================================================

const insertAfterKey = <T extends Record<string, unknown>>(
  source: T,
  afterKey: string,
  newKey: string,
  value: unknown
): T => {
  if (Object.prototype.hasOwnProperty.call(source, newKey)) return source;

  const ordered: Record<string, unknown> = {};

  for (const [key, existingValue] of Object.entries(source)) {
    ordered[key] = existingValue;
    if (key === afterKey) {
      ordered[newKey] = value;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(ordered, newKey)) {
    ordered[newKey] = value;
  }

  return ordered as T;
};

// ============================================================================
// File-By-File Backfill
// ============================================================================
// This section walks every spell JSON file, looks up the matching reference
// markdown, and adds only the missing unit fields. No other spell fields are
// rewritten in this pass.
// ============================================================================

type MutableJson = Record<string, unknown>;

const addMissingGeometryUnits = (spell: MutableJson, context: ReferenceContext | undefined) => {
  let changed = false;

  const range = spell.range as MutableJson | undefined;
  if (range && typeof range.distance === 'number' && range.distance > 0 && !('distanceUnit' in range)) {
    const resolvedUnit = resolveRangeUnit(context) ?? 'feet';
    spell.range = insertAfterKey(range, 'distance', 'distanceUnit', resolvedUnit);
    changed = true;
  }

  const targeting = spell.targeting as MutableJson | undefined;
  if (targeting && typeof targeting.range === 'number' && targeting.range > 0 && !('rangeUnit' in targeting)) {
    const resolvedUnit = resolveTargetingRangeUnit(context) ?? 'feet';
    spell.targeting = insertAfterKey(targeting, 'range', 'rangeUnit', resolvedUnit);
    changed = true;
  }

  const liveTargeting = spell.targeting as MutableJson | undefined;
  const areaOfEffect = liveTargeting?.areaOfEffect as MutableJson | undefined;
  if (areaOfEffect) {
    for (const [numericField, unitField] of [
      ['size', 'sizeUnit'],
      ['height', 'heightUnit'],
      ['width', 'widthUnit'],
      ['thickness', 'thicknessUnit'],
    ] as const) {
      const numericValue = areaOfEffect[numericField];
      if (typeof numericValue === 'number' && numericValue > 0 && !(unitField in areaOfEffect)) {
        const resolvedUnit = resolveAreaUnit(context, unitField);
        if (resolvedUnit) {
          const nextArea = insertAfterKey(areaOfEffect, numericField, unitField, resolvedUnit);
          (spell.targeting as MutableJson).areaOfEffect = nextArea;
          changed = true;
        }
      }
    }
  }

  const liveSpatialDetails = (spell.targeting as MutableJson | undefined)?.spatialDetails as MutableJson | undefined;
  const measuredDetails = liveSpatialDetails?.measuredDetails as Array<MutableJson> | undefined;
  if (Array.isArray(measuredDetails)) {
    const nextMeasuredDetails = measuredDetails.map(detail => {
      if (!detail || typeof detail !== 'object') return detail;
      if (detail.unit != null) return detail;
      if (typeof detail.value !== 'number' || detail.value <= 0) return detail;

      const resolvedUnit = resolveSpatialMeasuredUnit(context, detail.label as string | undefined, detail.kind as string | undefined);
      if (!resolvedUnit) return detail;

      changed = true;
      return insertAfterKey(detail, 'value', 'unit', resolvedUnit);
    });

    (spell.targeting as MutableJson).spatialDetails = {
      ...(liveSpatialDetails ?? {}),
      measuredDetails: nextMeasuredDetails,
    };
  }

  return changed;
};

const main = () => {
  let updatedFiles = 0;

  for (const { jsonPath, referencePath } of listSpellFiles()) {
    const spell = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as MutableJson;
    const referenceContext = parseReferenceContext(referencePath);
    const changed = addMissingGeometryUnits(spell, referenceContext);

    if (!changed) continue;

    fs.writeFileSync(jsonPath, JSON.stringify(spell, null, 2) + '\n', 'utf8');
    updatedFiles += 1;
  }

  console.log(`Backfilled explicit geometry units in ${updatedFiles} spell JSON files.`);
};

main();
