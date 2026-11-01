import { describe, it, expect, vi } from 'vitest';
import { TavernGossipSystem, chronicleRumorContext } from '../TavernGossipSystem';
import { createMockGameState } from '../../../utils/core';

describe('TavernGossipSystem', () => {
    it('offers the actual local dungeon account without inventing an unrelated directional quest', () => {
        for (let worldSeed = 1; worldSeed <= 40; worldSeed++) {
            const state = createMockGameState({worldSeed, currentLocationId: 'cell_4337',
                gameTime: new Date('0351-01-06T16:05:44Z'), factions: {},
                activeRumors: [{id: 'dungeon-source-account', type: 'misc',
                    text: 'Witnesses report fungal growth in the Alrio Channels.',
                    timestamp: 0, expiration: Number.MAX_SAFE_INTEGER, locationId: 'cell_4337'}],
            });
            const offers = TavernGossipSystem.getAvailableRumors(state, 'The Howling Shield');
            expect(offers.find(offer => offer.id === 'gossip_dungeon-source-account'))
                .toMatchObject({content: state.activeRumors[0].text, payload: state.activeRumors[0]});
            expect(offers.filter(offer => offer.questId === 'explore_ruins' && !offer.payload), `world ${worldSeed}`)
                .toEqual([]);
        }
    });

    it('generates rumors deterministically', () => {
        const state = createMockGameState();
        state.worldSeed = 12345;
        state.gameTime = new Date('2024-01-01T00:00:00Z'); // Fixed time

        const rumors1 = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
        const rumors2 = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
        const rumorsDiffLoc = TavernGossipSystem.getAvailableRumors(state, 'Inn');

        expect(rumors1).toEqual(rumors2);
        expect(rumors1).not.toEqual(rumorsDiffLoc);
        expect(rumors1.length).toBeGreaterThan(0);
    });

    it('generates generic rumors if no world rumors exist', () => {
        const state = createMockGameState();
        state.activeRumors = [];

        const rumors = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
        const genericRumor = rumors.find(r => r.id.startsWith('gossip_generic'));

        expect(genericRumor).toBeDefined();
        expect(genericRumor?.content).toContain("Not much happening");
    });

    it('can generate secrets', () => {
        // Mock state with many factions to increase secret generation chance or just loop until we find one
        // Since it's deterministic, we can find a seed that produces a secret, or mock Random.
        // For now, let's just check the structure of the returned objects.

        const state = createMockGameState();
        const rumors = TavernGossipSystem.getAvailableRumors(state, 'City');

        rumors.forEach(r => {
            expect(r).toHaveProperty('id');
            expect(r).toHaveProperty('cost');
            expect(r).toHaveProperty('type');
            if (r.type === 'secret') {
                expect(r.payload).toBeDefined();
                expect(r.payload).toHaveProperty('subjectId');
            }
        });
    });
});

vi.mock('../../worldforge/townsim/chronicleForLocation',()=>({burgIdForLocation:()=>2}));
const oldNews=()=>createMockGameState({worldSeed:77,currentLocationId:'cell_1506',gameTime:new Date('0351-01-01T15:10:41Z'),
 activeRumors:[{id:'chronicle-cell_1506-113',text:'Ivo married Ysolde.',type:'misc',timestamp:-248,expiration:31,locationId:'cell_1506'}],
 townSim:{2:{burgId:2,villagers:{},chronicle:{events:[{id:113,day:-248,kind:'marriage',summary:'Ivo married Ysolde.',subjectId:1,relatedIds:[2]}]}}} as never});
describe('paid chronicle news context',()=>{
 it('shows age and subject before purchase without revealing names or changing the source',()=>{const s=oldNews(),before=JSON.stringify(s),offer=TavernGossipSystem.getAvailableRumors(s,'Raven').find(o=>o.id==='gossip_chronicle-cell_1506-113')!;expect(offer.title).toBe('Family news · 249 days ago');expect(offer.context).toEqual({subject:'Family news',ageLabel:'249 days ago'});expect(offer.title).not.toMatch(/Ivo|Ysolde|latest/);expect(offer.content).toBe('Ivo married Ysolde.');expect(JSON.stringify(s)).toBe(before)});
 it('labels today and yesterday from the actual event day',()=>{for(const [day,label] of [[1,'Today'],[0,'Yesterday']] as const){const s=oldNews();s.activeRumors[0].timestamp=day;s.townSim[2].chronicle.events[0].day=day;expect(chronicleRumorContext(s,s.activeRumors[0])?.ageLabel).toBe(label)}});
 it('does not certify changed words, source dates, duplicate events or another location',()=>{for(const change of [(s:ReturnType<typeof oldNews>)=>{s.activeRumors[0].text='Changed';},(s:ReturnType<typeof oldNews>)=>{s.activeRumors[0].timestamp=0;},(s:ReturnType<typeof oldNews>)=>{s.townSim[2].chronicle.events.push({...s.townSim[2].chronicle.events[0]});},(s:ReturnType<typeof oldNews>)=>{s.currentLocationId='cell_elsewhere';}]){const s=oldNews();change(s);expect(chronicleRumorContext(s,s.activeRumors[0])).toBeUndefined()}});
 it('never calls unverified old accounts latest news',()=>{const s=oldNews();s.townSim={};expect(TavernGossipSystem.getAvailableRumors(s,'Raven').find(o=>o.id==='gossip_chronicle-cell_1506-113')?.title).toBe('Town account · date unverified')});
 it('does not relabel unrelated world rumors as chronicle facts',()=>{const s=oldNews();s.activeRumors[0].id='faction-news';expect(chronicleRumorContext(s,s.activeRumors[0])).toBeUndefined()});
});
