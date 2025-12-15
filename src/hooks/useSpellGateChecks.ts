// TODO: Create automated validation scripts to check spell data consistency between JSON and Markdown files before deployment
import { useEffect, useMemo, useState } from "react";
import { GlossaryEntry } from "../types";
import { ENV } from "../config/env";
import level1GapsMd from "../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw";
import cantripGapsMd from "../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw";

const normalizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type GateStatus = "pass" | "gap" | "fail";

export interface LayoutChecks {
  hasSpellCard: boolean;
  hasHeader: boolean;
  hasStatsGrid: boolean;
  hasDescription: boolean;
  hasTagsSection: boolean;
  usesMarkdownFormat: boolean; // Detects incorrect ## or - **bold:** markdown format
}

/** Tracks discrepancies between MD file values and JSON-derived values */
export interface FieldDiscrepancy {
  field: string;
  mdValue: string;
  jsonValue: string;
}

export interface GateChecklist {
  manifestPathOk: boolean;
  glossaryExists: boolean;
  levelTagOk: boolean;
  layoutOk: boolean;
  knownGap: boolean;
  fieldsMatch: boolean; // New: MD fields match JSON-derived values
}

export interface GateResult {
  status: GateStatus;
  reasons: string[];
  level?: number;
  checklist: GateChecklist;
  layout?: LayoutChecks;
  discrepancies?: FieldDiscrepancy[]; // New: list of field mismatches
}

const extractIdsFromMarkdown = (md: string): Set<string> => {
  const ids = new Set<string>();

  // Bolded spell names: **Spell Name**
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  // Inline code identifiers: `spell-id`
  const codeRegex = /`([^`]+?)`/g;
  while ((match = codeRegex.exec(md)) !== null) {
    ids.add(normalizeId(match[1]));
  }

  return ids;
};

const buildKnownGapSet = (): Set<string> => {
  const set = new Set<string>();
  extractIdsFromMarkdown(level1GapsMd).forEach(id => set.add(id));
  extractIdsFromMarkdown(cantripGapsMd).forEach(id => set.add(id));
  return set;
};

const fetchGlossaryCard = async (id: string, level: number) => {
  const url = `${ENV.BASE_URL}data/glossary/entries/spells/level-${level}/${id}.md`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
};

const parseFrontmatter = (raw: string) => {
  const fmMatch = /^---\s*([\s\S]*?)\s*---/m.exec(raw);
  if (!fmMatch) return null;
  const block = fmMatch[1];
  const tagsMatch = /tags:\s*\[(.*?)\]/s.exec(block);
  const idMatch = /id:\s*["']?([a-z0-9\-_]+)["']?/i.exec(block);
  const tags = tagsMatch
    ? tagsMatch[1]
      .split(",")
      .map(t => t.trim().replace(/['"]/g, ""))
      .filter(Boolean)
    : [];
  const id = idMatch ? idMatch[1] : null;
  return { id, tags };
};

/**
 * Parse a specific field value from the spell-card HTML in the MD file
 * Extracts: <span class="spell-card-stat-label">LABEL</span>
 *           <span class="spell-card-stat-value">VALUE</span>
 */
const parseFieldFromMd = (content: string, fieldLabel: string): string | null => {
  // Match the pattern: label span followed by value span within the same stat div
  const regex = new RegExp(
    `<span class="spell-card-stat-label">${fieldLabel}</span>\\s*` +
    `<span class="spell-card-stat-value">([^<]+)</span>`,
    'i'
  );
  const match = regex.exec(content);
  return match ? match[1].trim() : null;
};

/** Fetch spell JSON data */
const fetchSpellJson = async (id: string, level: number): Promise<any | null> => {
  const url = `${ENV.BASE_URL}data/spells/level-${level}/${id}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  } catch {
    return null;
  }
};

/**
 * Compute expected Range/Area from JSON data
 * Self-range spells with weapon reach (targeting.range) show that range
 * Otherwise: self = "Self", touch = "Touch", ranged shows distance
 */
const computeRangeFromJson = (json: any): string => {
  const range = json.range;
  const targeting = json.targeting;

  if (!range) return 'Self';

  // Melee blade cantrips: range is "self" but targeting.range specifies weapon reach
  if (range.type === 'self') {
    if (targeting?.range) {
      return `${targeting.range} ft.`;
    }
    return 'Self';
  }
  if (range.type === 'touch') return 'Touch';

  // Ranged spells
  if (range.distance) {
    return `${range.distance} ft.`;
  }

  return range.type || 'Self';
};

