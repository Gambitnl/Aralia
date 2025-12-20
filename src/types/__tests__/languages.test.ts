import { describe, it, expect } from 'vitest';
import { Language, LanguageDefinitions, Script, LanguageRarity } from '../languages';

describe('Languages Taxonomy', () => {
  it('should have a definition for every language enum member', () => {
    Object.values(Language).forEach((lang) => {
      expect(LanguageDefinitions[lang]).toBeDefined();
    });
  });

  it('should correctly define Common', () => {
    const common = LanguageDefinitions[Language.Common];
    expect(common.script).toBe(Script.Common);
    expect(common.rarity).toBe(LanguageRarity.Standard);
    expect(common.typicalSpeakers).toContain('Humans');
  });

  it('should correctly define Draconic', () => {
    const draconic = LanguageDefinitions[Language.Draconic];
    expect(draconic.script).toBe(Script.Draconic);
    expect(draconic.rarity).toBe(LanguageRarity.Exotic);
    expect(draconic.typicalSpeakers).toContain('Dragons');
  });

  it('should correctly define Druidic as secret', () => {
    const druidic = LanguageDefinitions[Language.Druidic];
    expect(druidic.rarity).toBe(LanguageRarity.Secret);
  });
});
