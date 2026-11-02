/** Identify which retained layout reader agrees with an unversioned town's
 * own observations and people. Never infer a revision from age or a plot ID.
 *
 * The admission producer must regenerate each candidate independently, with
 * NO retained building override, at each observation's original history.
 * This gate does not generate, mutate, persist or mount a town. A qualified
 * reader still needs physical support, job/site joins and reload admission.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 16:40:51
 * Dependents: systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintPlan} from '../interior/blueprintTypes';
import {readObservedBuildingSource, type ObservedBuildingSource} from '../interior/buildingSource';
import type {TownRoster} from '../roster/types';
import type {TownSimState} from '../townsim/types';
import {HISTORICAL_TOWN_LAYOUT_REVISIONS, type TownLayoutRevision} from './townLayoutRevision';

export interface HistoricalTownLayoutCandidate {
  revision: TownLayoutRevision;
  worldSeed: number;
  burgId: number;
  cellId: number;
  plotIds: readonly number[];
  foundingRoster: TownRoster;
  /** Independently generated foundations at the original observation history.
   * Do not use readObservedBuildingSource to construct these candidate plans. */
  buildings: Readonly<Record<number, {
    plan: BlueprintPlan;
    site: ObservedBuildingSource['site'];
  }>>;
}

type CandidateProblem = 'wrong-place' | 'invalid-plots' | 'invalid-roster'
  | 'founder-mismatch' | 'missing-home' | 'building-mismatch';
export type HistoricalTownLayoutQualification =
  | {status: 'qualified'; revision: TownLayoutRevision; observations: number; founders: number}
  | {status: 'unresolved'; reason: 'already-selected' | 'invalid-context' | 'missing-observations'
      | 'invalid-observations' | 'incomplete-readers' | 'no-match' | 'ambiguous';
      candidates?: readonly {revision: TownLayoutRevision; problem?: CandidateProblem}[]};

/** Full blueprint comparison deliberately does not trust the short FNV drift
 * signature as proof. Tiny coordinate dust is tolerated only in world sites;
 * rooms, contents indices, household briefs and every blueprint number agree
 * exactly. A refusal leaves old records readable and all campaign state intact. */
