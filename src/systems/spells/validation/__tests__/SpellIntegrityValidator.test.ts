
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SpellIntegrityValidator } from '../SpellIntegrityValidator';
import { Spell } from '../../../../types/spells';

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

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unit tests: Effect Description Completeness rule
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
      'A creature takes 4d4 Slashing damage the first time on a turn that it enters the Cube or the Cube moves into its space.',
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

  it('keeps Animal Messenger utility description focused on save and delivery facts', () => {
    const animalMessenger = getSpells(2).find(spell => spell.id === 'animal-messenger');
    const utilityEffect = animalMessenger?.effects.find(effect => effect.type === 'UTILITY');

    // Animal Messenger is modeled as one communication utility row with a
    // Charisma save and an auto-success override for non-CR-0 beasts. The row
    // should expose the messenger setup, delivery pace, lost-message failure,
    // and slot-duration scaling without copying the whole card.
    expect(utilityEffect?.description).toBe('Choose a visible Tiny Beast within 30 feet to carry a message of up to 25 words to a described recipient at a visited location. The Beast makes a Charisma save to resist, with non-CR-0 Beasts automatically succeeding; on failure it travels about 25 miles per 24 hours, or 50 miles if it can fly, and the message is lost if it does not arrive before the spell ends. Higher slots extend the duration by 48 hours per slot level above 2nd.');
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
      'On later turns, the caster can use the granted Bonus Action to move the spectral weapon up to 20 feet and repeat the melee spell attack against a creature within 5 feet of it.',
      'You can move the weapon up to 20 feet and repeat the attack against a creature within 5 feet of it.'
    ]);
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
      'Each creature in the 20-foot-radius acid explosion makes a Dexterity save, taking 10d4 Acid damage on a failed save or half as much on a success.',
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
      'As a Bonus Action each turn, the caster can make a ranged spell attack from the sphere\'s center against one creature within 60 feet of the center. The attack has advantage if the target is in the sphere.',
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
      'Create a 20-foot-radius Heavily Obscured sphere of ember-smoke within 150 feet for up to 1 minute with concentration. The cloud lasts until concentration ends or strong wind disperses it, and a creature makes the spell damage save only once per turn.',
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
      'When the fog appears, each creature in the sphere makes a Constitution save, taking 5d8 Poison damage on a failed save or half on a success.',
      'A creature makes the Constitution save when it enters the sphere or when the sphere moves into its space, taking 5d8 Poison damage on a failed save or half on a success; this can happen only once per turn.',
      'A creature that ends its turn in the sphere makes a Constitution save, taking 5d8 Poison damage on a failed save or half on a success; this can happen only once per turn.',
      'Create a 20-foot-radius yellow-green fog sphere for up to 10 minutes with concentration. The fog is Heavily Obscured, disperses and ends the spell in strong wind, and moves 10 feet away from the caster at the start of each caster turn.'
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
    // describe the shared wrapper: area, duration, concentration, one active
    // mode, and later Magic-action repeat or switching.
    expect(utilityEffect?.description).toBe('Control water in a 100-foot cube for up to 10 minutes with concentration. Choose one active mode at a time: Flood, Part Water, Redirect Flow, or Whirlpool. Later Magic actions can repeat the current mode or switch to a different mode.');
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
      'On the same hit, a Huge or smaller target gains the Grappled condition for up to 1 minute and can use an action to make the spell-save-DC escape check.',
      'On a hit, the target is pulled up to 30 feet toward the vine.'
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
      'On the same ranged spell attack hit, the target gains the Poisoned condition until the end of the caster\'s next turn.'
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
      'On the same melee weapon hit, the target gains the Ignited condition for up to 1 minute; at the start of each of its turns, it takes 1d6 Fire damage and then makes a Constitution save that ends the spell on a success.'
    ]);
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
      'On the same ranged spell hit, the target\'s Speed is reduced by 10 feet until the start of the caster\'s next turn.'
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
    // control-option routing without copying the full spell card back into one
    // monolithic row.
    expect(utilityEffect?.description).toBe(
      'Records Otto\'s Irresistible Dance wrapper facts: one visible creature within 30 feet begins a comic dance of shuffling, tapping, and capering, creatures that cannot be Charmed are immune, and sibling rows carry the Wisdom save, Charmed state, all-movement dance lock, attack Disadvantage / attacker Advantage, and repeat-save action.'
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
      'Fear symbol failed save applies Frightened for 1 minute.',
      'Pain symbol failed save applies Incapacitated for 1 minute.',
      'Sleep symbol failed save applies Unconscious for 10 minutes.',
      'Stunning symbol failed save applies Stunned for 1 minute.'
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

    // Hold Monster now has a structured Paralyzed effect row. The companion
    // utility row should explain its helper role, not repeat the whole spell
    // description that belongs at the card level.
    expect(utilityEffect?.description).toBe('Records the Hold Monster control wrapper while the separate Paralyzed effect carries the Wisdom save, repeat save, and condition duration.');
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
    // point to the martial restrictions and option metadata it still owns.
    expect(utilityEffect?.description).toBe('Records Tenser\'s Transformation wrapper facts: the caster cannot cast spells and gains martial-proficiency, weapon-advantage, save-proficiency, and extra-attack benefits while sibling rows carry temporary Hit Points, force damage, and Exhaustion.');
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
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. If the target has 100 Hit Points or fewer, it dies; if it has more than 100 Hit Points, it survives the death word and takes the spell fallback damage instead.');
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
    expect(utilityEffect?.description).toBe('Emit eight rays in a 60-foot cone, with each creature in the cone making a Dexterity save before rolling 1d8 to determine its Prismatic Rays table color. A result of 8 strikes the target with two rays instead, rolling twice and rerolling any further 8s.');
  });

  it('keeps Dominate Monster utility description focused on command-control wrapper facts', () => {
    const dominateMonster = getSpells(8).find(spell => spell.id === 'dominate-monster');
    const utilityEffect = dominateMonster?.effects.find(effect => effect.type === 'UTILITY');

    // Dominate Monster already has a sibling Charmed row for the Wisdom save,
    // combat-advantage modifier, and on-damage repeat save. The utility row
    // should describe the command channel that remains after that payload.
    expect(utilityEffect?.description).toBe('While the Charmed target is on the same plane, the caster has a telepathic link and can issue no-action commands on the caster turn. The target obeys on its turn, acts self-protectively after completing orders, and commanded Reactions cost the caster a Reaction.');
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
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. If the target has 150 Hit Points or fewer, it is Stunned and repeats Constitution saves at the end of each turn; if it has more than 150 Hit Points, its Speed becomes 0 until the start of the caster next turn.');
  });

  it('keeps Arcane Sword utility description focused on sword-control wrapper facts', () => {
    const arcaneSword = getSpells(7).find(spell => spell.id === 'arcane-sword');
    const utilityEffect = arcaneSword?.effects.find(effect => effect.type === 'UTILITY');

    // Arcane Sword already has sibling rows for initial/repeated Force damage
    // and bonus-action sword movement. The utility row should explain the
    // hovering force-sword control contract without duplicating those payloads.
    expect(utilityEffect?.description).toBe('Create a hovering sword-shaped plane of force within range for up to 1 minute with concentration. When it appears, the caster makes a melee spell attack against a target within 5 feet of the sword, and on later turns can use a Bonus Action to move the sword up to 20 feet and repeat the attack against the same or a different target.');
  });

  it('keeps Divine Word utility description focused on table and planar routing facts', () => {
    const divineWord = getSpells(7).find(spell => spell.id === 'divine-word');
    const utilityEffect = divineWord?.effects.find(effect => effect.type === 'UTILITY');

    // Divine Word already has sibling rows for each HP-band condition and the
    // planar-return movement payload. The utility row should explain the
    // routing table and return block without copying those payloads.
    expect(utilityEffect?.description).toBe('Choose creatures within 30 feet to make a Charisma save. On a failed save, targets with 50 Hit Points or fewer resolve the Divine Word Hit Point table, while failed Celestial, Elemental, Fey, or Fiend targets are forced back to their plane of origin if not already there and cannot return to the current plane for 24 hours except by Wish.');
  });

  it('keeps Incendiary Cloud utility description focused on cloud wrapper facts', () => {
    const incendiaryCloud = getSpells(8).find(spell => spell.id === 'incendiary-cloud');
    const utilityEffect = incendiaryCloud?.effects.find(effect => effect.type === 'UTILITY');

    // Incendiary Cloud already has sibling rows for each Fire damage timing and
    // cloud movement. The utility row should explain the cloud shell and
    // once-per-turn guard without copying those damage and movement payloads.
    expect(utilityEffect?.description).toBe('Create a 20-foot-radius Heavily Obscured sphere of ember-smoke within 150 feet for up to 1 minute with concentration. The cloud lasts until concentration ends or strong wind disperses it, and a creature makes the spell damage save only once per turn.');
  });

  it('keeps Power Word Pain utility description focused on threshold and spellcasting wrapper facts', () => {
    const powerWordPain = getSpells(7).find(spell => spell.id === 'power-word-pain');
    const utilityEffect = powerWordPain?.effects.find(effect => effect.type === 'UTILITY');

    // Power Word Pain already has sibling rows for crippling pain, speed cap,
    // and attack/check/save disadvantage. The utility row should explain the
    // threshold, immunity, spellcasting, and ending wrapper facts.
    expect(utilityEffect?.description).toBe('Choose one visible creature within 60 feet. If the target has 100 Hit Points or fewer and is not immune to being Charmed, it suffers crippling pain; while affected, spellcasting requires a Constitution save or wastes the spell, and end-turn Constitution saves can end the pain.');
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

  it('keeps Prismatic Wall utility description focused on wall-shell wrapper facts', () => {
    const prismaticWall = getSpells(9).find(spell => spell.id === 'prismatic-wall');
    const utilityEffect = prismaticWall?.effects.find(effect => effect.type === 'UTILITY');

    // Prismatic Wall already has sibling rows for the near-wall Blinded save
    // and the blocking wall terrain. The utility row should summarize the
    // spell's wall/globe shell, safe-passage, light, and layer routing instead
    // of copying the full spell-card text.
    expect(utilityEffect?.description).toBe('Create either a 90-foot-long, 30-foot-high opaque wall or a 30-foot-diameter globe for 10 minutes, ending with no effect if placed in an occupied space. The multicolored wall sheds bright and dim light, lets the caster and designated creatures pass through and remain near it safely, and keeps seven colored layers with ordered destruction plus Antimagic Field immunity and violet-only Dispel Magic interaction.');
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
    expect(utilityEffect?.description).toBe('The caster transforms into a seen non-Construct, non-Undead creature with an eligible Challenge Rating for up to 1 hour with concentration, and can use a Magic action to choose another eligible form while the spell lasts. The caster retains identity, proficiencies, communication, and Spellcasting where the new form allows, and chooses whether equipment falls, merges, or is worn by the new form.');
  });

  it('keeps Astral Projection utility description focused on astral-travel wrapper facts', () => {
    const astralProjection = getSpells(9).find(spell => spell.id === 'astral-projection');
    const utilityEffect = astralProjection?.effects.find(effect => effect.type === 'UTILITY');

    // Astral Projection already has a sibling status row for the suspended
    // bodies becoming Unconscious. The utility row should summarize the
    // projection shell, silver cord, damage separation, planar re-entry, and
    // dismissal routing without copying that status payload.
    expect(utilityEffect?.description).toBe('Project the caster and up to eight willing creatures into the Astral Plane unless the caster is already there, leaving each body suspended while an astral form travels by silver cord. Cutting the cord kills both body and astral form, body and astral-form damage and effects stay separate, leaving the Astral Plane pulls body and possessions to the new plane, dropping either form to 0 Hit Points ends the spell for that target, and the caster can use a Magic action to dismiss the spell for all targets.');
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
    expect(utilityEffect?.description).toBe('Transform up to ten visible creatures within 120 feet into caster-chosen Beast forms for up to 1 hour with concentration. Unwilling targets make Wisdom saves, unwilling shapechangers automatically succeed, eligible forms must be Beasts the caster has seen within CR or half-level limits, and targets keep Hit Points, alignment, and personality while form statistics, action limits, speech, spellcasting, hands use, gear access, and reversion timing follow the chosen form.');
  });

  it('keeps True Polymorph utility description focused on mode-selection wrapper facts', () => {
    const truePolymorph = getSpells(9).find(spell => spell.id === 'true-polymorph');
    const utilityEffect = truePolymorph?.effects.find(effect => effect.type === 'UTILITY');

    // True Polymorph has a sibling defensive row for creature-to-creature
    // temporary hit points. The utility row should keep the three transformation
    // modes, save, permanence, control, object, and memory facts visible without
    // copying the whole spell card.
    expect(utilityEffect?.description).toBe('Transform one visible creature or nonmagical unattended object within 30 feet using creature-to-creature, creature-to-object, or object-to-creature mode. Unwilling creatures can negate the spell with a Wisdom save, and maintaining concentration for the full hour makes the transformation last until dispelled. The modes preserve CR or level limits, object-size and worn-or-carried eligibility, friendly controlled object-creature behavior, loss of caster control after one hour, retained hit points, Hit Point Dice, alignment, and personality for creature forms, action, speech, spellcasting, and gear limits, and no memory of time spent as an object.');
  });

  it('keeps Wish utility description focused on mode and stress routing facts', () => {
    const wish = getSpells(9).find(spell => spell.id === 'wish');
    const utilityEffect = wish?.effects.find(effect => effect.type === 'UTILITY');

    // Wish has sibling rows for Instant Health, Resistance, Spell Immunity, and
    // post-stress Necrotic damage. The utility row should summarize the choice
    // menu and stress wrapper without copying every payload already owned by
    // those structured rows.
    expect(utilityEffect?.description).toBe('Choose either level-8-or-lower spell duplication without normal requirements or a non-duplication Wish mode: Object Creation, Instant Health, Resistance, Spell Immunity, Sudden Learning, Roll Redo, or Reshape Reality. Any non-duplication use triggers Wish stress: Strength becomes 3 for 2d4 days with rest-based recovery reduction, each spell cast before a Long Rest deals irreducible Necrotic damage per spell level, and there is a 33 percent chance the caster can never cast Wish again.');
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
    expect(utilityEffect?.description).toBe('Choose any number of willing visible creatures within 30 feet to shape-shift into caster-chosen Large-or-smaller Beast forms of Challenge Rating 4 or lower, with different forms allowed per target and later Magic-action re-transforms. Targets use Beast statistics but retain creature type, Hit Points, Hit Point Dice, alignment, communication, and Intelligence, Wisdom, and Charisma scores; cannot cast spells; are limited by Beast anatomy; have equipment merged and unusable; and can end the transformation with a Bonus Action.');
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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
      expect(utilityEffect?.description).toBe("Create a 5-foot-wide, 10-foot-tall shimmering door within 300 feet for 24 hours leading to a clean, fresh, warm extradimensional dwelling. The caster and designated creatures can enter while the door is open, the caster can open or close it without an action while within 30 feet, the closed door is imperceptible, the mansion can use any floor plan up to 50 contiguous 10-foot cubes with caster-chosen furnishings and decoration, it provides a nine-course banquet for up to 100 people, and created furnishings or objects dissipate into smoke if removed.");
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