/**
 * Compute expected Attack/Save from JSON data
 * Uses tags, targeting.type, and range to determine melee vs ranged
 * 5ft range is always considered Melee
 */
const computeAttackSaveFromJson = (json: any): string => {
  const effects = json.effects;
  const tags = json.tags;
  const targeting = json.targeting;
  const range = json.range;

  if (!effects || effects.length === 0) return 'None';

  for (const effect of effects) {
    if (effect.condition?.type === 'hit') {
      // Check tags first (most reliable indicator)
      if (tags?.includes('melee')) return 'Melee';
      // Check targeting type
      if (targeting?.type === 'melee') return 'Melee';
      // 5ft range is always melee
      if (targeting?.range === 5 || range?.distance === 5) return 'Melee';
      // Ranged spells
      if (range?.type === 'ranged' || (range?.distance && range.distance > 10)) return 'Ranged';
      // Self-range with targeting.range typically means melee weapon reach
      if (range?.type === 'self' && targeting?.range) return 'Melee';
      // Default to Ranged for spell attacks without melee indicators
      return 'Ranged';
    }
    if (effect.condition?.type === 'save' && effect.condition.saveType) {
      const saveType = effect.condition.saveType;
      return `${saveType.slice(0, 3).toUpperCase()} Save`;
    }
  }

  return 'None';
};

/** Compute Level display (Cantrip vs 1st, 2nd, etc.) */
const computeLevelFromJson = (json: any): string => {
  const level = json.level;
  if (level === 0) return 'Cantrip';
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const suffix = suffixes[level] || 'th';
  return `${level}${suffix}`;
};

/** Compute Casting Time display */
const computeCastingTimeFromJson = (json: any): string => {
  const ct = json.castingTime;
  if (!ct) return '1 Action';
  const unitCap = ct.unit.charAt(0).toUpperCase() + ct.unit.slice(1);
  return `${ct.value} ${unitCap}`;
};

/** Compute Components display */
const computeComponentsFromJson = (json: any): string => {
  const c = json.components;
  if (!c) return 'V, S';
  const parts: string[] = [];
  if (c.verbal) parts.push('V');
  if (c.somatic) parts.push('S');
  if (c.material) parts.push(c.materialDescription ? 'M *' : 'M');
  return parts.join(', ') || 'None';
};

/** Compute Duration display */
const computeDurationFromJson = (json: any): string => {
  const d = json.duration;
  if (!d) return 'Instantaneous';
  if (d.type === 'instantaneous') return 'Instantaneous';

  let result = '';
  if (d.value && d.unit) {
    const unitCap = d.unit.charAt(0).toUpperCase() + d.unit.slice(1);
    result = `${d.value} ${unitCap}${d.value > 1 ? 's' : ''}`;
  } else {
    result = d.type.charAt(0).toUpperCase() + d.type.slice(1);
  }

  if (d.concentration) {
    result = `Up to ${result} (Concentration)`;
  }
  return result;
};

/** Compute Damage/Effect display */
const computeDamageEffectFromJson = (json: any): string => {
  const effects = json.effects;
  if (!effects || effects.length === 0) return 'Utility';

  for (const effect of effects) {
    if (effect.type === 'DAMAGE' && effect.damage?.type) {
      return effect.damage.type;
    }
    if (effect.type === 'HEALING') return 'Healing';
    if (effect.type === 'DEFENSIVE') return 'Defense';
    if (effect.type === 'STATUS_CONDITION') return 'Control';
  }
  return 'Utility';
};

/**
 * Compare MD values with JSON-derived values and return discrepancies
 * Checks all 8 spell card fields
 */
const compareFields = async (
  mdContent: string,
  id: string,
  level: number
): Promise<FieldDiscrepancy[]> => {
  const discrepancies: FieldDiscrepancy[] = [];

  const json = await fetchSpellJson(id, level);
  if (!json) return discrepancies; // Can't compare without JSON

  // Define all fields to compare: [label, computeFunction]
  const fieldChecks: Array<{ label: string; compute: (j: any) => string }> = [
    { label: 'Level', compute: computeLevelFromJson },
    { label: 'Casting Time', compute: computeCastingTimeFromJson },
    { label: 'Range/Area', compute: computeRangeFromJson },
    { label: 'Components', compute: computeComponentsFromJson },
    { label: 'Duration', compute: computeDurationFromJson },
    { label: 'School', compute: (j) => j.school || 'Unknown' },
    { label: 'Attack/Save', compute: computeAttackSaveFromJson },
    { label: 'Damage/Effect', compute: computeDamageEffectFromJson },
  ];

  for (const { label, compute } of fieldChecks) {
    const mdValue = parseFieldFromMd(mdContent, label);
    const jsonValue = compute(json);

    if (mdValue && mdValue.toLowerCase() !== jsonValue.toLowerCase()) {
      discrepancies.push({
        field: label,
        mdValue: mdValue,
        jsonValue: jsonValue,
      });
    }
  }

  return discrepancies;
};

