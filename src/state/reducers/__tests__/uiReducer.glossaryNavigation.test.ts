/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/__tests__/uiReducer.glossaryNavigation.test.ts
 *
 * Protects glossary route selection at the reducer boundary. A nested rule
 * link must open the glossary with its requested entry in the same transition,
 * while ordinary toggles and the established overlay reset rules stay intact.
 */

import { describe, expect, it } from 'vitest';
import { createMockGameState } from '../../../utils/core/factories';
import { uiReducer } from '../uiReducer';

describe('uiReducer glossary navigation', () => {
  it('opens a requested glossary entry atomically and closes conflicting overlays', () => {
    const state = createMockGameState({
      isGlossaryVisible: false,
      selectedGlossaryTermForModal: undefined,
      isMapVisible: true,
      isDevMenuVisible: true,
      isDiscoveryLogVisible: true,
      isPartyOverlayVisible: true,
      characterSheetModal: { isOpen: true, character: null },
    });

    const next = uiReducer(state, {
      type: 'TOGGLE_GLOSSARY_VISIBILITY',
      payload: { initialTermId: 'bright_light' },
    });

    expect(next).toMatchObject({
      isGlossaryVisible: true,
      selectedGlossaryTermForModal: 'bright_light',
      isMapVisible: false,
      isDevMenuVisible: false,
      isDiscoveryLogVisible: false,
      isPartyOverlayVisible: false,
      characterSheetModal: { isOpen: false, character: null },
    });
  });

  it('preserves the default-entry behavior for an ordinary untargeted open', () => {
    const state = createMockGameState({
      isGlossaryVisible: false,
      selectedGlossaryTermForModal: undefined,
    });

    const next = uiReducer(state, { type: 'TOGGLE_GLOSSARY_VISIBILITY' });

    expect(next.isGlossaryVisible).toBe(true);
    expect(next.selectedGlossaryTermForModal).toBeUndefined();
  });

  it('clears the selected term when closing, even if a term is supplied', () => {
    const state = createMockGameState({
      isGlossaryVisible: true,
      selectedGlossaryTermForModal: 'bright_light',
    });

    const next = uiReducer(state, {
      type: 'TOGGLE_GLOSSARY_VISIBILITY',
      payload: { initialTermId: 'dim_light' },
    });

    expect(next.isGlossaryVisible).toBe(false);
    expect(next.selectedGlossaryTermForModal).toBeUndefined();
  });

  it('keeps non-glossary overlay toggles clearing a stale glossary route', () => {
    const state = createMockGameState({
      isGlossaryVisible: true,
      selectedGlossaryTermForModal: 'bright_light',
      isMapVisible: false,
    });

    const next = uiReducer(state, { type: 'TOGGLE_MAP_VISIBILITY' });

    expect(next.isMapVisible).toBe(true);
    expect(next.isGlossaryVisible).toBe(false);
    expect(next.selectedGlossaryTermForModal).toBeUndefined();
  });
});
