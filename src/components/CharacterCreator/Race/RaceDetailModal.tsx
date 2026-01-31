/**
 * @file RaceDetailModal.tsx
 * This component displays detailed information about a single race in a modal.
 * It's used by RaceSelection.tsx and features an updated layout and collapsible trait sections.
 */
import React, { useState, useMemo } from 'react';
import ImageModal from '../../ImageModal';
// Race details can deep-link into the shared glossary modal
import SingleGlossaryEntryModal from '../../Glossary/SingleGlossaryEntryModal';

// This is the new data shape the modal expects.
export interface RaceForModal {
  id: string;
  name: string;
  image?: string;
  description: string;
  baseTraits: {
    type?: string;
    size?: string;
    speed?: number;
    darkvision?: number;
  };
  feats: { name: string; description: string }[];
  furtherChoicesNote?: string;
}

interface SpellProgression {
    level: string;
    name: string;
    usage: string;
}

// THIS IS THE KEY LOGIC FOR THE TABLE STRUCTURE.
// This function is what determines the table structure for spell-granting racial traits like the Air Genasi's 'Mingle with the Wind'.
// It takes the raw description string from a race's data file (e.g., air_genasi.ts) and uses regular expressions (regex)
// to find mentions of cantrips and spells granted at specific levels.
// The output (an array of SpellProgression objects) is then used by the `CollapsibleTrait` component below to conditionally render
// a `<table>` instead of just a block of text, creating the structured display you see in the modal.
const parseSpellProgression = (description: string): { spells: SpellProgression[], remainingDescription: string } => {
    const spells: SpellProgression[] = [];
    let remainingDescription = description;

    const cantripRegex = /you know the (.*?) cantrip\./i;
    // CORRECTED: Made "(?:also )?" optional to handle both 3rd and 5th level spell descriptions.
    const leveledSpellRegex = /starting at (\d+)(?:st|nd|rd|th) level, you can (?:also )?cast the (.*?) spell/gi;

    // Extract Cantrip
    const cantripMatch = remainingDescription.match(cantripRegex);
    if (cantripMatch && cantripMatch[1]) {
        spells.push({ level: '1st', name: cantripMatch[1].trim(), usage: 'Cantrip' });
        remainingDescription = remainingDescription.replace(cantripRegex, '').trim();
    }

    // Extract Leveled Spells
    let match;
    while ((match = leveledSpellRegex.exec(description)) !== null) {
        const level = match[1];
        const spellName = match[2].trim();
        let usage = '1 per Long Rest';
        if (description.toLowerCase().includes('or using any spell slots')) {
             usage += ' or Spell Slot';
        }
        spells.push({ level: `${level}${level === '1' ? 'st' : level === '2' ? 'nd' : level === '3' ? 'rd' : 'th'}`, name: spellName, usage });
        const sentenceRegex = new RegExp(`Starting at ${level}(?:st|nd|rd|th) level, you can also? cast the ${spellName} spell with this trait, without requiring a material component.`, 'i');
        remainingDescription = remainingDescription.replace(sentenceRegex, '').trim();
    }
    
    // Cleanup remaining description by removing common boilerplate text related to spellcasting
    remainingDescription = remainingDescription.replace(/Once you cast.*?Long Rest\./gi, '').trim();
    remainingDescription = remainingDescription.replace(/You can also cast.*?level\./gi, '').trim();
    const spellAbilityRegex = /Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait \(choose when you select this race\)\./i;
    const spellcastingAbilityInfo = description.match(spellAbilityRegex);
    
    remainingDescription = remainingDescription.replace(spellAbilityRegex, '').trim();
    remainingDescription = remainingDescription.replace(/\s{2,}/g, ' ');

    if (spells.length > 0 && spellcastingAbilityInfo) {
        remainingDescription = `${spellcastingAbilityInfo[0]}`.trim();
    }

    return { spells, remainingDescription };
};


