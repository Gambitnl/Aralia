/**
 * @file WeaponMasterySelection.tsx
 * A component for selecting weapon masteries during character creation.
 * Allows users to choose by mastery property or by weapon type.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { Class as CharClass, Item } from '../../types';
import { WEAPONS_DATA, MASTERY_DATA } from '../../constants';
import Tooltip from '../Tooltip';

interface WeaponMasterySelectionProps {
  charClass: CharClass;
  onMasteriesSelect: (weaponIds: string[]) => void;
  onBack: () => void;
}

type ViewMode = 'byWeapon' | 'byMastery' | 'byHandling' | 'byType';

const containerMotion: MotionProps = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
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

  const InfoPanel = () => {
    if (!activeInfo) {
      return <div className="p-4 text-gray-400 italic">Hover over an item for details.</div>;
    }
    if (activeInfo.type === 'weapon') {
      const weapon = WEAPONS_DATA[activeInfo.id];
      if (!weapon) return null;
      const mastery = weapon.mastery ? MASTERY_DATA[weapon.mastery] : null;
      return (
        <div className="p-4 space-y-2">
          <h4 className="text-lg font-bold text-amber-300">{weapon.name}</h4>
          <p className="text-sm text-gray-300">Damage: {weapon.damageDice} {weapon.damageType}</p>
          <p className="text-sm text-gray-300">Properties: {weapon.properties?.join(', ') || 'None'}</p>
          {mastery && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <h5 className="font-semibold text-sky-300">Mastery: {mastery.name}</h5>
              <p className="text-xs text-gray-400">{mastery.description}</p>
            </div>
          )}
        </div>
      );
    }
    if (activeInfo.type === 'mastery') {
      const mastery = MASTERY_DATA[activeInfo.id];
      if (!mastery) return null;
      return (
        <div className="p-4 space-y-2">
          <h4 className="text-lg font-bold text-amber-300">{mastery.name}</h4>
          <p className="text-sm text-gray-300">{mastery.description}</p>
        </div>
      );
    }
    return null;
  };

  const renderWeaponList = (weapons: Item[]) => (
    weapons.map(weapon => {
      const isSelected = selectedWeaponIds.has(weapon.id);
      const isDisabled = !isSelected && selectedWeaponIds.size >= selectionLimit;
      return (
        <li key={weapon.id}>
          <label 
            onMouseEnter={() => setActiveInfo({ type: 'weapon', id: weapon.id })}
            className={`flex items-center p-2 rounded-md transition-colors ${
              isSelected ? 'bg-sky-600 cursor-pointer' : (isDisabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 cursor-pointer')
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isDisabled}
              onChange={() => handleWeaponSelect(weapon.id)}
              className="mr-3 h-4 w-4 rounded text-sky-500 bg-gray-900 border-gray-600 focus:ring-sky-500"
            />
            <span>{weapon.name} <span className="text-xs text-sky-400">({weapon.mastery})</span></span>
          </label>
        </li>
      );
    })
  );

  return (
    <motion.div
      key="weaponMasterySelection"
      {...containerMotion}
    >
      <h2 className="text-2xl text-sky-300 mb-2 text-center">Select Weapon Masteries</h2>
      <p className="text-sm text-gray-400 mb-4 text-center">As a {charClass.name}, you can master {selectionLimit} types of weapons.</p>

      <div className="bg-gray-900/50 p-2 rounded-lg flex justify-center flex-wrap gap-2 mb-4">
        <button onClick={() => setViewMode('byWeapon')} className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'byWeapon' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300'}`}>By Weapon</button>
        <button onClick={() => setViewMode('byMastery')} className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'byMastery' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300'}`}>By Mastery</button>
        <button onClick={() => setViewMode('byHandling')} className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'byHandling' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300'}`}>By Handling</button>
        <button onClick={() => setViewMode('byType')} className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'byType' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300'}`}>By Type</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px]">
        {/* Left Panel: Selection */}
        <div className="bg-gray-900/50 p-3 rounded-lg overflow-y-auto scrollable-content">
          {viewMode === 'byWeapon' && (
            <ul className="space-y-1">{renderWeaponList(proficientWeapons.sort((a,b) => a.name.localeCompare(b.name)))}</ul>
          )}
          {viewMode === 'byMastery' && (
            <div className="space-y-3">
              {Object.keys(weaponsByMastery).sort().map(masteryKey => (
                <details key={masteryKey} open className="group">
                  <summary 
                    onMouseEnter={() => setActiveInfo({ type: 'mastery', id: masteryKey })}
                    className="text-md font-semibold text-amber-400 mb-1 pl-1 cursor-pointer list-none flex items-center gap-2"
                  >
                     <span className="transform transition-transform duration-150 group-open:rotate-90">▶</span>
                     {masteryKey}
                  </summary>
                  <ul className="space-y-1 pl-4 mt-1 border-l-2 border-gray-700">{renderWeaponList(weaponsByMastery[masteryKey].sort((a,b) => a.name.localeCompare(b.name)))}</ul>
                </details>
              ))}
            </div>
          )}
           {viewMode === 'byHandling' && (
            <div className="space-y-3">
              {Object.keys(weaponsByHandling).map(handlingKey => (
                <details key={handlingKey} open className="group">
                  <summary className="text-md font-semibold text-amber-400 mb-1 pl-1 cursor-pointer list-none flex items-center gap-2">
                     <span className="transform transition-transform duration-150 group-open:rotate-90">▶</span>
                     {handlingKey}
                  </summary>
                  <ul className="space-y-1 pl-4 mt-1 border-l-2 border-gray-700">{renderWeaponList(weaponsByHandling[handlingKey].sort((a,b) => a.name.localeCompare(b.name)))}</ul>
                </details>
              ))}
            </div>
          )}
           {viewMode === 'byType' && (
            <div className="space-y-3">
              {Object.keys(weaponsByType).map(typeKey => (
                <details key={typeKey} open className="group">
                  <summary className="text-md font-semibold text-amber-400 mb-1 pl-1 cursor-pointer list-none flex items-center gap-2">
                     <span className="transform transition-transform duration-150 group-open:rotate-90">▶</span>
                     {typeKey}
                  </summary>
                  <ul className="space-y-1 pl-4 mt-1 border-l-2 border-gray-700">{renderWeaponList(weaponsByType[typeKey].sort((a,b) => a.name.localeCompare(b.name)))}</ul>
                </details>
              ))}
            </div>
          )}
        </div>
        {/* Right Panel: Info */}
        <div className="bg-gray-900/50 p-3 rounded-lg">
          <InfoPanel />
        </div>
      </div>
      
      <p className="text-center text-gray-300 my-3">Selected {selectedWeaponIds.size} of {selectionLimit}</p>

      <div className="flex gap-4 mt-4">
        <button onClick={onBack} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Back</button>
        <button onClick={handleSubmit} disabled={selectedWeaponIds.size !== selectionLimit} className="w-1/2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow disabled:bg-gray-500">Confirm Masteries</button>
      </div>
    </motion.div>
  );
};

export default WeaponMasterySelection;
