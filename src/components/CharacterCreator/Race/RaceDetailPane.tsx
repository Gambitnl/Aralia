/**
 * @file RaceDetailPane.tsx
 * Detailed view of a selected race, designed for the right pane of the Split Config layout.
 */
import React, { useState, useMemo } from 'react';
import ImageModal from '../../ImageModal';
import SingleGlossaryEntryModal from '../../Glossary/SingleGlossaryEntryModal';
import { BTN_PRIMARY } from '../../../styles/buttonStyles';

export interface RaceDetailData {
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

const parseSpellProgression = (description: string): { spells: SpellProgression[], remainingDescription: string } => {
    const spells: SpellProgression[] = [];
    let remainingDescription = description;

    const cantripRegex = /you know the (.*?) cantrip\./i;
    const leveledSpellRegex = /starting at (\d+)(?:st|nd|rd|th) level, you can (?:also )?cast the (.*?) spell/gi;

    const cantripMatch = remainingDescription.match(cantripRegex);
    if (cantripMatch && cantripMatch[1]) {
        spells.push({ level: '1st', name: cantripMatch[1].trim(), usage: 'Cantrip' });
        remainingDescription = remainingDescription.replace(cantripRegex, '').trim();
    }

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
        <div className="bg-gray-900/40 border border-gray-700 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-3 text-lg font-semibold text-sky-300 hover:bg-sky-900/20 transition-colors"
                aria-expanded={isOpen}
            >
                {name}
                <svg className={`w-5 h-5 transform transition-transform ${isOpen ? '' : '-rotate-90'}`} fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 pt-0 text-sm text-gray-400 border-t border-gray-700/50">
                    {spells.length > 0 ? (
                        <>
                            <table className="w-full text-left text-xs my-2 prose-sm prose-invert bg-black/20 rounded">
                                <thead>
                                    <tr className="border-b border-gray-600">
                                        <th className="py-2 px-3 font-semibold text-amber-300">LEVEL</th>
                                        <th className="py-2 px-3 font-semibold text-amber-300">SPELL/ABILITY</th>
                                        <th className="py-2 px-3 font-semibold text-amber-300">USAGE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spells.map((spell, index) => (
                                        <tr key={index} className="border-b border-gray-700/30 last:border-0">
                                            <td className="py-2 px-3 text-amber-400">{spell.level}</td>
                                            <td className="py-2 px-3">
                                                <button onClick={() => onSpellClick(toKebabCase(spell.name))} className="text-sky-400 hover:text-sky-200 underline transition-colors">
                                                    {spell.name}
                                                </button>
                                            </td>
                                            <td className="py-2 px-3">{spell.usage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {remainingDescription && <p className="mt-2 text-xs italic">{remainingDescription}</p>}
                        </>
                    ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{description}</p>
                    )}
                </div>
            )}
        </div>
    );
};

interface RaceDetailPaneProps {
  race: RaceDetailData;
  onSelect: (raceId: string) => void;
}

export const RaceDetailPane: React.FC<RaceDetailPaneProps> = ({ race, onSelect }) => {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [infoSpellId, setInfoSpellId] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Image (Left on Desktop, Top on Mobile) */}
            <div className="flex-shrink-0 mx-auto md:mx-0 w-48 md:w-40 lg:w-48">
                {race.image ? (
                    <button
                        type="button"
                        className="relative group cursor-zoom-in w-full"
                        onClick={() => setIsImageExpanded(true)}
                        aria-label={`Expand ${race.name} image`}
                    >
                        <img 
                            src={race.image} 
                            alt={`${race.name} illustration`} 
                            className="w-full h-auto rounded-lg shadow-lg border border-gray-600 group-hover:border-sky-500 transition-colors"
                        />
                    </button>
                ) : (
                    <div className="w-full aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 border border-gray-600">
                        No Image
                    </div>
                )}
            </div>

            {/* Title & Base Stats */}
            <div className="flex-grow">
                <h2 className="text-3xl font-bold text-amber-400 font-cinzel mb-3 border-b border-gray-700 pb-2">
                    {race.name}
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {race.baseTraits.type && <div><span className="text-gray-500 uppercase text-xs font-bold">Type:</span> <span className="text-sky-300">{race.baseTraits.type}</span></div>}
                    {race.baseTraits.size && <div><span className="text-gray-500 uppercase text-xs font-bold">Size:</span> <span className="text-gray-300">{race.baseTraits.size}</span></div>}
                    {race.baseTraits.speed !== undefined && <div><span className="text-gray-500 uppercase text-xs font-bold">Speed:</span> <span className="text-gray-300">{race.baseTraits.speed} ft.</span></div>}
                    {race.baseTraits.darkvision !== undefined && <div><span className="text-gray-500 uppercase text-xs font-bold">Vision:</span> <span className="text-gray-300">{race.baseTraits.darkvision > 0 ? `Darkvision (${race.baseTraits.darkvision} ft.)` : 'Normal'}</span></div>}
                </div>
                <div className="mt-4">
                    <p className="text-gray-300 text-sm leading-relaxed">{race.description}</p>
                </div>
            </div>
        </div>

        {/* Traits List */}
        <div className="space-y-3 flex-grow">
            <h3 className="text-lg font-cinzel text-sky-400 border-b border-gray-700 pb-1 mb-2">Racial Traits</h3>
            {race.feats.map(feat => (
                <CollapsibleTrait key={feat.name} name={feat.name} description={feat.description} onSpellClick={setInfoSpellId} />
            ))}
            
            {race.furtherChoicesNote && (
                <div className="mt-4 p-3 bg-sky-900/20 border border-sky-700/50 rounded-lg flex gap-3 items-start">
                    <span className="text-sky-400 text-xl">ℹ️</span>
                    <p className="text-sm text-sky-200/80">{race.furtherChoicesNote}</p>
                </div>
            )}
        </div>

        {/* Action Footer (Sticky at bottom of pane or just at end) */}
        <div className="mt-8 pt-6 border-t border-gray-700 flex justify-end sticky bottom-0 bg-gray-800 pb-2">
            <button 
                onClick={() => onSelect(race.id)}
                className={`${BTN_PRIMARY} px-8 py-3 text-lg rounded-xl shadow-lg`}
            >
                Confirm {race.name}
            </button>
        </div>

      </div>

      {/* Modals */}
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
