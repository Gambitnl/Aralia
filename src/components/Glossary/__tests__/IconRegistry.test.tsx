/**
 * @file IconRegistry.test.tsx
 *
 * Guards the MOD-3.1 split of the glossary icon table into four data modules
 * (icons/iconSet*.tsx) that IconRegistry spread-merges back together.
 *
 * What this protects: the split is a pure data move, so the failure mode is a
 * silent one - an entry dropped or duplicated during a future re-bucketing
 * would not break the build, it would just make GlossaryIcon fall through to
 * the Material Symbols text fallback for that name. These tests assert the
 * merged table is complete, that no key is claimed by two modules (which would
 * make merge order load-bearing), and that every registered name still renders
 * real SVG rather than the fallback span.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlossaryIcon } from '../IconRegistry';
import { iconSetCreaturesElements } from '../icons/iconSetCreaturesElements';
import { iconSetGearCombat } from '../icons/iconSetGearCombat';
import { iconSetMagicStatus } from '../icons/iconSetMagicStatus';
import { iconSetMisc } from '../icons/iconSetMisc';

const SETS = {
    iconSetCreaturesElements,
    iconSetGearCombat,
    iconSetMagicStatus,
    iconSetMisc,
} as const;

const CLASS_NAME = 'w-4 h-4';
const keysBySet = Object.fromEntries(
    Object.entries(SETS).map(([name, factory]) => [name, Object.keys(factory(CLASS_NAME))]),
) as Record<keyof typeof SETS, string[]>;
const allKeys = Object.values(keysBySet).flat();

describe('glossary icon set modules', () => {
    it('together supply the full icon table', () => {
        // 203 entries at the time of the split (agora-907c.5). This number is
        // allowed to grow; it exists so an accidental deletion is loud.
        expect(allKeys.length).toBeGreaterThanOrEqual(203);
    });

    it('claim disjoint keys, so spread-merge order never decides a lookup', () => {
        const seen = new Map<string, string>();
        const collisions: string[] = [];
        for (const [setName, keys] of Object.entries(keysBySet)) {
            for (const key of keys) {
                const owner = seen.get(key);
                if (owner) collisions.push(`${key}: ${owner} + ${setName}`);
                else seen.set(key, setName);
            }
        }
        expect(collisions).toEqual([]);
        expect(seen.size).toBe(allKeys.length);
    });

    it('render every registered name as SVG, never as the text fallback', () => {
        const fellBack: string[] = [];
        for (const key of allKeys) {
            const { container, unmount } = render(<GlossaryIcon name={key} />);
            if (!container.querySelector('svg')) fellBack.push(key);
            unmount();
        }
        expect(fellBack).toEqual([]);
    });

    it('pass the caller className through to the rendered SVG', () => {
        const { container } = render(<GlossaryIcon name="sword" className="w-9 h-9" />);
        expect(container.querySelector('svg')?.getAttribute('class')).toBe('w-9 h-9');
    });

    it('still falls back to Material Symbols for an unregistered name', () => {
        const { container } = render(<GlossaryIcon name="definitely_not_an_icon" />);
        expect(container.querySelector('svg')).toBeNull();
        expect(container.querySelector('span.material-symbols-outlined')?.textContent)
            .toBe('definitely_not_an_icon');
    });

    it('still passes a .svg path straight through as an image', () => {
        const { container } = render(<GlossaryIcon name="/assets/icons/foo.svg" />);
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/icons/foo.svg');
    });
});
