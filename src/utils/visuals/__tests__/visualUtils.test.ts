
import { describe, it, expect } from 'vitest';
import { resolveNPCVisual, resolveItemVisual } from '../visualUtils';
import { NPC, Item } from '../../../types';
// TODO(lint-intent): 'ItemVisualSpec' is unused in this test; use it in the assertion path or remove it.
import { NPCVisualSpec, ItemVisualSpec as _ItemVisualSpec } from '../../../types/visuals';

/**
 * This file checks the visual resolver that turns game records into image paths
 * or fallback symbols for the UI. Inventory panels call the same resolver, so
 * these tests protect old saved items as well as newly-created item data.
 */

describe('resolveNPCVisual', () => {
  const mockNPC: NPC = {
    id: 'test-npc',
    name: 'Test NPC',
    baseDescription: 'A test npc',
    initialPersonalityPrompt: 'Test personality',
    role: 'guard',
    // other fields optional/mocked if needed, but these are core for type
  };

  it('should fallback to role-based visual when no spec is provided', () => {
    const result = resolveNPCVisual(mockNPC);
    expect(result.fallbackContent).toBe('🛡️'); // Guard emoji
    expect(result.primaryColor).toBe('#3b82f6'); // Guard color
  });

  it('should use spec from argument if provided', () => {
    const spec: NPCVisualSpec = {
      description: 'Custom Spec',
      fallbackIcon: '🧪',
      themeColor: '#00ff00'
    };
    const result = resolveNPCVisual(mockNPC, spec);
    expect(result.fallbackContent).toBe('🧪');
    expect(result.primaryColor).toBe('#00ff00');
  });

  it('should use spec from npc.visual if argument is missing', () => {
    const npcWithVisual: NPC = {
      ...mockNPC,
      visual: {
        description: 'Integrated Spec',
        fallbackIcon: '🔮',
        themeColor: '#ff00ff'
      }
    };
    const result = resolveNPCVisual(npcWithVisual);
    expect(result.fallbackContent).toBe('🔮');
    expect(result.primaryColor).toBe('#ff00ff');
  });

  it('should prioritize argument spec over npc.visual', () => {
    const npcWithVisual: NPC = {
      ...mockNPC,
      visual: {
        description: 'Integrated Spec',
        fallbackIcon: '🔮',
        themeColor: '#ff00ff'
      }
    };
    const overrideSpec: NPCVisualSpec = {
        description: 'Override Spec',
        fallbackIcon: '⚔️',
        themeColor: '#ffffff'
    }

    const result = resolveNPCVisual(npcWithVisual, overrideSpec);
    expect(result.fallbackContent).toBe('⚔️');
  });
});

describe('resolveItemVisual legacy weapon ids', () => {
  it('resolves every older emoji-only weapon id to restored SVG art', () => {
    const expectedWeaponIcons: Record<string, string> = {
      club: 'club-weapon-type-01.svg',
      dagger: 'dolch.svg',
      greatclub: 'club-weapon-type-03.svg',
      handaxe: 'kriegsbeil.svg',
      javelin: 'speer.svg',
      light_hammer: 'war-hammer-type-01.svg',
      mace: 'mace.svg',
      quarterstaff: 'baton.svg',
      sickle: 'sichel.svg',
      spear: 'speer.svg',
      dart: 'dart.svg',
      light_crossbow: 'light-crossbow.svg',
      shortbow: 'kompositbogen.svg',
      sling: 'sling.svg',
      battleaxe: 'kriegsbeil.svg',
      flail: 'flail-weapon.svg',
      glaive: 'hellebarde.svg',
      greataxe: 'barbaren-axe.svg',
      greatsword: 'bastardschwert-type-03.svg',
      halberd: 'hellebarde.svg',
      lance: 'speer.svg',
      longsword: 'sword.svg',
      maul: 'war-hammer-type-03.svg',
      morningstar: 'morgenstern.svg',
      pike: 'speer.svg',
      rapier: 'florett-type-01.svg',
      scimitar: 'sabel.svg',
      shortsword: 'sword.svg',
      trident: 'trident.svg',
      warhammer: 'war-hammer-type-02.svg',
      war_pick: 'war-pick.svg',
      whip: 'whip.svg',
      blowgun: 'blowgun.svg',
      longbow: 'langbogen.svg',
      hand_crossbow: 'hand-crossbow.svg',
      heavy_crossbow: 'heavy-crossbow.svg',
      rusty_sword: 'sabel.svg',
    };

    for (const [weaponId, iconFileName] of Object.entries(expectedWeaponIcons)) {
      const result = resolveItemVisual({
        id: weaponId,
        name: weaponId,
        description: 'Older saved weapon record',
        type: 'weapon',
        icon: 'legacy-emoji',
      });

      expect(result.src).toBe(`assets/icons/general/weapons/${iconFileName}`);
      expect(result.fallbackContent).toBe('legacy-emoji');
    }
  });
});

describe('resolveItemVisual', () => {
  const mockItemBase: Item = {
    id: 'test-item',
    name: 'Test Item',
    description: 'A test item',
    type: 'weapon', // Using string literal as enum might not be available in test context easily without import
  };

  it('resolves explicit visual spec path', () => {
    const item: Item = {
      ...mockItemBase,
      visual: {
        iconPath: '/assets/icons/sword.png',
        rarity: 'rare',
      },
      icon: '🗡️', // Legacy icon shouldn't be used for src
    };

    const result = resolveItemVisual(item);
    expect(result.src).toBe('/assets/icons/sword.png');
    expect(result.primaryColor).toBe('#3b82f6'); // Blue for rare
    expect(result.fallbackContent).toBe('🗡️');
  });

  it('resolves legacy path in icon field', () => {
    const item: Item = {
      ...mockItemBase,
      icon: '/assets/legacy/potion.png',
    };

    const result = resolveItemVisual(item);
    expect(result.src).toBe('/assets/legacy/potion.png');
    expect(result.fallbackContent).toBe('📦'); // Default fallback
    expect(result.primaryColor).toBe('#9ca3af'); // Gray default
  });

  it('resolves legacy emoji in icon field as fallback content', () => {
    const item: Item = {
      ...mockItemBase,
      icon: '🪵',
    };

    const result = resolveItemVisual(item);
    expect(result.src).toBeUndefined();
    expect(result.fallbackContent).toBe('🪵');
    expect(result.primaryColor).toBe('#9ca3af');
  });

  it('uses default fallback if no icon info present', () => {
    const item: Item = {
      ...mockItemBase,
    };

    const result = resolveItemVisual(item);
    expect(result.src).toBeUndefined();
    expect(result.fallbackContent).toBe('📦');
  });
});
