import { describe, expect, it } from 'vitest';

import { VOYAGE_EVENTS } from '../voyageEvents';

/**
 * Pins the single voyage-event table (agora-f821.11).
 *
 * Until now two modules exported `VOYAGE_EVENTS`: this file and a directory
 * index at `src/data/naval/voyageEvents/index.ts`. Node resolved the FILE, so
 * the index was unreachable and every naval edit that landed in it — including
 * its own dice call sites — did nothing. The index is gone; the four events it
 * held that had no counterpart here were ported in first.
 *
 * These cases keep the table single and whole: ids stay unique, the ported
 * events stay present, and every entry stays callable.
 *
 * Called by: focused Vitest runs for the naval dedupe packet (W13-B).
 * Depends on: src/data/naval/voyageEvents.ts.
 */

describe('VOYAGE_EVENTS is one table', () => {
    it('has no duplicate event ids', () => {
        const ids = VOYAGE_EVENTS.map((event) => event.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps the four events ported from the retired directory index', () => {
        const ids = VOYAGE_EVENTS.map((event) => event.id);

        expect(ids).toEqual(
            expect.arrayContaining(['bad_rations', 'religious_omen', 'merfolk_trade', 'pirate_sighting']),
        );
    });

    it('keeps the events that already lived here', () => {
        const ids = VOYAGE_EVENTS.map((event) => event.id);

        expect(ids).toEqual(
            expect.arrayContaining(['doldrums', 'storm_gale', 'ghost_ship', 'siren_song', 'floating_debris']),
        );
    });

    it('gives every event a name, a type, a probability and an effect', () => {
        VOYAGE_EVENTS.forEach((event) => {
            expect(event.name.length).toBeGreaterThan(0);
            expect(event.type.length).toBeGreaterThan(0);
            expect(event.probability).toBeGreaterThan(0);
            expect(typeof event.effect).toBe('function');
        });
    });
});
