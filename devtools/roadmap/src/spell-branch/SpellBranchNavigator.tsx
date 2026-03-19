// devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx
import React, { useState, useEffect } from 'react';
import type {
  SpellCanonicalProfile,
  AxisChoice,
  AxisState,
  AxisId,
} from './types';
import { computeAxisEngine } from './axis-engine';
import { VSM_COMBINATION_LABELS } from './vsm-tree';

const BINARY_AXES = new Set<AxisId>([
  'concentration',
  'ritual',
  'aiArbitration',
]);

// Level display: 0 = Cantrip, 1–9 = Level N
function levelLabel(value: string): string {
  return value === '0' ? 'Cantrip' : `Level ${value}`;
}

function axisValueLabel(axisId: AxisId, value: string): string {
  if (axisId === 'level') return levelLabel(value);
  if (axisId === 'requirements') {
    return VSM_COMBINATION_LABELS[value as keyof typeof VSM_COMBINATION_LABELS] ?? value;
  }
  return value;
}

export function SpellBranchNavigator() {
  const [profiles, setProfiles] = useState<SpellCanonicalProfile[]>([]);
  const [choices, setChoices] = useState<AxisChoice[]>([]);
  const [showSpells, setShowSpells] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/Aralia/api/roadmap/spell-profiles')
      .then((r) => r.json())
      .then((data: SpellCanonicalProfile[]) => {
        setProfiles(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading spell profiles…</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>Error: {error}</div>;

  const { filteredSpells, availableAxes, spellCount } =
    computeAxisEngine(profiles, choices);

  function choose(axisId: AxisId, value: string) {
    setChoices((prev) => [...prev, { axisId, value }]);
    setShowSpells(false);
  }

  function reset() {
    setChoices([]);
    setShowSpells(false);
  }

  function removeChoice(index: number) {
    setChoices((prev) => prev.filter((_, i) => i !== index));
    setShowSpells(false);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginTop: 0 }}>Spell Branch</h2>

      {/* Breadcrumb of choices made */}
      {choices.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {choices
            .map((c, i) => ({ c, i }))
            .filter(({ c }) => c.value !== 'either')
            .map(({ c, i }) => (
            <button
              key={i}
              onClick={() => removeChoice(i)}
              style={{
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 13,
              }}
              title="Click to remove this filter"
            >
              {c.axisId}: {axisValueLabel(c.axisId, c.value)} ✕
            </button>
          ))}
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Reset all
          </button>
        </div>
      )}

      {/* Spell count + show spells trigger */}
      {choices.length > 0 && (
        <div style={{ marginBottom: 16, color: '#94a3b8', fontSize: 14 }}>
          {spellCount} spell{spellCount !== 1 ? 's' : ''} match
          {!showSpells && (
            <button
              onClick={() => setShowSpells(true)}
              style={{
                marginLeft: 12,
                background: '#1e40af',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '3px 10px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Show spells
            </button>
          )}
        </div>
      )}

      {/* Spell leaves */}
      {showSpells && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {[...filteredSpells]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: s.legacy ? '#1c1917' : '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 13,
                    color: s.legacy ? '#78716c' : '#e2e8f0',
                  }}
                  title={`Level ${s.level} ${s.school}`}
                >
                  {s.name}
                  {s.legacy && (
                    <span style={{ marginLeft: 6, color: '#78716c', fontSize: 11 }}>
                      legacy
                    </span>
                  )}
                </div>
              ))}
          </div>
          <button
            onClick={() => setShowSpells(false)}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Hide spells
          </button>
        </div>
      )}

      {/* Available axes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {availableAxes.map((axis) => (
          <AxisPanel
            key={axis.axisId}
            axis={axis}
            isBinary={BINARY_AXES.has(axis.axisId)}
            onChoose={(value) => choose(axis.axisId, value)}
          />
        ))}
      </div>

      {availableAxes.length === 0 && !showSpells && choices.length > 0 && (
        <div style={{ color: '#64748b', fontSize: 14 }}>
          All axes chosen.{' '}
          <button
            onClick={() => setShowSpells(true)}
            style={{
              background: '#1e40af',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Show {spellCount} spell{spellCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function AxisPanel({
  axis,
  isBinary,
  onChoose,
}: {
  axis: AxisState;
  isBinary: boolean;
  onChoose: (value: string) => void;
}) {
  // Binary axes: show count split in label, three buttons
  if (isBinary) {
    const yes = axis.values.find((v) => v.value === 'yes')!;
    const no = axis.values.find((v) => v.value === 'no')!;
    return (
      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
          {axis.label}{' '}
          <span style={{ color: '#475569' }}>
            ({yes.count} / {no.count})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {axis.values.map((v) => (
            <button
              key={v.value}
              onClick={() => onChoose(v.value)}
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {v.value === 'yes' ? 'Yes' : v.value === 'no' ? 'No' : 'Either'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Multi-value axes
  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
        {axis.label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {axis.values.map((v) => (
          <button
            key={v.value}
            onClick={() => onChoose(v.value)}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 4,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {axisValueLabel(axis.axisId, v.value)}
            <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11 }}>
              {v.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
