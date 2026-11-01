/**
 * These tests prove raw town chronicle entries reach the correct public-news
 * tier. Property changes stay visible to boards without drowning out disasters
 * and institutional succession in the headline channel.
 */
import { selectTownNews, townNewsContext } from '../townNews';
import type { TownSimState, LifeEvent } from '../types';
import { DAYS_PER_YEAR } from '../constants';

function ev(p: Partial<LifeEvent> & { id: number; kind: LifeEvent['kind']; day: number }): LifeEvent {
  return { subjectId: 0, relatedIds: [], summary: `event ${p.id}`, ...p };
}

function townWith(events: LifeEvent[]): TownSimState {
  return {
    burgId: 1,
    villagers: {},
    chronicle: { burgId: 1, events, nextEventId: events.length + 1 },
    lastSimDay: events.reduce((m, e) => Math.max(m, e.day), 0),
    nextVillagerId: 1,
  };
}

describe('selectTownNews', () => {
  const town = townWith([
    ev({ id: 1, kind: 'disaster', day: 1000, summary: 'A fire swept the town.' }),
    ev({ id: 2, kind: 'role_succession', day: 1010, summary: 'Mara succeeded as lord.' }),
    ev({ id: 3, kind: 'marriage', day: 1005, summary: 'A married B.' }),
    ev({ id: 4, kind: 'birth', day: 1008, summary: 'C was born.' }),
    ev({ id: 5, kind: 'festival', day: 1009, summary: 'Harvest festival.' }),
    ev({ id: 6, kind: 'building', day: 1007, summary: 'A home was rebuilt.' }),
    ev({ id: 7, kind: 'player_intervention', day: 1006, summary: 'Aria organized repairs.' }),
  ]);
  const currentDay = 1010;

  it('classifies prominence tiers correctly', () => {
    const all = selectTownNews(town, currentDay);
    const byId = new Map(all.map((i) => [i.id, i.prominence]));
    expect(byId.get(1)).toBe('headline'); // disaster
    expect(byId.get(2)).toBe('headline'); // succession
    expect(byId.get(3)).toBe('notice'); // marriage
    expect(byId.get(4)).toBe('gossip'); // birth
    expect(byId.get(5)).toBe('gossip'); // festival
    expect(byId.get(6)).toBe('notice'); // property lifecycle
    expect(byId.get(7)).toBe('notice'); // player action echoes through town
  });

  it('returns most-recent first', () => {
    const all = selectTownNews(town, currentDay);
    const days = all.map((i) => i.day);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it('filters by minimum prominence (headlines only for a crier)', () => {
    const headlines = selectTownNews(town, currentDay, { minProminence: 'headline' });
    expect(headlines.every((i) => i.prominence === 'headline')).toBe(true);
    expect(headlines.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it('honors max and the recency window', () => {
    expect(selectTownNews(town, currentDay, { max: 2 }).length).toBe(2);
    // an old event outside the 2-year window is excluded
    const withOld = townWith([
      ...town.chronicle.events,
      ev({ id: 9, kind: 'marriage', day: 1010 - 3 * DAYS_PER_YEAR, summary: 'ancient wedding' }),
    ]);
    expect(selectTownNews(withOld, currentDay).some((i) => i.id === 9)).toBe(false);
  });
});


describe('townNewsContext', () => {
  const source = ev({id:260,kind:'building',day:-51,subjectId:285,relatedIds:[484,285,999],summary:'A household brought the abandoned home back into use.'});
  const town = {...townWith([source]),villagers:{
    285:{occupantId:285,name:'Oswin Oakcroft',race:'Half-Elf',bornDay:-18613,parentIds:[],childIds:[],homePlotId:64,wealth:50},
    484:{occupantId:484,name:'Faelan Ironfield',race:'Tiefling',bornDay:-18248,parentIds:[],childIds:[],homePlotId:64,wealth:50},
  }};
  const item=selectTownNews(town,5)[0];
  it('dates an actual older event and names its source participants without changing the town',()=>{
    const before=JSON.stringify(town);
    expect(townNewsContext(town,item,5)).toEqual({ageLabel:'56 days ago',people:[{id:285,name:'Oswin Oakcroft'},{id:484,name:'Faelan Ironfield'}]});
    expect(JSON.stringify(town)).toBe(before);
  });
  it.each([[0,'Today'],[1,'Yesterday'],[2,'2 days ago']])('dates a report %s days old', (age,label)=>{
    expect(townNewsContext(town,item,source.day+Number(age)).ageLabel).toBe(label);
  });
  it('withholds people if the displayed story no longer matches its source',()=>{
    expect(townNewsContext(town,{...item,text:'Somebody needs rescuing.'},5).people).toEqual([]);
  });
  it('does not attach an ambiguous event id to people',()=>{
    expect(townNewsContext({...town,chronicle:{...town.chronicle,events:[source,{...source}]}},item,5).people).toEqual([]);
  });
  it('does not infer people from prose, a current spouse or a shared home',()=>{
    const anonymous={...source,subjectId:0,relatedIds:[],summary:'Oswin needs help at home64.'};
    const other={...town,chronicle:{...town.chronicle,events:[anonymous]}};
    expect(townNewsContext(other,selectTownNews(other,5)[0],5).people).toEqual([]);
  });
  it('keeps historical participants after death but excludes people not yet born or mismatched ids',()=>{
    const changed={...town,villagers:{285:{...town.villagers[285],diedDay:0},484:{...town.villagers[484],bornDay:0}}};
    expect(townNewsContext(changed,item,5).people).toEqual([{id:285,name:'Oswin Oakcroft'}]);
    expect(townNewsContext({...town,villagers:{285:{...town.villagers[285],occupantId:9}}},item,5).people).toEqual([]);
  });
  it('does not present future or invalid dates as current news',()=>{
    expect(townNewsContext(town,item,-52).ageLabel).toBe('Date unavailable');
    expect(townNewsContext(town,item,NaN).ageLabel).toBe('Date unavailable');
  });
});
