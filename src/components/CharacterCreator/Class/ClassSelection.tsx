/**
 * @file ClassSelection.tsx
 * Refactored to use the Split Config Style (List on Left, Details on Right).
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Class as CharClass } from '../../../types'; 
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { ClassDetailPane } from './ClassDetailPane';
import { SelectionListItem } from '../../ui/SelectionList';

interface ClassSelectionProps {
  classes: CharClass[];
  onClassSelect: (classId: string) => void;
  onBack: () => void;
}

const ClassSelection: React.FC<ClassSelectionProps> = ({
  classes,
  onClassSelect,
  onBack,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name));
  const defaultClassId = sortedClasses[0]?.id ?? null;
  // Avoid setState-in-effect by treating the first class as the implicit selection.
  const effectiveClassId = selectedClassId ?? defaultClassId;
  const selectedClass = sortedClasses.find(c => c.id === effectiveClassId) ?? null;

  return (
    <CreationStepLayout title="Choose Your Class" onBack={onBack}>
      <SplitPaneLayout
        controls={
          <div className="space-y-2">
            {sortedClasses.map((charClass) => (
              <SelectionListItem
                key={charClass.id}
                label={charClass.name}
                selected={effectiveClassId === charClass.id}
                onClick={() => setSelectedClassId(charClass.id)}
              />
            ))}
          </div>
        }
        preview={
          selectedClass ? (
            <motion.div
              key={selectedClass.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ClassDetailPane charClass={selectedClass} onSelect={onClassSelect} />
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 italic">
              Select a class to view details
            </div>
          )
        }
      />
    </CreationStepLayout>
  );
};

export default ClassSelection;
