/**
 * @file CastSpellControls.test.tsx
 * Verifies the spellbook's out-of-combat Cast button: enabled/disabled state,
 * the party target picker, and the exact CAST_SPELL action it dispatches.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent,waitFor } from '@testing-library/react';
import {characterReducer} from '../../../../state/reducers/characterReducer';
import {GameProvider} from '../../../../state/GameContext';
import {createMockGameState} from '../../../../utils/core/factories';
import {GamePhase} from '../../../../types';
import {ALL_ITEMS} from '../../../../data/items';
import waterSpell from '../../../../../public/data/spells/level-1/create-or-destroy-water.json';
import CastSpellControls from '../CastSpellControls';
import shieldData from '@/data/spells/level-1/shield.json';
import type { PlayerCharacter, Spell } from '../../../../types';

const cureWounds = {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    description:
        'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.',
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
    effects: [
        {
            type: 'HEALING',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            healing: { dice: '2d8', isTemporaryHp: false },
        },
    ],
} as unknown as Spell;

const fireBolt = {
    id: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', range: 120, validTargets: ['creatures', 'objects'] },
    effects: [
        {
            type: 'DAMAGE',
            trigger: { type: 'immediate' },
            condition: { type: 'hit' },
            damage: { dice: '1d10', type: 'Fire' },
        },
    ],
} as unknown as Spell;

const detectMagic = {
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 1,
    duration: { type: 'timed', value: 10, unit: 'minute', concentration: true },
    targeting: { type: 'area', range: 0, validTargets: ['self'] },
    effects: [
        {
            type: 'UTILITY',
            utilityType: 'sensory',
            description: 'Sense magic within 30 feet.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
        },
    ],
} as unknown as Spell;

const makeCharacter = (overrides: Record<string, unknown> = {}): PlayerCharacter =>
    ({
        id: 'pc-caster',
        name: 'Lyra',
        hp: 10,
        maxHp: 16,
        spellSlots: { level_1: { current: 2, max: 3 } },
        ...overrides,
    }) as unknown as PlayerCharacter;

const ally = {
    id: 'pc-ally',
    name: 'Bram',
    hp: 4,
    maxHp: 12,
} as unknown as PlayerCharacter;

describe('CastSpellControls', () => {
    it('follows the filled unit receipt when a cast separates one vessel from a stack',async()=>{
        const character=makeCharacter({spellbook:{cantrips:[],knownSpells:['create-or-destroy-water'],preparedSpells:['create-or-destroy-water']}});
        const vessel={...ALL_ITEMS.waterskin,quantity:3},onAction=vi.fn();
        const state=createMockGameState({phase:GamePhase.PLAYING,party:[character],inventory:[vessel]});
        const ui=(s:typeof state)=><GameProvider state={s} dispatch={vi.fn()}><CastSpellControls spell={waterSpell as Spell} character={s.party[0]} isReadyToCast onAction={onAction}/></GameProvider>;
        const view=render(ui(state));fireEvent.change(screen.getByLabelText('Open vessel'),{target:{value:'0'}});
        const create=screen.getByRole('button',{name:'Create water in selected vessel'});expect(create).toBeEnabled();fireEvent.click(create);
        const patch=characterReducer(state,{type:'CAST_SPELL',payload:onAction.mock.calls[0][0].payload});
        view.rerender(ui({...state,...patch}));
        await waitFor(()=>expect(screen.getByText(/Contains 0.50 gallons/)).toBeVisible());
        expect(screen.getByLabelText('Open vessel')).toHaveValue('1');expect(create).toBeDisabled();
    });
    it('adopts its actual cast receipt and does not describe the spent slot as unspent',async()=>{
        const character=makeCharacter({spellbook:{cantrips:[],knownSpells:['create-or-destroy-water'],preparedSpells:['create-or-destroy-water']}});
        const vessel={...ALL_ITEMS.waterskin,quantity:1},onAction=vi.fn();
        const state=createMockGameState({phase:GamePhase.PLAYING,party:[character],inventory:[vessel]});
        const ui=(s:typeof state)=><GameProvider state={s} dispatch={vi.fn()}><CastSpellControls spell={waterSpell as Spell} character={s.party[0]} isReadyToCast onAction={onAction}/></GameProvider>;
        const view=render(ui(state));fireEvent.change(screen.getByLabelText('Open vessel'),{target:{value:'0'}});
        fireEvent.click(screen.getByRole('button',{name:'Create water in selected vessel'}));
        const patch=characterReducer(state,{type:'CAST_SPELL',payload:onAction.mock.calls[0][0].payload});
        view.rerender(ui({...state,...patch}));
        await waitFor(()=>expect(screen.getByText(/Contains 0.50 gallons/)).toBeVisible());
        expect(screen.getByRole('button',{name:'Create water in selected vessel'})).toBeDisabled();
        expect(screen.queryByText(/No spell slot was spent/)).not.toBeInTheDocument();
        expect(patch.party?.[0].spellSlots?.level_1.current).toBe(1);
    });
    it('requires a vessel choice for water, quotes only its capacity, and refuses silently replaced stock',()=>{
        const character=makeCharacter({spellbook:{cantrips:[],knownSpells:['create-or-destroy-water'],preparedSpells:['create-or-destroy-water']}});
        const vessel={...ALL_ITEMS.waterskin,quantity:1},onAction=vi.fn();
        const state=createMockGameState({phase:GamePhase.PLAYING,party:[character],inventory:[vessel]});
        const ui=(s:typeof state)=><GameProvider state={s} dispatch={vi.fn()}><CastSpellControls spell={waterSpell as Spell} character={character} isReadyToCast onAction={onAction}/></GameProvider>;
        const view=render(ui(state));
        const create=screen.getByRole('button',{name:'Create water in selected vessel'});
        expect(create).toBeDisabled();expect(onAction).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Open vessel'),{target:{value:'0'}});
        expect(create).toBeEnabled();expect(screen.getByText(/Create 0.50 gallons/)).toBeVisible();
        fireEvent.click(create);
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onAction.mock.calls[0][0].payload.outOfCombat.water).toMatchObject({mode:'create',inventoryIndex:0,sourceItem:vessel});
        view.rerender(ui({...state,inventory:[{...vessel}]}));
        expect(create).toBeDisabled();expect(screen.getByText(/That vessel changed/)).toBeVisible();
    });
    it('explains the missing Shield reaction trigger without offering a slot-spending cast', () => {
        const onAction = vi.fn();
        render(<CastSpellControls spell={shieldData as Spell} character={makeCharacter()}
            isReadyToCast onAction={onAction} />);
        expect(screen.queryByTestId('cast-spell-button')).not.toBeInTheDocument();
        expect(screen.getByTestId('cast-spell-controls')).toHaveTextContent('Reaction spell — use it when its trigger occurs.');
        expect(onAction).not.toHaveBeenCalled();
    });

    it('casting a targeted spell opens the party picker, and picking dispatches CAST_SPELL', () => {
        const onAction = vi.fn();
        const caster = makeCharacter();
        render(
            <CastSpellControls
                spell={cureWounds}
                character={caster}
                party={[caster, ally]}
                isReadyToCast={true}
                onAction={onAction}
            />,
        );

        fireEvent.click(screen.getByTestId('cast-spell-button'));
        expect(onAction).not.toHaveBeenCalled();

        const picker = screen.getByTestId('cast-target-picker');
        expect(picker).toHaveTextContent('Bram (4/12 HP)');

        fireEvent.click(screen.getByText(/Bram/));
        expect(onAction).toHaveBeenCalledExactlyOnceWith({
            type: 'CAST_SPELL',
            label: 'Cast Cure Wounds',
            payload: {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'cure-wounds',
                outOfCombat: { targetCharacterId: 'pc-ally' },
            },
        });
    });

    it('self/area utility spells cast directly without a picker', () => {
        const onAction = vi.fn();
        const caster = makeCharacter();
        render(
            <CastSpellControls
                spell={detectMagic}
                character={caster}
                party={[caster, ally]}
                isReadyToCast={true}
                onAction={onAction}
            />,
        );

        fireEvent.click(screen.getByTestId('cast-spell-button'));
        expect(screen.queryByTestId('cast-target-picker')).toBeNull();
        expect(onAction).toHaveBeenCalledExactlyOnceWith({
            type: 'CAST_SPELL',
            label: 'Cast Detect Magic',
            payload: {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'detect-magic',
                outOfCombat: { targetCharacterId: 'pc-caster' },
            },
        });
    });

    it('disables the button with a clear reason when no slot of the level remains', () => {
        const onAction = vi.fn();
        const drained = makeCharacter({ spellSlots: { level_1: { current: 0, max: 3 } } });
        render(
            <CastSpellControls
                spell={cureWounds}
                character={drained}
                isReadyToCast={true}
                onAction={onAction}
            />,
        );

        const button = screen.getByTestId('cast-spell-button');
        expect(button).toBeDisabled();
        expect(screen.getByTestId('cast-disabled-reason')).toHaveTextContent(
            'No level 1+ spell slots remaining.',
        );
        fireEvent.click(button);
        expect(onAction).not.toHaveBeenCalled();
    });

    it('disables the button when the spell is not prepared', () => {
        const onAction = vi.fn();
        render(
            <CastSpellControls
                spell={cureWounds}
                character={makeCharacter()}
                isReadyToCast={false}
                notReadyReason="Not prepared."
                onAction={onAction}
            />,
        );

        expect(screen.getByTestId('cast-spell-button')).toBeDisabled();
        expect(screen.getByTestId('cast-disabled-reason')).toHaveTextContent('Not prepared.');
    });

    it('shows a combat-only note instead of a button for damage spells', () => {
        render(
            <CastSpellControls
                spell={fireBolt}
                character={makeCharacter()}
                isReadyToCast={true}
                onAction={vi.fn()}
            />,
        );

        expect(screen.queryByTestId('cast-spell-button')).toBeNull();
        expect(screen.getByTestId('cast-spell-controls')).toHaveTextContent(
            'Combat spell — cast it from the battle map.',
        );
    });
});
