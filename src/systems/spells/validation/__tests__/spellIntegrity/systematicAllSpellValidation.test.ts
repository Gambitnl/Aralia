import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { SpellValidator } from '../../spellValidator';
import { Spell } from '../../../../../types/spells';
import tinyServant from '../../../../../../public/data/spells/level-3/tiny-servant.json';
import { filterReviewedMonolithicClearance, getSpells } from './spellFixtures';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

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
      expect(
        unclassifiedMismatches,
        `Restricted-filter mismatches need a data repair or an explicit semantic classification:\n${unclassifiedMismatches.join('\n')}`
      ).toHaveLength(0);

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
        'Animate one pile of bones or one corpse of a Medium or Small Humanoid within 10 feet, creating one persistent Undead for 24 hours: bones become a Skeleton and a corpse becomes a Zombie.',
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
        'Ward up to 40,000 square feet for 1 day so chosen Aberrations, Celestials, Elementals, Fey, Fiends, or Undead take 5d10 Radiant or Necrotic damage, chosen at cast time, when they enter the warded area or start their turn there unless protected by the chosen password.'
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
      // Life Transference deliberately separates self-damage from healing so
      // the runtime can resolve the actual damage before doubling that result.
      expect(lifeTransference?.effects[0]?.description).toBe('The caster takes 4d8 Necrotic damage that cannot be reduced; each slot level above 3 adds +1d8 self-damage before the companion healing effect is doubled.');
      expect(lifeTransference?.effects[1]?.description).toBe('One visible creature within 30 feet regains Hit Points equal to twice the Necrotic damage the caster actually took from the companion self-damage effect.');
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
      const wallOfFireUtility = wallOfFire?.effects.find(effect => effect.type === 'UTILITY');
      const wallOfFireDamage = wallOfFire?.effects.filter(effect => effect.type === 'DAMAGE') ?? [];

      // These spells are not plain condition or damage rows. Their runtime
      // value depends on wall shape, selected damage sides, creature push
      // choices, destroyed-section hazards, and Banishment's return/permanent
      // transport branch for specific extraplanar creature families.
      expect(wallOfFireUtility?.description).toBe('Create the persistent opaque wall or ring of fire so map and hazard systems can track its shape, chosen damage side, and spell-duration lifetime.');
      expect(wallOfFireDamage[0]?.description).toBe('When the opaque wall appears as either a 60-foot-long, 20-foot-high, 1-foot-thick wall or a 20-foot-diameter, 20-foot-high, 1-foot-thick ring within 120 feet, each creature in its area makes a Dexterity save, taking 5d8 Fire damage on a failure or half as much on a success; each slot level above 4 adds +1d8 damage.');
      expect(wallOfFireDamage[1]?.description).toBe('A creature takes 5d8 Fire damage, plus +1d8 per slot level above 4, when it enters the wall for the first time on a turn; only the caster-selected side deals 10-foot proximity damage, and the other side deals no damage.');
      expect(wallOfFireDamage[2]?.description).toBe('A creature takes 5d8 Fire damage, plus +1d8 per slot level above 4, when it ends its turn inside the wall or within 10 feet of the caster-selected damage side; the other side deals no damage.');
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
      const waterySphereUtility = waterySphere?.effects.find(effect => effect.type === 'UTILITY');
      const waterySphereRestraint = waterySphere?.effects.find(effect => effect.type === 'STATUS_CONDITION');

      // These control rows drive visible turn behavior. Their descriptions
      // should expose the affected area or target set, repeat-save timing, and
      // the movement/action consequences that make each condition meaningful.
      expect(compulsion?.effects[0]?.description).toBe('Each chosen visible creature within 30 feet makes a Wisdom save or is Charmed for up to 1 minute with concentration; while Charmed, the caster can use a Bonus Action to choose a horizontal direction, the target must use as much movement as possible on its next turn to move that way by the safest route, and after moving it repeats the Wisdom save, ending the spell on itself on a success.');
      expect(confusion?.effects[0]?.description).toBe('Each creature in the 10-foot-radius Sphere centered on a point within 90 feet makes a Wisdom save or becomes Confused for up to 1 minute with concentration. While Confused, the target cannot take Bonus Actions or Reactions, rolls 1d10 at the start of each turn to determine that turn behavior from the spell table, and repeats the Wisdom save at the end of each turn to end the spell on itself; each slot level above 4 adds 5 feet to the Sphere radius.');
      expect(waterySphereUtility?.description).toBe('Create the movable sphere of water so map and combat systems can track its hover limit, movement, occupant capacity, ejection rules, flame extinguish radius, and spell-end disappearance.');
      expect(waterySphereRestraint?.description).toBe('A Large or smaller creature in the 5-foot-radius water Sphere within 90 feet can choose to fail the Strength save; on a failed save it is Restrained and engulfed for up to 1 minute with concentration, moves with the sphere, repeats the Strength save at the end of each turn to escape, and is knocked Prone where the sphere falls when the spell ends. Huge or larger creatures automatically succeed.');
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
      // Counterspell is routed by its casting trigger rather than an immediate
      // effect row because it must stop the original command before execution.
      // Keep both the player-facing outcome and visible-reaction gate covered.
      expect(counterspell?.description).toBe("You attempt to interrupt a creature in the process of casting a spell. The creature makes a Constitution saving throw. On a failed save, the spell dissipates with no effect, and the action, Bonus Action, or Reaction used to cast it is wasted. If that spell was cast with a spell slot, the slot isn't expended.");
      expect(counterspell?.castingTime.reactionCondition).toBe('which you take when you see a creature within 60 feet of you casting a spell');
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
      // Web now starts with a utility wrapper that summarizes the physical
      // webbing. Select the executable terrain row by type so that wrapper does
      // not displace the restraint and recurring-hazard assertions.
      const webTerrainRows = web?.effects.filter(effect => effect.type === 'TERRAIN') ?? [];
      const webTerrain = webTerrainRows[0];
      const webRestrained = web?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION' && effect.statusCondition?.name === 'Restrained'
      );
      const webFire = web?.effects.find(effect => effect.type === 'DAMAGE');
      const webDifficult = webTerrainRows[1];

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

    it('hard-fails unclassified mode choice mismatches across all spells', () => {
      const modeChoiceFailures: string[] = [];
      const modeChoiceFailureIds: string[] = [];
      const modeChoiceSpellIds: string[] = [];

      allSpells.forEach(spell => {
        const modeChoice = (spell as Spell & { modeChoice?: unknown }).modeChoice;
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Mode Choice Invalid'));

        if (modeChoice) {
          modeChoiceSpellIds.push(spell.id || spell.name);
        }

        if (relevantErrors.length > 0) {
          modeChoiceFailureIds.push(spell.id || spell.name);
          modeChoiceFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // The structured migration now exposes every authored player choice,
      // including damage types, summon forms, persistent-object modes, and
      // utility menus. Keep the complete list explicit so accidental menu loss
      // remains visible while the validator separately checks option indexes.
      expect(modeChoiceSpellIds.sort()).toEqual([
        'alarm',
        'alter-self',
        'animate-dead',
        'bestow-curse',
        'bigbys-hand',
        'blindness-deafness',
        'calm-emotions',
        'chromatic-orb',
        'clairvoyance',
        'commune-with-nature',
        'conjure-celestial',
        'conjure-elemental',
        'conjure-minor-elementals',
        'conjure-volley',
        'contagion',
        'control-water',
        'control-winds',
        'create-or-destroy-water',
        'dancing-lights',
        'daylight',
        'destructive-wave',
        'detect-thoughts',
        'dragons-breath',
        'druid-grove',
        'druidcraft',
        'elemental-bane',
        'elemental-weapon',
        'elementalism',
        'enlarge-reduce',
        'find-familiar',
        'find-greater-steed',
        'find-steed',
        'fire-shield',
        'forbiddance',
        'giant-insect',
        'glyph-of-warding',
        'greater-restoration',
        'guards-and-wards',
        'hallow',
        'hex',
        'hunger-of-hadar',
        'leomunds-tiny-hut',
        'magic-circle',
        'melfs-minute-meteors',
        'minor-illusion',
        'mold-earth',
        'nystuls-magic-aura',
        'planar-ally',
        'plant-growth',
        'prestidigitation',
        'protection-from-energy',
        'pyrotechnics',
        'scrying',
        'sequester',
        'shape-water',
        'spirit-guardians',
        'summon-aberration',
        'summon-beast',
        'summon-celestial',
        'summon-construct',
        'summon-dragon',
        'summon-elemental',
        'summon-fey',
        'summon-fiend',
        'summon-undead',
        'symbol',
        'telekinesis',
        'teleport',
        'thaumaturgy',
        'transmute-rock',
        'wall-of-ice'
      ]);

      // DEBT: The current ModeChoice type only models one global choice.
      // Commune with Nature needs choose-three-of-five semantics, while
      // Conjure Celestial needs one choice per affected target. Keep those two
      // exact records visible until the dashboard owner selects an extension;
      // any new failure or a stale classification still breaks this gate.
      expect(
        modeChoiceFailureIds.sort(),
        `Unreviewed mode-choice failures:\n${modeChoiceFailures.join('\n')}`
      ).toEqual([
        'commune-with-nature',
        'conjure-celestial'
      ]);
    });

    it('hard-fails unclassified malformed action-cost metadata across all spells', () => {
      const actionCostFailures: string[] = [];
      const actionCostFailureIds: string[] = [];

      allSpells.forEach(spell => {
        const errors = SpellIntegrityValidator.validate(spell);
        const relevantErrors = errors.filter(error => error.includes('Action Cost'));

        if (relevantErrors.length > 0) {
          actionCostFailureIds.push(spell.id || spell.name);
          actionCostFailures.push(`${spell.id || spell.name}: ${relevantErrors.join(', ')}`);
        }
      });

      // DEBT: These records mix legacy actionType/name fields with domain
      // actions such as free commands, questions, and Magic actions. Their
      // canonical mapping is a dashboard decision. This exact list prevents
      // new malformed records while also failing when a migrated record leaves
      // stale debt behind.
      expect(
        actionCostFailureIds.sort(),
        `Unreviewed action-cost failures:\n${actionCostFailures.join('\n')}`
      ).toEqual([
        'animate-dead',
        'contact-other-plane',
        'dispel-evil-and-good',
        'dominate-person',
        'dream',
        'enervation',
        'giant-insect',
        'infernal-calling',
        'magic-jar',
        'soul-cage',
        'summon-greater-demon',
        'telekinesis',
        'tensers-transformation',
        'whirlwind',
        'wrath-of-nature'
      ]);
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
