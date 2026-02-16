/**
 * @file WeaponMasterySelection.tsx
 * A component for selecting weapon masteries during character creation.
 * Allows users to choose by mastery property or by weapon type.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Class as CharClass, Item } from '../../types';
import { WEAPONS_DATA, MASTERY_DATA } from '../../constants';
import { CreationStepLayout } from './ui/CreationStepLayout';

interface WeaponMasterySelectionProps {
  charClass: CharClass;
  onMasteriesSelect: (weaponIds: string[]) => void;
  onBack: () => void;
}

type ViewMode = 'byWeapon' | 'byMastery' | 'byHandling' | 'byType';

const WeaponMasteryInfoPanel: React.FC<{
  activeInfo: { type: 'weapon' | 'mastery'; id: string } | null;
}> = ({ activeInfo }) => {
  if (!activeInfo) {
    return <div className="p-4 text-gray-500 italic text-center">Hover over an item for details.</div>;
  }
  if (activeInfo.type === 'weapon') {
    const weapon = WEAPONS_DATA[activeInfo.id];
    if (!weapon) return null;
    const mastery = weapon.mastery ? MASTERY_DATA[weapon.mastery] : null;
    return (
      <div className="p-4 space-y-3">
        <h4 className="text-xl font-bold text-amber-400 font-cinzel border-b border-gray-700 pb-2">{weapon.name}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-400 uppercase text-[10px] font-bold">Damage</div>
          <div className="text-sky-300 font-semibold">{weapon.damageDice} {weapon.damageType}</div>
          <div className="text-gray-400 uppercase text-[10px] font-bold">Properties</div>
          <div className="text-gray-300">{weapon.properties?.join(', ') || 'None'}</div>
        </div>
        {mastery && (
          <div className="mt-4 p-3 bg-sky-900/20 border border-sky-800/50 rounded-lg">
            <h5 className="font-bold text-sky-300 text-sm uppercase tracking-wider mb-1">Mastery: {mastery.name}</h5>
            <p className="text-xs text-sky-200/70 leading-relaxed">{mastery.description}</p>
          </div>
        )}
      </div>
    );
  }
  if (activeInfo.type === 'mastery') {
    const mastery = MASTERY_DATA[activeInfo.id];
    if (!mastery) return null;
    return (
      <div className="p-4 space-y-3">
        <h4 className="text-xl font-bold text-amber-400 font-cinzel border-b border-gray-700 pb-2">{mastery.name}</h4>
        <p className="text-sm text-gray-300 leading-relaxed">{mastery.description}</p>
      </div>
    );
  }
  return null;
};

const WeaponMasterySelection: React.FC<WeaponMasterySelectionProps> = ({
  charClass,
  onMasteriesSelect,
  onBack,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('byWeapon');
  const [selectedWeaponIds, setSelectedWeaponIds] = useState<Set<string>>(new Set());
  const [activeInfo, setActiveInfo] = useState<{ type: 'weapon' | 'mastery'; id: string } | null>(null);

  const selectionLimit = charClass.weaponMasterySlots || 0;

  const proficientWeapons = useMemo(() => {
    const isSimpleProficient = charClass.weaponProficiencies.includes('Simple weapons');
    const isMartialProficient = charClass.weaponProficiencies.includes('Martial weapons');
    return Object.values(WEAPONS_DATA).filter(w => 
      (isSimpleProficient && !w.isMartial) ||
      (isMartialProficient && w.isMartial) ||
      charClass.weaponProficiencies.some(p => w.name.toLowerCase().includes(p.toLowerCase().replace(/s$/, '')))
    );
  }, [charClass.weaponProficiencies]);
  
  const weaponsByMastery = useMemo(() => {
    return proficientWeapons.reduce((acc, weapon) => {
      const mastery = weapon.mastery;
      if (mastery) {
        if (!acc[mastery]) {
          acc[mastery] = [];
        }
        acc[mastery].push(weapon);
      }
      return acc;
    }, {} as Record<string, typeof proficientWeapons>);
  }, [proficientWeapons]);

  const weaponsByHandling = useMemo(() => {
    const handlingMap: Record<string, typeof proficientWeapons> = {
      'One-Handed': [],
      'Two-Handed': [],
      'Versatile': [],
    };

    proficientWeapons.forEach(weapon => {
      if (weapon.properties?.includes('Two-Handed')) {
        handlingMap['Two-Handed'].push(weapon);
      } else if (weapon.properties?.includes('Versatile')) {
        handlingMap['Versatile'].push(weapon);
      } else {
        handlingMap['One-Handed'].push(weapon);
      }
    });
    return handlingMap;
  }, [proficientWeapons]);

  const weaponsByType = useMemo(() => {
    const typeMap: Record<string, typeof proficientWeapons> = {
      'Melee': [],
      'Ranged': [],
    };

    proficientWeapons.forEach(weapon => {
      if (weapon.category?.includes('Melee')) {
        typeMap['Melee'].push(weapon);
      } else if (weapon.category?.includes('Ranged')) {
        typeMap['Ranged'].push(weapon);
      }
    });
    return typeMap;
  }, [proficientWeapons]);


  const handleWeaponSelect = useCallback((weaponId: string) => {
    setSelectedWeaponIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weaponId)) {
        newSet.delete(weaponId);
      } else if (newSet.size < selectionLimit) {
        newSet.add(weaponId);
      }
      return newSet;
    });
  }, [selectionLimit]);

  const handleSubmit = () => {
    if (selectedWeaponIds.size === selectionLimit) {
      onMasteriesSelect(Array.from(selectedWeaponIds));
    }
  };

  const renderWeaponList = (weapons: Item[]) => (
    weapons.map(weapon => {
      const isSelected = selectedWeaponIds.has(weapon.id);
      const isDisabled = !isSelected && selectedWeaponIds.size >= selectionLimit;
      return (
        <li key={weapon.id}>
          <label
            onMouseEnter={() => setActiveInfo({ type: 'weapon', id: weapon.id })}
            className={`flex items-center p-2 rounded-lg transition-all border border-transparent ${
              isSelected 
                ? 'bg-sky-900/40 border-sky-500/50 text-sky-200 cursor-pointer font-semibold shadow-sm' 
                : (isDisabled ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed opacity-50' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white cursor-pointer')
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isDisabled}
              onChange={() => handleWeaponSelect(weapon.id)}
              className="mr-3 h-4 w-4 rounded text-sky-500 bg-gray-950 border-gray-700 focus:ring-sky-500 focus:ring-offset-gray-900"
            />
            <span className="flex-1">{weapon.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isSelected ? 'bg-sky-500/20 border-sky-400/30 text-sky-300' : 'bg-gray-700/50 border-gray-600 text-gray-500'}`}>
              {weapon.mastery}
            </span>
          </label>
        </li>
      );
    })
  );

  return (
    <CreationStepLayout
      title="Weapon Masteries"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={selectedWeaponIds.size === selectionLimit}
      nextLabel="Confirm Masteries"
      bodyScrollable={false}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 bg-gray-900/40 border border-gray-700 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
             <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">
              Select <span className="text-amber-400">{selectionLimit}</span> Masteries
            </p>
            <div className="text-xs font-mono">
              <span className={selectedWeaponIds.size === selectionLimit ? 'text-green-400' : 'text-sky-400'}>
                {selectedWeaponIds.size}
              </span>
              <span className="text-gray-600"> / {selectionLimit}</span>
            </div>
          </div>

          <div className="flex justify-center flex-wrap gap-1.5">
            {[
              { id: 'byWeapon', label: 'By Weapon' },
              { id: 'byMastery', label: 'By Mastery' },
              { id: 'byHandling', label: 'By Handling' },
              { id: 'byType', label: 'By Type' }
            ].map(mode => (
              <button 
                key={mode.id}
                onClick={() => setViewMode(mode.id as ViewMode)} 
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all border ${
                  viewMode === mode.id 
                    ? 'bg-amber-900/40 border-amber-600 text-amber-300 shadow-sm' 
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Left Panel: Selection */}
          <div className="bg-gray-900/30 border border-gray-700/50 rounded-xl overflow-y-auto scrollable-content p-2">
            {viewMode === 'byWeapon' && (
              <ul className="space-y-1">{renderWeaponList(proficientWeapons.sort((a,b) => a.name.localeCompare(b.name)))}</ul>
            )}
            {viewMode === 'byMastery' && (
              <div className="space-y-4">
                {Object.keys(weaponsByMastery).sort().map(masteryKey => (
                  <div key={masteryKey} className="space-y-1">
                    <h4 
                      onMouseEnter={() => setActiveInfo({ type: 'mastery', id: masteryKey })}
                      className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1.5 px-2 flex items-center gap-2"
                    >
                       <span className="w-1.5 h-1.5 rounded-full bg-sky-500/50" />
                       {masteryKey}
                    </h4>
                    <ul className="space-y-1">{renderWeaponList(weaponsByMastery[masteryKey].sort((a,b) => a.name.localeCompare(b.name)))}</ul>
                  </div>
                ))}
              </div>
            )}
             {viewMode === 'byHandling' && (
              <div className="space-y-4">
                {Object.keys(weaponsByHandling).map(handlingKey => (
                  <div key={handlingKey} className="space-y-1">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1.5 px-2 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                       {handlingKey}
                    </h4>
                    <ul className="space-y-1">{renderWeaponList(weaponsByHandling[handlingKey].sort((a,b) => a.name.localeCompare(b.name)))}</ul>
                  </div>
                ))}
              </div>
            )}
             {viewMode === 'byType' && (
              <div className="space-y-4">
                {Object.keys(weaponsByType).map(typeKey => (
                  <div key={typeKey} className="space-y-1">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1.5 px-2 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                       {typeKey}
                    </h4>
                    <ul className="space-y-1">{renderWeaponList(weaponsByType[typeKey].sort((a,b) => a.name.localeCompare(b.name)))}</ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Right Panel: Info */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl overflow-y-auto">
            <WeaponMasteryInfoPanel activeInfo={activeInfo} />
          </div>
        </div>
      </div>
    </CreationStepLayout>
  );
};

export default WeaponMasterySelection;
