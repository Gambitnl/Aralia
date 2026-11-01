/**
 * @file src/components/CharacterCreator/Class/SubclassChoiceSection.tsx
 * The creator's subclass picker for a class whose rules edition puts the choice
 * at level 2 (the 2014 druid circle and wizard tradition). Remy ruled (Agora
 * 8335, answer to question 8009) that these classes pick in a creator "level 2
 * step" instead of at the first level-up. The character is still built at
 * level 1; the pick lands on `character.subclassId`, so the LevelUpModal does
 * not ask again.
 *
 * The cleric, sorcerer and warlock level 1 pickers keep their own raw-button
 * markup for now (listed debt in buttonAudit.test.ts); this section uses the
 * shared Button so it adds no new raw-button path.
 */
import React from 'react';
import { Button } from '../../ui/Button';

export interface SubclassChoiceOption {
  id: string;
  name: string;
  description: string;
}

interface SubclassChoiceSectionProps {
  /** For example "Druid Circle" or "Arcane Tradition". */
  subclassLabel: string;
  /** The level at which the subclass features start. */
  level: number;
  options: SubclassChoiceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const SubclassChoiceSection: React.FC<SubclassChoiceSectionProps> = ({
  subclassLabel,
  level,
  options,
  selectedId,
  onSelect,
}) => (
  <section aria-label={`Level ${level} step: choose your ${subclassLabel}`}>
    <div className="flex justify-between items-end mb-1 border-b border-gray-700 pb-1">
      <h3 className="text-xl font-cinzel text-amber-400">Level {level} Step: Choose Your {subclassLabel}</h3>
      <span className="text-xs font-mono text-gray-500 mb-1">2014 rules &middot; level {level}</span>
    </div>
    <p className="text-xs text-gray-400 mb-3">
      You choose now. Your character starts at level 1 and gains the {subclassLabel} features at level {level}.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          // The shared Button keeps this new picker inside the button design
          // system (buttonAudit.test.ts blocks new raw-button paths). The
          // pressed option takes the amber "action" look. The text colors are
          // explicit: on screen the inherited color came out light on amber,
          // which was hard to read (checked in the live creator, 2026-10-25).
          <Button
            key={option.id}
            type="button"
            variant={isSelected ? 'action' : 'secondary'}
            size="md"
            onClick={() => onSelect(option.id)}
            aria-pressed={isSelected}
            className="text-left w-full"
          >
            <span className={`block font-cinzel ${isSelected ? 'text-gray-950' : 'text-amber-300'}`}>{option.name}</span>
            <span className={`block text-xs font-normal mt-1 ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>{option.description}</span>
          </Button>
        );
      })}
    </div>
  </section>
);
