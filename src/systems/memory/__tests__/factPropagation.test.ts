/**
 * @file src/systems/memory/__tests__/factPropagation.test.ts
 * DIAL-002 acceptance tests: same-town propagation is immediate, cross-town
 * strangers are blocked, faction-aligned NPCs are delayed a day, and the
 * stranger channel only opens through the rumor mill.
 */
import { describe, it, expect } from 'vitest';
import { KnownFact } from '../../../types/world';
import {
  FACT_PROPAGATION_RULES,
  buildPropagatedFactDialogueContext,
  buildPropagationRoster,
  duePropagatedFacts,
  isPropagatableFact,
  propagateFact,
  PropagationNpc,
} from '../factPropagation';

const DAY = 10;

const publicFact = (overrides: Partial<KnownFact> = {}): KnownFact => ({
  id: 'fact-1',
  text: 'The stranger broke the seal beneath the chapel.',
  source: 'direct',
  isPublic: true,
  timestamp: DAY,
  strength: 8,
  lifespan: 30,
  ...overrides,
});

/**
 * Two NPCs in Ashford, one of them sworn to the Ember Watch; one Ember Watch
 * NPC in a different town; one wholly unconnected NPC in a third town.
 */
const ROSTER: PropagationNpc[] = [
  { id: 'bram', townId: 'ashford', factionId: 'ember_watch' },
  { id: 'neighbor', townId: 'ashford' },
  { id: 'distant_ally', townId: 'karsk', factionId: 'ember_watch' },
  { id: 'stranger', townId: 'volmar' },
];

describe('propagateFact', () => {
  it('shares a public fact with same-town NPCs immediately (delay 0)', () => {
    const results = propagateFact(publicFact(), {
      originNpcId: 'bram',
      npcs: ROSTER,
      learnedOnDay: DAY,
    });

    const sameTown = results.filter(r => r.channel === 'same_town');
    expect(sameTown.map(r => r.npcId)).toEqual(['neighbor']);
    expect(sameTown[0].availableFromDay).toBe(DAY);
    expect(FACT_PROPAGATION_RULES.same_town.delayDays).toBe(0);

    // Available the very same day, and it carries its source so dialogue can
    // say who it came from.
    const dueNow = duePropagatedFacts(results, DAY);
    expect(dueNow.map(r => r.npcId)).toContain('neighbor');
    expect(dueNow.find(r => r.npcId === 'neighbor')!.fact.sourceNpcId).toBe('bram');
    expect(dueNow.find(r => r.npcId === 'neighbor')!.fact.source).toBe('gossip');
    // Text is preserved verbatim so the reducer's text de-duplication holds.
    expect(dueNow.find(r => r.npcId === 'neighbor')!.fact.text).toBe(publicFact().text);
  });

  it('blocks NPCs in another town with no faction tie and no rumor reach', () => {
    const results = propagateFact(publicFact(), {
      originNpcId: 'bram',
      npcs: ROSTER,
      learnedOnDay: DAY,
    });

    expect(results.map(r => r.npcId)).not.toContain('stranger');

    // ...and stays blocked no matter how much time passes.
    expect(duePropagatedFacts(results, DAY + 365).map(r => r.npcId)).not.toContain('stranger');

    // The stranger channel opens ONLY when the rumor mill carried the talk.
    const withRumor = propagateFact(publicFact(), {
      originNpcId: 'bram',
      npcs: ROSTER,
      learnedOnDay: DAY,
      rumorReachedNpcIds: ['stranger'],
    });
    const strangerEntry = withRumor.find(r => r.npcId === 'stranger');
    expect(strangerEntry?.channel).toBe('rumor_mill');
    expect(duePropagatedFacts(withRumor, DAY).map(r => r.npcId)).not.toContain('stranger');
  });

  it('delays faction-aligned NPCs in another town by one in-game day', () => {
    const results = propagateFact(publicFact(), {
      originNpcId: 'bram',
      npcs: ROSTER,
      learnedOnDay: DAY,
    });

    const ally = results.find(r => r.npcId === 'distant_ally');
    expect(ally?.channel).toBe('faction');
    expect(FACT_PROPAGATION_RULES.faction.delayDays).toBe(1);
    expect(ally?.availableFromDay).toBe(DAY + 1);

    expect(duePropagatedFacts(results, DAY).map(r => r.npcId)).toEqual(['neighbor']);
    expect(duePropagatedFacts(results, DAY + 1).map(r => r.npcId)).toEqual(
      expect.arrayContaining(['neighbor', 'distant_ally'])
    );

    // The delayed copy is less certain than the same-town one.
    const neighbor = results.find(r => r.npcId === 'neighbor')!;
    expect(ally!.fact.confidence!).toBeLessThan(neighbor.fact.confidence!);
  });

  it('never propagates a private fact or a fact that is itself hearsay', () => {
    const secret = publicFact({ isPublic: false });
    expect(isPropagatableFact(secret)).toBe(false);
    expect(propagateFact(secret, { originNpcId: 'bram', npcs: ROSTER, learnedOnDay: DAY })).toEqual([]);

    const hearsay = publicFact({ source: 'gossip', sourceNpcId: 'someone' });
    expect(isPropagatableFact(hearsay)).toBe(false);
    expect(propagateFact(hearsay, { originNpcId: 'bram', npcs: ROSTER, learnedOnDay: DAY })).toEqual([]);
  });
});

