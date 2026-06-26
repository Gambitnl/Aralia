import { describe, expect, it } from 'vitest';
import { ACTION_METADATA } from '../actions';

/**
 * These tests keep the action loading policy explicit.
 *
 * `useGameActions` relies on ACTION_METADATA as the single source of truth for
 * whether a player action suppresses or self-manages the global loading state.
 * The cases below cover the actions that used to be hidden behind suffix checks
 * in the hook, so future action additions must update metadata intentionally.
 */
describe('ACTION_METADATA loading policy', () => {
  it('marks UI-only actions as spinner-free toggles', () => {
    expect(ACTION_METADATA.toggle_map?.isUiToggle).toBe(true);
    expect(ACTION_METADATA.TOGGLE_GLOSSARY_VISIBILITY?.isUiToggle).toBe(true);
    expect(ACTION_METADATA.OPEN_LOCKPICKING_MODAL?.isUiToggle).toBe(true);
  });

  it('marks item and merchant handlers that own their own loading lifecycle', () => {
    expect(ACTION_METADATA.OPEN_MERCHANT?.managesLoading).toBe(true);
    expect(ACTION_METADATA.OPEN_DYNAMIC_MERCHANT?.managesLoading).toBe(true);
    expect(ACTION_METADATA.EQUIP_ITEM?.managesLoading).toBe(true);
    expect(ACTION_METADATA.UNEQUIP_ITEM?.managesLoading).toBe(true);
    expect(ACTION_METADATA.DROP_ITEM?.managesLoading).toBe(true);
    expect(ACTION_METADATA.USE_ITEM?.managesLoading).toBe(true);
    expect(ACTION_METADATA.BARTER_ITEMS?.managesLoading).toBe(true);
    expect(ACTION_METADATA.HAGGLE_ITEM?.managesLoading).toBe(true);
  });
});
