// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/09/2026, 08:29:20
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file relationshipWeb.ts — the NPC relationship web for one town.
 *
 * `generateTownRoster` says who lives where and `assignFamilies` says who is
 * related to whom. Neither says how those people FEEL about each other, and
 * nothing until now recorded the sideways ties a town actually runs on: two
 * smiths who undercut each other, a lodger who drinks with the head of the
 * house, the shopkeeper who employs the neighbour's grown son.
 *
 * This file adds that layer as an explicit graph:
 *   - {@link buildTownRelationshipWeb} generates it at town-creation time from
 *     the roster + household/family data already produced upstream.
 *   - {@link applyPlayerAction} mutates it as the player affects people, so
 *     killing someone's friend really does sour the friend (and quietly please
 *     that person's rival).
 *   - {@link willAssistInCombat}, {@link questOfferDisposition} and
 *     {@link gossipSpreadFrom} are the read side the gossip, quest, and combat
 *     systems consume, so a rival will not fight beside you.
 *
 * Pure and deterministic: same roster + seed → byte-identical web. The web is a
 * plain JSON-shaped record (arrays, no Maps/Sets) so it can be saved, diffed,
 * and shipped to a worker without a custom serializer.
 *
 * Called by: town creation (roster pass) and the gossip/quest/combat consumers.
 * Depends on: roster `Occupant`/`TownRoster`, `assignFamilies` kinship, seedPath.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { assignFamilies, type FamilyTies } from './family';
import type { Occupant, TownRoster } from './types';

// ============================================================================
// Edge Contract
// ============================================================================
// One edge is one social tie between two townsfolk. `strength` is a single
// signed axis from -100 (they would spit on the ground) to +100 (they would die
// for them); an edge type does not imply a sign, because a family edge can be a
// bitter one and a rivalry can be affectionate. `label` is the short human
// phrase the UI and gossip lines quote verbatim.
// ============================================================================

export type RelationshipEdgeType =
  | 'family'
  | 'friend'
  | 'rival'
  | 'employer'
  | 'romantic';

/** Bounds for every strength value in the web. */
export const RELATIONSHIP_STRENGTH_MIN = -100;
export const RELATIONSHIP_STRENGTH_MAX = 100;

export interface RelationshipEdge {
  /** Occupant id the tie runs FROM. For `employer` this is the employer. */
  fromId: number;
  /** Occupant id the tie runs TO. For `employer` this is the employee. */
  toId: number;
  type: RelationshipEdgeType;
  /** -100 (hatred) … +100 (devotion). Signed independently of `type`. */
  strength: number;
  /** Short human phrase: 'sibling', 'tradesman rivalry', 'old war buddy'. */
  label: string;
}

/**
 * The whole town's social graph plus the mutable player-facing state layered on
 * top of it. Kept JSON-plain on purpose (see file header).
 */
export interface TownRelationshipWeb {
  burgId: number;
  edges: RelationshipEdge[];
  /**
   * How each townsperson feels about the PLAYER, -100…+100, keyed by occupant
   * id. Only people the player has affected (directly or through the web) get
   * an entry; a missing entry means neutral 0.
   */
  standing: Record<number, number>;
  /**
   * Occupants the player has killed. Their own edges stay in the graph — the
   * town remembers who they were to people — but they are skipped as gossip
   * carriers and combat allies.
   */
  deceased: number[];
}

// ============================================================================
// Generation Tuning
// ============================================================================
// These numbers are the entire feel of a generated town, so they live together
// and named rather than sprinkled through the passes below.
// ============================================================================

/** Max edges any one person carries, so a big roster cannot explode into O(n^2). */
export const MAX_DEGREE = 8;

/** A kin bond this negative is written as an estrangement instead of warmth. */
const ESTRANGEMENT_CHANCE = 0.12;

/** Chance two same-trade workers in town read each other as competition. */
const TRADE_RIVALRY_CHANCE = 0.55;

/** Chance two adults on neighbouring home plots became friends. */
const NEIGHBOUR_FRIEND_CHANCE = 0.35;

/** Chance a neighbour pair is soured into a feud instead. */
const NEIGHBOUR_FEUD_CHANCE = 0.15;

const FRIEND_LABELS: readonly string[] = [
  'old war buddy',
  'drinking companion',
  'childhood friend',
  'fellow congregant',
  'shares a garden wall',
  'card-table regular',
];

const FEUD_LABELS: readonly string[] = [
  'boundary dispute',
  'unpaid debt',
  'an old insult never withdrawn',
  'quarrels over the well',
];

const HOUSEMATE_LABELS: readonly string[] = [
  'shares a roof',
  'lodges under the same roof',
  'housemate',
];

