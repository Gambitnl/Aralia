/**
 * @file manifests.ts — the living overlay's owned-contents layer.
 *
 * For every container furnishing in a {@link BlueprintPlan} (chest, shelf,
 * barrel, crate, strongbox), roll a small manifest of real registry items from
 * a pool chosen by (room purpose, container kind, the household's trade, its
 * wealth). Every container is OWNED by the household (`ownerHomeId = brief.homeId`)
 * so taking an item can later be flagged stolen (see Item.stolenFrom).
 *
 * Determinism: each container rolls from its OWN seed stream
 * `manifest:<level>:<furnishingIndex>` off the building's seed path, so adding
 * or removing one container never re-rolls its neighbors.
 *
 * Pure data — no three.js. Every itemId a manifest emits resolves in ALL_ITEMS
 * (test-enforced across 25 seeds).
 */
import type { BlueprintFurnishing, BlueprintPlan, HouseholdBrief, RoomPurpose } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { SeededRandom } from '../../../utils/random/seededRandom';

export interface ManifestEntry { itemId: string; qty: number; }

export interface ContainerManifest {
  level: number;
  furnishingIndex: number;
  kind: string;
  ownerHomeId: string;
  entries: ManifestEntry[];
}

/** Furnishing kinds that hold owned goods. */
export const CONTAINER_KINDS: ReadonlySet<string> = new Set([
  'chest', 'shelf', 'barrel', 'crate', 'strongbox',
]);

/** Room purposes whose containers hold food/drink provisions. */
const PROVISION_ROOMS = new Set<RoomPurpose>([
  'kitchen', 'pantry', 'cellar', 'storage', 'stockroom', 'brewhouse',
]);
/** Room purposes whose chests hold clothing/domestic goods. */
const BEDROOM_ROOMS = new Set<RoomPurpose>([
  'bedroom', 'guest-room', 'private-room', 'solar', 'servant-room',
]);
/** Trade room purposes — containers hold the household's trade goods. */
const TRADE_ROOMS = new Set<RoomPurpose>([
  'forge', 'workshop', 'shopfront', 'counting-room',
]);

const PROVISIONS_POOL = ['sack_of_flour', 'wheel_of_cheese', 'salted_pork', 'ale_jug', 'rations', 'clay_pot'];
const DOMESTIC_POOL = ['linen_shirt', 'wool_blanket', 'sewing_kit', 'tallow_candles'];
const DEFAULT_POOL = ['tallow_candles', 'clay_pot'];

/** Trade-goods pool by the head's trade noun (brief.trade). */
function tradePool(trade: string): string[] {
  const t = trade.toLowerCase();
  if (t.includes('smith')) return ['smiths_hammer', 'iron_bar'];
  if (t.includes('merchant') || t.includes('shopkeeper') || t.includes('trades')) {
    return ['ledger_book', 'gold_piece'];
  }
  return ['tallow_candles', 'clay_pot'];
}

/** Draw n distinct-ish items from a pool (repeats allowed only when n > pool). */
function drawFromPool(rng: SeededRandom, pool: string[], n: number): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (let i = 0; i < n; i++) {
    const itemId = pool[rng.nextInt(0, pool.length)];
    const qty = 1 + rng.nextInt(0, 3); // 1–3
    entries.push({ itemId, qty });
  }
  return entries;
}

/**
 * Roll the entries for one container from the (room purpose, kind, trade,
 * wealth) table. Always returns ≥ 1 entry.
 */
function rollEntries(
  rng: SeededRandom,
  purpose: RoomPurpose,
  kind: string,
  brief: HouseholdBrief,
): ManifestEntry[] {
  const n = rng.nextInt(2, 5); // 2–4 entries

  // The counting-room strongbox is coin-heavy regardless of the pools above.
  if (kind === 'strongbox' || purpose === 'counting-room') {
    const entries: ManifestEntry[] = [{ itemId: 'silver_piece', qty: 1 + rng.nextInt(0, 20) }];
    if (brief.wealth === 'wealthy') entries.push({ itemId: 'gold_piece', qty: 1 + rng.nextInt(0, 10) });
    entries.push(...drawFromPool(rng, ['ledger_book', 'gold_piece', 'silver_piece'], Math.max(1, n - entries.length)));
    return entries;
  }

  if (TRADE_ROOMS.has(purpose)) {
    return drawFromPool(rng, tradePool(brief.trade), n);
  }

  if (PROVISION_ROOMS.has(purpose)) {
    return drawFromPool(rng, PROVISIONS_POOL, n);
  }

  if (BEDROOM_ROOMS.has(purpose)) {
    const entries = drawFromPool(rng, DOMESTIC_POOL, Math.max(1, n - 1));
    // A little coin lives in the bedroom chest; wealthy homes add gold.
    entries.push({ itemId: 'silver_piece', qty: 1 + rng.nextInt(0, 6) });
    if (brief.wealth === 'wealthy') entries.push({ itemId: 'gold_piece', qty: 1 + rng.nextInt(0, 4) });
    return entries;
  }

  return drawFromPool(rng, DEFAULT_POOL, n);
}

/**
 * Build an owned manifest for every container furnishing in the plan. Order is
 * floor order, then furnishing order within each floor.
 */
export function containerManifests(
  plan: BlueprintPlan,
  brief: HouseholdBrief,
  path: SeedPath,
): ContainerManifest[] {
  const out: ContainerManifest[] = [];
  for (const floor of plan.floors) {
    // Room purpose lookup by id for this floor.
    const purposeByRoom = new Map<number, RoomPurpose>();
    for (const room of floor.rooms) purposeByRoom.set(room.id, room.purpose);

    floor.furnishings.forEach((fu: BlueprintFurnishing, furnishingIndex: number) => {
      if (!CONTAINER_KINDS.has(fu.kind)) return;
      const purpose = purposeByRoom.get(fu.roomId) ?? 'storage';
      const rng = rngFromPath(streamPath(path, `manifest:${floor.level}:${furnishingIndex}`));
      out.push({
        level: floor.level,
        furnishingIndex,
        kind: fu.kind,
        ownerHomeId: brief.homeId,
        entries: rollEntries(rng, purpose, fu.kind, brief),
      });
    });
  }
  return out;
}
