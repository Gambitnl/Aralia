import React from 'react';
import { Spell } from '../../../types';
import { SpellSummaryCard } from '../../ui/SpellSummaryCard';

interface SpellCardProps {
  spell: Spell;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  idPrefix?: string;
  className?: string;
}

/**
 * Class spell selection keeps its historical checkbox API while delegating the
 * visible spell summary to the shared card used by feat and spellbook surfaces.
 */
export const SpellCard: React.FC<SpellCardProps> = ({
  spell,
  selected,
  disabled,
  onToggle,
  idPrefix = 'spell',
  className = '',
}) => {
  const inputId = `${idPrefix}-${spell.id}`;

  return (
    <SpellSummaryCard
      spell={spell}
      selected={selected}
      disabled={disabled}
      inputId={inputId}
      showCheckbox
      onToggle={onToggle}
      className={className}
    />
  );
};