interface Rng {
  next(): number;
}

const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng.next() * arr.length)] ?? arr[0];

/** Uniform integer in [lo, hi], clamped into the legal strength band. */
const strengthIn = (rng: Rng, lo: number, hi: number): number =>
  clampStrength(lo + Math.floor(rng.next() * (hi - lo + 1)));

export function clampStrength(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(RELATIONSHIP_STRENGTH_MIN, Math.min(RELATIONSHIP_STRENGTH_MAX, Math.round(value)));
}

/** Undirected identity for an edge, so we never store a pair twice. */
const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

// ============================================================================
// Generator
// ============================================================================
// Passes run in a fixed order and each one respects the degree cap, so the
// earlier (stronger, less optional) ties always win a contested slot: blood and
// marriage first, then the household, then work, then chosen ties. Every pass
// walks a sorted list so the result never depends on roster array order.
// ============================================================================

export interface BuildRelationshipWebOptions {
  /**
   * Kinship for the roster. Omitted, it is derived with `assignFamilies` from
   * the same seed path, which is what town creation wants; pass an existing map
   * when the caller already computed one so the two layers cannot disagree.
   */
  families?: Map<number, FamilyTies>;
  /** Degree cap override — mainly for tests and dense-town experiments. */
  maxDegree?: number;
}

/**
 * Build the relationship web for a generated town. Deterministic per
 * (roster, seedPath).
 */
