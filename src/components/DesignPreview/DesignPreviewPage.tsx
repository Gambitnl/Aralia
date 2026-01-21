import React, { useState } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
import { VariantSwitcher } from './VariantSwitcher';
import { PreviewRace } from './steps/PreviewRace';
import { PreviewAge } from './steps/PreviewAge';
import { PreviewBackground } from './steps/PreviewBackground';
import { PreviewVisuals } from './steps/PreviewVisuals';
import { PreviewClass } from './steps/PreviewClass';
import { PreviewClassFeatures } from './steps/PreviewClassFeatures';
import { PreviewWeaponMastery } from './steps/PreviewWeaponMastery';
import { PreviewStats } from './steps/PreviewStats';
import { PreviewSkills } from './steps/PreviewSkills';
import { PreviewFeats } from './steps/PreviewFeats';
import { PreviewReview } from './steps/PreviewReview';
import { PreviewAlchemy } from './steps/PreviewAlchemy';
import { PreviewExperimental } from './steps/PreviewExperimental';
import { PreviewEquipment } from './steps/PreviewEquipment';
import { PreviewTrade } from './steps/PreviewTrade';
import { PreviewDialogue } from './steps/PreviewDialogue';
import { PreviewCombat } from './steps/PreviewCombat';
import { PreviewWindowFrame } from './steps/PreviewWindowFrame';
import { PreviewImageGen } from './steps/PreviewImageGen';
import { PreviewCombatSandbox } from './steps/PreviewCombatSandbox';
import { PreviewTables } from './steps/PreviewTables';
import { PreviewThreeDTest } from './steps/PreviewThreeDTest';
import { PreviewIcons } from './steps/PreviewIcons';
import { PreviewMissingIcons } from './steps/PreviewMissingIcons';
import { PreviewEnvironment } from './steps/PreviewEnvironment';

