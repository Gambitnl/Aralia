import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX,
  applyRaceSpecificSupportCorrections,
  classifyMechanicText,
  createRaceCrosswalkRecord,
  extractAraliaTraitDetail,
  normalizeRaceNameForMatching,
  summarizeVendorRace,
} from '../raceReconciliationInventory';

const VENDOR_PATH = path.join(process.cwd(), 'vendor', '5etools-src', 'data', 'races.json');

/**
 * These tests protect the race reconciliation helpers before the full report
 * script is run against Aralia's live race files and the vendored 5etools data.
 *
 * The reports are meant to guide future migration work, not rewrite race data.
 * These tests therefore focus on reviewable matching and conservative mechanic
 * bucketing instead of trying to prove every race-specific judgment here.
 *
 * Called by: Vitest
 * Depends on: scripts/raceReconciliationInventory.ts for the pure helper logic
 */

// ============================================================================
// Race Name Matching
// ============================================================================
// This section keeps the crosswalk deterministic. It normalizes punctuation and
// parenthetical source labels so "Dragonborn (Black)" can still match Aralia's
// "Black Dragonborn" without claiming all uncertain variants are exact matches.
// ============================================================================

describe('normalizeRaceNameForMatching', () => {
  it('keeps reordered parenthetical ancestry words available for matching', () => {
    expect(normalizeRaceNameForMatching('Dragonborn (Black)')).toBe('black dragonborn');
    expect(normalizeRaceNameForMatching('Half-Orc')).toBe('half orc');
  });
});

// ============================================================================
// Vendor Summaries
// ============================================================================
// This section verifies that vendor extraction keeps structural facts and short
// trait labels while avoiding long copied race text in generated artifacts.
// ============================================================================

describe('summarizeVendorRace', () => {
  it('summarizes movement, senses, proficiencies, and trait names without long text', () => {
    const summary = summarizeVendorRace(
      {
        name: 'Air Genasi',
        source: 'MPMM',
        size: ['M'],
        speed: { walk: 35, fly: 0 },
        darkvision: 60,
        languageProficiencies: [{ common: true, auran: true }],
        entries: [
          { type: 'entries', name: 'Lightning Resistance', entries: ['Long vendor rules text is intentionally not copied into tests.'] },
        ],
      },
      'vendor/5etools-src/data/races.json',
    );

    expect(summary.name).toBe('Air Genasi');
    expect(summary.speed).toEqual({ walk: 35, fly: 0 });
    expect(summary.senses.darkvision).toBe(60);
    expect(summary.languageKeys).toContain('auran');
    expect(summary.traits).toContainEqual(
      expect.objectContaining({
        name: 'Lightning Resistance',
        summary: 'entries: Lightning Resistance',
      }),
    );
  });
});

// ============================================================================
// Aralia Trait Extraction
// ============================================================================
// This section covers the small parser used to split Aralia's current
// text-driven race traits into names and details for report bucketing.
// ============================================================================

describe('extractAraliaTraitDetail', () => {
  it('splits trait labels from their review text', () => {
    expect(extractAraliaTraitDetail('Speed: 35 feet')).toEqual({
      traitName: 'Speed',
      detailText: '35 feet',
    });
  });
});

// ============================================================================
// Mechanic Bucketing
// ============================================================================
// This section documents conservative support decisions. Already consumed fields
// stay separate from text-only mechanics that need future engine work.
// ============================================================================

describe('classifyMechanicText', () => {
  it('marks speed and darkvision as enforced only when the capability matrix says Aralia consumes them', () => {
    expect(classifyMechanicText('Speed', '30 feet', DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX)).toMatchObject({
      support: 'enforced_now',
      bucket: 'movement_walk_speed',
      capability: expect.objectContaining({
        mechanicFamily: 'walk_speed',
        supportStatus: 'enforced',
      }),
    });

    expect(classifyMechanicText('Vision', 'darkvision within 60 feet', DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX)).toMatchObject({
      support: 'enforced_now',
      bucket: 'darkvision',
      capability: expect.objectContaining({
        mechanicFamily: 'darkvision',
        supportStatus: 'enforced',
      }),
    });

    expect(classifyMechanicText('Speed', '30 feet', [])).toMatchObject({
      support: 'ambiguous_requires_human_mapping',
      bucket: 'movement_walk_speed',
    });
  });

  it('buckets repeated unsupported mechanics by future implementation family', () => {
    expect(classifyMechanicText('Relentless Endurance', 'drop to 1 hit point once per long rest')).toMatchObject({
      support: 'blocked_by_missing_mechanic_family',
      bucket: 'death_prevention',
    });
    expect(classifyMechanicText('Lightning Resistance', 'Resistance to Lightning damage')).toMatchObject({
      support: 'blocked_by_missing_mechanic_family',
      bucket: 'damage_resistance',
    });
    expect(classifyMechanicText('Powerful Build', 'You count as one size larger when determining carrying capacity')).toMatchObject({
      support: 'blocked_by_missing_mechanic_family',
      bucket: 'powerful_build',
    });
    expect(classifyMechanicText('Talons', 'You can use them to make unarmed strikes that deal slashing damage')).toMatchObject({
      support: 'blocked_by_missing_mechanic_family',
      bucket: 'natural_weapon',
    });
  });

  it('does not classify breath weapons as weapon proficiency', () => {
    expect(classifyMechanicText('Breath Weapon', 'You exhale destructive energy as part of the Attack action')).toMatchObject({
      support: 'blocked_by_missing_mechanic_family',
      bucket: 'breath_weapon',
      mechanicKey: 'combat.breath_weapon',
    });
  });

  it('does not treat creature type identity text as creature communication', () => {
    expect(classifyMechanicText('Creature Type', 'Humanoid')).toMatchObject({
      support: 'display_lore_only',
      bucket: 'display_lore_only',
    });
  });
});

