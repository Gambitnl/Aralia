
import { describe, it, expect } from 'vitest';
import { UnderdarkMechanics } from '../UnderdarkMechanics';
import { GameState, UnderdarkState, LightSource } from '../../../types';
import { initialGameState } from '../../../state/initialState';

describe('UnderdarkMechanics', () => {

    // Helper to create a clean state with specific underdark settings
    const createTestState = (underdarkOverrides: Partial<UnderdarkState>): GameState => {
        return {
            ...initialGameState,
            underdark: {
                ...initialGameState.underdark,
                ...underdarkOverrides
            },
            gameTime: new Date('2025-01-01T12:00:00Z') // Fixed time
        };
    };

    const boundLight = (): LightSource => ({id:'owned-light',type:'spell',name:'Light on Sickle',radius:40,
        durationRemaining:60,isActive:true,bearerId:'caster',expiresAtGameTime:Date.parse('2025-01-01T13:00:00Z'),
        objectLight:{casterId:'caster',slot:'MainHand',color:'#fff1ca',spellId:'light'}});
    const withHeldLight = (state: GameState): GameState => ({...state, party:[{id:'caster',
        equippedItems:{MainHand:{id:'sickle',name:'Sickle',lightSpellId:'owned-light'}}}] as unknown as GameState['party']});

    it('derives bound Light once from the advanced clock while preserving torch fuel and source state', () => {
        const light=boundLight(),torch:LightSource={id:'torch',type:'torch',name:'Torch',radius:20,durationRemaining:60,isActive:true};
        const state=withHeldLight(createTestState({activeLightSources:[light,torch]}));
        state.gameTime=new Date('2025-01-01T12:00:01Z');
        const before=JSON.stringify(state),result=UnderdarkMechanics.processTime(state,1);
        expect(result.underdark.activeLightSources.find(s=>s.id==='owned-light')?.durationRemaining).toBeCloseTo(60-1/60,10);
        expect(result.underdark.activeLightSources.find(s=>s.id==='torch')?.durationRemaining).toBeCloseTo(60-1/60,10);
        expect(JSON.stringify(state)).toBe(before);
    });

    it('keeps the final second of bound Light even when an old cached countdown is low', () => {
        const light={...boundLight(),durationRemaining:.0001};
        const state=withHeldLight(createTestState({activeLightSources:[light]}));
        state.gameTime=new Date('2025-01-01T12:59:59Z');
        const result=UnderdarkMechanics.processTime(state,1);
        expect(result.underdark.activeLightSources[0].durationRemaining).toBeCloseTo(1/60,10);
        expect(result.underdark.activeLightSources[0].isActive).toBe(true);
        expect(result.messages).toEqual([]);
    });

    it('expires a packed bound light at its deadline while retaining its inactive source identity', () => {
        const state=createTestState({activeLightSources:[boundLight()]});
        state.gameTime=new Date('2025-01-01T12:30:00Z');
        const packed=UnderdarkMechanics.processTime(state,60);
        expect(packed.underdark.activeLightSources[0]).toMatchObject({isActive:false,durationRemaining:30});
        state.underdark=packed.underdark;state.gameTime=new Date('2025-01-01T13:00:00Z');
        const expired=UnderdarkMechanics.processTime(state,1800);
        expect(expired.underdark.activeLightSources).toHaveLength(1);
        expect(expired.underdark.activeLightSources[0]).toMatchObject({id:'owned-light',isActive:false,durationRemaining:0});
        expect(expired.messages).toEqual([]);
        expect(UnderdarkMechanics.processTime({...state,underdark:expired.underdark},1).messages).toEqual([]);
    });

    it('should consume light source duration', () => {
        const torch: LightSource = {
            id: 'torch1',
            type: 'torch',
            name: 'Torch',
            radius: 20,
            durationRemaining: 60, // 60 minutes
            isActive: true
        };

        const state = createTestState({
            activeLightSources: [torch],
            currentDepth: 100 // Must be in underdark for some logic, though consumption happens regardless
        });

        // Advance 30 minutes (1800 seconds)
        const result = UnderdarkMechanics.processTime(state, 1800);

        expect(result.underdark.activeLightSources[0].durationRemaining).toBe(30);
        expect(result.messages.length).toBe(0);
    });

    it('should remove expired light sources and log a message', () => {
        const torch: LightSource = {
            id: 'torch1',
            type: 'torch',
            name: 'Torch',
            radius: 20,
            durationRemaining: 10, // 10 minutes
            isActive: true
        };

        const state = createTestState({
            activeLightSources: [torch],
            currentDepth: 100
        });

        // Advance 20 minutes (1200 seconds) - Torch should die
        const result = UnderdarkMechanics.processTime(state, 1200);

        expect(result.underdark.activeLightSources.length).toBe(0);
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].text).toContain('flickers and dies');
    });

    it('should set light level to darkness when no sources remain in Underdark', () => {
        const state = createTestState({
            activeLightSources: [],
            currentDepth: 100, // In Underdark
            lightLevel: 'bright' // Start bright (maybe from previous source)
        });

        const result = UnderdarkMechanics.processTime(state, 60);

        expect(result.underdark.lightLevel).toBe('darkness');
    });

    it('should NOT reduce sanity if in bright light', () => {
        // Need an active light source to keep it bright, otherwise processTime sets it to darkness
        const torch: LightSource = {
            id: 'torch1',
            type: 'torch',
            name: 'Torch',
            radius: 20,
            durationRemaining: 600, // Long lasting
            isActive: true
        };

        const state = createTestState({
            activeLightSources: [torch],
            currentDepth: 100,
            lightLevel: 'bright',
            sanity: { current: 100, max: 100, madnessLevel: 0 }
        });

        const result = UnderdarkMechanics.processTime(state, 3600); // 1 hour

        expect(result.underdark.sanity.current).toBe(100);
    });

    it('should reduce sanity if in darkness', () => {
        const state = createTestState({
            currentDepth: 100,
            lightLevel: 'darkness',
            sanity: { current: 100, max: 100, madnessLevel: 0 }
        });

        // 1 hour of darkness = 2 sanity loss (1 per 30 mins)
        const result = UnderdarkMechanics.processTime(state, 3600);

        expect(result.underdark.sanity.current).toBe(98);
    });

    it('should increase madness level when sanity drops below threshold', () => {
        const state = createTestState({
            currentDepth: 100,
            lightLevel: 'darkness',
            sanity: { current: 26, max: 100, madnessLevel: 0 } // Just above 25%
        });

        // Drop enough to cross 25% threshold (need to lose > 1 point)
        // 1 hour = -2 points -> 24 (which is < 25)
        const result = UnderdarkMechanics.processTime(state, 3600);

        expect(result.underdark.sanity.current).toBe(24);
        expect(result.underdark.sanity.madnessLevel).toBe(3); // Highest madness
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].text).toContain('presses against your mind');
    });
});
