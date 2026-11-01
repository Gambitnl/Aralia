/**
 * Regression tests for three crafting bugs the C14 coverage pass found
 * (agora-9ed9.14). Each test fails on the code before the fix.
 *
 * Exercises: src/systems/crafting/crafterProgression.ts, ingredientGlossary.ts
 */
import { describe, it, expect } from 'vitest';
import {
  createCrafterProgression,
  deserializeProgression,
  serializeProgression,
} from '../crafterProgression';
import { buildIngredientGlossary } from '../ingredientGlossary';

describe('createCrafterProgression starting recipes', () => {
  it("grants starting recipes for the tool names the game actually uses", () => {
    // Before the fix both names normalized to keys with a double underscore.
    const alchemist = createCrafterProgression(["Alchemist's Supplies"]);
    expect([...alchemist.knownRecipes]).toEqual(expect.arrayContaining(['alchemists_fire', 'smokebomb', 'vial_of_acid']));
    const poisoner = createCrafterProgression(["Poisoner's Kit"]);
    expect([...poisoner.knownRecipes]).toEqual(expect.arrayContaining(['basic_poison', 'serpent_venom_poison', 'truth_serum']));
  });

  it('still accepts the plain names and the raw table keys', () => {
    expect(createCrafterProgression(['Herbalism Kit']).knownRecipes.has('healing_salve')).toBe(true);
    expect(createCrafterProgression(['alchemist_supplies']).knownRecipes.has('smokebomb')).toBe(true);
    expect(createCrafterProgression(['Tinker Tools']).knownRecipes.size).toBe(0);
  });
});

describe('progression save round trip', () => {
  it('keeps xpToNextLevel 0 for a max-level crafter instead of resetting it to 100', () => {
    const progression = createCrafterProgression([]);
    const maxed = { ...progression, level: 10, xp: 99999, xpToNextLevel: 0 };
    const restored = deserializeProgression(serializeProgression(maxed));
    expect(restored.level).toBe(10);
    expect(restored.xpToNextLevel).toBe(0);
  });
});

describe('ingredient glossary creature parts', () => {
  const glossary = buildIngredientGlossary();
  const venom = glossary.find((entry) => entry.source === 'creature' && entry.name === "Serpent's Venom");

  it('keys a creature part by its item id, so recipes that use it are found', () => {
    expect(venom?.id).toBe('serpents_venom');
    expect(venom?.usedInRecipes).toContain('serpent_venom_poison');
  });

  it('names the real harvest tool instead of a generic label', () => {
    expect(venom?.toolRequired).toBe("Poisoner's Kit");
    const creatureEntries = glossary.filter((entry) => entry.source === 'creature');
    expect(creatureEntries.length).toBeGreaterThan(0);
    for (const entry of creatureEntries) expect(entry.id).toMatch(/^[a-z0-9_]+$/);
  });
});