export function buildTownRelationshipWeb(
  roster: TownRoster,
  seedPath: SeedPath,
  opts: BuildRelationshipWebOptions = {},
): TownRelationshipWeb {
  const rng = rngFromPath(streamPath(seedPath, `relweb:${roster.burgId}`));
  const maxDegree = opts.maxDegree ?? MAX_DEGREE;
  const people = [...roster.occupants].sort((a, b) => a.id - b.id);
  const families = opts.families ?? assignFamilies(roster.occupants, seedPath);

  const edges: RelationshipEdge[] = [];
  const seen = new Set<string>();
  const degree = new Map<number, number>();

  const add = (edge: RelationshipEdge): boolean => {
    if (edge.fromId === edge.toId) return false;
    const key = pairKey(edge.fromId, edge.toId);
    if (seen.has(key)) return false;
    if ((degree.get(edge.fromId) ?? 0) >= maxDegree) return false;
    if ((degree.get(edge.toId) ?? 0) >= maxDegree) return false;
    seen.add(key);
    degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
    degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    edges.push({ ...edge, strength: clampStrength(edge.strength) });
    return true;
  };

  // --- Pass 1: blood and marriage -----------------------------------------
  // Kinship already exists upstream; this pass only puts a felt weight and a
  // readable label on it. A minority of kin bonds come out estranged, which is
  // what makes "his own brother won't vouch for him" possible later.
  for (const person of people) {
    const ties = families.get(person.id);
    if (!ties) continue;

    if (ties.spouseId !== undefined && person.id < ties.spouseId) {
      const warm = rng.next() > 0.1;
      add({
        fromId: person.id,
        toId: ties.spouseId,
        type: 'romantic',
        strength: warm ? strengthIn(rng, 55, 95) : strengthIn(rng, -45, -5),
        label: warm ? 'married' : 'a cold marriage',
      });
    }
    for (const childId of [...ties.childIds].sort((a, b) => a - b)) {
      add({
        fromId: person.id,
        toId: childId,
        type: 'family',
        strength: strengthIn(rng, 50, 95),
        label: 'parent and child',
      });
    }
    for (const siblingId of [...ties.siblingIds].sort((a, b) => a - b)) {
      if (siblingId < person.id) continue; // added from the other side
      const estranged = rng.next() < ESTRANGEMENT_CHANCE;
      add({
        fromId: person.id,
        toId: siblingId,
        type: 'family',
        strength: estranged ? strengthIn(rng, -70, -15) : strengthIn(rng, 25, 80),
        label: estranged ? 'estranged sibling' : 'sibling',
      });
    }
  }

  // --- Pass 2: the household ----------------------------------------------
  // Anyone sharing a roof who is NOT already tied by blood is a housemate: a
  // lodger, a servant, an unrelated adult. Usually cordial, sometimes not.
  const byHome = groupBy(people, (p) => p.homePlotId);
  for (const plotId of [...byHome.keys()].sort((a, b) => a - b)) {
    const members = byHome.get(plotId)!;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        if (seen.has(pairKey(a.id, b.id))) continue;
        const friendly = rng.next() > 0.2;
        add({
          fromId: a.id,
          toId: b.id,
          type: 'friend',
          strength: friendly ? strengthIn(rng, 15, 60) : strengthIn(rng, -50, -10),
          label: friendly ? pick(rng, HOUSEMATE_LABELS) : 'an uneasy household',
        });
      }
    }
  }

  // --- Pass 3: work --------------------------------------------------------
  // Two shapes of working tie. Sharing a workplace makes the lower id the
  // proprietor and the rest their staff (a directed `employer` edge). Sharing a
  // TRADE across different workplaces makes competitors.
  //
  // The employer branch is deliberately dormant on today's towns: the roster
  // pass assigns exactly ONE worker per market/workshop plot, so no crew ever
  // forms. It is kept because employment is a real tie the consumers below
  // already read, and it starts producing edges the moment a workplace can
  // staff more than one person (tracked as GG-128).
  const byWork = groupBy(
    people.filter((p) => p.workPlotId !== undefined),
    (p) => p.workPlotId as number,
  );
  for (const workPlotId of [...byWork.keys()].sort((a, b) => a - b)) {
    const crew = byWork.get(workPlotId)!;
    if (crew.length < 2) continue;
    const [boss, ...staff] = crew;
    for (const hand of staff) {
      add({
        fromId: boss.id,
        toId: hand.id,
        type: 'employer',
        strength: strengthIn(rng, 5, 55),
        label: `employs at ${boss.occupation === 'shopkeeper' ? 'the market stall' : 'the workshop'}`,
      });
    }
  }

  const byTrade = groupBy(
    people.filter((p) => p.occupation !== 'resident' && p.workPlotId !== undefined),
    (p) => p.occupation,
  );
  for (const trade of [...byTrade.keys()].sort()) {
    const workers = byTrade.get(trade)!;
    for (let i = 0; i < workers.length; i++) {
      for (let j = i + 1; j < workers.length; j++) {
        const a = workers[i];
        const b = workers[j];
        if (a.workPlotId === b.workPlotId) continue; // same shop: colleagues, not rivals
        if (rng.next() >= TRADE_RIVALRY_CHANCE) continue;
        add({
          fromId: a.id,
          toId: b.id,
          type: 'rival',
          strength: strengthIn(rng, -75, -15),
          label: 'tradesman rivalry',
        });
      }
    }
  }

  // --- Pass 4: chosen ties across the fence --------------------------------
  // Adults on adjacent home plots see each other daily. Most of a town's
  // friend/feud texture comes from here rather than from blood.
  const homePlots = [...byHome.keys()].sort((a, b) => a - b);
  for (let i = 0; i + 1 < homePlots.length; i++) {
    const here = byHome.get(homePlots[i])!.filter(isSocialAdult);
    const next = byHome.get(homePlots[i + 1])!.filter(isSocialAdult);
    for (const a of here) {
      for (const b of next) {
        const roll = rng.next();
        if (roll < NEIGHBOUR_FEUD_CHANCE) {
          add({
            fromId: a.id,
            toId: b.id,
            type: 'rival',
            strength: strengthIn(rng, -60, -10),
            label: pick(rng, FEUD_LABELS),
          });
        } else if (roll < NEIGHBOUR_FEUD_CHANCE + NEIGHBOUR_FRIEND_CHANCE) {
          add({
            fromId: a.id,
            toId: b.id,
            type: 'friend',
            strength: strengthIn(rng, 20, 75),
            label: pick(rng, FRIEND_LABELS),
          });
        }
      }
    }
  }

  return { burgId: roster.burgId, edges, standing: {}, deceased: [] };
}

const isSocialAdult = (p: Occupant): boolean => p.ageBand !== 'child';

function groupBy<K>(people: Occupant[], keyOf: (p: Occupant) => K): Map<K, Occupant[]> {
  const out = new Map<K, Occupant[]>();
  for (const p of people) {
    const list = out.get(keyOf(p));
    if (list) list.push(p);
    else out.set(keyOf(p), [p]);
  }
  return out;
}

// ============================================================================
// Queries
// ============================================================================

/** Every edge touching `occupantId`, in stable order. Direction-agnostic. */
export function edgesFor(web: TownRelationshipWeb, occupantId: number): RelationshipEdge[] {
  return web.edges.filter((e) => e.fromId === occupantId || e.toId === occupantId);
}

/** The other end of an edge, seen from `occupantId`. */
export function otherEnd(edge: RelationshipEdge, occupantId: number): number {
  return edge.fromId === occupantId ? edge.toId : edge.fromId;
}

/** How `occupantId` feels about the player right now (0 when untouched). */
export function standingOf(web: TownRelationshipWeb, occupantId: number): number {
  return web.standing[occupantId] ?? 0;
}

