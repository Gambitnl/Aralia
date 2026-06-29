import { describe, it, expect } from 'vitest';
import {
  IN_PARTY_DEFAULT,
  isInParty,
  makeInPartyFlag,
  type RecruitPayload,
  type RecruitSource,
  type WithInParty,
} from '../recruitTypes';
import type { Companion } from '@/types/companions';
import type { PlayerCharacter } from '@/types/character';

describe('recruitTypes — RecruitPayload shape', () => {
  it('accepts a payload joining character + companion under one shared id', () => {
    // Minimal structural stand-ins; the test asserts the SHAPE compiles, not the
    // full PlayerCharacter/Companion field set (those are owned elsewhere).
    const character = { id: 'npc-1', name: 'Mara' } as unknown as PlayerCharacter;
    const companion = { id: 'npc-1', loyalty: 50 } as unknown as Companion;

    const payload: RecruitPayload = {
      character,
      companion,
      source: 'dialogue',
    };

    // Invariant: the two halves are joined by a shared id.
    expect(payload.character.id).toBe(payload.companion.id);
    expect(payload.source).toBe('dialogue');
  });

  it('covers every RecruitSource union member', () => {
    const sources: RecruitSource[] = ['dialogue', 'tavern', 'rescue', 'promote'];
    expect(sources).toHaveLength(4);
    // Exhaustive switch — fails to compile if a variant is added without handling.
    for (const s of sources) {
      switch (s) {
        case 'dialogue':
        case 'tavern':
        case 'rescue':
        case 'promote':
          expect(typeof s).toBe('string');
          break;
        default: {
          const _exhaustive: never = s;
          throw new Error(`unhandled source ${_exhaustive}`);
        }
      }
    }
  });
});

describe('recruitTypes — inParty flag helpers', () => {
  it('a freshly recruited companion defaults to in-party', () => {
    expect(IN_PARTY_DEFAULT).toBe(true);
    expect(makeInPartyFlag()).toEqual({ inParty: true });
  });

  it('makeInPartyFlag can mark a leaver as inactive', () => {
    expect(makeInPartyFlag(false)).toEqual({ inParty: false });
  });

  it('isInParty treats a missing flag as not-in-party (relationship-only record)', () => {
    const relationshipOnly: WithInParty = {};
    const active: WithInParty = { inParty: true };
    const left: WithInParty = { inParty: false };

    expect(isInParty(relationshipOnly)).toBe(false);
    expect(isInParty(active)).toBe(true);
    expect(isInParty(left)).toBe(false);
  });
});
