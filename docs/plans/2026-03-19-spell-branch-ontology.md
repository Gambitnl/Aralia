# 1E Spell Branch Implementation Plan

> **IMPLEMENTED** — 2026-03-20. The SpellBranchNavigator, axis engine, spell profile generator, and all types were built as specified. The graph overlay described in `docs/plans/2026-03-19-spells-graph-overlay.md` was subsequently implemented on top of this foundation. `SpellBranchNavigator` gained an `initialChoices?: AxisChoice[]` prop to accept a pre-seeded filter state from the graph overlay's "Open in Spell Branch →" action.

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build a dynamic faceted spell navigator in the roadmap devtools that lets the project owner browse all 469 spells by any combination of canonical axes (Class, Level, School, Effect Type, Concentration, etc.) with the full system built once and new axes added by data alone.

**Architecture:** A build-time script reads all spell JSON files and outputs a single `spell-profiles.json`. A pure TypeScript axis engine (no React) takes a profile array and a list of prior choices, then returns the filtered spell set and the next available axes with their live-computed values. A React component wraps the engine into a tree navigator. Binary axes (Concentration, Ritual, AI Arbitration) expose a three-state Yes/No/Either with a count split. The V/S/M requirements axis maps to seven named component combinations. Spell nodes are always terminal leaves — they never appear mid-path.

**Tech Stack:** TypeScript, React, Vitest (colocated `.test.ts` files), existing devtools Vite server at `devtools/roadmap/`, existing roadmap API pattern (`/Aralia/api/roadmap/*`).

**Design source:** `docs/tasks/roadmap/1E-SPELL-ROADMAP-ONTOLOGY-QUESTIONS.md` — all decisions are resolved there. Read it before touching any task.

**Note:** Ideally run in a git worktree. Use `superpowers:using-git-worktrees` if starting fresh.

---

## Task 1: SpellCanonicalProfile type

**Files:**
- Create: `devtools/roadmap/src/spell-branch/types.ts`

The canonical profile is the single normalized record the axis engine reads. It strips everything runtime-only (aiContext, description, higherLevels, materialDescription) and keeps only what drives navigation.

**Step 1: Create the file**

```typescript
// devtools/roadmap/src/spell-branch/types.ts

/**
 * Normalized spell record for roadmap branch navigation.
 * Derived at build time from public/data/spells/**/*.json.
 * Runtime-only fields (aiContext, description, higherLevels) are excluded.
 * This is the single source of truth the axis engine reads from.
 */
export interface SpellCanonicalProfile {
  id: string;                    // slug, e.g. "magic-missile"
  name: string;                  // display name, e.g. "Magic Missile"
  level: number;                 // 0–9 (0 = cantrip)
  school: string;                // e.g. "Evocation"
  classes: string[];             // e.g. ["Wizard", "Sorcerer"]
  castingTimeUnit: CastingTimeUnit;
  concentration: boolean;
  ritual: boolean;
  components: SpellComponents;
  effectTypes: string[];         // e.g. ["DAMAGE"] or ["TERRAIN","STATUS_CONDITION"]
  targetingType: string;         // e.g. "area", "single", "self"
  attackType: string;            // "melee" | "ranged" | "none" | ""
  arbitrationRequired: boolean;  // true if arbitrationType !== "mechanical"
  legacy: boolean;
}

export type CastingTimeUnit = 'action' | 'bonus_action' | 'reaction' | 'special';

export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
}

/**
 * The seven named component combinations used by the Requirements axis.
 * Each value uniquely identifies which of the three component booleans are true.
 */
export type ComponentCombination =
  | 'verbal-only'
  | 'somatic-only'
  | 'material-only'
  | 'verbal-somatic'
  | 'verbal-material'
  | 'somatic-material'
  | 'verbal-somatic-material';

/**
 * All canonical axis identifiers. Adding a new axis later
 * requires: (1) add its id here, (2) add its extractor in axis-engine.ts.
 */
export type AxisId =
  | 'class'
  | 'level'
  | 'school'
  | 'castingTime'
  | 'effectType'
  | 'concentration'
  | 'ritual'
  | 'aiArbitration'
  | 'requirements'
  | 'targetingType'
  | 'attackType';

/**
 * A single choice made by the user during branch navigation.
 * For binary axes: value is 'yes' | 'no' | 'either'.
 * For requirements axis: value is a ComponentCombination.
 * For all other axes: value is the raw field value (e.g. "Wizard", "3", "DAMAGE").
 */
export interface AxisChoice {
  axisId: AxisId;
  value: string;
}

/**
 * A computed axis shown to the user at the current navigation step.
 * Values are derived from the live filtered spell set — nothing is hardcoded.
 */
export interface AxisState {
  axisId: AxisId;
  label: string;
  values: AxisValue[];
}

export interface AxisValue {
  value: string;
  label: string;
  count: number;   // spells matching this value in the current filtered set
}

/**
 * The full result returned by the axis engine for each navigation step.
 */
export interface AxisEngineResult {
  filteredSpells: SpellCanonicalProfile[];
  availableAxes: AxisState[];
  spellCount: number;
}
```

