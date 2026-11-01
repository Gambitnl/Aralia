/** Public-house proprietors work while the evening taproom is occupied.
 * The same hours drive street attendance and the original household's indoor
 * stations. This changes a qualified job's routine, never its owner or home.
 * Other trades retain their existing day shift. Staff shifts remain separate
 * until an actual employment link identifies who works them. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 01:28:58
 * Dependents: systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/interior/occupancy.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/roster/occupantSchedule.ts, systems/worldforge/roster/types.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type PublicHouseWorkRole='innkeeper'|'taverner';
export interface WorkHours {readonly start:number;readonly end:number;readonly sleep:number}
const DAY:WorkHours=Object.freeze({start:8,end:18,sleep:22});
const PUBLIC_HOUSE:WorkHours=Object.freeze({start:12,end:23,sleep:23});

/** A building label alone cannot recruit a worker. Its recorded proprietor
 * home must match the existing household before it receives these hours. */
export function publicHouseWorkRoleForOwner(workplace:{buildingType?:string;proprietorHomeId?:string}|undefined,
 homeId:string|undefined):PublicHouseWorkRole|undefined{
 if(!homeId||workplace?.proprietorHomeId!==homeId)return undefined;
 return workplace.buildingType==='inn'?'innkeeper':workplace.buildingType==='tavern'?'taverner':undefined;
}

/** End is exclusive: patrons through 22:59 still have their keeper. Morning
 * home time and the later bedtime retain an ordinary daily family routine. */
export function workHoursForRole(role:PublicHouseWorkRole|undefined):WorkHours{
 return role==='innkeeper'||role==='taverner'?PUBLIC_HOUSE:DAY;
}