const CollapsibleTrait: React.FC<{ name: string; description: string, onSpellClick: (spellId: string) => void; }> = ({ name, description, onSpellClick }) => {
    const [isOpen, setIsOpen] = useState(true);
    const { spells, remainingDescription } = useMemo(() => parseSpellProgression(description), [description]);
    
    const toKebabCase = (str: string) => str.toLowerCase().replace(/[\s/]+/g, '-');

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-md">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-3 text-lg font-semibold text-sky-300 hover:bg-sky-900/30 transition-colors"
                aria-expanded={isOpen}
            >
                {name}
                <svg className={`w-5 h-5 transform transition-transform ${isOpen ? '' : '-rotate-90'}`} fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-3 pt-0 text-sm text-gray-400">
                    {spells.length > 0 ? (
                        <>
                            <table className="w-full text-left text-xs my-2 prose-sm prose-invert">
                                <thead>
                                    <tr className="border-b border-gray-600">
                                        <th className="py-1 px-2 font-semibold text-amber-300">LEVEL</th>
                                        <th className="py-1 px-2 font-semibold text-amber-300">SPELL/ABILITY</th>
                                        <th className="py-1 px-2 font-semibold text-amber-300">USAGE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spells.map((spell, index) => (
                                        <tr key={index} className="border-b border-gray-700/50">
                                            <td className="py-1.5 px-2 text-amber-400">{spell.level}</td>
                                            <td className="py-1.5 px-2">
                                                <button onClick={() => onSpellClick(toKebabCase(spell.name))} className="text-sky-400 hover:text-sky-200 underline transition-colors">
                                                    {spell.name}
                                                </button>
                                            </td>
                                            <td className="py-1.5 px-2">{spell.usage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {remainingDescription && <p className="mt-2 text-xs italic">{remainingDescription}</p>}
                        </>
                    ) : (
                        <p className="whitespace-pre-wrap">{description}</p>
                    )}
                </div>
            )}
        </div>
    );
};

interface RaceDetailModalProps {
  race: RaceForModal;
  onSelect: (raceId: string) => void;
  onClose: () => void;
}

const RaceDetailModal: React.FC<RaceDetailModalProps> = ({ race, onSelect, onClose }) => {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [infoSpellId, setInfoSpellId] = useState<string | null>(null);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleBackdropKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (infoSpellId) {
          setInfoSpellId(null);
        } else if (isImageExpanded) {
          setIsImageExpanded(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isImageExpanded, infoSpellId]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[var(--z-index-modal-background)] p-4"
        onClick={handleBackdropClick}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        aria-label="Close race details"
        tabIndex={0}
      >
        <div
          className="bg-gray-900 text-gray-300 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-5xl max-h-[90vh] flex flex-col"
          aria-modal="true"
          role="dialog"
          aria-labelledby={`race-modal-title-${race.id}`}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 id={`race-modal-title-${race.id}`} className="text-4xl font-bold text-amber-400 font-cinzel">{race.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl transition-colors" aria-label="Close race details">&times;</button>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-grow overflow-y-auto scrollable-content pr-4 -mr-4">
            {/* Left Column (Image & Stats) */}
            <div className="md:col-span-2 space-y-4">
              {race.image && (
                  <button
                    type="button"
                    className="relative group cursor-pointer"
                    onClick={() => setIsImageExpanded(true)}
                    aria-label={`Expand ${race.name} image`}
                  >
                    <img src={race.image} alt={`${race.name} illustration`} className="w-full h-auto rounded-lg object-contain shadow-lg border border-gray-700"/>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-2xl" aria-hidden="true">🔍</div>
                  </button>
              )}
               <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <h3 className="text-xl font-semibold text-sky-300 mb-2">Ancestral Traits</h3>
                <ul className="space-y-1.5 text-sm">
                  {race.baseTraits.type && <li><strong>Type:</strong> <span className="text-sky-400">{race.baseTraits.type}</span></li>}
                  {race.baseTraits.size && <li><strong>Size:</strong> {race.baseTraits.size}</li>}
                  {race.baseTraits.speed !== undefined && <li><strong>Speed:</strong> {race.baseTraits.speed} ft.</li>}
                  {race.baseTraits.darkvision !== undefined && <li><strong>Darkvision:</strong> Yes ({race.baseTraits.darkvision} ft.)</li>}
                </ul>
              </div>
            </div>

            {/* Right Column (Description & Feats) */}
            <div className="md:col-span-3 space-y-4">
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <h3 className="text-xl font-semibold text-sky-300 mb-2">Race Description</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{race.description}</p>
              </div>
              {race.feats.map(feat => (
                <CollapsibleTrait key={feat.name} name={feat.name} description={feat.description} onSpellClick={setInfoSpellId} />
              ))}
              {race.furtherChoicesNote && (
                 <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h3 className="text-lg font-semibold text-sky-300 mb-2">Further Choices</h3>
                    <p className="text-sm text-gray-400">{race.furtherChoicesNote}</p>
                 </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-6 flex gap-4 pt-4 border-t border-gray-700 flex-shrink-0">
            <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors">Back to List</button>
            <button onClick={() => onSelect(race.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors">Select {race.name}</button>
          </div>
        </div>
      </div>
      {isImageExpanded && race.image && (
          <ImageModal src={race.image} alt={`${race.name} illustration`} onClose={() => setIsImageExpanded(false)} />
      )}
      <SingleGlossaryEntryModal
        isOpen={!!infoSpellId}
        initialTermId={infoSpellId}
        onClose={() => setInfoSpellId(null)}
      />
    </>
  );
};

export default RaceDetailModal;