/** One-line description of a tie, resolving ids to names. */
export function describeEdge(edge: RelationshipEdge, nameOf: (id: number) => string): string {
  const tone = edge.strength >= 40 ? 'close' : edge.strength >= 5 ? 'warm' : edge.strength > -5 ? 'cool' : edge.strength > -40 ? 'sour' : 'hostile';
  return `${nameOf(edge.fromId)} → ${nameOf(edge.toId)}: ${edge.type} (${edge.label}), ${tone} ${edge.strength >= 0 ? '+' : ''}${edge.strength}`;
}

// ============================================================================
// Dynamic Updates
// ============================================================================
// The player acts on ONE person; the web decides who else finds out and how
// much they care. Propagation is signed by the edge strength, which is why a
// dead man's friends turn on you while the rival he never forgave warms up.
// ============================================================================

export type PlayerActionKind =
  | 'killed'
  | 'robbed'
  | 'insulted'
  | 'helped'
  | 'saved'
  | 'gifted';

/** Direct standing shift on the person the player actually acted on. */
export const PLAYER_ACTION_IMPACT: Record<PlayerActionKind, number> = {
  killed: -80,
  robbed: -35,
  insulted: -15,
  gifted: 12,
  helped: 20,
  saved: 45,
};

export interface PlayerActionEvent {
  /** Occupant the player acted on. */
  targetId: number;
  kind: PlayerActionKind;
  /** Multiplier on the base impact, for a graze vs a slaughter. Default 1. */
  magnitude?: number;
  /** Hops the news carries. 0 = only the target. Default 2. */
  hops?: number;
}

/** Share of the impact a first-hop witness feels, before edge weighting. */
const HOP_FALLOFF: readonly number[] = [1, 0.6, 0.25];

/**
 * Apply one player action to the web. Pure: returns a NEW web and never mutates
 * the input, so callers can diff before/after or roll it back.
 *
 * A `killed` target is recorded as deceased. Their edges are preserved — the
 * town's memory of who they were to people is exactly what drives the fallout —
 * but they stop acting as a gossip carrier or ally.
 */
export function applyPlayerAction(
  web: TownRelationshipWeb,
  event: PlayerActionEvent,
): TownRelationshipWeb {
  const magnitude = event.magnitude ?? 1;
  const hops = Math.max(0, Math.min(event.hops ?? 2, HOP_FALLOFF.length - 1));
  const base = PLAYER_ACTION_IMPACT[event.kind] * magnitude;

  const standing: Record<number, number> = { ...web.standing };
  const bump = (id: number, delta: number): void => {
    if (delta === 0) return;
    standing[id] = clampStrength((standing[id] ?? 0) + delta);
  };

  bump(event.targetId, base);

  // Breadth-first outward from the target. `reached` keeps the SHORTEST hop
  // count per person so a well-connected neighbour is not hit twice.
  const reached = new Map<number, number>([[event.targetId, 0]]);
  let frontier = [event.targetId];
  for (let hop = 1; hop <= hops; hop++) {
    const nextFrontier: number[] = [];
    for (const id of frontier) {
      for (const edge of edgesFor(web, id)) {
        const neighbor = otherEnd(edge, id);
        if (reached.has(neighbor)) continue;
        reached.set(neighbor, hop);
        nextFrontier.push(neighbor);
        // Signed by the tie: a devoted friend of the victim swings the full
        // hit, an indifferent acquaintance barely notices, and a rival is
        // moved the OPPOSITE way by the same news.
        bump(neighbor, base * (edge.strength / RELATIONSHIP_STRENGTH_MAX) * HOP_FALLOFF[hop]);
      }
    }
    frontier = nextFrontier.sort((a, b) => a - b);
  }

  const deceased =
    event.kind === 'killed' && !web.deceased.includes(event.targetId)
      ? [...web.deceased, event.targetId].sort((a, b) => a - b)
      : web.deceased;

  return { ...web, standing, deceased };
}

/**
 * Shift one existing NPC↔NPC tie, for world events that are not about the
 * player (a betrayal, a marriage, a business ruined). Returns a new web; a
 * missing edge is a no-op so callers need not check first.
 */
export function adjustEdge(
  web: TownRelationshipWeb,
  aId: number,
  bId: number,
  delta: number,
  label?: string,
): TownRelationshipWeb {
  const key = pairKey(aId, bId);
  let changed = false;
  const edges = web.edges.map((edge) => {
    if (pairKey(edge.fromId, edge.toId) !== key) return edge;
    changed = true;
    return { ...edge, strength: clampStrength(edge.strength + delta), label: label ?? edge.label };
  });
  return changed ? { ...web, edges } : web;
}

