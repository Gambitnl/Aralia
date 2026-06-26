/**
 * @file VillagerRegistry.tsx — the town's people, grouped by household.
 *
 * A scrollable census of everyone present, clustered by the home they share so
 * families read at a glance. Each villager shows identity (name · age · race ·
 * occupation) and their relational connections — spouse, parents, children,
 * siblings (clickable to jump to that person), plus kin in other towns or "no
 * known family". Selecting a villager pins + highlights them on the map; hovering
 * a row mirrors the map hover. Memoised so it doesn't re-render with the sim clock.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import type { Occupant } from '../../systems/worldforge/roster/types';
import type { FamilyTies } from '../../systems/worldforge/roster/family';

/** Race → dot colour, so a bloodline reads as one hue (a married-in spouse differs). */
const RACE_HEX: Record<string, string> = {
  Human: '#9aa7b5', Elf: '#7ee787', Dwarf: '#f5a742', Halfling: '#f0c040', Gnome: '#d68cff',
  'Half-Elf': '#79c0ff', Greenskins: '#56b870', Goliath: '#b9b9b9', Tiefling: '#e06666',
  Aasimar: '#ffe08a', 'Draconic Kin': '#e0884a', Beastfolk: '#c08040',
};
const raceColor = (race?: string): string => (race && RACE_HEX[race]) || '#8b949e';

export interface VillagerRegistryProps {
  occupants: Occupant[];
  families: Map<number, FamilyTies>;
  selectedId: number | null;
  hoveredId: number | null;
  onSelect: (id: number | null) => void;
  onHover: (id: number | null) => void;
  nameOf: (id: number) => string;
}

const VillagerRegistryImpl: React.FC<VillagerRegistryProps> = ({
  occupants, families, selectedId, hoveredId, onSelect, onHover, nameOf,
}) => {
  // Group by household (home plot) so families sit together, eldest first.
  const households = useMemo(() => {
    const byPlot = new Map<number, Occupant[]>();
    for (const o of occupants) {
      const list = byPlot.get(o.homePlotId);
      if (list) list.push(o); else byPlot.set(o.homePlotId, [o]);
    }
    return [...byPlot.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([plotId, members]) => ({
        plotId,
        members: members.slice().sort((a, b) => (families.get(b.id)?.age ?? 0) - (families.get(a.id)?.age ?? 0)),
      }));
  }, [occupants, families]);

  // Keep the selected villager scrolled into view (e.g. when reached via a kin link).
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  useEffect(() => {
    if (selectedId == null) return;
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const KinLink: React.FC<{ id: number }> = ({ id }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: '#a5b4fc', cursor: 'pointer', font: 'inherit', textDecoration: 'underline dotted' }}
    >
      {nameOf(id)}
    </button>
  );

  const relations = (t: FamilyTies | undefined): React.ReactNode => {
    if (!t) return null;
    const parts: React.ReactNode[] = [];
    if (t.spouseId != null) parts.push(<span key="sp">⚭ <KinLink id={t.spouseId} /></span>);
    if (t.childIds.length) parts.push(<span key="ch">children: {t.childIds.map((id, i) => <React.Fragment key={id}>{i > 0 && ', '}<KinLink id={id} /></React.Fragment>)}</span>);
    if (t.parentIds.length) parts.push(<span key="pa">child of {t.parentIds.map((id, i) => <React.Fragment key={id}>{i > 0 && ' & '}<KinLink id={id} /></React.Fragment>)}</span>);
    if (t.siblingIds.length) parts.push(<span key="si">siblings: {t.siblingIds.map((id, i) => <React.Fragment key={id}>{i > 0 && ', '}<KinLink id={id} /></React.Fragment>)}</span>);
    if (t.distantKin.length) parts.push(<span key="dk" style={{ color: '#94a3b8' }}>kin in {t.distantKin[0].town} (a {t.distantKin[0].relation})</span>);
    if (parts.length === 0 && t.alone) parts.push(<span key="al" style={{ color: '#64748b' }}>no known family</span>);
    return parts.length ? <div style={{ marginTop: 2, fontSize: 11, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{parts}</div> : null;
  };

  return (
    <div
      data-testid="villager-registry"
      style={{ width: 320, flex: '0 0 auto', height: '100%', overflowY: 'auto', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 10, boxSizing: 'border-box' }}
    >
      <div style={{ position: 'sticky', top: 0, background: '#0f172a', paddingBottom: 6, fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
        Villagers <span style={{ color: '#64748b', fontWeight: 400 }}>({occupants.length})</span>
      </div>
      {households.map(({ plotId, members }) => (
        <div key={plotId} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, margin: '6px 0 3px' }}>
            🏠 Household {members.length > 1 ? `· ${members.length}` : ''}
          </div>
          {members.map((o) => {
            const t = families.get(o.id);
            const active = selectedId === o.id || hoveredId === o.id;
            return (
              <div
                key={o.id}
                ref={(el) => { if (el) rowRefs.current.set(o.id, el); else rowRefs.current.delete(o.id); }}
                data-testid="registry-row"
                onClick={() => onSelect(selectedId === o.id ? null : o.id)}
                onMouseEnter={() => onHover(o.id)}
                onMouseLeave={() => onHover(null)}
                style={{
                  padding: '4px 6px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                  background: selectedId === o.id ? 'rgba(109,40,217,0.25)' : active ? 'rgba(148,163,184,0.10)' : 'transparent',
                  border: `1px solid ${selectedId === o.id ? '#6d28d9' : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: raceColor(t?.race), display: 'inline-block', flex: '0 0 auto' }} />
                  <strong style={{ fontSize: 12, color: '#e2e8f0' }}>{o.name}</strong>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {t?.age ?? o.ageBand} · {t?.race ?? '—'} · {o.occupation}
                  </span>
                </div>
                {relations(t)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Memoised: the census only changes with the roster/selection, not the sim clock. */
const VillagerRegistry = React.memo(VillagerRegistryImpl);
export default VillagerRegistry;