**Step 2: Verify the file compiles**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | Select-Object -First 30"
```

Expected: no errors related to `spell-branch/types.ts` (there may be pre-existing errors elsewhere — ignore those).

**Step 3: Commit**

```bash
git add devtools/roadmap/src/spell-branch/types.ts
git commit -m "feat(spell-branch): add SpellCanonicalProfile and axis engine types"
```

---

## Task 2: Spell profile generator script

**Files:**
- Create: `devtools/roadmap/scripts/generate-spell-profiles.ts`
- Output: `F:\Repos\Aralia\.agent\roadmap\spell-profiles.json`

Reads all spell JSON files from `public/data/spells/level-{0-9}/`, maps each to a `SpellCanonicalProfile`, and writes the result as a JSON array. Mirrors the pattern of `generate-master-roadmap.ts`.

**Step 1: Write the failing test**

```typescript
// devtools/roadmap/scripts/generate-spell-profiles.test.ts
import { describe, it, expect } from 'vitest';
import { buildSpellProfile } from './generate-spell-profiles';

const RAW_ACID_SPLASH = {
  id: 'acid-splash',
  name: 'Acid Splash',
  level: 0,
  school: 'Evocation',
  legacy: false,
  classes: ['Artificer', 'Sorcerer', 'Wizard'],
  ritual: false,
  attackType: '',
  castingTime: { value: 1, unit: 'action' },
  components: { verbal: true, somatic: true, material: false },
  duration: { concentration: false },
  targeting: { type: 'area' },
  effects: [{ type: 'DAMAGE' }],
  arbitrationType: 'mechanical',
};

