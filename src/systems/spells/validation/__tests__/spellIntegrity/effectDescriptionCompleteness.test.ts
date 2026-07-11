import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { SpellValidator } from '../../spellValidator';
import { Spell } from '../../../../../types/spells';
import { getSpells } from './spellFixtures';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

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
    // Wall of Fire now has a separate utility row that owns persistent wall
    // geometry. This regression is specifically about the three damage rows,
    // so select them by meaning instead of assuming damage begins at index 0.
    const wallOfFireDescriptions = wallOfFire?.effects
      .filter(effect => effect.type === 'DAMAGE')
      .map(effect => effect.description) ?? [];
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
});
