
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SpellIntegrityValidator } from '../SpellIntegrityValidator';
import { SpellValidator } from '../spellValidator';
import { Spell } from '../../../../types/spells';
import tinyServant from '../../../../../public/data/spells/level-3/tiny-servant.json';

/**
 * SpellIntegrityValidator — Regression Test Suite
 *
 * This file runs the SpellIntegrityValidator against real spell JSON data from
 * the public/data/spells/ directory. Its job is to make sure that data quality
 * problems introduced by early prototyping don't silently grow unchecked.
 *
 * There are two kinds of tests in this file:
 *
 *   HARD FAILURES — rules that are fully fixed and must stay clean. If a spell
 *   breaks one of these, the test fails and blocks the build. Right now, that
 *   covers Concentration Sync and Enchantment Targeting (both were manually
 *   remediated across all affected spells).
 *
 *   SOFT WARNINGS — rules that track known ongoing debt. These print a hit list
 *   to the console on every test run but do NOT fail the test. This lets us see
 *   progress as spells are fixed without breaking CI. The Monolithic Effect
 *   rule lives here during Phase 2 of the spell overhaul.
 *
 * Phase 3 upgrade path: once the monolithic spell hit list reaches zero, the
 * commented-out expect() assertion at the bottom of the Systematic test should
 * be uncommented. That will permanently lock the rule as a hard failure.
 *
 * Called by: `npx vitest` (full suite) or
 *            `npx vitest src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts --run`
 */

// ---------------------------------------------------------------------------
// Spell loader helper
// ---------------------------------------------------------------------------
// Points to the real spell JSON directory, relative to this test file's
// location. Tests use actual data so we catch real regressions, not toy cases.
const SPELLS_ROOT = path.resolve(__dirname, '../../../../../public/data/spells');

/**
 * Reads all spell JSON files for a given level from disk and returns them as
 * parsed Spell objects. Returns an empty array if the level directory doesn't
 * exist (e.g., if level-10 is never added).
 */
function getSpells(level: number): Spell[] {
  const dir = path.join(SPELLS_ROOT, `level-${level}`);
  if (!fs.existsSync(dir)) return [];

  // Some checked-in spell JSON files carry a UTF-8 BOM. Strip it here so the
  // regression suite keeps exercising spell content instead of tripping over
  // file-encoding noise in the loader.
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8').replace(/^\uFEFF/, '')));
}

// ---------------------------------------------------------------------------
// Reviewed monolithic-effect clearances
// ---------------------------------------------------------------------------
// These spell IDs were manually checked and confirmed as legitimate single-effect
// rows. Keeping the list shared prevents the level-specific visibility scan and
// the all-spell monolithic scan from disagreeing about the same reviewed data.
const MONOLITHIC_SAFE_LIST: string[] = [
  // Light is one structured light-emission effect with object targeting, radius
  // metadata, color choice, cover blocking, and recast ending data. Its long
  // top-level prose does not imply a missing second combat effect.
  'light',
  // Gentle Repose is one structured corpse/remains protection utility. The
  // target special-identity filter carries the important mechanical gate, so
  // splitting it would create artificial effects rather than real behavior.
  'gentle-repose',
  // See Invisibility is one self-applied sensory utility. Its single effect
  // already names sensory behavior, duration, and self targeting; there is no
  // separate damage/status/action payload to extract.
  'see-invisibility',
  // Enhance Ability is one advantage-granting utility effect. The important
  // complexity lives in targeting metadata: scalable target count and a
  // required per-target ability choice, so splitting the effect would duplicate
  // that already structured target-side rule.
  'enhance-ability'
];

const filterReviewedMonolithicClearance = (spell: Spell, errors: string[]): string[] => {
  // Reviewed one-effect spells should stop appearing as monolithic warnings,
  // but every other integrity rule must remain visible for those rows.
  if (!MONOLITHIC_SAFE_LIST.includes(spell.id)) {
    return errors;
  }

  return errors.filter(error => error !== 'Monolithic Effect Description');
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Concentration Sync rule
  // -------------------------------------------------------------------------
  // These are small isolated tests using hand-crafted minimal spell objects.
  // They exist to verify the rule itself is wired correctly, independent of
  // whether any real spells are currently broken.
  describe('Rule: Concentration Sync', () => {

    it('fails if concentration tag is missing', () => {
      // This spell claims to require concentration in its duration, but its
      // tags array doesn't include the "concentration" string — a mismatch.
      const badSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage']
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Concentration Mismatch: duration.concentration is true but \'tags\' is missing "concentration"');
    });

    it('passes if sync is correct', () => {
      // Both duration.concentration and the tags array agree — this is valid.
      const goodSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage', 'concentration']
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unit tests: Ritual Sync rule
  // -------------------------------------------------------------------------
  // Ritual casting is represented in both the boolean rule field and the tag
  // list used by spellbook filters. These tests keep the validator from letting
  // the two player-facing surfaces drift apart.
  describe('Rule: Ritual Sync', () => {

    it('fails if ritual tag is missing', () => {
      const badSpell = {
        id: 'ritual-without-tag',
        ritual: true,
        duration: { concentration: false },
        tags: ['utility']
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Ritual Mismatch: ritual is true but \'tags\' is missing "ritual"');
    });

    it('passes if ritual sync is correct', () => {
      const goodSpell = {
        id: 'ritual-with-tag',
        ritual: true,
        duration: { concentration: false },
        tags: ['utility', 'ritual']
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unit tests: Duration Progression Integrity rule
  // -------------------------------------------------------------------------
  // Duration progression records permanence and extension paths that matter to
  // player-facing summaries and future runtime state. These tests keep the
  // validator strict enough to reject malformed rows without narrowing valid
  // future permanence mechanics to one spell family.
  describe('Rule: Duration Progression Integrity', () => {

    it('fails if a duration progression trigger is unknown', () => {
      const badSpell = {
        id: 'unknown-duration-progression-trigger',
        duration: { concentration: false },
        tags: [],
        durationProgression: [
          {
            trigger: 'monthly_reroll',
            requiredCasts: 3,
            cadence: 'daily',
            sameTargetRequired: true,
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: 'not_applicable',
            outcomeDuration: 'until_dispelled',
            dispellable: true,
            notes: 'Invalid trigger for regression coverage.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Duration Progression Invalid: entry 0 uses unknown trigger "monthly_reroll"');
    });

    it('fails if repeated casts do not name a stable repeated context', () => {
      const badSpell = {
        id: 'unstable-repeated-duration-progression',
        duration: { concentration: false },
        tags: [],
        durationProgression: [
          {
            trigger: 'repeated_casts',
            requiredCasts: 30,
            cadence: 'daily',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: 'not_applicable',
            outcomeDuration: 'until_dispelled',
            dispellable: true,
            notes: 'Repeated casting must identify what stays the same.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Duration Progression Invalid: entry 0 repeated_casts must require the same target, location, or configuration');
    });

    it('fails if full-duration concentration progression is attached to a non-concentration spell', () => {
      const badSpell = {
        id: 'full-duration-without-concentration',
        duration: { concentration: false },
        tags: [],
        durationProgression: [
          {
            trigger: 'full_duration_concentration',
            requiredCasts: 'not_applicable',
            cadence: 'not_applicable',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: true,
            outcomeDuration: 'non_dispellable_permanent',
            dispellable: false,
            notes: 'The progression says full concentration, but the spell does not.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Duration Progression Mismatch: entry 0 requires full concentration but spell duration is not concentration');
    });

    it('passes recognized repeated-cast and full-concentration progression rows', () => {
      const goodSpell = {
        id: 'valid-duration-progression',
        duration: { concentration: true },
        tags: ['concentration'],
        durationProgression: [
          {
            trigger: 'repeated_casts',
            requiredCasts: 365,
            cadence: 'daily',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: true,
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: 'not_applicable',
            outcomeDuration: 'permanent',
            dispellable: false,
            notes: 'Daily same-location casting makes this spell permanent.'
          },
          {
            trigger: 'full_duration_concentration',
            requiredCasts: 'not_applicable',
            cadence: 'not_applicable',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: true,
            outcomeDuration: 'non_dispellable_permanent',
            dispellable: false,
            notes: 'Maintaining concentration for the full duration makes this permanent.'
          }
        ]
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unit tests: Mode Choice Integrity rule
  // -------------------------------------------------------------------------
  // Mode-choice menus are player-facing UI metadata and command-routing data.
  // These tests keep option labels, counts, and payload indexes aligned without
  // requiring every menu to route through direct effect indexes.
  describe('Rule: Mode Choice Integrity', () => {

    it('fails if optionCount no longer matches the option list', () => {
      const badSpell = {
        id: 'mode-choice-count-drift',
        duration: { concentration: false },
        tags: [],
        effects: [],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 2,
          optionsSource: 'modeChoice.options',
          options: [
            { label: 'Only Option', summary: 'Only one option remains.' }
          ]
        }
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Mode Choice Invalid: optionCount 2 does not match options length 1');
    });

    it('fails if a mode option points at a missing effect index', () => {
      const badSpell = {
        id: 'mode-choice-bad-effect-index',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'A valid utility branch.'
          }
        ],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 1,
          optionsSource: 'effects',
          options: [
            { label: 'Missing Effect', summary: 'Points outside effects.', effectIndices: [1] }
          ]
        }
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Mode Choice Invalid: option 0 points at missing effect index 1');
    });

    it('passes if mode options are summary-only or point at existing payload rows', () => {
      const goodSpell = {
        id: 'mode-choice-valid',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'First valid utility branch.',
            controlOptions: [
              { name: 'Control Branch', effect: 'Use this control branch.' }
            ]
          },
          {
            type: 'UTILITY',
            description: 'Second valid utility branch.'
          }
        ],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 3,
          optionsSource: 'mixed',
          options: [
            { label: 'Summary Only', summary: 'The option is described directly in the menu.' },
            { label: 'Effect Branch', summary: 'The option routes to an effect.', effectIndices: [1] },
            { label: 'Control Branch', summary: 'The option routes to a control option.', controlOptionIndices: [0] }
          ]
        },
        aiContext: {
          playerInputRequired: true
        }
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });

    it('fails if controlOptions-backed mode choices do not require player input', () => {
      const badSpell = {
        id: 'control-options-mode-choice-missing-player-input',
        duration: { concentration: false },
        tags: [],
        effects: [{
          type: 'UTILITY',
          description: 'A command-style control branch.',
          controlOptions: [{
            name: 'Approach',
            effect: 'approach'
          }]
        }],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 1,
          optionsSource: 'controlOptions',
          options: [{
            label: 'Approach',
            summary: 'The target approaches.',
            controlOptionIndices: [0]
          }]
        },
        aiContext: {
          playerInputRequired: false
        }
      } as unknown as Spell;

      // Command-style spells can have structurally valid controlOptions but
      // still fail at runtime if the top-level spell metadata says no player
      // input is needed. The integrity rule keeps the UI/input path aligned
      // with the command execution contract.
      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Mode Choice Invalid: controlOptions-backed modeChoice requires aiContext.playerInputRequired true');
    });
  });

  // -------------------------------------------------------------------------
  // Unit tests: Action Cost Metadata Integrity rule
  // -------------------------------------------------------------------------
  // Created-object and sustained-hazard spells often expose their runtime
  // economy through casting combat costs, trigger sustain costs, or granted
  // follow-up actions. These tests keep that metadata internally usable without
  // claiming a full object-lifecycle engine exists.
  describe('Rule: Action Cost Metadata Integrity', () => {

    it('fails if casting combat cost drifts away from the casting unit', () => {
      const badSpell = {
        id: 'combat-cost-unit-drift',
        castingTime: {
          value: 1,
          unit: 'bonus_action',
          combatCost: {
            type: 'action',
            condition: ''
          }
        },
        duration: { concentration: false },
        tags: [],
        effects: []
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Action Cost Mismatch: castingTime.unit "bonus_action" does not match combatCost.type "action"');
    });

    it('fails if sustain cost optional is not boolean', () => {
      const badSpell = {
        id: 'bad-sustain-cost',
        castingTime: {
          value: 1,
          unit: 'action',
          combatCost: {
            type: 'action',
            condition: ''
          }
        },
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'A sustained utility effect.',
            trigger: {
              type: 'on_caster_action',
              sustainCost: {
                actionType: 'bonus_action',
                optional: 'sometimes'
              }
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Action Cost Invalid: effect 0 sustainCost.optional must be boolean');
    });

    it('fails if a granted action has no action label', () => {
      const badSpell = {
        id: 'bad-granted-action',
        castingTime: {
          value: 1,
          unit: 'action',
          combatCost: {
            type: 'action',
            condition: ''
          }
        },
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'A utility effect with a malformed granted action.',
            trigger: {
              type: 'immediate'
            },
            grantedActions: [
              {
                type: 'bonus_action',
                action: '',
                frequency: 'each_turn'
              }
            ]
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Action Cost Invalid: effect 0 granted action 0 must include a non-empty action label');
    });

    it('passes valid casting, sustain, and granted-action cost metadata', () => {
      const goodSpell = {
        id: 'valid-action-cost-metadata',
        castingTime: {
          value: 1,
          unit: 'bonus_action',
          combatCost: {
            type: 'bonus_action',
            condition: ''
          }
        },
        duration: { concentration: true },
        tags: ['concentration'],
        effects: [
          {
            type: 'UTILITY',
            description: 'A valid sustained utility effect.',
            trigger: {
              type: 'on_caster_action',
              sustainCost: {
                actionType: 'bonus_action',
                optional: false
              }
            },
            grantedActions: [
              {
                type: 'bonus_action',
                action: 'Move Object',
                frequency: 'each_turn',
                rangeLimit: 30
              }
            ]
          }
        ]
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Unit tests: Light Metadata Integrity rule
  // -------------------------------------------------------------------------
  // Light effects create map artifacts that the turn manager can now expire.
  // These tests keep the data contract tight enough for runtime and UI surfaces
  // to know where the light attaches and how much light it actually emits.
  describe('Rule: Light Metadata Integrity', () => {

    it('fails if a light utility effect has no light payload', () => {
      const badSpell = {
        id: 'light-without-payload',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            utilityType: 'light',
            description: 'Creates light but omits the map-light payload.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Light Metadata Invalid: effect 0 utilityType light must include a light payload');
    });

    it('fails if a light utility effect emits no light or uses an unknown attachment', () => {
      const badSpell = {
        id: 'light-without-radius',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            utilityType: 'light',
            description: 'Claims to create light but has no emitted radius.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            light: {
              brightRadius: 0,
              dimRadius: 0,
              attachedTo: 'somewhere_else'
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Light Metadata Invalid: effect 0 utilityType light must emit bright or dim light');
      expect(errors).toContain('Light Metadata Invalid: effect 0 attachedTo must be caster, target, or point');
    });

    it('passes valid bright or dim light utility payloads', () => {
      const goodSpell = {
        id: 'valid-light-metadata',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            utilityType: 'light',
            description: 'Creates dim light at a chosen point.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            light: {
              brightRadius: 0,
              dimRadius: 10,
              attachedTo: 'point'
            }
          }
        ]
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------  // Unit tests: Effect Description Completeness rule
  // -------------------------------------------------------------------------
  // These tests lock G8/G9's cleanup into the validator itself. A spell effect
  // with valid structured mechanics but an empty or placeholder description is
  // still too opaque for UI, glossary, audits, and runtime trace debugging.
  describe('Rule: Effect Description Completeness', () => {

    it('fails if an effect description is blank', () => {
      const badSpell = {
        id: 'blank-effect-description',
        duration: { concentration: false },
        tags: [],
        school: 'Evocation',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'DAMAGE',
            description: '   '
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Gap: effect 0 has a blank description');
    });

    it('fails if an effect description is a generic placeholder', () => {
      const badSpell = {
        id: 'generic-effect-description',
        duration: { concentration: false },
        tags: [],
        school: 'Evocation',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'UTILITY',
            description: 'See description.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Placeholder: effect 0 uses generic placeholder "See description."');
    });

    it('fails if an effect description leaks importer scaffold language', () => {
      const badSpell = {
        id: 'scaffold-effect-description',
        duration: { concentration: false },
        tags: [],
        school: 'Evocation',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'DAMAGE',
            description: 'Deals 3d8 Radiant damage on the row\'s current hit-based resolution.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Internal Scaffold: effect 0 uses importer-facing wording "row\'s current hit-based resolution"');
    });

    it('fails if an effect description says mechanics are preserved from the current row', () => {
      const badSpell = {
        id: 'current-row-preserved-description',
        duration: { concentration: false },
        tags: [],
        school: 'Enchantment',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'STATUS_CONDITION',
            description: 'Applies Charmed; save modifiers are preserved from the current row.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Internal Scaffold: effect 0 uses importer-facing wording "preserved from the current row"');
    });

    it('fails if multiple effect rows share the same long copied description', () => {
      const badSpell = {
        id: 'duplicated-long-effect-description',
        duration: { concentration: false },
        tags: [],
        school: 'Transmutation',
        targeting: { type: 'single' },
        effects: [
          {
            type: 'UTILITY',
            description: 'Choose one of several transformation options. The first option changes movement and breathing, the second changes appearance, and the third creates natural weapons. This whole menu should not be copied onto every individual effect row.'
          },
          {
            type: 'UTILITY',
            description: 'Choose one of several transformation options. The first option changes movement and breathing, the second changes appearance, and the third creates natural weapons. This whole menu should not be copied onto every individual effect row.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Duplicate: effects 0 and 1 share the same long description');
    });

    it('fails if a damage effect copies the top-level spell description', () => {
      const copiedDescription = 'A sphere of acid explodes in a wide area. Each creature in the area makes a Dexterity saving throw, taking acid damage on a failed save or half as much damage on a successful save.';
      const badSpell = {
        id: 'damage-copied-spell-description',
        description: copiedDescription,
        duration: { concentration: false },
        tags: [],
        school: 'Evocation',
        targeting: { type: 'area' },
        effects: [
          {
            type: 'DAMAGE',
            description: copiedDescription
          },
          {
            type: 'UTILITY',
            description: 'Leaves acidic residue as the non-damage companion effect.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Description Copied Spell Prose: damage effect 0 duplicates the top-level spell description');
    });
  });

  it('keeps Cloud of Daggers damage descriptions distinct across trigger rows', () => {
    const cloudOfDaggers = getSpells(2).find(spell => spell.id === 'cloud-of-daggers');
    const damageEffects = cloudOfDaggers?.effects.filter(effect => effect.type === 'DAMAGE') ?? [];

    // Cloud of Daggers splits one area-damage spell into cast-time, entry /
    // moved-into-space, and end-turn damage rows. Those UI rows should not
    // repeat the same sentence because each trigger fires at a different time.
    expect(damageEffects.map(effect => effect.description)).toEqual([
      'Each creature in the Cube takes 4d4 Slashing damage when the spell is cast.',
      'A creature takes 4d4 Slashing damage the first time on a turn that it enters the Cube or when the Cube moves into its space; this can happen only once per turn and gains +2d4 per slot level above 2.',
      'A creature takes 4d4 Slashing damage when it ends its turn in the Cube.'
    ]);
  });

  it('keeps Warding Bond defensive descriptions tied to AC and resistance rows', () => {
    const wardingBond = getSpells(2).find(spell => spell.id === 'warding-bond');
    const effectDescriptions = wardingBond?.effects.map(effect => effect.description) ?? [];

    // Warding Bond splits one protection link into +1 AC, all-damage
    // resistance, and caster-shared-damage rows. The first two rows should
    // name the protection they apply instead of saying only "defensive bond."
    expect(effectDescriptions).toEqual([
      'The willing touched target gains a +1 bonus to AC for 1 hour while the Warding Bond link persists.',
      'The willing touched target has Resistance to all damage for 1 hour while it remains within 60 feet of the caster.',
      'While the link persists (within 60 ft), you take the same amount of damage the target takes. Ends if either drops to 0 HP or you exceed 60 ft separation.'
    ]);
  });

  it('keeps Aura of Purity descriptions split between aura wrapper and defensive rows', () => {
    const auraOfPurity = getSpells(4).find(spell => spell.id === 'aura-of-purity');
    const effectDescriptions = auraOfPurity?.effects.map(effect => effect.description) ?? [];

    // Aura of Purity has one wrapper row for the moving aura and disease
    // prevention, plus separate defensive rows for Poison resistance and
    // Advantage against specific condition-causing effects. The utility row
    // should not copy both defensive payloads back into one card-like summary.
    expect(effectDescriptions).toEqual([
      'A 30-foot aura of purifying energy radiates from the caster for up to 10 minutes with concentration, moves with the caster, and prevents nonhostile creatures in the aura from becoming diseased.',
      'Nonhostile creatures in the aura, including the caster, have Resistance to Poison damage.',
      'Nonhostile creatures in the aura have Advantage on saving throws against effects that cause Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned.'
    ]);
  });

  it('keeps defensive utility rows distinct from top-level spell prose', () => {
    const protectionFromPoison = getSpells(2).find(spell => spell.id === 'protection-from-poison');
    const intellectFortress = getSpells(3).find(spell => spell.id === 'intellect-fortress');
    const seeInvisibility = getSpells(2).find(spell => spell.id === 'see-invisibility');
    const lesserRestoration = getSpells(2).find(spell => spell.id === 'lesser-restoration');

    // These defensive and sensory spells are common UI cards where the
    // top-level prose can easily leak into every effect row. Each row should
    // instead name the specific runtime fact it owns: condition cleanup,
    // resistance, mental-save advantage, target scaling, or sensory access.
    expect(protectionFromPoison?.effects.map(effect => effect.description)).toEqual([
      'Touch one creature, end the Poisoned condition on it immediately, and for 1 hour grant Advantage on saves to avoid or end the Poisoned condition; the companion defensive row carries Poison damage Resistance.',
      'For 1 hour, the touched target has Resistance to Poison damage.'
    ]);
    expect(intellectFortress?.effects.map(effect => effect.description)).toEqual([
      'Choose yourself or one willing creature you can see within 30 feet for up to 1 hour with concentration; the target has Advantage on Intelligence, Wisdom, and Charisma saves. Higher slots add one target per slot level above 3, and all targets must be within 30 feet of each other.',
      'For up to 1 hour with concentration, the target has Resistance to Psychic damage.'
    ]);
    expect(seeInvisibility?.effects.map(effect => effect.description)).toEqual([
      'For 1 hour, the caster sees Invisible creatures and objects as visible and perceives into the Ethereal Plane, where creatures and objects appear ghostly.'
    ]);
    expect(lesserRestoration?.effects.map(effect => effect.description)).toEqual([
      'Touch one creature and choose one removable condition on it; Blinded, Deafened, Paralyzed, or Poisoned ends immediately.'
    ]);
  });

  it('keeps Spare the Dying rows tied to 0-HP target gate and scaling range', () => {
    const spareTheDying = getSpells(0).find(spell => spell.id === 'spare-the-dying');
    const effectDescriptions = spareTheDying?.effects.map(effect => effect.description) ?? [];

    // Spare the Dying appears in low-level recovery UI. Both rows should keep
    // the 0-Hit-Point, not-dead target gate and cantrip range scaling visible
    // instead of relying on the top-level card text.
    expect(effectDescriptions).toEqual([
      'Choose one creature within 15 feet that has 0 Hit Points and is not dead; the creature becomes Stable and is no longer dying. The range increases to 30 feet at level 5, 60 feet at level 11, and 120 feet at level 17.',
      'The 0-Hit-Point creature within the current Spare the Dying range gains the Stable condition immediately, provided it is not dead.'
    ]);
  });

  it('keeps morale and life-support buffs tied to scope duration and cleanup', () => {
    const beaconOfHope = getSpells(3).find(spell => spell.id === 'beacon-of-hope');
    const motivationalSpeech = getSpells(3).find(spell => spell.id === 'motivational-speech');
    const heroism = getSpells(1).find(spell => spell.id === 'heroism');

    // These morale and life-support buffs often surface as standalone UI rows.
    // Each row should expose target scope, duration, temporary-hit-point
    // cleanup, and higher-slot scaling instead of relying on top-level prose.
    expect(beaconOfHope?.effects.map(effect => effect.description)).toEqual([
      'Choose any number of creatures within 30 feet for up to 1 minute with concentration; each target has Advantage on Wisdom saving throws.',
      'Each chosen target has Advantage on Death Saving Throws for up to 1 minute with concentration.',
      'Each chosen target regains the maximum possible Hit Points from any healing received for up to 1 minute with concentration.'
    ]);
    expect(motivationalSpeech?.effects.map(effect => effect.description)).toEqual([
      'Choose up to five creatures within 60 feet that can hear the 1-minute speech; each gains 5 Temporary Hit Points for up to 1 hour, +5 Temporary Hit Points per slot level above 3, and the spell ends for a creature when those Temporary Hit Points are lost.',
      'While a creature keeps the Temporary Hit Points from Motivational Speech, it has Advantage on Wisdom saving throws for up to 1 hour.',
      'After a creature affected by Motivational Speech is hit by an attack, it has Advantage on the next attack roll it makes while the spell remains active for that creature.'
    ]);
    expect(heroism?.effects.map(effect => effect.description)).toEqual([
      'Touch one willing creature for up to 1 minute with concentration; the target has Immunity to the Frightened condition, and higher slots add one touched target per slot level above 1.',
      'At the start of each of the Heroism target turns, it gains Temporary Hit Points equal to the caster spellcasting ability modifier; when the spell ends, the target loses any remaining Temporary Hit Points from this spell.'
    ]);
  });

  it('keeps Catnap unconscious row tied to breaks rest payoff and scaling', () => {
    const catnap = getSpells(3).find(spell => spell.id === 'catnap');
    const statusEffect = catnap?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // Catnap is modeled as one Unconscious row, so that row needs to carry the
    // target gate, early breaks, short-rest payoff, long-rest lockout, and
    // higher-slot target scaling that make the spell usable from a standalone
    // status tooltip.
    expect(statusEffect?.description).toBe('Choose up to three willing visible creatures within 30 feet; each falls Unconscious for 10 minutes, wakes early if it takes damage or another creature uses an action to shake or slap it awake, gains the benefit of a Short Rest if it remains Unconscious for the full duration, cannot benefit from this spell again until finishing a Long Rest, and higher slots add one willing target per slot level above 3.');
  });

  it('keeps Shining Smite rows tied to hit rider light and visibility facts', () => {
    const shiningSmite = getSpells(2).find(spell => spell.id === 'shining-smite');
    const effectDescriptions = shiningSmite?.effects.map(effect => effect.description) ?? [];

    // Shining Smite splits the triggering Radiant hit from the visibility
    // rider. The rows should expose hit timing, concentration duration,
    // higher-slot damage scaling, Bright Light, attack Advantage, and the
    // Invisible-benefit denial that make the target easier to track.
    expect(effectDescriptions).toEqual([
      'The next creature hit by the triggering weapon attack takes an extra 2d6 Radiant damage, plus +1d6 per slot level above 2.',
      'Until the spell ends, the hit target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it cannot benefit from the Invisible condition.'
    ]);
  });

  it('keeps copied top-level healing resistance and teleport rows standalone', () => {
    const massHealingWord = getSpells(3).find(spell => spell.id === 'mass-healing-word');
    const protectionFromEnergy = getSpells(3).find(spell => spell.id === 'protection-from-energy');
    const farStep = getSpells(5).find(spell => spell.id === 'far-step');

    // These spells had effect rows that exactly copied the top-level card
    // text. The row text should carry the runtime fact it owns, including
    // scaling, chosen damage type, concentration duration, and repeated
    // Bonus Action teleport access.
    expect(massHealingWord?.effects.map(effect => effect.description)).toEqual([
      'As a Bonus Action, choose up to six visible creatures within 60 feet; each regains 2d4 plus the caster spellcasting ability modifier Hit Points, with +1d4 healing per slot level above 3.'
    ]);
    expect(protectionFromEnergy?.effects.map(effect => effect.description)).toEqual([
      'Touch one willing creature for up to 1 hour with concentration and choose Acid, Cold, Fire, Lightning, or Thunder as the protected damage type; the companion defensive row carries the chosen Resistance.',
      'For up to 1 hour with concentration, the willing touched target has Resistance to the chosen Acid, Cold, Fire, Lightning, or Thunder damage type.'
    ]);
    expect(farStep?.effects.map(effect => effect.description)).toEqual([
      'When the spell is cast, the caster teleports up to 60 feet to an unoccupied space they can see.',
      'For up to 1 minute with concentration, the caster can use a Bonus Action on each later turn to teleport up to 60 feet again to an unoccupied visible space.'
    ]);
  });

  it('keeps elemental investiture rows tied to defenses actions and cleanup risks', () => {
    const investitureOfFlame = getSpells(6).find(spell => spell.id === 'investiture-of-flame');
    const investitureOfIce = getSpells(6).find(spell => spell.id === 'investiture-of-ice');
    const investitureOfWind = getSpells(6).find(spell => spell.id === 'investiture-of-wind');

    // Elemental investitures are self-transform wrappers with several sibling
    // rows. The terse defense and utility rows should still name concentration
    // duration, immunity/resistance pairs, granted actions, movement wrappers,
    // and the fall cleanup risk so UI cards do not hide the contract.
    expect(investitureOfFlame?.effects.map(effect => effect.description)).toEqual([
      'For up to 10 minutes with concentration, the caster can use an action to create a 15-foot-long, 5-foot-wide line of fire from them in a chosen direction; each creature in the line makes a Dexterity save, taking 4d8 Fire damage on a failure or half as much on a success.',
      'For up to 10 minutes with concentration, a creature takes 1d10 Fire damage the first time on a turn that it moves within 5 feet of the caster; the caster is unharmed by these flames.',
      'For up to 10 minutes with concentration, a creature takes 1d10 Fire damage when it ends its turn within 5 feet of the caster; the caster is unharmed by these flames.',
      'For up to 10 minutes with concentration, the caster has Immunity to Fire damage.',
      'For up to 10 minutes with concentration, the caster has Resistance to Cold damage.',
      'For up to 10 minutes with concentration, flames shed Bright Light in a 30-foot radius and Dim Light for 30 more feet, and the caster can use an action each turn to create the 15-foot line of fire.'
    ]);
    expect(investitureOfIce?.effects.map(effect => effect.description)).toEqual([
      'For up to 10 minutes with concentration, the caster can use an action to create a 15-foot cone of freezing wind; each creature in the cone makes a Constitution save, taking 4d6 Cold damage on a failed save or half as much on a success.',
      'For up to 10 minutes with concentration, the caster has Immunity to Cold damage.',
      'For up to 10 minutes with concentration, the caster has Resistance to Fire damage.',
      'For up to 10 minutes with concentration, icy ground in a 10-foot radius around the caster is Difficult Terrain for creatures other than the caster, and the radius moves with the caster.',
      "A creature that fails the save against the freezing wind has its Speed halved until the start of the caster's next turn.",
      'For up to 10 minutes with concentration, the caster ignores extra movement costs from ice or snow Difficult Terrain and can use an action each turn to create the 15-foot cone of freezing wind.'
    ]);
    expect(investitureOfWind?.effects.map(effect => effect.description)).toEqual([
      'For up to 10 minutes with concentration, the caster can use an action to create a 15-foot Cube of swirling wind centered on a visible point within 60 feet; each creature in the Cube makes a Constitution save, taking 2d10 Bludgeoning damage on a failed save or half as much on a success.',
      'For up to 10 minutes with concentration, ranged weapon attacks made against the caster have Disadvantage on the attack roll.',
      'For up to 10 minutes with concentration, the caster gains a 60-foot Fly Speed; if the spell ends while the caster is still flying, the caster falls unless another effect prevents the fall.',
      'If a Large or smaller creature fails the save against the swirling wind Cube, it is pushed up to 10 feet away from the center of the Cube.',
      'For up to 10 minutes with concentration, the caster gains a 60-foot Fly Speed, can use an action each turn to create the 15-foot swirling wind Cube, and falls when the spell ends if still flying unless another effect prevents the fall.'
    ]);
  });

  it('keeps Animal Messenger utility description focused on save and delivery facts', () => {
    const animalMessenger = getSpells(2).find(spell => spell.id === 'animal-messenger');
    const utilityEffect = animalMessenger?.effects.find(effect => effect.type === 'UTILITY');

    // Animal Messenger is modeled as one communication utility row with a
    // Charisma save and an auto-success override for non-CR-0 beasts. The row
    // should expose the messenger setup, delivery pace, lost-message failure,
    // and slot-duration scaling without copying the whole card.
    expect(utilityEffect?.description).toBe('Choose a visible Tiny Beast within 30 feet to carry a message of up to 25 words to a described recipient at a visited location. The Beast makes a Charisma save to resist, with non-CR-0 Beasts automatically succeeding; on failure it travels about 25 miles per 24 hours, or 50 miles if it can fly, and the message is lost if it does not arrive before the spell ends. Higher slots extend the duration by 48 hours per slot level above 2nd.');
  });

  it('keeps Find Steed summoning description focused on companion and slot-level stat facts', () => {
    const findSteed = getSpells(2).find(spell => spell.id === 'find-steed');
    const summoningEffect = findSteed?.effects.find(effect => effect.type === 'SUMMONING');

    // Find Steed creates a persistent mount whose stat block uses the spell
    // slot level. The row should surface that player-facing scaling instead of
    // saying no slot-scaling changes are modeled.
    expect(summoningEffect?.description).toBe('Summon a persistent loyal steed companion in an unoccupied space within 30 feet, choosing Horse, Camel, Dire Wolf, or Elk appearance and Celestial, Fey, or Fiend creature type. The steed is allied, shares your Initiative count, functions as a controlled mount while ridden, acts independently after your turn to protect you if you are Incapacitated, communicates telepathically with you within 1 mile, disappears at 0 Hit Points or if you die, can be replaced or resummoned by recasting, and uses the spell slot level for AC, Hit Points, Hit Dice, flight at slot level 4+, attack damage, and Celestial, Fey, or Fiend traits.');
  });

  it('keeps Find Familiar summoning description focused on familiar control facts', () => {
    const findFamiliar = getSpells(1).find(spell => spell.id === 'find-familiar');
    const summoningEffect = findFamiliar?.effects.find(effect => effect.type === 'SUMMONING');

    // Find Familiar creates a persistent spirit companion with form choices,
    // telepathy, shared senses, and touch-spell delivery. The row should expose
    // those play facts instead of saying no slot-scaling changes are modeled.
    expect(summoningEffect?.description).toBe('Summon one persistent familiar spirit in an animal form at an unoccupied space within range. The familiar acts independently, obeys your commands, and stays until dismissed or reduced to 0 Hit Points. While it is within 100 feet, you can communicate telepathically with it, use a Bonus Action to perceive through its senses until the start of your next turn, and have it deliver your touch spells using its Reaction; you can have only one familiar at a time.');
  });

  it('allows summon shared-senses costs that the runtime command bridge supports', () => {
    const findFamiliar = getSpells(1).find(spell => spell.id === 'find-familiar');
    const summoningEffectIndex = findFamiliar?.effects.findIndex(effect => effect.type === 'SUMMONING') ?? -1;

    expect(findFamiliar).toBeDefined();
    expect(summoningEffectIndex).toBeGreaterThanOrEqual(0);

    const sharedSensesFreeCostSpell = {
      ...findFamiliar!,
      effects: findFamiliar!.effects.map((effect, index) => {
        if (index !== summoningEffectIndex || effect.type !== 'SUMMONING') {
          return effect;
        }

        // SummoningCommand maps `free` and `none` to executable ability costs.
        // The validator should therefore accept the same contract instead of
        // forcing all shared-senses summon spells into action/bonus-action only.
        return {
          ...effect,
          summon: {
            ...effect.summon,
            sharedSenses: true,
            sharedSensesCost: 'free'
          }
        };
      })
    };

    expect(SpellValidator.safeParse(sharedSensesFreeCostSpell).success).toBe(true);
  });

  it('keeps Unseen Servant summoning description focused on servant limits and command facts', () => {
    const unseenServant = getSpells(1).find(spell => spell.id === 'unseen-servant');
    const summoningEffect = unseenServant?.effects.find(effect => effect.type === 'SUMMONING');

    // Unseen Servant creates a temporary invisible helper with simple-task
    // limits, Bonus Action commands, and clear end conditions. The row should
    // describe those play facts instead of saying no slot scaling is modeled.
    expect(summoningEffect?.description).toBe('Summon one temporary invisible servant in an unoccupied ground space within 60 feet. The servant has AC 10, 1 Hit Point, Strength 2, Speed 15 feet, cannot attack, can perform simple tasks when commanded with a Bonus Action, and the spell ends if it drops to 0 Hit Points or moves too far away.');
  });

  it('keeps Tensers Floating Disk summoning description focused on disk limits and ending facts', () => {
    const tensersFloatingDisk = getSpells(1).find(spell => spell.id === 'tensers-floating-disk');
    const summoningEffect = tensersFloatingDisk?.effects.find(effect => effect.type === 'SUMMONING');

    // Tenser's Floating Disk creates a temporary force disk with concrete
    // carrying, hover, following, terrain, and break-distance rules. The row
    // should expose those play facts instead of saying no slot scaling is
    // modeled.
    expect(summoningEffect?.description).toBe('Summon one temporary 3-foot-diameter floating disk of force at a point within 30 feet. The disk hovers 3 feet above the ground, carries up to 500 pounds, follows the caster to remain within 20 feet, cannot cross 10-foot elevation changes or pits, and the spell ends if overloaded or more than 100 feet from the caster.');
  });

  it('keeps area save descriptions tied to their failure payloads', () => {
    const createBonfire = getSpells(0).find(spell => spell.id === 'create-bonfire');
    const grease = getSpells(1).find(spell => spell.id === 'grease');
    const createBonfireDescriptions = createBonfire?.effects.map(effect => effect.description) ?? [];
    const greaseDescriptions = grease?.effects.map(effect => effect.description) ?? [];

    // Create Bonfire and Grease both have area-trigger rows for entering the
    // area and ending a turn there. Those rows should name the Dexterity save
    // and the failed-save payload directly instead of saying "this saving
    // throw," which makes UI rows depend on a different effect for context.
    expect(createBonfireDescriptions).toEqual([
      'When the spell is cast, each creature in the 5-foot Cube bonfire space makes a Dexterity save or takes 1d8 Fire damage; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.',
      'A creature that ends its turn in the 5-foot Cube bonfire space makes a Dexterity save or takes 1d8 Fire damage; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.',
      'The first time on a turn that a creature enters the 5-foot Cube bonfire space, it makes a Dexterity save or takes 1d8 Fire damage; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.'
    ]);
    expect(greaseDescriptions).toEqual([
      'Nonflammable grease coats a 10-foot square within 60 feet for 1 minute without concentration, making the area Difficult Terrain.',
      'Each creature standing in the 10-foot square when the grease appears makes a Dexterity save or gains the Prone condition.',
      'The first time on a turn that a creature enters the 10-foot square, it makes a Dexterity save or gains the Prone condition.',
      'A creature that ends its turn in the 10-foot square makes a Dexterity save or gains the Prone condition.'
    ]);
  });

  it('keeps mode-choice descriptions tied to their selected payloads', () => {
    const alarm = getSpells(1).find(spell => spell.id === 'alarm');
    const blindnessDeafness = getSpells(2).find(spell => spell.id === 'blindness-deafness');
    const alarmDescriptions = alarm?.effects.map(effect => effect.description) ?? [];
    const blindnessDeafnessDescriptions = blindnessDeafness?.effects.map(effect => effect.description) ?? [];

    // Alarm and Blindness/Deafness are both modeled as choice spells. Their
    // effect rows should describe the selected mode directly, not repeat the
    // same mixed-mode text across separate rows.
    expect(alarmDescriptions).toEqual([
      'Create an audible alarm on a door, window, or 20-foot Cube within range; when a creature touches or enters the warded area, the ward emits a handbell sound for 10 seconds within 60 feet.',
      'Create a mental alarm on a door, window, or 20-foot Cube within range; when a creature touches or enters the warded area, the caster receives a mental ping within 1 mile that can wake them from sleep.'
    ]);
    expect(blindnessDeafnessDescriptions).toEqual([
      'On a failed Constitution save, the target gains the Blinded condition for up to 1 minute and repeats the save at the end of each turn, ending the condition on a success.',
      'On a failed Constitution save, the target gains the Deafened condition for up to 1 minute and repeats the save at the end of each turn, ending the condition on a success.'
    ]);
  });

  it('keeps Haste defensive description focused on the full haste contract', () => {
    const haste = getSpells(3).find(spell => spell.id === 'haste');
    const defensiveEffect = haste?.effects.find(effect => effect.type === 'DEFENSIVE');

    // Haste currently stores its typed effect as a +2 AC defensive row, but the
    // visible row is the only effect card the UI has for the spell's speed,
    // Dexterity save, extra-action, and lethargy contract. Keep that wrapper
    // context visible without changing the underlying single-row model.
    expect(defensiveEffect?.description).toBe('Choose one willing creature within 30 feet for up to 1 minute with concentration. While Haste lasts, the target has doubled Speed, +2 Armor Class, Advantage on Dexterity saves, and one limited extra action each turn; when the spell ends, the target is Incapacitated with Speed 0 until the end of its next turn.');
  });

  it('keeps leap and burst damage descriptions tied to their targeting rules', () => {
    const chromaticOrb = getSpells(1).find(spell => spell.id === 'chromatic-orb');
    const iceKnife = getSpells(1).find(spell => spell.id === 'ice-knife');
    const chromaticOrbDamage = chromaticOrb?.effects.find(effect => effect.type === 'DAMAGE');
    const iceKnifeDescriptions = iceKnife?.effects.map(effect => effect.description) ?? [];

    // Chromatic Orb has a single damage row that also owns the duplicate-die
    // leap targeting rule. Ice Knife splits the primary Piercing hit from the
    // hit-or-miss Cold burst. These descriptions should expose the targeting
    // rules directly instead of leaving key behavior only in top-level prose.
    expect(chromaticOrbDamage?.description).toBe('Choose Acid, Cold, Fire, Lightning, Poison, or Thunder, then make a ranged spell attack against one target within 90 feet. On a hit, the target takes 3d8 damage of the chosen type; if two or more damage dice match, the orb can leap to a different target within 30 feet and repeat the attack and damage roll, with higher slots increasing both damage and maximum leaps.');
    expect(iceKnifeDescriptions).toEqual([
      'On a ranged spell hit, the primary target takes 1d10 Piercing damage from the thrown ice shard.',
      'Hit or miss, the ice shard explodes after the primary attack; the target and each creature within 5 feet makes a Dexterity save, taking 2d6 Cold damage on a failed save, plus +1d6 per slot level above 1.'
    ]);
  });

  it('keeps persistent area damage descriptions tied to their save payloads', () => {
    const moonbeam = getSpells(2).find(spell => spell.id === 'moonbeam');
    const guardianOfFaith = getSpells(4).find(spell => spell.id === 'guardian-of-faith');
    const moonbeamDescriptions = moonbeam?.effects.map(effect => effect.description) ?? [];
    const guardianOfFaithDescriptions = guardianOfFaith?.effects.map(effect => effect.description) ?? [];

    // Moonbeam and Guardian of Faith both damage creatures through persistent
    // area timing rows. Those rows should name the save, damage payload, and
    // half-damage success branch directly instead of depending on another row
    // or top-level prose to explain what the saving throw does.
    expect(moonbeamDescriptions).toEqual([
      'Creatures in the 5-foot-radius, 40-foot-high Cylinder make a Constitution save, taking 2d10 Radiant damage on a failed save or half as much on a success; Shapechangers save with Disadvantage and revert on a failed save.',
      'A creature makes the same Constitution save against 2d10 Radiant damage when the Cylinder moves into its space, when it enters the area for the first time on a turn, or when it ends its turn there; Shapechangers save with Disadvantage and revert on a failed save.',
      'Dim Light fills the spell\'s 5-foot-radius, 40-foot-high cylinder for the duration.'
    ]);
    expect(guardianOfFaithDescriptions).toEqual([
      'An enemy that moves to a space within 10 feet of the guardian for the first time on a turn makes a Dexterity save, taking 20 Radiant damage on a failed save or half as much on a success.',
      'An enemy that starts its turn within 10 feet of the guardian makes a Dexterity save, taking 20 Radiant damage on a failed save or half as much on a success.'
    ]);
  });

  it('keeps repeated damage descriptions tied to their damage dice', () => {
    const wallOfFire = getSpells(4).find(spell => spell.id === 'wall-of-fire');
    const tashasCausticBrew = getSpells(1).find(spell => spell.id === 'tashas-caustic-brew');
    const wallOfFireDescriptions = wallOfFire?.effects.map(effect => effect.description) ?? [];
    const tashasCausticBrewDescriptions = tashasCausticBrew?.effects.map(effect => effect.description) ?? [];

    // Wall of Fire and Tasha's Caustic Brew both have repeated damage rows that
    // previously pointed back to "this damage." Repeated rows should name the
    // dice, damage type, trigger, and scaling directly so logs and UI cards can
    // stand alone without relying on a sibling row.
    expect(wallOfFireDescriptions).toEqual([
      'When the opaque wall appears as either a 60-foot-long, 20-foot-high, 1-foot-thick wall or a 20-foot-diameter, 20-foot-high, 1-foot-thick ring within 120 feet, each creature in its area makes a Dexterity save, taking 5d8 Fire damage on a failure or half as much on a success; each slot level above 4 adds +1d8 damage.',
      'A creature takes 5d8 Fire damage, plus +1d8 per slot level above 4, when it enters the wall for the first time on a turn; only the caster-selected side deals 10-foot proximity damage, and the other side deals no damage.',
      'A creature takes 5d8 Fire damage, plus +1d8 per slot level above 4, when it ends its turn inside the wall or within 10 feet of the caster-selected damage side; the other side deals no damage.'
    ]);
    expect(tashasCausticBrewDescriptions).toEqual([
      'On a failed Dexterity save, the creature is covered in acid until the spell ends or a creature uses its action to scrape or wash the acid off.',
      'A creature covered in the acid takes 2d4 Acid damage at the start of each of its turns; this recurring damage increases by 2d4 per slot level above 1st.'
    ]);
  });

  it('keeps social and chosen-damage descriptions player-facing', () => {
    const friends = getSpells(0).find(spell => spell.id === 'friends');
    const destructiveWave = getSpells(5).find(spell => spell.id === 'destructive-wave');
    const friendsEffect = friends?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const destructiveWaveDescriptions = destructiveWave?.effects.map(effect => effect.description) ?? [];

    // Friends has important social auto-success branches, and Destructive Wave
    // splits Thunder damage from a caster-chosen Radiant or Necrotic row. These
    // descriptions should explain the player-facing rule instead of exposing
    // implementation terms like "overrides" or pointing back to "this damage."
    expect(friendsEffect?.description).toBe('One nearby Humanoid that is not fighting the caster or the caster\'s allies and has not been affected by this casting within the last 24 hours must succeed on a Wisdom save or gain the Charmed condition for 1 minute.');
    expect(destructiveWaveDescriptions).toEqual([
      'Each chosen creature in the 30-foot Emanation makes one Constitution save for Destructive Wave, taking 5d6 Thunder damage on a failed save or half as much on a success.',
      'Using the same Constitution save, each chosen creature also takes 5d6 Radiant or Necrotic damage chosen by the caster on a failed save, or half as much on a success.',
      'A chosen creature that fails the Destructive Wave Constitution save also has the Prone condition; a successful save prevents the Prone rider.'
    ]);
  });

  it('keeps save-based status descriptions free of implementation shorthand', () => {
    const charmMonster = getSpells(4).find(spell => spell.id === 'charm-monster');
    const dominateBeast = getSpells(4).find(spell => spell.id === 'dominate-beast');
    const tidalWave = getSpells(3).find(spell => spell.id === 'tidal-wave');
    const charmMonsterStatus = charmMonster?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const dominateBeastStatus = dominateBeast?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const tidalWaveStatus = tidalWave?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // These status rows are shown as standalone runtime/UI facts. They should
    // name the save, affected creature, duration, and early-ending/repeat-save
    // behavior directly instead of leaking importer words such as "configured"
    // or "encoded" that only describe how the JSON was assembled.
    expect(charmMonsterStatus?.description).toBe("One visible creature within 30 feet makes a Wisdom save, with Advantage if the caster or the caster's allies are fighting it; on a failed save, it is Charmed for up to 1 hour and the condition ends early if the caster or allies damage it.");
    expect(dominateBeastStatus?.description).toBe("One visible Beast within 60 feet makes a Wisdom save, with Advantage if the caster or the caster's allies are fighting it; on a failed save, it is Charmed for up to 1 minute, and each time it takes damage it repeats the Wisdom save, ending the spell on itself on a success.");
    expect(tidalWaveStatus?.description).toBe('Each creature in the wave that fails the Dexterity save is knocked Prone; creatures that succeed on the save are not knocked Prone.');
  });

  it('keeps granted-action and long-save descriptions player-facing', () => {
    const contactOtherPlane = getSpells(5).find(spell => spell.id === 'contact-other-plane');
    const contagion = getSpells(5).find(spell => spell.id === 'contagion');
    const dragonsBreath = getSpells(2).find(spell => spell.id === 'dragons-breath');
    const contactOtherPlaneDescriptions = contactOtherPlane?.effects.map(effect => effect.description) ?? [];
    const contagionStatus = contagion?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const dragonsBreathDamage = dragonsBreath?.effects.find(effect => effect.type === 'DAMAGE');

    // Contact Other Plane, Contagion, and Dragon's Breath each split a spell
    // across rows that may appear independently in UI or runtime traces. These
    // rows should tell the player what save, condition, question, or breath
    // damage rule applies instead of saying the rule is prose-only or that a
    // row merely "represents" another row's granted action.
    expect(contactOtherPlaneDescriptions).toEqual([
      'When casting the spell, the caster makes a DC 15 Intelligence save. On a failed save, the caster takes 6d6 Psychic damage.',
      'On a failed DC 15 Intelligence save, the caster is Incapacitated until finishing a Long Rest, or until Greater Restoration ends the condition.',
      'On a successful DC 15 Intelligence save, the caster can ask the contacted otherworldly entity up to five questions before the spell ends, and the DM answers each with one word or a short phrase if one word would mislead.'
    ]);
    expect(contagionStatus?.description).toBe('On a failed Constitution save, the target is Poisoned and repeats the save at the end of each turn until it reaches three successes or three failures. Three successes end the spell on that target; three failures make the Poisoned condition last for 7 days, and attempts to end that Poisoned condition require another Constitution save.');
    expect(dragonsBreathDamage?.description).toBe('When the target uses the granted Magic action, creatures in the 15-foot Cone make a Dexterity save, taking 3d6 of the chosen Acid, Cold, Fire, Lightning, or Poison damage on a failed save or half as much on a success; higher slots add +1d6 damage per slot level above 2.');
  });

  it('keeps summoned mount and spirit descriptions focused on runtime facts', () => {
    const phantomSteed = getSpells(3).find(spell => spell.id === 'phantom-steed');
    const summonBeast = getSpells(2).find(spell => spell.id === 'summon-beast');
    const phantomSteedSummon = phantomSteed?.effects.find(effect => effect.type === 'SUMMONING');
    const summonBeastSummon = summonBeast?.effects.find(effect => effect.type === 'SUMMONING');

    // Summoned creatures become visible actors in the game state. Their rows
    // should summarize the created entity, control rules, stat/scaling facts,
    // and ending conditions instead of copying the whole spell card back into
    // the one effect description.
    expect(phantomSteedSummon?.description).toBe('Summon one Large quasi-real horse-like mount on an unoccupied ground space within 30 feet for up to 1 hour. The steed uses Riding Horse statistics with Speed 100 feet, can be ridden by the caster or a chosen creature, has saddle, bit, and bridle equipment that vanishes if carried more than 10 feet away, ends early if the steed takes damage, and fades over 1 minute when the spell ends.');
    expect(summonBeastSummon?.description).toBe('Summon one Bestial Spirit in a visible unoccupied space within 90 feet for up to 1 hour with concentration, choosing Air, Land, or Water form. The spirit is an ally, shares your Initiative count but acts immediately after you, obeys verbal commands with no action required, Dodges and uses movement to avoid danger without commands, disappears at 0 Hit Points or when the spell ends, and uses the slot level for AC, Air/Land/Water Hit Points, movement traits, Rend damage, and half-slot-level rounded-down Rend attacks.');
  });

  it('keeps steed beast and demon summon rows tied to command economy and lifecycle facts', () => {
    const findSteed = getSpells(2).find(spell => spell.id === 'find-steed');
    const summonBeast = getSpells(2).find(spell => spell.id === 'summon-beast');
    const summonGreaterDemon = getSpells(4).find(spell => spell.id === 'summon-greater-demon');
    const steedSummon = findSteed?.effects.find(effect => effect.type === 'SUMMONING');
    const beastSummon = summonBeast?.effects.find(effect => effect.type === 'SUMMONING');
    const demonUtility = summonGreaterDemon?.effects.find(effect => effect.type === 'UTILITY');

    // Summoning rows become actor-management UI. These expectations distinguish
    // a persistent controlled mount, an obedient allied spirit, and a contested
    // hostile demon with its own initiative and escape-save loop.
    expect(steedSummon?.description).toBe('Summon a persistent loyal steed companion in an unoccupied space within 30 feet, choosing Horse, Camel, Dire Wolf, or Elk appearance and Celestial, Fey, or Fiend creature type. The steed is allied, shares your Initiative count, functions as a controlled mount while ridden, acts independently after your turn to protect you if you are Incapacitated, communicates telepathically with you within 1 mile, disappears at 0 Hit Points or if you die, can be replaced or resummoned by recasting, and uses the spell slot level for AC, Hit Points, Hit Dice, flight at slot level 4+, attack damage, and Celestial, Fey, or Fiend traits.');
    expect(beastSummon?.description).toBe('Summon one Bestial Spirit in a visible unoccupied space within 90 feet for up to 1 hour with concentration, choosing Air, Land, or Water form. The spirit is an ally, shares your Initiative count but acts immediately after you, obeys verbal commands with no action required, Dodges and uses movement to avoid danger without commands, disappears at 0 Hit Points or when the spell ends, and uses the slot level for AC, Air/Land/Water Hit Points, movement traits, Rend damage, and half-slot-level rounded-down Rend attacks.');
    expect(demonUtility?.description).toBe('Summon one chosen Demon of CR 5 or lower in a visible unoccupied space within 60 feet for up to 1 hour with concentration; maximum CR increases by 1 per slot level above 4. The demon rolls its own Initiative, takes its own turns, obeys no-action verbal commands until it succeeds on an end-turn Charisma save, has Disadvantage on that save if you speak its true name, attacks creatures that attacked it when uncommanded, pursues nearest non-demons after control breaks, lingers for 1d6 rounds if concentration ends early while uncontrolled, disappears at 0 Hit Points or when the spell ends, and cannot cross or harm the optional consumed blood circle or target creatures inside it.');
  });

  it('keeps Bestow Curse utility description focused on curse menu and slot scaling', () => {
    const bestowCurse = getSpells(3).find(spell => spell.id === 'bestow-curse');
    const utilityEffect = bestowCurse?.effects.find(effect => effect.type === 'UTILITY');

    // Bestow Curse is currently represented as one utility row with a Wisdom
    // save and higher-slot duration table. The row should summarize the curse
    // menu and scaling facts so UI can show the available curse choices without
    // repeating the full card prose inside the effect description.
    expect(utilityEffect?.description).toBe('Touch one creature and force a Wisdom save; on a failure, choose one curse for the duration: Disadvantage on checks and saves with one ability score, Disadvantage on attacks against you, a start-turn Wisdom save that can waste the target action, +1d8 Necrotic damage from your attacks and spells, or a DM-approved alternative no stronger than those options. Remove Curse ends the curse, and higher slots extend duration or remove Concentration as listed in the scaling table.');
  });

  it('keeps Creation utility description focused on object limits and scaling', () => {
    const creation = getSpells(5).find(spell => spell.id === 'creation');
    const utilityEffect = creation?.effects.find(effect => effect.type === 'UTILITY');

    // Creation is a single object-making utility row. Its effect description
    // should expose the concrete object limits, material-duration dependency,
    // material-component failure rule, and higher-slot cube scaling without
    // copying the full spell card back into the row.
    expect(utilityEffect?.description).toBe('Create one nonliving object of seen vegetable or mineral material in a visible point within 30 feet, no larger than a 5-foot Cube at base level. The object duration depends on its material, mixed-material objects use the shortest duration, created objects cannot serve as another spell Material component, and higher slots increase the Cube by 5 feet per slot level above 5.');
  });

  it('keeps conditional damage rows tied to their dice and save context', () => {
    const hailOfThorns = getSpells(1).find(spell => spell.id === 'hail-of-thorns');
    const lightningLure = getSpells(0).find(spell => spell.id === 'lightning-lure');
    const hailOfThornsDescriptions = hailOfThorns?.effects.map(effect => effect.description) ?? [];
    const lightningLureDamage = lightningLure?.effects.find(effect => effect.type === 'DAMAGE');

    // These rows are conditional damage riders. They need to name their damage
    // dice, save, trigger, and scaling directly so the UI does not show vague
    // text such as "AoE damage" or "Damage applies" without the payload.
    expect(hailOfThornsDescriptions).toEqual([
      'Creatures in the 5-foot burst make a Dexterity save against 1d10 Piercing damage, taking half damage on a success; damage increases by 1d10 per slot level above 1st.',
      'When the triggering ranged weapon attack hits, the attack target and each creature within 5 feet of it make a Dexterity save, taking 1d10 Piercing damage on a failed save or half as much on a success; higher slots add +1d10 damage per slot level above 1.'
    ]);
    expect(lightningLureDamage?.description).toBe('After the failed Strength save pull, the target takes 1d8 Lightning damage only if it ends within 5 feet of the caster; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.');
  });

  it('keeps large-area damage rows tied to dice and save outcomes', () => {
    const illusoryDragon = getSpells(8).find(spell => spell.id === 'illusory-dragon');
    const tsunami = getSpells(8).find(spell => spell.id === 'tsunami');
    const illusoryDragonDamage = illusoryDragon?.effects.find(effect => effect.type === 'DAMAGE');
    const tsunamiDamageDescriptions = tsunami?.effects
      .filter(effect => effect.type === 'DAMAGE')
      .map(effect => effect.description) ?? [];

    // High-level area spells often create persistent map objects. Their damage
    // rows should still name the exact damage dice, save, and timing so combat
    // logs and UI cards do not depend on neighboring wrapper rows for the
    // mechanical payload.
    expect(illusoryDragonDamage?.description).toBe('During the bonus-action movement, the illusory dragon can exhale a 60-foot cone from its space; creatures in the cone make an Intelligence save, taking 7d6 of the chosen Acid, Cold, Fire, Lightning, Necrotic, or Poison damage on a failed save or half as much on a success, with Advantage for creatures that have discerned the illusion.');
    expect(tsunamiDamageDescriptions).toEqual([
      'When the wall appears, each creature in its area makes a Strength save against 6d10 Bludgeoning damage.',
      'At the start of each caster turn after the wall appears, Huge or smaller creatures inside the wall or whose space the wall enters make a Strength save, taking 5d10 Bludgeoning damage on a failed save or half as much on a success. A creature takes this damage only once per round, and later-round damage decreases by 1d10 each turn as the wall height falls.'
    ]);
  });

  it('keeps Green-Flame Blade fire rows tied to primary and leap scaling', () => {
    const greenFlameBlade = getSpells(0).find(spell => spell.id === 'green-flame-blade');
    const damageDescriptions = greenFlameBlade?.effects.map(effect => effect.description) ?? [];

    // Green-Flame Blade has one damage row for the primary melee hit and one
    // row for the fire that leaps to a nearby second creature. The primary row
    // should name the 1d8 Fire scaling just as clearly as the secondary row
    // names spellcasting-modifier damage and later d8 scaling.
    expect(damageDescriptions).toEqual([
      'On a melee weapon hit, the primary target takes the weapon attack normal effects plus extra Fire damage that starts at 1d8 at character level 5, increases to 2d8 at level 11, and 3d8 at level 17.',
      'On a hit, a second creature within 5 feet of the target takes fire damage equal to your spellcasting ability modifier. This secondary fire also gains +1d8 at 5th level, +2d8 at 11th level, +3d8 at 17th level.'
    ]);
  });

  it('keeps omitted area damage dice visible on burn, volley, and split cylinder rows', () => {
    const web = getSpells(2).find(spell => spell.id === 'web');
    const conjureVolley = getSpells(5).find(spell => spell.id === 'conjure-volley');
    const flameStrike = getSpells(5).find(spell => spell.id === 'flame-strike');
    const webDamage = web?.effects.find(effect => effect.type === 'DAMAGE');
    const conjureVolleyDamage = conjureVolley?.effects.find(effect => effect.type === 'DAMAGE');
    const flameStrikeDescriptions = flameStrike?.effects.map(effect => effect.description) ?? [];

    // These rows already carry exact damage payloads in structured metadata, but
    // the visible row text used generic "damage" wording. Runtime logs and UI
    // cards should show the dice, damage type, save branch, and scaling directly
    // instead of requiring another reader to inspect hidden metadata.
    expect(webDamage?.description).toBe('If a 5-foot cube of web is ignited, the burning web is destroyed in 1 round and a creature that starts its turn in that burning area takes 2d4 Fire damage.');
    expect(conjureVolleyDamage?.description).toBe('Each creature in the 40-foot-radius, 20-foot-high cylinder makes a Dexterity save, taking 8d8 damage of the ammunition or thrown weapon type on a failed save or half as much on a success.');
    expect(flameStrikeDescriptions).toEqual([
      'Each creature in the cylinder makes a Dexterity save, taking 5d6 Fire damage on a failed save or half as much on a success; higher slots add 1d6 Fire damage per slot level above 5.',
      'Each creature in the cylinder makes a Dexterity save, taking 5d6 Radiant damage on a failed save or half as much on a success; higher slots add 1d6 Radiant damage per slot level above 5.'
    ]);
  });

  it('keeps unusual damage rows tied to their explicit payloads', () => {
    const phantasmalForce = getSpells(2).find(spell => spell.id === 'phantasmal-force');
    const createHomunculus = getSpells(6).find(spell => spell.id === 'create-homunculus');
    const reverseGravity = getSpells(7).find(spell => spell.id === 'reverse-gravity');
    const phantasmalForceDamage = phantasmalForce?.effects.find(effect => effect.type === 'DAMAGE');
    const createHomunculusDamage = createHomunculus?.effects.find(effect => effect.type === 'DAMAGE');
    const reverseGravityDamage = reverseGravity?.effects.find(effect => effect.type === 'DAMAGE');

    // These rows are not ordinary attack/save damage rows: they cover illusion
    // hazards, ritual self-harm, and collision during forced falling. The visible
    // row still needs to name the modeled dice and damage type so special-case
    // logs do not hide their concrete payload.
    expect(phantasmalForceDamage?.description).toBe('While the target remains affected, hazardous interactions with the illusion can deal 2d8 Psychic damage to it.');
    expect(createHomunculusDamage?.description).toBe('The caster cuts themself with the jewel-encrusted dagger and takes 2d4 irreducible Piercing damage as part of creating the homunculus.');
    expect(reverseGravityDamage?.description).toBe('If a ceiling or anchored object is encountered during the upward fall, creatures and objects strike it and take normal falling damage as Bludgeoning damage.');
  });

  it('keeps threshold status rows tied to save and condition names', () => {
    const divineWord = getSpells(7).find(spell => spell.id === 'divine-word');
    const harm = getSpells(6).find(spell => spell.id === 'harm');
    const divineWordDeath = divineWord?.effects.find(effect =>
      effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Dead'
    );
    const harmMaxHpReduction = harm?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // These status rows are threshold outcomes: Divine Word depends on target
    // Hit Points after a Charisma save, and Harm depends on failed Constitution
    // save damage. The row text should name both the save and the condition so
    // combat logs do not display a bare "failed save" outcome.
    expect(divineWordDeath?.description).toBe('On a failed Charisma save, a chosen creature within 30 feet with 20 Hit Points or fewer dies; Celestial, Elemental, Fey, or Fiend targets also resolve the planar return branch on the same failed save.');
    expect(harmMaxHpReduction?.description).toBe("On a failed Constitution save, the target's Hit Point maximum is reduced by the Necrotic damage it took from Harm, but not below 1.");
  });

  it('keeps ray and glyph status rows tied to save and condition names', () => {
    const prismaticSpray = getSpells(7).find(spell => spell.id === 'prismatic-spray');
    const symbol = getSpells(7).find(spell => spell.id === 'symbol');
    const prismaticDescriptions = prismaticSpray?.effects
      .filter(effect => effect.type === 'STATUS_CONDITION')
      .map(effect => effect.description) ?? [];
    const symbolDescriptions = symbol?.effects
      .filter(effect => effect.type === 'STATUS_CONDITION')
      .map(effect => effect.description) ?? [];

    // Prismatic Spray and Symbol both route status payloads through named
    // tables. The rows need to carry the initial save and condition names so a
    // combat log can stand alone without forcing the player to reopen the full
    // spell card or infer which save "failed save" meant.
    expect(prismaticDescriptions).toEqual(expect.arrayContaining([
      'Indigo ray: on a failed Dexterity save, the target gains the Restrained condition and starts the end-turn Constitution save track. Three successes end the condition, and three failures impose Petrified.',
      'Violet ray: on a failed Dexterity save, the target gains the Blinded condition until the start-of-next-turn Wisdom save resolves.'
    ]));
    expect(symbolDescriptions).toEqual(expect.arrayContaining([
      'Fear symbol: on a failed Wisdom save, the target gains the Frightened condition for 1 minute and must move at least 30 feet away from the glyph on each of its turns if able.',
      'Pain symbol: on a failed Constitution save, the target gains the Incapacitated condition for 1 minute.',
      'Sleep symbol: on a failed Wisdom save, the target gains the Unconscious condition for 10 minutes, ending early if it takes damage or another creature uses an action to shake it awake.',
      'Stunning symbol: on a failed Wisdom save, the target gains the Stunned condition for 1 minute.'
    ]));
  });

  it('keeps repeat-save status rows tied to condition and ending facts', () => {
    const rayOfEnfeeblement = getSpells(2).find(spell => spell.id === 'ray-of-enfeeblement');
    const fear = getSpells(3).find(spell => spell.id === 'fear');
    const inciteGreed = getSpells(3).find(spell => spell.id === 'incite-greed');
    const rayStatus = rayOfEnfeeblement?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const fearStatus = fear?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const inciteGreedStatus = inciteGreed?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // These status rows all depend on a failed save and then give the target a
    // repeat-save escape route. The row text should name the condition, duration,
    // repeated save type, and success-ending rule so the status card is complete
    // without reading hidden repeat-save metadata.
    expect(rayStatus?.description).toBe("On a failed Constitution save, the target becomes Enfeebled for up to 1 minute: it has Disadvantage on Strength-based D20 Tests, subtracts 1d8 from damage rolls, and repeats the Constitution save at the end of each turn, ending the effect on a success. On a successful initial save, it only has Disadvantage on its next attack roll until the start of your next turn.");
    expect(fearStatus?.description).toBe('Each creature in the 30-foot Cone that fails the Wisdom save drops what it is holding and is Frightened for up to 1 minute with concentration. While Frightened, it takes the Dash action and moves away by the safest route each turn if it can, and it repeats the Wisdom save only after ending a turn without line of sight to you, ending the spell on itself on a success.');
    expect(inciteGreedStatus?.description).toBe('On a failed Wisdom save, the target gains the Charmed condition for up to 1 minute; it repeats the Wisdom save at the end of each turn and ends the condition on a success.');
  });

  it('keeps mechanics-rich wrapper rows tied to their actionable payloads', () => {
    const conjureFey = getSpells(6).find(spell => spell.id === 'conjure-fey');
    const holyWeapon = getSpells(5).find(spell => spell.id === 'holy-weapon');
    const conjureFeyUtility = conjureFey?.effects.find(effect => effect.type === 'UTILITY');
    const holyWeaponUtility = holyWeapon?.effects.find(effect => effect.type === 'UTILITY');
    const holyWeaponDamage = holyWeapon?.effects.find(effect => effect.type === 'DAMAGE');

    // These rows are the first UI-facing summaries for two spells with later
    // turn actions. They should name the concrete Bonus Action choices, distance
    // limits, save, and damage payload instead of pointing at sibling rows or
    // saying only that an attack happens.
    expect(conjureFeyUtility?.description).toBe('Conjure Fey is a repeatable teleport-attack loop: summon the Medium spirit, attack when it appears, then on later turns use a Bonus Action to teleport it up to 30 feet and make the same melee spell attack; a hit deals Psychic damage and Frightens the target until the start of your next turn.');
    expect(holyWeaponUtility?.description).toBe('The touched weapon sheds Bright Light in 30 feet and Dim Light for 30 more feet, becomes magical, and adds 2d8 Radiant damage to weapon attacks made with it. As a Bonus Action, the caster can end the spell early to unleash the dismiss burst against chosen visible creatures within 30 feet of the weapon.');
    expect(holyWeaponDamage?.description).toBe('When the caster dismisses the spell as a Bonus Action, each chosen visible creature within 30 feet of the weapon makes a Constitution save, taking 4d8 Radiant damage on a failed save or half as much on a success.');
  });

  it('keeps complex utility rows tied to mode and boundary facts', () => {
    const bigbysHand = getSpells(5).find(spell => spell.id === 'bigbys-hand');
    const telepathy = getSpells(8).find(spell => spell.id === 'telepathy');
    const bigbysHandUtility = bigbysHand?.effects.find(effect => effect.type === 'UTILITY');
    const telepathyUtility = telepathy?.effects.find(effect => effect.type === 'UTILITY');

    // Bigby's Hand and Telepathy are both single-row utility models with
    // important player-facing branches in their prose/control options. Their
    // summaries should preserve those choices and limits instead of leaving
    // combat UI with only generic "mode" or "link" wording.
    expect(bigbysHandUtility?.description).toBe("Create a Large shimmering force hand in a visible unoccupied space within 120 feet for up to 1 minute with concentration. When cast and on later Bonus Actions, the caster can move the hand up to 60 feet and choose Clenched Fist, Forceful Hand, Grasping Hand, or Interposing Hand; the hand has AC 20, Hit Points equal to the caster's Hit Point maximum, Strength 26, Dexterity 10, and the spell ends if the hand drops to 0 Hit Points.");
    expect(telepathyUtility?.description).toBe('Create a 24-hour telepathic link with one familiar willing creature anywhere on the same plane. The link ends if either creature leaves the plane, lets both creatures instantly exchange words, images, sounds, and other sensory messages, and lets the target recognize the caster and understand the meaning of those messages.');
  });

  it('keeps common control rows tied to saves, status, and endings', () => {
    const command = getSpells(1).find(spell => spell.id === 'command');
    const holdPerson = getSpells(2).find(spell => spell.id === 'hold-person');
    const suggestion = getSpells(2).find(spell => spell.id === 'suggestion');
    const commandUtility = command?.effects.find(effect => effect.type === 'UTILITY');
    const holdPersonStatus = holdPerson?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const suggestionUtility = suggestion?.effects.find(effect => effect.type === 'UTILITY');

    // These low-level control spells are likely to appear often in combat UI.
    // Their visible rows should name the save type, key control/status outcome,
    // and the early-ending or repeat-save facts that decide when control stops.
    expect(commandUtility?.description).toBe('One visible creature within 60 feet that fails a Wisdom save follows the chosen one-word command on its next turn only: Approach moves by the shortest direct route toward you and ends if within 5 feet, Drop releases held items and ends its turn, Flee moves away by the fastest available means, Grovel becomes Prone and ends its turn, or Halt does not move and takes no action or Bonus Action. Higher-level slots add one target per slot level above 1.');
    expect(holdPersonStatus?.description).toBe('One visible Humanoid within 60 feet that fails the Wisdom save is Paralyzed for up to 1 minute with concentration, repeats the Wisdom save at the end of each turn to end the spell on itself, and higher-level slots add one Humanoid target per slot level above 2.');
    expect(suggestionUtility?.description).toBe('One creature within 30 feet that can hear and understand the caster makes a Wisdom save; on a failure, it follows a reasonable suggestion for up to 8 hours with concentration, ending early if the caster or allies damage it or when the suggested activity is completed.');
  });

  it('keeps command paralysis and confusion controls tied to option outcomes and repeat saves', () => {
    const command = getSpells(1).find(spell => spell.id === 'command');
    const holdPerson = getSpells(2).find(spell => spell.id === 'hold-person');
    const confusion = getSpells(4).find(spell => spell.id === 'confusion');
    const commandUtility = command?.effects.find(effect => effect.type === 'UTILITY');
    const holdPersonStatus = holdPerson?.effects.find(effect => effect.type === 'STATUS_CONDITION');
    const confusionStatus = confusion?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // These rows are control-heavy but compact: Command needs each menu option's
    // consequence, Hold Person needs the Humanoid gate plus higher-slot target
    // count, and Confusion needs the recurring behavior-table loop.
    expect(commandUtility?.description).toBe('One visible creature within 60 feet that fails a Wisdom save follows the chosen one-word command on its next turn only: Approach moves by the shortest direct route toward you and ends if within 5 feet, Drop releases held items and ends its turn, Flee moves away by the fastest available means, Grovel becomes Prone and ends its turn, or Halt does not move and takes no action or Bonus Action. Higher-level slots add one target per slot level above 1.');
    expect(holdPersonStatus?.description).toBe('One visible Humanoid within 60 feet that fails the Wisdom save is Paralyzed for up to 1 minute with concentration, repeats the Wisdom save at the end of each turn to end the spell on itself, and higher-level slots add one Humanoid target per slot level above 2.');
    expect(confusionStatus?.description).toBe('Each creature in the 10-foot-radius Sphere centered on a point within 90 feet makes a Wisdom save or becomes Confused for up to 1 minute with concentration. While Confused, the target cannot take Bonus Actions or Reactions, rolls 1d10 at the start of each turn to determine that turn behavior from the spell table, and repeats the Wisdom save at the end of each turn to end the spell on itself; each slot level above 4 adds 5 feet to the Sphere radius.');
  });

  it('keeps control and forced-movement rows tied to save and rider facts', () => {
    const compelledDuel = getSpells(1).find(spell => spell.id === 'compelled-duel');
    const mindSpike = getSpells(2).find(spell => spell.id === 'mind-spike');
    const thunderwave = getSpells(1).find(spell => spell.id === 'thunderwave');
    const compelledDuelUtility = compelledDuel?.effects[0];
    const mindSpikeUtility = mindSpike?.effects.find(effect => effect.type === 'UTILITY');
    const thunderwaveUtility = thunderwave?.effects.find(effect => effect.type === 'UTILITY');

    // These rows are not just generic control summaries. They carry save gates,
    // forced movement, tracking, sound, and early-ending facts that must remain
    // visible when the effect row is shown without the full spell card.
    expect(compelledDuelUtility?.description).toBe('One visible creature within 30 feet makes a Wisdom save; on a failure, it has Disadvantage on attacks against creatures other than the caster and cannot willingly move more than 30 feet from the caster for up to 1 minute with concentration. The spell ends if the caster attacks another creature, casts a spell on another enemy, an ally damages the target, or the caster ends a turn more than 30 feet away.');
    expect(mindSpikeUtility?.description).toBe("On a failed Wisdom save, the caster knows the target's location for up to 1 hour with concentration while both remain on the same plane; during that time, the target cannot become hidden from the caster and gains no benefit from Invisible against the caster.");
    expect(thunderwaveUtility?.description).toBe('On a failed Constitution save, each creature in the 15-foot Cube is pushed 10 feet away from the caster; unsecured objects wholly in the area are also pushed 10 feet away, and the thunderous boom is audible within 300 feet.');
  });

  it('keeps Compelled Duel secondary rows scoped to attack pressure and willing-movement leash facts', () => {
    const compelledDuel = getSpells(1).find(spell => spell.id === 'compelled-duel');
    const attackPressure = compelledDuel?.effects[1];
    const movementLeash = compelledDuel?.effects[2];

    // Compelled Duel already has one full taunt wrapper row. The secondary
    // rows should not invent or repeat unrelated outcomes; they should expose
    // the specific attack-pressure and willing-movement constraints their
    // triggers make visible in runtime logs.
    expect(attackPressure?.description).toBe('The compelled target has Disadvantage on attacks against creatures other than the caster while the duel remains active.');
    expect(movementLeash?.description).toBe('The compelled target cannot willingly move to a space more than 30 feet from the caster while the duel remains active.');
  });

  it('keeps Crown of Madness rows tied to forced attack control, sustain, and repeat-save facts', () => {
    const crownOfMadness = getSpells(2).find(spell => spell.id === 'crown-of-madness');
    const controlWrapper = crownOfMadness?.effects[0];
    const charmedStatus = crownOfMadness?.effects[1];

    // Crown of Madness has a control wrapper and a Charmed status payload.
    // The visible rows should preserve the Humanoid gate, forced attack loop,
    // no-valid-target exception, repeat save, and sustain action without
    // collapsing those runtime decisions into generic "failed save" wording.
    expect(controlWrapper?.description).toBe('One visible Humanoid within 120 feet that fails the Wisdom save is Charmed for up to 1 minute with concentration; before moving on each turn, it must use its action to make a melee attack against a caster-chosen creature other than itself, can act normally if no creature is chosen or reachable, repeats the Wisdom save at the end of each turn, and the caster must spend a Magic action on later turns to maintain control.');
    expect(charmedStatus?.description).toBe('A failed Wisdom save applies Charmed for up to 1 minute with concentration, with an end-turn Wisdom repeat save that ends the spell on that target on a success.');
  });

  it('keeps Heat Metal damage descriptions tied to initial and repeated heating rows', () => {
    const heatMetal = getSpells(2).find(spell => spell.id === 'heat-metal');
    const effectDescriptions = heatMetal?.effects.map(effect => effect.description) ?? [];

    // Heat Metal splits the spell into initial object-contact Fire damage,
    // later-turn bonus-action repeat damage, and the drop/disadvantage rider.
    // The damage rows should read as player-facing spell effects instead of
    // importer notes about "initial heating" or "later turns."
    expect(effectDescriptions).toEqual([
      'A creature in physical contact with the red-hot metal object takes 2d8 Fire damage when the spell is cast.',
      'On later turns, the caster can use the granted Bonus Action to deal 2d8 Fire damage again if the heated object is within range.',
      'If a creature takes this damage while holding or wearing the object, it must succeed on a Constitution saving throw or drop the object if it can. If it doesn\'t drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn.'
    ]);
  });

  it('keeps Spiritual Weapon descriptions tied to initial and later weapon attacks', () => {
    const spiritualWeapon = getSpells(2).find(spell => spell.id === 'spiritual-weapon');
    const effectDescriptions = spiritualWeapon?.effects.map(effect => effect.description) ?? [];

    // Spiritual Weapon creates a spectral force, makes an immediate melee
    // spell attack, and then grants a later-turn Bonus Action to move the force
    // and repeat the attack. The damage rows should describe those two attack
    // timings while the utility row carries the movement wrapper.
    expect(effectDescriptions).toEqual([
      'When the spectral weapon appears, the caster can make one melee spell attack against a creature within 5 feet of it for 1d8 plus spellcasting modifier Force damage on a hit.',
      'On later turns, the caster can use the granted Bonus Action to move the spectral weapon up to 20 feet and repeat the melee spell attack against a creature within 5 feet of it for 1d8 plus spellcasting modifier Force damage on a hit, with higher slots adding 1d8 per slot level above 2.',
      'You can move the weapon up to 20 feet and repeat the attack against a creature within 5 feet of it.'
    ]);
  });

  it('keeps conjured guardian attack rows tied to their damage payloads', () => {
    const faithfulHound = getSpells(4).find(spell => spell.id === 'mordenkainens-faithful-hound');
    const houndDamage = faithfulHound?.effects.find(effect => effect.type === 'DAMAGE');

    // Mordenkainen's Faithful Hound is a long-lived conjured guard. Its bite
    // row should name the Dexterity save, 4d8 Force payload, enemy reach, and
    // distance ending so the attack can stand alone in logs.
    expect(houndDamage?.description).toBe("At the start of each of the caster's turns, the hound attempts to bite one enemy within 5 feet of it; that enemy makes a Dexterity save, taking 4d8 Force damage on a failed save or no damage on a success, and the spell ends early if the caster and hound are more than 300 feet apart.");
  });

  it('keeps lingering radiant and spirit attack rows tied to damage payloads', () => {
    const sickeningRadiance = getSpells(4).find(spell => spell.id === 'sickening-radiance');
    const conjureFey = getSpells(6).find(spell => spell.id === 'conjure-fey');
    const sickeningRadianceDamageDescriptions = sickeningRadiance?.effects
      .filter(effect => effect.type === 'DAMAGE')
      .map(effect => effect.description) ?? [];
    const conjureFeyDamage = conjureFey?.effects.find(effect => effect.type === 'DAMAGE');

    // Sickening Radiance has separate entry and turn-start Radiant rows, while
    // Conjure Fey has a spirit-origin attack row. These rows need their dice,
    // damage type, and scaling facts so logs are self-contained instead of only
    // saying when a save or attack happens.
    expect(sickeningRadianceDamageDescriptions).toEqual([
      'The first time on a turn that a creature moves into the 30-foot-radius Sickening Radiance area, it makes a Constitution save; on a failure it takes 4d10 Radiant damage, gains one exhaustion level, emits 5-foot-radius dim green light, and cannot benefit from being Invisible until the spell ends.',
      'A creature that starts its turn in the 30-foot-radius Sickening Radiance area makes a Constitution save; on a failure it takes 4d10 Radiant damage, gains one exhaustion level, emits 5-foot-radius dim green light, and cannot benefit from being Invisible until the spell ends.'
    ]);
    expect(conjureFeyDamage?.description).toBe('When the spirit appears, and on later turns after you teleport it with a Bonus Action, you can make one melee spell attack from the spirit against a creature within 5 feet of it; on a hit, the target takes 3d12 plus your spellcasting ability modifier Psychic damage, increasing by 1d12 per slot level above 6.');
  });

  it('keeps Melfs Acid Arrow descriptions tied to initial and delayed acid rows', () => {
    const melfsAcidArrow = getSpells(2).find(spell => spell.id === 'melfs-acid-arrow');
    const effectDescriptions = melfsAcidArrow?.effects.map(effect => effect.description) ?? [];

    // Melf's Acid Arrow splits a ranged spell attack into initial splash damage
    // and delayed end-of-next-turn acid damage. The row text should explain the
    // hit and miss branches without sounding like a migration note.
    expect(effectDescriptions).toEqual([
      'A ranged spell attack deals 4d4 Acid damage on a hit; on a miss, the target takes half of this initial Acid damage and no delayed damage.',
      'On a hit, the target takes 2d4 Acid damage at the end of its next turn.'
    ]);
  });

  it('keeps Vitriolic Sphere descriptions tied to save and delayed acid rows', () => {
    const vitriolicSphere = getSpells(4).find(spell => spell.id === 'vitriolic-sphere');
    const effectDescriptions = vitriolicSphere?.effects.map(effect => effect.description) ?? [];

    // Vitriolic Sphere has an immediate Dexterity-save acid burst plus a
    // delayed damage row that applies only to creatures that failed that save.
    // These descriptions should make the save branch and delayed branch clear
    // for runtime logs and UI rows.
    expect(effectDescriptions).toEqual([
      'A 1-foot acid orb streaks to a point within 150 feet and explodes in a 20-foot-radius Sphere; each creature there makes a Dexterity save, taking 10d4 Acid damage on a failed save or half as much on a success, with +2d4 per slot level above 4.',
      'A creature that failed the initial Dexterity save takes 5d4 Acid damage at the end of its next turn.'
    ]);
  });

  it('keeps Phantasmal Killer descriptions tied to initial and repeat Wisdom saves', () => {
    const phantasmalKiller = getSpells(4).find(spell => spell.id === 'phantasmal-killer');
    const effectDescriptions = phantasmalKiller?.effects.map(effect => effect.description) ?? [];

    // Phantasmal Killer has an initial Wisdom-save Psychic damage branch and
    // a repeated end-turn Wisdom save. The first row should explain the failed
    // and successful save outcomes without using note-like "Initial save" text.
    expect(effectDescriptions).toEqual([
      'The target makes an initial Wisdom save, taking 4d10 Psychic damage and gaining the spell\'s disadvantage rider on a failed save, or taking half damage and ending the spell on a success.',
      'At the end of each of the target\'s turns, it makes a Wisdom saving throw. On a failed save, it takes the Psychic damage again; on a successful save, the spell ends.'
    ]);
  });

  it('keeps Storm Sphere descriptions tied to entry and end-turn Strength saves', () => {
    const stormSphere = getSpells(4).find(spell => spell.id === 'storm-sphere');
    const effectDescriptions = stormSphere?.effects.map(effect => effect.description) ?? [];

    // Storm Sphere has two separate Strength-save Bludgeoning rows before its
    // lightning attack, difficult terrain, and listening-disadvantage rows. The
    // save rows should name both the 2d6 failed-save damage and the no-damage
    // success branch so they read cleanly in UI and runtime traces.
    expect(effectDescriptions).toEqual([
      'Each creature in the sphere when it appears makes a Strength save, taking 2d6 Bludgeoning damage on a failed save or no damage on a success.',
      'A creature that ends its turn in the sphere makes a Strength save, taking 2d6 Bludgeoning damage on a failed save or no damage on a success.',
      'As a Bonus Action each turn, the caster can make a ranged spell attack from the sphere\'s center against one creature within 60 feet of the center, dealing 4d6 Lightning damage on a hit and gaining advantage if the target is in the sphere.',
      'The sphere\'s space is Difficult Terrain.',
      'Creatures within 30 feet of the sphere have disadvantage on Wisdom (Perception) checks made to listen.'
    ]);
  });

  it('keeps Flaming Sphere descriptions tied to end-turn and movement damage rows', () => {
    const flamingSphere = getSpells(2).find(spell => spell.id === 'flaming-sphere');
    const effectDescriptions = flamingSphere?.effects.map(effect => effect.description) ?? [];

    // Flaming Sphere has one damage row for creatures ending near the sphere,
    // one damage row for rolling the sphere into a creature's space, and one
    // utility row for the granted movement. The damage rows should name both
    // the Dexterity save and the 2d6 Fire damage they carry.
    expect(effectDescriptions).toEqual([
      'A creature that ends its turn within 5 feet of the sphere makes a Dexterity save, taking 2d6 Fire damage on a failed save or half as much on a success.',
      'As a Bonus Action, the caster can move the sphere up to 30 feet; if it enters a creature\'s space, that creature makes a Dexterity save against 2d6 Fire damage and the sphere stops moving for the turn.',
      'You can move the sphere up to 30 feet, rolling it along the ground.'
    ]);
  });

  it('keeps Hunger of Hadar rows tied to darkness terrain and turn timing', () => {
    const hungerOfHadar = getSpells(3).find(spell => spell.id === 'hunger-of-hadar');
    const effectDescriptions = hungerOfHadar?.effects.map(effect => effect.description) ?? [];

    // Hunger of Hadar is a layered 20-foot sphere with terrain, visibility,
    // start-turn damage, and end-turn save damage. Each row should identify
    // the timing and sphere rule it owns instead of using terse area shorthand.
    expect(effectDescriptions).toEqual([
      'For up to 1 minute with concentration, a 20-foot-radius Sphere of magical darkness within 150 feet is Difficult Terrain and cannot be illuminated by magical or nonmagical light.',
      'Creatures fully inside the 20-foot-radius Sphere have the Blinded condition because no light can illuminate the area.',
      'A creature that starts its turn in the 20-foot-radius Sphere takes 2d6 Cold damage; at higher slots, either this Cold damage or the Acid end-turn damage increases by 1d6 per slot level above 3.',
      'A creature that ends its turn in the 20-foot-radius Sphere makes a Dexterity save or takes 2d6 Acid damage from otherworldly tentacles; at higher slots, either this Acid damage or the Cold start-turn damage increases by 1d6 per slot level above 3.'
    ]);
  });

  it('keeps Maelstrom rows tied to water geometry start-turn saves and pull', () => {
    const maelstrom = getSpells(5).find(spell => spell.id === 'maelstrom');
    const effectDescriptions = maelstrom?.effects.map(effect => effect.description) ?? [];

    // Maelstrom splits one water hazard into damage, pull, terrain, and
    // creation rows. The rows should each name the 30-foot-radius,
    // 5-foot-deep water area and start-turn Strength save instead of relying
    // on a generic "maelstrom" label.
    expect(effectDescriptions).toEqual([
      'A creature that starts its turn in the 30-foot-radius, 5-foot-deep maelstrom makes a Strength save; on a failed save, it takes 6d6 Bludgeoning damage.',
      'A creature that starts its turn in the 30-foot-radius, 5-foot-deep maelstrom makes the same Strength save; on a failed save, it is pulled 10 feet toward the center.',
      'For up to 1 minute with concentration, the 30-foot-radius, 5-foot-deep maelstrom area is Difficult Terrain.',
      'Create a swirling 30-foot-radius, 5-foot-deep mass of water centered on a ground point or body of water within 120 feet; the area carries the spell damage, pull, and Difficult Terrain rows.'
    ]);
  });

  it('keeps Gust of Wind descriptions tied to forced movement and wind utility rows', () => {
    const gustOfWind = getSpells(2).find(spell => spell.id === 'gust-of-wind');
    const effectDescriptions = gustOfWind?.effects.map(effect => effect.description) ?? [];

    // Gust of Wind has one forced-movement row and one utility row for the
    // line's environmental wind behavior plus the granted direction-change
    // action. The descriptions should keep those responsibilities visible
    // without changing the current two-row model.
    expect(effectDescriptions).toEqual([
      'Creatures in the 60-foot by 10-foot Line make a Strength save against being pushed 15 feet away from the caster along the Line when the wind affects them.',
      'The Line disperses gas or vapor, extinguishes candles and similar unprotected flames, makes protected flames dance with a 50 percent extinguish chance, and grants the caster a later-turn Bonus Action to change the Line direction.'
    ]);
  });

  it('keeps Feather Fall utility description focused on falling-control effect', () => {
    const featherFall = getSpells(1).find(spell => spell.id === 'feather-fall');
    const utilityEffect = featherFall?.effects.find(effect => effect.type === 'UTILITY');

    // Feather Fall has a single utility row for slowing falling creatures. The
    // conditional-ending data already records that the effect ends for a target
    // that lands early, so the visible row should stay focused on target count,
    // falling speed, duration, and no falling damage.
    expect(utilityEffect?.description).toBe('Choose up to five falling creatures within 60 feet. Each target descends at 60 feet per round for up to 1 minute and takes no falling damage if it lands before the spell ends.');
  });

  it('keeps movement-action utility rows tied to granted actions and end states', () => {
    const expeditiousRetreat = getSpells(1).find(spell => spell.id === 'expeditious-retreat');
    const fly = getSpells(3).find(spell => spell.id === 'fly');
    const waterWalk = getSpells(3).find(spell => spell.id === 'water-walk');
    const expeditiousRetreatUtility = expeditiousRetreat?.effects.find(effect => effect.type === 'UTILITY');
    const flyUtility = fly?.effects.find(effect => effect.type === 'UTILITY');
    const waterWalkUtility = waterWalk?.effects.find(effect => effect.type === 'UTILITY');

    // These rows grant movement permissions rather than direct damage or
    // conditions. The visible text should name the granted action, target limit,
    // duration, and cleanup risk so action bars and movement tooltips do not
    // rely on hidden granted-action or end-cleanup metadata.
    expect(expeditiousRetreatUtility?.description).toBe('For up to 10 minutes with concentration, the caster can take the Dash action as a Bonus Action when the spell is cast and again as a Bonus Action on each later turn.');
    expect(flyUtility?.description).toBe('Touch one willing creature for up to 10 minutes with concentration; the target gains a 60-foot flying speed, higher slots add one target per slot level above 3, and when the spell ends an aloft target falls unless it can stop the fall.');
    expect(waterWalkUtility?.description).toBe("Choose up to ten creatures within 30 feet for 1 hour. Targets can move across liquid surfaces as harmless solid ground and can use a Bonus Action to pass between a liquid's surface and the liquid itself, while falling into the liquid bypasses that Bonus Action requirement.");
  });

  it('keeps Witch Bolt descriptions tied to initial and sustained lightning rows', () => {
    const witchBolt = getSpells(1).find(spell => spell.id === 'witch-bolt');
    const effectDescriptions = witchBolt?.effects.map(effect => effect.description) ?? [];

    // Witch Bolt has an initial ranged spell attack row and a sustained
    // later-turn automatic damage row. The sustained row also owns the current
    // range and Total Cover ending conditions, so the description should keep
    // that lifecycle visible without changing the modeled oddity that the
    // later automatic damage can apply even if the first attack missed.
    expect(effectDescriptions).toEqual([
      'On a ranged spell attack hit, the target takes 2d12 Lightning damage from the initial crackling beam.',
      'While concentration holds, the caster can use a later-turn Bonus Action to automatically deal 1d12 Lightning damage to the target, even if the first attack missed; the spell ends if the target leaves range or has Total Cover from the caster.'
    ]);
  });

  it('keeps Hex descriptions tied to damage rider and curse utility rows', () => {
    const hex = getSpells(1).find(spell => spell.id === 'hex');
    const effectDescriptions = hex?.effects.map(effect => effect.description) ?? [];

    // Hex has one Necrotic damage rider row and one utility row for the chosen
    // ability-check disadvantage plus curse transfer. The descriptions should
    // read as spell behavior, not importer-facing "modeled rider" notes.
    expect(effectDescriptions).toEqual([
      'When the caster hits the cursed target with an attack roll, the spell adds 1d6 Necrotic damage.',
      'The cursed target has Disadvantage on ability checks using the caster-chosen ability, and if it drops to 0 Hit Points before the spell ends, the caster can use a later-turn Bonus Action to curse a new creature.'
    ]);
  });

  it('keeps Hunters Mark descriptions tied to weapon damage and tracking rows', () => {
    const huntersMark = getSpells(1).find(spell => spell.id === 'hunters-mark');
    const effectDescriptions = huntersMark?.effects.map(effect => effect.description) ?? [];

    // Hunter's Mark has one weapon-attack damage rider row and one information
    // utility row for tracking advantage plus mark transfer. The row text
    // should avoid importer-facing "modeled rider" language and keep the
    // transfer behavior visible.
    expect(effectDescriptions).toEqual([
      'When the caster hits the marked target with a weapon attack, the spell adds 1d6 Force damage.',
      'The caster has Advantage on Wisdom (Perception or Survival) checks to find the marked target, and if it drops to 0 Hit Points before the spell ends, the caster can use a Bonus Action to move the mark to a new visible creature within range.'
    ]);
  });

  it('keeps Incendiary Cloud descriptions tied to appearance, entry, and end-turn fire rows', () => {
    const incendiaryCloud = getSpells(8).find(spell => spell.id === 'incendiary-cloud');
    const effectDescriptions = incendiaryCloud?.effects.map(effect => effect.description) ?? [];

    // Incendiary Cloud splits the cloud wrapper, appearance damage, movement /
    // entry damage, end-turn damage, and cloud movement into separate rows. The
    // damage rows should each name the 10d8 Fire payload and save branch so UI
    // logs do not show vague "makes the save" text without the consequence.
    expect(effectDescriptions).toEqual([
      'Create a 20-foot-radius Heavily Obscured sphere of ember-smoke within 150 feet for up to 1 minute with concentration. The cloud lasts until concentration ends or strong wind disperses it, a creature makes the spell damage save only once per turn, and at the start of each caster turn the cloud moves 10 feet away from the caster in a chosen direction.',
      'Each creature in the cloud when it appears makes a Dexterity save, taking 10d8 Fire damage on a failed save or half as much on a success.',
      'A creature makes the Dexterity save when the cloud moves into its space or when it enters the cloud, taking 10d8 Fire damage on a failed save or half as much on a success.',
      'A creature that ends its turn in the cloud makes the Dexterity save, taking 10d8 Fire damage on a failed save or half as much on a success.',
      'The cloud moves 10 feet away from the caster in a direction the caster chooses at the start of each caster turn.'
    ]);
  });

  it('keeps Cloudkill descriptions tied to appearance, entry, end-turn, and fog wrapper rows', () => {
    const cloudkill = getSpells(5).find(spell => spell.id === 'cloudkill');
    const effectDescriptions = cloudkill?.effects.map(effect => effect.description) ?? [];

    // Cloudkill splits the fog wrapper, appearance damage, entry or fog-move
    // damage, and end-turn damage into separate rows. Each damage row should
    // carry its own 5d8 Poison save consequence while the utility row keeps the
    // fog shape, obscuration, wind dispersal, and start-turn drift visible.
    expect(effectDescriptions).toEqual([
      'When the 20-foot-radius fog sphere appears, each creature in it makes a Constitution save, taking 5d8 Poison damage on a failed save or half as much on a success; each slot level above 5 adds +1d8 damage.',
      'The first time on a turn that a creature enters the fog sphere or the sphere moves into its space, it makes a Constitution save, taking 5d8 Poison damage on a failed save or half as much on a success; each slot level above 5 adds +1d8 damage.',
      'A creature that ends its turn in the fog sphere makes a Constitution save, taking 5d8 Poison damage on a failed save or half as much on a success; each slot level above 5 adds +1d8 damage.',
      'Create a 20-foot-radius Sphere of yellow-green, Heavily Obscured fog for up to 10 minutes with concentration. Strong wind disperses the fog and ends the spell, and the sphere moves 10 feet away from you at the start of each of your turns.'
    ]);
  });

  it('keeps Insect Plague descriptions tied to damage timing, terrain, and swarm wrapper rows', () => {
    const insectPlague = getSpells(5).find(spell => spell.id === 'insect-plague');
    const effectDescriptions = insectPlague?.effects.map(effect => effect.description) ?? [];

    // Insect Plague splits one locust swarm into three Piercing damage timings,
    // Difficult Terrain, Lightly Obscured terrain, and a small wrapper row for
    // the swarm's placement and duration. Each row should describe its own
    // responsibility without vague "canonical spell" notes or duplicate
    // obscuration text.
    expect(effectDescriptions).toEqual([
      'When the swarm appears, each creature in it makes a Constitution save, taking 4d10 Piercing damage on a failed save or half on a success.',
      'A creature that enters the swarm for the first time on a turn makes a Constitution save, taking 4d10 Piercing damage on a failed save or half on a success; this can happen only once per turn.',
      'A creature that ends its turn in the swarm makes a Constitution save, taking 4d10 Piercing damage on a failed save or half on a success; this can happen only once per turn.',
      'The swarm area is Difficult Terrain for the spell duration.',
      'The swarm area is Lightly Obscured for the spell duration.',
      'Create a 20-foot-radius locust swarm sphere for up to 10 minutes with concentration; separate rows carry the Piercing damage timing, Difficult Terrain, and Lightly Obscured effects.'
    ]);
  });

  it('keeps Blade Barrier descriptions tied to damage timing, terrain, and cover rows', () => {
    const bladeBarrier = getSpells(6).find(spell => spell.id === 'blade-barrier');
    const effectDescriptions = bladeBarrier?.effects.map(effect => effect.description) ?? [];

    // Blade Barrier splits one blade wall into immediate, entry, and end-turn
    // Force damage rows, plus separate terrain and cover rows. The delayed
    // damage rows should state their own 6d10 Force save result instead of
    // pointing back to vague "canonical spell" timing.
    expect(effectDescriptions).toEqual([
      'When the straight 100-foot-long, 20-foot-high, 5-foot-thick wall or 60-foot-diameter ring appears within 90 feet, creatures in the blade wall space make a Dexterity save, taking 6d10 Force damage on a failure or half as much on a success; the wall provides Three-Quarters Cover and its space is Difficult Terrain.',
      'A creature that enters the blade wall space for the first time on a turn makes a Dexterity save, taking 6d10 Force damage on a failure or half as much on a success; a creature makes this save only once per turn.',
      'A creature that ends its turn in the blade wall space makes a Dexterity save, taking 6d10 Force damage on a failure or half as much on a success; a creature makes this save only once per turn.',
      'The blade wall space is Difficult Terrain for the spell duration.',
      'Create a straight wall of whirling magical blades up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick. The wall provides Three-Quarters Cover.'
    ]);
  });

  it('keeps Wall of Thorns descriptions tied to damage timing, terrain, movement, and wall shape rows', () => {
    const wallOfThorns = getSpells(6).find(spell => spell.id === 'wall-of-thorns');
    const effectDescriptions = wallOfThorns?.effects.map(effect => effect.description) ?? [];

    // Wall of Thorns splits the initial Piercing damage, later Slashing damage,
    // sight-blocking terrain, movement cost, and wall-shape wrapper into
    // separate rows. Each row should be readable on its own without schema
    // marker language or implicit references to another save row.
    expect(effectDescriptions).toEqual([
      'When the wall appears, each creature in its area makes a Dexterity save, taking 7d8 Piercing damage on a failed save or half as much on a success.',
      'The first time a creature enters a space in the wall on a turn, it makes a Dexterity save, taking 7d8 Slashing damage on a failed save or half as much on a success.',
      'A creature that ends its turn in the wall makes a Dexterity save, taking 7d8 Slashing damage on a failed save or half as much on a success; this can happen only once per turn.',
      'Create a thorn wall on a solid surface, up to 60 feet long, 10 feet high, and 5 feet thick, that blocks line of sight for the spell duration.',
      'For every 1 foot a creature moves through the wall, it must spend 4 feet of movement.',
      'Create a thorn wall for up to 10 minutes with concentration as a straight wall up to 60 feet long, 10 feet high, and 5 feet thick, or as a circular wall up to 20 feet in diameter, 20 feet high, and 5 feet thick.'
    ]);
  });

  it('keeps terrain rows tied to area size and terrain type', () => {
    const spikeGrowth = getSpells(2).find(spell => spell.id === 'spike-growth');
    const web = getSpells(2).find(spell => spell.id === 'web');
    const spikeGrowthDescriptions = spikeGrowth?.effects.map(effect => effect.description) ?? [];
    const webTerrainDescriptions = web?.effects
      .filter(effect => effect.type === 'TERRAIN')
      .map(effect => effect.description) ?? [];

    // Terrain rows often feed tactical overlays directly. They should name the
    // affected area and terrain type, not just say "the area," so a combat log
    // or map tooltip can stand alone without hidden area metadata.
    expect(spikeGrowthDescriptions).toEqual([
      'For up to 10 minutes with concentration, create a camouflaged 20-foot-radius Sphere centered on a point within 150 feet; a creature takes 2d4 Piercing damage for every 5 feet it travels through the damaging Difficult Terrain.',
      'The 20-foot-radius Sphere is Difficult Terrain for up to 10 minutes with concentration, and a creature that could not see the area when the spell was cast must Search and succeed on a Wisdom (Perception or Survival) check against the spell save DC to recognize the hazard before entering.'
    ]);
    expect(webTerrainDescriptions).toEqual([
      'Create a 20-foot Cube of sticky webs for up to 1 hour with concentration; the webbed area anchors restraint saves, Difficult Terrain, and burning-web damage.',
      'The webbed 20-foot Cube is Difficult Terrain for the spell duration.'
    ]);
  });

  it('keeps Dawn descriptions tied to appearance, end-turn, sunlight, and movement rows', () => {
    const dawn = getSpells(5).find(spell => spell.id === 'dawn');
    const effectDescriptions = dawn?.effects.map(effect => effect.description) ?? [];

    // Dawn splits its Radiant damage into one row for the cylinder appearing
    // and one row for creatures ending turns inside it. The utility row should
    // keep the sunlight cylinder and bonus-action movement facts visible while
    // the damage rows name the 4d10 Radiant save outcomes.
    expect(effectDescriptions).toEqual([
      'When the cylinder appears, each creature in it makes a Constitution save, taking 4d10 Radiant damage on a failed save or half on a success.',
      'A creature that ends its turn in the cylinder makes a Constitution save, taking 4d10 Radiant damage on a failed save or half on a success.',
      'Create a 30-foot-radius, 40-foot-high cylinder of bright sunlight for up to 1 minute with concentration; while within 60 feet of the cylinder, the caster can move it up to 60 feet as a Bonus Action.'
    ]);
  });

  it('keeps Control Water utility description focused on mode-selection wrapper facts', () => {
    const controlWater = getSpells(4).find(spell => spell.id === 'control-water');
    const utilityEffect = controlWater?.effects.find(effect => effect.type === 'UTILITY');

    // Control Water keeps its four detailed mode summaries in modeChoice data
    // rather than as separate effect rows. The visible utility row should
    // describe the shared wrapper and keep the mode consequences visible enough
    // that the UI preview does not hide range, pull, damage, escape, or vehicle
    // handling facts behind the full spell card.
    expect(utilityEffect?.description).toBe('Control water in a 100-foot cube within 300 feet for up to 10 minutes with concentration, choosing one active mode at a time: Flood, Part Water, Redirect Flow, or Whirlpool; later Magic actions can repeat or switch modes, and those modes carry the wave, trench, flow, pull, damage, escape, and vehicle-handling rules.');
  });

  it('keeps Move Earth descriptions split between terrain reshaping and procedural limits', () => {
    const moveEarth = getSpells(6).find(spell => spell.id === 'move-earth');
    const effectDescriptions = moveEarth?.effects.map(effect => effect.description) ?? [];

    // Move Earth has a terrain row for the actual earthwork and a utility row
    // for the long-running concentration, reassignment, and material limits.
    // Keeping those concerns separate makes the spell readable without copying
    // the whole card into one procedural paragraph.
    expect(effectDescriptions).toEqual([
      'Reshape dirt, sand, or clay in a 40-foot-square area within 120 feet into elevation changes, trenches, walls, or pillars up to half the area\'s largest dimension; each change takes 10 minutes, usually cannot trap or injure creatures because it is slow, and cannot manipulate natural stone or stone construction.',
      'For up to 2 hours with concentration, each terrain transformation takes 10 minutes to complete and usually cannot trap or injure creatures because it happens slowly. At the end of every 10 minutes, the caster can choose a new area within range; natural stone and stone construction are not manipulated, rocks and structures shift to accommodate the terrain, unstable structures might collapse, and plants are carried with the moved earth.'
    ]);
  });

  it('keeps Hallow utility description focused on area ward and extra-effect routing facts', () => {
    const hallow = getSpells(5).find(spell => spell.id === 'hallow');
    const utilityEffect = hallow?.effects.find(effect => effect.type === 'UTILITY');

    // Hallow is currently modeled as one dense utility row. The row should
    // explain the persistent ward shell and extra-effect routing without
    // copying the full menu of extra effects into the effect description.
    expect(utilityEffect?.description).toBe('Infuse a point with holy or unholy power to create an until-dispelled area up to a 60-foot radius; the spell fails if the area overlaps another Hallow. The ward can block chosen Aberration, Celestial, Elemental, Fey, Fiend, or Undead creatures from willingly entering and suppress possession, Charmed, and Frightened effects caused by them, with chosen types optionally excluded. The caster also binds one extra area effect, chosen from the spell options or a DM option; affected creatures can be filtered by creature kind, deity, or leader, and can make the listed Charisma save when entering or starting there to ignore that extra effect until they leave.');
  });

  it('keeps Investiture of Ice freezing wind speed text player-facing', () => {
    const investitureOfIce = getSpells(6).find(spell => spell.id === 'investiture-of-ice');
    const effectDescriptions = investitureOfIce?.effects.map(effect => effect.description) ?? [];

    // Investiture of Ice uses a fractional speed-change marker internally to
    // represent halving Speed. The row text should describe the rule players
    // need, not the temporary schema workaround that stores the multiplier.
    expect(effectDescriptions).toContain("A creature that fails the save against the freezing wind has its Speed halved until the start of the caster's next turn.");
  });

  it('keeps Otiluke Freezing Sphere descriptions tied to blast, water-freeze, restraint, and held-globe rows', () => {
    const freezingSphere = getSpells(6).find(spell => spell.id === 'otilukes-freezing-sphere');
    const effectDescriptions = freezingSphere?.effects.map(effect => effect.description) ?? [];

    // Otiluke's Freezing Sphere splits the initial Cold blast, water-freezing
    // terrain, surface-swimmer restraint, and optional held-globe delivery into
    // separate rows. These rows should stay short and player-facing without
    // re-copying the full card text into each modeled effect.
    expect(effectDescriptions).toEqual([
      'The globe explodes in a 60-foot-radius Sphere; each creature in that area makes a Constitution save, taking 10d6 Cold damage on a failed save or half as much on a successful one.',
      'If the globe strikes water, it freezes a 30-foot-square area 6 inches deep for 1 minute.',
      'Creatures swimming on the frozen surface are Restrained in the ice and can use an action to make a Strength (Athletics) check against the caster spell save DC to break free.',
      'The caster may hold the sling-bullet-sized globe instead of firing it. The globe can be thrown 40 feet, hurled with a sling, set down safely, or left to explode after 1 minute if it has not shattered.'
    ]);
  });

  it('keeps Grasping Vine descriptions tied to hit damage, Grappled, and pull rows', () => {
    const graspingVine = getSpells(4).find(spell => spell.id === 'grasping-vine');
    const effectDescriptions = graspingVine?.effects.map(effect => effect.description) ?? [];

    // Grasping Vine splits one melee spell attack into damage, Grappled, and
    // forced-pull rows. The first two rows should describe player-facing hit
    // results, not importer phrases such as "hit-based vine effect" or
    // "modeled escape check."
    expect(effectDescriptions).toEqual([
      'On a melee spell attack hit from the vine, the target takes 4d8 Bludgeoning damage.',
      'On the triggering melee spell attack hit from the vine, a Huge or smaller target gains the Grappled condition for up to 1 minute and can use an action to make the spell-save-DC escape check.',
      'On a melee spell attack hit from the vine, the target is pulled up to 30 feet toward the vine.'
    ]);
  });

  it('keeps Color Spray description tied to its Constitution save and Blinded row', () => {
    const colorSpray = getSpells(1).find(spell => spell.id === 'color-spray');
    const statusEffect = colorSpray?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // Color Spray has one status row for the 15-foot cone's Constitution save
    // and Blinded result. Its description should read as player-facing effect
    // text instead of saying the repeat save is "modeled" by the importer.
    expect(statusEffect?.description).toBe(
      'Creatures in the 15-foot Cone must succeed on a Constitution save or gain the Blinded condition until the end of the caster\'s next turn.'
    );
  });

  it('keeps Ray of Sickness descriptions tied to hit damage and Poisoned rows', () => {
    const rayOfSickness = getSpells(1).find(spell => spell.id === 'ray-of-sickness');
    const effectDescriptions = rayOfSickness?.effects.map(effect => effect.description) ?? [];

    // Ray of Sickness splits the ranged spell attack hit into Poison damage
    // and a same-hit Poisoned rider. The rider row should name the hit result
    // and duration without saying the hit is "modeled" by importer machinery.
    expect(effectDescriptions).toEqual([
      'On a ranged spell hit, one target takes 2d8 Poison damage, increasing by 1d8 per slot level above 1st.',
      'On the triggering ranged spell attack hit, the target gains the Poisoned condition until the end of the caster\'s next turn.'
    ]);
  });

  it('keeps Searing Smite descriptions tied to first-hit damage and Ignited rows', () => {
    const searingSmite = getSpells(1).find(spell => spell.id === 'searing-smite');
    const effectDescriptions = searingSmite?.effects.map(effect => effect.description) ?? [];

    // Searing Smite splits the first melee weapon hit into immediate Fire
    // damage and an Ignited recurring-burn rider. The status row should explain
    // the player-facing burn loop instead of calling it a "modeled" rider.
    expect(effectDescriptions).toEqual([
      'On the triggering weapon hit, the target takes 1d6 Fire damage as the smite damage rider.',
      'On the triggering melee weapon hit, the target gains the Ignited condition for up to 1 minute; at the start of each of its turns, it takes 1d6 Fire damage and then makes a Constitution save that ends the spell on a success.'
    ]);
  });

  it('keeps Tashas Hideous Laughter Prone description tied to the Wisdom save', () => {
    const hideousLaughter = getSpells(1).find(spell => spell.id === 'tashas-hideous-laughter');
    const effectDescriptions = hideousLaughter?.effects.map(effect => effect.description) ?? [];

    // Tasha's Hideous Laughter splits the Incapacitated and Prone outcomes into
    // separate status rows. The Prone row should name the failed Wisdom save
    // directly so it remains readable when the UI shows the row by itself.
    expect(effectDescriptions).toContain('On a failed Wisdom save, the target falls Prone and cannot end the Prone condition on itself while the spell lasts.');
  });

  it('keeps Tashas Hideous Laughter Incapacitated row tied to duration, repeat saves, and scaling facts', () => {
    const hideousLaughter = getSpells(1).find(spell => spell.id === 'tashas-hideous-laughter');
    const incapacitatedRow = hideousLaughter?.effects.find(effect => effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Incapacitated');

    // The Incapacitated row owns the repeat-save machine for this spell. It
    // should name the 30-foot visible target, duration, concentration, damage
    // save Advantage, and higher-slot target scaling instead of relying on
    // compact same-effect shorthand.
    expect(incapacitatedRow?.description).toBe('One visible creature within 30 feet that fails the Wisdom save gains Incapacitated for up to 1 minute with concentration, repeats the Wisdom save at the end of each turn and whenever it takes damage, gains Advantage on damage-triggered repeat saves, and higher-level slots add one target per slot level above 1.');
  });

  it('keeps Calm Emotions rows tied to area, mode choice, suppression, and indifference endings', () => {
    const calmEmotions = getSpells(2).find(spell => spell.id === 'calm-emotions');
    const defensiveMode = calmEmotions?.effects[0];
    const indifferenceMode = calmEmotions?.effects[1];

    // Calm Emotions splits defensive suppression from social indifference.
    // Both rows should name the 20-foot Sphere, 60-foot placement, Humanoid
    // gate, Charisma save, duration, and mode-specific ending facts so logs
    // do not collapse the two options into generic failed-save text.
    expect(defensiveMode?.description).toBe('Each Humanoid in a 20-foot-radius Sphere within 60 feet that fails the Charisma save can be chosen to gain immunity to Charmed and Frightened for up to 1 minute with concentration, suppressing any existing Charmed or Frightened condition for the same duration.');
    expect(indifferenceMode?.description).toBe('Each Humanoid in a 20-foot-radius Sphere within 60 feet that fails the Charisma save can instead become indifferent toward caster-chosen creatures it is hostile toward for up to 1 minute with concentration, ending early for that target if it takes damage or witnesses its allies taking damage.');
  });

  it('keeps Divine Smite descriptions tied to base and Fiend or Undead radiant rows', () => {
    const divineSmite = getSpells(1).find(spell => spell.id === 'divine-smite');
    const effectDescriptions = divineSmite?.effects.map(effect => effect.description) ?? [];

    // Divine Smite splits the normal melee-hit Radiant damage from the extra
    // Fiend-or-Undead rider. The rider row should name the target family and
    // extra 1d8 payload instead of saying the extra damage is "modeled."
    expect(effectDescriptions).toEqual([
      'On a melee hit, the target takes an extra 2d8 Radiant damage, increasing by 1d8 per slot level above 1st.',
      'If the melee hit target is a Fiend or Undead, it takes an additional 1d8 Radiant damage.'
    ]);
  });

  it('keeps Ray of Frost descriptions tied to cold damage and speed reduction rows', () => {
    const rayOfFrost = getSpells(0).find(spell => spell.id === 'ray-of-frost');
    const effectDescriptions = rayOfFrost?.effects.map(effect => effect.description) ?? [];

    // Ray of Frost splits ranged spell hit damage from the same-hit speed
    // reduction rider. The movement row should name the 10-foot speed penalty
    // and duration instead of saying the behavior is "modeled" elsewhere.
    expect(effectDescriptions).toEqual([
      'On a ranged spell hit, one target takes 1d8 Cold damage, with cantrip-tier damage scaling at character levels 5, 11, and 17.',
      'On the triggering ranged spell hit, the target\'s Speed is reduced by 10 feet until the start of the caster\'s next turn.'
    ]);
  });

  it('keeps Shocking Grasp descriptions tied to lightning damage and reaction-control rows', () => {
    const shockingGrasp = getSpells(0).find(spell => spell.id === 'shocking-grasp');
    const effectDescriptions = shockingGrasp?.effects.map(effect => effect.description) ?? [];

    // Shocking Grasp splits melee spell hit damage from the opportunity-attack
    // suppression rider. The reaction-control row should name the triggering
    // melee spell hit so it remains readable when shown without its sibling row.
    expect(effectDescriptions).toEqual([
      'On a melee spell hit, one target takes 1d8 Lightning damage, with cantrip-tier damage scaling at character levels 5, 11, and 17.',
      'On the triggering melee spell hit, the target has opportunity attacks suppressed for 1 round.'
    ]);
  });

  it('keeps Thorn Whip descriptions tied to piercing damage and pull rows', () => {
    const thornWhip = getSpells(0).find(spell => spell.id === 'thorn-whip');
    const effectDescriptions = thornWhip?.effects.map(effect => effect.description) ?? [];

    // Thorn Whip is a melee spell attack at 30-foot range. The split rows
    // should name the melee-hit damage and same-hit pull rider so each row
    // remains readable when shown by itself.
    expect(effectDescriptions).toEqual([
      'One creature within 30 feet takes 1d6 Piercing damage on a melee spell hit; damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.',
      'On the same melee spell hit, a Large or smaller target can be pulled up to 10 feet toward the caster.'
    ]);
  });

  it('keeps Bones of the Earth damage description tied to its Dexterity save branch', () => {
    const bonesOfTheEarth = getSpells(6).find(spell => spell.id === 'bones-of-the-earth');
    const damageEffect = bonesOfTheEarth?.effects.find(effect => effect.type === 'DAMAGE');

    // Bones of the Earth has one damage row for the pillar being blocked by a
    // ceiling or obstacle. The row should name the Dexterity save and
    // failed-save damage instead of saying the no-damage success branch is
    // "modeled."
    expect(damageEffect?.description).toBe(
      'If a pillar is blocked by a ceiling or other obstacle, a creature on the pillar makes a Dexterity save, taking 6d6 Bludgeoning damage on a failed save or no damage on a success.'
    );
  });

  it('keeps Conjure Elemental damage description tied to its Dexterity save branch', () => {
    const conjureElemental = getSpells(5).find(spell => spell.id === 'conjure-elemental');
    const damageEffect = conjureElemental?.effects.find(effect => effect.type === 'DAMAGE');

    // Conjure Elemental stores a variable-damage Dexterity-save row plus
    // recurring restrained-target damage metadata. The row description should
    // explain the initial save branch and slot scaling without saying the
    // no-damage success branch is "modeled."
    expect(damageEffect?.description).toBe(
      'A creature forced to save against the elemental spirit makes a Dexterity save, taking 8d8 damage of the chosen element on a failed save or no damage on a success; each slot level above 5th adds 1d8 to this initial damage.'
    );
  });

  it('keeps Ottos Irresistible Dance utility description focused on wrapper facts', () => {
    const ottosDance = getSpells(6).find(spell => spell.id === 'ottos-irresistible-dance');
    const utilityEffect = ottosDance?.effects.find(effect => effect.type === 'UTILITY');

    // Otto's Irresistible Dance has sibling rows for Charmed, dancing in place,
    // attack Disadvantage / attacker Advantage, and repeat-save behavior. The
    // utility wrapper should keep target selection, immunity, dance flavor, and
    // control-option routing without importer-style "Records" notes.
    expect(utilityEffect?.description).toBe(
      'Choose one visible creature within 30 feet to begin a comic dance of shuffling, tapping, and capering; creatures that cannot be Charmed are immune. On a successful initial Wisdom save, the dancing-in-place movement lock lasts until the end of the target\'s next turn; on a failed save, the Charmed dance state continues for up to 1 minute with concentration and the target can use an action on each turn to repeat the save.'
    );
  });

  it('keeps Otiluke\'s Resilient Sphere utility description focused on barrier wrapper facts', () => {
    const resilientSphere = getSpells(4).find(spell => spell.id === 'otilukes-resilient-sphere');
    const utilityEffect = resilientSphere?.effects.find(effect => effect.type === 'UTILITY');

    // Otiluke's Resilient Sphere has a sibling defensive row for the sphere's
    // own damage immunity. The utility row should summarize containment,
    // barrier pass-through, movement, and Disintegrate interaction without
    // copying the full spell card back into one effect row.
    expect(utilityEffect?.description).toBe('Enclose one Large-or-smaller creature or object within 30 feet in a shimmering sphere for up to 1 minute with concentration. An unwilling creature makes a Dexterity save; the barrier blocks physical objects, energy, and spell effects both ways while allowing breathing, the weightless sphere can be rolled or picked up, and Disintegrate destroys the globe without harming anything inside.');
  });

  it('keeps Scatter utility description focused on target selection and relocation constraints', () => {
    const scatter = getSpells(6).find(spell => spell.id === 'scatter');
    const utilityEffect = scatter?.effects.find(effect => effect.type === 'UTILITY');

    // Scatter has a sibling movement row for the actual teleport relocation.
    // The utility row should keep the number of targets, visibility, save gate,
    // and legal destination constraints visible without repeating the full
    // top-level spell prose.
    expect(utilityEffect?.description).toBe('Choose up to five visible creatures within 30 feet. Unwilling targets make Wisdom saves before affected targets are relocated to caster-visible unoccupied spaces within 120 feet that must be on the ground or on a floor.');
  });

  it('keeps Wind Walk utility description focused on cloud-form wrapper facts', () => {
    const windWalk = getSpells(6).find(spell => spell.id === 'wind-walk');
    const utilityEffect = windWalk?.effects.find(effect => effect.type === 'UTILITY');

    // Wind Walk has sibling rows for fly speed, Prone immunity, weapon-damage
    // resistance, and the Stunned reversion interval. The utility row should
    // preserve target count, action limits, reversion loop, and safe descent
    // facts without copying those payload rows back into one monolithic card.
    expect(utilityEffect?.description).toBe('Transform the caster and up to ten willing creatures within 30 feet into cloud forms for up to 8 hours. In cloud form, a target can only Dash or use a Magic action to begin reverting, can later use the same Magic-action process to return to cloud form, and if flying when the spell ends descends 60 feet per round for 1 minute before falling any remaining distance.');
  });

  it('keeps Evards Black Tentacles descriptions tied to damage, Restrained, and terrain rows', () => {
    const evardsTentacles = getSpells(4).find(spell => spell.id === 'evards-black-tentacles');
    const effectDescriptions = evardsTentacles?.effects.map(effect => effect.description) ?? [];

    // Evard's Black Tentacles splits the Strength-save Bludgeoning damage,
    // Strength-save Restrained condition, and Difficult Terrain into separate
    // rows. The first two rows should name player-facing save and escape
    // outcomes instead of describing what the data does or does not model.
    expect(effectDescriptions).toEqual([
      'Each creature in the 20-foot square makes a Strength save, taking 3d6 Bludgeoning damage on a failed save or no damage on a success.',
      'A creature that fails the Strength save gains the Restrained condition for up to 1 minute and can use an action to make the spell-save-DC Strength (Athletics) escape check.',
      'The tentacles turn the ground in the 20-foot square into Difficult Terrain for the duration.'
    ]);
  });

  it('keeps Wrath of Nature descriptions tied to trees, roots, and rocks rows', () => {
    const wrathOfNature = getSpells(5).find(spell => spell.id === 'wrath-of-nature');
    const effectDescriptions = wrathOfNature?.effects.map(effect => effect.description) ?? [];

    // Wrath of Nature has separate rows for tree Slashing damage, tree-root
    // restraint, and loose-rock Prone setup. Each row should carry its own
    // trigger and payload context so the UI does not require rereading the full
    // spell prose to understand which natural feature is acting.
    expect(effectDescriptions).toEqual([
      'At the start of each caster turn, enemies within 10 feet of any tree in the 60-foot Cube make a Dexterity save, taking 4d6 Slashing damage on a failed save or half as much on a success.',
      'A creature that fails the turn-end Strength save against the tree roots is Restrained for up to 1 minute and can use an action to make the Athletics escape check to break free.',
      'As a Bonus Action, the caster launches a loose rock at a visible creature in the 60-foot Cube; on the ranged spell attack hit, the target takes 3d8 Bludgeoning damage and then makes a Strength save or falls Prone.'
    ]);
  });

  it('keeps Invulnerability utility description focused on self-cast wrapper facts', () => {
    const invulnerability = getSpells(9).find(spell => spell.id === 'invulnerability');
    const utilityEffect = invulnerability?.effects.find(effect => effect.type === 'UTILITY');

    // Invulnerability has a sibling defensive row for all-damage immunity. The
    // utility row should preserve the self-only, concentration, and consumed
    // component facts without using  Records / wrapper facts importer prose.
    expect(utilityEffect?.description).toBe(
      'The caster targets only themself, concentrates for up to 10 minutes, and consumes the 500 GP adamantine component while the defensive effect grants immunity to all damage until the spell ends.'
    );
  });
  it('keeps Gate utility description focused on portal and named-creature wrapper facts', () => {
    const gate = getSpells(9).find(spell => spell.id === 'gate');
    const utilityEffect = gate?.effects.find(effect => effect.type === 'UTILITY');

    // Gate has a sibling movement row for actual front-of-portal planar
    // transport. The utility row should keep portal setup, planar-ruler blocks,
    // named-creature pull, and lack of control without  Records / sibling-row
    // routing language.
    expect(utilityEffect?.description).toBe(
      'Creates a visible 5-to-20-foot planar portal with chosen orientation, front/back travel rules, destination visibility, planar-ruler opening blocks, optional true-name creature pull, and no special control over pulled creatures.'
    );
  });
  it('keeps Forcecage utility description focused on prison control facts', () => {
    const forcecage = getSpells(7).find(spell => spell.id === 'forcecage');
    const utilityEffect = forcecage?.effects.find(effect => effect.type === 'UTILITY');
    const movementEffect = forcecage?.effects.find(effect => effect.type === 'MOVEMENT');

    // Forcecage has a sibling movement row for partial-or-too-large creature
    // push-out. The utility row should read as the prison control effect a
    // player sees, not as importer routing language about wrapper facts.
    expect(utilityEffect?.description).toBe('Creates an invisible, immobile magical-force prison as either a 20-foot barred cage or a 10-foot solid box; creatures completely inside are trapped, creatures only partly inside or too large to fit are pushed completely outside, nonmagical exit is blocked, teleportation or interplanar escape requires a Charisma save, Ethereal travel is blocked, and Dispel Magic cannot end it.');
    expect(movementEffect?.description).toBe('Creatures only partially within the area, or too large to fit inside it, are pushed away from the center until completely outside it.');
  });

  it('keeps Wall of Stone utility description focused on construction and permanence facts', () => {
    const wallOfStone = getSpells(5).find(spell => spell.id === 'wall-of-stone');
    const utilityEffect = wallOfStone?.effects.find(effect => effect.type === 'UTILITY');

    // Wall of Stone is currently modeled as one utility row. That row should
    // carry the panel geometry, enclosure escape save, support constraints,
    // object durability, collapse risk, and permanence outcome without copying
    // the entire spell card.
    expect(utilityEffect?.description).toBe('Create a nonmagical stone wall for up to 10 minutes with concentration as ten contiguous 10-foot-by-10-foot panels, or as thinner 10-foot-by-20-foot panels. The wall can form supported shapes such as bridges, ramps, battlements, or similar stonework; a creature enclosed by the wall can make a Dexterity save to use its Reaction and move up to its Speed to escape enclosure. Each panel is a damageable stone object with AC 15, 30 Hit Points per inch of thickness, and Immunity to Poison and Psychic damage; destroyed panels can cause connected sections to collapse at the DM discretion, and full-duration concentration makes the wall permanent and unable to be dispelled.');
  });

  it('keeps Wall of Force utility description focused on barrier shape and blocking facts', () => {
    const wallOfForce = getSpells(5).find(spell => spell.id === 'wall-of-force');
    const utilityEffect = wallOfForce?.effects.find(effect => effect.type === 'UTILITY');

    // Wall of Force is currently modeled as one utility row. That row should
    // keep the shape limits, creature push choice, physical blocking, damage
    // immunity, Dispel Magic immunity, Disintegrate destruction, and Ethereal
    // blocking visible without copying the entire spell card.
    expect(utilityEffect?.description).toBe('Create an invisible magical-force barrier for up to 10 minutes with concentration as a 10-foot-radius dome or globe, or as up to ten contiguous 10-foot panels. If the wall cuts through a creature space when it appears, the caster chooses which side the creature is pushed to; nothing physically passes through the wall, it is immune to damage and Dispel Magic, Disintegrate destroys it, and it blocks Ethereal travel.');
  });

  it('keeps Whirlwind utility description focused on visible vortex control facts', () => {
    const whirlwind = getSpells(7).find(spell => spell.id === 'whirlwind');
    const utilityEffect = whirlwind?.effects.find(effect => effect.type === 'UTILITY');
    const movementDescriptions = whirlwind?.effects
      .filter(effect => effect.type === 'MOVEMENT')
      .map(effect => effect.description) ?? [];

    // Whirlwind already has sibling rows for moving the vortex, pulling
    // restrained creatures upward, spell-end falling, and escape hurling. The
    // utility row should describe the visible vortex and object-suction wrapper
    // without reading like a migration note about those sibling rows.
    expect(utilityEffect?.description).toBe('Creates a 10-foot-radius, 30-foot-high whirlwind on a visible ground point within 300 feet for up to 1 minute with concentration; the vortex can be moved along the ground, sucks up unsecured Medium-or-smaller objects that are not worn or carried, and its separate rows handle creature damage, restraint, upward pull, falling, and escape hurling.');
    expect(movementDescriptions).toEqual(expect.arrayContaining([
      'Until the spell ends, the caster can use an action to move the whirlwind up to 30 feet in any direction along the ground.',
      'When a creature starts its turn Restrained by the whirlwind, it is pulled 5 feet higher inside it unless already at the top.',
      'A restrained creature falls when the spell ends unless it has some means to stay aloft.',
      'On a successful Strength or Dexterity escape check, the creature is no longer Restrained and is hurled 3d6 x 10 feet away in a random direction.'
    ]));
  });

  it('keeps Symbol utility description focused on glyph trigger and activation facts', () => {
    const symbol = getSpells(7).find(spell => spell.id === 'symbol');
    const utilityEffect = symbol?.effects.find(effect => effect.type === 'UTILITY');
    const payloadDescriptions = symbol?.effects
      .filter(effect => effect.type !== 'UTILITY')
      .map(effect => effect.description) ?? [];

    // Symbol has six payload rows for Death, Discord, Fear, Pain, Sleep, and
    // Stunning. The utility row should explain how the glyph is placed,
    // triggered, and activated without reading like a migration note about
    // those sibling payload rows.
    expect(utilityEffect?.description).toBe('Inscribe a nearly imperceptible harmful glyph on a surface or closable object up to 10 feet across. The caster defines the trigger, creature-type exclusions, and password exclusions, and moving an inscribed object more than 10 feet breaks the glyph before it triggers. Once triggered, the glyph creates a 60-foot-radius Dim Light sphere for 10 minutes, affecting a creature on activation, first entry each turn, or turn end, no more than once per turn.');
    expect(payloadDescriptions).toEqual(expect.arrayContaining([
      'Death symbol: each target makes a Constitution save, taking 10d10 Necrotic damage on a failed save or half as much on success.',
      'Discord symbol failed save causes argument and disadvantage on attack rolls and ability checks for 1 minute.',
      'Fear symbol: on a failed Wisdom save, the target gains the Frightened condition for 1 minute and must move at least 30 feet away from the glyph on each of its turns if able.',
      'Pain symbol: on a failed Constitution save, the target gains the Incapacitated condition for 1 minute.',
      'Sleep symbol: on a failed Wisdom save, the target gains the Unconscious condition for 10 minutes, ending early if it takes damage or another creature uses an action to shake it awake.',
      'Stunning symbol: on a failed Wisdom save, the target gains the Stunned condition for 1 minute.'
    ]));
  });

  it('keeps Summon Lesser Demons utility description focused on summon table and hostile demon behavior', () => {
    const summonLesserDemons = getSpells(3).find(spell => spell.id === 'summon-lesser-demons');
    const utilityEffect = summonLesserDemons?.effects.find(effect => effect.type === 'UTILITY');

    // Summon Lesser Demons is still modeled as one utility row. That row should
    // be a compact runtime summary of the d6 summon table, demon placement,
    // hostile initiative behavior, and optional blood circle rather than a wall
    // of copied spell-card prose.
    expect(utilityEffect?.description).toBe('Roll the d6 demon table to summon either two CR 1-or-lower demons, four CR 1/2-or-lower demons, or eight CR 1/4-or-lower demons; the GM chooses the demons and the caster places them in visible unoccupied spaces within 60 feet. The demons disappear at 0 HP or when the spell ends, are hostile to every creature, roll group initiative, pursue the nearest non-demons, and cannot cross, harm, or target creatures inside an optional blood circle that consumes the material component when the spell ends.');
  });

  it('keeps Booming Blade descriptions split between melee hit and willing-move thunder trigger', () => {
    const boomingBlade = getSpells(0).find(spell => spell.id === 'booming-blade');
    const damageDescriptions = boomingBlade?.effects
      .filter(effect => effect.type === 'DAMAGE')
      .map(effect => effect.description) ?? [];

    // Booming Blade has two runtime states: the melee weapon hit that sheathes
    // the target in booming energy, and the delayed Thunder damage if that
    // target willingly moves before the next turn. Each row should describe its
    // own trigger without repeating the casting-action wrapper text.
    expect(damageDescriptions).toEqual([
      'On the melee weapon attack hit, the target suffers the attack\'s normal effects and is sheathed in booming energy until the start of the caster\'s next turn; at character levels 5, 11, and 17 this hit also adds 1d8, 2d8, or 3d8 Thunder damage.',
      'If the sheathed target willingly moves 5 feet or more before the start of the caster\'s next turn, it takes 1d8 Thunder damage and the spell ends; this movement damage becomes 2d8, 3d8, or 4d8 at character levels 5, 11, and 17.'
    ]);
  });

  it('keeps Mirror Image utility description focused on duplicate redirect sequence', () => {
    const mirrorImage = getSpells(2).find(spell => spell.id === 'mirror-image');
    const utilityEffect = mirrorImage?.effects.find(effect => effect.type === 'UTILITY');

    // Mirror Image is one defensive utility row. The row should read as an
    // ordered duplicate-redirection rule: create three images, redirect attack
    // hits on a d6 threshold, destroy only the struck duplicate, and end when no
    // duplicates remain.
    expect(utilityEffect?.description).toBe('Create three illusory duplicates in the caster\'s space for 1 minute; they move with the caster and mimic their actions. When a creature hits the caster with an attack roll, roll one d6 for each remaining duplicate; if any die rolls 3 or higher, one duplicate is hit and destroyed instead. Duplicates ignore all other damage and effects, the spell ends when all three are destroyed, and creatures with Blinded, Blindsight, or Truesight ignore this protection.');
  });

  it('keeps Hold Monster utility description focused instead of copied from top-level prose', () => {
    const holdMonster = getSpells(5).find(spell => spell.id === 'hold-monster');
    const utilityEffect = holdMonster?.effects.find(effect => effect.type === 'UTILITY');

    // Hold Monster has a structured Paralyzed row for the save and condition.
    // The companion utility row should carry only the control wrapper facts in
    // player-facing language, not importer-style "Records" routing notes.
    expect(utilityEffect?.description).toBe('Choose a visible creature within 90 feet; on a failed Wisdom save, the target is held by paralysis for up to 1 minute with concentration. The spell has no effect on Undead, and the target repeats the Wisdom save at the end of each turn, ending the spell on a success.');
  });

  it('keeps Psychic Scream utility description focused on wrapper-only mechanics', () => {
    const psychicScream = getSpells(9).find(spell => spell.id === 'psychic-scream');
    const utilityEffect = psychicScream?.effects.find(effect => effect.type === 'UTILITY');

    // Psychic Scream already has structured damage and Stunned rows. The
    // utility row should describe only the remaining wrapper facts so UI rows
    // and runtime traces do not repeat the full spell card prose.
    expect(utilityEffect?.description).toBe('Choose up to ten visible creatures within 90 feet; creatures with Intelligence 2 or lower are unaffected. If the Psychic damage kills a target that has a head, the head explodes.');
  });

  it('keeps Weird utility description focused on area illusion wrapper facts', () => {
    const weird = getSpells(9).find(spell => spell.id === 'weird');
    const utilityEffect = weird?.effects.find(effect => effect.type === 'UTILITY');

    // Weird already has separate rows for initial psychic damage, Frightened,
    // and repeat-save psychic damage. The utility row should preserve only the
    // area illusion wrapper role instead of duplicating those payload rows.
    expect(utilityEffect?.description).toBe('Create illusory terrors in the minds of chosen creatures in a 30-foot-radius sphere within 120 feet for up to 1 minute with concentration. Affected creatures resolve Wisdom saves for the initial terror and for end-turn repeat pressure, with the spell ending on a target that succeeds on its repeat save.');
  });

  it('keeps Meteor Swarm utility description focused on impact-point and object wrapper facts', () => {
    const meteorSwarm = getSpells(9).find(spell => spell.id === 'meteor-swarm');
    const utilityEffect = meteorSwarm?.effects.find(effect => effect.type === 'UTILITY');

    // Meteor Swarm already has separate Fire and Bludgeoning damage rows. The
    // utility row should carry the multi-point, overlap, and object side rules
    // without copying the full card prose back over those damage payloads.
    expect(utilityEffect?.description).toBe('Choose four different visible impact points within 1 mile, each creating a 40-foot-radius fiery sphere. A creature in overlapping spheres is affected only once, and nonmagical objects that are not worn or carried take the spell damage and start burning if flammable.');
  });

  it('keeps Storm of Vengeance utility description focused on cloud and schedule wrapper facts', () => {
    const stormOfVengeance = getSpells(9).find(spell => spell.id === 'storm-of-vengeance');
    const utilityEffect = stormOfVengeance?.effects.find(effect => effect.type === 'UTILITY');

    // Storm of Vengeance has structured rows for staged damage, Deafened, and
    // terrain plus an effectSchedule. The utility row should describe the
    // remaining cloud/schedule wrapper role instead of repeating every stage.
    expect(utilityEffect?.description).toBe('Creates a 300-foot-radius churning storm cloud centered on a visible point within 1 mile for up to 1 minute with concentration. Initial thunder and Deafened effects resolve when the cloud appears, then later caster-turn stages use the spell schedule for acid rain, lightning bolts, hailstones, and freezing rain; until the spell ends, ranged weapon attacks are impossible under the cloud and strong wind blows through the area.');
  });

  it('keeps Tensers Transformation utility description focused on martial wrapper benefits', () => {
    const tensersTransformation = getSpells(6).find(spell => spell.id === 'tensers-transformation');
    const utilityEffect = tensersTransformation?.effects.find(effect => effect.type === 'UTILITY');

    // Tenser's Transformation already has separate temporary Hit Point,
    // weapon-hit Force damage, and Exhaustion rows. The utility row should
    // describe the martial restrictions and benefits it owns without using
    // importer-facing "Records" or "sibling rows" language.
    expect(utilityEffect?.description).toBe('For up to 10 minutes with concentration, the caster cannot cast spells and gains Advantage on simple and martial weapon attacks, proficiency with all armor, shields, simple weapons, and martial weapons, proficiency in Strength and Constitution saves, and a two-attack Attack action unless another feature already grants extra attacks.');
  });

  it('keeps Feeblemind utility description focused on long-term lockout wrapper facts', () => {
    const feeblemind = getSpells(8).find(spell => spell.id === 'feeblemind');
    const utilityEffect = feeblemind?.effects.find(effect => effect.type === 'UTILITY');

    // Feeblemind already has separate Psychic damage and Feebleminded status
    // rows. The utility row should carry the remaining long-term lockouts and
    // ending routes instead of copying the entire spell description.
    expect(utilityEffect?.description).toBe('The failed-save target cannot cast spells, activate magic items, understand language, or communicate intelligibly, but can still recognize, follow, and protect friends. It repeats the Intelligence save every 30 days, and Greater Restoration, Heal, or Wish can also end the spell.');
  });

  it('keeps Sunburst utility description focused on sunlight and darkness wrapper facts', () => {
    const sunburst = getSpells(8).find(spell => spell.id === 'sunburst');
    const utilityEffect = sunburst?.effects.find(effect => effect.type === 'UTILITY');

    // Sunburst already has separate Radiant damage and Blinded rows. The
    // utility row should keep only the burst-light and darkness-dispel facts
    // that are not owned by those structured payload rows.
    expect(utilityEffect?.description).toBe('Brilliant sunlight flashes in a 60-foot-radius sphere centered within 150 feet, and the spell dispels magical Darkness in that area.');
  });

  it('keeps Power Word Kill utility description focused on death-threshold routing', () => {
    const powerWordKill = getSpells(9).find(spell => spell.id === 'power-word-kill');
    const utilityEffect = powerWordKill?.effects.find(effect => effect.type === 'UTILITY');

    // Power Word Kill already has a separate damage row for the over-100-HP
    // fallback. The utility row should describe the instant-death threshold and
    // branch routing that decide whether that sibling damage payload applies.
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. If the target has 100 Hit Points or fewer, it dies; if it has more than 100 Hit Points, it takes the 12d12 Psychic fallback damage instead.');
  });

  it('keeps Blade of Disaster utility description focused on blade control wrapper facts', () => {
    const bladeOfDisaster = getSpells(9).find(spell => spell.id === 'blade-of-disaster');
    const utilityEffect = bladeOfDisaster?.effects.find(effect => effect.type === 'UTILITY');

    // Blade of Disaster already has separate damage rows and a movement row.
    // The utility row should explain the created blade's control contract, not
    // repeat the full damage and movement prose owned by sibling rows.
    expect(utilityEffect?.description).toBe('Create a 3-foot planar blade in an unoccupied visible space within 60 feet for up to 1 minute with concentration. The caster makes up to two melee spell attacks with the blade when it appears and after each bonus-action movement, scores critical hits on 18 or higher, and the blade passes harmlessly through barriers.');
  });

  it('keeps Prismatic Spray utility description focused on ray-selection wrapper facts', () => {
    const prismaticSpray = getSpells(7).find(spell => spell.id === 'prismatic-spray');
    const utilityEffect = prismaticSpray?.effects.find(effect => effect.type === 'UTILITY');

    // Prismatic Spray already has sibling rows for ray damage, indigo/violet
    // status tracks, petrification, and teleport movement. The utility row
    // should describe only the cone and per-target ray-selection wrapper.
    expect(utilityEffect?.description).toBe('Emit eight rays in a 60-foot Cone. Each creature in the cone makes a Dexterity save, then rolls 1d8 for its Prismatic Rays table color; a result of 8 strikes the target with two rays, rolling twice and rerolling any further 8s.');
  });

  it('keeps Dominate Monster utility description focused on command-control wrapper facts', () => {
    const dominateMonster = getSpells(8).find(spell => spell.id === 'dominate-monster');
    const utilityEffect = dominateMonster?.effects.find(effect => effect.type === 'UTILITY');

    // Dominate Monster already has a sibling Charmed row for the Wisdom save,
    // combat-advantage modifier, and on-damage repeat save. The utility row
    // should describe the command channel that remains after that payload.
    expect(utilityEffect?.description).toBe('While the Charmed target is on the same plane as you, you have a telepathic link and can issue no-action commands on your turn. The target obeys on its turn, acts self-protectively after completing orders, and you can spend your Reaction to command the target to take a Reaction.');
  });

  it('keeps Resurrection utility description focused on eligibility and restoration wrapper facts', () => {
    const resurrection = getSpells(7).find(spell => spell.id === 'resurrection');
    const utilityEffect = resurrection?.effects.find(effect => effect.type === 'UTILITY');

    // Resurrection already has sibling rows for full-Hit-Point return and the
    // revived creature's ordeal penalty. The utility row should describe the
    // revival eligibility and special restoration/caster-tax facts it owns.
    expect(utilityEffect?.description).toBe('Touch a creature dead no more than a century, that did not die of old age, and that was not Undead when it died. The spell neutralizes death-time poisons, closes mortal wounds, restores missing body parts, and taxes the caster until a Long Rest if the creature has been dead for 365 days or longer.');
  });

  it('keeps Demiplane utility description focused on door and room wrapper facts', () => {
    const demiplane = getSpells(8).find(spell => spell.id === 'demiplane');
    const utilityEffect = demiplane?.effects.find(effect => effect.type === 'UTILITY');

    // Demiplane already has a sibling Prone row for the optional shunt through
    // the vanishing door. The utility row should summarize the door, room, and
    // connection choices instead of copying the full spell-card prose.
    expect(utilityEffect?.description).toBe('Create an openable shadowy Medium door on a visible flat solid surface leading to a 30-foot wood-or-stone demiplane room. When the door vanishes, objects and creatures that do not opt into the shunt remain inside, and later castings can create a new demiplane or connect to a previous or known demiplane.');
  });

  it('keeps Power Word Stun utility description focused on threshold routing', () => {
    const powerWordStun = getSpells(8).find(spell => spell.id === 'power-word-stun');
    const utilityEffect = powerWordStun?.effects.find(effect => effect.type === 'UTILITY');

    // Power Word Stun already has sibling rows for the Stunned branch and the
    // over-threshold Speed-0 branch. The utility row should explain the 150-HP
    // routing rule instead of repeating those effect payloads.
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. If the target has 150 Hit Points or fewer, it has the Stunned condition and repeats Constitution saves at the end of each turn; if it has more than 150 Hit Points, its Speed becomes 0 until the start of your next turn.');
  });

  it('keeps Arcane Sword utility description focused on sword-control wrapper facts', () => {
    const arcaneSword = getSpells(7).find(spell => spell.id === 'arcane-sword');
    const utilityEffect = arcaneSword?.effects.find(effect => effect.type === 'UTILITY');

    // Arcane Sword already has sibling rows for initial/repeated Force damage
    // and bonus-action sword movement. The utility row should explain the
    // hovering force-sword control contract without duplicating those payloads.
    expect(utilityEffect?.description).toBe('Create a hovering sword-shaped plane of force within range for up to 1 minute with concentration. When it appears, the caster makes a melee spell attack against a target within 5 feet of the sword, and on later turns can use a Bonus Action to move the sword up to 20 feet and repeat the attack against the same or a different target.');
  });

  it('keeps Arcane Sword damage descriptions tied to initial and later sword attacks', () => {
    const arcaneSword = getSpells(7).find(spell => spell.id === 'arcane-sword');
    const damageDescriptions = arcaneSword?.effects
      .filter(effect => effect.type === 'DAMAGE')
      .map(effect => effect.description) ?? [];

    // Arcane Sword has one damage row for the attack made when the sword
    // appears and one damage row for later Bonus Action repeat attacks. Each
    // damage row should carry its own hit and 3d10 Force damage facts so the UI
    // does not depend on the wrapper row for damage context.
    expect(damageDescriptions).toEqual([
      'When the sword appears, the caster makes a melee spell attack against a target within 5 feet of the sword. On a hit, the target takes 3d10 Force damage.',
      'On later turns before the spell ends, the caster can use a Bonus Action to repeat the sword\'s melee spell attack against a target within 5 feet of it. On a hit, the target takes 3d10 Force damage.'
    ]);
  });

  it('keeps Divine Word utility description focused on table and planar routing facts', () => {
    const divineWord = getSpells(7).find(spell => spell.id === 'divine-word');
    const utilityEffect = divineWord?.effects.find(effect => effect.type === 'UTILITY');

    // Divine Word already has sibling rows for each HP-band condition and the
    // planar-return movement payload. The utility row should explain the
    // routing table and return block without copying those payloads.
    expect(utilityEffect?.description).toBe('Choose creatures within 30 feet to make a Charisma save. Failed targets with 50 Hit Points or fewer resolve the Divine Word HP table: death at 20 or fewer, Blinded/Deafened/Stunned at 21 to 30, 10-minute Deafened at 31 to 40, and 1-minute Deafened at 41 to 50; failed Celestial, Elemental, Fey, or Fiend targets also resolve planar return and the 24-hour Wish-only return block.');
  });

  it('keeps Incendiary Cloud utility description focused on cloud wrapper facts', () => {
    const incendiaryCloud = getSpells(8).find(spell => spell.id === 'incendiary-cloud');
    const utilityEffect = incendiaryCloud?.effects.find(effect => effect.type === 'UTILITY');

    // Incendiary Cloud already has sibling rows for each Fire damage timing and
    // cloud movement. The utility row should explain the cloud shell and
    // once-per-turn guard while still naming the scheduled cloud movement so
    // the wrapper row shows how the zone changes between damage triggers.
    expect(utilityEffect?.description).toBe('Create a 20-foot-radius Heavily Obscured sphere of ember-smoke within 150 feet for up to 1 minute with concentration. The cloud lasts until concentration ends or strong wind disperses it, a creature makes the spell damage save only once per turn, and at the start of each caster turn the cloud moves 10 feet away from the caster in a chosen direction.');
  });

  it('keeps Sleet Storm descriptions tied to cylinder and save consequences', () => {
    const sleetStorm = getSpells(3).find(spell => spell.id === 'sleet-storm');
    const effectDescriptions = sleetStorm?.effects.map(effect => effect.description) ?? [];

    // Sleet Storm splits its Prone save row from its terrain row. Both rows
    // should carry the cylinder geometry and the save consequences that matter
    // to tactical UI: falling Prone, losing Concentration, and Difficult Terrain.
    expect(effectDescriptions).toEqual([
      'A creature that enters or starts its turn in the 20-foot-radius, 40-foot-high Cylinder makes a Dexterity save; on a failed save, it falls Prone and loses Concentration.',
      'Ground in the 20-foot-radius, 40-foot-high Cylinder is Difficult Terrain for up to 1 minute with concentration.'
    ]);
  });

  it('keeps Power Word Pain utility description focused on threshold and spellcasting wrapper facts', () => {
    const powerWordPain = getSpells(7).find(spell => spell.id === 'power-word-pain');
    const utilityEffect = powerWordPain?.effects.find(effect => effect.type === 'UTILITY');

    // Power Word Pain already has sibling rows for crippling pain, speed cap,
    // and attack/check/save disadvantage. The utility row should explain the
    // threshold, immunity, spellcasting, and ending wrapper facts.
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. If the target has 100 Hit Points or fewer and is not immune to Charmed, it suffers crippling pain; while affected, spellcasting requires a Constitution save or wastes the spell, and end-turn Constitution saves can end the pain.');
  });

  it('keeps Reverse Gravity utility description focused on gravity-zone wrapper facts', () => {
    const reverseGravity = getSpells(7).find(spell => spell.id === 'reverse-gravity');
    const utilityEffect = reverseGravity?.effects.find(effect => effect.type === 'UTILITY');

    // Reverse Gravity already has sibling rows for upward forced movement,
    // upward collision falling damage, and the end-of-spell downward fall. The
    // utility row should explain the zone and hover shell without copying those
    // movement and damage payloads.
    expect(utilityEffect?.description).toBe('Reverse gravity in a 50-foot-radius, 100-foot-high Cylinder for up to 1 minute with concentration. Unanchored creatures and objects are pulled upward, reachable creatures can make a Dexterity save to grab a fixed object and avoid the upward fall, and affected targets that reach the Cylinder top without striking anything hover there until the spell ends.');
  });

  it('keeps Prismatic Wall descriptions focused on wall-shell, blinding, and layer facts', () => {
    const prismaticWall = getSpells(9).find(spell => spell.id === 'prismatic-wall');
    const effectDescriptions = prismaticWall?.effects.map(effect => effect.description) ?? [];

    // Prismatic Wall is split into a wall/globe wrapper, a near-wall Blinded
    // save, and a blocking terrain row. The terrain row should carry the
    // seven-layer AC and ordered-destruction state instead of being a generic
    // "opaque blocking wall" note.
    expect(effectDescriptions).toEqual([
      'Create either a 90-foot-long, 30-foot-high opaque wall or a 30-foot-diameter globe for 10 minutes, ending with no effect if placed in an occupied space. The multicolored wall sheds bright and dim light, lets the caster and designated creatures pass through and remain near it safely, and keeps seven colored layers with ordered destruction plus Antimagic Field immunity and violet-only Dispel Magic interaction.',
      'A creature other than the caster or designated safe creatures that can see the wall makes a Constitution save when it moves within 20 feet of the wall or starts its turn there; on a failed save, it is Blinded for 1 minute.',
      'The prismatic wall is an opaque blocking wall or globe with seven ordered colored layers, AC 10, layer-by-layer destruction from red to violet, Antimagic Field immunity, and violet-only Dispel Magic interaction.'
    ]);
  });

  it('keeps Imprisonment utility description focused on restraint-option wrapper facts', () => {
    const imprisonment = getSpells(9).find(spell => spell.id === 'imprisonment');
    const utilityEffect = imprisonment?.effects.find(effect => effect.type === 'UTILITY');

    // Imprisonment already has sibling rows for the Imprisoned, Restrained,
    // Unconscious, and teleport-block payloads. The utility row should explain
    // the save, immunity, upkeep, option menu, ending trigger, and dispel route
    // without duplicating those status and movement rows.
    expect(utilityEffect?.description).toBe('On a failed Wisdom save, the target is magically imprisoned until the spell ends; on a successful save, it is unaffected and immune to this spell for 24 hours. While imprisoned, the target does not breathe, eat, drink, or age, cannot be located or perceived by Divination, and cannot teleport. The caster chooses Burial, Chaining, Hedged Prison, Minimus Containment, or Slumber, sets an observable ending trigger, and ninth-level Dispel Magic can end the prison or its creation component.');
  });

  it('keeps Gate utility description focused on portal-routing wrapper facts', () => {
    const gate = getSpells(9).find(spell => spell.id === 'gate');
    const utilityEffect = gate?.effects.find(effect => effect.type === 'UTILITY');

    // Gate already has a sibling movement row for actual planar transport. The
    // utility row should explain the portal shell, opening rules, ruler block,
    // named-creature pull, and no-control boundary without copying transport
    // payload details already carried by that movement row.
    expect(utilityEffect?.description).toBe('Creates a visible 5-to-20-foot planar portal with chosen orientation, front/back travel rules, destination visibility, planar-ruler opening blocks, optional true-name creature pull, and no special control over pulled creatures.');
  });

  it('keeps Foresight utility description focused on future-sight wrapper facts', () => {
    const foresight = getSpells(9).find(spell => spell.id === 'foresight');
    const utilityEffect = foresight?.effects.find(effect => effect.type === 'UTILITY');

    // Foresight already has sibling rows for saving-throw advantage, outgoing
    // attack-roll advantage, and incoming attack-roll disadvantage. The utility
    // row should keep the future-sight and recast-ending shell visible while
    // leaving ability-check advantage in utility options until a richer
    // ability-check modifier row exists.
    expect(utilityEffect?.description).toBe('Touch a willing creature and give it limited future sight for 8 hours. The target gains broad D20-test advantage, attacks more accurately, is harder to hit, and the spell ends early if the caster casts it again.');
  });

  it('keeps True Resurrection utility description focused on resurrection wrapper facts', () => {
    const trueResurrection = getSpells(9).find(spell => spell.id === 'true-resurrection');
    const utilityEffect = trueResurrection?.effects.find(effect => effect.type === 'UTILITY');

    // True Resurrection already has sibling rows for all-Hit-Point revival and
    // the new-body placement movement. The utility row should explain
    // eligibility, restoration, old-age exclusion, Undead restoration, and
    // named-body creation without copying those healing and placement payloads.
    expect(utilityEffect?.description).toBe('Touch a creature dead no longer than 200 years and not from old age, restoring wounds, poison, magical contagions, curses, damaged or missing organs and limbs, and restoring an Undead creature to non-Undead form. If the original body no longer exists, the caster can speak the creature name to provide a new body.');
  });

  it('keeps Power Word Heal utility description focused on condition and reaction wrapper facts', () => {
    const powerWordHeal = getSpells(9).find(spell => spell.id === 'power-word-heal');
    const utilityEffect = powerWordHeal?.effects.find(effect => effect.type === 'UTILITY');

    // Power Word Heal already has sibling rows for full-Hit-Point healing and
    // ending the Prone movement state. The utility row should keep condition
    // removal and the reaction-to-stand permission visible without copying the
    // full healing and movement payloads.
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. The target regains all Hit Points, ends Charmed, Frightened, Paralyzed, Poisoned, and Stunned, and if Prone can use its Reaction to stand.');
  });

  it('keeps Mass Heal utility description focused on allocation and condition wrapper facts', () => {
    const massHeal = getSpells(9).find(spell => spell.id === 'mass-heal');
    const utilityEffect = massHeal?.effects.find(effect => effect.type === 'UTILITY');

    // Mass Heal already has a sibling healing row for the 700-Hit-Point pool.
    // The utility row should keep allocation and condition-removal facts
    // visible without copying the healing payload that belongs to that sibling
    // row.
    expect(utilityEffect?.description).toBe('Choose any number of visible creatures within 60 feet. The caster divides a pool of up to 700 Hit Points among them, and creatures healed this way also end Blinded, Deafened, and Poisoned.');
  });

  it('keeps Shapechange utility description focused on transformation wrapper facts', () => {
    const shapechange = getSpells(9).find(spell => spell.id === 'shapechange');
    const utilityEffect = shapechange?.effects.find(effect => effect.type === 'UTILITY');

    // Shapechange already has a sibling defensive row for first-form temporary
    // Hit Points. The utility row should summarize form eligibility, retained
    // identity/stat facts, repeat shape-shifting, and equipment handling without
    // copying that defensive payload.
    expect(utilityEffect?.description).toBe('Transform into a creature you have seen that is not a Construct or Undead and has an eligible Challenge Rating for up to 1 hour with concentration. Your game statistics become the chosen form except for retained identity, proficiencies, communication, and Spellcasting the form can support; while the spell lasts, you can use a Magic action to choose another eligible form, and you choose whether equipment falls, merges, or is worn by the new form.');
  });

  it('keeps Astral Projection utility description focused on astral-travel wrapper facts', () => {
    const astralProjection = getSpells(9).find(spell => spell.id === 'astral-projection');
    const utilityEffect = astralProjection?.effects.find(effect => effect.type === 'UTILITY');
    const statusEffect = astralProjection?.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // Astral Projection already has a sibling status row for the suspended
    // bodies becoming Unconscious. The utility row should summarize the
    // projection shell, silver cord, damage separation, planar re-entry, and
    // dismissal routing without copying that status payload.
    expect(utilityEffect?.description).toBe('Project the caster and up to eight willing creatures into the Astral Plane unless the caster is already there. Each astral form travels by silver cord, cord-cutting kills both forms, body and astral-form damage stay separate, leaving the Astral Plane pulls the body and possessions to the new plane, either form dropping to 0 Hit Points ends the spell for that target, and the caster can dismiss the spell for all targets with a Magic action.');
    expect(statusEffect?.description).toBe('Each target body left behind by Astral Projection is suspended with the Unconscious condition, needs no food or air, does not age, and exits suspended animation when the spell ends for that target while it is not dead.');
  });

  it('keeps Invulnerability utility description focused on self-only defensive wrapper facts', () => {
    const invulnerability = getSpells(9).find(spell => spell.id === 'invulnerability');
    const utilityEffect = invulnerability?.effects.find(effect => effect.type === 'UTILITY');

    // Invulnerability already has a sibling defensive row for immunity to all
    // damage. The utility row should explain the self-only concentration shell
    // and consumed adamantine component without duplicating that defensive
    // payload.
    expect(utilityEffect?.description).toBe('The caster targets only themself, concentrates for up to 10 minutes, and consumes the 500 GP adamantine component while the defensive effect grants immunity to all damage until the spell ends.');
  });

  it('keeps Mass Polymorph utility description focused on transformation wrapper facts', () => {
    const massPolymorph = getSpells(9).find(spell => spell.id === 'mass-polymorph');
    const utilityEffect = massPolymorph?.effects.find(effect => effect.type === 'UTILITY');

    // Mass Polymorph has a sibling defensive row for beast-form temporary hit
    // points. The utility description should preserve the transformation
    // wrapper, save, reversion, action, and gear facts without repeating the
    // entire top-level spell text.
    expect(utilityEffect?.description).toBe('Transform up to ten visible creatures within 120 feet into Beast forms you choose for up to 1 hour with concentration. Unwilling targets make Wisdom saves, unwilling shapechangers automatically succeed, eligible forms must be Beasts you have seen within the spell CR or half-level limits, and targets keep Hit Points, alignment, and personality while the chosen form supplies statistics, action limits, speech, spellcasting, hands use, gear access, and reversion timing.');
  });

  it('keeps True Polymorph utility description focused on mode-selection wrapper facts', () => {
    const truePolymorph = getSpells(9).find(spell => spell.id === 'true-polymorph');
    const utilityEffect = truePolymorph?.effects.find(effect => effect.type === 'UTILITY');

    // True Polymorph has a sibling defensive row for creature-to-creature
    // temporary hit points. The utility row should keep the three transformation
    // modes, save, permanence, control, object, and memory facts visible without
    // copying the whole spell card.
    expect(utilityEffect?.description).toBe('Transform one visible creature or nonmagical unattended object within 30 feet using creature-to-creature, creature-to-object, or object-to-creature mode. Unwilling creatures can negate the spell with a Wisdom save, and maintaining concentration for the full hour makes the transformation last until dispelled. The modes keep their CR or level limits, object-size and worn-or-carried eligibility, friendly object-creature control while the spell is controlled, loss of caster control after one hour, retained Hit Points, Hit Point Dice, alignment, and personality for creature forms, action, speech, spellcasting, gear limits, and no memory of time spent as an object.');
  });

  it('keeps Wish utility description focused on mode and stress routing facts', () => {
    const wish = getSpells(9).find(spell => spell.id === 'wish');
    const utilityEffect = wish?.effects.find(effect => effect.type === 'UTILITY');
    const healingEffect = wish?.effects.find(effect => effect.type === 'HEALING');
    const defensiveEffects = wish?.effects.filter(effect => effect.type === 'DEFENSIVE') ?? [];
    const stressDamage = wish?.effects.find(effect => effect.type === 'DAMAGE');

    // Wish has sibling rows for Instant Health, Resistance, Spell Immunity, and
    // post-stress Necrotic damage. The utility row should summarize the choice
    // menu and stress wrapper without copying every payload already owned by
    // those structured rows.
    expect(utilityEffect?.description).toBe('Choose either level-8-or-lower spell duplication without normal casting requirements or one non-duplication Wish mode: Object Creation, Instant Health, Resistance, Spell Immunity, Sudden Learning, Roll Redo, or Reshape Reality. Any non-duplication mode triggers Wish stress: Strength becomes 3 for 2d4 days with rest-based recovery reduction, each spell cast before a Long Rest deals irreducible Necrotic damage per spell level, and there is a 33 percent chance the caster can never cast Wish again.');
    expect(healingEffect?.description).toBe('Instant Health mode restores all Hit Points to the caster and up to twenty visible creatures and ends every effect on those targets that Greater Restoration can end.');
    expect(defensiveEffects.map(effect => effect.description)).toEqual([
      'Resistance mode grants up to ten visible creatures permanent Resistance to one chosen damage type.',
      'Spell Immunity mode grants up to ten visible creatures immunity to one chosen spell or magical effect for 8 hours.'
    ]);
    expect(stressDamage?.description).toBe('After non-duplication Wish stress, each spell the caster casts before finishing a Long Rest deals irreducible Necrotic damage to the caster equal to 1d10 per spell level.');
  });

  it('keeps Symbol utility description focused on glyph trigger wrapper facts', () => {
    const symbol = getSpells(7).find(spell => spell.id === 'symbol');
    const utilityEffect = symbol?.effects.find(effect => effect.type === 'UTILITY');

    // Symbol already has sibling rows for Death damage, Fear/Pain/Sleep/Stunning
    // statuses, and Discord disadvantage. The utility row should explain glyph
    // placement, trigger, light, and once-per-turn routing without copying every
    // payload row back into one monolithic description.
    expect(utilityEffect?.description).toBe('Inscribe a nearly imperceptible harmful glyph on a surface or closable object up to 10 feet across. The caster defines the trigger, creature-type exclusions, and password exclusions, and moving an inscribed object more than 10 feet breaks the glyph before it triggers. Once triggered, the glyph creates a 60-foot-radius Dim Light sphere for 10 minutes, affecting a creature on activation, first entry each turn, or turn end, no more than once per turn.');
  });

  it('keeps Earthquake utility description focused on tremor-zone wrapper facts', () => {
    const earthquake = getSpells(8).find(spell => spell.id === 'earthquake');
    const utilityEffect = earthquake?.effects.find(effect => effect.type === 'UTILITY');

    // Earthquake has sibling status and damage rows for Prone, Buried,
    // structure damage, and collapse damage. The utility row should keep the
    // tremor zone, terrain, save timing, concentration break, fissure, and
    // structure-collapse routing visible without duplicating those payloads.
    expect(utilityEffect?.description).toBe('Choose a visible ground point within 500 feet to create a 100-foot-radius tremor zone of Difficult Terrain for up to 1 minute with concentration. Grounded creatures make Dexterity saves when the spell is cast and at the end of each caster turn, with failed saves breaking Concentration; at the end of the casting turn, 1d6 caster-placed fissures open across the area with depth and width limits, and grounded structures repeat damage and collapse checks for nearby creatures.');
  });

  it('keeps Illusory Dragon utility description focused on illusion-control wrapper facts', () => {
    const illusoryDragon = getSpells(8).find(spell => spell.id === 'illusory-dragon');
    const utilityEffect = illusoryDragon?.effects.find(effect => effect.type === 'UTILITY');

    // Illusory Dragon has sibling rows for Frightened, breath damage, and
    // bonus-action movement. The utility row should describe the Huge illusion,
    // tangible defenses, damage-type choice, discernment, and control wrapper
    // without copying those payload rows back into one card-length paragraph.
    expect(utilityEffect?.description).toBe('Create a Huge tangible shadow-dragon illusion in an unoccupied visible space within 120 feet for up to 1 minute with concentration, choosing acid, cold, fire, lightning, necrotic, or poison for its breath. The caster controls its bonus-action move-and-breath sequence, attacks miss it, it succeeds on saves, it is immune to damage and conditions, and creatures can use an Intelligence (Investigation) action to discern the illusion.');
  });

  it('keeps Antipathy/Sympathy utility description focused on mode and trigger wrapper facts', () => {
    const antipathySympathy = getSpells(8).find(spell => spell.id === 'antipathy-sympathy');
    const utilityEffect = antipathySympathy?.effects.find(effect => effect.type === 'UTILITY');

    // Antipathy/Sympathy has sibling rows for Frightened, Charmed, and forced
    // movement. The utility row should preserve the mode choice, affected
    // creature kind, save trigger, ending save, and temporary immunity wrapper
    // without copying those status and movement payloads.
    expect(utilityEffect?.description).toBe('Choose Antipathy or Sympathy for one Huge-or-smaller creature or object within 60 feet, then name the affected creature kind. Creatures of that kind make Wisdom saves when they come within 120 feet, repeat the save after ending a turn more than 120 feet away, gain 1 minute of immunity after a successful save, and Sympathy also prevents willing movement away within 5 feet unless target damage allows an ending save.');
  });

  it('keeps Tsunami utility description focused on water-wall wrapper facts', () => {
    const tsunami = getSpells(8).find(spell => spell.id === 'tsunami');
    const utilityEffect = tsunami?.effects.find(effect => effect.type === 'UTILITY');

    // Tsunami has sibling rows for initial damage, ongoing size-filtered damage,
    // and forced wall movement. The utility row should summarize wall size,
    // duration, decay, swimming restriction, fall-out, and end-condition facts
    // without copying the damage and movement payloads.
    expect(utilityEffect?.description).toBe('Create a concentration water wall at a point within 1 mile for up to 6 rounds. The wall can be up to 300 feet long, 300 feet high, and 50 feet thick; at each later caster-turn start it moves 50 feet away with caught creatures, then each turn end lowers the wall by 50 feet and reduces later damage by 1d10. The spell ends when the wall reaches 0-foot height, caught creatures need a Strength (Athletics) check against the spell save DC to swim at all, and creatures leaving the wall fall to the ground.');
  });

  it('keeps Holy Aura utility description focused on aura-selection wrapper facts', () => {
    const holyAura = getSpells(8).find(spell => spell.id === 'holy-aura');
    const utilityEffect = holyAura?.effects.find(effect => effect.type === 'UTILITY');

    // Holy Aura has sibling rows for saving throw advantage, incoming attack
    // disadvantage, and Fiend/Undead Blinded retaliation. The utility row should
    // identify the self-centered aura, chosen-creature membership, and trigger
    // routing without copying those payload rows.
    expect(utilityEffect?.description).toBe('For up to 1 minute with concentration, the caster emits a 30-foot Emanation and chooses which creatures in it are protected. Chosen creatures gain holy protection, and Fiends or Undead that hit them with melee attacks risk a Constitution save retaliation.');
  });

  it('keeps Maddening Darkness utility description focused on darkness-zone wrapper facts', () => {
    const maddeningDarkness = getSpells(8).find(spell => spell.id === 'maddening-darkness');
    const utilityEffect = maddeningDarkness?.effects.find(effect => effect.type === 'UTILITY');

    // Maddening Darkness has a sibling damage row for start-turn Wisdom saves
    // and 8d8 Psychic damage. The utility row should describe the persistent
    // magical darkness, light suppression, darkvision block, and audible madness
    // without copying the damage payload.
    expect(utilityEffect?.description).toBe('Magical darkness spreads from a visible point within 150 feet to fill a 60-foot-radius sphere for up to 10 minutes with concentration. The darkness spreads around corners, blocks darkvision, prevents nonmagical light and spell light of 8th level or lower from illuminating the area, and carries shrieks, gibbering, and mad laughter.');
  });

  it('keeps Animal Shapes utility description focused on transformation wrapper facts', () => {
    const animalShapes = getSpells(8).find(spell => spell.id === 'animal-shapes');
    const utilityEffect = animalShapes?.effects.find(effect => effect.type === 'UTILITY');

    // Animal Shapes has a sibling healing row for the first Beast form's
    // Temporary Hit Points. The utility row should summarize target eligibility,
    // form limits, repeated Magic-action transformation, retained identity facts,
    // action limits, equipment merging, and bonus-action ending without copying
    // the temporary hit point payload.
    expect(utilityEffect?.description).toBe('Choose any number of willing visible creatures within 30 feet for up to 24 hours and shape-shift each into a caster-chosen Large-or-smaller Beast form of Challenge Rating 4 or lower, with different forms allowed per target and later Magic-action re-transforms. Targets use Beast statistics but retain creature type, Hit Points, Hit Point Dice, alignment, communication, and Intelligence, Wisdom, and Charisma scores; cannot cast spells; are limited by Beast anatomy; have equipment merged and unusable; and can end their own transformation with a Bonus Action.');
  });

  it('keeps Mind Blank utility description focused on mental-shield wrapper facts', () => {
    const mindBlank = getSpells(8).find(spell => spell.id === 'mind-blank');
    const utilityEffect = mindBlank?.effects.find(effect => effect.type === 'UTILITY');

    // Mind Blank has a sibling defensive row for Psychic and Charmed immunity.
    // The utility row should focus on the broader information-gathering,
    // detection, observation, and mind-control shields without duplicating that
    // immunity payload.
    expect(utilityEffect?.description).toBe('Touch one willing creature to shield it for 24 hours from emotion and alignment sensing, thought reading, magical location detection, information gathering, remote observation, and mind control, including effects from Wish.');
  });

  it('keeps Forcecage utility description focused on containment wrapper facts', () => {
    const forcecage = getSpells(7).find(spell => spell.id === 'forcecage');
    const utilityEffect = forcecage?.effects.find(effect => effect.type === 'UTILITY');

    // Forcecage has a sibling movement row for pushing partially contained or
    // too-large creatures out of the prison. The utility row should preserve
    // the cage/box choice, escape, Ethereal, and Dispel Magic rules without
    // copying that movement payload back into the containment summary.
    expect(utilityEffect?.description).toBe('Creates an invisible, immobile magical-force prison as either a 20-foot barred cage or a 10-foot solid box; creatures completely inside are trapped, creatures only partly inside or too large to fit are pushed completely outside, nonmagical exit is blocked, teleportation or interplanar escape requires a Charisma save, Ethereal travel is blocked, and Dispel Magic cannot end it.');
  });

  // -------------------------------------------------------------------------
  // Unit tests: Effect Target Filter Completeness rule
  // -------------------------------------------------------------------------
  // These tests keep direct-target spell restrictions visible at the validator
  // layer, not only in the all-spell corpus test. If a spell says "only
  // Humanoids" at target selection time, a direct effect that acts on that same
  // target should carry the same filter or be explicitly classified elsewhere.
  describe('Rule: Effect Target Filter Completeness', () => {

    it('fails if a direct restricted effect omits the spell-level creature filter', () => {
      const badSpell = {
        id: 'direct-restricted-effect-filter-gap',
        duration: { concentration: false },
        tags: [],
        school: 'Enchantment',
        targeting: {
          type: 'single',
          filter: {
            creatureTypes: ['Humanoid']
          }
        },
        effects: [
          {
            type: 'UTILITY',
            description: 'Directly charms the selected Humanoid target.',
            condition: {
              type: 'save',
              targetFilter: {
                creatureTypes: []
              }
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Target Filter Gap: effect 0 does not repeat spell-level creatureTypes restriction');
    });

    it('exposes the classified residual restricted-filter mismatches as validator-owned data', () => {
      // The production validator owns this list because spell JSON validation
      // and the corpus regression must agree about which remaining mismatches
      // are semantic exceptions rather than direct data omissions.
      expect(SpellIntegrityValidator.getClassifiedRestrictedFilterMismatchKeys()).toContain('plant-growth:0:creatureTypes');
    });

    it('exposes reasons for classified residual restricted-filter mismatches', () => {
      // Future validation, audit, and UI/debug surfaces need to explain why a
      // residual mismatch is classified. A bare allowlist key is not enough for
      // a human reviewer to know whether the row is plant/object targeting,
      // chosen-kind aura behavior, repair targeting, or form-choice eligibility.
      const shapechangeDetail = SpellIntegrityValidator
        .getClassifiedRestrictedFilterMismatchDetails()
        .find(detail => detail.key === 'shapechange:0:excludeCreatureTypes');

      expect(shapechangeDetail).toMatchObject({
        key: 'shapechange:0:excludeCreatureTypes',
        category: 'form-choice eligibility'
      });
      expect(shapechangeDetail?.reason).toContain('chosen form');
    });

    it('treats Huge-or-smaller size text as equivalent to concrete creature sizes', () => {
      const sizeEquivalentSpell = {
        id: 'huge-or-smaller-size-equivalence',
        duration: { concentration: false },
        tags: [],
        school: 'Conjuration',
        targeting: {
          type: 'area',
          filter: {
            sizes: ['Huge or smaller for ongoing movement damage']
          }
        },
        effects: [
          {
            type: 'DAMAGE',
            description: 'Ongoing wave damage affects Huge or smaller creatures.',
            condition: {
              type: 'save',
              targetFilter: {
                sizes: ['Huge', 'Large', 'Medium', 'Small', 'Tiny']
              }
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(sizeEquivalentSpell);
      expect(errors).not.toContain('Effect Target Filter Gap: effect 0 does not repeat spell-level sizes restriction');
    });
  });

  // -------------------------------------------------------------------------
  // Regression test: all Level 2 spells (hard failure gate)
  // -------------------------------------------------------------------------
  // This test loads every Level 2 spell from disk and validates them all.
  // Concentration and Enchantment targeting are treated as hard failures here
  // because those issues were fully remediated — any new file that reintroduces
  // them should immediately fail CI.
  //
  // Monolithic Effect warnings are NOT hard-gated here; they appear in the
  // Systematic test below.
  describe('Level 2 Regression Test', () => {
    const spells = getSpells(2);

    it('all Level 2 spells pass integrity checks', () => {
      const failures: string[] = [];

      // Run every Level 2 spell through the validator and collect all failures.
      spells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));
        if (errors.length > 0) {
          failures.push(`${spell.name}: ${errors.join(', ')}`);
        }
      });

      // Print the full failure list to the console for visibility even when
      // only certain categories are being hard-asserted below.
      if (failures.length > 0) {
        console.warn(`Integrity Failures Found (${failures.length}):\n${failures.join('\n')}`);
      }

      // HARD GATE: No Concentration mismatches allowed. This was fully remediated.
      const criticalFailures = failures.filter(f => f.includes('Concentration Mismatch'));
      expect(criticalFailures).toHaveLength(0);

      // HARD GATE: No Enchantment targeting gaps allowed. This was fully remediated.
      const enchantmentFailures = failures.filter(f => f.includes('Enchantment Gap'));
      expect(enchantmentFailures).toHaveLength(0);

      // HARD GATE: No blank or generic effect descriptions allowed. G8/G9 were
      // fully remediated, and future opaque descriptions should fail locally.
      const descriptionFailures = failures.filter(f => f.includes('Effect Description'));
      expect(descriptionFailures).toHaveLength(0);
    });

    it('keeps Hold Person Humanoid restriction on the effect-level Paralyzed payload', () => {
      const holdPerson = spells.find(spell => spell.id === 'hold-person');
      const paralyzedEffect = holdPerson?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION'
        && effect.statusCondition?.name === 'Paralyzed'
      );

      // The top-level target picker already says Hold Person can only choose a
      // Humanoid. The effect row must repeat that creature gate so future
      // multi-target, delayed, or retargeted execution paths do not apply the
      // Paralyzed condition to a non-Humanoid after initial selection.
      expect(paralyzedEffect?.condition.targetFilter?.creatureTypes).toContain('Humanoid');
    });
  });

  // -------------------------------------------------------------------------
  // Systematic all-spell scan: Monolithic Effect tracking
  // -------------------------------------------------------------------------
  // This test scans every spell across all 10 levels (0-9) to generate the
  // working hit list of monolithic spell effects. G5 cleared the current hit
  // list, so this is now a hard regression gate: future one-effect copy-paste
  // blobs should fail locally instead of re-entering the corpus silently.
  describe('Systematic All-Spell Validation', () => {

    // Load every spell across all levels into one flat array.
    const allSpells: Spell[] = [];
    for (let level = 0; level <= 9; level++) {
      allSpells.push(...getSpells(level));
    }

    it('keeps restricted status-condition creature filters on effect payloads', () => {
      const animalFriendship = allSpells.find(spell => spell.id === 'animal-friendship');
      const animalFriendshipCharmed = animalFriendship?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION'
        && effect.statusCondition?.name === 'Charmed'
      );

      const fastFriends = allSpells.find(spell => spell.id === 'fast-friends');
      const fastFriendsCharmed = fastFriends?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION'
        && effect.statusCondition?.name === 'Charmed'
      );

      // These spell-level target pickers already restrict the legal target by
      // creature family. The status-condition effect must repeat that same gate
      // so delayed, repeated, or retargeted execution paths cannot apply the
      // condition after the original target selection context is gone.
      expect(animalFriendshipCharmed?.condition.targetFilter?.creatureTypes).toContain('Beast');
      expect(fastFriendsCharmed?.condition.targetFilter?.creatureTypes).toContain('Humanoid');
    });

    it('keeps direct restricted utility creature filters on effect payloads', () => {
      const getEffectFilter = (spellId: string, effectIndex: number) => {
        const spell = allSpells.find(candidate => candidate.id === spellId);
        return spell?.effects[effectIndex]?.condition.targetFilter;
      };

      // These utility rows still act on the originally restricted creature. The
      // effect-level filters repeat that restriction so later command creation,
      // delayed execution, or audit tooling can understand the legal target even
      // without re-reading the top-level spell target picker.
      expect(getEffectFilter('charm-person', 1)?.creatureTypes).toContain('Humanoid');
      expect(getEffectFilter('animal-messenger', 0)?.creatureTypes).toContain('Beast');
      expect(getEffectFilter('animal-messenger', 0)?.sizes).toContain('Tiny');
      expect(getEffectFilter('beast-sense', 0)?.creatureTypes).toContain('Beast');
      expect(getEffectFilter('calm-emotions', 1)?.creatureTypes).toContain('Humanoid');
      expect(getEffectFilter('crown-of-madness', 0)?.creatureTypes).toContain('Humanoid');
      expect(getEffectFilter('dominate-person', 0)?.creatureTypes).toContain('Humanoid');
      expect(getEffectFilter('planar-binding', 0)?.creatureTypes).toEqual(
        expect.arrayContaining(['Celestial', 'Elemental', 'Fey', 'Fiend'])
      );
    });

    it('keeps Simulacrum creation filters on original-creature effect payloads', () => {
      const simulacrum = allSpells.find(spell => spell.id === 'simulacrum');
      const summoningFilter = simulacrum?.effects[0]?.condition.targetFilter;
      const creationDetailFilter = simulacrum?.effects[2]?.condition.targetFilter;

      // Simulacrum chooses one Beast or Humanoid as the original creature. The
      // creation effects need that same gate, but the repair effect is not
      // asserted here because it later acts on the created simulacrum instead of
      // the original creature.
      expect(summoningFilter?.creatureTypes).toEqual(expect.arrayContaining(['Beast', 'Humanoid']));
      expect(creationDetailFilter?.creatureTypes).toEqual(expect.arrayContaining(['Beast', 'Humanoid']));
    });

    it('hard-fails unclassified restricted-filter mismatches', () => {
      const restrictedFilterMismatchKeys: string[] = [];
      const restrictedFilterKeys = ['creatureTypes', 'excludeCreatureTypes', 'sizes', 'alignments'] as const;
      const classifiedRestrictedFilterMismatches = new Set(
        SpellIntegrityValidator.getClassifiedRestrictedFilterMismatchKeys()
      );

      const normalizeFilterValues = (value: unknown, key?: typeof restrictedFilterKeys[number]): string[] => {
        if (!Array.isArray(value)) {
          return [];
        }

        const expandedValues = value.flatMap(item => {
          if (
            key === 'sizes'
            && typeof item === 'string'
            && item.toLowerCase().startsWith('huge or smaller')
          ) {
            return ['Huge', 'Large', 'Medium', 'Small', 'Tiny'];
          }

          return item;
        });

        return expandedValues.filter(item => item !== 'not_applicable').map(String).sort();
      };

      const sameFilterValues = (left: unknown, right: unknown, key?: typeof restrictedFilterKeys[number]): boolean => {
        const normalizedLeft = normalizeFilterValues(left, key);
        const normalizedRight = normalizeFilterValues(right, key);

        return normalizedLeft.length === normalizedRight.length
          && normalizedLeft.every((value, index) => value === normalizedRight[index]);
      };

      allSpells.forEach(spell => {
        const spellFilter = spell.targeting.filter;
        const restrictedKeys = restrictedFilterKeys.filter(key =>
          normalizeFilterValues(spellFilter?.[key], key).length > 0
        );

        if (restrictedKeys.length === 0) {
          return;
        }

        spell.effects.forEach((effect, index) => {
          const effectFilter = effect.condition?.targetFilter;

          if (!effectFilter) {
            return;
          }

          restrictedKeys.forEach(key => {
            if (!sameFilterValues(spellFilter?.[key], effectFilter[key], key)) {
              restrictedFilterMismatchKeys.push(`${spell.id}:${index}:${key}`);
            }
          });
        });
      });

      const unclassifiedMismatches = restrictedFilterMismatchKeys.filter(key =>
        !classifiedRestrictedFilterMismatches.has(key)
      );
      const staleClassifications = SpellIntegrityValidator.getClassifiedRestrictedFilterMismatchKeys().filter(key =>
        !restrictedFilterMismatchKeys.includes(key)
      );

      // Direct-target restricted effects should either repeat the relevant
      // creature/size/alignment gate on their effect payload or be explicitly
      // classified as a semantic exception. This keeps future copy-paste target
      // filter omissions visible without pretending that plant/object, aura,
      // ongoing-area, repair-target, and form-choice rows all have the same
      // effect-target semantics.
      expect(unclassifiedMismatches).toHaveLength(0);

      // If a future data/modeling pass resolves one of the semantic exceptions,
      // this makes the old allowlist entry fail so the classification list does
      // not become permanent invisible debt.
      expect(staleClassifications).toHaveLength(0);
    });

    it('keeps Simulacrum utility description focused on copy-lifecycle wrapper facts', () => {
      const simulacrum = getSpells(7).find(spell => spell.id === 'simulacrum');
      const utilityEffect = simulacrum?.effects.find(effect => effect.type === 'UTILITY');

      // Simulacrum has sibling rows for creating the Construct copy and for
      // repairing damaged simulacrum Hit Points. The utility row should keep
      // casting setup, copy limits, lifecycle, and recast-destruction facts
      // without copying the summoning or repair payloads back into one row.
      expect(utilityEffect?.description).toBe('After a 12-hour casting that consumes 1,500+ GP powdered ruby, touch one Beast or Humanoid that stayed within 10 feet for the full casting and a same-size pile of ice or snow to create a friendly commanded simulacrum. The simulacrum acts on the caster turn, cannot cast Simulacrum, cannot gain levels, cannot take Short or Long Rests, reverts to snow and melts at 0 Hit Points, and any existing simulacrum made by this spell is instantly destroyed if the caster casts it again.');
    });

    it('keeps Sequester utility description focused on hidden-suspension wrapper facts', () => {
      const sequester = getSpells(7).find(spell => spell.id === 'sequester');
      const utilityEffect = sequester?.effects.find(effect => effect.type === 'UTILITY');

      // Sequester has sibling status rows for Invisible and creature
      // Unconscious suspended animation. The utility row should keep the
      // divination shield, no-aging/no-needs, end-condition, damage-ending, and
      // consumed-component facts without copying those status rows back in.
      expect(utilityEffect?.description).toBe('Touch one object or willing creature and consume 5,000+ GP gem dust to sequester the target until dispelled. The target cannot be targeted by Divination spells, detected by magic, or viewed remotely with magic; a creature target does not age or need food, water, or air; the caster can set an early end condition that occurs or is visible within 1 mile; and any target damage also ends the spell.');
    });

    it('keeps Regenerate utility description focused on body-part regrowth wrapper facts', () => {
      const regenerate = getSpells(7).find(spell => spell.id === 'regenerate');
      const utilityEffect = regenerate?.effects.find(effect => effect.type === 'UTILITY');

      // Regenerate has sibling healing rows for the immediate 4d8 + 15 heal
      // and the start-turn 1 Hit Point recovery. The utility row should keep
      // the non-healing body restoration rule without copying the healing rows
      // back into another summary.
      expect(utilityEffect?.description).toBe('Touch one creature for a 1-hour prayer-wheel transmutation. Severed body parts regrow after 2 minutes while the target also receives the spell healing and start-turn recovery effects.');
    });

    it('keeps Project Image utility description focused on illusion-projection wrapper facts', () => {
      const projectImage = getSpells(7).find(spell => spell.id === 'project-image');
      const utilityEffect = projectImage?.effects.find(effect => effect.type === 'UTILITY');

      // Project Image has a sibling movement row for Magic-action image
      // movement. The utility row should keep the remote placement, sensing,
      // intangibility, damage ending, and discernment rules without copying the
      // movement row or full spell card back into one summary.
      expect(utilityEffect?.description).toBe('Create a 1-day concentration illusory copy of the caster at a previously seen location within 500 miles, regardless of intervening obstacles, using the 5+ GP self-statuette component. The image looks and sounds like the caster but is intangible, disappears and ends the spell if damaged, lets the caster see and hear as if in its space, mimics caster mannerisms, and can be exposed by physical interaction or a Study action Intelligence (Investigation) check; discerning creatures see through it and hear its noise as hollow.');
    });

    it('keeps Plane Shift utility description focused on planar-destination wrapper facts', () => {
      const planeShift = getSpells(7).find(spell => spell.id === 'plane-shift');
      const utilityEffect = planeShift?.effects.find(effect => effect.type === 'UTILITY');

      // Plane Shift has a sibling movement row for the actual cross-planar
      // transport. The utility row should keep the attuned rod, linked-circle,
      // general-destination, known-circle, and spillover facts without copying
      // the same transport summary into both rows.
      expect(utilityEffect?.description).toBe('Use a 250+ GP forked metal rod attuned to a plane of existence while the caster and up to eight willing creatures link hands in a circle. The destination can be a general place on another plane with near-arrival determined by the DM, or a known sigil sequence for a teleportation circle on another plane; if that circle is too small, transported creatures spill into the closest unoccupied spaces.');
    });

    it('keeps Mordenkainen\'s Magnificent Mansion utility description focused on extradimensional dwelling wrapper facts', () => {
      const mansion = getSpells(7).find(spell => spell.id === 'mordenkainens-magnificent-mansion');
      const utilityEffect = mansion?.effects.find(effect => effect.type === 'UTILITY');

      // Magnificent Mansion has sibling rows for end-of-spell expulsion and the
      // 100 near-transparent servants. The utility row should keep the door,
      // access, dwelling, food, and object-export rules without copying those
      // sibling mechanical rows back into one monolithic summary.
      expect(utilityEffect?.description).toBe("Create a 5-foot-wide, 10-foot-tall shimmering door within 300 feet for 24 hours leading to a clean, fresh, warm extradimensional dwelling of up to 50 contiguous 10-foot Cubes; only the caster and designated creatures can enter while the door is open, the caster can open or close it without an action within 30 feet, a closed door is imperceptible, furnishings and decor are chosen by the caster, food serves a nine-course banquet for up to 100 people, and spell-created objects dissipate if removed.");
    });

    it('keeps Mighty Fortress utility description focused on fortress wrapper facts', () => {
      const mightyFortress = getSpells(8).find(spell => spell.id === 'mighty-fortress');
      const utilityEffect = mightyFortress?.effects.find(effect => effect.type === 'UTILITY');

      // Mighty Fortress has a sibling summoning row for the one hundred
      // invisible servants. The utility row should keep the fortress footprint,
      // layout, durability, food/object, teardown, and permanence rules without
      // copying the servant payload or the full spell card back into one row.
      expect(utilityEffect?.description).toBe('Consume a 500 GP diamond to create a visible 120-foot-square stone fortress within 1 mile on structure-free ground, harmlessly lifting creatures as it rises. The fortress includes four turrets, connecting stone walls, up to four outer stone doors, a three-floor keep with caster-chosen rooms, furnishings, decoration, and daily food for up to 100 people; created objects crumble if removed, stone sections have AC 15, 30 Hit Points per inch, and Poison and Psychic immunity, damaged sections can collapse at 0 Hit Points, the fortress crumbles safely after 7 days or recasting elsewhere, and recasting on the same spot every 7 days for a year makes it permanent.');
    });

    it('keeps Magic Jar utility description focused on soul-container wrapper facts', () => {
      const magicJar = getSpells(6).find(spell => spell.id === 'magic-jar');
      const utilityEffect = magicJar?.effects.find(effect => effect.type === 'UTILITY');

      // Magic Jar has sibling rows for the trapped soul's Incapacitated state
      // and the caster-container movement/reaction lock. The utility row still
      // needs to preserve possession routing and death-return rules, but it
      // should do that as a focused wrapper summary rather than copied prose.
      expect(utilityEffect?.description).toBe('The caster soul enters the 500+ GP container while the caster body becomes catatonic, perceives from the container, and can project up to 100 feet to return to the living body or attempt to possess a visible Humanoid not warded by Protection from Evil and Good or Magic Circle. Possession uses a Charisma save, failed saves move the caster soul into the host, successful saves block repeat attempts for 24 hours, the possessed host uses host Hit Points, Hit Point Dice, Strength, Dexterity, Constitution, Speed, and senses while the caster keeps other statistics, a Magic action can return to a nearby container, host death can force the caster back by Charisma save, container destruction or spell ending returns souls to living bodies within 100 feet or kills stranded souls, and spell end destroys the container.');
    });

    it('keeps Temple of the Gods utility description focused on sanctuary wrapper facts', () => {
      const temple = getSpells(7).find(spell => spell.id === 'temple-of-the-gods');
      const utilityEffect = temple?.effects.find(effect => effect.type === 'UTILITY');

      // Temple of the Gods has sibling rows for opposed-creature entry blocking,
      // opposed-creature d4 penalties, and spell-healing bonuses. The utility
      // row should preserve the created sanctuary shell and special protection
      // rules without repeating those sibling mechanical payloads.
      expect(utilityEffect?.description).toBe('After a 1-hour casting, create a dedicated temple on visible ground within 120 feet that fits in an unoccupied 120-foot cube. The caster chooses its appearance, floor, walls, roof, one controllable door, optional windows, idol or altar, bright or dim illumination, incense, and mild temperature. Its opaque magical-force exterior blocks Ethereal travel and physical passage, blocks Divination sensors and targeting inside, ignores Dispel Magic and Antimagic Field, can be destroyed by Disintegrate, and becomes permanent after year-long daily same-spot casting.');
    });

    it('keeps Teleport utility description focused on outcome-table wrapper facts', () => {
      const teleport = getSpells(7).find(spell => spell.id === 'teleport');
      const utilityEffect = teleport?.effects.find(effect => effect.type === 'UTILITY');

      // Teleport has sibling rows for the actual same-plane movement and Mishap
      // Force damage. The utility row should preserve target eligibility and
      // outcome-table routing without copying the full spell card back over
      // those mechanical rows.
      expect(utilityEffect?.description).toBe('Choose either the caster plus up to eight willing visible creatures within 10 feet or one visible Large-or-smaller object that is not held or carried by an unwilling creature, then choose a known destination on the same plane. Destination familiarity drives the d100 outcome table: Permanent Circle and Linked Object arrive on target, while Very Familiar, Seen Casually, Viewed Once or Described, and False Destination rows can produce Mishap, Similar Area, Off Target, or On Target results.');
    });

    it('keeps Whirlwind utility description focused on vortex wrapper facts', () => {
      const whirlwind = getSpells(7).find(spell => spell.id === 'whirlwind');
      const utilityEffect = whirlwind?.effects.find(effect => effect.type === 'UTILITY');

      // Whirlwind has sibling rows for damage, Restrained, caster movement,
      // upward pull, falling, and escape-hurl behavior. The utility row should
      // keep the visible ground-point vortex and loose-object facts without
      // copying every mechanical row back into a monolithic summary.
      expect(utilityEffect?.description).toBe('Creates a 10-foot-radius, 30-foot-high whirlwind on a visible ground point within 300 feet for up to 1 minute with concentration; the vortex can be moved along the ground, sucks up unsecured Medium-or-smaller objects that are not worn or carried, and its separate rows handle creature damage, restraint, upward pull, falling, and escape hurling.');
    });

    it('keeps mode and truth-zone rows tied to save and area facts', () => {
      const pyrotechnics = getSpells(2).find(spell => spell.id === 'pyrotechnics');
      const zoneOfTruth = getSpells(2).find(spell => spell.id === 'zone-of-truth');
      const pyrotechnicsDescriptions = pyrotechnics?.effects.map(effect => effect.description) ?? [];
      const zoneUtility = zoneOfTruth?.effects.find(effect => effect.type === 'UTILITY');

      // Pyrotechnics splits Fireworks and Smoke into separate mode rows, with
      // a third Blinded status row. Zone of Truth is one area-control row. The
      // row text should expose save names, condition names, area geometry,
      // duration, and known save-result facts instead of relying on shorthand.
      expect(pyrotechnicsDescriptions).toEqual([
        'Fireworks: extinguish the 5-foot Cube flame within 60 feet; each creature within 10 feet of it makes a Constitution save or gains the Blinded condition until the end of the caster\'s next turn.',
        'Smoke: extinguish the 5-foot Cube flame within 60 feet and create a 20-foot Cube of Heavily Obscured smoke for 1 minute, dispersible by strong wind.',
        'Fireworks: on a failed Constitution save, a creature within 10 feet of the extinguished flame gains the Blinded condition until the end of the caster\'s next turn.'
      ]);
      expect(zoneUtility?.description).toBe('Create a 15-foot-radius Sphere within 60 feet for 10 minutes. A creature that enters the zone for the first time on a turn or starts its turn there makes a Charisma save; on a failed save, it cannot speak a deliberate lie while in the zone, and the caster knows whether each creature succeeds or fails.');
    });

    it('keeps reaction defense and detection rows tied to trigger and blocker facts', () => {
      const shield = getSpells(1).find(spell => spell.id === 'shield');
      const detectMagic = getSpells(1).find(spell => spell.id === 'detect-magic');
      const shieldDescriptions = shield?.effects.map(effect => effect.description) ?? [];
      const detectMagicUtility = detectMagic?.effects.find(effect => effect.type === 'UTILITY');

      // Shield has separate rows for the AC reaction and Magic Missile
      // immunity, while Detect Magic is one sensory row. These rows should
      // carry the trigger, duration, and material-blocking facts directly in
      // player-facing language so runtime logs and UI cards do not depend on
      // hidden top-level prose.
      expect(shieldDescriptions).toEqual([
        'When you are hit by an attack, you gain +5 AC, including against that attack, until the start of your next turn.',
        'When Magic Missile targets you, you take no damage from it until the start of your next turn.'
      ]);
      expect(detectMagicUtility?.description).toBe('For up to 10 minutes with concentration, sense magical effects within a 30-foot Sphere around the caster. With a Magic action, the caster can see auras on visible creatures or objects and learn a spell effect\'s school, but the sense is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or thin lead.');
    });

    it('keeps modifier, cantrip-save, and invisibility rows tied to target and duration facts', () => {
      const bless = getSpells(1).find(spell => spell.id === 'bless');
      const bane = getSpells(1).find(spell => spell.id === 'bane');
      const viciousMockery = getSpells(0).find(spell => spell.id === 'vicious-mockery');
      const greaterInvisibility = getSpells(4).find(spell => spell.id === 'greater-invisibility');
      const viciousMockeryDescriptions = viciousMockery?.effects.map(effect => effect.description) ?? [];
      const greaterInvisibilityStatus = greaterInvisibility?.effects.find(effect => effect.type === 'STATUS_CONDITION');

      // Bless and Bane are mirrored modifier rows, Vicious Mockery splits
      // damage from the attack-disadvantage rider, and Greater Invisibility is
      // a status row. These descriptions should name the visible target scope,
      // save gate, dice, duration, scaling, and condition facts already modeled
      // elsewhere in the spell data.
      expect(bless?.effects[0]?.description).toBe('Up to three creatures within 30 feet gain the Blessed modifier for up to 1 minute with concentration, adding 1d4 to attack rolls and saving throws. Higher slots add one target per slot level above 1.');
      expect(bane?.effects[0]?.description).toBe('Up to three visible creatures within 30 feet make a Charisma save; failed saves apply the Bane modifier for up to 1 minute with concentration, subtracting 1d4 from attack rolls and saving throws. Higher slots add one target per slot level above 1.');
      expect(viciousMockeryDescriptions).toEqual([
        'One creature within 60 feet that the caster can see or hear makes a Wisdom save, taking 1d6 Psychic damage on a failed save; the damage increases by 1d6 at character levels 5, 11, and 17.',
        'On a failed Wisdom save, the target has Disadvantage on the next attack roll it makes before the end of its next turn.'
      ]);
      expect(greaterInvisibilityStatus?.description).toBe('Touch one creature for up to 1 minute with concentration; the target gains the Invisible condition until the spell ends, and attacking does not end this invisibility.');
    });

    it('keeps benefit and defensive rows tied to target scope, duration, and scaling facts', () => {
      const longstrider = getSpells(1).find(spell => spell.id === 'longstrider');
      const shieldOfFaith = getSpells(1).find(spell => spell.id === 'shield-of-faith');
      const aid = getSpells(2).find(spell => spell.id === 'aid');
      const barkskin = getSpells(2).find(spell => spell.id === 'barkskin');

      // These benefit rows are easy to render as short stat reminders, but
      // combat UI and audit logs need the same target scope, duration, and
      // higher-slot facts that are already modeled in the spell data.
      expect(longstrider?.effects[0]?.description).toBe('Touch one creature for 1 hour; the target gains +10 feet to Speed, and higher slots let the caster target one additional creature per slot level above 1.');
      expect(shieldOfFaith?.effects[0]?.description).toBe('As a Bonus Action, choose one creature within 60 feet for up to 10 minutes with concentration; the target gains a +2 bonus to AC.');
      expect(aid?.effects[0]?.description).toBe('Choose up to three creatures within 30 feet for 8 hours; each target increases current and maximum Hit Points by 5, plus 5 more Hit Points per slot level above 2.');
      expect(barkskin?.effects[0]?.description).toBe('Touch one willing creature for 1 hour; the target has AC 17 if its Armor Class would otherwise be lower.');
    });

    it('keeps damage timing and area rows tied to once-per-turn and geometry facts', () => {
      const cloudOfDaggers = getSpells(2).find(spell => spell.id === 'cloud-of-daggers');
      const spiritGuardians = getSpells(3).find(spell => spell.id === 'spirit-guardians');
      const vitriolicSphere = getSpells(4).find(spell => spell.id === 'vitriolic-sphere');
      const iceKnife = getSpells(1).find(spell => spell.id === 'ice-knife');

      // These damage rows already carry dice, saves, triggers, area shapes, and
      // slot scaling in structured data. The visible row text should expose the
      // same once-per-turn, emanation, projectile, and burst facts so combat
      // logs do not need to infer them from sibling prose.
      expect(cloudOfDaggers?.effects[1]?.description).toBe('A creature takes 4d4 Slashing damage the first time on a turn that it enters the Cube or when the Cube moves into its space; this can happen only once per turn and gains +2d4 per slot level above 2.');
      expect(spiritGuardians?.effects[0]?.description).toBe('Creatures in the 15-foot Emanation that follows the caster make a Wisdom save, taking 3d8 Radiant or Necrotic damage on a failed save or half as much on a success; damage increases by +1d8 per slot level above 3.');
      expect(vitriolicSphere?.effects[0]?.description).toBe('A 1-foot acid orb streaks to a point within 150 feet and explodes in a 20-foot-radius Sphere; each creature there makes a Dexterity save, taking 10d4 Acid damage on a failed save or half as much on a success, with +2d4 per slot level above 4.');
      expect(iceKnife?.effects[1]?.description).toBe('Hit or miss, the ice shard explodes after the primary attack; the target and each creature within 5 feet makes a Dexterity save, taking 2d6 Cold damage on a failed save, plus +1d6 per slot level above 1.');
    });

    it('keeps status gates and protective filters tied to condition names and target facts', () => {
      const chillTouch = getSpells(0).find(spell => spell.id === 'chill-touch');
      const mindSliver = getSpells(0).find(spell => spell.id === 'mind-sliver');
      const spareTheDying = getSpells(0).find(spell => spell.id === 'spare-the-dying');
      const protection = getSpells(1).find(spell => spell.id === 'protection-from-evil-and-good');
      const chillTouchDescriptions = chillTouch?.effects.map(effect => effect.description) ?? [];
      const spareDescriptions = spareTheDying?.effects.map(effect => effect.description) ?? [];
      const protectionDescriptions = protection?.effects.map(effect => effect.description) ?? [];

      // These rows are status/control wrappers rather than raw damage. The row
      // text should name the status or protection payload and the target filter
      // facts already modeled so runtime cards do not show vague "target"
      // shorthand.
      expect(chillTouchDescriptions).toEqual([
        'On a melee spell hit, the target takes 1d10 Necrotic damage, with cantrip-tier damage scaling at character levels 5, 11, and 17.',
        'On a melee spell hit, the target gains the No Healing condition and cannot regain Hit Points until the start of the caster\'s next turn.',
        'On a melee spell hit against an Undead target, that target gains Disadvantage on attacks against the caster until the end of the caster\'s next turn.'
      ]);
      expect(mindSliver?.effects[1]?.description).toBe('On a failed Intelligence save, subtract 1d4 from the next saving throw the target makes before the end of the caster\'s next turn.');
      expect(spareDescriptions).toEqual([
        'Choose one creature within 15 feet that has 0 Hit Points and is not dead; the creature becomes Stable and is no longer dying. The range increases to 30 feet at level 5, 60 feet at level 11, and 120 feet at level 17.',
        'The 0-Hit-Point creature within the current Spare the Dying range gains the Stable condition immediately, provided it is not dead.'
      ]);
      expect(protectionDescriptions).toEqual([
        'For up to 10 minutes with concentration, Aberration, Celestial, Elemental, Fey, Fiend, and Undead creatures have Disadvantage on attack rolls against the touched target.',
        'For up to 10 minutes with concentration, the touched target cannot gain Charmed or Frightened from Aberration, Celestial, Elemental, Fey, Fiend, or Undead creatures.'
      ]);
    });

    it('keeps invisibility and entangle rows tied to ending and escape facts', () => {
      const invisibility = getSpells(2).find(spell => spell.id === 'invisibility');
      const entangle = getSpells(1).find(spell => spell.id === 'entangle');
      const invisibilityDescriptions = invisibility?.effects.map(effect => effect.description) ?? [];
      const entangleDescriptions = entangle?.effects.map(effect => effect.description) ?? [];

      // Invisibility and Entangle both rely on follow-up state transitions:
      // early ending for Invisible, and escape / repeated-save exits for
      // Restrained. The row text should expose those exits directly instead of
      // leaving them hidden in conditional-ending or status metadata.
      expect(invisibilityDescriptions).toEqual([
        'Touch one creature for up to 1 hour with concentration; the target gains the Invisible condition until the spell ends early after it makes an attack roll, deals damage, or casts a spell. Higher slots add one target per slot level above 2.',
        'The touched creature gains the Invisible condition for up to 1 hour with concentration; this spell ends early after the target makes an attack roll, deals damage, or casts a spell.'
      ]);
      expect(entangleDescriptions).toEqual([
        'Create a 20-foot Square of grasping plants within 90 feet for up to 1 minute with concentration; the area is Difficult Terrain until the spell ends.',
        'Each creature in the 20-foot Square when the plants appear makes a Strength save or gains the Restrained condition for up to 1 minute, with a Strength (Athletics) action to escape and the listed end-turn Wisdom save to end it.',
        'The first time on a turn that a creature enters the 20-foot Square, it makes a Strength save or gains the Restrained condition, with the same Strength (Athletics) escape action and listed end-turn Wisdom save.',
        'A creature that ends its turn in the 20-foot Square makes a Strength save or gains the Restrained condition, with the same Strength (Athletics) escape action and listed end-turn Wisdom save.'
      ]);
    });

    it('keeps area trigger rows tied to geometry saves and exit facts', () => {
      const createBonfire = getSpells(0).find(spell => spell.id === 'create-bonfire');
      const grease = getSpells(1).find(spell => spell.id === 'grease');
      const hypnoticPattern = getSpells(3).find(spell => spell.id === 'hypnotic-pattern');
      const createBonfireDescriptions = createBonfire?.effects.map(effect => effect.description) ?? [];
      const greaseDescriptions = grease?.effects.map(effect => effect.description) ?? [];
      const hypnoticPatternDescriptions = hypnoticPattern?.effects.map(effect => effect.description) ?? [];

      // These spells all create persistent areas where row text needs to carry
      // the exact trigger moment, geometry, save branch, status name, and exit
      // condition. That keeps UI previews and runtime audit panels from hiding
      // key timing facts inside trigger/status metadata alone.
      expect(createBonfireDescriptions).toEqual([
        'When the spell is cast, each creature in the 5-foot Cube bonfire space makes a Dexterity save or takes 1d8 Fire damage; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.',
        'A creature that ends its turn in the 5-foot Cube bonfire space makes a Dexterity save or takes 1d8 Fire damage; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.',
        'The first time on a turn that a creature enters the 5-foot Cube bonfire space, it makes a Dexterity save or takes 1d8 Fire damage; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.'
      ]);
      expect(greaseDescriptions).toEqual([
        'Nonflammable grease coats a 10-foot square within 60 feet for 1 minute without concentration, making the area Difficult Terrain.',
        'Each creature standing in the 10-foot square when the grease appears makes a Dexterity save or gains the Prone condition.',
        'The first time on a turn that a creature enters the 10-foot square, it makes a Dexterity save or gains the Prone condition.',
        'A creature that ends its turn in the 10-foot square makes a Dexterity save or gains the Prone condition.'
      ]);
      expect(hypnoticPatternDescriptions).toEqual([
        'Each creature in the 30-foot Cube that can see the momentary pattern makes a Wisdom save or is Charmed for up to 1 minute with concentration; the spell ends for that creature if it takes any damage or another creature uses an action to shake it awake.',
        'While Charmed by Hypnotic Pattern, the failed-save creature is Incapacitated and has Speed 0; this derived condition ends for that creature when the Charmed row ends from damage, an adjacent creature using an action to shake it awake, or the spell ending.'
      ]);
    });

    it('keeps fear pattern and geas controls tied to movement breaks and duration scaling', () => {
      const fear = getSpells(3).find(spell => spell.id === 'fear');
      const hypnoticPattern = getSpells(3).find(spell => spell.id === 'hypnotic-pattern');
      const geas = getSpells(5).find(spell => spell.id === 'geas');
      const fearStatus = fear?.effects.find(effect => effect.type === 'STATUS_CONDITION');
      const hypnoticPatternDescriptions = hypnoticPattern?.effects.map(effect => effect.description) ?? [];
      const geasDescriptions = geas?.effects.map(effect => effect.description) ?? [];

      // These long-control rows need their escape conditions in the row text:
      // Fear combines drop, forced movement, and sight-gated repeat saves;
      // Hypnotic Pattern has damage/shake-awake breaks; Geas has understanding,
      // punishment, restoration exits, and high-slot duration branches.
      expect(fearStatus?.description).toBe('Each creature in the 30-foot Cone that fails the Wisdom save drops what it is holding and is Frightened for up to 1 minute with concentration. While Frightened, it takes the Dash action and moves away by the safest route each turn if it can, and it repeats the Wisdom save only after ending a turn without line of sight to you, ending the spell on itself on a success.');
      expect(hypnoticPatternDescriptions).toEqual([
        'Each creature in the 30-foot Cube that can see the momentary pattern makes a Wisdom save or is Charmed for up to 1 minute with concentration; the spell ends for that creature if it takes any damage or another creature uses an action to shake it awake.',
        'While Charmed by Hypnotic Pattern, the failed-save creature is Incapacitated and has Speed 0; this derived condition ends for that creature when the Charmed row ends from damage, an adjacent creature using an action to shake it awake, or the spell ending.'
      ]);
      expect(geasDescriptions).toEqual([
        'Give one visible creature within 60 feet that can understand you a verbal command to perform a service or avoid an activity for 30 days. On a failed Wisdom save, the target is Charmed, takes 5d10 Psychic damage no more than once each day when it acts directly against the command, ends the spell if given a suicidal command, can be freed by Remove Curse, Greater Restoration, or Wish, and higher slots extend the duration to 365 days at slots 7-8 or until ended at slot 9.',
        'On a failed Wisdom save, the target is Charmed for the 30-day base Geas duration, while a target that cannot understand the command automatically succeeds; higher slots extend the Charmed duration to 365 days at slots 7-8 or until ended at slot 9.'
      ]);
    });

    it('keeps cantrip support and pull rows tied to target duration and gates', () => {
      const bladeWard = getSpells(0).find(spell => spell.id === 'blade-ward');
      const resistance = getSpells(0).find(spell => spell.id === 'resistance');
      const lightningLure = getSpells(0).find(spell => spell.id === 'lightning-lure');
      const bladeWardDescriptions = bladeWard?.effects.map(effect => effect.description) ?? [];
      const resistanceDescriptions = resistance?.effects.map(effect => effect.description) ?? [];
      const lightningLureDescriptions = lightningLure?.effects.map(effect => effect.description) ?? [];

      // These cantrips are small but mechanically dense: their rows drive
      // defensive previews, chosen-damage prompts, forced-movement prompts,
      // and proximity-gated damage. The text should name those contracts
      // instead of relying on nearby top-level prose or nested metadata.
      expect(bladeWardDescriptions).toEqual([
        'Self only. For up to 1 minute with concentration, every incoming attack roll against the caster subtracts 1d4 while the spell remains active.'
      ]);
      expect(resistanceDescriptions).toEqual([
        'Touch one creature and choose Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, or Thunder for up to 1 minute with concentration.',
        'For up to 1 minute with concentration, the touched target reduces one damage instance of the chosen type by 1d4 once per turn.'
      ]);
      expect(lightningLureDescriptions).toEqual([
        'One creature within 15 feet makes a Strength save or is pulled up to 10 feet in a straight line toward the caster.',
        'After the failed Strength save pull, the target takes 1d8 Lightning damage only if it ends within 5 feet of the caster; damage scales to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.'
      ]);
    });

    it('keeps ward trap and smite control rows tied to saves and exits', () => {
      const sanctuary = getSpells(1).find(spell => spell.id === 'sanctuary');
      const snare = getSpells(1).find(spell => spell.id === 'snare');
      const thunderousSmite = getSpells(1).find(spell => spell.id === 'thunderous-smite');
      const wrathfulSmite = getSpells(1).find(spell => spell.id === 'wrathful-smite');
      const sanctuaryDescriptions = sanctuary?.effects.map(effect => effect.description) ?? [];
      const snareDescriptions = snare?.effects.map(effect => effect.description) ?? [];
      const thunderousSmiteDescriptions = thunderousSmite?.effects.map(effect => effect.description) ?? [];
      const wrathfulSmiteDescriptions = wrathfulSmite?.effects.map(effect => effect.description) ?? [];

      // These level-1 control spells all rely on follow-up prompts: Sanctuary
      // redirects attackers, Snare exposes repeated escape routes, and smites
      // attach save-gated control riders to the first melee weapon hit. Row
      // text should make those prompts visible without inspecting nested data.
      expect(sanctuaryDescriptions).toEqual([
        'Ward one creature within 30 feet for 1 minute without concentration; attackers targeting the warded creature with an attack roll or damaging spell must pass a Wisdom save or choose a new target or lose the attack or spell, and area effects bypass the ward.',
        'When an attacker targets the warded creature with an attack roll or damaging spell, the attacker makes a Wisdom save; on a failed save it must choose a new target or lose the attack or spell.',
        'The ward ends early if the warded creature makes an attack roll, casts a spell, or deals damage.'
      ]);
      expect(snareDescriptions).toEqual([
        'When a Small, Medium, or Large creature enters the 5-foot-radius snare area, it makes a Dexterity save or gains the Restrained condition for up to 8 hours, hanging upside down until the spell or restraint ends.',
        'The snare is nearly invisible and can be found with an Intelligence (Investigation) check against the spell save DC; the Restrained creature or another creature that can reach it can use an action for an Intelligence (Arcana) check to end the restraint, and the target also repeats the Dexterity save at each turn end.'
      ]);
      expect(thunderousSmiteDescriptions).toEqual([
        'On the first melee weapon hit, the target takes 2d6 Thunder damage, the strike is audible within 300 feet, and the damage increases by 1d6 per slot level above 1.',
        'On the first melee weapon hit, the target makes a Strength save or gains the Prone condition as part of the Thunderous Smite rider.',
        'On the first melee weapon hit, the target makes a Strength save or is pushed 10 feet away from the caster.'
      ]);
      expect(wrathfulSmiteDescriptions).toEqual([
        'On the first melee weapon hit, the target takes 1d6 Necrotic damage, increasing by 1d6 per slot level above 1.',
        'On the first melee weapon hit, the target makes a Wisdom save or gains the Frightened condition for up to 1 minute, repeating the Wisdom save at each turn end to end the spell on itself.'
      ]);
    });

    it('keeps prose-heavy utility wrappers tied to mode and area facts', () => {
      const magicCircle = getSpells(3).find(spell => spell.id === 'magic-circle');
      const speakWithPlants = getSpells(3).find(spell => spell.id === 'speak-with-plants');
      const wallOfSand = getSpells(3).find(spell => spell.id === 'wall-of-sand');
      const elementalBane = getSpells(4).find(spell => spell.id === 'elemental-bane');
      const magicCircleDescriptions = magicCircle?.effects.map(effect => effect.description) ?? [];
      const speakWithPlantsDescriptions = speakWithPlants?.effects.map(effect => effect.description) ?? [];
      const wallOfSandDescriptions = wallOfSand?.effects.map(effect => effect.description) ?? [];
      const elementalBaneDescriptions = elementalBane?.effects.map(effect => effect.description) ?? [];

      // These wrapper rows used long prose or shorthand for mechanics that the
      // spell UI needs to surface directly: mode choice, area dimensions,
      // creature-family filters, terrain toggles, wall consequences, and
      // chosen-damage-type riders. The row text stays concise but complete.
      expect(magicCircleDescriptions).toEqual([
        'Create a 10-foot-radius, 20-foot-tall Cylinder within 10 feet for 1 hour without concentration; choose Celestial, Elemental, Fey, Fiend, or Undead families, then choose inward or reversed protection that blocks entry or exit, wastes failed teleport/interplanar attempts after a Charisma save, imposes Disadvantage on attacks across the boundary, and prevents Charmed, Frightened, or Possessed from the chosen creatures.'
      ]);
      expect(speakWithPlantsDescriptions).toEqual([
        'For 10 minutes, plants in a 30-foot Emanation can communicate, answer questions about the past day, follow simple commands, reshape plant-caused Difficult Terrain into ordinary terrain or ordinary plant terrain into Difficult Terrain, move branches and stalks without uprooting, communicate with Plant creatures, and release creatures restrained by Entangle plants.'
      ]);
      expect(wallOfSandDescriptions).toEqual([
        'Creatures in the 30-foot-long, 10-foot-high, 10-foot-thick sand wall gain the Blinded condition for up to 10 minutes with concentration; the wall blocks line of sight but not movement, and each foot moved inside costs 3 feet of movement.'
      ]);
      expect(elementalBaneDescriptions).toEqual([
        'Choose Acid, Cold, Fire, Lightning, or Thunder and one creature within 90 feet; on a failed Constitution save for up to 1 minute with concentration, the target loses resistance to the chosen type and the first time each turn it takes that damage type it takes an extra 2d6 damage of the same type.'
      ]);
    });

    it('keeps complex control wrappers tied to command access and cleanup facts', () => {
      const animateObjects = getSpells(5).find(spell => spell.id === 'animate-objects');
      const massSuggestion = getSpells(6).find(spell => spell.id === 'mass-suggestion');
      const mansion = getSpells(7).find(spell => spell.id === 'mordenkainens-magnificent-mansion');
      const animateObjectsDescriptions = animateObjects?.effects.map(effect => effect.description) ?? [];
      const massSuggestionDescriptions = massSuggestion?.effects.map(effect => effect.description) ?? [];
      const mansionDescriptions = mansion?.effects.map(effect => effect.description) ?? [];

      // These spells are UI-heavy wrappers: they create controlled actors,
      // long-running social commands, or extradimensional access rules. Their
      // rows should expose command loops, eligibility, break conditions, access
      // control, servant limits, and cleanup instead of hiding those in prose.
      expect(animateObjectsDescriptions).toEqual([
        'Animate eligible nonmagical unattended Huge-or-smaller objects within 120 feet for up to 1 minute with concentration. Object size counts against your spellcasting ability modifier limit, each object becomes an allied Construct that shares your initiative, you can command any within 500 feet as a Bonus Action, uncommanded objects Dodge and avoid harm, and each object reverts at 0 Hit Points with excess damage carrying over.'
      ]);
      expect(massSuggestionDescriptions).toEqual([
        'On a failed Wisdom save, each visible target within 60 feet that can hear and understand you is Charmed for the Mass Suggestion duration, follows the suggested activity to the best of its ability, and ends early for that target if you or an ally damages it or if it completes the suggested activity.',
        'Suggest an achievable, non-obviously-damaging course of activity in no more than 25 words to up to twelve visible creatures within 60 feet that can hear and understand you; failed-save Charmed targets follow it until completion, damage by you or an ally, or the duration ends, and higher slots extend the duration to 10 days at slot 7, 30 days at slot 8, or 366 days at slot 9.'
      ]);
      expect(mansionDescriptions).toEqual([
        'When the mansion ends, creatures and objects left inside the extradimensional dwelling are expelled into unoccupied spaces nearest the entrance.',
        'Summon 100 near-transparent invulnerable servants inside the mansion; they attend entrants, obey commands, perform human-servant tasks, cannot attack or directly harm creatures, and cannot leave the dwelling.',
        'Create a 5-foot-wide, 10-foot-tall shimmering door within 300 feet for 24 hours leading to a clean, fresh, warm extradimensional dwelling of up to 50 contiguous 10-foot Cubes; only the caster and designated creatures can enter while the door is open, the caster can open or close it without an action within 30 feet, a closed door is imperceptible, furnishings and decor are chosen by the caster, food serves a nine-course banquet for up to 100 people, and spell-created objects dissipate if removed.'
      ]);
    });

    it('keeps bargain memory and binding wrappers tied to service and ending facts', () => {
      const planarAlly = getSpells(6).find(spell => spell.id === 'planar-ally');
      const modifyMemory = getSpells(5).find(spell => spell.id === 'modify-memory');
      const animateDead = getSpells(3).find(spell => spell.id === 'animate-dead');
      const planarBinding = getSpells(5).find(spell => spell.id === 'planar-binding');
      const planarAllyDescriptions = planarAlly?.effects.map(effect => effect.description) ?? [];
      const modifyMemoryDescriptions = modifyMemory?.effects.map(effect => effect.description) ?? [];
      const animateDeadDescriptions = animateDead?.effects.map(effect => effect.description) ?? [];
      const planarBindingDescriptions = planarBinding?.effects.map(effect => effect.description) ?? [];

      // These wrappers create long-running obligations or altered mental
      // states. Row text should surface who is eligible, what control or
      // bargain exists, what breaks the effect, and what happens when service
      // ends without depending on full spell-card prose.
      expect(planarAllyDescriptions).toEqual([
        'A known cosmic power sends one Celestial, Elemental, or Fiend ally, or a requested named creature if allowed, to an unoccupied space within 60 feet. The creature is loyal to that entity, is not compelled to obey or agree to serve you, and must be bargained with separately before it performs a task.',
        'You must communicate with the planar ally to bargain for service. Typical payment is 100 GP per minute, 1,000 GP per hour, or 10,000 GP per day for up to 10 days, adjusted by task alignment, hazard, and danger; suicidal tasks are rarely accepted, and the creature returns home when service is complete, the agreed duration expires, or no price is agreed.'
      ]);
      expect(modifyMemoryDescriptions).toEqual([
        'Choose one visible creature within 30 feet; on a failed Wisdom save, with Advantage if it is fighting you, it is Charmed and Incapacitated for up to 1 minute with concentration while you describe a memory change for an event from the last 24 hours lasting no more than 10 minutes. Damage, another spell targeting it, ending before the description is complete, or the target being unable to understand your language prevents modification; Remove Curse or Greater Restoration restores the true memory, and higher slots extend the lookback window.',
        'On a failed Wisdom save, the target is Charmed for up to 1 minute with concentration, has Advantage on the save if it is fighting you, must be able to understand your language for the modified memory to take root, and can have the true memory restored by Remove Curse or Greater Restoration.',
        'On a failed Wisdom save, the Charmed target is Incapacitated and unaware of its surroundings while still able to hear you; this nested state supports the memory-description window and ends without modifying memory if the spell ends before the description is complete.'
      ]);
      expect(animateDeadDescriptions).toEqual([
        'Choose bones or a corpse of a Medium or Small Humanoid within 10 feet to create a Skeleton or Zombie. For 24 hours, you can mentally command any Undead animated by this spell within 60 feet as a Bonus Action, issuing the same command to multiple controlled Undead; without commands they Dodge and move only to avoid harm, orders continue until complete, control stops after 24 hours unless recast before expiry, and higher slots animate or reassert control over two additional Undead per slot level above 3.'
      ]);
      expect(planarBindingDescriptions).toEqual([
        'Bind one Celestial, Elemental, Fey, or Fiend that stays within 60 feet for the full 1-hour casting and fails the Charisma save. The bound creature serves for 24 hours, a summoned or created target has its source spell duration extended to match, hostile bound creatures obey the letter of instructions while trying to twist them, completed instructions cause same-plane targets to report back or different-plane targets to wait at the binding site, and higher slots extend the duration to 10 days, 30 days, 180 days, or a year and a day.',
        'On a failed Charisma save, the Celestial, Elemental, Fey, or Fiend gains the Bound condition and serves the caster for the 24-hour base duration; higher slots extend Bound to 10 days at slot 6, 30 days at slot 7, 180 days at slot 8, or a year and a day at slot 9.'
      ]);
    });

    it('keeps service suggestion and memory rows tied to consent breaks and duration scaling', () => {
      const planarAlly = getSpells(6).find(spell => spell.id === 'planar-ally');
      const massSuggestion = getSpells(6).find(spell => spell.id === 'mass-suggestion');
      const modifyMemory = getSpells(5).find(spell => spell.id === 'modify-memory');
      const planarAllyDescriptions = planarAlly?.effects.map(effect => effect.description) ?? [];
      const massSuggestionDescriptions = massSuggestion?.effects.map(effect => effect.description) ?? [];
      const modifyMemoryDescriptions = modifyMemory?.effects.map(effect => effect.description) ?? [];

      // These are not direct-command rows. They need to expose service
      // negotiation, hearing/understanding gates, damage or completion breaks,
      // nested Charmed/Incapacitated state, restoration exits, and scaling.
      expect(planarAllyDescriptions).toEqual([
        'A known cosmic power sends one Celestial, Elemental, or Fiend ally, or a requested named creature if allowed, to an unoccupied space within 60 feet. The creature is loyal to that entity, is not compelled to obey or agree to serve you, and must be bargained with separately before it performs a task.',
        'You must communicate with the planar ally to bargain for service. Typical payment is 100 GP per minute, 1,000 GP per hour, or 10,000 GP per day for up to 10 days, adjusted by task alignment, hazard, and danger; suicidal tasks are rarely accepted, and the creature returns home when service is complete, the agreed duration expires, or no price is agreed.'
      ]);
      expect(massSuggestionDescriptions).toEqual([
        'On a failed Wisdom save, each visible target within 60 feet that can hear and understand you is Charmed for the Mass Suggestion duration, follows the suggested activity to the best of its ability, and ends early for that target if you or an ally damages it or if it completes the suggested activity.',
        'Suggest an achievable, non-obviously-damaging course of activity in no more than 25 words to up to twelve visible creatures within 60 feet that can hear and understand you; failed-save Charmed targets follow it until completion, damage by you or an ally, or the duration ends, and higher slots extend the duration to 10 days at slot 7, 30 days at slot 8, or 366 days at slot 9.'
      ]);
      expect(modifyMemoryDescriptions).toEqual([
        'Choose one visible creature within 30 feet; on a failed Wisdom save, with Advantage if it is fighting you, it is Charmed and Incapacitated for up to 1 minute with concentration while you describe a memory change for an event from the last 24 hours lasting no more than 10 minutes. Damage, another spell targeting it, ending before the description is complete, or the target being unable to understand your language prevents modification; Remove Curse or Greater Restoration restores the true memory, and higher slots extend the lookback window.',
        'On a failed Wisdom save, the target is Charmed for up to 1 minute with concentration, has Advantage on the save if it is fighting you, must be able to understand your language for the modified memory to take root, and can have the true memory restored by Remove Curse or Greater Restoration.',
        'On a failed Wisdom save, the Charmed target is Incapacitated and unaware of its surroundings while still able to hear you; this nested state supports the memory-description window and ends without modifying memory if the spell ends before the description is complete.'
      ]);
    });

    it('keeps undead control and planar binding rows tied to command duration and reassertion facts', () => {
      const animateDead = getSpells(3).find(spell => spell.id === 'animate-dead');
      const createUndead = getSpells(6).find(spell => spell.id === 'create-undead');
      const planarBinding = getSpells(5).find(spell => spell.id === 'planar-binding');
      const animateDeadUtility = animateDead?.effects.find(effect => effect.type === 'UTILITY');
      const createUndeadUtility = createUndead?.effects.find(effect => effect.type === 'UTILITY');
      const planarBindingDescriptions = planarBinding?.effects.map(effect => effect.description) ?? [];

      // These rows manage persistent creatures after the cast resolves. The row
      // text needs the command action cost, default behavior, control expiry,
      // recast/reassert tradeoff, hostile-service branch, and duration scaling.
      expect(animateDeadUtility?.description).toBe('Choose bones or a corpse of a Medium or Small Humanoid within 10 feet to create a Skeleton or Zombie. For 24 hours, you can mentally command any Undead animated by this spell within 60 feet as a Bonus Action, issuing the same command to multiple controlled Undead; without commands they Dodge and move only to avoid harm, orders continue until complete, control stops after 24 hours unless recast before expiry, and higher slots animate or reassert control over two additional Undead per slot level above 3.');
      expect(createUndeadUtility?.description).toBe('At night, turn up to three Small or Medium Humanoid corpses within 10 feet into controlled Ghouls for 24 hours. As a Bonus Action, you can mentally command any Undead created by this spell within 120 feet, issuing the same command to multiple controlled Undead; without commands they Dodge and move only to avoid harm, orders continue until complete, control stops after 24 hours unless recast before expiry, and higher slots animate or reassert control over four Ghouls at slot 7, five Ghouls or two Ghasts/Wights at slot 8, or six Ghouls, three Ghasts/Wights, or two Mummies at slot 9.');
      expect(planarBindingDescriptions).toEqual([
        'Bind one Celestial, Elemental, Fey, or Fiend that stays within 60 feet for the full 1-hour casting and fails the Charisma save. The bound creature serves for 24 hours, a summoned or created target has its source spell duration extended to match, hostile bound creatures obey the letter of instructions while trying to twist them, completed instructions cause same-plane targets to report back or different-plane targets to wait at the binding site, and higher slots extend the duration to 10 days, 30 days, 180 days, or a year and a day.',
        'On a failed Charisma save, the Celestial, Elemental, Fey, or Fiend gains the Bound condition and serves the caster for the 24-hour base duration; higher slots extend Bound to 10 days at slot 6, 30 days at slot 7, 180 days at slot 8, or a year and a day at slot 9.'
      ]);
    });

    it('keeps transformation object and terrain wrappers tied to limits and cleanup facts', () => {
      const gaseousForm = getSpells(3).find(spell => spell.id === 'gaseous-form');
      const awaken = getSpells(5).find(spell => spell.id === 'awaken');
      const instantSummons = getSpells(6).find(spell => spell.id === 'drawmijs-instant-summons');
      const mirageArcane = getSpells(7).find(spell => spell.id === 'mirage-arcane');
      const gaseousFormDescriptions = gaseousForm?.effects.map(effect => effect.description) ?? [];
      const awakenDescriptions = awaken?.effects.map(effect => effect.description) ?? [];
      const instantSummonsDescriptions = instantSummons?.effects.map(effect => effect.description) ?? [];
      const mirageArcaneDescriptions = mirageArcane?.effects.map(effect => effect.description) ?? [];

      // These wrappers change bodies, minds, objects, and large terrain areas.
      // Row text should name eligibility, hard limits, cleanup rules, and the
      // parts future UI or runtime work must not lose when the full card prose
      // is not visible.
      expect(gaseousFormDescriptions).toEqual([
        'While transformed into misty cloud form, the target has Resistance to Bludgeoning, Piercing, and Slashing damage.',
        'While transformed into misty cloud form, the target cannot be knocked Prone.',
        'Touch one willing creature and transform it, plus worn and carried gear, into misty cloud form for up to 1 hour with concentration; higher slots add one target per slot level above 3. The target only has a 10-foot Fly Speed with hover, has Advantage on Strength, Dexterity, and Constitution saves, can share creature spaces and pass through narrow openings, treats liquids as solid, cannot speak, manipulate or drop objects, attack, or cast spells, and the form ends for that target at 0 Hit Points or when it uses a Magic action to end it.'
      ]);
      expect(awakenDescriptions).toEqual([
        'The awakened Beast or Plant is Charmed for 30 days or until the caster or the caster\'s allies damage it, then chooses its attitude when the condition ends.',
        'After the 8-hour casting with a consumed 1,000 GP gemstone, touch a Beast or Plant creature with Intelligence 3 or less, or a natural plant that is not a creature; the target gains Intelligence 10 and one language the caster knows, and a noncreature plant becomes a Plant creature with movement, humanlike senses, and DM-chosen statistics.'
      ]);
      expect(instantSummonsDescriptions).toEqual([
        'Touch one object weighing 10 pounds or less and no more than 6 feet in its longest dimension; the spell marks the object and names it on a unique sapphire, then later speaking the item name and crushing the sapphire summons it to the caster\'s hand across any distance or plane unless another creature holds or carries it, in which case the caster learns that creature\'s identity and approximate location, while Dispel Magic or a similar effect on the sapphire ends the spell.'
      ]);
      expect(mirageArcaneDescriptions).toEqual([
        'For 10 days, the terrain illusion can turn clear ground into Difficult Terrain or reverse Difficult Terrain into clear ground, and can otherwise impede movement through the affected area.',
        'Transform up to 1 square mile of visible terrain for 10 days with audible, visual, tactile, and olfactory illusion elements; the illusion can make terrain resemble other terrain, alter or add structures, but cannot disguise, conceal, or add creatures, removed illusion pieces disappear immediately, and Truesight reveals the true terrain while leaving other illusion elements physically interactive.'
      ]);
    });

    it('keeps stone meld and ethereal body-state rows tied to geometry movement and ejection rules', () => {
      const stoneShape = getSpells(4).find(spell => spell.id === 'stone-shape');
      const meldIntoStone = getSpells(3).find(spell => spell.id === 'meld-into-stone');
      const etherealness = getSpells(7).find(spell => spell.id === 'etherealness');
      const stoneShapeUtility = stoneShape?.effects.find(effect => effect.type === 'UTILITY');
      const meldUtility = meldIntoStone?.effects.find(effect => effect.type === 'UTILITY');
      const etherealnessDescriptions = etherealness?.effects.map(effect => effect.description) ?? [];

      // These body-state and material-interaction rows are not ordinary utility
      // summaries. They need geometry caps, perception limits, movement limits,
      // ejection damage, plane-gated interaction, shunt damage, and scaling.
      expect(stoneShapeUtility?.description).toBe('Touch one Medium-or-smaller stone object or a stone section no more than 5 feet in any dimension and reshape it into a chosen form, such as a weapon, statue, coffer, passage through 5-foot-thick stone, or sealed stone door/frame; created objects can include up to two hinges and a latch but cannot have fine mechanical detail.');
      expect(meldUtility?.description).toBe('Step into a touched stone object or surface large enough to fully contain you and your equipment for up to 8 hours. While merged, you are hidden from nonmagical senses, cannot see outside, make hearing-based Perception checks outside with Disadvantage, remain aware of time, can cast only self-targeting spells, cannot move except to spend 5 feet of movement to exit where you entered, and are expelled Prone to the nearest unoccupied space if the stone no longer contains you: partial destruction or reshaping deals 6d6 Force damage, while complete destruction or transmutation deals 50 Force damage.');
      expect(etherealnessDescriptions).toEqual([
        'Step into the Border Ethereal where it overlaps your current plane for up to 8 hours, then return to the corresponding space on the original plane when the spell ends; higher slots can include up to three willing creatures within 10 feet per slot level above 7.',
        'If you return from the Border Ethereal in an occupied space, you are shunted to the nearest unoccupied space and take Force damage equal to twice the number of feet moved.',
        'While on the Border Ethereal, you can move in any direction with each foot up or down costing 1 extra foot, perceive the origin plane in gray out to 60 feet, interact only with Ethereal Plane creatures, objects, and effects unless another feature allows otherwise, return to the corresponding origin-plane space when the spell ends, and the spell ends instantly if cast on the Ethereal Plane or a plane that does not border it.'
      ]);
    });

    it('keeps creation petrification portal and reincarnation wrappers tied to lifecycle facts', () => {
      const createHomunculus = getSpells(6).find(spell => spell.id === 'create-homunculus');
      const fleshToStone = getSpells(6).find(spell => spell.id === 'flesh-to-stone');
      const arcaneGate = getSpells(6).find(spell => spell.id === 'arcane-gate');
      const reincarnate = getSpells(5).find(spell => spell.id === 'reincarnate');
      const createHomunculusDescriptions = createHomunculus?.effects.map(effect => effect.description) ?? [];
      const fleshToStoneDescriptions = fleshToStone?.effects.map(effect => effect.description) ?? [];
      const arcaneGateDescriptions = arcaneGate?.effects.map(effect => effect.description) ?? [];
      const reincarnateDescriptions = reincarnate?.effects.map(effect => effect.description) ?? [];

      // These rows create long-lived companions, permanent body changes,
      // portal geometry, or a replacement body. Their summaries need to name
      // cost, eligibility, failure, tracking, and cleanup facts directly so
      // future UI work can route those choices without re-reading full prose.
      expect(createHomunculusDescriptions).toEqual([
        'Transform the spell components into one homunculus after the caster takes 2d4 irreducible Piercing damage from the jewel-encrusted dagger; the homunculus uses Monster Manual statistics, is a faithful companion, dies if the caster dies, recasting fails while the caster already has a living homunculus, and later same-plane long rests can transfer up to half the caster\'s Hit Dice into temporary hit point maximum changes that end at the caster\'s next long rest or when the homunculus dies.',
        'The caster cuts themself with the jewel-encrusted dagger and takes 2d4 irreducible Piercing damage as part of creating the homunculus.'
      ]);
      expect(fleshToStoneDescriptions).toEqual([
        'On a failed Constitution save, the target has the Restrained condition for the duration. A Restrained target repeats the Constitution save at the end of each of its turns; three successes end the spell, and three failures turn the target to stone.',
        'If the Restrained target fails three end-turn Constitution saves before collecting three successes, it is turned to stone and has the Petrified condition for the duration.',
        'Choose one visible flesh-bodied creature within 60 feet for up to 1 minute with concentration; a failed Constitution save starts Restrained repeat-save tracking, three successes end the spell, three failures Petrify the target, physical breakage while Petrified leaves matching deformities if it reverts, and maintaining concentration for the full duration makes the stone state last until removed.'
      ]);
      expect(arcaneGateDescriptions).toEqual([
        'Create two linked 10-foot-diameter portals for up to 10 minutes with concentration: one on a ground point within 10 feet of you and one on a visible ground point within 500 feet. The spell fails if either portal would open in an occupied space, each portal is open only from one chosen side, opaque mist blocks sight through it, creatures and objects entering the open side exit the other portal as though the spaces were adjacent, and you can reverse the open sides with a Bonus Action.'
      ]);
      expect(reincarnateDescriptions).toEqual([
        'Touch a dead Humanoid or piece of one that has been dead no longer than 10 days; the spell creates a new body, calls the soul into it, assigns a new playable species by 1d10 table or DM choice, lets the creature make species choices, preserves former-life memories and non-species capabilities, and replaces old species traits with the new species traits.'
      ]);
    });

    it('keeps access knowledge and tree movement wrappers tied to visibility and exit facts', () => {
      const illusoryScript = getSpells(1).find(spell => spell.id === 'illusory-script');
      const ropeTrick = getSpells(2).find(spell => spell.id === 'rope-trick');
      const communeWithNature = getSpells(5).find(spell => spell.id === 'commune-with-nature');
      const treeStride = getSpells(5).find(spell => spell.id === 'tree-stride');
      const illusoryScriptDescriptions = illusoryScript?.effects.map(effect => effect.description) ?? [];
      const ropeTrickDescriptions = ropeTrick?.effects.map(effect => effect.description) ?? [];
      const communeWithNatureDescriptions = communeWithNature?.effects.map(effect => effect.description) ?? [];
      const treeStrideDescriptions = treeStride?.effects.map(effect => effect.description) ?? [];

      // These wrappers affect who can read, enter, learn, or travel. The
      // descriptions need to name visibility permissions, capacity limits,
      // blocked environments, and forced exits so future screens can expose
      // the practical choices without copying the entire card.
      expect(illusoryScriptDescriptions).toEqual([
        'Write on parchment, paper, or another suitable writing material for 10 days; the caster and designated creatures see the normal handwriting and intended meaning, others see unintelligible unknown or magical script or a different known-language message chosen by the caster, Dispel Magic removes both original and illusory writing, and Truesight reveals the hidden message.'
      ]);
      expect(ropeTrickDescriptions).toEqual([
        'Touch a rope up to 60 feet long for 1 hour; one end rises until the rope hangs vertically, opening an invisible extradimensional entrance at the top that up to eight Medium-or-smaller creatures can enter by climbing, the rope can be pulled inside and hidden, attacks and spells cannot cross the entrance, occupants can see out through a 3-foot-by-5-foot window, and anything inside drops out when the spell ends.'
      ]);
      expect(communeWithNatureDescriptions).toEqual([
        'Commune with nature spirits to learn three chosen facts about the surrounding natural area: within 3 miles outdoors or 300 feet in caves and natural underground settings, but not where construction such as castles or settlements has replaced nature; facts can include settlements, planar portals, one DM-chosen CR 10+ Celestial, Elemental, Fey, Fiend, or Undead, prevalent plants/minerals/Beasts, or bodies of water.'
      ]);
      expect(treeStrideDescriptions).toEqual([
        'For up to 1 minute with concentration, the caster can use 5 feet of movement once each turn to enter a living tree at least their size and either exit it or teleport through another living tree of the same kind within 500 feet, appearing within 5 feet of the destination or original tree if no movement remains, while instantly knowing same-kind tree locations and being required to end each turn outside a tree.',
        'Once on each turn for up to 1 minute with concentration, the caster can spend 5 feet of movement to enter a living tree at least their size and teleport to another living tree of the same kind within 500 feet, appearing within 5 feet of that destination tree or the original tree if no movement remains.'
      ]);
    });

    it('keeps route command ward and access wrappers tied to failure and exception facts', () => {
      const findThePath = getSpells(6).find(spell => spell.id === 'find-the-path');
      const geas = getSpells(5).find(spell => spell.id === 'geas');
      const guardsAndWards = getSpells(6).find(spell => spell.id === 'guards-and-wards');
      const knock = getSpells(2).find(spell => spell.id === 'knock');
      const findThePathDescriptions = findThePath?.effects.map(effect => effect.description) ?? [];
      const geasDescriptions = geas?.effects.map(effect => effect.description) ?? [];
      const guardsAndWardsDescriptions = guardsAndWards?.effects.map(effect => effect.description) ?? [];
      const knockDescriptions = knock?.effects.map(effect => effect.description) ?? [];

      // These wrappers are mostly routing and exception logic: where a path can
      // lead, what a command can demand, who a ward exempts, and which lock
      // states are affected. Their row text should expose those limits directly.
      expect(findThePathDescriptions).toEqual([
        'For up to 1 day with concentration, learn the shortest and most direct physical route to a familiar, specific, fixed location on the same plane; the spell fails for another-plane, moving, or nonspecific destinations, gives distance and direction while the caster remains on the destination plane, and chooses the shortest direct branch at path decisions without guaranteeing safety.'
      ]);
      expect(geasDescriptions).toEqual([
        'Give one visible creature within 60 feet that can understand you a verbal command to perform a service or avoid an activity for 30 days. On a failed Wisdom save, the target is Charmed, takes 5d10 Psychic damage no more than once each day when it acts directly against the command, ends the spell if given a suicidal command, can be freed by Remove Curse, Greater Restoration, or Wish, and higher slots extend the duration to 365 days at slots 7-8 or until ended at slot 9.',
        'On a failed Wisdom save, the target is Charmed for the 30-day base Geas duration, while a target that cannot understand the command automatically succeeds; higher slots extend the Charmed duration to 365 days at slots 7-8 or until ended at slot 9.'
      ]);
      expect(guardsAndWardsDescriptions).toEqual([
        'Create a 24-hour ward over up to 2,500 square feet of floor space, up to 20 feet tall and shapeable across contiguous areas the caster can walk through during casting; the caster can exempt specified individuals from any or all chosen effects, define a spoken password that grants immunity, and then apply the Guards and Wards effect package inside the warded area.'
      ]);
      expect(knockDescriptions).toEqual([
        'Choose one visible object within 60 feet that blocks access, such as a door, box, chest, manacles, padlock, or similar mundane or magical closure; one mundane lock, stuck state, or barred state becomes unlocked, unstuck, or unbarred, only one lock opens if there are multiple, Arcane Lock is suppressed for 10 minutes instead, and a loud knock is audible from up to 300 feet from the target.'
      ]);
    });

    it('keeps illusion soul and minor-effect wrappers tied to mode and cleanup facts', () => {
      const mislead = getSpells(5).find(spell => spell.id === 'mislead');
      const soulCage = getSpells(6).find(spell => spell.id === 'soul-cage');
      const prestidigitation = getSpells(0).find(spell => spell.id === 'prestidigitation');
      const misleadDescriptions = mislead?.effects.map(effect => effect.description) ?? [];
      const soulCageDescriptions = soulCage?.effects.map(effect => effect.description) ?? [];
      const prestidigitationDescriptions = prestidigitation?.effects.map(effect => effect.description) ?? [];

      // These wrappers are mode menus and lifecycle trackers. The row text
      // needs to preserve action costs, ending conditions, use limits, and
      // cleanup behavior so future UI can show the available choices directly.
      expect(misleadDescriptions).toEqual([
        'For up to 1 hour with concentration, the caster becomes Invisible while an illusory double appears in the caster space; the double lasts for the duration, the invisibility ends if the caster attacks or casts a spell, the caster can use a Magic action to move the double up to twice Speed and make it gesture, speak, or behave, and can use a Bonus Action each turn to switch between the double senses and their own, becoming Blinded and Deafened to their own surroundings while using the double senses.'
      ]);
      expect(soulCageDescriptions).toEqual([
        'Steal Life: the caster can use a Bonus Action to spend one trapped-soul use and regain 2d8 Hit Points.',
        'Trap the soul of a Humanoid dying within 60 feet in the tiny cage component for up to 8 hours; the soul remains until the spell ends, the cage is destroyed, or the sixth exploitation releases it, the trapped soul can be exploited up to six times, and the dead Humanoid cannot be revived while its soul is trapped.'
      ]);
      expect(prestidigitationDescriptions).toEqual([
        'Create one minor magical effect within 10 feet: a harmless sensory effect; light or snuff a candle, torch, or small campfire; clean or soil an object no larger than 1 cubic foot; chill, warm, or flavor up to 1 cubic foot of nonliving material for 1 hour; place a color, mark, or symbol on an object or surface for 1 hour; or create a hand-sized nonmagical trinket or illusory image until the end of the caster next turn.'
      ]);
    });

    it('keeps Forbiddance ward damage tied to area and creature families', () => {
      const forbiddance = getSpells(6).find(spell => spell.id === 'forbiddance');
      const forbiddanceDescriptions = forbiddance?.effects.map(effect => effect.description) ?? [];

      // This spell currently has one structured damage row. The description
      // should read like a ward effect in the game, not like a note about how
      // the importer modeled the row internally.
      expect(forbiddanceDescriptions).toEqual([
        'Ward up to 40,000 square feet for 1 day so Aberrations, Celestials, Elementals, Fey, Fiends, and Undead take 5d10 Radiant damage when they enter the warded area or start their turn there.'
      ]);
    });

    it('keeps phase barrier and plant portal wrappers tied to timing and travel facts', () => {
      const blink = getSpells(3).find(spell => spell.id === 'blink');
      const globe = getSpells(6).find(spell => spell.id === 'globe-of-invulnerability');
      const transportViaPlants = getSpells(6).find(spell => spell.id === 'transport-via-plants');
      const blinkDescriptions = blink?.effects.map(effect => effect.description) ?? [];
      const globeDescriptions = globe?.effects.map(effect => effect.description) ?? [];
      const transportViaPlantsDescriptions = transportViaPlants?.effects.map(effect => effect.description) ?? [];

      // These wrappers change where a creature can be affected from, which
      // spells can cross a barrier, and how creatures travel through plants.
      // The row text needs to name timing, boundaries, and cleanup placement.
      expect(blinkDescriptions).toEqual([
        'For 1 minute, roll 1d6 at the end of each caster turn; on 4-6, the caster vanishes to the Ethereal Plane unless already there, perceives the original plane in gray out to 60 feet, can affect and be affected only by Ethereal creatures, returns at the start of the next turn or when the spell ends to a visible unoccupied space within 10 feet of the departure space, or the nearest unoccupied space if none is available.'
      ]);
      expect(globeDescriptions).toEqual([
        'For up to 1 minute with concentration, spells of level 5 or lower cast from outside the 10-foot-radius barrier cannot affect creatures, objects, or areas inside it; higher slot levels raise the blocked spell level by 1 per slot level above 6.',
        'Create an immobile faintly shimmering 10-foot-radius barrier around the caster for up to 1 minute with concentration; eligible outside spells can still target creatures or objects inside, but they have no effect there, and the barrier excludes its interior from those spells area effects.'
      ]);
      expect(transportViaPlantsDescriptions).toEqual([
        'For 1 minute, any creature can spend 5 feet of movement to step into the target Large-or-larger inanimate plant within 10 feet and exit from a destination plant on the same plane that the caster has seen or touched before.',
        'Create a 1-minute magical link between a Large-or-larger inanimate plant within 10 feet and another plant at any distance on the same plane that the caster has seen or touched before; any creature can spend 5 feet of movement to enter the target plant and exit from the destination plant.'
      ]);
    });

    it('keeps Eyebite options tied to visible targets, repeat use, and option exits', () => {
      const eyebite = getSpells(6).find(spell => spell.id === 'eyebite');
      const eyebiteDescriptions = eyebite?.effects.map(effect => effect.description) ?? [];

      // Eyebite is self-targeted at cast time, but each option affects a visible
      // creature within 60 feet and has a different ending rule. The text row
      // must keep those runtime/UI facts visible instead of hiding them in the
      // copied spell wrapper.
      expect(eyebiteDescriptions).toEqual([
        'Asleep option: on a failed Wisdom save, one visible creature within 60 feet becomes Unconscious until it takes damage or another creature uses an action to shake it awake.',
        'Panicked option: on a failed Wisdom save, one visible creature within 60 feet is Frightened of you, must Dash away by the safest shortest route on each turn while possible, and the effect ends if it reaches a space at least 60 feet away where it cannot see you.',
        'Sickened option: on a failed Wisdom save, one visible creature within 60 feet has Disadvantage on attack rolls and ability checks, then repeats the Wisdom save at the end of each of its turns and ends the effect on a success.',
        'For up to 1 minute with concentration, your eyes become inky voids. On the initial cast and again with a Magic action on later turns, choose Asleep, Panicked, or Sickened for one visible creature within 60 feet; a creature that succeeds on a Wisdom save against this casting cannot be targeted by it again.'
      ]);
    });

    it('keeps Slow status row tied to each action-economy and defense penalty', () => {
      const slow = getSpells(3).find(spell => spell.id === 'slow');
      const slowEffect = Array.isArray(slow?.effects) ? slow?.effects[0] : slow?.effects;

      // Slow's one status row is what combat logs and condition badges can show.
      // It needs to spell out every penalty instead of grouping several runtime
      // constraints under broad phrases such as "limited action economy".
      expect(slowEffect?.description).toBe('On a failed Wisdom save, each affected creature becomes Slowed for up to 1 minute with concentration. While Slowed, Speed is halved, AC and Dexterity saves take a -2 penalty, Reactions are unavailable, the target can take either an action or a Bonus Action but not both, only one attack can be made with the Attack action, Somatic spells have a 25 percent failure chance, and the target repeats the Wisdom save at the end of each turn to end the effect on itself.');
    });

    it('keeps Weird fear rows tied to repeat saves and psychic pressure', () => {
      const weird = getSpells(9).find(spell => spell.id === 'weird');
      const weirdDescriptions = weird?.effects.map(effect => effect.description) ?? [];

      // Weird has separate rows for the initial psychic blast, the Frightened
      // condition, the failed-repeat-save damage, and the illusion wrapper.
      // The condition row needs to name its own repeat-save exit so the status
      // badge can explain how a target escapes the fear.
      expect(weirdDescriptions).toEqual([
        'Targets make a Wisdom save, taking 10d10 Psychic damage on a failed save or half as much on a success.',
        'On a failed Wisdom save, the target is Frightened for up to 1 minute with concentration and repeats the Wisdom save at the end of each of its turns, ending the spell on itself on a success.',
        'A target still Frightened by Weird takes 5d10 Psychic damage when it fails the end-turn repeat Wisdom save.',
        'Create illusory terrors in the minds of chosen creatures in a 30-foot-radius sphere within 120 feet for up to 1 minute with concentration. Affected creatures resolve Wisdom saves for the initial terror and for end-turn repeat pressure, with the spell ending on a target that succeeds on its repeat save.'
      ]);
    });

    it('keeps Darkness row tied to origin mode, light blocking, and dispel facts', () => {
      const darkness = getSpells(2).find(spell => spell.id === 'darkness');
      const darknessEffect = Array.isArray(darkness?.effects) ? darkness?.effects[0] : darkness?.effects;

      // Darkness is a visibility spell first, so the single row needs to tell
      // map/UI readers exactly where the darkness comes from, what sight and
      // light rules it changes, and how the object-origin version can be
      // covered or suppress lower-level magical light.
      expect(darknessEffect?.description).toBe('Magical Darkness fills a 15-foot-radius Sphere from a point within 60 feet for up to 10 minutes with concentration, or fills a 15-foot Emanation from an unattended object. Darkvision cannot see through it, nonmagical light cannot illuminate it, opaque cover blocks an object-origin Darkness, and overlapping Bright Light or Dim Light from a spell of level 2 or lower is dispelled.');
    });

    it('keeps Heroes Feast rows focused on feast benefits instead of runtime debt', () => {
      const heroesFeast = getSpells(6).find(spell => spell.id === 'heroes-feast');
      const heroesFeastDescriptions = heroesFeast?.effects.map(effect => effect.description) ?? [];

      // Heroes' Feast has separate rows for healing, Poison resistance,
      // condition immunity, and feast setup. The healing row should tell the
      // player what changes after partaking instead of exposing implementation
      // debt about a missing hit-point-maximum field.
      expect(heroesFeastDescriptions).toEqual([
        'A creature that partakes gains 2d10 Hit Point maximum increase and regains the same number of Hit Points for 24 hours.',
        'A creature that partakes has Resistance to Poison damage for 24 hours.',
        'A creature that partakes has Immunity to the Frightened and Poisoned conditions for 24 hours.',
        'Conjure a feast on a surface in an unoccupied 10-foot Cube next to the caster; up to twelve creatures can spend 1 hour eating it, the feast disappears at the end of that hour, and the benefits begin only after the hour is complete.'
      ]);
    });

    it('keeps Gentle Repose row focused on corpse protection and resurrection timing', () => {
      const gentleRepose = getSpells(2).find(spell => spell.id === 'gentle-repose');
      const gentleReposeEffect = Array.isArray(gentleRepose?.effects) ? gentleRepose?.effects[0] : gentleRepose?.effects;

      // Gentle Repose is intentionally one utility row, but that row still
      // needs to read like a playable corpse/remains protection effect rather
      // than copied spell-card prose.
      expect(gentleReposeEffect?.description).toBe('Touch a corpse or other remains for 10 days; the target is protected from decay, cannot become Undead, and days spent under this spell do not count against time limits for raising the target from the dead.');
    });

    it('keeps Sunbeam rows tied to reusable line damage, blindness, and sunlight facts', () => {
      const sunbeam = getSpells(6).find(spell => spell.id === 'sunbeam');
      const sunbeamDescriptions = sunbeam?.effects.map(effect => effect.description) ?? [];

      // Sunbeam is a reusable line spell with separate damage, short-lived
      // blindness, and sunlight rows. The text below keeps those player-facing
      // facts separate so runtime logs and UI rows do not need to explain the
      // importer concept of recreating an effect line.
      expect(sunbeamDescriptions).toEqual([
        'Each creature in the 5-foot-wide, 60-foot line makes a Constitution save, taking 6d8 Radiant damage on a failed save or half as much on a success.',
        'On a failed Constitution save against the Sunbeam line, the target is Blinded until the start of the caster\'s next turn.',
        'For up to 1 minute with concentration, bright sunlight shines from the caster in a 30-foot radius and dim sunlight for an additional 30 feet; the caster can use an action on later turns to project the 5-foot-wide, 60-foot line again.'
      ]);
    });

    it('keeps Telekinesis creature-control row tied to repeat action, movement, and suspension facts', () => {
      const telekinesis = getSpells(5).find(spell => spell.id === 'telekinesis');
      const telekinesisEffect = Array.isArray(telekinesis?.effects) ? telekinesis?.effects[0] : telekinesis?.effects;

      // Telekinesis currently has one structured creature-control status row.
      // That row should still carry the repeat Magic action, movement, and
      // suspension facts that make the spell interpretable in runtime logs.
      expect(telekinesisEffect?.description).toBe('For up to 10 minutes with concentration, the caster can use a Magic action each turn to affect one Huge or smaller creature or object within 60 feet: failed Strength saves let the caster move and Restrain creatures until the end of the caster\'s next turn, unattended objects move automatically, worn or carried objects can be pulled free on a failed save, and simple objects can be finely manipulated.');
    });

    it('keeps Investiture of Wind flight row player-facing instead of exposing movement-mode debt', () => {
      const investitureOfWind = getSpells(6).find(spell => spell.id === 'investiture-of-wind');
      const flightEffect = investitureOfWind?.effects.find(effect => (
        effect.type === 'MOVEMENT'
        && effect.movementType === 'speed_change'
      ));

      // Investiture of Wind has a real structured cleanup note for falling
      // when the spell ends. The visible effect row should explain that flight
      // benefit, not expose the missing internal movement-mode field.
      expect(flightEffect?.description).toBe('For up to 10 minutes with concentration, the caster gains a 60-foot Fly Speed; if the spell ends while the caster is still flying, the caster falls unless another effect prevents the fall.');
    });

    it('keeps Wind Wall rows tied to wall damage and projectile barrier facts', () => {
      const windWall = getSpells(3).find(spell => spell.id === 'wind-wall');
      const windWallDescriptions = windWall?.effects.map(effect => effect.description) ?? [];

      // Wind Wall has one impact-damage row and one barrier-control row. The
      // descriptions should make the wall dimensions and barrier exceptions
      // readable in combat logs without repeating the full spell card.
      expect(windWallDescriptions).toEqual([
        'When the 50-foot-long, 15-foot-high, 1-foot-thick wall appears, each creature in its area makes a Strength save, taking 4d8 Bludgeoning damage on a failed save or half as much on a success.',
        'For up to 1 minute with concentration, the wall keeps fog, smoke, gases, gaseous creatures, Small or smaller flying creatures or objects, and loose lightweight materials from passing normally; ordinary arrows, bolts, and similar projectiles aimed through it miss automatically, while giant boulders, siege projectiles, and similar heavy projectiles are unaffected.'
      ]);
    });

    it('keeps Rary Telepathic Bond row tied to target gate, duration, and same-plane communication', () => {
      const telepathicBond = getSpells(5).find(spell => spell.id === 'rarys-telepathic-bond');
      const telepathicBondEffect = Array.isArray(telepathicBond?.effects) ? telepathicBond?.effects[0] : telepathicBond?.effects;

      // Rary's Telepathic Bond is a single communication row. The row should
      // match the current structured targeting gate and stand alone in logs:
      // who can be linked, how long the bond lasts, and where it can reach.
      expect(telepathicBondEffect?.description).toBe('Link up to eight willing creatures within 30 feet for 1 hour; creatures with Intelligence 2 or lower are unaffected, and linked targets can communicate telepathically with every other linked target over any distance on the same plane without sharing a language.');
    });

    it('keeps Clairvoyance row focused on sensor placement, sense choice, and visibility exception', () => {
      const clairvoyance = getSpells(3).find(spell => spell.id === 'clairvoyance');
      const clairvoyanceEffect = Array.isArray(clairvoyance?.effects) ? clairvoyance?.effects[0] : clairvoyance?.effects;

      // Clairvoyance is one sensor utility row. The row should summarize the
      // placement gate, 10-minute concentration duration, sense mode, Bonus
      // Action switch, and See Invisibility or Truesight exception without
      // copying the full spell card into the effect description.
      expect(clairvoyanceEffect?.description).toBe('Create an invisible, intangible, invulnerable sensor within 1 mile for up to 10 minutes with concentration, placed in a familiar location or an obvious unfamiliar one; choose sight or hearing through the sensor, switch senses as a Bonus Action, and creatures with See Invisibility or Truesight see it as a fist-sized luminous orb.');
    });

    it('keeps Word of Recall rows split between sanctuary teleport and preparation rules', () => {
      const wordOfRecall = getSpells(6).find(spell => spell.id === 'word-of-recall');
      const wordOfRecallDescriptions = wordOfRecall?.effects.map(effect => effect.description) ?? [];

      // Word of Recall has one movement row for the actual teleport and one
      // utility row for the sanctuary prerequisite. Keeping those facts split
      // makes combat logs clearer than repeating the whole spell card twice.
      expect(wordOfRecallDescriptions).toEqual([
        'The caster and up to five willing creatures within 5 feet instantly teleport to the previously designated sanctuary and appear in the nearest unoccupied spaces to the prepared spot.',
        'If no sanctuary has been prepared, the spell has no effect; the caster prepares a sanctuary by casting Word of Recall at that location, such as a temple.'
      ]);
    });

    it('keeps Primordial Ward rows split between resistance, reaction immunity, and ending facts', () => {
      const primordialWard = getSpells(6).find(spell => spell.id === 'primordial-ward');
      const primordialWardDescriptions = primordialWard?.effects.map(effect => effect.description) ?? [];

      // Primordial Ward already has separate defensive rows for broad
      // resistance and the reaction immunity. The utility row should only carry
      // the state transition caused by spending that reaction.
      expect(primordialWardDescriptions).toEqual([
        'The caster has resistance to Acid, Cold, Fire, Lightning, and Thunder damage for up to 1 minute with concentration.',
        'When the caster takes Acid, Cold, Fire, Lightning, or Thunder damage, the caster can use a reaction to gain immunity to that triggering damage type, including against the triggering damage, until the end of the caster\'s next turn.',
        'Using the reaction immunity ends the spell\'s Acid, Cold, Fire, Lightning, and Thunder resistances immediately, and the spell ends when the chosen immunity ends at the end of the caster\'s next turn.'
      ]);
    });

    it('keeps Daylight row tied to range, duration, object origin, and darkness dispel facts', () => {
      const daylight = getSpells(3).find(spell => spell.id === 'daylight');
      const daylightEffect = Array.isArray(daylight?.effects) ? daylight?.effects[0] : daylight?.effects;

      // Daylight is one light-control row. The description should include the
      // range and duration facts from the structured spell data as well as the
      // object-origin and lower-level magical-Darkness interaction.
      expect(daylightEffect?.description).toBe('For 1 hour, sunlight fills a 60-foot-radius Sphere from a point within 60 feet, creating Bright Light and shedding Dim Light for an additional 60 feet; alternatively, it can originate from an object that is not worn or carried, opaque cover blocks that object-origin sunlight, and overlap with magical Darkness from a spell of level 3 or lower dispels that Darkness.');
    });

    it('keeps Aura of Life wrapper separate from resistance, maximum, and healing payload rows', () => {
      const auraOfLife = getSpells(4).find(spell => spell.id === 'aura-of-life');
      const auraOfLifeDescriptions = auraOfLife?.effects.map(effect => effect.description) ?? [];

      // Aura of Life has sibling rows for Necrotic resistance, hit point
      // maximum protection, and 0-HP recovery. The utility wrapper should only
      // describe the moving aura shell so those payload rows remain distinct.
      expect(auraOfLifeDescriptions).toEqual([
        'For up to 10 minutes with concentration, life-preserving energy radiates from the caster in a 30-foot aura that moves with the caster and affects nonhostile creatures in the aura.',
        'For up to 10 minutes with concentration, nonhostile creatures in the 30-foot aura, including the caster, have Resistance to Necrotic damage.',
        'For up to 10 minutes with concentration, nonhostile creatures in the 30-foot aura cannot have their Hit Point maximum reduced.',
        'A nonhostile living creature regains 1 Hit Point when it starts its turn in the 30-foot aura with 0 Hit Points.'
      ]);
    });

    it('keeps Dispel Magic row tied to target categories, range, spell-level gate, and higher-slot auto end', () => {
      const dispelMagic = getSpells(3).find(spell => spell.id === 'dispel-magic');
      const dispelMagicEffect = Array.isArray(dispelMagic?.effects) ? dispelMagic?.effects[0] : dispelMagic?.effects;

      // Dispel Magic is one utility row. The row should include the target
      // categories, range, automatic ending threshold, higher-level check DC,
      // and higher-slot auto-ending rule so the runtime row stands alone.
      expect(dispelMagicEffect?.description).toBe('Choose one creature, object, or magical effect within 120 feet; ongoing spells of 3rd level or lower on the target end automatically, each ongoing spell of 4th level or higher ends on a spellcasting ability check against DC 10 + that spell level, and a higher-level slot automatically ends spells on the target whose level is no higher than the slot used.');
    });

    it('keeps Create Food and Water row tied to quantities, range, capacity, and spoilage facts', () => {
      const createFoodAndWater = getSpells(3).find(spell => spell.id === 'create-food-and-water');
      const createFoodAndWaterEffect = Array.isArray(createFoodAndWater?.effects) ? createFoodAndWater?.effects[0] : createFoodAndWater?.effects;

      // Create Food and Water is a single provisioning row. The row should
      // expose exact quantities, range, sustainment capacity, and spoilage so
      // survival-facing UI does not need to reopen the full spell card.
      expect(createFoodAndWaterEffect?.description).toBe('Create 45 pounds of bland nourishing food and 30 gallons of clean fresh water on the ground or in containers within 30 feet; the supplies sustain up to fifteen Humanoids or five steeds for 24 hours, the food spoils if uneaten after 24 hours, and the water does not spoil.');
    });

    it('keeps Leomund Tiny Hut row tied to shelter boundary, entry, spell-blocking, and comfort facts', () => {
      const tinyHut = getSpells(3).find(spell => spell.id === 'leomunds-tiny-hut');
      const tinyHutEffect = Array.isArray(tinyHut?.effects) ? tinyHut?.effects[0] : tinyHut?.effects;

      // Leomund's Tiny Hut is one shelter utility row. The row should keep
      // the boundary, who can pass, what is blocked, and the interior comfort
      // facts visible for runtime logs without copying the full spell card.
      expect(tinyHutEffect?.description).toBe('Create a stationary 10-foot-radius shelter around the caster for 8 hours; creatures and objects inside when cast can pass through freely, all others are barred, spells of 3rd level or lower cannot cross the boundary, and the interior stays dry and comfortable with caster-chosen dim light or darkness.');
    });

    it('keeps Dissonant Whispers rows tied to psychic damage and reaction movement facts', () => {
      const dissonantWhispers = getSpells(1).find(spell => spell.id === 'dissonant-whispers');
      const damageRow = dissonantWhispers?.effects[0];
      const movementRow = dissonantWhispers?.effects[1];

      // Dissonant Whispers splits save-half Psychic damage from failed-save
      // reaction movement. The movement row should keep immediate timing, the
      // visible 60-foot target gate, reaction availability, maximum distance,
      // and safest-route instruction visible without relying on the top-level
      // prose or movement metadata.
      expect(damageRow?.description).toBe('One target within 60 feet makes a Wisdom save against 3d6 Psychic damage, taking half damage on a success; damage increases by 1d6 per slot level above 1st.');
      expect(movementRow?.description).toBe('On a failed Wisdom save, the visible target within 60 feet must immediately use its Reaction, if available, to move as far away from the caster as it can up to its Speed by the safest route.');
    });

    it('keeps Ensnaring Strike rows tied to save advantage, restraint, escape, and vine damage facts', () => {
      const ensnaringStrike = getSpells(1).find(spell => spell.id === 'ensnaring-strike');
      const restrainedRow = ensnaringStrike?.effects[0];
      const damageRow = ensnaringStrike?.effects[1];

      // Ensnaring Strike splits the failed-save Restrained rider from the
      // start-turn vine damage. The status row should carry the size-based save
      // Advantage, successful-save ending, and action escape facts so the
      // control contract remains visible when the damage row is not shown.
      expect(restrainedRow?.description).toBe('When the triggering weapon hit lands, the target makes a Strength save with Advantage if it is Large or larger; on a failure it is Restrained for up to 1 minute with concentration, on a success the vines shrivel and the spell ends, and the target or a creature within reach can use an action for a Strength (Athletics) check against the spell save DC to end the spell.');
      expect(damageRow?.description).toBe('A restrained target takes 1d6 Piercing damage from the conjured vines, increasing by 1d6 per slot level above 1st.');
    });

    it('keeps Catapult rows tied to object eligibility, line travel, collision, and damage facts', () => {
      const catapult = getSpells(1).find(spell => spell.id === 'catapult');
      const damageRow = catapult?.effects[0];
      const utilityRow = catapult?.effects[1];

      // Catapult separates collision damage from object travel. The utility row
      // should keep object eligibility, range, weight scaling, straight-line
      // travel, fall-to-ground behavior, and collision stopping visible so the
      // object-control contract is not hidden behind the damage row.
      expect(damageRow?.description).toBe('A hurled object travels through a 90-foot line and deals 3d8 Bludgeoning damage to the first target that fails a Dexterity save; damage increases by 1d8 per slot level above 1st.');
      expect(utilityRow?.description).toBe('Choose one object within 60 feet weighing 1 to 5 pounds that is not worn or carried; the maximum target weight increases by 5 pounds per slot level above 1, the object flies up to 90 feet in a straight line before falling, stops early if it impacts a solid surface or a creature that fails the Dexterity save, and the object plus whatever it strikes each take the collision damage.');
    });

    it('keeps Arms of Hadar rows tied to emanation damage and reaction suppression facts', () => {
      const armsOfHadar = getSpells(1).find(spell => spell.id === 'arms-of-hadar');
      const damageRow = armsOfHadar?.effects[0];
      const reactionSuppressionRow = armsOfHadar?.effects[1];

      // Arms of Hadar splits save-half Necrotic damage from the failed-save
      // reaction denial rider. The rider row should name the same 10-foot
      // Emanation and Strength save context plus the start-of-next-turn expiry
      // so combat logs do not turn the rider into a vague one-round status.
      expect(damageRow?.description).toBe('Creatures in the 10-foot emanation make a Strength save against 2d6 Necrotic damage, taking half damage on a success; damage increases by 1d6 per slot level above 1st.');
      expect(reactionSuppressionRow?.description).toBe('Creatures in the 10-foot Emanation that fail the Strength save cannot take Reactions until the start of their next turn.');
    });

    it('keeps Hellish Rebuke row tied to visible damage-triggering creature and save-half fire facts', () => {
      const hellishRebuke = getSpells(1).find(spell => spell.id === 'hellish-rebuke');
      const damageRow = hellishRebuke?.effects[0];

      // Hellish Rebuke is a reaction spell. The single damage row should name
      // the visible creature that damaged the caster, the 60-foot reaction gate,
      // save-half Fire damage, and slot scaling so combat logs do not reduce
      // the reaction target to a vague "triggering target."
      expect(damageRow?.description).toBe('When a visible creature within 60 feet damages the caster, that creature makes a Dexterity save against 2d10 Fire damage, taking half damage on a success; damage increases by 1d10 per slot level above 1st.');
    });

    it('keeps Burning Hands row tied to cone damage, save-half, scaling, and object ignition facts', () => {
      const burningHands = getSpells(1).find(spell => spell.id === 'burning-hands');
      const damageRow = burningHands?.effects[0];

      // Burning Hands has one visible area-damage row. That row should include
      // the flammable-object ignition rider from the spell card because there
      // is no sibling utility row to show the object consequence separately.
      expect(damageRow?.description).toBe('Creatures in the 15-foot Cone make a Dexterity save against 3d6 Fire damage, taking half damage on a success; flammable objects in the Cone that are not worn or carried start burning, and damage increases by 1d6 per slot level above 1st.');
    });

    it('keeps Frostbite row tied to visible target, cold damage, weapon-attack penalty, and cantrip scaling', () => {
      const frostbite = getSpells(0).find(spell => spell.id === 'frostbite');
      const effectRow = frostbite?.effects[0];

      // Frostbite combines damage and an attack-roll penalty in one row. The
      // row should name the damage dice, target gate, penalty duration, and
      // cantrip scaling so logs do not reduce the damage payload to "cold
      // damage" without the modeled dice.
      expect(effectRow?.description).toBe('One visible creature within 60 feet that fails the Constitution save takes 1d6 Cold damage and has Disadvantage on the next weapon attack roll it makes before the end of its next turn; damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
    });

    it('keeps Poison Spray row tied to ranged spell hit, poison damage, and cantrip scaling', () => {
      const poisonSpray = getSpells(0).find(spell => spell.id === 'poison-spray');
      const damageRow = poisonSpray?.effects[0];

      // Poison Spray is a single attack cantrip row. It should read as a
      // player-facing ranged spell hit, not as importer-facing "hit-based
      // damage effect" plumbing.
      expect(damageRow?.description).toBe('One creature within 30 feet takes 1d12 Poison damage on a ranged spell hit; damage increases to 2d12 at level 5, 3d12 at level 11, and 4d12 at level 17.');
    });

    it('keeps Fire Bolt row tied to ranged hit, object ignition, and cantrip scaling facts', () => {
      const fireBolt = getSpells(0).find(spell => spell.id === 'fire-bolt');
      const damageRow = fireBolt?.effects[0];

      // Fire Bolt can target creatures or objects. The single row should carry
      // both the creature/object damage contract and the flammable-object
      // ignition rider because there is no sibling utility row for object state.
      expect(damageRow?.description).toBe('One creature or object within 120 feet takes 1d10 Fire damage on a ranged spell hit; a flammable object hit by the spell starts burning if it is not worn or carried, and damage increases to 2d10 at level 5, 3d10 at level 11, and 4d10 at level 17.');
    });

    it('keeps Acid Splash row tied to point placement, sphere damage, save, and cantrip scaling facts', () => {
      const acidSplash = getSpells(0).find(spell => spell.id === 'acid-splash');
      const damageRow = acidSplash?.effects[0];

      // Acid Splash is a small area cantrip. The row should name the point
      // placement range and exact scaling tiers so the area damage is readable
      // without reopening the top-level spell text.
      expect(damageRow?.description).toBe('Create an acidic burst at a point within 60 feet; creatures in the 5-foot-radius Sphere make a Dexterity save, taking 1d6 Acid damage on a failure, and damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
    });

    it('keeps Mind Sliver damage row tied to visible target, intelligence save, psychic damage, and cantrip scaling', () => {
      const mindSliver = getSpells(0).find(spell => spell.id === 'mind-sliver');
      const damageRow = mindSliver?.effects[0];

      // Mind Sliver's utility row already owns the next-save penalty. The
      // damage row should still stand alone with the visible target gate, save
      // type, exact Psychic dice, and cantrip scaling tiers.
      expect(damageRow?.description).toBe('One visible creature within 60 feet that fails the Intelligence save takes 1d6 Psychic damage; damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
    });

    it('keeps Toll the Dead row tied to visible target, bell sound, wounded dice, and cantrip scaling', () => {
      const tollTheDead = getSpells(0).find(spell => spell.id === 'toll-the-dead');
      const damageRow = tollTheDead?.effects[0];

      // Toll the Dead is a single-row damage cantrip with an important wounded
      // target dice switch. The row should also keep the audible bell rider
      // visible because it affects stealth/log feedback even when damage is the
      // only structured effect row.
      expect(damageRow?.description).toBe('One visible creature within 60 feet hears a dolorous bell audible within 10 feet and makes a Wisdom save; on a failure it takes 1d8 Necrotic damage, or 1d12 Necrotic damage if it is missing any Hit Points, and damage increases to 2 dice at level 5, 3 dice at level 11, and 4 dice at level 17.');
    });

    it('keeps Starry Wisp rows tied to ranged hit damage, reveal light, invisibility denial, and scaling', () => {
      const starryWisp = getSpells(0).find(spell => spell.id === 'starry-wisp');
      const damageRow = starryWisp?.effects[0];
      const revealRow = starryWisp?.effects[1];

      // Starry Wisp splits Radiant damage from the reveal rider. The rows
      // should share the same ranged-hit target context so the light/Invisibility
      // rider is readable on its own in logs or effect lists.
      expect(damageRow?.description).toBe('One creature or object within 60 feet takes 1d8 Radiant damage on a ranged spell hit; damage increases to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.');
      expect(revealRow?.description).toBe('On the same ranged spell hit, the target sheds Dim Light in a 10-foot radius and cannot benefit from the Invisible condition until the end of the caster\'s next turn.');
    });

    it('keeps Sacred Flame row tied to visible target, cover bypass, radiant damage, and cantrip scaling', () => {
      const sacredFlame = getSpells(0).find(spell => spell.id === 'sacred-flame');
      const damageRow = sacredFlame?.effects[0];

      // Sacred Flame's key differentiator is its cover-bypass save. The row
      // should expose Half Cover and Three-Quarters Cover bypass alongside
      // damage dice and scaling so runtime logs show why this save is special.
      expect(damageRow?.description).toBe('One visible creature within 60 feet makes a Dexterity save that gains no benefit from Half Cover or Three-Quarters Cover; on a failure it takes 1d8 Radiant damage, and damage increases to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.');
    });

    it('keeps self-centered cantrip area rows tied to save gates, riders, and exact scaling', () => {
      const swordBurst = getSpells(0).find(spell => spell.id === 'sword-burst');
      const thunderclap = getSpells(0).find(spell => spell.id === 'thunderclap');
      const wordOfRadiance = getSpells(0).find(spell => spell.id === 'word-of-radiance');

      // These self-centered cantrips have similar save-and-scale damage rows,
      // but each row needs its own runtime/UI facts: "other creatures" for
      // Sword Burst, audible thunder for Thunderclap, and chosen visible
      // creature selection for Word of Radiance.
      expect(swordBurst?.effects[0]?.description).toBe('Other creatures within 5 feet of the caster make a Dexterity save; on a failure they take 1d6 Force damage, and damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
      expect(thunderclap?.effects[0]?.description).toBe('Creatures in the 5-foot Emanation originating from the caster make a Constitution save; on a failure they take 1d6 Thunder damage, the thunderous sound can be heard up to 100 feet away, and damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
      expect(wordOfRadiance?.effects[0]?.description).toBe('Chosen visible creatures in the 5-foot Emanation make a Constitution save; on a failure they take 1d6 Radiant damage, and damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
    });

    it('keeps Melf\'s Minute Meteors rows tied to meteor expenditure and explosion damage', () => {
      const minuteMeteors = getSpells(3).find(spell => spell.id === 'melfs-minute-meteors');
      const damageRow = minuteMeteors?.effects[0];
      const utilityRow = minuteMeteors?.effects[1];

      // Melf's Minute Meteors is a two-row mechanics spell: one row describes
      // the explosion damage and one row describes spending stored meteors.
      // Both rows need enough context for logs/UI to explain the delayed,
      // repeatable Bonus Action flow without collapsing into top-level prose.
      expect(damageRow?.description).toBe('When an expended meteor reaches its destination or hits a solid surface, each creature within 5 feet of the explosion point makes a Dexterity save, taking 2d6 Fire damage on a failure or half as much on a success.');
      expect(utilityRow?.description).toBe('When the spell is cast and as a Bonus Action on each later turn, the caster can expend one or two of the six orbiting meteors, sending them to one or two points within 120 feet; each meteor explodes when it reaches its destination or hits a solid surface.');
    });

    it('keeps hit-chained smite and vine rows tied to their triggering attacks', () => {
      const blindingSmite = getSpells(3).find(spell => spell.id === 'blinding-smite');
      const graspingVine = getSpells(4).find(spell => spell.id === 'grasping-vine');

      // These rows should describe the player-facing hit chain, not importer
      // plumbing. Blinding Smite's damage is the strike's extra damage, while
      // Grasping Vine's pull is part of the vine's melee spell attack package.
      expect(blindingSmite?.effects[0]?.description).toBe('The triggering weapon hit deals an extra 3d8 Radiant damage to the target, and each slot level above 3 adds +1d8 damage.');
      expect(graspingVine?.effects[2]?.description).toBe('On a melee spell attack hit from the vine, the target is pulled up to 30 feet toward the vine.');
    });

    it('keeps primal and produced flame cantrip attack rows tied to target gates and exact scaling', () => {
      const primalSavagery = getSpells(0).find(spell => spell.id === 'primal-savagery');
      const produceFlame = getSpells(0).find(spell => spell.id === 'produce-flame');

      // These cantrips both hinge on attack rows rather than saves. The row
      // text should expose the creature/object target gates, action context,
      // and exact character-level scaling so runtime logs are not vague.
      expect(primalSavagery?.effects[0]?.description).toBe('One creature within 5 feet takes 1d10 Acid damage on a melee spell hit; damage increases to 2d10 at level 5, 3d10 at level 11, and 4d10 at level 17.');
      expect(produceFlame?.effects[0]?.description).toBe('The held flame sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet, emits no heat, ignites nothing, and ends if the caster casts this spell again.');
      expect(produceFlame?.effects[1]?.description).toBe('Until the spell ends, the caster can take a Magic action to hurl the flame at one creature or object within 60 feet; on a ranged spell hit, the target takes 1d8 Fire damage, and damage increases to 2d8 at level 5, 3d8 at level 11, and 4d8 at level 17.');
    });

    it('keeps cantrip weapon and pull wrappers tied to attacker ability and attack type facts', () => {
      const magicStone = getSpells(0).find(spell => spell.id === 'magic-stone');
      const thornWhip = getSpells(0).find(spell => spell.id === 'thorn-whip');
      const trueStrike = getSpells(0).find(spell => spell.id === 'true-strike');

      // Magic Stone and True Strike are utility wrappers for later attacks,
      // while Thorn Whip splits damage and pull rows. Each description should
      // expose who attacks, which ability is substituted, and which hit type
      // drives the visible row.
      expect(magicStone?.effects[0]?.description).toBe('Imbue up to 3 pebbles; you or another creature can throw one as a ranged spell attack at 60 feet or sling it at normal range, using the caster\'s spellcasting ability for the attack roll and dealing 1d6 plus the caster\'s spellcasting ability modifier Bludgeoning damage on a hit. Hit or miss, that pebble\'s magic ends, and recasting ends any remaining pebbles early.');
      expect(thornWhip?.effects[0]?.description).toBe('One creature within 30 feet takes 1d6 Piercing damage on a melee spell hit; damage increases to 2d6 at level 5, 3d6 at level 11, and 4d6 at level 17.');
      expect(thornWhip?.effects[1]?.description).toBe('On the same melee spell hit, a Large or smaller target can be pulled up to 10 feet toward the caster.');
      expect(trueStrike?.effects[0]?.description).toBe('Make one weapon attack with the weapon used in the casting, using the caster\'s spellcasting ability for both the attack and damage rolls instead of Strength or Dexterity; if the attack deals damage, it can deal Radiant damage or the weapon\'s normal damage type, with extra Radiant damage increasing to 1d6 at level 5, 2d6 at level 11, and 3d6 at level 17.');
    });

    it('keeps level-three area lightning and fire rows tied to geometry, saves, and reuse facts', () => {
      const fireball = getSpells(3).find(spell => spell.id === 'fireball');
      const lightningBolt = getSpells(3).find(spell => spell.id === 'lightning-bolt');
      const callLightning = getSpells(3).find(spell => spell.id === 'call-lightning');

      // These level-three staples should not read as generic "Deals X"
      // damage rows. Their descriptions need geometry, save-half outcomes,
      // slot scaling, and Call Lightning's reusable Magic action context.
      expect(fireball?.effects[0]?.description).toBe('Each creature in a 20-foot-radius Sphere centered on a point within 150 feet makes a Dexterity save, taking 8d6 Fire damage on a failure or half as much on a success; flammable objects in the area that are not worn or carried start burning, and each slot level above 3 adds +1d6 damage.');
      expect(lightningBolt?.effects[0]?.description).toBe('Each creature in a 100-foot-long, 5-foot-wide Line from the caster makes a Dexterity save, taking 8d6 Lightning damage on a failure or half as much on a success; each slot level above 3 adds +1d6 damage.');
      expect(callLightning?.effects[0]?.description).toBe('Choose a visible point under the storm cloud; each creature within 5 feet of that point makes a Dexterity save, taking 3d10 Lightning damage on a failure or half as much on a success. Outdoor storm control adds +1d10 damage, and each slot level above 3 adds +1d10 damage.');
      expect(callLightning?.effects[1]?.description).toBe('For up to 10 minutes with concentration, you can use a Magic action on later turns to call lightning again at the same point or a different point under the storm cloud.');
    });

    it('keeps high-level full-heal rows tied to restoration scope and condition cleanup', () => {
      const trueResurrection = getSpells(9).find(spell => spell.id === 'true-resurrection');
      const powerWordHeal = getSpells(9).find(spell => spell.id === 'power-word-heal');

      // These spells already have utility/movement rows, but the HEALING rows
      // are often the first row shown in effect lists. They should carry the
      // target gate and full restoration contract instead of only "all HP".
      expect(trueResurrection?.effects[0]?.description).toBe('Touch a creature dead no longer than 200 years and not from old age; it is revived with all Hit Points, wounds closed, poison neutralized, magical contagions cured, curses present at death lifted, damaged or missing organs and limbs restored, and Undead form restored to non-Undead form.');
      expect(powerWordHeal?.effects[0]?.description).toBe('One visible creature within 60 feet regains all Hit Points, ends Charmed, Frightened, Paralyzed, Poisoned, and Stunned if present, and if Prone can use its Reaction to stand up.');
    });

    it('keeps Otiluke resilient sphere defensive row tied to damage immunity and Disintegrate exception', () => {
      const resilientSphere = getSpells(4).find(spell => spell.id === 'otilukes-resilient-sphere');
      const defensiveRow = resilientSphere?.effects[1];

      // The wrapper row explains the sphere boundary, but the DEFENSIVE row is
      // what exposes barrier immunity. It should also carry the Disintegrate
      // exception so immunity is not displayed as absolute.
      expect(defensiveRow?.description).toBe('The sphere itself is immune to all damage, but a Disintegrate spell targeting the globe destroys the sphere without harming anything inside.');
    });

    it('keeps level-three generic damage rows tied to placement, geometry, and teleport context', () => {
      const conjureBarrage = getSpells(3).find(spell => spell.id === 'conjure-barrage');
      const eruptingEarth = getSpells(3).find(spell => spell.id === 'erupting-earth');
      const thunderStep = getSpells(3).find(spell => spell.id === 'thunder-step');

      // These rows should expose why the save damage happens: chosen visible
      // creatures in a Cone, a ground-point Cube that leaves terrain behind,
      // and a thunder burst at the space the caster teleported away from.
      expect(conjureBarrage?.effects[0]?.description).toBe('Each chosen creature the caster can see in the self-originating 60-foot Cone makes a Dexterity save, taking 5d8 Force damage on a failure or half as much on a success; each slot level above 3 adds +1d8 damage.');
      expect(eruptingEarth?.effects[0]?.description).toBe('Each creature in the 20-foot Cube centered on a visible ground point within 120 feet makes a Dexterity save, taking 3d12 Bludgeoning damage on a failure or half as much on a success; each slot level above 3 adds +1d12 damage.');
      expect(thunderStep?.effects[0]?.description).toBe('Immediately after the caster teleports away, each creature within 10 feet of the origin space makes a Constitution save, taking 3d10 Thunder damage on a failure or half as much on a success; the boom is audible up to 300 feet away, and each slot level above 3 adds +1d10 damage.');
    });

    it('keeps hit-rider damage rows tied to target, healing, and aura facts', () => {
      const guidingBolt = getSpells(1).find(spell => spell.id === 'guiding-bolt');
      const vampiricTouch = getSpells(3).find(spell => spell.id === 'vampiric-touch');
      const conjureMinorElementals = getSpells(4).find(spell => spell.id === 'conjure-minor-elementals');

      // These damage rows should describe the visible hit contract rather than
      // importer plumbing. Guiding Bolt has a same-hit Advantage rider,
      // Vampiric Touch heals from half the damage, and Conjure Minor Elementals
      // adds chosen elemental damage only against creatures in the Emanation.
      expect(guidingBolt?.effects[0]?.description).toBe('One creature within 120 feet takes 4d6 Radiant damage on a ranged spell hit, and the next attack roll against it before the end of the caster\'s next turn has Advantage; each slot level above 1 adds +1d6 damage.');
      expect(vampiricTouch?.effects[0]?.description).toBe('One creature within reach takes 3d6 Necrotic damage on a melee spell hit, the caster regains Hit Points equal to half the Necrotic damage dealt, and each slot level above 3 adds +1d6 damage.');
      expect(conjureMinorElementals?.effects[0]?.description).toBe('Until the spell ends, any attack the caster makes that hits a creature in the 15-foot Emanation deals an extra 2d8 Acid, Cold, Fire, or Lightning damage chosen for that attack; each slot level above 4 adds +1d8 damage.');
    });

    it('keeps broad save-damage rows tied to target gates, geometry, and special riders', () => {
      const blight = getSpells(4).find(spell => spell.id === 'blight');
      const iceStorm = getSpells(4).find(spell => spell.id === 'ice-storm');
      const coneOfCold = getSpells(5).find(spell => spell.id === 'cone-of-cold');

      // These are high-visibility save damage rows. The descriptions should
      // expose their target gate, area geometry, special riders, and scaling
      // instead of only saying "Deals X damage."
      expect(blight?.effects[0]?.description).toBe('One visible creature or plant object within 30 feet makes a Constitution save, taking 8d8 Necrotic damage on a failure or half as much on a success; Plant creatures automatically fail, nonmagical plants that are not creatures wither and die, and each slot level above 4 adds +1d8 damage.');
      expect(iceStorm?.effects[0]?.description).toBe('Each creature in the 20-foot-radius, 40-foot-high Cylinder centered on a point within 300 feet makes a Dexterity save, taking 2d10 Bludgeoning damage on a failure or half as much on a success; the Cylinder also deals Cold damage and becomes Difficult Terrain, and each slot level above 4 adds +1d10 Bludgeoning damage.');
      expect(iceStorm?.effects[1]?.description).toBe('The same Dexterity save also deals 4d6 Cold damage to each creature in the Cylinder on a failure, or half as much on a success.');
      expect(coneOfCold?.effects[0]?.description).toBe('Each creature in a self-originating 60-foot Cone makes a Constitution save, taking 8d8 Cold damage on a failure or half as much on a success; a creature killed by this spell becomes a frozen statue until it thaws, and each slot level above 5 adds +1d8 damage.');
    });

    it('keeps glyph cost, life transfer, and lightning arrow rows tied to trigger and payload facts', () => {
      const glyphOfWarding = getSpells(3).find(spell => spell.id === 'glyph-of-warding');
      const lifeTransference = getSpells(3).find(spell => spell.id === 'life-transference');
      const lightningArrow = getSpells(3).find(spell => spell.id === 'lightning-arrow');

      // These rows have non-standard execution context: a delayed explosive
      // rune, self-damage that determines healing, and a transformed weapon
      // hit/miss with a secondary burst. Keep those facts visible in the rows.
      expect(glyphOfWarding?.effects[0]?.description).toBe('When the explosive rune is triggered, each creature in the 20-foot-radius Sphere centered on the glyph makes a Dexterity save, taking 5d8 Acid, Cold, Fire, Lightning, or Thunder damage chosen when the glyph was created on a failure or half as much on a success; the glyph breaks harmlessly if moved more than 10 feet from where it was cast, and each slot level above 3 adds +1d8 damage.');
      expect(lifeTransference?.effects[0]?.description).toBe('The caster takes 4d8 Necrotic damage that cannot be reduced, and one visible creature within 30 feet regains Hit Points equal to twice the Necrotic damage the caster takes; each slot level above 3 adds +1d8 self-damage before healing is doubled.');
      expect(lightningArrow?.effects[0]?.description).toBe('As the attack hits or misses, the weapon or ammunition becomes a lightning bolt; the primary target takes 4d8 Lightning damage on a hit or half as much on a miss, with +1d8 per slot level above 3, while this remains tied to the separate pending-attack trigger finding.');
      expect(lightningArrow?.effects[1]?.description).toBe('After the transformed weapon or ammunition resolves, each creature within 10 feet of the primary target makes a Dexterity save, taking 2d8 Lightning damage on a failure or half as much on a success; each slot level above 3 adds +1d8 secondary burst damage.');
    });

    it('keeps necrotic and psychic save rows tied to ongoing, threshold, and creature-family facts', () => {
      const enervation = getSpells(5).find(spell => spell.id === 'enervation');
      const synapticStatic = getSpells(5).find(spell => spell.id === 'synaptic-static');
      const negativeEnergyFlood = getSpells(5).find(spell => spell.id === 'negative-energy-flood');

      // These rows branch on saves or creature families and have follow-on
      // effects. The descriptions should name the ongoing drain, Intelligence
      // threshold, muddled-thoughts rider, zombie rider, and Undead temp HP path.
      expect(enervation?.effects[0]?.description).toBe('One visible creature within 60 feet makes a Dexterity save; on a failure it takes 4d8 Necrotic damage and can be damaged again by the caster\'s action each turn until the spell ends, while on a success it takes 2d8 Necrotic damage and the spell ends. Whenever this spell deals Necrotic damage, the caster regains Hit Points equal to half the damage dealt, and each slot level above 5 adds +1d8 damage.');
      expect(synapticStatic?.effects[0]?.description).toBe('Each creature with Intelligence 3 or higher in the 20-foot-radius Sphere centered on a point within 120 feet makes an Intelligence save, taking 8d6 Psychic damage on a failure or half as much on a success; a failed save also applies Muddled Thoughts for 1 minute.');
      expect(negativeEnergyFlood?.effects[0]?.description).toBe('One visible non-Undead creature within 60 feet makes a Constitution save, taking 5d12 Necrotic damage on a failure or half as much on a success; a creature killed by this damage rises as a zombie at the start of the caster\'s next turn.');
      expect(negativeEnergyFlood?.effects[1]?.description).toBe('If the visible target within 60 feet is Undead, it makes no saving throw and instead gains temporary Hit Points equal to half of a 5d12 roll.');
    });

    it('keeps psychic burst radiance and slow rows tied to riders and action limits', () => {
      const synapticStatic = getSpells(5).find(spell => spell.id === 'synaptic-static');
      const sickeningRadiance = getSpells(4).find(spell => spell.id === 'sickening-radiance');
      const slow = getSpells(3).find(spell => spell.id === 'slow');
      const sickeningDescriptions = sickeningRadiance?.effects.map(effect => effect.description) ?? [];
      const slowEffect = Array.isArray(slow?.effects) ? slow?.effects[0] : slow?.effects;

      // These rows carry rider mechanics that players need in logs and compact
      // effect cards: Synaptic Static's d6 subtraction, Sickening Radiance's
      // exhaustion/light/invisibility cleanup, and Slow's action-economy lock.
      expect(synapticStatic?.effects[0]?.description).toBe('Each creature with Intelligence 3 or higher in the 20-foot-radius Sphere centered on a point within 120 feet makes an Intelligence save, taking 8d6 Psychic damage on a failure or half as much on a success; a failed save also applies Muddled Thoughts for 1 minute.');
      expect(synapticStatic?.effects[1]?.description).toBe('Muddled Thoughts lasts for 1 minute after a failed Intelligence save. While affected, the target subtracts 1d6 from attack rolls, ability checks, and Constitution saves to maintain concentration, and repeats the Intelligence save at the end of each turn to end the effect.');
      expect(sickeningDescriptions).toEqual([
        'The first time on a turn that a creature moves into the 30-foot-radius Sickening Radiance area, it makes a Constitution save; on a failure it takes 4d10 Radiant damage, gains one exhaustion level, emits 5-foot-radius dim green light, and cannot benefit from being Invisible until the spell ends.',
        'A creature that starts its turn in the 30-foot-radius Sickening Radiance area makes a Constitution save; on a failure it takes 4d10 Radiant damage, gains one exhaustion level, emits 5-foot-radius dim green light, and cannot benefit from being Invisible until the spell ends.',
        'Dim green light fills a 30-foot-radius Sphere for up to 10 minutes with concentration, spreads around corners, and removes the spell-caused light and exhaustion when the spell ends.'
      ]);
      expect(slowEffect?.description).toBe('On a failed Wisdom save, each affected creature becomes Slowed for up to 1 minute with concentration. While Slowed, Speed is halved, AC and Dexterity saves take a -2 penalty, Reactions are unavailable, the target can take either an action or a Bonus Action but not both, only one attack can be made with the Attack action, Somatic spells have a 25 percent failure chance, and the target repeats the Wisdom save at the end of each turn to end the effect on itself.');
    });

    it('keeps level-five light, mud, and burning rows tied to triggers and geometry', () => {
      const immolation = getSpells(5).find(spell => spell.id === 'immolation');
      const transmuteRock = getSpells(5).find(spell => spell.id === 'transmute-rock');
      const wallOfLight = getSpells(5).find(spell => spell.id === 'wall-of-light');

      // These level-five rows are easy to misread as plain save damage. They
      // should expose the repeated burning lifecycle, ceiling-mud trigger, wall
      // geometry, Blinded rider, and beam mechanics visible in top-level prose.
      expect(immolation?.effects[0]?.description).toBe('One visible creature within 90 feet makes an initial Dexterity save, taking 8d6 Fire damage on a failure or half as much on a success; on a failed save the target also starts Burning.');
      expect(immolation?.effects[1]?.description).toBe('On a failed initial Dexterity save, the target burns for up to 1 minute while concentrating, sheds Bright Light in a 30-foot radius and Dim Light for another 30 feet, and repeats the Dexterity save at the end of each turn, ending the spell on a success.');
      expect(immolation?.effects[2]?.description).toBe('At the end of each Burning target\'s turns, it repeats the Dexterity save; on a failed save it takes 4d6 Fire damage, and on a successful save the spell ends for that target.');
      expect(transmuteRock?.effects[0]?.description).toBe('If transmuted ceiling mud falls, each creature under the falling mud makes a Dexterity save, taking 4d8 Bludgeoning damage on a failure or half as much on a success.');
      expect(wallOfLight?.effects[0]?.description).toBe('When the 60-foot-long, 10-foot-high, 5-foot-thick wall appears at a point within 120 feet, each creature in the wall makes a Constitution save, taking 4d8 Radiant damage on a failure or half as much on a success; each slot level above 5 adds +1d8 damage.');
      expect(wallOfLight?.effects[1]?.description).toBe('A creature that fails the wall\'s initial Constitution save is Blinded for 1 minute and can repeat the Constitution save at the end of each turn, ending the Blinded effect on a success.');
    });

    it('keeps wall and banishment rows tied to geometry, side triggers, and return rules', () => {
      const wallOfFire = getSpells(4).find(spell => spell.id === 'wall-of-fire');
      const banishment = getSpells(4).find(spell => spell.id === 'banishment');
      const wallOfIce = getSpells(6).find(spell => spell.id === 'wall-of-ice');

      // These spells are not plain condition or damage rows. Their runtime
      // value depends on wall shape, selected damage sides, creature push
      // choices, destroyed-section hazards, and Banishment's return/permanent
      // transport branch for specific extraplanar creature families.
      expect(wallOfFire?.effects[0]?.description).toBe('When the opaque wall appears as either a 60-foot-long, 20-foot-high, 1-foot-thick wall or a 20-foot-diameter, 20-foot-high, 1-foot-thick ring within 120 feet, each creature in its area makes a Dexterity save, taking 5d8 Fire damage on a failure or half as much on a success; each slot level above 4 adds +1d8 damage.');
      expect(wallOfFire?.effects[1]?.description).toBe('A creature takes 5d8 Fire damage, plus +1d8 per slot level above 4, when it enters the wall for the first time on a turn; only the caster-selected side deals 10-foot proximity damage, and the other side deals no damage.');
      expect(wallOfFire?.effects[2]?.description).toBe('A creature takes 5d8 Fire damage, plus +1d8 per slot level above 4, when it ends its turn inside the wall or within 10 feet of the caster-selected damage side; the other side deals no damage.');
      expect(banishment?.effects[0]?.description).toBe('One visible creature within 30 feet that fails a Charisma save is transported to a harmless demiplane for up to 1 minute with concentration and is Incapacitated while there; when the spell ends, it returns to the space it left or the nearest unoccupied space.');
      expect(banishment?.effects[1]?.description).toBe('The same failed Charisma save Banishes the target for up to 1 minute; if the target is an Aberration, Celestial, Elemental, Fey, or Fiend and the spell lasts the full minute, it does not return and is transported to a random associated plane.');
      expect(wallOfIce?.effects[0]?.description).toBe('If the 1-foot-thick ice wall, dome, globe, or contiguous panel shape cuts through a creature\'s space when it appears within 120 feet, the caster pushes that creature to one side and it makes a Dexterity save, taking 10d6 Cold damage on a failure or half as much on a success; each slot level above 6 adds +2d6 appearance damage.');
      expect(wallOfIce?.effects[2]?.description).toBe('Creates a 1-foot-thick ice wall on a solid surface as a 10-foot-radius hemisphere or globe, or up to ten contiguous 10-foot panels; each 10-foot section has AC 12, 30 Hit Points, Cold, Poison, and Psychic immunity, Fire vulnerability, and leaves frigid air behind when destroyed.');
      expect(wallOfIce?.effects[3]?.description).toBe('A creature moving through frigid air left by a destroyed wall section for the first time on a turn makes a Constitution save, taking 5d6 Cold damage on a failure or half as much on a success; each slot level above 6 adds +1d6 frigid-air damage.');
    });

    it('keeps charm cloud and chained lightning rows tied to gates, triggers, and branching targets', () => {
      const fastFriends = getSpells(3).find(spell => spell.id === 'fast-friends');
      const stinkingCloud = getSpells(3).find(spell => spell.id === 'stinking-cloud');
      const chainLightning = getSpells(6).find(spell => spell.id === 'chain-lightning');

      // These rows hide important runtime/UI facts behind generic phrasing:
      // Fast Friends has Humanoid and communication gates plus harmful-task
      // exits, Stinking Cloud is a start-turn action-denial cloud, and Chain
      // Lightning branches from one visible target to nearby unique targets.
      expect(fastFriends?.effects[0]?.description).toBe('One Humanoid within 30 feet that can see, hear, and understand the caster makes a Wisdom save or is Charmed for up to 1 hour with concentration, performs requested services in a friendly manner, can repeat the save for harmful or conflicting tasks, saves with Advantage if fighting the caster or companions, ends if asked to face certain death, and knows it was charmed when the spell ends.');
      expect(stinkingCloud?.effects[0]?.description).toBe('A creature that starts its turn in the 20-foot-radius Heavily Obscured gas Sphere within 90 feet makes a Constitution save or is Poisoned until the end of the current turn and cannot take actions or Bonus Actions; a strong wind disperses the cloud.');
      expect(chainLightning?.effects[0]?.description).toBe('A lightning bolt hits one visible creature or object within 150 feet, then leaps to up to three different creatures or objects within 30 feet of the first target; each target makes a Dexterity save, taking 10d8 Lightning damage on a failure or half as much on a success, and each slot level above 6 adds one additional leaping bolt.');
    });

    it('keeps nature emanation, wilting, and death rows tied to family and trigger facts', () => {
      const conjureWoodlandBeings = getSpells(4).find(spell => spell.id === 'conjure-woodland-beings');
      const horridWilting = getSpells(8).find(spell => spell.id === 'abi-dalzims-horrid-wilting');
      const fingerOfDeath = getSpells(7).find(spell => spell.id === 'finger-of-death');

      // These rows look like plain save damage if read in isolation, but their
      // player-facing meaning depends on following emanation timing,
      // creature-family exclusions or save modifiers, and Finger of Death's
      // Humanoid kill-to-zombie follow-up.
      expect(conjureWoodlandBeings?.effects[0]?.description).toBe('For up to 10 minutes with concentration, nature spirits flit in a 10-foot Emanation around the caster; when the Emanation enters a visible creature\'s space, or a visible creature enters it or ends its turn there, that creature can be forced to make a Wisdom save once per turn, taking 5d8 Force damage on a failure or half as much on a success, with +1d8 per slot level above 4.');
      expect(horridWilting?.effects[0]?.description).toBe('Each non-Construct, non-Undead creature in the 30-foot Cube centered on a point within 150 feet makes a Constitution save, taking 12d8 Necrotic damage on a failure or half as much on a success; Plants and Water Elementals make this save with Disadvantage.');
      expect(fingerOfDeath?.effects[0]?.description).toBe('One visible creature within 60 feet makes a Constitution save, taking 7d8 + 30 Necrotic damage on a failure or half as much on a success; if this damage kills a Humanoid, it rises at the start of the caster\'s next turn as a Zombie that follows the caster\'s verbal orders.');
    });

    it('keeps area burst rows tied to geometry, object gates, and riders', () => {
      const circleOfDeath = getSpells(6).find(spell => spell.id === 'circle-of-death');
      const tidalWave = getSpells(3).find(spell => spell.id === 'tidal-wave');
      const shatter = getSpells(2).find(spell => spell.id === 'shatter');

      // These area bursts should stand alone in combat logs. The damage rows
      // need placement, shape, save branches, slot scaling, and rider facts
      // rather than only "Deals X damage."
      expect(circleOfDeath?.effects[0]?.description).toBe('Each creature in the 60-foot-radius Sphere centered on a point within 150 feet makes a Constitution save, taking 8d8 Necrotic damage on a failure or half as much on a success; each slot level above 6 adds +2d8 damage.');
      expect(tidalWave?.effects[0]?.description).toBe('Each creature in the wave area up to 30 feet long, 10 feet wide, and 10 feet tall within 120 feet makes a Dexterity save, taking 4d8 Bludgeoning damage on a failure or half as much on a success; failed saves also knock creatures Prone, and the water extinguishes unprotected flames in the area and within 30 feet before vanishing.');
      expect(shatter?.effects[0]?.description).toBe('Each creature in the 10-foot-radius Sphere centered on a point within 60 feet makes a Constitution save, taking 3d8 Thunder damage on a failure or half as much on a success; Constructs have Disadvantage on the save, nonmagical objects that are not worn or carried also take the damage, and each slot level above 2 adds +1d8 damage.');
    });

    it('keeps deathlike disease and harm rows tied to protection and progression facts', () => {
      const feignDeath = getSpells(3).find(spell => spell.id === 'feign-death');
      const contagion = getSpells(5).find(spell => spell.id === 'contagion');
      const harm = getSpells(6).find(spell => spell.id === 'harm');

      // These rows are condition-heavy and easy to flatten into "applies X."
      // Keep the deathlike protection package, disease progression, and
      // damage-tied HP maximum reduction visible in each row.
      expect(feignDeath?.effects[0]?.description).toBe('Touch one willing creature for 1 hour without concentration; as part of a deathlike state indistinguishable from death to outward inspection and status-detecting magic, the target is Blinded, has Speed 0, resists all damage except Psychic, and is immune to Poisoned.');
      expect(feignDeath?.effects[1]?.description).toBe('Touch one willing creature for 1 hour without concentration; as part of the same deathlike state, the target is Incapacitated, has Speed 0, resists all damage except Psychic, and is immune to Poisoned.');
      expect(contagion?.effects[0]?.description).toBe('A creature you touch makes a Constitution save; on a failure, it takes 11d8 Necrotic damage and gains the Poisoned condition from the magical contagion.');
      expect(contagion?.effects[1]?.description).toBe('On a failed Constitution save, the target is Poisoned and repeats the save at the end of each turn until it reaches three successes or three failures. Three successes end the spell on that target; three failures make the Poisoned condition last for 7 days, and attempts to end that Poisoned condition require another Constitution save.');
      expect(harm?.effects[0]?.description).toBe('One visible creature within 60 feet makes a Constitution save, taking 14d6 Necrotic damage on a failure or half as much on a success; only a failed save also reduces the target\'s Hit Point maximum.');
      expect(harm?.effects[1]?.description).toBe('On a failed Constitution save, the target\'s Hit Point maximum is reduced by the Necrotic damage it took from Harm, but not below 1.');
    });

    it('keeps forced-control and sphere restraint rows tied to saves and movement consequences', () => {
      const compulsion = getSpells(4).find(spell => spell.id === 'compulsion');
      const confusion = getSpells(4).find(spell => spell.id === 'confusion');
      const waterySphere = getSpells(4).find(spell => spell.id === 'watery-sphere');

      // These control rows drive visible turn behavior. Their descriptions
      // should expose the affected area or target set, repeat-save timing, and
      // the movement/action consequences that make each condition meaningful.
      expect(compulsion?.effects[0]?.description).toBe('Each chosen visible creature within 30 feet makes a Wisdom save or is Charmed for up to 1 minute with concentration; while Charmed, the caster can use a Bonus Action to choose a horizontal direction, the target must use as much movement as possible on its next turn to move that way by the safest route, and after moving it repeats the Wisdom save, ending the spell on itself on a success.');
      expect(confusion?.effects[0]?.description).toBe('Each creature in the 10-foot-radius Sphere centered on a point within 90 feet makes a Wisdom save or becomes Confused for up to 1 minute with concentration. While Confused, the target cannot take Bonus Actions or Reactions, rolls 1d10 at the start of each turn to determine that turn behavior from the spell table, and repeats the Wisdom save at the end of each turn to end the spell on itself; each slot level above 4 adds 5 feet to the Sphere radius.');
      expect(waterySphere?.effects[0]?.description).toBe('A Large or smaller creature in the 5-foot-radius water Sphere within 90 feet can choose to fail the Strength save; on a failed save it is Restrained and engulfed for up to 1 minute with concentration, moves with the sphere, repeats the Strength save at the end of each turn to escape, and is knocked Prone where the sphere falls when the spell ends. Huge or larger creatures automatically succeed.');
    });

    it('keeps tracking spike, blade wall, and flame investiture rows tied to timing and rider facts', () => {
      const mindSpike = getSpells(2).find(spell => spell.id === 'mind-spike');
      const bladeBarrier = getSpells(6).find(spell => spell.id === 'blade-barrier');
      const investitureOfFlame = getSpells(6).find(spell => spell.id === 'investiture-of-flame');

      // These damage rows are only useful in logs/UI if they expose why the
      // damage happens: Mind Spike's tracking rider, Blade Barrier's wall
      // geometry/cover/terrain timing, and Investiture of Flame's action line
      // plus close-range heat aura.
      expect(mindSpike?.effects[0]?.description).toBe('One visible creature within 120 feet makes a Wisdom save, taking 3d8 Psychic damage on a failure or half as much on a success; on a failed save the caster knows the target location for up to 1 hour with concentration while both remain on the same plane, the target cannot become hidden from the caster, Invisible gives it no benefit against the caster, and each slot level above 2 adds +1d8 damage.');
      expect(bladeBarrier?.effects[0]?.description).toBe('When the straight 100-foot-long, 20-foot-high, 5-foot-thick wall or 60-foot-diameter ring appears within 90 feet, creatures in the blade wall space make a Dexterity save, taking 6d10 Force damage on a failure or half as much on a success; the wall provides Three-Quarters Cover and its space is Difficult Terrain.');
      expect(bladeBarrier?.effects[1]?.description).toBe('A creature that enters the blade wall space for the first time on a turn makes a Dexterity save, taking 6d10 Force damage on a failure or half as much on a success; a creature makes this save only once per turn.');
      expect(bladeBarrier?.effects[2]?.description).toBe('A creature that ends its turn in the blade wall space makes a Dexterity save, taking 6d10 Force damage on a failure or half as much on a success; a creature makes this save only once per turn.');
      expect(investitureOfFlame?.effects[0]?.description).toBe('For up to 10 minutes with concentration, the caster can use an action to create a 15-foot-long, 5-foot-wide line of fire from them in a chosen direction; each creature in the line makes a Dexterity save, taking 4d8 Fire damage on a failure or half as much on a success.');
      expect(investitureOfFlame?.effects[1]?.description).toBe('For up to 10 minutes with concentration, a creature takes 1d10 Fire damage the first time on a turn that it moves within 5 feet of the caster; the caster is unharmed by these flames.');
      expect(investitureOfFlame?.effects[2]?.description).toBe('For up to 10 minutes with concentration, a creature takes 1d10 Fire damage when it ends its turn within 5 feet of the caster; the caster is unharmed by these flames.');
    });

    it('keeps strike prison and feeblemind rows tied to target selection and lockout facts', () => {
      const steelWindStrike = getSpells(5).find(spell => spell.id === 'steel-wind-strike');
      const mentalPrison = getSpells(6).find(spell => spell.id === 'mental-prison');
      const feeblemind = getSpells(8).find(spell => spell.id === 'feeblemind');

      // These targeted high-level rows need their follow-up consequences in
      // the row text: Steel Wind Strike's selected targets and optional
      // teleport, Mental Prison's Charmed-immunity auto-success and escape
      // damage, and Feeblemind's long-term Intelligence/Charisma lockout.
      expect(steelWindStrike?.effects[0]?.description).toBe('Choose up to five visible creatures within 30 feet and make a melee spell attack against each; on a hit, that target takes 6d10 Force damage, and after all attacks the caster can teleport to an unoccupied visible space within 5 feet of one target hit or missed.');
      expect(mentalPrison?.effects[0]?.description).toBe('One visible creature within 60 feet makes an Intelligence save, automatically succeeding if immune to Charmed. The target takes 5d10 Psychic damage on a success or failure, and the spell ends immediately on a successful save.');
      expect(mentalPrison?.effects[1]?.description).toBe('On a failed Intelligence save, the target is Restrained for up to 1 minute with concentration inside an illusory cell only it perceives, cannot see or hear beyond the illusion, and triggers the escape damage if it leaves, attacks through, or reaches through the illusion.');
      expect(feeblemind?.effects[0]?.description).toBe('One visible creature within 150 feet takes 4d6 Psychic damage and makes an Intelligence save. On a failed save, its Intelligence and Charisma become 1, it cannot cast spells, activate magic items, understand language, or communicate intelligibly, and it repeats the Intelligence save every 30 days until the spell ends.');
    });

    it('keeps high-level control and imprisonment status rows tied to save, option, and repeat-save facts', () => {
      const divineWord = getSpells(7).find(spell => spell.id === 'divine-word');
      const dominateMonster = getSpells(8).find(spell => spell.id === 'dominate-monster');
      const imprisonment = getSpells(9).find(spell => spell.id === 'imprisonment');
      const divineWordDeath = divineWord?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Dead'
      );
      const divineWordStunned = divineWord?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Stunned'
      );
      const dominateMonsterCharmed = dominateMonster?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Charmed'
      );
      const imprisonmentBase = imprisonment?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Imprisoned'
      );
      const imprisonmentRestrained = imprisonment?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Restrained'
      );
      const imprisonmentUnconscious = imprisonment?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Unconscious'
      );

      // These rows are the player-facing status entries for high-level control
      // spells. They need to show the save gate, threshold or option branch, and
      // repeat-save/ending facts without forcing the UI to reopen the full card.
      expect(divineWordDeath?.description).toBe('On a failed Charisma save, a chosen creature within 30 feet with 20 Hit Points or fewer dies; Celestial, Elemental, Fey, or Fiend targets also resolve the planar return branch on the same failed save.');
      expect(divineWordStunned?.description).toBe('On a failed Charisma save, a target with 21 to 30 Hit Points has the Stunned condition for 1 hour; that same HP band also receives Blinded and Deafened from the Divine Word table.');
      expect(dominateMonsterCharmed?.description).toBe('One visible creature within 60 feet has Advantage on the Wisdom save if you or your allies are fighting it; on a failed save, it is Charmed for the concentration duration, linked telepathically for commands, and repeats the save whenever it takes damage, ending the spell on a success.');
      expect(imprisonmentBase?.description).toBe('One visible creature within 30 feet that fails the Wisdom save is imprisoned until the spell ends; on a successful save it is unaffected and immune to this spell for 24 hours, while a failed target no longer needs to breathe, eat, drink, or age, cannot be found by Divination, and cannot teleport.');
      expect(imprisonmentRestrained?.description).toBe('The Chaining imprisonment option holds the failed-save target in place with rooted chains, gives it the Restrained condition, and prevents it from being moved until the chosen ending trigger, ninth-level Dispel Magic route, or other spell ending resolves.');
      expect(imprisonmentUnconscious?.description).toBe('The Slumber imprisonment option gives the failed-save target the Unconscious condition and prevents it from being awakened until the chosen ending trigger, ninth-level Dispel Magic route, or other spell ending resolves.');
    });

    it('keeps high-level storm and burst status rows tied to area, timing, and repeat-save facts', () => {
      const stormOfVengeance = getSpells(9).find(spell => spell.id === 'storm-of-vengeance');
      const psychicScream = getSpells(9).find(spell => spell.id === 'psychic-scream');
      const sunburst = getSpells(8).find(spell => spell.id === 'sunburst');
      const stormDeafened = stormOfVengeance?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Deafened'
      );
      const stormDifficultTerrain = stormOfVengeance?.effects.find(effect =>
        effect.type === 'TERRAIN' && effect.description?.includes('Difficult Terrain')
      );
      const stormObscured = stormOfVengeance?.effects.find(effect =>
        effect.type === 'TERRAIN' && effect.description?.includes('Heavily Obscured')
      );
      const psychicStunned = psychicScream?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Stunned'
      );
      const sunburstBlinded = sunburst?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Blinded'
      );

      // These high-level effects drive combat-log and map-overlay readability:
      // storm rows need cloud scale and timing, while repeat-save status rows
      // need target eligibility, failed-save payload, and success cleanup facts.
      expect(stormDeafened?.description).toBe('When the 300-foot-radius storm cloud appears, each creature under it makes a Constitution save; on a failed save, the creature is Deafened for the concentration duration alongside the initial Thunder damage.');
      expect(stormDifficultTerrain?.description).toBe('Until Storm of Vengeance ends, the entire 300-foot-radius area under the cloud is Difficult Terrain during the staged acid, lightning, hail, and freezing-rain turns.');
      expect(stormObscured?.description).toBe('Until Storm of Vengeance ends, the entire 300-foot-radius area under the cloud is Heavily Obscured, blocks ranged weapon attacks, and has strong wind blowing through it.');
      expect(psychicStunned?.description).toBe('Up to ten chosen visible creatures within 90 feet, excluding creatures with Intelligence 2 or lower, are Stunned on a failed Intelligence save after Psychic Scream damage and repeat the Intelligence save at the end of each of their turns, ending Stunned on success.');
      expect(sunburstBlinded?.description).toBe('Each creature in the 60-foot-radius sunlight sphere makes a Constitution save; on a failed save, it is Blinded for 1 minute and repeats the Constitution save at the end of each of its turns, ending Blinded on success.');
    });

    it('keeps high-level suspension gravity and prism rows tied to ending and progression facts', () => {
      const sequester = getSpells(7).find(spell => spell.id === 'sequester');
      const reverseGravity = getSpells(7).find(spell => spell.id === 'reverse-gravity');
      const prismaticSpray = getSpells(7).find(spell => spell.id === 'prismatic-spray');
      const sequesterInvisible = sequester?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Invisible'
      );
      const sequesterUnconscious = sequester?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Unconscious'
      );
      const reverseGravityDownwardFall = reverseGravity?.effects.find(effect =>
        effect.type === 'MOVEMENT' && effect.trigger?.type === 'on_exit_area'
      );
      const prismaticPetrified = prismaticSpray?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Petrified'
      );
      const prismaticVioletTeleport = prismaticSpray?.effects.find(effect =>
        effect.type === 'MOVEMENT' && effect.trigger?.type === 'after_primary'
      );

      // These rows describe long-lived or staged consequences. The short row
      // text needs to carry the end condition, progression counter, and follow-up
      // save facts because they drive both logs and future automation hooks.
      expect(sequesterInvisible?.description).toBe('The touched object or willing creature is Invisible until Sequester ends, cannot be targeted by Divination, detected by magic, or viewed remotely with magic, and the spell ends for the target if it takes damage or the caster-defined condition occurs within 1 mile.');
      expect(sequesterUnconscious?.description).toBe('If the sequestered target is a willing creature, it enters suspended animation with the Unconscious condition, does not age or need food, water, or air, and remains that way until damage, Dispel, or the caster-defined ending condition ends the spell.');
      expect(reverseGravityDownwardFall?.description).toBe('When Reverse Gravity ends or the target leaves the 50-foot-radius, 100-foot-high cylinder, affected creatures and objects that were hovering at the top fall downward and resolve normal falling consequences.');
      expect(prismaticPetrified?.description).toBe('Indigo ray Petrified branch: after three failed end-turn Constitution saves while Restrained, the target has the Petrified condition until freed by an effect such as Greater Restoration.');
      expect(prismaticVioletTeleport?.description).toBe('Violet ray follow-up: a target that failed the Dexterity save stays Blinded until the start-of-next-turn Wisdom save; on a failed Wisdom save, Blinded ends and the target teleports to a DM-chosen plane.');
    });

    it('keeps high-level pain fire and transformation rows tied to threshold, terrain, and flight facts', () => {
      const powerWordPain = getSpells(7).find(spell => spell.id === 'power-word-pain');
      const fireStorm = getSpells(7).find(spell => spell.id === 'fire-storm');
      const draconicTransformation = getSpells(7).find(spell => spell.id === 'draconic-transformation');
      const cripplingPain = powerWordPain?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Crippling Pain'
      );
      const painSpeedCap = powerWordPain?.effects.find(effect => effect.type === 'MOVEMENT');
      const fireIgnition = fireStorm?.effects.find(effect => effect.type === 'TERRAIN');
      const draconicFlight = draconicTransformation?.effects.find(effect => effect.type === 'MOVEMENT');

      // These rows are short but mechanically dense. They should expose the
      // threshold gate, repeat-save cleanup, terrain placement rules, and flight
      // duration so map and log views do not need the full spell card open.
      expect(cripplingPain?.description).toBe('One visible creature within 60 feet is affected only if it has 100 Hit Points or fewer and is not immune to Charmed. While in crippling pain, spellcasting requires a Constitution save, and the target repeats the Constitution save at the end of each turn to end the pain on a success.');
      expect(painSpeedCap?.description).toBe('While Power Word Pain affects the target, every Speed it has is capped at 10 feet until an end-turn Constitution save succeeds and ends the pain.');
      expect(fireIgnition?.description).toBe('Flammable objects in the caster-arranged area of up to ten contiguous 10-foot Cubes ignite if they are not worn or carried.');
      expect(draconicFlight?.description).toBe('For the 1-minute concentration duration of Draconic Transformation, incorporeal wings give the caster a 60-foot flying speed alongside the spell\'s blindsight and repeatable breath weapon benefits.');
    });

    it('keeps high-level foresight aura and illusion rows tied to duration and trigger facts', () => {
      const foresight = getSpells(9).find(spell => spell.id === 'foresight');
      const holyAura = getSpells(8).find(spell => spell.id === 'holy-aura');
      const illusoryDragon = getSpells(8).find(spell => spell.id === 'illusory-dragon');
      const foresightAttackAdvantage = foresight?.effects.find(effect =>
        effect.type === 'ATTACK_ROLL_MODIFIER' && effect.description?.includes('Advantage')
      );
      const foresightIncomingDisadvantage = foresight?.effects.find(effect =>
        effect.type === 'ATTACK_ROLL_MODIFIER' && effect.description?.includes('Disadvantage')
      );
      const holyAuraIncomingDisadvantage = holyAura?.effects.find(effect =>
        effect.type === 'ATTACK_ROLL_MODIFIER'
      );
      const holyAuraBlinded = holyAura?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Blinded'
      );
      const illusoryDragonFrightened = illusoryDragon?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Frightened'
      );
      const illusoryDragonMove = illusoryDragon?.effects.find(effect =>
        effect.type === 'MOVEMENT'
      );

      // These rows are combat-visible modifiers. They should show who benefits,
      // how long the rider lasts, and what event triggers the rider so future UI
      // surfaces can render them without expanding the full spell description.
      expect(foresightAttackAdvantage?.description).toBe('For Foresight\'s 8-hour duration, the touched willing creature has Advantage on attack rolls as part of its broad Advantage on D20 Tests, and the benefit ends early if the caster casts Foresight again.');
      expect(foresightIncomingDisadvantage?.description).toBe('For Foresight\'s 8-hour duration, other creatures have Disadvantage on attack rolls against the touched willing target, and that protection ends early if the caster casts Foresight again.');
      expect(holyAuraIncomingDisadvantage?.description).toBe('For the 1-minute concentration aura, other creatures have Disadvantage on attack rolls against chosen creatures while those creatures remain in the caster\'s 30-foot Emanation.');
      expect(holyAuraBlinded?.description).toBe('When a Fiend or Undead hits an affected chosen creature in Holy Aura with a melee attack, that attacker must make a Constitution save or be Blinded until the end of its next turn.');
      expect(illusoryDragonFrightened?.description).toBe('When the Huge shadow-dragon illusion appears in an unoccupied visible space within 120 feet, enemies that can see it must make a Wisdom save or become Frightened for 1 minute, repeating the save at end of turn if they no longer have line of sight.');
      expect(illusoryDragonMove?.description).toBe('As a Bonus Action during the 1-minute concentration duration, the caster can move the tangible dragon illusion up to 60 feet and can trigger its 60-foot cone breath at any point during that movement.');
    });

    it('keeps mental shield threshold stun and telekinetic control rows tied to branch facts', () => {
      const mindBlank = getSpells(8).find(spell => spell.id === 'mind-blank');
      const powerWordStun = getSpells(8).find(spell => spell.id === 'power-word-stun');
      const telekinesis = getSpells(5).find(spell => spell.id === 'telekinesis');
      const mindBlankDefensive = mindBlank?.effects.find(effect => effect.type === 'DEFENSIVE');
      const powerWordStunned = powerWordStun?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Stunned'
      );
      const powerWordSpeed = powerWordStun?.effects.find(effect => effect.type === 'MOVEMENT');
      const telekinesisControl = Array.isArray(telekinesis?.effects) ? telekinesis?.effects[0] : telekinesis?.effects;

      // These rows cover branch-heavy high-impact control. They need to show the
      // selected target, threshold branch, object/creature split, and anti-magic
      // shield facts without relying on the wrapper row alone.
      expect(mindBlankDefensive?.description).toBe('For 24 hours, one willing creature the caster touches has Immunity to Psychic damage and the Charmed condition, and is also shielded from emotion or alignment sensing, thought reading, magical location detection, remote observation, mind control, and even Wish-based information gathering.');
      expect(powerWordStunned?.description).toBe('If the visible target has 150 Hit Points or fewer, it has the Stunned condition and repeats the Constitution save at the end of each of its turns, ending Stunned on a success.');
      expect(powerWordSpeed?.description).toBe('If the visible target has more than 150 Hit Points, its Speed becomes 0 until the start of your next turn instead of applying Stunned.');
      expect(telekinesisControl?.description).toBe('For up to 10 minutes with concentration, the caster can use a Magic action each turn to affect one Huge or smaller creature or object within 60 feet: failed Strength saves let the caster move and Restrain creatures until the end of the caster\'s next turn, unattended objects move automatically, worn or carried objects can be pulled free on a failed save, and simple objects can be finely manipulated.');
    });

    it('keeps terrain passage and movement-protection rows tied to runtime constraints', () => {
      const moveEarth = getSpells(6).find(spell => spell.id === 'move-earth');
      const freedomOfMovement = getSpells(4).find(spell => spell.id === 'freedom-of-movement');
      const passwall = getSpells(5).find(spell => spell.id === 'passwall');
      const moveEarthTerrain = moveEarth?.effects.find(effect => effect.type === 'TERRAIN');
      const freedomUtility = freedomOfMovement?.effects.find(effect => effect.type === 'UTILITY');
      const passwallUtility = passwall?.effects.find(effect => effect.type === 'UTILITY');

      // These utility/terrain rows describe player-facing map constraints. They
      // need to expose material limits, safe ejection, magical-vs-nonmagical
      // protection, and timing instead of relying on top-level prose.
      expect(moveEarthTerrain?.description).toBe('Reshape dirt, sand, or clay in a 40-foot-square area within 120 feet into elevation changes, trenches, walls, or pillars up to half the area\'s largest dimension; each change takes 10 minutes, usually cannot trap or injure creatures because it is slow, and cannot manipulate natural stone or stone construction.');
      expect(freedomUtility?.description).toBe('Touch one willing creature for 1 hour: the target ignores Difficult Terrain, cannot have Speed reduced by spells or magical effects, cannot be made Paralyzed or Restrained by magic, gains a Swim Speed equal to its Speed, and can spend 5 feet of movement to automatically escape nonmagical restraints such as manacles or mundane grapples.');
      expect(passwallUtility?.description).toBe('Create a 1-hour passage in a visible wooden, plaster, or stone surface within 30 feet, up to 5 feet wide, 8 feet tall, and 20 feet deep; the opening does not destabilize the structure, and creatures or objects still inside when it ends are safely ejected to the nearest unoccupied space beside the surface.');
    });

    it('keeps cloud-form water-control and invulnerability rows tied to mode and defense facts', () => {
      const windWalk = getSpells(6).find(spell => spell.id === 'wind-walk');
      const controlWater = getSpells(4).find(spell => spell.id === 'control-water');
      const invulnerability = getSpells(9).find(spell => spell.id === 'invulnerability');
      const windWalkMovement = windWalk?.effects.find(effect => effect.type === 'MOVEMENT');
      const windWalkStunned = windWalk?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Stunned'
      );
      const controlWaterUtility = controlWater?.effects.find(effect => effect.type === 'UTILITY');
      const invulnerabilityDefense = invulnerability?.effects.find(effect => effect.type === 'DEFENSIVE');

      // These rows are high-value runtime summaries. They should use
      // player-facing rules text instead of exposing implementation debt or
      // forcing the UI to reopen the full spell card for mode/defense details.
      expect(windWalkMovement?.description).toBe('In cloud form, each Wind Walk target has a 300-foot Fly Speed, can hover, can only Dash or use Magic to begin reverting, and if still flying when the spell ends descends safely 60 feet per round for 1 minute before falling any remaining distance.');
      expect(windWalkStunned?.description).toBe('A Wind Walk target that uses Magic to revert to normal form is Stunned during the 1-minute transformation, and returning to cloud form later uses the same Magic action plus 1-minute transformation timing.');
      expect(controlWaterUtility?.description).toBe('Control water in a 100-foot cube within 300 feet for up to 10 minutes with concentration, choosing one active mode at a time: Flood, Part Water, Redirect Flow, or Whirlpool; later Magic actions can repeat or switch modes, and those modes carry the wave, trench, flow, pull, damage, escape, and vehicle-handling rules.');
      expect(invulnerabilityDefense?.description).toBe('For up to 10 minutes with concentration, the self-targeted caster is immune to all damage until Invulnerability ends.');
    });

    it('keeps common reaction and silence-control rows player-facing', () => {
      const shield = getSpells(1).find(spell => spell.id === 'shield');
      const counterspell = getSpells(3).find(spell => spell.id === 'counterspell');
      const silence = getSpells(2).find(spell => spell.id === 'silence');
      const shieldAc = shield?.effects[0];
      const shieldMissile = shield?.effects[1];
      const counterspellUtility = counterspell?.effects.find(effect => effect.type === 'UTILITY');
      const silenceUtility = silence?.effects.find(effect => effect.type === 'UTILITY');
      const silenceDeafened = silence?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Deafened'
      );
      const silenceDefense = silence?.effects.find(effect => effect.type === 'DEFENSIVE');

      // These reaction and control rows are common combat UI summaries. They
      // should read as player-facing rules text rather than importer or runtime
      // shorthand, while preserving the existing structured triggers and gates.
      expect(shieldAc?.description).toBe('When you are hit by an attack, you gain +5 AC, including against that attack, until the start of your next turn.');
      expect(shieldMissile?.description).toBe('When Magic Missile targets you, you take no damage from it until the start of your next turn.');
      expect(counterspellUtility?.description).toBe('When you see a creature within 60 feet casting a spell, you try to interrupt it. The caster makes a Constitution saving throw. On a failure, the spell fizzles, the casting action is wasted, and any slot used for it is not expended.');
      expect(silenceUtility?.description).toBe('A 20-foot-radius sphere of silence forms at a point you choose within 120 feet. Sound cannot be created within it or pass through it, creatures inside cannot cast spells with Verbal components, and creatures or objects entirely inside ignore Thunder damage.');
      expect(silenceDeafened?.description).toBe('Creatures entirely inside the silence sphere have the Deafened condition while they remain there.');
      expect(silenceDefense?.description).toBe('Creatures and objects entirely inside the silence sphere are immune to Thunder damage while they remain there.');
    });

    it('keeps portal summon-flow and plant-mode rows tied to their runtime choices', () => {
      const arcaneGate = getSpells(6).find(spell => spell.id === 'arcane-gate');
      const conjureFey = getSpells(6).find(spell => spell.id === 'conjure-fey');
      const plantGrowth = getSpells(3).find(spell => spell.id === 'plant-growth');
      const arcaneGateUtility = arcaneGate?.effects.find(effect => effect.type === 'UTILITY');
      const conjureFeySummon = conjureFey?.effects.find(effect => effect.type === 'SUMMONING');
      const conjureFeyDamage = conjureFey?.effects.find(effect => effect.type === 'DAMAGE');
      const conjureFeyFear = conjureFey?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Frightened'
      );
      const conjureFeyTeleport = conjureFey?.effects.find(effect => effect.type === 'MOVEMENT');
      const conjureFeyUtility = conjureFey?.effects.find(effect => effect.type === 'UTILITY');
      const plantGrowthTerrain = plantGrowth?.effects.find(effect => effect.type === 'TERRAIN');
      const plantGrowthUtility = plantGrowth?.effects.find(effect => effect.type === 'UTILITY');

      // These rows summarize tactical choices: portal facing, repeatable Fey
      // teleport attacks, and Plant Growth's action-vs-hour casting modes. The
      // descriptions should expose those choices without needing the full card.
      expect(arcaneGateUtility?.description).toBe('Create two linked 10-foot-diameter portals for up to 10 minutes with concentration: one on a ground point within 10 feet of you and one on a visible ground point within 500 feet. The spell fails if either portal would open in an occupied space, each portal is open only from one chosen side, opaque mist blocks sight through it, creatures and objects entering the open side exit the other portal as though the spaces were adjacent, and you can reverse the open sides with a Bonus Action.');
      expect(conjureFeySummon?.description).toBe('Summon one Medium Feywild spirit in a visible unoccupied space within 60 feet for up to 10 minutes with concentration; it looks like a Fey creature you choose and serves as the origin for the spell attack and later teleport loop.');
      expect(conjureFeyDamage?.description).toBe('When the spirit appears, and on later turns after you teleport it with a Bonus Action, you can make one melee spell attack from the spirit against a creature within 5 feet of it; on a hit, the target takes 3d12 plus your spellcasting ability modifier Psychic damage, increasing by 1d12 per slot level above 6.');
      expect(conjureFeyFear?.description).toBe('A target hit by the Fey spirit attack has the Frightened condition until the start of your next turn, with both you and the spirit as the source of the fear.');
      expect(conjureFeyTeleport?.description).toBe('On later turns, you can use a Bonus Action to teleport the Fey spirit to a visible unoccupied space within 30 feet of the space it left before making the spirit attack.');
      expect(conjureFeyUtility?.description).toBe('Conjure Fey is a repeatable teleport-attack loop: summon the Medium spirit, attack when it appears, then on later turns use a Bonus Action to teleport it up to 30 feet and make the same melee spell attack; a hit deals Psychic damage and Frightens the target until the start of your next turn.');
      expect(plantGrowthTerrain?.description).toBe('With the Overgrowth action casting, normal plants in a 100-foot-radius sphere centered on a point within 150 feet become thick terrain where movement costs 4 feet for every 1 foot moved, while chosen areas inside the sphere can be excluded.');
      expect(plantGrowthUtility?.description).toBe('With the 8-hour Enrichment casting, plants in a half-mile radius centered on a point within 150 feet are enriched for 365 days, yield twice the normal food when harvested, and cannot benefit from more than one Plant Growth per year.');
    });

    it('keeps terrain and dance rows free of runtime-debt wording', () => {
      const bladeBarrier = getSpells(6).find(spell => spell.id === 'blade-barrier');
      const investitureOfStone = getSpells(6).find(spell => spell.id === 'investiture-of-stone');
      const ottosIrresistibleDance = getSpells(6).find(spell => spell.id === 'ottos-irresistible-dance');
      const bladeTerrain = bladeBarrier?.effects.find(effect => effect.type === 'TERRAIN');
      const stoneMovement = investitureOfStone?.effects.find(effect => effect.type === 'MOVEMENT');
      const danceDefense = ottosIrresistibleDance?.effects.find(effect => effect.type === 'DEFENSIVE');

      // Runtime-debt notes belong in project docs, not in public spell rows.
      // These effect summaries should stay player-facing while preserving the
      // existing modeled movement, terrain, and advantage/disadvantage facts.
      expect(bladeTerrain?.description).toBe('The blade wall space is Difficult Terrain for the spell duration.');
      expect(stoneMovement?.description).toBe('You can move across difficult terrain made of earth or stone without spending extra movement, and you can move through solid earth or stone as if it were air without destabilizing it, but you cannot end your movement there.');
      expect(danceDefense?.description).toBe('While Charmed by the spell, the dancing target has Disadvantage on attack rolls and Dexterity saving throws, and other creatures have Advantage on attack rolls against it.');
    });

    it('keeps high-level transformation rows tied to form and temporary-hit-point rules', () => {
      const massPolymorph = getSpells(9).find(spell => spell.id === 'mass-polymorph');
      const shapechange = getSpells(9).find(spell => spell.id === 'shapechange');
      const truePolymorph = getSpells(9).find(spell => spell.id === 'true-polymorph');
      const massPolymorphUtility = massPolymorph?.effects.find(effect => effect.type === 'UTILITY');
      const massPolymorphDefense = massPolymorph?.effects.find(effect => effect.type === 'DEFENSIVE');
      const shapechangeUtility = shapechange?.effects.find(effect => effect.type === 'UTILITY');
      const shapechangeDefense = shapechange?.effects.find(effect => effect.type === 'DEFENSIVE');
      const truePolymorphUtility = truePolymorph?.effects.find(effect => effect.type === 'UTILITY');
      const truePolymorphDefense = truePolymorph?.effects.find(effect => effect.type === 'DEFENSIVE');

      // Transformation rows drive major runtime state changes. The summaries
      // should expose mode choice, retained traits, stat replacement, control
      // handoff, equipment handling, and temporary-HP behavior explicitly.
      expect(massPolymorphUtility?.description).toBe('Transform up to ten visible creatures within 120 feet into Beast forms you choose for up to 1 hour with concentration. Unwilling targets make Wisdom saves, unwilling shapechangers automatically succeed, eligible forms must be Beasts you have seen within the spell CR or half-level limits, and targets keep Hit Points, alignment, and personality while the chosen form supplies statistics, action limits, speech, spellcasting, hands use, gear access, and reversion timing.');
      expect(massPolymorphDefense?.description).toBe('Each Mass Polymorph target gains temporary hit points equal to the chosen Beast form Hit Points, and those temporary hit points cannot be replaced by another source.');
      expect(shapechangeUtility?.description).toBe('Transform into a creature you have seen that is not a Construct or Undead and has an eligible Challenge Rating for up to 1 hour with concentration. Your game statistics become the chosen form except for retained identity, proficiencies, communication, and Spellcasting the form can support; while the spell lasts, you can use a Magic action to choose another eligible form, and you choose whether equipment falls, merges, or is worn by the new form.');
      expect(shapechangeDefense?.description).toBe('On the first Shapechange transformation, you gain temporary hit points equal to the chosen form Hit Points; those temporary hit points vanish when the spell ends.');
      expect(truePolymorphUtility?.description).toBe('Transform one visible creature or nonmagical unattended object within 30 feet using creature-to-creature, creature-to-object, or object-to-creature mode. Unwilling creatures can negate the spell with a Wisdom save, and maintaining concentration for the full hour makes the transformation last until dispelled. The modes keep their CR or level limits, object-size and worn-or-carried eligibility, friendly object-creature control while the spell is controlled, loss of caster control after one hour, retained Hit Points, Hit Point Dice, alignment, and personality for creature forms, action, speech, spellcasting, gear limits, and no memory of time spent as an object.');
      expect(truePolymorphDefense?.description).toBe('In True Polymorph creature-to-creature mode, the new form grants temporary hit points equal to that form Hit Points.');
    });

    it('keeps lower-level transformation rows tied to active modes and form limits', () => {
      const alterSelf = getSpells(2).find(spell => spell.id === 'alter-self');
      const enlargeReduce = getSpells(2).find(spell => spell.id === 'enlarge-reduce');
      const polymorph = getSpells(4).find(spell => spell.id === 'polymorph');
      const alterSelfDescriptions = alterSelf?.effects.map(effect => effect.description) ?? [];
      const enlarge = enlargeReduce?.effects[0];
      const reduce = enlargeReduce?.effects[1];
      const polymorphUtility = polymorph?.effects.find(effect => effect.type === 'UTILITY');

      // These lower-level transformations are common UI state changes. Their
      // rows should expose active mode choice, size consequences, retained
      // identity, stat replacement, gear limits, and early end conditions.
      expect(alterSelfDescriptions).toEqual([
        'Aquatic Adaptation lets you breathe underwater and grants a Swim Speed equal to your Speed for the duration.',
        'Change Appearance alters your outward look and voice while keeping the same basic body shape and game statistics; physical inspection can reveal the disguise.',
        'Natural Weapons grow claws, fangs, horns, or hooves that make your Unarmed Strikes deal 1d6 of the chosen physical damage type using your spellcasting ability for attack and damage rolls.'
      ]);
      expect(enlarge?.description).toBe('Enlarge increases the target size by one category after any required Constitution save, along with worn and carried gear. The target has Advantage on Strength checks and Strength saves, and its weapon attacks and Unarmed Strikes deal an extra 1d4 damage.');
      expect(reduce?.description).toBe('Reduce decreases the target size by one category after any required Constitution save, along with worn and carried gear. The target has Disadvantage on Strength checks and Strength saves, and its weapon attacks and Unarmed Strikes deal 1d4 less damage, to a minimum of 1.');
      expect(polymorphUtility?.description).toBe('One visible creature within 60 feet makes a Wisdom save or transforms into a Beast you choose for up to 1 hour with concentration, with CR no higher than the target CR or level. The target uses the Beast stat block while retaining alignment, personality, creature type, Hit Points, and Hit Point Dice, gains Beast-form Temporary Hit Points that vanish when the spell ends, cannot speak or cast spells, is limited by Beast anatomy, cannot use or benefit from merged gear, and the spell ends early when those Temporary Hit Points are depleted.');
    });

    it('keeps gaseous animal and polymorph rows tied to form limits and ending rules', () => {
      const gaseousForm = getSpells(3).find(spell => spell.id === 'gaseous-form');
      const animalShapes = getSpells(8).find(spell => spell.id === 'animal-shapes');
      const polymorph = getSpells(4).find(spell => spell.id === 'polymorph');
      const gaseousFormDescriptions = gaseousForm?.effects.map(effect => effect.description) ?? [];
      const animalShapesUtility = animalShapes?.effects.find(effect => effect.type === 'UTILITY');
      const polymorphUtility = polymorph?.effects.find(effect => effect.type === 'UTILITY');

      // These Beast/form rows need target scope, retained traits, movement and
      // anatomy limits, equipment merging, temporary-hit-point endings, and
      // self-ending actions visible without opening the full card.
      expect(gaseousFormDescriptions).toEqual([
        'While transformed into misty cloud form, the target has Resistance to Bludgeoning, Piercing, and Slashing damage.',
        'While transformed into misty cloud form, the target cannot be knocked Prone.',
        'Touch one willing creature and transform it, plus worn and carried gear, into misty cloud form for up to 1 hour with concentration; higher slots add one target per slot level above 3. The target only has a 10-foot Fly Speed with hover, has Advantage on Strength, Dexterity, and Constitution saves, can share creature spaces and pass through narrow openings, treats liquids as solid, cannot speak, manipulate or drop objects, attack, or cast spells, and the form ends for that target at 0 Hit Points or when it uses a Magic action to end it.'
      ]);
      expect(animalShapesUtility?.description).toBe('Choose any number of willing visible creatures within 30 feet for up to 24 hours and shape-shift each into a caster-chosen Large-or-smaller Beast form of Challenge Rating 4 or lower, with different forms allowed per target and later Magic-action re-transforms. Targets use Beast statistics but retain creature type, Hit Points, Hit Point Dice, alignment, communication, and Intelligence, Wisdom, and Charisma scores; cannot cast spells; are limited by Beast anatomy; have equipment merged and unusable; and can end their own transformation with a Bonus Action.');
      expect(polymorphUtility?.description).toBe('One visible creature within 60 feet makes a Wisdom save or transforms into a Beast you choose for up to 1 hour with concentration, with CR no higher than the target CR or level. The target uses the Beast stat block while retaining alignment, personality, creature type, Hit Points, and Hit Point Dice, gains Beast-form Temporary Hit Points that vanish when the spell ends, cannot speak or cast spells, is limited by Beast anatomy, cannot use or benefit from merged gear, and the spell ends early when those Temporary Hit Points are depleted.');
    });

    it('keeps low-level zone rows tied to obscuring terrain and repeated trigger facts', () => {
      const fogCloud = getSpells(1).find(spell => spell.id === 'fog-cloud');
      const grease = getSpells(1).find(spell => spell.id === 'grease');
      const web = getSpells(2).find(spell => spell.id === 'web');
      const fogTerrain = fogCloud?.effects.find(effect => effect.type === 'TERRAIN');
      const greaseDescriptions = grease?.effects.map(effect => effect.description) ?? [];
      const webTerrain = web?.effects[0];
      const webRestrained = web?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Restrained'
      );
      const webFire = web?.effects.find(effect => effect.type === 'DAMAGE');
      const webDifficult = web?.effects[3];

      // These low-level zones are common tactical UI surfaces. Their rows should
      // expose obscuring, no-concentration terrain, repeated entry/end triggers,
      // restraint, and burning-web consequences without reopening the full card.
      expect(fogTerrain?.description).toBe('Create a 20-foot-radius Sphere of heavily obscuring fog centered on a point within 120 feet for up to 1 hour with concentration; strong wind disperses the fog, and higher-level slots increase the radius by 20 feet per slot level above 1.');
      expect(greaseDescriptions).toEqual([
        'Nonflammable grease coats a 10-foot square within 60 feet for 1 minute without concentration, making the area Difficult Terrain.',
        'Each creature standing in the 10-foot square when the grease appears makes a Dexterity save or gains the Prone condition.',
        'The first time on a turn that a creature enters the 10-foot square, it makes a Dexterity save or gains the Prone condition.',
        'A creature that ends its turn in the 10-foot square makes a Dexterity save or gains the Prone condition.'
      ]);
      expect(webTerrain?.description).toBe('Create a 20-foot Cube of sticky webs for up to 1 hour with concentration; the webbed area anchors restraint saves, Difficult Terrain, and burning-web damage.');
      expect(webRestrained?.description).toBe('A creature that enters the webs or starts its turn there makes a Dexterity save; on a failure, it has the Restrained condition while caught in the webs.');
      expect(webFire?.description).toBe('If a 5-foot cube of web is ignited, the burning web is destroyed in 1 round and a creature that starts its turn in that burning area takes 2d4 Fire damage.');
      expect(webDifficult?.description).toBe('The webbed 20-foot Cube is Difficult Terrain for the spell duration.');
    });

    it('keeps familiar servant and animated-object command loops player-facing', () => {
      const findFamiliar = getSpells(1).find(spell => spell.id === 'find-familiar');
      const tinyServant = getSpells(3).find(spell => spell.id === 'tiny-servant');
      const animateObjects = getSpells(5).find(spell => spell.id === 'animate-objects');
      const familiarSummon = findFamiliar?.effects.find(effect => effect.type === 'SUMMONING');
      const servantUtility = tinyServant?.effects.find(effect => effect.type === 'UTILITY');
      const animateObjectsUtility = animateObjects?.effects.find(effect => effect.type === 'UTILITY');

      // Companion and object-control rows should expose the command cadence,
      // default behavior, communication or reaction hooks, and disappearance or
      // reversion facts that runtime summaries need most.
      expect(familiarSummon?.description).toBe('Summon one persistent familiar spirit in an animal form at an unoccupied space within range. The familiar acts independently, obeys your commands, and stays until dismissed or reduced to 0 Hit Points. While it is within 100 feet, you can communicate telepathically with it, use a Bonus Action to perceive through its senses until the start of your next turn, and have it deliver your touch spells using its Reaction; you can have only one familiar at a time.');
      expect(servantUtility?.description).toBe('Animate each touched Tiny nonmagical unattended object into a controlled Tiny Servant for 8 hours. As a Bonus Action, you can mentally command any or all servants within 120 feet, they keep following a simple order until complete, they defend themselves if uncommanded, and each servant reverts to object form when it drops to 0 Hit Points.');
      expect(animateObjectsUtility?.description).toBe('Animate eligible nonmagical unattended Huge-or-smaller objects within 120 feet for up to 1 minute with concentration. Object size counts against your spellcasting ability modifier limit, each object becomes an allied Construct that shares your initiative, you can command any within 500 feet as a Bonus Action, uncommanded objects Dodge and avoid harm, and each object reverts at 0 Hit Points with excess damage carrying over.');
    });

    it('preserves live Tiny Servant lifecycle and command state through SpellValidator', () => {
      const parsedTinyServant = SpellValidator.safeParse(tinyServant);

      // Tiny Servant already carries structured lifecycle/control fields in live
      // data. The validator should keep them intact so the spell is first-class
      // control data instead of prose that gets stripped on parse.
      expect(parsedTinyServant.success).toBe(true);

      const servantUtility = parsedTinyServant.data.effects.find(effect => effect.type === 'UTILITY') as any;

      expect(servantUtility?.summonControl).toEqual(expect.objectContaining({
        entityType: 'Tiny Servant',
        commandAction: 'Bonus Action',
        commandRangeFeet: 120,
        persistentOrder: 'continues following order until task complete',
        lifecycle: 'reverts at 0 HP with remaining damage carryover'
      }));
      expect(servantUtility?.animatedObjectState).toEqual(expect.objectContaining({
        creatureType: 'Construct',
        size: 'Tiny',
        lifecycle: expect.objectContaining({
          hitPointEnding: 'servant remains animated until spell ends or it drops to 0 hit points',
          reversion: 'when it drops to 0 hit points, it reverts to its original object form',
          damageCarryover: 'remaining damage carries over to the original object form'
        })
      }));
    });

    it('preserves live Simulacrum lifecycle and control metadata through SpellValidator', () => {
      const simulacrum = getSpells(7).find(spell => spell.id === 'simulacrum');
      const parsedSimulacrum = simulacrum ? SpellValidator.safeParse(simulacrum) : { success: false as const };

      // Simulacrum already encodes persistent lifecycle and command-control
      // metadata in live data. The validator should keep those nested fields
      // intact so the spell stays first-class summon/control data instead of
      // losing the structured ownership packet at parse time.
      expect(parsedSimulacrum.success).toBe(true);

      const summonEffect = parsedSimulacrum.success ? parsedSimulacrum.data.effects.find(effect => effect.type === 'SUMMONING') as any : undefined;
      const summon = summonEffect?.summon;

      expect(summon?.persistent).toBe(true);
      expect(summon?.commandsPerTurn).toBe(1);
      expect(summon?.initiative).toBe('shared');
      expect(summon?.statBlock).toEqual(expect.objectContaining({
        name: 'Simulacrum',
        type: 'Construct',
        size: 'Medium'
      }));
      expect(summon?.lifecycle).toEqual(expect.objectContaining({
        hitPointMaximum: 'half the original creature Hit Point maximum',
        repairOnly: 'damaged simulacrum HP restored only by Long Rest repair costing 100 GP per Hit Point',
        zeroHpEnding: 'at 0 Hit Points, simulacrum reverts to snow and melts away',
        recastEnding: 'casting Simulacrum again instantly destroys any existing simulacrum from this spell'
      }));
      expect(summon?.control).toEqual(expect.objectContaining({
        entityType: 'simulacrum_construct_duplicate',
        source: 'Beast or Humanoid present through casting and snow/ice duplicate material',
        allegiance: 'friendly to caster and creatures caster designates',
        obedience: 'obeys spoken commands',
        restrictions: expect.arrayContaining([
          'cannot learn',
          'cannot become more powerful',
          'cannot regain expended spell slots',
          'cannot take rests to recover resources unless represented elsewhere'
        ])
      }));
    });

    it('keeps command and prison control rows tied to saves turns and escape triggers', () => {
      const confusion = getSpells(4).find(spell => spell.id === 'confusion');
      const geas = getSpells(5).find(spell => spell.id === 'geas');
      const mentalPrison = getSpells(6).find(spell => spell.id === 'mental-prison');
      const confusionStatus = confusion?.effects.find(effect => effect.type === 'STATUS_CONDITION');
      const geasUtility = geas?.effects.find(effect => effect.type === 'UTILITY');
      const geasStatus = geas?.effects.find(effect => effect.type === 'STATUS_CONDITION');
      const mentalPrisonInitialDamage = mentalPrison?.effects[0];
      const mentalPrisonRestrained = mentalPrison?.effects[1];
      const mentalPrisonEscapeDamage = mentalPrison?.effects[2];
      const mentalPrisonUtility = mentalPrison?.effects[3];

      // These rows drive visible control flow: turn behavior tables, command
      // obedience pressure, Charmed immunity, sensory isolation, and explicit
      // escape-trigger damage. The descriptions should preserve those facts in
      // player-facing row text without adding new runtime mechanics.
      expect(confusionStatus?.description).toBe('Each creature in the 10-foot-radius Sphere centered on a point within 90 feet makes a Wisdom save or becomes Confused for up to 1 minute with concentration. While Confused, the target cannot take Bonus Actions or Reactions, rolls 1d10 at the start of each turn to determine that turn behavior from the spell table, and repeats the Wisdom save at the end of each turn to end the spell on itself; each slot level above 4 adds 5 feet to the Sphere radius.');
      expect(geasUtility?.description).toBe('Give one visible creature within 60 feet that can understand you a verbal command to perform a service or avoid an activity for 30 days. On a failed Wisdom save, the target is Charmed, takes 5d10 Psychic damage no more than once each day when it acts directly against the command, ends the spell if given a suicidal command, can be freed by Remove Curse, Greater Restoration, or Wish, and higher slots extend the duration to 365 days at slots 7-8 or until ended at slot 9.');
      expect(geasStatus?.description).toBe('On a failed Wisdom save, the target is Charmed for the 30-day base Geas duration, while a target that cannot understand the command automatically succeeds; higher slots extend the Charmed duration to 365 days at slots 7-8 or until ended at slot 9.');
      expect(mentalPrisonInitialDamage?.description).toBe('One visible creature within 60 feet makes an Intelligence save, automatically succeeding if immune to Charmed. The target takes 5d10 Psychic damage on a success or failure, and the spell ends immediately on a successful save.');
      expect(mentalPrisonRestrained?.description).toBe('On a failed Intelligence save, the target is Restrained for up to 1 minute with concentration inside an illusory cell only it perceives, cannot see or hear beyond the illusion, and triggers the escape damage if it leaves, attacks through, or reaches through the illusion.');
      expect(mentalPrisonEscapeDamage?.description).toBe('If the target leaves the illusory cell, makes a melee attack through it, or reaches through it, the target takes 10d10 Psychic damage and the spell ends.');
      expect(mentalPrisonUtility?.description).toBe('Create an illusory cell around the target space that only the target perceives. A target immune to Charmed automatically succeeds on the Intelligence save; on a failed save, the illusion blocks sight and hearing beyond it and defines the leave, attack-through, or reach-through escape triggers.');
    });

    it('keeps disease mode and plant restraint rows tied to progression and exits', () => {
      const contagion = getSpells(5).find(spell => spell.id === 'contagion');
      const eyebite = getSpells(6).find(spell => spell.id === 'eyebite');
      const entangle = getSpells(1).find(spell => spell.id === 'entangle');
      const contagionDescriptions = contagion?.effects.map(effect => effect.description) ?? [];
      const eyebiteDescriptions = eyebite?.effects.map(effect => effect.description) ?? [];
      const entangleDescriptions = entangle?.effects.map(effect => effect.description) ?? [];

      // These rows carry multi-step state that runtime summaries need to show:
      // Contagion's three-success / three-failure progression, Eyebite's option
      // targeting lockout, and Entangle's terrain plus repeated restraint exits.
      expect(contagionDescriptions).toEqual([
        'A creature you touch makes a Constitution save; on a failure, it takes 11d8 Necrotic damage and gains the Poisoned condition from the magical contagion.',
        'On a failed Constitution save, the target is Poisoned and repeats the save at the end of each turn until it reaches three successes or three failures. Three successes end the spell on that target; three failures make the Poisoned condition last for 7 days, and attempts to end that Poisoned condition require another Constitution save.',
        'Choose one ability when you cast Contagion; while Poisoned by this spell, the target has Disadvantage on saving throws made with that chosen ability.'
      ]);
      expect(eyebiteDescriptions).toEqual([
        'Asleep option: on a failed Wisdom save, one visible creature within 60 feet becomes Unconscious until it takes damage or another creature uses an action to shake it awake.',
        'Panicked option: on a failed Wisdom save, one visible creature within 60 feet is Frightened of you, must Dash away by the safest shortest route on each turn while possible, and the effect ends if it reaches a space at least 60 feet away where it cannot see you.',
        'Sickened option: on a failed Wisdom save, one visible creature within 60 feet has Disadvantage on attack rolls and ability checks, then repeats the Wisdom save at the end of each of its turns and ends the effect on a success.',
        'For up to 1 minute with concentration, your eyes become inky voids. On the initial cast and again with a Magic action on later turns, choose Asleep, Panicked, or Sickened for one visible creature within 60 feet; a creature that succeeds on a Wisdom save against this casting cannot be targeted by it again.'
      ]);
      expect(entangleDescriptions).toEqual([
        'Create a 20-foot Square of grasping plants within 90 feet for up to 1 minute with concentration; the area is Difficult Terrain until the spell ends.',
        'Each creature in the 20-foot Square when the plants appear makes a Strength save or gains the Restrained condition for up to 1 minute, with a Strength (Athletics) action to escape and the listed end-turn Wisdom save to end it.',
        'The first time on a turn that a creature enters the 20-foot Square, it makes a Strength save or gains the Restrained condition, with the same Strength (Athletics) escape action and listed end-turn Wisdom save.',
        'A creature that ends its turn in the 20-foot Square makes a Strength save or gains the Restrained condition, with the same Strength (Athletics) escape action and listed end-turn Wisdom save.'
      ]);
    });

    it('keeps storm cloud and curse rows tied to repeated triggers and mode choices', () => {
      const callLightning = getSpells(3).find(spell => spell.id === 'call-lightning');
      const bestowCurse = getSpells(3).find(spell => spell.id === 'bestow-curse');
      const cloudkill = getSpells(5).find(spell => spell.id === 'cloudkill');
      const callLightningDescriptions = callLightning?.effects.map(effect => effect.description) ?? [];
      const bestowCurseUtility = bestowCurse?.effects.find(effect => effect.type === 'UTILITY');
      const cloudkillDescriptions = cloudkill?.effects.map(effect => effect.description) ?? [];

      // These rows drive persistent battlefield UI: reusable Magic actions,
      // modal curse choices, and repeated fog damage triggers. Each row should
      // carry its trigger, save branch, scaling, and cleanup facts directly.
      expect(callLightningDescriptions).toEqual([
        'Choose a visible point under the storm cloud; each creature within 5 feet of that point makes a Dexterity save, taking 3d10 Lightning damage on a failure or half as much on a success. Outdoor storm control adds +1d10 damage, and each slot level above 3 adds +1d10 damage.',
        'For up to 10 minutes with concentration, you can use a Magic action on later turns to call lightning again at the same point or a different point under the storm cloud.'
      ]);
      expect(bestowCurseUtility?.description).toBe('Touch one creature and force a Wisdom save; on a failure, choose one curse for the duration: Disadvantage on checks and saves with one ability score, Disadvantage on attacks against you, a start-turn Wisdom save that can waste the target action, +1d8 Necrotic damage from your attacks and spells, or a DM-approved alternative no stronger than those options. Remove Curse ends the curse, and higher slots extend duration or remove Concentration as listed in the scaling table.');
      expect(cloudkillDescriptions).toEqual([
        'When the 20-foot-radius fog sphere appears, each creature in it makes a Constitution save, taking 5d8 Poison damage on a failed save or half as much on a success; each slot level above 5 adds +1d8 damage.',
        'The first time on a turn that a creature enters the fog sphere or the sphere moves into its space, it makes a Constitution save, taking 5d8 Poison damage on a failed save or half as much on a success; each slot level above 5 adds +1d8 damage.',
        'A creature that ends its turn in the fog sphere makes a Constitution save, taking 5d8 Poison damage on a failed save or half as much on a success; each slot level above 5 adds +1d8 damage.',
        'Create a 20-foot-radius Sphere of yellow-green, Heavily Obscured fog for up to 10 minutes with concentration. Strong wind disperses the fog and ends the spell, and the sphere moves 10 feet away from you at the start of each of your turns.'
      ]);
    });

    it('keeps ray table and threshold rows tied to branch outcomes', () => {
      const prismaticSpray = getSpells(7).find(spell => spell.id === 'prismatic-spray');
      const divineWord = getSpells(7).find(spell => spell.id === 'divine-word');
      const powerWordKill = getSpells(9).find(spell => spell.id === 'power-word-kill');
      const prismaticDescriptions = prismaticSpray?.effects.map(effect => effect.description) ?? [];
      const divineWordDescriptions = divineWord?.effects.map(effect => effect.description) ?? [];
      const powerWordKillDescriptions = powerWordKill?.effects.map(effect => effect.description) ?? [];

      // Table and threshold spells need compact row text that still exposes
      // exact branch routing. These expectations preserve existing saves,
      // thresholds, and outcomes while removing ambiguous shortcut phrasing.
      expect(prismaticDescriptions).toEqual([
        'Red, orange, yellow, green, and blue rays deal 12d6 damage of the rolled ray damage type on a failed Dexterity save, or half as much damage on a successful save.',
        'Indigo ray: on a failed Dexterity save, the target gains the Restrained condition and starts the end-turn Constitution save track. Three successes end the condition, and three failures impose Petrified.',
        'Indigo ray Petrified branch: after three failed end-turn Constitution saves while Restrained, the target has the Petrified condition until freed by an effect such as Greater Restoration.',
        'Violet ray: on a failed Dexterity save, the target gains the Blinded condition until the start-of-next-turn Wisdom save resolves.',
        'Violet ray follow-up: a target that failed the Dexterity save stays Blinded until the start-of-next-turn Wisdom save; on a failed Wisdom save, Blinded ends and the target teleports to a DM-chosen plane.',
        'Emit eight rays in a 60-foot Cone. Each creature in the cone makes a Dexterity save, then rolls 1d8 for its Prismatic Rays table color; a result of 8 strikes the target with two rays, rolling twice and rerolling any further 8s.'
      ]);
      expect(divineWordDescriptions).toEqual([
        'On a failed Charisma save, a chosen creature within 30 feet with 20 Hit Points or fewer dies; Celestial, Elemental, Fey, or Fiend targets also resolve the planar return branch on the same failed save.',
        'On a failed Charisma save, a target with 21 to 30 Hit Points has the Blinded condition for 1 hour; that same HP band also receives Deafened and Stunned from the Divine Word table.',
        'On a failed Charisma save, a target with 21 to 30 Hit Points has the Deafened condition for 1 hour; that same HP band also receives Blinded and Stunned from the Divine Word table.',
        'On a failed Charisma save, a target with 21 to 30 Hit Points has the Stunned condition for 1 hour; that same HP band also receives Blinded and Deafened from the Divine Word table.',
        'On a failed Charisma save, a target with 31 to 40 Hit Points has the Deafened condition for 10 minutes.',
        'On a failed Charisma save, a target with 41 to 50 Hit Points has the Deafened condition for 1 minute.',
        'Regardless of Hit Points, a Celestial, Elemental, Fey, or Fiend target that fails its Charisma save is forced back to its plane of origin if it is not already there and cannot return to the current plane for 24 hours except by Wish.',
        'Choose creatures within 30 feet to make a Charisma save. Failed targets with 50 Hit Points or fewer resolve the Divine Word HP table: death at 20 or fewer, Blinded/Deafened/Stunned at 21 to 30, 10-minute Deafened at 31 to 40, and 1-minute Deafened at 41 to 50; failed Celestial, Elemental, Fey, or Fiend targets also resolve planar return and the 24-hour Wish-only return block.'
      ]);
      expect(powerWordKillDescriptions).toEqual([
        'If the visible target within 60 feet has more than 100 Hit Points, it takes 12d12 Psychic damage instead of dying.',
        'Choose one visible creature within 60 feet. If the target has 100 Hit Points or fewer, it dies; if it has more than 100 Hit Points, it takes the 12d12 Psychic fallback damage instead.'
      ]);
    });

    it('keeps threshold pain stun and hostile-target rows tied to branch gates', () => {
      const powerWordStun = getSpells(8).find(spell => spell.id === 'power-word-stun');
      const powerWordPain = getSpells(7).find(spell => spell.id === 'power-word-pain');
      const enemiesAbound = getSpells(3).find(spell => spell.id === 'enemies-abound');
      const powerWordStunDescriptions = powerWordStun?.effects.map(effect => effect.description) ?? [];
      const powerWordPainDescriptions = powerWordPain?.effects.map(effect => effect.description) ?? [];
      const enemiesAboundStatus = enemiesAbound?.effects.find(effect => effect.type === 'STATUS_CONDITION');

      // These rows have hard branch gates that matter in runtime logs: HP
      // thresholds, Charmed/Frightened immunity gates, repeat saves, speed caps,
      // random hostile targeting, and forced opportunity attacks.
      expect(powerWordStunDescriptions).toEqual([
        'Choose one visible creature within 60 feet. If the target has 150 Hit Points or fewer, it has the Stunned condition and repeats Constitution saves at the end of each turn; if it has more than 150 Hit Points, its Speed becomes 0 until the start of your next turn.',
        'If the visible target has 150 Hit Points or fewer, it has the Stunned condition and repeats the Constitution save at the end of each of its turns, ending Stunned on a success.',
        'If the visible target has more than 150 Hit Points, its Speed becomes 0 until the start of your next turn instead of applying Stunned.'
      ]);
      expect(powerWordPainDescriptions).toEqual([
        'One visible creature within 60 feet is affected only if it has 100 Hit Points or fewer and is not immune to Charmed. While in crippling pain, spellcasting requires a Constitution save, and the target repeats the Constitution save at the end of each turn to end the pain on a success.',
        'While Power Word Pain affects the target, every Speed it has is capped at 10 feet until an end-turn Constitution save succeeds and ends the pain.',
        'While affected, the target has Disadvantage on attack rolls, ability checks, and saving throws other than Constitution saves.',
        'Choose one visible creature within 60 feet. If the target has 100 Hit Points or fewer and is not immune to Charmed, it suffers crippling pain; while affected, spellcasting requires a Constitution save or wastes the spell, and end-turn Constitution saves can end the pain.'
      ]);
      expect(enemiesAboundStatus?.description).toBe('On a failed Intelligence save, the target treats every visible creature as an enemy for up to 1 minute with concentration, chooses targets randomly from visible creatures in range, and must make available opportunity attacks. A target immune to Frightened automatically succeeds, and damage lets the target repeat the Intelligence save to end the effect.');
    });

    it('keeps dominate command links and feeblemind lockouts player-facing', () => {
      const dominateMonster = getSpells(8).find(spell => spell.id === 'dominate-monster');
      const dominatePerson = getSpells(5).find(spell => spell.id === 'dominate-person');
      const feeblemind = getSpells(8).find(spell => spell.id === 'feeblemind');
      const dominateMonsterDescriptions = dominateMonster?.effects.map(effect => effect.description) ?? [];
      const dominatePersonUtility = dominatePerson?.effects.find(effect => effect.type === 'UTILITY');
      const feeblemindDescriptions = feeblemind?.effects.map(effect => effect.description) ?? [];

      // Command-link and long-term lockout rows are easy to flatten into vague
      // control prose. These expectations keep same-plane links, no-action
      // commands, Reaction costs, repeat saves, and restoration exits visible.
      expect(dominateMonsterDescriptions).toEqual([
        'While the Charmed target is on the same plane as you, you have a telepathic link and can issue no-action commands on your turn. The target obeys on its turn, acts self-protectively after completing orders, and you can spend your Reaction to command the target to take a Reaction.',
        'One visible creature within 60 feet has Advantage on the Wisdom save if you or your allies are fighting it; on a failed save, it is Charmed for the concentration duration, linked telepathically for commands, and repeats the save whenever it takes damage, ending the spell on a success.'
      ]);
      expect(dominatePersonUtility?.description).toBe('On a failed Wisdom save, one visible Humanoid within 60 feet is Charmed for up to 1 minute with concentration, linked telepathically while on the same plane, obeys no-action commands on your turn, repeats the save whenever it takes damage, and can be commanded to take a Reaction if you spend your Reaction. Higher slots extend the concentration duration.');
      expect(feeblemindDescriptions).toEqual([
        'One visible creature within 150 feet takes 4d6 Psychic damage and makes an Intelligence save. On a failed save, its Intelligence and Charisma become 1, it cannot cast spells, activate magic items, understand language, or communicate intelligibly, and it repeats the Intelligence save every 30 days until the spell ends.',
        'The failed-save target cannot cast spells, activate magic items, understand language, or communicate intelligibly, but can still recognize, follow, and protect friends. It repeats the Intelligence save every 30 days, and Greater Restoration, Heal, or Wish can also end the spell.',
        'On a failed Intelligence save, the creature Intelligence and Charisma scores become 1, and it loses spellcasting, magic item activation, language understanding, and intelligible communication.'
      ]);
    });

    it('hard-fails concentration tag mismatches across all spells', () => {
      const concentrationFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Concentration Mismatch'));

        if (relevantErrors.length > 0) {
          concentrationFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // Concentration is both runtime state and player-facing spell metadata.
      // This corpus gate keeps duration.concentration and tags aligned so UI,
      // audit, and glossary surfaces do not silently diverge from command logic.
      if (concentrationFailures.length > 0) {
        console.warn(`Concentration Tag Failures (${concentrationFailures.length}):\n${concentrationFailures.join('\n')}`);
      }

      expect(concentrationFailures).toHaveLength(0);
    });

    it('hard-fails ritual tag mismatches across all spells', () => {
      const ritualFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Ritual Mismatch'));

        if (relevantErrors.length > 0) {
          ritualFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // Ritual tags drive spellbook and glossary filtering. This corpus gate
      // keeps those player-facing surfaces aligned with ritual casting rules.
      if (ritualFailures.length > 0) {
        console.warn(`Ritual Tag Failures (${ritualFailures.length}):\n${ritualFailures.join('\n')}`);
      }

      expect(ritualFailures).toHaveLength(0);
    });

    it('hard-fails duration progression mismatches across all spells', () => {
      const durationProgressionFailures: string[] = [];
      const durationProgressionSpellIds: string[] = [];

      allSpells.forEach(spell => {
        const progression = (spell as Spell & { durationProgression?: unknown[] }).durationProgression;
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Duration Progression'));

        if (Array.isArray(progression) && progression.length > 0) {
          durationProgressionSpellIds.push(spell.id || spell.name);
        }

        if (relevantErrors.length > 0) {
          durationProgressionFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // These four current corpus rows carry the first modeled permanence
      // progressions: same-target daily casting, same-location daily casting,
      // and full-duration concentration. The exact list makes accidental row
      // removal visible while the validator keeps future added rows honest.
      expect(durationProgressionSpellIds.sort()).toEqual([
        'mordenkainens-private-sanctum',
        'nystuls-magic-aura',
        'temple-of-the-gods',
        'wall-of-stone'
      ]);

      if (durationProgressionFailures.length > 0) {
        console.warn(`Duration Progression Failures (${durationProgressionFailures.length}):\n${durationProgressionFailures.join('\n')}`);
      }

      expect(durationProgressionFailures).toHaveLength(0);
    });

    it('hard-fails mode choice mismatches across all spells', () => {
      const modeChoiceFailures: string[] = [];
      const modeChoiceSpellIds: string[] = [];

      allSpells.forEach(spell => {
        const modeChoice = (spell as Spell & { modeChoice?: unknown }).modeChoice;
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Mode Choice Invalid'));

        if (modeChoice) {
          modeChoiceSpellIds.push(spell.id || spell.name);
        }

        if (relevantErrors.length > 0) {
          modeChoiceFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // The current corpus uses modeChoice for cantrip utility menus plus early
      // choice spells such as Blindness/Deafness, Alter Self, Enlarge/Reduce,
      // Plant Growth, Alarm, and Control Water. Keeping the list explicit makes
      // accidental menu removal visible while the validator checks index sanity.
      expect(modeChoiceSpellIds.sort()).toEqual([
        'alarm',
        'alter-self',
        'blindness-deafness',
        'control-water',
        'dancing-lights',
        'druidcraft',
        'elementalism',
        'enlarge-reduce',
        'minor-illusion',
        'mold-earth',
        'plant-growth',
        'prestidigitation',
        'shape-water',
        'thaumaturgy'
      ]);

      if (modeChoiceFailures.length > 0) {
        console.warn(`Mode Choice Failures (${modeChoiceFailures.length}):\n${modeChoiceFailures.join('\n')}`);
      }

      expect(modeChoiceFailures).toHaveLength(0);
    });

    it('hard-fails malformed action-cost metadata across all spells', () => {
      const actionCostFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Action Cost'));

        if (relevantErrors.length > 0) {
          actionCostFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // Created-object, sustained-hazard, and re-commanded rows rely on these
      // fields for player-facing action economy. This gate does not close the
      // broader Package 19 object-lifecycle work; it only prevents malformed
      // action-cost metadata from entering the corpus unnoticed.
      if (actionCostFailures.length > 0) {
        console.warn(`Action Cost Failures (${actionCostFailures.length}):\n${actionCostFailures.join('\n')}`);
      }

      expect(actionCostFailures).toHaveLength(0);
    });

    it('hard-fails malformed light metadata across all spells', () => {
      const lightMetadataFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Light Metadata'));

        if (relevantErrors.length > 0) {
          lightMetadataFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // Light utility rows create visible map artifacts, so their radius and
      // attachment data must be executable before the renderer or turn cleanup
      // can treat them as real spell behavior.
      if (lightMetadataFailures.length > 0) {
        console.warn(`Light Metadata Failures (${lightMetadataFailures.length}):\n${lightMetadataFailures.join('\n')}`);
      }

      expect(lightMetadataFailures).toHaveLength(0);
    });
    it('hard-fails monolithic spell effects across all spells', () => {
      const monolithicFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));

        // Collect only the monolithic-effect failures; ignore other rule errors.
        if (errors.some(e => e === 'Monolithic Effect Description')) {
          monolithicFailures.push(spell.id || spell.name);
        }
      });

      // Print the full hit list before failing so the next repair pass knows
      // exactly which rows reintroduced monolithic effect descriptions.
      if (monolithicFailures.length > 0) {
        console.warn(`Monolithic Effect Failures (${monolithicFailures.length}):\n${monolithicFailures.join('\n')}`);
      }

      expect(monolithicFailures).toHaveLength(0);
    });

    it('hard-fails blank or generic effect descriptions across all spells', () => {
      const descriptionFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));
        const relevantErrors = errors.filter(error => error.includes('Effect Description'));

        if (relevantErrors.length > 0) {
          descriptionFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      if (descriptionFailures.length > 0) {
        console.warn(`Effect Description Failures (${descriptionFailures.length}):\n${descriptionFailures.join('\n')}`);
      }

      expect(descriptionFailures).toHaveLength(0);
    });

    it('hard-fails importer scaffold wording in effect descriptions across all spells', () => {
      const scaffoldFailures: string[] = [];

      allSpells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));
        const relevantErrors = errors.filter(error => error.includes('Effect Description Internal Scaffold'));

        if (relevantErrors.length > 0) {
          scaffoldFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // Importer-facing phrases such as "row's current" and "scaffold" are not
      // useful in runtime logs or UI rows. This keeps future repair batches from
      // replacing blank descriptions with text that still describes the migration
      // machinery rather than the spell effect the player sees.
      if (scaffoldFailures.length > 0) {
        console.warn(`Effect Description Internal Scaffold Failures (${scaffoldFailures.length}):\n${scaffoldFailures.join('\n')}`);
      }

      expect(scaffoldFailures).toHaveLength(0);
    });
  });
});