describe('buildPropagationRoster', () => {
  it('derives town membership from locations and keeps faction from the NPC record', () => {
    const roster = buildPropagationRoster({
      npcs: {
        bram: { id: 'bram', faction: 'ember_watch' },
        neighbor: { id: 'neighbor' },
      },
      locations: { ashford: { npcIds: ['bram', 'neighbor'] } },
      extraTownMembers: { ashford: ['wanderer'] },
    });

    expect(roster).toEqual(
      expect.arrayContaining([
        { id: 'bram', townId: 'ashford', factionId: 'ember_watch' },
        { id: 'neighbor', townId: 'ashford', factionId: undefined },
        // A runtime NPC absent from the registry still counts as a townsfolk.
        { id: 'wanderer', townId: 'ashford' },
      ])
    );
  });
});

describe('buildPropagatedFactDialogueContext', () => {
  it('surfaces only second-hand facts, newest first, naming the source NPC', () => {
    const facts: KnownFact[] = [
      publicFact({ id: 'own', text: 'I saw it myself.' }),
      publicFact({ id: 'a', text: 'Older news.', source: 'gossip', sourceNpcId: 'bram', timestamp: 1 }),
      publicFact({ id: 'b', text: 'Newer news.', source: 'gossip', sourceNpcId: 'ghost', timestamp: 5 }),
    ];

    const lines = buildPropagatedFactDialogueContext(facts, id => (id === 'bram' ? 'Bram' : undefined));

    expect(lines).toEqual([
      'someone in town mentioned: Newer news.',
      'Bram mentioned: Older news.',
    ]);
  });
});

describe('reported personal meetings use their own subject and date clock',()=>{
  const instant=new Date('0351-01-01T07:43:00Z').getTime();
  it('reports the origin person meeting Mara instead of claiming the recipient met her',()=>{
    const fact=publicFact({text:'Met Mara Tanner.',factKey:'player_met_npc',timestamp:instant});
    const context={originNpcId:'bram',originName:'Elara Vance',npcs:ROSTER,learnedOnDay:DAY};
    const report=propagateFact(fact,context).find(row=>row.npcId==='neighbor')!.fact;
    expect(report.factKey).toBe('player_met_npc:bram');
    expect(report.text).toBe('Elara Vance met Mara Tanner.');
    expect(report.source).toBe('gossip');expect(report.sourceNpcId).toBe('bram');
    expect(fact.text).toBe('Met Mara Tanner.');expect(fact.factKey).toBe('player_met_npc');
  });
  it.each([['neighbor','same_town'],['distant_ally','faction'],['stranger','rumor_mill']] as const)('keeps millisecond date recency separate from day availability for %s', (target,channel)=>{
    const fact=publicFact({timestamp:instant});
    const result=propagateFact(fact,{originNpcId:'bram',npcs:ROSTER,learnedOnDay:DAY,rumorReachedNpcIds:['stranger']}).find(row=>row.npcId===target)!;
    const delay=FACT_PROPAGATION_RULES[channel].delayDays;
    expect(result.availableFromDay).toBe(DAY+delay);
    expect(result.fact.timestamp).toBe(instant+delay*86400000);
    expect(result.fact.text).toBe(fact.text);
  });
});
