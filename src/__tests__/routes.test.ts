import { describe, it, expect, vi } from 'vitest';
import { GamePhase } from '../types';
import {
  getPhaseSlug,
  getPhaseFromSlug,
  getPhaseTitle,
  isWorldGenDeepLink,
  isDummyAutoStartDeepLink,
  PHASE_SLUG_OVERRIDES,
} from '../routes';

describe('routes — phase slugs', () => {
  it('serializes default phases as the lowercased enum name', () => {
    expect(getPhaseSlug(GamePhase.MAIN_MENU)).toBe('main_menu');
    expect(getPhaseSlug(GamePhase.PLAYING)).toBe('playing');
    expect(getPhaseSlug(GamePhase.CHARACTER_CREATION)).toBe('character_creation');
  });

  it('serializes overridden phases as their clean slug', () => {
    expect(getPhaseSlug(GamePhase.WORLD3D_DEMO)).toBe('world3d');
    expect(getPhaseSlug(GamePhase.WORLDFORGE_DEMO)).toBe('worldforge');
    expect(getPhaseSlug(GamePhase.SPAWN_PREVIEW)).toBe('spawnpreview');
  });

  it('round-trips every phase: slug -> phase -> slug', () => {
    const phases = Object.values(GamePhase).filter((v): v is GamePhase => typeof v === 'number');
    for (const phase of phases) {
      const slug = getPhaseSlug(phase);
      expect(getPhaseFromSlug(slug)).toBe(phase);
    }
  });

  it('resolves clean slugs back to their phase', () => {
    expect(getPhaseFromSlug('world3d')).toBe(GamePhase.WORLD3D_DEMO);
    expect(getPhaseFromSlug('worldforge')).toBe(GamePhase.WORLDFORGE_DEMO);
    expect(getPhaseFromSlug('spawnpreview')).toBe(GamePhase.SPAWN_PREVIEW);
  });

  it('is case-insensitive and accepts legacy numeric indexes', () => {
    expect(getPhaseFromSlug('PLAYING')).toBe(GamePhase.PLAYING);
    expect(getPhaseFromSlug(String(GamePhase.PLAYING))).toBe(GamePhase.PLAYING);
  });

  it('returns null for unknown or empty slugs', () => {
    expect(getPhaseFromSlug(null)).toBeNull();
    expect(getPhaseFromSlug('')).toBeNull();
    expect(getPhaseFromSlug('not_a_phase')).toBeNull();
  });

  it('treats the retired design_preview slug as not-found (with a warning)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getPhaseFromSlug('design_preview')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps the override map bidirectionally consistent', () => {
    for (const [phase, slug] of Object.entries(PHASE_SLUG_OVERRIDES)) {
      expect(getPhaseFromSlug(slug!)).toBe(Number(phase));
    }
  });
});

describe('routes — world-gen deep link', () => {
  it('matches ?worldmap=1 and ?view=worldgen', () => {
    expect(isWorldGenDeepLink('?worldmap=1')).toBe(true);
    expect(isWorldGenDeepLink('?view=worldgen')).toBe(true);
    expect(isWorldGenDeepLink('?foo=bar&worldmap=1')).toBe(true);
  });

  it('does not match other values', () => {
    expect(isWorldGenDeepLink('')).toBe(false);
    expect(isWorldGenDeepLink('?worldmap=0')).toBe(false);
    expect(isWorldGenDeepLink('?view=something')).toBe(false);
  });
});

describe('routes — dummy auto-start opt-in', () => {
  it('matches the explicit ?dummy=1 / ?devstart=1 opt-in', () => {
    expect(isDummyAutoStartDeepLink('?dummy=1')).toBe(true);
    expect(isDummyAutoStartDeepLink('?devstart=1')).toBe(true);
    expect(isDummyAutoStartDeepLink('?foo=bar&dummy=1')).toBe(true);
  });

  it('does NOT match a bare cold load (so a new player sees the Main Menu)', () => {
    expect(isDummyAutoStartDeepLink('')).toBe(false);
    expect(isDummyAutoStartDeepLink('?dummy=0')).toBe(false);
    expect(isDummyAutoStartDeepLink('?phase=playing')).toBe(false);
  });
});

describe('routes — phase tab titles', () => {
  it('uses the hand-picked title for named phases, prefixed with the app name', () => {
    expect(getPhaseTitle(GamePhase.MAIN_MENU)).toBe('Aralia — Main Menu');
    expect(getPhaseTitle(GamePhase.WORLDFORGE_DEMO)).toBe('Aralia — Worldforge Atlas');
    expect(getPhaseTitle(GamePhase.PLAYING)).toBe('Aralia — Adventure');
  });

  it('falls back to a prettified enum name for unlisted phases', () => {
    // Every phase gets a non-empty, prefixed title even without a PHASE_TITLES entry.
    const phases = Object.values(GamePhase).filter((v): v is GamePhase => typeof v === 'number');
    for (const phase of phases) {
      const title = getPhaseTitle(phase);
      expect(title.startsWith('Aralia — ')).toBe(true);
      expect(title.length).toBeGreaterThan('Aralia — '.length);
    }
  });
});
