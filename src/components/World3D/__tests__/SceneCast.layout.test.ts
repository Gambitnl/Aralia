import { describe, it, expect } from 'vitest';
import { layoutCast, figureIsInteractive, type SceneCastMember } from '../SceneCast';

/**
 * The SceneCast figures themselves are R3F meshes (not unit-testable in jsdom),
 * but their PLACEMENT is pure: the player stands at the near edge facing a
 * shallow arc of strangers on the far side, so the ground camera frames a
 * face-to-face cluster. These lock that layout contract.
 */
describe('layoutCast', () => {
  const player: SceneCastMember = { id: 'p', name: 'You', isPlayer: true };
  const k: SceneCastMember = { id: 'k', name: 'Kael', isSpeaker: true };
  const m: SceneCastMember = { id: 'm', name: 'Mira' };
  const t: SceneCastMember = { id: 't', name: 'Tomas' };

  it('returns nothing for an empty cast', () => {
    expect(layoutCast([])).toEqual([]);
  });

  it('places the player at the near edge (+Z) and NPCs on the far side (−Z)', () => {
    const placed = layoutCast([player, k, m, t]);
    const you = placed.find((p) => p.id === 'p')!;
    expect(you.pos[2]).toBeGreaterThan(0); // player toward camera
    for (const npc of placed.filter((p) => !p.isPlayer)) {
      expect(npc.pos[2]).toBeLessThan(0); // strangers opposite the player
    }
  });

  it('centers the NPC arc on x=0 (symmetric spread)', () => {
    const placed = layoutCast([player, k, m, t]);
    const xs = placed.filter((p) => !p.isPlayer).map((p) => p.pos[0]);
    const sum = xs.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThan(1e-9);
  });

  it('handles a single stranger (no player) placed in front', () => {
    const placed = layoutCast([k]);
    expect(placed).toHaveLength(1);
    expect(placed[0].pos[0]).toBeCloseTo(0);
  });
});

/**
 * Click-to-talk gating (interactive 3D). The figures are R3F meshes, but WHICH
 * figures accept a talk-click is a pure decision: NPCs when a handler is wired,
 * never the player's own figure.
 */
describe('figureIsInteractive', () => {
  const player: SceneCastMember = { id: 'p', name: 'You', isPlayer: true };
  const npc: SceneCastMember = { id: 'k', name: 'Kael' };

  it('makes an NPC figure clickable when a select handler is wired', () => {
    expect(figureIsInteractive(npc, true)).toBe(true);
  });

  it('never makes the player figure clickable (you do not talk to yourself)', () => {
    expect(figureIsInteractive(player, true)).toBe(false);
  });

  it('is inert when no handler is wired (non-interactive diorama / test render)', () => {
    expect(figureIsInteractive(npc, false)).toBe(false);
    expect(figureIsInteractive(player, false)).toBe(false);
  });
});
