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
              <button
                key={charClass.id}
                onClick={() => setSelectedClassId(charClass.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent ${
                  effectiveClassId === charClass.id
                    ? 'bg-sky-900/40 border-sky-500/50 text-sky-300 shadow-md font-semibold'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{charClass.name}</span>
                  {effectiveClassId === charClass.id && (
                    <motion.span layoutId="active-indicator-class" className="text-sky-400 text-sm">
                      ▶
                    </motion.span>
                  )}
                </div>
              </button>
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