export const useSpellGateChecks = (entries: GlossaryEntry[] | null) => {
  const [results, setResults] = useState<Record<string, GateResult>>({});

  const knownGaps = useMemo(buildKnownGapSet, []);
  const entryMap = useMemo(() => {
    const map = new Map<string, GlossaryEntry>();
    (entries || []).forEach(e => map.set(e.id, e));
    return map;
  }, [entries]);

  useEffect(() => {
    if (!entries) return;

    const run = async () => {
      try {
        const res = await fetch(`${ENV.BASE_URL}data/spells_manifest.json`);
        if (!res.ok) throw new Error(`Failed to load spells_manifest.json: ${res.statusText}`);
        const manifest = await res.json();

        const next: Record<string, GateResult> = {};
        await Promise.all(Object.entries<any>(manifest).map(async ([id, data]) => {
          const level = data.level;
          if (typeof level !== "number") return;

          const checklist: GateChecklist = {
            manifestPathOk: false,
            glossaryExists: false,
            levelTagOk: false,
            layoutOk: false,
            knownGap: knownGaps.has(id),
            fieldsMatch: true, // Assume true until proven otherwise
          };
          const reasons: string[] = [];
          let status: GateStatus = "pass";
          let discrepancies: FieldDiscrepancy[] = [];

          if (data.path && data.path.includes(`/level-${level}/`)) {
            checklist.manifestPathOk = true;
          } else {
            status = "fail";
            reasons.push("Path not in expected level folder");
          }

          let tags: string[] = [];
          let cardFound = false;
          let cardContent: string | null = null;

          // Always fetch the card content to check layout
          cardContent = await fetchGlossaryCard(id, level);

          if (cardContent) {
            cardFound = true;
            const fm = parseFrontmatter(cardContent);
            if (fm?.id && normalizeId(fm.id) === id) {
              tags = (fm.tags || []).map(t => t.toLowerCase());
            }
          } else {
            // Fallback to context entry for tags if fetch failed
            const entry = entryMap.get(id);
            if (entry) {
              cardFound = true;
              tags = entry.tags?.map(t => t.toLowerCase()) || [];
            }
          }

          if (cardFound) {
            checklist.glossaryExists = true;
          } else {
            status = "fail";
            reasons.push("No glossary card found");
          }

          // Check for correct spell-card HTML layout
          if (cardContent && cardContent.includes('<div class="spell-card">') && cardContent.includes('spell-card-stats-grid')) {
            checklist.layoutOk = true;
          } else if (cardFound) {
            status = "fail";
            reasons.push("Incorrect layout (missing spell-card HTML)");
          }

          const levelTag = `level ${level}`;
          const levelTagAlt = `level-${level}`;
          if (tags.some(t => t === levelTag || t === levelTagAlt || t === `level${level}`)) {
            checklist.levelTagOk = true;
          } else {
            status = "fail";
            reasons.push("Missing level tag in glossary card");
          }

          // Check for MD vs JSON field discrepancies
          if (cardContent) {
            discrepancies = await compareFields(cardContent, id, level);
            if (discrepancies.length > 0) {
              checklist.fieldsMatch = false;
              status = "fail";
              for (const d of discrepancies) {
                reasons.push(`${d.field}: MD="${d.mdValue}" ≠ JSON="${d.jsonValue}"`);
              }
            }
          }

          if (checklist.knownGap) {
            if (status === "pass") status = "gap";
            reasons.push("Known schema gap (see gap log)");
          }

          next[id] = { status, reasons, level, checklist, discrepancies };
        }));

        setResults(next);
      } catch (err) {
        console.error("Spell gate check failed:", err);
        setResults({});
      }
    };

    run();
  }, [entries, entryMap, knownGaps]);

  return results;
};