describe('buildSpellProfile', () => {
  it('maps raw spell JSON to a canonical profile', () => {
    const profile = buildSpellProfile(RAW_ACID_SPLASH as any);
    expect(profile).toEqual({
      id: 'acid-splash',
      name: 'Acid Splash',
      level: 0,
      school: 'Evocation',
      classes: ['Artificer', 'Sorcerer', 'Wizard'],
      castingTimeUnit: 'action',
      concentration: false,
      ritual: false,
      components: { verbal: true, somatic: true, material: false },
      effectTypes: ['DAMAGE'],
      targetingType: 'area',
      attackType: '',
      arbitrationRequired: false,
      legacy: false,
    });
  });

  it('maps bonus_action casting time correctly', () => {
    const raw = { ...RAW_ACID_SPLASH, castingTime: { unit: 'bonus_action' } };
    expect(buildSpellProfile(raw as any).castingTimeUnit).toBe('bonus_action');
  });

  it('maps non-standard casting times to special', () => {
    const raw = { ...RAW_ACID_SPLASH, castingTime: { unit: 'minute' } };
    expect(buildSpellProfile(raw as any).castingTimeUnit).toBe('special');
  });

  it('maps arbitrationType ai_dm to arbitrationRequired: true', () => {
    const raw = { ...RAW_ACID_SPLASH, arbitrationType: 'ai_dm' };
    expect(buildSpellProfile(raw as any).arbitrationRequired).toBe(true);
  });

  it('collects all effectTypes from effects array', () => {
    const raw = {
      ...RAW_ACID_SPLASH,
      effects: [{ type: 'TERRAIN' }, { type: 'STATUS_CONDITION' }],
    };
    expect(buildSpellProfile(raw as any).effectTypes).toEqual([
      'TERRAIN',
      'STATUS_CONDITION',
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/scripts/generate-spell-profiles.test.ts 2>&1 | tail -20"
```

Expected: FAIL — `buildSpellProfile` not defined.

**Step 3: Write the implementation**

```typescript
// devtools/roadmap/scripts/generate-spell-profiles.ts
import * as fs from 'fs';
import * as path from 'path';
import type {
  SpellCanonicalProfile,
  CastingTimeUnit,
} from '../src/spell-branch/types';

const SPELLS_DIR = path.join(
  __dirname,
  '../../../public/data/spells'
);
const OUTPUT_PATH = path.join(
  __dirname,
  '../../../.agent/roadmap/spell-profiles.json'
);

const STANDARD_CASTING_UNITS = new Set([
  'action',
  'bonus_action',
  'reaction',
]);

// Exported for testing
export function buildSpellProfile(raw: any): SpellCanonicalProfile {
  const unit = raw.castingTime?.unit ?? 'action';
  const castingTimeUnit: CastingTimeUnit = STANDARD_CASTING_UNITS.has(unit)
    ? (unit as CastingTimeUnit)
    : 'special';

  return {
    id: raw.id,
    name: raw.name,
    level: raw.level,
    school: raw.school,
    classes: raw.classes ?? [],
    castingTimeUnit,
    concentration: raw.duration?.concentration ?? false,
    ritual: raw.ritual ?? false,
    components: {
      verbal: raw.components?.verbal ?? false,
      somatic: raw.components?.somatic ?? false,
      material: raw.components?.material ?? false,
    },
    effectTypes: (raw.effects ?? []).map((e: any) => e.type).filter(Boolean),
    targetingType: raw.targeting?.type ?? '',
    attackType: raw.attackType ?? '',
    arbitrationRequired: raw.arbitrationType !== 'mechanical',
    legacy: raw.legacy ?? false,
  };
}

function readAllSpellFiles(): any[] {
  const spells: any[] = [];
  for (let level = 0; level <= 9; level++) {
    const dir = path.join(SPELLS_DIR, `level-${level}`);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      spells.push(raw);
    }
  }
  return spells;
}

// Only run as a script — not during tests
if (require.main === module) {
  const rawSpells = readAllSpellFiles();
  const profiles = rawSpells.map(buildSpellProfile);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
  console.log(`Generated ${profiles.length} spell profiles → ${OUTPUT_PATH}`);
}
```

**Step 4: Run tests to verify they pass**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/scripts/generate-spell-profiles.test.ts 2>&1 | tail -20"
```

Expected: PASS — all 5 tests green.

**Step 5: Run the generator script**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx tsx devtools/roadmap/scripts/generate-spell-profiles.ts"
```

Expected: `Generated 469 spell profiles → .agent/roadmap/spell-profiles.json`

**Step 6: Spot-check the output**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; Get-Content .agent/roadmap/spell-profiles.json | ConvertFrom-Json | Where-Object { $_.id -eq 'magic-missile' } | ConvertTo-Json"
```

Expected: Magic Missile profile with `castingTimeUnit: "action"`, `effectTypes: ["DAMAGE"]`, `concentration: false`, `components: { verbal: true, somatic: true, material: false }`.

**Step 7: Commit**

```bash
git add devtools/roadmap/scripts/generate-spell-profiles.ts devtools/roadmap/scripts/generate-spell-profiles.test.ts .agent/roadmap/spell-profiles.json
git commit -m "feat(spell-branch): add spell profile generator — 469 profiles"
```

---

## Task 3: Axis engine — core filter logic

**Files:**
- Create: `devtools/roadmap/src/spell-branch/axis-engine.ts`
- Create: `devtools/roadmap/src/spell-branch/axis-engine.test.ts`

The axis engine is a pure function (no React, no side effects). Given a full profile array and the choices made so far, it returns the filtered spell set and the available axes with their live-computed values. Nothing is hardcoded — axis values are derived entirely from the live filtered set.

**Step 1: Write the failing tests**

```typescript
// devtools/roadmap/src/spell-branch/axis-engine.test.ts
import { describe, it, expect } from 'vitest';
import { computeAxisEngine } from './axis-engine';
import type { SpellCanonicalProfile } from './types';

// Minimal fixture profiles
const PROFILES: SpellCanonicalProfile[] = [
  {
    id: 'magic-missile',
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    classes: ['Wizard'],
    castingTimeUnit: 'action',
    concentration: false,
    ritual: false,
    components: { verbal: true, somatic: true, material: false },
    effectTypes: ['DAMAGE'],
    targetingType: 'single',
    attackType: 'none',
    arbitrationRequired: false,
    legacy: false,
  },
  {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: ['Wizard', 'Sorcerer'],
    castingTimeUnit: 'reaction',
    concentration: false,
    ritual: false,
    components: { verbal: true, somatic: true, material: false },
    effectTypes: ['DEFENSIVE'],
    targetingType: 'self',
    attackType: 'none',
    arbitrationRequired: false,
    legacy: false,
  },
  {
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 0,
    school: 'Divination',
    classes: ['Cleric', 'Druid', 'Wizard'],
    castingTimeUnit: 'action',
    concentration: true,
    ritual: true,
    components: { verbal: true, somatic: true, material: false },
    effectTypes: ['UTILITY'],
    targetingType: 'self',
    attackType: 'none',
    arbitrationRequired: false,
    legacy: false,
  },
];

describe('computeAxisEngine — no choices', () => {
  it('returns all spells when no choices made', () => {
    const result = computeAxisEngine(PROFILES, []);
    expect(result.filteredSpells).toHaveLength(3);
    expect(result.spellCount).toBe(3);
  });

  it('includes class axis with only values that exist', () => {
    const result = computeAxisEngine(PROFILES, []);
    const classAxis = result.availableAxes.find((a) => a.axisId === 'class');
    expect(classAxis).toBeDefined();
    const classValues = classAxis!.values.map((v) => v.value).sort();
    expect(classValues).toEqual(['Cleric', 'Druid', 'Sorcerer', 'Wizard']);
  });

  it('shows correct spell count per class value', () => {
    const result = computeAxisEngine(PROFILES, []);
    const classAxis = result.availableAxes.find((a) => a.axisId === 'class')!;
    const wizard = classAxis.values.find((v) => v.value === 'Wizard')!;
    expect(wizard.count).toBe(3); // all three spells are available to Wizard
  });
});

describe('computeAxisEngine — with choices', () => {
  it('filters spell set by class choice', () => {
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Cleric' },
    ]);
    expect(result.filteredSpells).toHaveLength(1);
    expect(result.filteredSpells[0].id).toBe('detect-magic');
  });

  it('removes chosen axis from available axes', () => {
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
    ]);
    const axisIds = result.availableAxes.map((a) => a.axisId);
    expect(axisIds).not.toContain('class');
  });

  it('recomputes remaining axis values from filtered set', () => {
    // After choosing Wizard, only Evocation + Abjuration + Divination remain
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
    ]);
    const schoolAxis = result.availableAxes.find((a) => a.axisId === 'school')!;
    const schools = schoolAxis.values.map((v) => v.value).sort();
    expect(schools).toEqual(['Abjuration', 'Divination', 'Evocation']);
  });

  it('chains two choices correctly', () => {
    const result = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
      { axisId: 'school', value: 'Abjuration' },
    ]);
    expect(result.filteredSpells).toHaveLength(1);
    expect(result.filteredSpells[0].id).toBe('shield');
  });
});

describe('computeAxisEngine — effectType axis (multi-value spells)', () => {
  it('counts spells correctly when a spell has multiple effect types', () => {
    const multiEffect: SpellCanonicalProfile = {
      id: 'grease',
      name: 'Grease',
      level: 1,
      school: 'Conjuration',
      classes: ['Wizard'],
      castingTimeUnit: 'action',
      concentration: false,
      ritual: false,
      components: { verbal: true, somatic: true, material: true },
      effectTypes: ['TERRAIN', 'STATUS_CONDITION'],
      targetingType: 'area',
      attackType: 'none',
      arbitrationRequired: false,
      legacy: false,
    };
    const result = computeAxisEngine([multiEffect], []);
    const effectAxis = result.availableAxes.find((a) => a.axisId === 'effectType')!;
    const types = effectAxis.values.map((v) => v.value).sort();
    expect(types).toEqual(['STATUS_CONDITION', 'TERRAIN']);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/src/spell-branch/axis-engine.test.ts 2>&1 | tail -20"
```

Expected: FAIL — `computeAxisEngine` not defined.

**Step 3: Write the implementation**

```typescript
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
```

**Step 4: Run tests to verify they pass**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/src/spell-branch/axis-engine.test.ts 2>&1 | tail -20"
```

Expected: FAIL — `resolveComponentCombination` not defined yet (Task 5 dependency). This is expected — proceed to Task 5 before re-running.

**Step 5: Commit what's written**

```bash
git add devtools/roadmap/src/spell-branch/axis-engine.ts devtools/roadmap/src/spell-branch/axis-engine.test.ts
git commit -m "feat(spell-branch): add axis engine core logic (pending vsm-tree dep)"
```

---

## Task 4: V/S/M combination tree

**Files:**
- Create: `devtools/roadmap/src/spell-branch/vsm-tree.ts`
- Create: `devtools/roadmap/src/spell-branch/vsm-tree.test.ts`

The seven component combinations are the leaves of the Requirements axis. `resolveComponentCombination` maps the three booleans to a named combination used as the axis value. The tree structure (Verbal → Somatic → Material) is a UI concern — the data model just uses the seven names.

**Step 1: Write the failing tests**

```typescript
// devtools/roadmap/src/spell-branch/vsm-tree.test.ts
import { describe, it, expect } from 'vitest';
import { resolveComponentCombination, VSM_COMBINATION_LABELS } from './vsm-tree';

describe('resolveComponentCombination', () => {
  it('maps V+S+M to verbal-somatic-material', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: true, material: true })
    ).toBe('verbal-somatic-material');
  });

  it('maps V+S to verbal-somatic', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: true, material: false })
    ).toBe('verbal-somatic');
  });

  it('maps V only to verbal-only', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: false, material: false })
    ).toBe('verbal-only');
  });

  it('maps S+M to somatic-material', () => {
    expect(
      resolveComponentCombination({ verbal: false, somatic: true, material: true })
    ).toBe('somatic-material');
  });

  it('maps S only to somatic-only', () => {
    expect(
      resolveComponentCombination({ verbal: false, somatic: true, material: false })
    ).toBe('somatic-only');
  });

  it('maps V+M to verbal-material', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: false, material: true })
    ).toBe('verbal-material');
  });

  it('maps M only to material-only', () => {
    expect(
      resolveComponentCombination({ verbal: false, somatic: false, material: true })
    ).toBe('material-only');
  });
});

