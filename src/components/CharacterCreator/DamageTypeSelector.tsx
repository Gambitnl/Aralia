import React from 'react';

interface DamageTypeSelectorProps {
  availableTypes: string[];
  selectedType?: string;
  onSelect: (type: string) => void;
}

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  Acid: 'bg-green-600 border-green-400 text-green-100',
  Cold: 'bg-blue-600 border-blue-400 text-blue-100',
  Fire: 'bg-red-600 border-red-400 text-red-100',
  Lightning: 'bg-yellow-600 border-yellow-400 text-yellow-100',
  Thunder: 'bg-purple-600 border-purple-400 text-purple-100',
  Poison: 'bg-emerald-600 border-emerald-400 text-emerald-100',
};

const DamageTypeSelector: React.FC<DamageTypeSelectorProps> = ({
  availableTypes,
  selectedType,
  onSelect,
}) => {
  return (
    <div className="mt-3">
      <label className="block text-sm text-gray-300 mb-2">
        Select Damage Type:
      </label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {availableTypes.map((type) => {
          const isSelected = selectedType === type;
          const colorClass = DAMAGE_TYPE_COLORS[type] || 'bg-gray-700 border-gray-600 text-gray-300';

          return (
            <button
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(type);
              }}
              className={`
                px-3 py-2 rounded border text-sm transition-all duration-200 font-medium
                ${isSelected
                  ? `${colorClass} ring-2 ring-offset-1 ring-offset-gray-900 ring-amber-500`
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
                }
              `}
            >
              {type}
            </button>
          );
        })}
      </div>
      {!selectedType && (
        <p className="text-xs text-amber-300 mt-2">
          Please select a damage type to specialize in.
        </p>
      )}
    </div>
  );
};

export default DamageTypeSelector;
