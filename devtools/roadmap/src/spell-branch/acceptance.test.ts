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
// Magic Missile — level 1, Wizard/Sorcerer, DAMAGE, action, V+S, no concentration, no ritual
// Detect Magic   — level 0, Wizard/Cleric/Druid, UTILITY, action, V+S, concentration=true, ritual=true
// Shield         — level 1, Wizard/Sorcerer, DEFENSIVE, reaction, V+S, no concentration
// Cure Wounds    — level 1, many, HEALING, action, V+S, no concentration
// Fireball       — level 3, Wizard/Sorcerer, DAMAGE, action, V+S+M, no concentration
// Find Familiar  — level 1, Wizard, SUMMONING, special (hour), V+S+M, ritual=true
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
    const { filteredSpells } = computeAxisEngine(PROFILES, [
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