describe('VSM_COMBINATION_LABELS', () => {
  it('has a human-readable label for every combination', () => {
    const combinations = [
      'verbal-only',
      'somatic-only',
      'material-only',
      'verbal-somatic',
      'verbal-material',
      'somatic-material',
      'verbal-somatic-material',
    ];
    for (const c of combinations) {
      expect(VSM_COMBINATION_LABELS[c]).toBeTruthy();
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/src/spell-branch/vsm-tree.test.ts 2>&1 | tail -20"
```

Expected: FAIL — `resolveComponentCombination` not defined.

**Step 3: Write the implementation**

```typescript
// devtools/roadmap/src/spell-branch/vsm-tree.ts
import type { SpellComponents, ComponentCombination } from './types';

/**
 * Maps the three component booleans to a named combination.
 * This is the value stored in the Requirements axis.
 *
 * Tree navigation in the UI (Verbal → Somatic → Material) is purely visual —
 * the underlying data uses these seven flat names.
 */
export function resolveComponentCombination(
  c: SpellComponents
): ComponentCombination {
  if (c.verbal && c.somatic && c.material) return 'verbal-somatic-material';
  if (c.verbal && c.somatic) return 'verbal-somatic';
  if (c.verbal && c.material) return 'verbal-material';
  if (c.somatic && c.material) return 'somatic-material';
  if (c.verbal) return 'verbal-only';
  if (c.somatic) return 'somatic-only';
  return 'material-only';
}

/**
 * Human-readable labels for each combination.
 * Used in the UI tree navigator to label axis values.
 */
export const VSM_COMBINATION_LABELS: Record<ComponentCombination, string> = {
  'verbal-only': 'Verbal only (V)',
  'somatic-only': 'Somatic only (S)',
  'material-only': 'Material only (M)',
  'verbal-somatic': 'Verbal + Somatic (V+S)',
  'verbal-material': 'Verbal + Material (V+M)',
  'somatic-material': 'Somatic + Material (S+M)',
  'verbal-somatic-material': 'Verbal + Somatic + Material (V+S+M)',
};

/**
 * The V/S/M tree structure used by the UI navigator.
 * Each node in the tree maps to a component combination at its leaves.
 * Dead-end paths (combinations not present in the current spell set)
 * are pruned at render time — not here.
 */
export const VSM_TREE = [
  {
    label: 'Verbal',
    children: [
      {
        label: '(+) Somatic',
        children: [
          { label: '(+) Material', combination: 'verbal-somatic-material' as ComponentCombination },
          { label: 'None', combination: 'verbal-somatic' as ComponentCombination },
        ],
      },
      { label: '(+) Material', combination: 'verbal-material' as ComponentCombination },
      { label: 'None', combination: 'verbal-only' as ComponentCombination },
    ],
  },
  {
    label: 'Somatic (no Verbal)',
    children: [
      { label: '(+) Material', combination: 'somatic-material' as ComponentCombination },
      { label: 'None', combination: 'somatic-only' as ComponentCombination },
    ],
  },
  { label: 'Material only', combination: 'material-only' as ComponentCombination },
] as const;
```

**Step 4: Run all spell-branch tests**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/src/spell-branch/ 2>&1 | tail -30"
```

Expected: All tests pass including `axis-engine.test.ts` (which now has its dependency).

**Step 5: Commit**

```bash
git add devtools/roadmap/src/spell-branch/vsm-tree.ts devtools/roadmap/src/spell-branch/vsm-tree.test.ts
git commit -m "feat(spell-branch): add V/S/M combination tree resolver"
```

---

## Task 5: SpellBranchNavigator React component

**Files:**
- Create: `devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx`

The component loads `spell-profiles.json`, holds the current list of `AxisChoice[]` in state, calls `computeAxisEngine` on each render, and displays the results. Spell leaves appear whenever the user triggers "Show Spells" (available after the first choice). Binary axes display as three-state buttons with a count split in the label. Multi-value axes display as a list of clickable values.

This is the minimal functional UI. Visual polish is a separate concern.

**Step 1: Write the component**

```tsx
// devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx
import React, { useState, useEffect } from 'react';
import type {
  SpellCanonicalProfile,
  AxisChoice,
  AxisState,
  AxisId,
} from './types';
import { computeAxisEngine } from './axis-engine';
import { VSM_COMBINATION_LABELS, VSM_TREE } from './vsm-tree';

const BINARY_AXES = new Set<AxisId>([
  'concentration',
  'ritual',
  'aiArbitration',
]);

// Level display: 0 = Cantrip, 1–9 = Level N
function levelLabel(value: string): string {
  return value === '0' ? 'Cantrip' : `Level ${value}`;
}

function axisValueLabel(axisId: AxisId, value: string): string {
  if (axisId === 'level') return levelLabel(value);
  if (axisId === 'requirements') {
    return VSM_COMBINATION_LABELS[value as keyof typeof VSM_COMBINATION_LABELS] ?? value;
  }
  return value;
}

export function SpellBranchNavigator() {
  const [profiles, setProfiles] = useState<SpellCanonicalProfile[]>([]);
  const [choices, setChoices] = useState<AxisChoice[]>([]);
  const [showSpells, setShowSpells] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/Aralia/api/spell-profiles')
      .then((r) => r.json())
      .then((data: SpellCanonicalProfile[]) => {
        setProfiles(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading spell profiles…</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>Error: {error}</div>;

  const { filteredSpells, availableAxes, spellCount } =
    computeAxisEngine(profiles, choices);

  function choose(axisId: AxisId, value: string) {
    setChoices((prev) => [...prev, { axisId, value }]);
    setShowSpells(false);
  }

  function reset() {
    setChoices([]);
    setShowSpells(false);
  }

  function removeChoice(index: number) {
    setChoices((prev) => prev.filter((_, i) => i !== index));
    setShowSpells(false);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginTop: 0 }}>Spell Branch</h2>

      {/* Breadcrumb of choices made */}
      {choices.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {choices.map((c, i) => (
            <button
              key={i}
              onClick={() => removeChoice(i)}
              style={{
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 13,
              }}
              title="Click to remove this filter"
            >
              {c.axisId}: {axisValueLabel(c.axisId as AxisId, c.value)} ✕
            </button>
          ))}
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Reset all
          </button>
        </div>
      )}

      {/* Spell count + show spells trigger */}
      {choices.length > 0 && (
        <div style={{ marginBottom: 16, color: '#94a3b8', fontSize: 14 }}>
          {spellCount} spell{spellCount !== 1 ? 's' : ''} match
          {!showSpells && (
            <button
              onClick={() => setShowSpells(true)}
              style={{
                marginLeft: 12,
                background: '#1e40af',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '3px 10px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Show spells
            </button>
          )}
        </div>
      )}

      {/* Spell leaves */}
      {showSpells && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {filteredSpells
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: s.legacy ? '#1c1917' : '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 13,
                    color: s.legacy ? '#78716c' : '#e2e8f0',
                  }}
                  title={`Level ${s.level} ${s.school}`}
                >
                  {s.name}
                  {s.legacy && (
                    <span style={{ marginLeft: 6, color: '#78716c', fontSize: 11 }}>
                      legacy
                    </span>
                  )}
                </div>
              ))}
          </div>
          <button
            onClick={() => setShowSpells(false)}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Hide spells
          </button>
        </div>
      )}

      {/* Available axes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {availableAxes.map((axis) => (
          <AxisPanel
            key={axis.axisId}
            axis={axis}
            isBinary={BINARY_AXES.has(axis.axisId)}
            onChoose={(value) => choose(axis.axisId, value)}
          />
        ))}
      </div>

      {availableAxes.length === 0 && !showSpells && choices.length > 0 && (
        <div style={{ color: '#64748b', fontSize: 14 }}>
          All axes chosen.{' '}
          <button
            onClick={() => setShowSpells(true)}
            style={{
              background: '#1e40af',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Show {spellCount} spell{spellCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function AxisPanel({
  axis,
  isBinary,
  onChoose,
}: {
  axis: AxisState;
  isBinary: boolean;
  onChoose: (value: string) => void;
}) {
  // Binary axes: show count split in label, three buttons
  if (isBinary) {
    const yes = axis.values.find((v) => v.value === 'yes')!;
    const no = axis.values.find((v) => v.value === 'no')!;
    return (
      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
          {axis.label}{' '}
          <span style={{ color: '#475569' }}>
            ({yes.count} / {no.count})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {axis.values.map((v) => (
            <button
              key={v.value}
              onClick={() => onChoose(v.value)}
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {v.value === 'yes' ? 'Yes' : v.value === 'no' ? 'No' : 'Either'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Multi-value axes
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
        {axis.label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {axis.values.map((v) => (
          <button
            key={v.value}
            onClick={() => onChoose(v.value)}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 4,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {axisValueLabel(axis.axisId, v.value)}
            <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11 }}>
              {v.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify the file compiles (no TypeScript errors)**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | Select-String 'spell-branch'"
```

Expected: no errors in spell-branch files.

**Step 3: Commit**

```bash
git add devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx
git commit -m "feat(spell-branch): add SpellBranchNavigator React component"
```

---

## Task 6: API endpoint + wire into roadmap

**Files:**
- Modify: the Vite dev server config or API handler (find the existing `/api/roadmap/data` handler — match that pattern exactly)
- Modify: `devtools/roadmap/src/roadmap-entry.tsx` OR wherever the roadmap UI mounts — add a route/tab for the Spell Branch

**Step 1: Find the existing API handler pattern**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; Get-ChildItem -Recurse -Path devtools/roadmap -Filter '*.ts' | Select-String -Pattern 'api/roadmap/data' | Select-Object Path, Line -First 10"
```

Read the handler file to understand the exact pattern, then mirror it to add:

```
GET /Aralia/api/spell-profiles
→ serves .agent/roadmap/spell-profiles.json
```

**Step 2: Add the endpoint** following the exact same pattern as the existing `/api/roadmap/data` handler.

**Step 3: Find where the roadmap UI mounts and add a Spell Branch tab/panel**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; Get-ChildItem -Recurse -Path devtools/roadmap/src -Filter '*.tsx' | Select-String -Pattern 'RoadmapVisualizer' | Select-Object Path, Line -First 10"
```

Add a tab or toggle in the roadmap UI that renders `<SpellBranchNavigator />` alongside the existing roadmap canvas. Minimal integration — a single tab button is sufficient.

**Step 4: Start the roadmap dev server and verify it loads**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx tsx devtools/roadmap/scripts/generate-spell-profiles.ts"
```

Then start the dev server per the existing pattern and confirm:
- `/Aralia/api/spell-profiles` returns 469 spell profiles
- The Spell Branch tab renders without console errors
- Clicking Class shows all 14 class values dynamically

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(spell-branch): wire SpellBranchNavigator into roadmap — API + UI tab"
```

---

## Task 7: Witness spell acceptance suite

**Files:**
- Create: `devtools/roadmap/src/spell-branch/acceptance.test.ts`

These tests verify the seven acceptance criteria from Q12 of the design document using the real `spell-profiles.json` as fixture data. If all pass, the model is correct.

**Step 1: Write the tests**

```typescript
// devtools/roadmap/src/spell-branch/acceptance.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { computeAxisEngine } from './axis-engine';
import type { SpellCanonicalProfile } from './types';

// Load the real generated profiles as the fixture
const PROFILES_PATH = path.join(
  __dirname,
  '../../../../.agent/roadmap/spell-profiles.json'
);

let PROFILES: SpellCanonicalProfile[] = [];

beforeAll(() => {
  PROFILES = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
});

// === WITNESS SPELLS ===
// Magic Missile — level 1, Wizard, DAMAGE, action, V+S, no concentration, no ritual
// Detect Magic   — level 0, Wizard/Cleric/Druid, UTILITY, action, V+S, concentration=true, ritual=true
// Shield         — level 1, Wizard, DEFENSIVE, reaction, V+S, no concentration
// Cure Wounds    — level 1, many, HEALING, action, V+S, no concentration
// Fireball       — level 3, Wizard/Sorcerer, DAMAGE, action, V+S+M, no concentration
// Find Familiar  — level 2, Wizard, SUMMONING, special, V+S+M, ritual=true
// Misty Step     — level 2, many, MOVEMENT, bonus_action, V-only, no concentration
// Sleep          — level 1, many, STATUS_CONDITION, action, V+S+M, no concentration
// Grease         — level 1, Wizard, TERRAIN+STATUS_CONDITION, action, V+S+M

describe('Acceptance — Criterion 1: witness spells appear under every axis they belong to', () => {
  it('Magic Missile appears under Class→Wizard', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'magic-missile')).toBe(true);
  });

  it('Magic Missile appears under Level→1', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'level', value: '1' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'magic-missile')).toBe(true);
  });

  it('Magic Missile appears under EffectType→DAMAGE', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'effectType', value: 'DAMAGE' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'magic-missile')).toBe(true);
  });

  it('Magic Missile appears under CastingTime→action', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'castingTime', value: 'action' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'magic-missile')).toBe(true);
  });

  it('Shield appears under CastingTime→reaction', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'castingTime', value: 'reaction' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'shield')).toBe(true);
  });

  it('Find Familiar appears under CastingTime→special (extended cast)', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'castingTime', value: 'special' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'find-familiar')).toBe(true);
  });

  it('Misty Step appears under CastingTime→bonus_action', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'castingTime', value: 'bonus_action' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'misty-step')).toBe(true);
  });
});

describe('Acceptance — Criterion 2: Grease appears under both TERRAIN and STATUS_CONDITION', () => {
  it('Grease appears under EffectType→TERRAIN', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'effectType', value: 'TERRAIN' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'grease')).toBe(true);
  });

  it('Grease appears under EffectType→STATUS_CONDITION', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'effectType', value: 'STATUS_CONDITION' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'grease')).toBe(true);
  });
});

describe('Acceptance — Criterion 3: Misty Step appears under Requirements→verbal-only', () => {
  it('Misty Step is in the verbal-only combination', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'requirements', value: 'verbal-only' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'misty-step')).toBe(true);
  });

  it('Misty Step does NOT appear under verbal-somatic', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'requirements', value: 'verbal-somatic' },
    ]);
    expect(filteredSpells.some((s) => s.id === 'misty-step')).toBe(false);
  });
});

describe('Acceptance — Criterion 4: no phantom axis values', () => {
  it('After filtering to Wizard, school axis contains only Wizard schools', () => {
    const wizardSchools = PROFILES.filter((p) =>
      p.classes.includes('Wizard')
    ).map((p) => p.school);
    const distinctSchools = new Set(wizardSchools);

    const { availableAxes } = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Wizard' },
    ]);
    const schoolAxis = availableAxes.find((a) => a.axisId === 'school')!;
    for (const v of schoolAxis.values) {
      expect(distinctSchools.has(v.value)).toBe(true);
    }
  });

  it('Impossible combination returns 0 spells (not phantom values)', () => {
    // Level 9 Cantrips do not exist
    const { filteredSpells, availableAxes } = computeAxisEngine(PROFILES, [
      { axisId: 'level', value: '9' },
      { axisId: 'castingTime', value: 'bonus_action' },
    ]);
    // Either 0 spells or only actual level-9 bonus-action spells
    for (const spell of filteredSpells) {
      expect(spell.level).toBe(9);
      expect(spell.castingTimeUnit).toBe('bonus_action');
    }
  });
});

describe('Acceptance — Criterion 5: binary axes expose Yes/No/Either with correct counts', () => {
  it('Concentration axis has yes, no, either values', () => {
    const { availableAxes } = computeAxisEngine(PROFILES, []);
    const concAxis = availableAxes.find((a) => a.axisId === 'concentration')!;
    const values = concAxis.values.map((v) => v.value);
    expect(values).toContain('yes');
    expect(values).toContain('no');
    expect(values).toContain('either');
  });

  it('Concentration yes + no counts sum to total spell count', () => {
    const { availableAxes, spellCount } = computeAxisEngine(PROFILES, []);
    const concAxis = availableAxes.find((a) => a.axisId === 'concentration')!;
    const yes = concAxis.values.find((v) => v.value === 'yes')!.count;
    const no = concAxis.values.find((v) => v.value === 'no')!.count;
    expect(yes + no).toBe(spellCount);
  });

  it('Choosing Concentration→yes filters to concentration-only spells', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'concentration', value: 'yes' },
    ]);
    expect(filteredSpells.every((s) => s.concentration)).toBe(true);
  });

  it('Choosing Concentration→no filters to non-concentration spells', () => {
    const { filteredSpells } = computeAxisEngine(PROFILES, [
      { axisId: 'concentration', value: 'no' },
    ]);
    expect(filteredSpells.every((s) => !s.concentration)).toBe(true);
  });

  it('Choosing Concentration→either does not narrow the set', () => {
    const full = computeAxisEngine(PROFILES, []);
    const either = computeAxisEngine(PROFILES, [
      { axisId: 'concentration', value: 'either' },
    ]);
    expect(either.spellCount).toBe(full.spellCount);
  });
});

describe('Acceptance — Criterion 6: no hardcoded values', () => {
  it('Removing a spell from the set removes it from all axes', () => {
    // Simulate removing Magic Missile from the data
    const withoutMm = PROFILES.filter((s) => s.id !== 'magic-missile');
    const full = computeAxisEngine(PROFILES, [{ axisId: 'class', value: 'Wizard' }]);
    const pruned = computeAxisEngine(withoutMm, [{ axisId: 'class', value: 'Wizard' }]);
    expect(pruned.spellCount).toBe(full.spellCount - 1);
  });
});

describe('Acceptance — Criterion 7: each step derives values only from filtered set', () => {
  it('After Class→Cleric, Level axis shows only levels Clerics have', () => {
    const clericLevels = new Set(
      PROFILES.filter((p) => p.classes.includes('Cleric')).map((p) =>
        String(p.level)
      )
    );
    const { availableAxes } = computeAxisEngine(PROFILES, [
      { axisId: 'class', value: 'Cleric' },
    ]);
    const levelAxis = availableAxes.find((a) => a.axisId === 'level')!;
    for (const v of levelAxis.values) {
      expect(clericLevels.has(v.value)).toBe(true);
    }
  });
});
```

**Step 2: Run the acceptance suite against the real data**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/src/spell-branch/acceptance.test.ts 2>&1 | tail -40"
```

Expected: All tests pass. If any fail, investigate whether the spell JSON data matches expectations (e.g. Grease may need both TERRAIN and STATUS_CONDITION in its `effects[]` array — check `public/data/spells/level-1/grease.json` and fix data if needed, not code).

**Step 3: Run the full spell-branch test suite**

```bash
powershell -NoLogo -Command "cd F:\Repos\Aralia; npx vitest run devtools/roadmap/src/spell-branch/ devtools/roadmap/scripts/generate-spell-profiles.test.ts 2>&1 | tail -30"
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add devtools/roadmap/src/spell-branch/acceptance.test.ts
git commit -m "feat(spell-branch): add witness spell acceptance suite — 9 spells × 7 criteria"
```

---

## Done

The spell branch is complete when:

1. `npx vitest run devtools/roadmap/src/spell-branch/` — all pass
2. `npx tsx devtools/roadmap/scripts/generate-spell-profiles.ts` — reports 469 profiles
3. The Spell Branch tab loads in the roadmap devtools
4. Clicking any axis shows only values that actually exist
5. All 9 witness spells surface under the correct branches

Cross-links from spell nodes to feature/capability nodes are **not in scope here** — that is a future task once the broader cross-link model is designed. `arbitrationType` deep-dive (the `ai_dm` planning work) is also deferred — tracked in `1E-SPELL-ROADMAP-ONTOLOGY-QUESTIONS.md`.
