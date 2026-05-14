import React, { useState, useMemo } from 'react';
import { useBestiary, BestiaryEntry } from '../../hooks/data/useBestiary';
import { convert5eToolsMonster } from '../../data/adapters/5eTools/index';
import { registerMonster } from '../../data/adapters/runtimeMonsterRegistry';
import { crToXp } from '../../utils/combat/encounterDifficulty';
import { useSpellRegistry } from '../../hooks/data/useSpellRegistry';
import { strip5eToolsMarkup } from '../../data/adapters/5eTools/shared';

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
  '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
};
function crToNum(cr: string): number {
  return CR_ORDER[cr] ?? parseFloat(cr) ?? 0;
}

const MonsterPicker: React.FC<MonsterPickerProps> = ({ onAdd }) => {
  const { entries, isLoading, error } = useBestiary();
  const { lookup } = useSpellRegistry();
  const [search, setSearch] = useState('');
  const [maxCr, setMaxCr] = useState('30');
  const [quantity, setQuantity] = useState(1);
  const [isEnriching, setIsEnriching] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const max = parseFloat(maxCr) || 30;
    return entries
      .filter(e => e.name.toLowerCase().includes(q) && crToNum(e.cr) <= max)
      .slice(0, 50); // cap list for performance
  }, [entries, search, maxCr]);

  async function handleAdd(entry: BestiaryEntry) {
    setIsEnriching(true);
    
    // Extract spell names from the raw 5etools block
    const spellRefs = new Set<string>();
    const sc = entry.raw.spellcasting || [];
    sc.forEach((block: any) => {
      (block.will || []).forEach((s: string) => spellRefs.add(strip5eToolsMarkup(s)));
      Object.values(block.daily || {}).forEach((list: any) => 
        (list as string[]).forEach(s => spellRefs.add(strip5eToolsMarkup(s)))
      );
      Object.values(block.spells || {}).forEach((lvl: any) => 
        (lvl.spells || []).forEach((s: string) => spellRefs.add(strip5eToolsMarkup(s)))
      );
    });

    // Fetch spell data for all references
    const spellMap = new Map();
    if (spellRefs.size > 0) {
      const results = await Promise.all(
        Array.from(spellRefs).map(async name => ({ name, data: await lookup(name) }))
      );
      results.forEach(r => { if (r.data) spellMap.set(r.name.toLowerCase(), r.data); });
    }

    const data = convert5eToolsMonster(entry.raw, (name) => spellMap.get(name.toLowerCase()));
    registerMonster(data);
    setIsEnriching(false);

    onAdd({ 
      name: entry.name, 
      quantity, 
      cr: entry.cr, 
      crLair: entry.crLair,
      xpLair: entry.xpLair,
      description: `${entry.type} (CR ${entry.cr})` 
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 italic py-2">Loading bestiary…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400 py-2">Failed to load bestiary: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {isEnriching && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-lg backdrop-blur-[1px]">
          <div className="bg-gray-800 px-4 py-2 rounded border border-amber-500/50 shadow-xl flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-amber-100 font-medium">Enriching spell data…</span>
          </div>
        </div>
      )}
      <div className="flex gap-2">

        <input
          type="text"
          placeholder="Search monsters…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-amber-400"
        />
        <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          Max CR
          <input
            type="number"
            min={0}
            max={30}
            value={maxCr}
            onChange={e => setMaxCr(e.target.value)}
            className="w-12 bg-gray-700 border border-gray-500 rounded px-1 py-1 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          ×
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-10 bg-gray-700 border border-gray-500 rounded px-1 py-1 text-sm text-white focus:outline-none focus:border-amber-400"
          />
        </label>
      </div>

      <div className="overflow-y-auto max-h-48 scrollable-content space-y-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-500 italic">No monsters match.</p>
        )}
        {filtered.map(entry => (
          <button
            key={`${entry.name}-${entry.source}`}
            onClick={() => handleAdd(entry)}
            className="w-full flex justify-between items-center px-3 py-1.5 rounded bg-gray-700/60 hover:bg-amber-900/40 border border-gray-600 hover:border-amber-500 text-left transition-colors"
          >
            <span className="text-sm text-white font-medium truncate">{entry.name}</span>
            <span className="text-xs text-gray-400 shrink-0 ml-2">
              {entry.type} · CR {entry.cr} · {crToXp(entry.cr).toLocaleString()} XP
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MonsterPicker;
