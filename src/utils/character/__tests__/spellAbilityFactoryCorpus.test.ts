import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createAbilityFromSpell } from '../spellAbilityFactory';
import { Spell } from '@/types/spells';
import { createMockPlayerCharacter } from '../../core/factories';

/**
 * @file Corpus gate for spell-to-ability translation coverage.
 *
 * The unit tests beside this file prove each builder in isolation. This file
 * asks the only question that matters to the combat AI: after the factory runs
 * over the real spell corpus, which spells still produce an Ability with no
 * effects at all?
 *
 * That matters because `combatAI.ts` scores an ability entirely from
 * `ability.effects`. A spell that translates into an empty list is neither
 * damage, heal nor buff to the AI, so it is never chosen — the spell is
 * invisible in combat even though its data is complete.
 *
 * Agora tasks agora-c495 and agora-1a02.
 */

const SPELLS_ROOT = path.resolve(__dirname, '../../../../public/data/spells');

/** Reads every spell JSON file in the corpus, stripping the BOM some files carry. */
const loadAllSpells = (): Spell[] => {
    if (!fs.existsSync(SPELLS_ROOT)) return [];

    return fs.readdirSync(SPELLS_ROOT)
        .filter(entry => entry.startsWith('level-'))
        .flatMap(levelDir => {
            const dir = path.join(SPELLS_ROOT, levelDir);
            if (!fs.statSync(dir).isDirectory()) return [];
            return fs.readdirSync(dir)
                .filter(file => file.endsWith('.json'))
                .map(file => JSON.parse(
                    fs.readFileSync(path.join(dir, file), 'utf-8').replace(/^﻿/, '')
                ) as Spell);
        });
};

const caster = createMockPlayerCharacter({
    spellcastingAbility: 'intelligence',
    finalAbilityScores: {
        Strength: 10,
        Dexterity: 10,
        Constitution: 10,
        Intelligence: 16,
        Wisdom: 10,
        Charisma: 10
    }
});

describe('spellAbilityFactory corpus coverage', () => {
    const spells = loadAllSpells();

    it('loads the spell corpus', () => {
        expect(spells.length).toBeGreaterThan(400);
    });

    it('translates every effect type except SUMMONING into at least one ability effect', () => {
        // SUMMONING is the one untranslated effect type. It creates a creature
        // rather than changing an existing one, and the combat Ability contract
        // has no entity-creation effect, so a spell whose only rows are summons
        // legitimately produces an empty list here. Every other empty result is
        // a translation gap and fails this test.
        const emptyNonSummon = spells
            .filter(spell => Array.isArray(spell.effects) && spell.effects.length > 0)
            .filter(spell => !spell.effects.every(effect => effect?.type === 'SUMMONING'))
            .filter(spell => createAbilityFromSpell(spell, caster).effects.length === 0)
            .map(spell => spell.id)
            .sort();

        expect(emptyNonSummon).toEqual([]);
    });

    it('gives Bless an attack rider and a saving-throw rider from one spell effect', () => {
        const bless = spells.find(spell => spell.id === 'bless');
        expect(bless).toBeDefined();

        const status = createAbilityFromSpell(bless!, caster).effects[0]?.statusEffect;
        expect(status?.type).toBe('buff');
        expect(status?.name).toBe('Blessed');
        expect(status?.attackRollRider?.dice).toBe('1d4');
        expect(status?.savingThrowRider?.dice).toBe('1d4');
    });

    it('reads Blur as a buff even though its rider is disadvantage', () => {
        const blur = spells.find(spell => spell.id === 'blur');
        expect(blur).toBeDefined();

        const status = createAbilityFromSpell(blur!, caster).effects[0]?.statusEffect;
        // Blur imposes disadvantage on attacks AGAINST its holder. Reading the
        // modifier without the direction would score it as a debuff and stop
        // the AI ever casting it.
        expect(status?.attackRollRider?.direction).toBe('incoming');
        expect(status?.type).toBe('buff');
    });

    it('gives Shield of Faith a real Armor Class bonus', () => {
        const shieldOfFaith = spells.find(spell => spell.id === 'shield-of-faith');
        expect(shieldOfFaith).toBeDefined();

        const status = createAbilityFromSpell(shieldOfFaith!, caster).effects[0]?.statusEffect;
        expect(status?.modifiers?.acBonus).toBe(2);
        // The old placeholder raised Dexterity instead. Nothing may reintroduce it.
        expect(status?.effect).toBeUndefined();
    });

    it('gives Mage Armor a base Armor Class and Barkskin an Armor Class floor', () => {
        const mageArmor = spells.find(spell => spell.id === 'mage-armor');
        const barkskin = spells.find(spell => spell.id === 'barkskin');
        expect(mageArmor).toBeDefined();
        expect(barkskin).toBeDefined();

        const mageArmorStatus = createAbilityFromSpell(mageArmor!, caster).effects[0]?.statusEffect;
        expect(mageArmorStatus?.modifiers?.baseAC).toBe(13);
        expect(mageArmorStatus?.modifiers?.baseACFormula).toBe('13 + dex_mod');
        expect(mageArmorStatus?.modifiers?.acBonus).toBeUndefined();

        const barkskinStatus = createAbilityFromSpell(barkskin!, caster).effects[0]?.statusEffect;
        expect(barkskinStatus?.modifiers?.acMinimum).toBe(17);
        expect(barkskinStatus?.modifiers?.baseAC).toBeUndefined();
    });

    it('turns Misty Step into a teleport of its real distance', () => {
        const mistyStep = spells.find(spell => spell.id === 'misty-step');
        expect(mistyStep).toBeDefined();

        const effects = createAbilityFromSpell(mistyStep!, caster).effects;
        expect(effects[0]?.type).toBe('teleport');
        // The distance lives on forcedMovement.maxDistance as "30 ft"; the
        // sibling `distance` field is zero-filled.
        expect(effects[0]?.value).toBe(30);
    });

    it('keeps Mold Earth terrain manipulation instead of flattening it to a generic status', () => {
        const moldEarth = spells.find(spell => spell.id === 'mold-earth');
        expect(moldEarth).toBeDefined();

        const terrain = createAbilityFromSpell(moldEarth!, caster).effects[0]?.statusEffect?.terrain;
        expect(terrain?.terrainType).toBe('difficult');
        expect(terrain?.manipulation?.type).toBe('excavate');
        expect(terrain?.manipulation?.depositDistance).toBe(5);
    });

    it('marks Fog Cloud as neutral obscuring terrain that wind disperses', () => {
        const fogCloud = spells.find(spell => spell.id === 'fog-cloud');
        expect(fogCloud).toBeDefined();

        const status = createAbilityFromSpell(fogCloud!, caster).effects[0]?.statusEffect;
        expect(status?.type).toBe('neutral');
        expect(status?.terrain?.terrainType).toBe('obscuring');
        expect(status?.terrain?.dispersedByStrongWind).toBe(true);
        // 20-foot radius becomes 4 tiles at 5 feet per tile.
        expect(status?.terrain?.areaOfEffect).toEqual({ shape: 'circle', size: 4 });
    });
});