// ============================================================================
// Consumers: gossip, quests, combat
// ============================================================================

export interface GossipHearer {
  occupantId: number;
  /** Hops from the origin — 1 heard it first-hand, 2 heard it repeated. */
  hops: number;
  /** 0…1. Detail surviving the retelling, weighted by the ties it travelled. */
  fidelity: number;
  /** The tie that carried it to this person, for a "heard from" line. */
  via: RelationshipEdge;
}

/**
 * Who hears a piece of news that starts with `originId`, and how garbled it is
 * by the time it reaches them. News travels along ties people actually use, so
 * `minStrength` gates out the ones too cold to talk over. The dead carry
 * nothing. Returned in a stable order: nearest hop first, then occupant id.
 */
export function gossipSpreadFrom(
  web: TownRelationshipWeb,
  originId: number,
  opts: { hops?: number; minStrength?: number } = {},
): GossipHearer[] {
  const maxHops = opts.hops ?? 2;
  const minStrength = opts.minStrength ?? 10;
  const dead = new Set(web.deceased);
  const heard = new Map<number, GossipHearer>();
  let frontier: Array<{ id: number; fidelity: number }> = [{ id: originId, fidelity: 1 }];

  for (let hop = 1; hop <= maxHops; hop++) {
    const next: Array<{ id: number; fidelity: number }> = [];
    for (const node of frontier) {
      if (dead.has(node.id)) continue;
      for (const edge of edgesFor(web, node.id)) {
        if (edge.strength < minStrength) continue; // too cold to swap news over
        const neighbor = otherEnd(edge, node.id);
        if (neighbor === originId || heard.has(neighbor) || dead.has(neighbor)) continue;
        const fidelity = node.fidelity * (edge.strength / RELATIONSHIP_STRENGTH_MAX);
        heard.set(neighbor, { occupantId: neighbor, hops: hop, fidelity, via: edge });
        next.push({ id: neighbor, fidelity });
      }
    }
    frontier = next.sort((a, b) => a.id - b.id);
  }

  return [...heard.values()].sort((a, b) => a.hops - b.hops || a.occupantId - b.occupantId);
}

export type QuestDisposition = 'eager' | 'willing' | 'reluctant' | 'refuses';

/**
 * Whether this person will put work in the player's hands. Standing alone is
 * not enough: someone whose closest tie you murdered refuses even at neutral
 * standing, because the web remembers what the standing number has forgotten.
 */
export function questOfferDisposition(
  web: TownRelationshipWeb,
  occupantId: number,
): QuestDisposition {
  if (web.deceased.includes(occupantId)) return 'refuses';
  const standing = standingOf(web, occupantId);
  if (grievesForSomeoneYouKilled(web, occupantId)) return 'refuses';
  if (standing >= 40) return 'eager';
  if (standing >= 0) return 'willing';
  if (standing > -35) return 'reluctant';
  return 'refuses';
}

export interface CombatAllyVerdict {
  assists: boolean;
  /** Short reason, suitable to show the player when they are turned down. */
  reason: string;
}

/**
 * Will this townsperson fight beside the player? A rival will not, and neither
 * will someone still grieving a person the player killed, however many favours
 * were done since.
 */
export function willAssistInCombat(
  web: TownRelationshipWeb,
  occupantId: number,
): CombatAllyVerdict {
  if (web.deceased.includes(occupantId)) {
    return { assists: false, reason: 'is dead' };
  }
  if (grievesForSomeoneYouKilled(web, occupantId)) {
    return { assists: false, reason: 'blames you for a death close to them' };
  }
  const standing = standingOf(web, occupantId);
  if (standing < 0) {
    return { assists: false, reason: standing <= -40 ? 'counts you an enemy' : 'wants no part of your trouble' };
  }
  if (standing < 25) {
    return { assists: false, reason: 'has no reason to risk their life for you' };
  }
  return { assists: true, reason: standing >= 60 ? 'would follow you anywhere' : 'owes you enough to stand with you' };
}

/** Threshold above which a surviving tie to a victim is treated as grief. */
const GRIEF_TIE_STRENGTH = 30;

/** True when the player killed someone this person was genuinely close to. */
function grievesForSomeoneYouKilled(web: TownRelationshipWeb, occupantId: number): boolean {
  if (web.deceased.length === 0) return false;
  const dead = new Set(web.deceased);
  return edgesFor(web, occupantId).some(
    (edge) => edge.strength >= GRIEF_TIE_STRENGTH && dead.has(otherEnd(edge, occupantId)),
  );
}
