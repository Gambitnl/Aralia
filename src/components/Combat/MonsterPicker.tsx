import React, { useMemo, useState } from 'react';
import { useBestiary, BestiaryEntry } from '../../hooks/data/useBestiary';
import { registerMonster } from '../../data/adapters/runtimeMonsterRegistry';
import { crToXp } from '../../utils/combat/encounterDifficulty';

export interface PickedMonster {
  name: string;
  quantity: number;
  cr: string;
  crLair?: string;
  xpLair?: number;
  isLair?: boolean;
  description: string;
}

interface MonsterPickerProps {
  onAdd: (monster: PickedMonster) => void;
}

const CR_ORDER: Record<string, number> = {
  '0': 0,
  '1/8': 0.125,
  '1/4': 0.25,
  '1/2': 0.5,
};

function crToNum(cr: string): number {
  return CR_ORDER[cr] ?? parseFloat(cr) ?? 0;
}

const MonsterPicker: React.FC<MonsterPickerProps> = ({ onAdd }) => {
  const { entries, isLoading, error } = useBestiary();
  const [search, setSearch] = useState('');
  const [maxCr, setMaxCr] = useState('30');
  const [quantity, setQuantity] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const max = parseFloat(maxCr) || 30;
    return entries
      .filter((entry) => entry.name.toLowerCase().includes(q) && crToNum(entry.cr) <= max)
      .slice(0, 50); // cap list for performance
  }, [entries, search, maxCr]);

  function handleAdd(entry: BestiaryEntry) {
    // useBestiary now exposes already-ingested MonsterData from the checked-in
    // generated registry. Registering that payload avoids a build-time
    // dependency on ignored vendor JSON while preserving the ingestion pipeline
    // as the place where 5eTools raw data is converted and spell-enriched.
    registerMonster(entry.raw);

    onAdd({
      name: entry.name,
      quantity,
      cr: entry.cr,
      crLair: entry.crLair,
      xpLair: entry.xpLair,
      description: `${entry.type} (CR ${entry.cr})`,
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 italic py-2">Loading bestiary...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400 py-2">Failed to load bestiary: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search monsters..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="flex-1 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-amber-400"
        />
        <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          Max CR
          <input
            type="number"
            min={0}
            max={30}
            value={maxCr}
            onChange={(event) => setMaxCr(event.target.value)}
            className="w-12 bg-gray-700 border border-gray-500 rounded px-1 py-1 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          x
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, parseInt(event.target.value) || 1))}
            className="w-10 bg-gray-700 border border-gray-500 rounded px-1 py-1 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </label>
      </div>

      <div className="overflow-y-auto max-h-48 scrollable-content space-y-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-500 italic">No monsters match.</p>
        )}
        {filtered.map((entry) => (
          <button
            key={`${entry.name}-${entry.source}`}
            onClick={() => handleAdd(entry)}
            className="w-full flex justify-between items-center px-3 py-1.5 rounded bg-gray-700/60 hover:bg-amber-900/40 border border-gray-600 hover:border-amber-500 text-left transition-colors"
          >
            <span className="text-sm text-white font-medium truncate">{entry.name}</span>
            <span className="text-xs text-gray-400 shrink-0 ml-2">
              {entry.type} - CR {entry.cr} - {crToXp(entry.cr).toLocaleString()} XP
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MonsterPicker;
