import { describe, expect, it } from 'vitest';

import { INITIAL_TRADE_ROUTES } from '@/data/tradeRoutes';
import { REGIONAL_ECONOMIES } from '@/data/economy/regions';

// This data-level guard keeps future seed-route edits aligned with the region
// catalog before route scoring or regional modifiers can dereference a missing id.
describe('Trade route seed integrity', () => {
  it('validates every seed route origin and destination against REGIONAL_ECONOMIES', () => {
    const regionIds = new Set(Object.keys(REGIONAL_ECONOMIES));
    const invalidRefs = INITIAL_TRADE_ROUTES.flatMap((route) => [
      ...(regionIds.has(route.originId) ? [] : [`${route.id}: originId=${route.originId}`]),
      ...(regionIds.has(route.destinationId)
        ? []
        : [`${route.id}: destinationId=${route.destinationId}`])
    ]);

    expect(invalidRefs).toHaveLength(0);
  });
});
