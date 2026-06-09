import { describe, expect, it, beforeEach, vi } from 'vitest';
import { combatEvents } from '../CombatEvents';

describe('CombatEvents', () => {
    beforeEach(() => {
        combatEvents.clearForTest();
    });

    it('dispatches listeners in explicit pre/resolve/post phase order', () => {
        const callOrder: string[] = [];

        const preHighPriority = vi.fn(() => callOrder.push('pre-high'));
        const preLowPriority = vi.fn(() => callOrder.push('pre-low'));
        const resolveListener = vi.fn(() => callOrder.push('resolve'));
        const postListener = vi.fn(() => callOrder.push('post'));

        combatEvents.on('unit_cast', preLowPriority, { phase: 'pre', priority: 1 });
        combatEvents.on('unit_cast', preHighPriority, { phase: 'pre', priority: 10 });
        combatEvents.on('unit_cast', resolveListener, { phase: 'resolve', priority: 0 });
        combatEvents.on('unit_cast', postListener, { phase: 'post', priority: 0 });

        combatEvents.emit({
            type: 'unit_cast',
            casterId: 'caster-1',
            spellId: 'firebolt',
            targets: ['goblin-1']
        });

        expect(callOrder).toEqual(['pre-high', 'pre-low', 'resolve', 'post']);
    });

    it('preserves registration order for equal phase and priority', () => {
        const callOrder: string[] = [];
        const first = vi.fn(() => callOrder.push('first'));
        const second = vi.fn(() => callOrder.push('second'));
        const third = vi.fn(() => callOrder.push('third'));

        combatEvents.on('unit_cast', first, { phase: 'resolve', priority: 0 });
        combatEvents.on('unit_cast', second, { phase: 'resolve', priority: 0 });
        combatEvents.on('unit_cast', third, { phase: 'resolve', priority: 0 });

        combatEvents.emit({
            type: 'unit_cast',
            casterId: 'caster-2',
            spellId: 'magic-missile',
            targets: []
        });

        expect(callOrder).toEqual(['first', 'second', 'third']);
    });

    it('uses explicit default priority and phase when options are omitted', () => {
        const callOrder: string[] = [];
        const first = vi.fn(() => callOrder.push('default-first'));
        const second = vi.fn(() => callOrder.push('default-second'));

        combatEvents.on('unit_cast', first);
        combatEvents.on('unit_cast', second);

        combatEvents.emit({
            type: 'unit_cast',
            casterId: 'caster-3',
            spellId: 'shield',
            targets: []
        });

        expect(callOrder).toEqual(['default-first', 'default-second']);
    });

    it('records a canonical replay trace for emitted events', () => {
        combatEvents.emit({
            type: 'unit_cast',
            casterId: 'caster-4',
            spellId: 'burning-hands',
            targets: ['target-1']
        });

        combatEvents.emit({
            type: 'unit_move',
            unitId: 'unit-4',
            from: { x: 1, y: 1 },
            to: { x: 2, y: 1 },
            cost: 5,
            isForced: true,
            phase: 'pre',
            priority: 4
        });

        expect(combatEvents.getDispatchLog()).toEqual([
            {
                seq: 0,
                type: 'unit_cast',
                casterId: 'caster-4',
                spellId: 'burning-hands',
                targets: ['target-1'],
                priority: 0,
                phase: 'resolve'
            },
            {
                seq: 1,
                type: 'unit_move',
                unitId: 'unit-4',
                from: { x: 1, y: 1 },
                to: { x: 2, y: 1 },
                cost: 5,
                isForced: true,
                priority: 4,
                phase: 'pre'
            }
        ]);
    });

    it('round-trips a replay snapshot and resumes sequence numbers', () => {
        combatEvents.emit({
            type: 'unit_sustain',
            casterId: 'caster-5',
            spellId: 'moonbeam',
            actionType: 'action'
        });

        combatEvents.emit({
            type: 'unit_cast',
            casterId: 'caster-5',
            spellId: 'spiritual-weapon',
            targets: []
        });

        const snapshot = combatEvents.createReplaySnapshot();

        combatEvents.clearForTest();

        expect(combatEvents.getDispatchLog()).toEqual([]);

        combatEvents.restoreReplaySnapshot(snapshot);

        expect(combatEvents.getDispatchLog()).toEqual(snapshot.events);

        combatEvents.emit({
            type: 'unit_sustain',
            casterId: 'caster-6',
            spellId: 'moonbeam',
            actionType: 'bonus_action'
        });

        expect(combatEvents.getDispatchLog()).toEqual([
            {
                seq: 0,
                type: 'unit_sustain',
                casterId: 'caster-5',
                spellId: 'moonbeam',
                actionType: 'action',
                priority: 0,
                phase: 'resolve'
            },
            {
                seq: 1,
                type: 'unit_cast',
                casterId: 'caster-5',
                spellId: 'spiritual-weapon',
                targets: [],
                priority: 0,
                phase: 'resolve'
            },
            {
                seq: 2,
                type: 'unit_sustain',
                casterId: 'caster-6',
                spellId: 'moonbeam',
                actionType: 'bonus_action',
                priority: 0,
                phase: 'resolve'
            }
        ]);
    });
});
