/**
 * @file FighterFeatureSelection.tsx
 * This component allows a player who has chosen the Fighter class to select
 * a Fighting Style from the available options.
 */
import React, { useState } from 'react';
import { FightingStyle } from '../../../types'; 
import { CreationStepLayout } from '../ui/CreationStepLayout';

interface FighterFeatureSelectionProps {
  styles: FightingStyle[]; 
  onStyleSelect: (style: FightingStyle) => void;
  onBack: () => void; 
}

const FighterFeatureSelection: React.FC<FighterFeatureSelectionProps> = ({
  styles,
  onStyleSelect,
  onBack,
}) => {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  const handleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
  };

  const handleSubmit = () => {
    if (selectedStyleId) {
      const style = styles.find((s) => s.id === selectedStyleId);
      if (style) {
        onStyleSelect(style);
      }
    }
  };

  return (
    <CreationStepLayout
      title="Choose Fighting Style"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!!selectedStyleId}
      nextLabel="Confirm Style"
    >
      <div className="space-y-3">
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelect(style.id)}
            className={`w-full text-left p-4 rounded-xl transition-all border-2 ${
              selectedStyleId === style.id
                ? 'bg-sky-900/40 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.2)]'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
            aria-pressed={selectedStyleId === style.id}
          >
            <h3 className="font-bold text-amber-400 text-lg">{style.name}</h3>
            <p className="text-sm text-gray-300 mt-1">{style.description}</p>
          </button>
        ))}
      </div>
    </CreationStepLayout>
  );
};

export default FighterFeatureSelection;