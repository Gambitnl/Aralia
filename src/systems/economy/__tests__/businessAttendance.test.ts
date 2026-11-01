import { describe, expect, it } from 'vitest';
import { attendanceForVisit, businessAttendance } from '../businessAttendance';
import type { TownBuildingVisit } from '../../../components/Worldforge/townBuildingVisit';
import type { GameState } from '../../../types/state';
import type { WorldBusiness } from '../../../types/business';

function visit(hours: number[], household = true): TownBuildingVisit {
  return { household: household ? { members: [{}] } : undefined,
    occupancy: { stationsByHour: Array.from({length:24}, (_,hour) => hours.includes(hour)
      ? [{memberIndex:0,where:'home',activity:'work'}] : [{memberIndex:0,where:'away',activity:'work'}]) }
  } as unknown as TownBuildingVisit;
}
describe('source business attendance', () => {
  it('refuses an ambiguous legacy keeper without calling either namesake deceased', () => {
    const source=visit([9]);
    source.household={homeId:'b151',members:[{name:'Roban Westsmith',role:'head'},{name:'Roban Westsmith',role:'child'}]} as never;
    const life={villagers:{395:{occupantId:395,name:'Roban Westsmith',homePlotId:151,bornDay:-10000,diedDay:-253}}};
    expect(attendanceForVisit(source,9,life,3)).toMatchObject({open:false,hours:'Unverified'});
    expect(attendanceForVisit(source,9,life,3).reason).not.toContain('died');
  });
  it('honors a saved death even when numeric roster slots have shifted', () => {
    const source=visit([8,9]);
    source.household={homeId:'b151',members:[{name:'Roban Westsmith',role:'head'}]} as never;
    const life={villagers:{395:{occupantId:395,name:'Roban Westsmith',homePlotId:151,bornDay:-10000,diedDay:-253},
      405:{occupantId:405,name:'Oswin Thornhall',homePlotId:149,bornDay:-10000}}};
    const before=JSON.stringify(life);
    expect(attendanceForVisit(source,9,life,3)).toMatchObject({open:false,hours:'Unstaffed'});
    expect(attendanceForVisit(source,9,life,3).reason).toContain('No successor');
    expect(JSON.stringify(life)).toBe(before);
  });
  it('posts split shifts and refuses the dawn and meal breaks', () => {
    const source=visit([8,9,10,11,14,15,16]);
    expect(attendanceForVisit(source,5)).toMatchObject({open:false,hours:'08:00–12:00, 14:00–17:00'});
    expect(attendanceForVisit(source,8).open).toBe(true);
    expect(attendanceForVisit(source,12).open).toBe(false);
    expect(attendanceForVisit(source,17).open).toBe(false);
  });
  it('keeps a retired or unstaffed proprietor closed rather than summoning one', () => {
    expect(attendanceForVisit(visit([]),12)).toMatchObject({open:false,hours:'No staffed trading hours'});
    expect(attendanceForVisit(visit([12],false),12).open).toBe(false);
  });
  it('does not substitute a family member who is at home but not working', () => {
    const source=visit([]);
    source.occupancy!.stationsByHour[12]=[{memberIndex:0,where:'home',activity:'rest'} as never,
      {memberIndex:1,where:'home',activity:'work'} as never];
    expect(attendanceForVisit(source,12).open).toBe(false);
  });
  it('preserves unlocated legacy shops instead of assigning invented hours', async () => {
    expect(await businessAttendance({} as GameState,{} as WorldBusiness)).toBeUndefined();
  });
});