describe('applyRaceSpecificSupportCorrections', () => {
  it('does not mark unsupported race skill text as enforced just because some racial skills are supported', () => {
    const classification = classifyMechanicText('Astral Trance', 'Choose one skill proficiency');

    expect(applyRaceSpecificSupportCorrections('astral_elf', classification)).toMatchObject({
      support: 'blocked_by_missing_mechanic_family',
      bucket: 'choice_of_skill',
    });
  });

  it('keeps currently wired racial skill grants enforced for supported race IDs', () => {
    const classification = classifyMechanicText('Natural Affinity', 'Choose one skill proficiency from Animal Handling, Medicine, Nature, or Survival');

    expect(applyRaceSpecificSupportCorrections('centaur', classification)).toMatchObject({
      support: 'enforced_now',
      bucket: 'choice_of_skill',
    });
  });
});

// ============================================================================
// Crosswalk Confidence
// ============================================================================
// This section keeps matching reviewable. Exact names plus mechanical overlap are
// high confidence, while custom/reflavored IDs should remain human-review items.
// ============================================================================

describe('createRaceCrosswalkRecord', () => {
  it('creates a high-confidence match when name and core mechanics overlap', () => {
    const record = createRaceCrosswalkRecord(
      {
        id: 'half_orc',
        name: 'Half-Orc',
        traits: ['Speed: 30 feet', 'Vision: darkvision within 60 feet'],
        traitNames: ['Speed', 'Vision'],
      },
      [
        {
          name: 'Half-Orc',
          normalizedName: 'half orc',
          source: 'PHB',
          path: 'vendor/5etools-src/data/races.json',
          speed: { walk: 30 },
          senses: { darkvision: 60 },
          traits: [{ name: 'Relentless Endurance', summary: 'entries: Relentless Endurance' }],
        },
      ],
    );

    expect(record.status).toBe('matched');
    expect(record.vendorCandidates[0]).toMatchObject({
      vendorName: 'Half-Orc',
      confidence: 'high',
    });
    expect(record.vendorCandidates[0].reasons).toEqual(
      expect.arrayContaining(['name match', 'speed match', 'darkvision match']),
    );
  });
});

// ============================================================================
// Reconciliation Payload Shape
// ============================================================================
// The crosswalk record is the contract every downstream report and JSON artifact
// depends on. This section pins the record's field shape so a helper refactor
// cannot silently drop or rename a key the reports read.
// ============================================================================

describe('createRaceCrosswalkRecord payload shape', () => {
  it('always returns the full crosswalk record contract', () => {
    const record = createRaceCrosswalkRecord(
      { id: 'human', name: 'Human', traits: ['Speed: 30 feet'], traitNames: ['Speed'] },
      [summarizeVendorRace({ name: 'Human', source: 'PHB', speed: { walk: 30 } }, VENDOR_PATH)],
    );

    expect(record).toEqual(
      expect.objectContaining({
        araliaRaceId: 'human',
        araliaName: 'Human',
        status: expect.any(String),
        vendorCandidates: expect.any(Array),
        notes: expect.any(String),
      }),
    );

    expect(record.vendorCandidates[0]).toEqual(
      expect.objectContaining({
        vendorName: expect.any(String),
        vendorSource: expect.any(String),
        vendorPath: expect.any(String),
        confidence: expect.stringMatching(/^(high|medium|low)$/),
        score: expect.any(Number),
        reasons: expect.any(Array),
      }),
    );
  });
});

// ============================================================================
// Crosswalk Status Handling
// ============================================================================
// The five crosswalk statuses are the human-review signal of the whole report.
// This section exercises each branch so an uncertain, custom, or reflavored
// Aralia identity is never silently collapsed into a confident vendor match.
// ============================================================================

describe('createRaceCrosswalkRecord status handling', () => {
  it('marks a name-only overlap as ambiguous when confidence stays below high', () => {
    const record = createRaceCrosswalkRecord(
      { id: 'goblin', name: 'Goblin', traits: [], traitNames: [] },
      [summarizeVendorRace({ name: 'Goblin', source: 'MM', speed: { walk: 30 } }, VENDOR_PATH)],
    );

    expect(record.status).toBe('ambiguous');
    expect(record.vendorCandidates[0].confidence).toBe('medium');
  });

  it('keeps a custom/reflavored Aralia ID as reflavored even when a vendor candidate exists', () => {
    const record = createRaceCrosswalkRecord(
      { id: 'stormborn_goliath', name: 'Goliath', traits: [], traitNames: [] },
      [summarizeVendorRace({ name: 'Goliath', source: 'PHB' }, VENDOR_PATH)],
    );

    expect(record.status).toBe('reflavored');
    expect(record.vendorCandidates.length).toBeGreaterThan(0);
  });

  it('marks a custom Aralia ID with no vendor candidate as custom', () => {
    const record = createRaceCrosswalkRecord(
      { id: 'wayfarer_kin', name: 'Wayfarer Kin', traits: [], traitNames: [] },
      [summarizeVendorRace({ name: 'Dragonborn', source: 'PHB' }, VENDOR_PATH)],
    );

    expect(record.status).toBe('custom');
    expect(record.vendorCandidates).toHaveLength(0);
  });

  it('marks a non-custom Aralia race with no vendor candidate as unmatched', () => {
    const record = createRaceCrosswalkRecord(
      { id: 'mistfolk', name: 'Mistfolk', traits: [], traitNames: [] },
      [summarizeVendorRace({ name: 'Dragonborn', source: 'PHB' }, VENDOR_PATH)],
    );

    expect(record.status).toBe('unmatched');
    expect(record.vendorCandidates).toHaveLength(0);
  });
});
