// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:04
 * Dependents: design-preview.tsx
 * Imports: 30 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState, useCallback } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
import { VariantSwitcher } from './VariantSwitcher';
import { Z_INDEX } from '../../styles/zIndex';
import { PreviewRace } from './steps/PreviewRace';

// ============================================================================
// CODEBASE VISUALIZER CONSTANTS
// ============================================================================

// Port where the codebase visualizer server runs
const VISUALIZER_PORT = 3847;
// Full URL to the visualizer
const VISUALIZER_URL = `http://localhost:${VISUALIZER_PORT}`;
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
import { PreviewBiome } from './steps/PreviewBiome';
import { PreviewRaceImages } from './steps/PreviewRaceImages';

export const DesignPreviewPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<string>('biome'); // Default to new track for convenience
  const [variant, setVariant] = useState<string>('unified');
  const [isWindowOpen, setIsWindowOpen] = useState(true);
  // Track visualizer server status: 'unknown' | 'running' | 'stopped'
  const [visualizerStatus, setVisualizerStatus] = useState<string>('unknown');

  // ============================================================================
  // CODEBASE VISUALIZER FUNCTIONS
  // ============================================================================

  /**
   * Opens the codebase visualizer in a new browser tab.
   * The visualizer server must be running for this to work.
   */
  const openVisualizer = useCallback(() => {
    window.open(VISUALIZER_URL, '_blank');
  }, []);

  /**
   * Sends a shutdown request to the visualizer server.
   * The server will gracefully close after responding.
   */
  const killVisualizer = useCallback(async () => {
    try {
      // Send shutdown request to the visualizer server's API endpoint
      const response = await fetch(`${VISUALIZER_URL}/api/shutdown`);
      if (response.ok) {
        setVisualizerStatus('stopped');
        console.log('Visualizer server shutdown requested');
      }
    } catch (error) {
      // If fetch fails, server is likely already stopped
      setVisualizerStatus('stopped');
      console.log('Visualizer server is not running or already stopped');
    }
  }, []);

  /**
   * Checks if the visualizer server is currently running.
   * Updates the visualizerStatus state accordingly.
   */
  const checkVisualizerStatus = useCallback(async () => {
    try {
      const response = await fetch(`${VISUALIZER_URL}/api/health`);
      if (response.ok) {
        setVisualizerStatus('running');
      } else {
        setVisualizerStatus('stopped');
      }
    } catch {
      setVisualizerStatus('stopped');
    }
  }, []);

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
    { id: 'biome', label: 'Biome Gen' },
    { id: 'frame', label: 'Window' },
    { id: 'imagegen', label: 'ImageGen' },
    { id: 'tables', label: 'Tables' },
    { id: 'icons', label: 'Icons' },
    { id: 'missing_icons', label: 'Missing Icons' },
    { id: 'race_images', label: 'Race Images' },
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
    biome: 'sandbox',
    frame: 'window',
    imagegen: 'imagegen',
    tables: 'legacy',
    icons: 'legacy',
    missing_icons: 'legacy',
    race_images: 'legacy',
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-200 overflow-hidden flex flex-col">
      {/* Top Bar */}
      {/* Header bar - uses PAGE_HEADER z-index to stay above WindowFrame */}
      <header className={`flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between shadow-md z-[${Z_INDEX.PAGE_HEADER}]`}>
        <div className="flex items-center gap-4 overflow-hidden w-full">
          <h1 className="text-lg font-cinzel font-bold text-gray-300 mr-2 flex-shrink-0">Design Preview</h1>
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 gap-1 overflow-x-auto no-scrollbar mask-fade">
            {steps.map(s => (
              <button
                type="button"
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

        {/* Right side controls: Visualizer buttons + Style switcher */}
        <div className="flex-shrink-0 ml-4 flex items-center gap-3">
          {/* Codebase Visualizer Controls */}
          <div className="flex items-center gap-2 border-r border-gray-700 pr-3">
            {/* Open Visualizer Button - opens in new tab */}
            <button
              type="button"
              onClick={openVisualizer}
              onMouseEnter={checkVisualizerStatus}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              title="Open Codebase Visualizer in new tab"
            >
              Visualizer
            </button>
            {/* Kill Server Button - sends shutdown request */}
            <button
              type="button"
              onClick={killVisualizer}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
              title="Stop the visualizer server"
            >
              Kill
            </button>
            {/* Status indicator dot */}
            <div
              className={`w-2 h-2 rounded-full ${visualizerStatus === 'running' ? 'bg-green-500' :
                visualizerStatus === 'stopped' ? 'bg-red-500' :
                  'bg-gray-500'
                }`}
              title={`Server status: ${visualizerStatus}`}
            />
          </div>

          {/* Style Variant Switcher */}
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
            {currentStep === 'biome' && <PreviewBiome />}
            {currentStep === 'review' && <PreviewReview variant={variant} />}
            {currentStep === 'frame' && <PreviewWindowFrame variant={variant} />}
            {currentStep === 'imagegen' && <PreviewImageGen variant={variant} />}
            {currentStep === 'tables' && <PreviewTables variant={variant} />}
            {currentStep === 'icons' && <PreviewIcons variant={variant} />}
            {currentStep === 'missing_icons' && <PreviewMissingIcons variant={variant} />}
            {currentStep === 'race_images' && <PreviewRaceImages />}
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
