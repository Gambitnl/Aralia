import {
  buildSpellFieldInventory,
  createSpellFieldInventorySummary,
  querySpellFieldInventory,
  type SpellFieldInventory,
} from '../../spellFieldInventory';
import type { DevHubRouteContext } from './routeContext';

let spellFieldInventoryCache: SpellFieldInventory | null = null;
let spellFieldInventoryLoadedAt = 0;

const getSpellFieldInventory = (forceRefresh = false): SpellFieldInventory => {
  const now = Date.now();
  const cacheIsFresh = spellFieldInventoryCache && (now - spellFieldInventoryLoadedAt) < 15_000;
  if (!forceRefresh && cacheIsFresh) {
    return spellFieldInventoryCache;
  }

  spellFieldInventoryCache = buildSpellFieldInventory();
  spellFieldInventoryLoadedAt = now;
  return spellFieldInventoryCache;
};

export async function handleSpellRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { json, parsedUrl, urlPath } = ctx;

  if (urlPath === '/api/spells/field-inventory/summary') {
    try {
      const forceRefresh = parsedUrl.searchParams.get('refresh') === '1';
      const inventory = getSpellFieldInventory(forceRefresh);
      const summary = createSpellFieldInventorySummary(inventory);
      json(summary);
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  if (urlPath === '/api/spells/field-inventory/query') {
    try {
      const forceRefresh = parsedUrl.searchParams.get('refresh') === '1';
      const inventory = getSpellFieldInventory(forceRefresh);
      const levelParam = parsedUrl.searchParams.get('level');
      const level = levelParam !== null && levelParam !== '' ? Number(levelParam) : undefined;
      const query = querySpellFieldInventory(inventory, {
        fieldPath: parsedUrl.searchParams.get('fieldPath') ?? '',
        value: parsedUrl.searchParams.get('value') ?? '',
        level: Number.isFinite(level as number) ? level : undefined,
        includeFreeText: parsedUrl.searchParams.get('includeFreeText') === '1',
        limit: Number(parsedUrl.searchParams.get('limit') ?? 200),
      });
      json(query);
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  return false;
}
