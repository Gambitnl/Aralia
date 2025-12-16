
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpellGateChecks } from '../useSpellGateChecks';

// Mocks
vi.mock("../../../docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md?raw", () => ({ default: `**Magic Missile**` }));
vi.mock("../../../docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md?raw", () => ({ default: "" }));
const mockFetch = vi.fn();
vi.mock("../../utils/networkUtils", () => ({ fetchWithTimeout: (u: string) => mockFetch(u) }));
vi.mock("../../utils/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.stubGlobal('import.meta', { env: { BASE_URL: '/' } });

// Data
const manifest = { 'magic-missile': { level: 1, path: '/level-1/magic-missile.md' } };
const card = `---
id: magic-missile
tags: [level 1, evocation]
---
# Magic Missile
<div class="spell-card"><div class="spell-card-stats-grid">
<div><span class="spell-card-stat-label">Level</span><span class="spell-card-stat-value">1st</span></div>
<div><span class="spell-card-stat-label">Casting Time</span><span class="spell-card-stat-value">1 Action</span></div>
<div><span class="spell-card-stat-label">Range/Area</span><span class="spell-card-stat-value">120 ft.</span></div>
<div><span class="spell-card-stat-label">Components</span><span class="spell-card-stat-value">V, S</span></div>
<div><span class="spell-card-stat-label">Duration</span><span class="spell-card-stat-value">Instantaneous</span></div>
<div><span class="spell-card-stat-label">School</span><span class="spell-card-stat-value">Evocation</span></div>
<div><span class="spell-card-stat-label">Attack/Save</span><span class="spell-card-stat-value">Ranged</span></div>
<div><span class="spell-card-stat-label">Damage/Effect</span><span class="spell-card-stat-value">Force</span></div>
</div></div>`;
const json = { level: 1, castingTime: { value: 1, unit: 'action' }, range: { distance: 120 }, components: { verbal: true, somatic: true }, duration: { type: 'instantaneous' }, school: 'Evocation', effects: [{ type: 'DAMAGE', damage: { type: 'Force' }, condition: { type: 'hit' } }] };
const entries = [{ id: 'magic-missile', title: 'MM', type: 'spell' as const, tags: [] }];

describe('useSpellGateChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('manifest')) return manifest;
      if (url.includes('.md')) return card;
      if (url.includes('.json')) return json;
      return null;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('identifies valid spells in known gaps list', async () => {
    const { result } = renderHook(() => useSpellGateChecks(entries));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const res = result.current.results['magic-missile'];
    expect(res.status).toBe('gap');
    expect(res.checklist.knownGap).toBe(true);
  });
});
