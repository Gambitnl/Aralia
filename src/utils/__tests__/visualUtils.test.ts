
import { describe, it, expect } from 'vitest';
import { resolveNPCVisual, resolveItemVisual } from '../visualUtils';
import { NPC, Item } from '../../types';
import { NPCVisualSpec, ItemVisualSpec } from '../../types/visuals';

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
