
import { describe, it, expect } from 'vitest';
import { resolveNPCVisual } from '../visualUtils';
import { NPC } from '../../types';
import { NPCVisualSpec } from '../../types/visuals';

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
