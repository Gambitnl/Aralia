/**
 * @file src/hooks/__tests__/useUnderdarkLighting.test.ts
 * Covers the Underdark light-source checks: carried light (torch, lantern),
 * spell light (Light, Dancing Lights, Daylight), and cavern bioluminescence.
 *
 * Called by: focused Vitest runs for Underdark lighting.
 * Depends on: the shipped Underdark biome table and the spell engine's
 * LightSource record shape. No mocks — the hook is pure.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
    useUnderdarkLighting,
    UNTIL_DISPELLED_MINUTES,
} from '../useUnderdarkLighting';
import { Item, ItemType } from '../../types';
import { LightSource as SpellLightSource } from '../../types/combat';

const makeItem = (id: string, name: string): Item => ({
    id,
    name,
    description: `${name} used by the Underdark lighting tests.`,
    type: ItemType.LightSource,
});

const torch = makeItem('torch', 'Torch');
const lantern = makeItem('hooded_lantern', 'Hooded Lantern');
const oil = makeItem('oil_flask', 'Flask of Oil');

/** Minimal light record shaped like the ones the UTILITY light effect writes. */
const makeSpellLight = (overrides: Partial<SpellLightSource> = {}): SpellLightSource => ({
    id: 'light-1',
    sourceSpellId: 'light',
    casterId: 'pc-1',
    brightRadius: 20,
    dimRadius: 20,
    attachedTo: 'target',
    createdTurn: 0,
    ...overrides,
});

describe('useUnderdarkLighting', () => {
    describe('carried light (preserved behavior)', () => {
        it('reports darkness with an empty pack and no environment', () => {
            const { result } = renderHook(() => useUnderdarkLighting([]));
            expect(result.current.activeSources).toEqual([]);
            expect(result.current.currentLightLevel).toBe('darkness');
            expect(result.current.isInDarkness).toBe(true);
        });

        it('lights a torch from inventory', () => {
            const { result } = renderHook(() => useUnderdarkLighting([torch]));
            expect(result.current.activeSources).toHaveLength(1);
            expect(result.current.activeSources[0]).toMatchObject({
                type: 'torch',
                radius: 40,
                durationRemaining: 60,
            });
            expect(result.current.currentLightLevel).toBe('bright');
        });

        it('needs oil before a hooded lantern counts', () => {
            const withoutOil = renderHook(() => useUnderdarkLighting([lantern]));
            expect(withoutOil.result.current.activeSources).toEqual([]);

            const withOil = renderHook(() => useUnderdarkLighting([lantern, oil]));
            expect(withOil.result.current.activeSources).toHaveLength(1);
            expect(withOil.result.current.activeSources[0].type).toBe('lantern');
        });
    });

    describe('spell light', () => {
        it('counts a cast Light cantrip and sums its bright and dim radii', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], { spellLightSources: [makeSpellLight()] }),
            );
            expect(result.current.activeSources).toHaveLength(1);
            expect(result.current.activeSources[0]).toMatchObject({
                id: 'light-1',
                type: 'spell',
                name: 'Light',
                radius: 40,
            });
            expect(result.current.currentLightLevel).toBe('bright');
        });

        it('names Dancing Lights and Daylight from their spell ids', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], {
                    spellLightSources: [
                        makeSpellLight({ id: 'dl-1', sourceSpellId: 'dancing-lights', brightRadius: 0, dimRadius: 10 }),
                        makeSpellLight({ id: 'day-1', sourceSpellId: 'daylight', brightRadius: 60, dimRadius: 60 }),
                    ],
                }),
            );
            expect(result.current.activeSources.map(s => s.name)).toEqual([
                'Dancing Lights',
                'Daylight',
            ]);
            expect(result.current.activeSources[1].radius).toBe(120);
        });

        it('labels an unlisted light-granting spell from its id', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], {
                    spellLightSources: [makeSpellLight({ sourceSpellId: 'continual-flame' })],
                }),
            );
            expect(result.current.activeSources[0].name).toBe('Continual Flame');
        });

        it('converts rounds remaining into minutes', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], {
                    spellLightSources: [makeSpellLight({ expiresAtRound: 600 })],
                    currentRound: 0,
                }),
            );
            // Light runs 1 hour: 600 rounds at 6 seconds each.
            expect(result.current.activeSources[0].durationRemaining).toBe(60);
        });

        it('drops a spell light whose expiry round has passed', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], {
                    spellLightSources: [makeSpellLight({ expiresAtRound: 10 })],
                    currentRound: 10,
                }),
            );
            expect(result.current.activeSources).toEqual([]);
            expect(result.current.isInDarkness).toBe(true);
        });

        it('treats a record with no expiry as running until dispelled', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], { spellLightSources: [makeSpellLight()], currentRound: 42 }),
            );
            expect(result.current.activeSources[0].durationRemaining).toBe(UNTIL_DISPELLED_MINUTES);
        });
    });

    describe('cavern bioluminescence', () => {
        it('glows dimly in the phosphorescent fungal forest', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], { biomeId: 'fungal_forest' }),
            );
            expect(result.current.activeSources).toHaveLength(1);
            expect(result.current.activeSources[0]).toMatchObject({
                type: 'bioluminescence',
                radius: 30,
                durationRemaining: UNTIL_DISPELLED_MINUTES,
            });
            // Living light never reads as bright.
            expect(result.current.currentLightLevel).toBe('dim');
            expect(result.current.isInDarkness).toBe(false);
        });

        it('leaves a plain limestone cavern dark', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([], { biomeId: 'cavern_standard' }),
            );
            expect(result.current.activeSources).toEqual([]);
            expect(result.current.currentLightLevel).toBe('darkness');
        });

        it('does not claim magical radiation or lava as bioluminescence', () => {
            const faerzress = renderHook(() =>
                useUnderdarkLighting([], { biomeId: 'faerzress_pocket' }),
            );
            expect(faerzress.result.current.activeSources).toEqual([]);

            const magma = renderHook(() => useUnderdarkLighting([], { biomeId: 'magma_tube' }));
            expect(magma.result.current.activeSources).toEqual([]);
        });

        it('lets a carried torch outshine the fungal glow', () => {
            const { result } = renderHook(() =>
                useUnderdarkLighting([torch], { biomeId: 'fungal_forest' }),
            );
            expect(result.current.activeSources.map(s => s.type)).toEqual([
                'torch',
                'bioluminescence',
            ]);
            expect(result.current.currentLightLevel).toBe('bright');
        });
    });
});