export const DesignPreviewPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<string>('race');
  const [variant, setVariant] = useState<string>('unified');
  const [isWindowOpen, setIsWindowOpen] = useState(true);

  const steps = [
    { id: 'race', label: 'Race' },
    { id: 'class', label: 'Class' },
    { id: 'background', label: 'Background' },
    { id: 'stats', label: 'Stats' },
    { id: 'skills', label: 'Skills' },
    { id: 'features', label: 'Features' },
    { id: 'mastery', label: 'Mastery' },
    { id: 'feats', label: 'Feats' },
    { id: 'age', label: 'Age' },
    { id: 'visuals', label: 'Visuals' },
    { id: 'review', label: 'Review' },
    { id: 'alchemy', label: 'Alchemy' },
    { id: 'experimental', label: 'Experimental' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'trade', label: 'Trade' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'combat', label: 'Combat' },
    { id: 'sandbox', label: 'Sandbox' },
    { id: '3d', label: '3D Test' },
    { id: 'environment', label: 'Environment' },
    { id: 'frame', label: 'Window' },
    { id: 'imagegen', label: 'ImageGen' },
    { id: 'tables', label: 'Tables' },
    { id: 'icons', label: 'Icons' },
    { id: 'missing_icons', label: 'Missing Icons' },
  ];

  // Map of which style is currently live in production for each step
  const productionStyles: Record<string, string> = {
    race: 'split',
    class: 'split',
    background: 'split',
    stats: 'legacy',
    skills: 'legacy',
    features: 'legacy',
    mastery: 'legacy',
    feats: 'legacy',
    age: 'legacy',
    visuals: 'legacy',
    review: 'legacy',
    alchemy: 'alchemy',
    experimental: 'experimental',
    equipment: 'equipment',
    trade: 'trade',
    dialogue: 'dialogue',
    combat: 'combat',
    sandbox: 'sandbox',
    '3d': 'sandbox',
    environment: 'sandbox',
    frame: 'window',
    imagegen: 'imagegen',
    tables: 'legacy',
    icons: 'legacy',
    missing_icons: 'legacy',
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-200 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between shadow-md z-40">
        <div className="flex items-center gap-4 overflow-hidden w-full">
          <h1 className="text-lg font-cinzel font-bold text-gray-300 mr-2 flex-shrink-0">Design Preview</h1>
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 gap-1 overflow-x-auto no-scrollbar mask-fade">
            {steps.map(s => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${currentStep === s.id ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 ml-4">
          <VariantSwitcher
            label="Style"
            selectedId={variant}
            currentProductionId={productionStyles[currentStep]}
            onSelect={setVariant}
            options={[
              { id: 'unified', label: 'Unified Design', description: 'Proposed harmonized system.' },
              { id: 'legacy', label: 'Legacy Design', description: 'Current production style.' },
              { id: 'split', label: 'Split Config Style', description: 'Visuals Selection aesthetic.' },
              { id: 'modal', label: 'Modal Style', description: 'Race Selection aesthetic.' },
              { id: 'direct', label: 'Direct Card Style', description: 'Class Selection aesthetic.' },
              { id: 'list', label: 'List Style', description: 'Skill Selection aesthetic.' },
              { id: 'master_detail', label: 'Master-Detail Style', description: 'Background Selection aesthetic.' },
              { id: 'glossary', label: 'Glossary Style', description: 'Three-pane layout.' },
              { id: 'alchemy', label: 'Alchemy Style', description: 'Tabbed Workbench aesthetic.' },
              { id: 'experimental', label: 'Experimental Style', description: 'Cauldron mixing aesthetic.' },
              { id: 'equipment', label: 'Equipment Style', description: 'Paper Doll aesthetic.' },
              { id: 'trade', label: 'Trade Style', description: 'Dual-list merchant aesthetic.' },
              { id: 'dialogue', label: 'Dialogue Style', description: 'Visual novel aesthetic.' },
              { id: 'combat', label: 'Combat Style', description: 'Tactical HUD aesthetic.' },
              { id: 'accordion', label: 'Accordion Style', description: 'Feats/Mastery aesthetic.' },
              { id: 'counter_grid', label: 'Counter Grid Style', description: 'Abilities aesthetic.' },
              { id: 'input_focus', label: 'Input Focus Style', description: 'Age aesthetic.' },
              { id: 'document', label: 'Document Style', description: 'Review aesthetic.' },
              { id: 'window', label: 'Window Style', description: 'Resizable Frame.' },
            ]}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-grow overflow-hidden relative bg-gray-900">
        {isWindowOpen ? (
          <WindowFrame
            title={steps.find(s => s.id === currentStep)?.label || 'Preview'}
            storageKey="design-preview-window"
            onClose={() => setIsWindowOpen(false)}
          >
            {currentStep === 'race' && <PreviewRace variant={variant} />}
            {currentStep === 'age' && <PreviewAge variant={variant} />}
            {currentStep === 'background' && <PreviewBackground variant={variant} />}
            {currentStep === 'visuals' && <PreviewVisuals variant={variant} />}
            {currentStep === 'class' && <PreviewClass variant={variant} />}
            {currentStep === 'features' && <PreviewClassFeatures variant={variant} />}
            {currentStep === 'mastery' && <PreviewWeaponMastery variant={variant} />}
            {currentStep === 'stats' && <PreviewStats variant={variant} />}
            {currentStep === 'skills' && <PreviewSkills variant={variant} />}
            {currentStep === 'feats' && <PreviewFeats variant={variant} />}
            {currentStep === 'alchemy' && <PreviewAlchemy variant={variant} />}
            {currentStep === 'experimental' && <PreviewExperimental variant={variant} />}
            {currentStep === 'equipment' && <PreviewEquipment variant={variant} />}
            {currentStep === 'trade' && <PreviewTrade variant={variant} />}
            {currentStep === 'dialogue' && <PreviewDialogue variant={variant} />}
            {currentStep === 'combat' && <PreviewCombat variant={variant} />}
            {currentStep === 'sandbox' && <PreviewCombatSandbox variant={variant} />}
            {currentStep === '3d' && <PreviewThreeDTest variant={variant} />}
            {currentStep === 'environment' && <PreviewEnvironment />}
            {currentStep === 'review' && <PreviewReview variant={variant} />}
            {currentStep === 'frame' && <PreviewWindowFrame variant={variant} />}
            {currentStep === 'imagegen' && <PreviewImageGen variant={variant} />}
            {currentStep === 'tables' && <PreviewTables variant={variant} />}
            {currentStep === 'icons' && <PreviewIcons variant={variant} />}
            {currentStep === 'missing_icons' && <PreviewMissingIcons variant={variant} />}
          </WindowFrame>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsWindowOpen(true)}
              className="px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500"
            >
              Reopen Preview Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
