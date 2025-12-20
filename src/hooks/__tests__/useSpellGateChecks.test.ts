
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
const manifest = { 'magic-missile': { name: 'Magic Missile', level: 1, school: 'Evocation', path: '/data/spells/level-1/magic-missile.json' } };
const spellJson = {
  id: 'magic-missile',
  name: 'Magic Missile',
  aliases: [], // Added
  source: 'PHB', // Added
  level: 1,
  school: 'Evocation',
  ritual: false, // Added
  rarity: 'common', // Added
  attackType: 'ranged', // Added
  legacy: true,
  classes: [],
  castingTime: {
    value: 1,
    unit: 'action',
    combatCost: { type: 'action', condition: '' },
    explorationCost: { value: 0, unit: 'minute' } // Added
  },
  range: { type: 'ranged', distance: 120 },
  components: {
    verbal: true,
    somatic: true,
    material: false,
    materialDescription: '', // Added
    materialCost: 0, // Added
    isConsumed: false // Added
  },
  duration: {
    type: 'instantaneous',
    concentration: false,
    value: 0, // Added
    unit: 'round' // Added
  },
  targeting: {
    type: 'ranged',
    range: 120,
    validTargets: ['creatures'],
    lineOfSight: true,
    maxTargets: 3, // Added
    areaOfEffect: { shape: 'Sphere', size: 0 }, // Added dummy
    filter: {  // Added
      creatureTypes: [],
      excludeCreatureTypes: [],
      sizes: [],
      alignments: [],
      hasCondition: [],
      isNativeToPlane: false
    }
  },
  effects: [{ type: 'UTILITY', trigger: { type: 'immediate' }, condition: { type: 'always' }, utilityType: 'other', description: 'desc' }],
  arbitrationType: 'mechanical', // Added
  aiContext: { prompt: '', playerInputRequired: false }, // Added
  higherLevels: 'one more dart', // Added
  tags: [], // Added
  description: 'desc',
};

describe('useSpellGateChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('spells_manifest.json')) return manifest;
      if (url.includes('magic-missile.json')) return spellJson;
      return null;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('identifies valid spells in known gaps list', async () => {
    const { result } = renderHook(() => useSpellGateChecks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const res = result.current.results['magic-missile'];
    expect(res.status).toBe('gap');
    expect(res.checklist.noKnownGaps).toBe(false);
  });
});
