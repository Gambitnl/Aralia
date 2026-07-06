/**
 * LivingWorldPreview (?phase=livingworld) — Plan F: the play-and-eyeball surface
 * (SPEC D12) for the living-world town sim.
 *
 * Generates a demo town, tags its key NPCs (Plan B), seeds the life-event sim
 * (Plan A), advances it N years (Plan C registry), and renders the resulting
 * Town Chronicle + current institution-holders. No playing session required.
 *
 * Headless proof: window.__livingWorldPreview.{ setSeed, setYears, setPopulation,
 * current() } drives it and reads back stats for automated verification.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SeededRandom } from '../../utils/random/seededRandom';
import { makeSeedPath, seedFromPath } from '../../systems/worldforge/seedPath';
import { buildDemoTownPlan } from '../../systems/worldforge/town/demoTownPlan';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { assignFamilies } from '../../systems/worldforge/roster/family';
import { assignKeyNpcs } from '../../systems/worldforge/townsim/keyNpcs';
import { initTownSimState, ageOf } from '../../systems/worldforge/townsim/townSim';
import { advanceTown } from '../../systems/worldforge/townsim/townSimRegistry';
import { summarizeChronicle } from '../../systems/worldforge/townsim/chronicle';
import { DAYS_PER_YEAR } from '../../systems/worldforge/townsim/constants';
import type { InstitutionRole, LivingVillager } from '../../systems/worldforge/townsim/types';

const GIVEN = ['Ada', 'Bryn', 'Cael', 'Dara', 'Edda', 'Finn', 'Gwen', 'Hale', 'Isa', 'Joss', 'Kael', 'Lira', 'Maro', 'Nessa', 'Orin', 'Pell', 'Rhys', 'Sable', 'Tam', 'Vesna'];
const SUR = ['Ash', 'Brook', 'Crane', 'Dale', 'Frost', 'Gale', 'Holt', 'Lark', 'Mire', 'Quill', 'Reed', 'Stone', 'Thorn', 'Vale', 'Wren'];

function pickName(rng: { next(): number }): string {
  return `${GIVEN[Math.floor(rng.next() * GIVEN.length)]} ${SUR[Math.floor(rng.next() * SUR.length)]}`;
}

const ROLE_LABEL: Record<InstitutionRole, string> = {
  lord: 'Lord',
  priest: 'Priest',
  innkeeper: 'Innkeeper',
  tavernkeeper: 'Tavernkeeper',
  marketmaster: 'Marketmaster',
  harbormaster: 'Harbormaster',
  wildcard: 'Notable',
};

const LivingWorldPreview: React.FC = () => {
  const [seed, setSeed] = useState(7777);
  const [years, setYears] = useState(40);
  const [population, setPopulation] = useState(2000);

  const sim = useMemo(() => {
    const demo = buildDemoTownPlan(seed, { burgId: 1, population });
    const roster = generateTownRoster(demo.plan, makeSeedPath(seed, 'burg:1', 's:roster'), {
      nameFor: pickName,
    });
    const families = assignFamilies(roster.occupants, makeSeedPath(seed, 'burg:1', 's:family'));
    const keyRng = new SeededRandom(seedFromPath(makeSeedPath(seed, 'burg:1', 's:keynpc')));
    const keyRoles = assignKeyNpcs(demo.plan, roster, { rng: keyRng });
    let state = initTownSimState(1, roster, families, keyRoles, 0);
    state = advanceTown(state, seed, Math.round(years * DAYS_PER_YEAR));
    return { roster, state };
  }, [seed, years, population]);

  const { roster, state } = sim;

  const stats = useMemo(() => {
    const all = Object.values(state.villagers);
    const living = all.filter((v) => v.diedDay === undefined);
    return {
      started: roster.occupants.length,
      totalEver: all.length,
      living: living.length,
      dead: all.length - living.length,
      births: state.chronicle.events.filter((e) => e.kind === 'birth').length,
      deaths: state.chronicle.events.filter((e) => e.kind === 'death').length,
      marriages: state.chronicle.events.filter((e) => e.kind === 'marriage').length,
      events: state.chronicle.events.length,
      prosperity: Math.round(state.prosperity ?? 50),
      years,
    };
  }, [state, roster, years]);

  // Current institution-holders (roles transfer via succession over time).
  const holders = useMemo(() => {
    return Object.values(state.villagers)
      .filter((v): v is LivingVillager & { role: InstitutionRole } => v.role !== undefined && v.diedDay === undefined)
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [state]);

  const chronicle = useMemo(() => summarizeChronicle(state), [state]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__livingWorldPreview = {
      setSeed,
      setYears,
      setPopulation,
      current: () => ({ seed, ...stats, chronicleLines: chronicle.length, holders: holders.length }),
    };
    return () => { delete (window as unknown as Record<string, unknown>).__livingWorldPreview; };
  }, [seed, stats, chronicle.length, holders.length]);

  return (
    <div style={{ padding: 'clamp(12px, 4vw, 20px)', boxSizing: 'border-box', overflowX: 'hidden', color: '#e5e7eb', background: '#0b0f1a', minHeight: '100vh', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Living-World Town Sim — Preview</h1>
      <p style={{ color: '#9ca3af', marginBottom: 16, fontSize: 13 }}>
        A demo town aged {years} years: deaths, inheritance, role succession, births, coming-of-age.
        (New marriages — and self-sustaining population — arrive with the relationships layer.)
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: 13 }}>Seed{' '}
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: 90, background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: 4, padding: '2px 6px' }} />
        </label>
        <label style={{ fontSize: 13 }}>Population{' '}
          <input type="number" value={population} min={50} step={50} onChange={(e) => setPopulation(Math.max(50, Number(e.target.value) || 50))}
            style={{ width: 90, background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: 4, padding: '2px 6px' }} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: '100%' }}>Years: {years}
          <input type="range" min={0} max={120} value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ width: 'min(220px, 100%)' }} />
        </label>
        <button onClick={() => setSeed((s) => s + 1)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>
          Reroll
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {([
          ['Townsfolk at start', stats.started],
          ['Living now', stats.living],
          ['Died', stats.dead],
          ['Born', stats.births],
          ['Marriages', stats.marriages],
          ['Prosperity', stats.prosperity],
          ['Total ever', stats.totalEver],
          ['Events', stats.events],
        ] as const).map(([label, value]) => (
          <div key={label} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 14px', minWidth: 96 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }} data-testid={`stat-${label}`}>{value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0, maxWidth: '100%' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Institution-holders now</h2>
          {holders.length === 0 && <div style={{ color: '#6b7280', fontSize: 13 }}>None (small town).</div>}
          {holders.map((v) => (
            <div key={v.occupantId} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 6, padding: '6px 10px', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>{ROLE_LABEL[v.role]}</span>{': '}
              {v.name} <span style={{ color: '#9ca3af' }}>· {v.race} · age {ageOf(v, state.lastSimDay)}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: '1 1 480px', minWidth: 0, maxWidth: '100%' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Town Chronicle</h2>
          <div data-testid="chronicle" style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 12, maxHeight: 520, overflowY: 'auto', fontSize: 13, lineHeight: 1.6 }}>
            {chronicle.length === 0 && <div style={{ color: '#6b7280' }}>Nothing happened yet — raise the years.</div>}
            {chronicle.map((line, i) => (
              <div key={i} style={{ paddingBottom: 4, borderBottom: '1px solid #1a2030', marginBottom: 4 }}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivingWorldPreview;