export function qualifyHistoricalTownLayout(input: {
  worldSeed: number;
  cellId: number;
  gameTime: Date | string;
  town: TownSimState;
  candidates: readonly HistoricalTownLayoutCandidate[];
  /** The producer must also check saved business/keeper joins and exact dry
   * exterior support. This cannot qualify a remembered interior foundation. */
  allowUnobservedExterior?: boolean;
}): HistoricalTownLayoutQualification {
  const {town,worldSeed,cellId,candidates}=input;
  if (town.layoutRevision!==undefined) return {status:'unresolved',reason:'already-selected'};
  const now=Number(new Date(input.gameTime));
  if (!Number.isSafeInteger(worldSeed) || !Number.isSafeInteger(cellId) || cellId<0
    || !Number.isSafeInteger(town.burgId) || town.burgId<=0 || !Number.isFinite(now)
    || town.chronicle.burgId!==town.burgId) return {status:'unresolved',reason:'invalid-context'};
  const entries=Object.entries(town.buildingSources??{});
  if (!entries.length && !input.allowUnobservedExterior) return {status:'unresolved',reason:'missing-observations'};
  const siteFields=['xM','zM','surfaceY','rotationY','doorZSign'] as const;
  try {
    for (const [key,source] of entries) {
      if (String(source.plotId)!==key || source.cellId!==cellId
        || siteFields.some(field=>!Number.isFinite(source.site?.[field]))
        || !Number.isFinite(Date.parse(source.observedAt)) || Date.parse(source.observedAt)>now) {
        return {status:'unresolved',reason:'invalid-observations'};
      }
      // Validate the immutable foundation, manifests and same-world identity.
      // Later repairs/events are NOT substituted into the candidate comparison.
      readObservedBuildingSource({worldSeed,burgId:town.burgId,source},source.plotId,
        JSON.parse(source.historySignature)??undefined);
    }
  } catch { return {status:'unresolved',reason:'invalid-observations'}; }

  // A caller cannot secure a unique match simply by omitting the alternative.
  // Extend this inventory when another historical reader is introduced.
  const readers=HISTORICAL_TOWN_LAYOUT_REVISIONS;
  if (candidates.length!==readers.length || readers.some(revision=>
    candidates.filter(candidate=>candidate.revision===revision).length!==1)) {
    return {status:'unresolved',reason:'incomplete-readers'};
  }
  const reports=candidates.map(candidate=>({revision:candidate.revision,
    problem:candidateProblem(candidate)}));
  const matches=reports.filter(report=>report.problem===undefined);
  if (matches.length!==1) return {status:'unresolved',reason:matches.length?'ambiguous':'no-match',candidates:reports};
  const match=candidates.find(candidate=>candidate.revision===matches[0].revision)!;
  return {status:'qualified',revision:match.revision,observations:entries.length,
    founders:match.foundingRoster.occupants.length};

  function candidateProblem(candidate: HistoricalTownLayoutCandidate): CandidateProblem | undefined {
    if (candidate.worldSeed!==worldSeed || candidate.burgId!==town.burgId
      || candidate.cellId!==cellId || candidate.foundingRoster.burgId!==town.burgId) return 'wrong-place';
    const plots=new Set(candidate.plotIds);
    if (!plots.size || plots.size!==candidate.plotIds.length
      || candidate.plotIds.some(id=>!Number.isSafeInteger(id)||id<0)) return 'invalid-plots';
    const founders=candidate.foundingRoster.occupants;
    if (!founders.length || new Set(founders.map(person=>person.id)).size!==founders.length
      || founders.some(person=>!Number.isSafeInteger(person.id)||person.id<=0
        || typeof person.name!=='string'||!person.name.trim()||!plots.has(person.homePlotId)
        || person.workPlotId!==undefined&&!plots.has(person.workPlotId)
        || person.civicWorkplace!==undefined&&!plots.has(person.civicWorkplace.plotId))) return 'invalid-roster';
    for (const person of founders) {
      const saved=town.villagers[person.id];
      if (!saved || saved.occupantId!==person.id || saved.name!==person.name
        || saved.householdMemberId!==person.householdMemberId
        || Object.values(town.villagers).filter(other=>other.occupantId===person.id).length!==1
        || person.householdMemberId!==undefined&&Object.values(town.villagers)
          .filter(other=>other.householdMemberId===person.householdMemberId).length!==1) return 'founder-mismatch';
    }
    const foundingIds=new Set(founders.map(person=>person.id));
    for (const saved of Object.values(town.villagers)) {
      if (foundingIds.has(saved.occupantId)) continue;
      // Missing founders cannot be disguised as later population. Only a real
      // dated birth in the saved diary explains a person outside the roster.
      // If old retention removed that proof, admission remains unresolved.
      const births=town.chronicle.events.filter(event=>event.kind==='birth'
        && event.subjectId===saved.occupantId && event.day===saved.bornDay);
      if (births.length!==1 || saved.parentIds.length===0
        || saved.parentIds.some(id=>!town.villagers[id]
          || !births[0].relatedIds.includes(id))) return 'founder-mismatch';
    }
    // Marriage, inheritance and children can change a current home. Never put
    // residents back in founding homes to satisfy a geometry comparison.
    if (Object.values(town.villagers).some(person=>!plots.has(person.homePlotId))) return 'missing-home';
    for (const [,source] of entries) {
      const building=candidate.buildings[source.plotId];
      if (!plots.has(source.plotId) || !building || building.plan.buildingId!==source.plotId
        || JSON.stringify(building.plan)!==JSON.stringify(source.plan)
        || siteFields.some(field=>{
          return !Number.isFinite(building.site[field])
            || Math.abs(building.site[field]-source.site[field])>1e-8;
        })) return 'building-mismatch';
    }
    return undefined;
  }
}
