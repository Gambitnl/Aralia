/**
 * Full-page shell for the Spell Pipeline Atlas.
 *
 * Why this is separate from the DesignPreview step component:
 * - the step component (PreviewSpellDataFlow) is shown inside a resizable
 *   WindowFrame that hosts many preview surfaces, so we intentionally keep its
 *   own layout WindowFrame-agnostic (h-full / overflow-y-auto).
 * - this wrapper sits at the root of a dedicated HTML entry, fills the viewport
 *   with an h-screen flex column, and provides the "Back to Dev Hub" link and
 *   header chrome that the design-preview doesn't own.
 */
import React from 'react';
import { PreviewSpellDataFlow } from '../DesignPreview/steps/PreviewSpellDataFlow';

export const SpellPipelineAtlasPage: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900 flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500">Developer Tool</span>
          <h1 className="text-base font-semibold text-amber-300">Spell Pipeline Atlas</h1>
        </div>
        <a
          href="./dev_hub.html"
          className="text-xs text-gray-300 border border-gray-700 hover:border-amber-700 hover:text-amber-300 px-2.5 py-1 rounded"
        >
          ← Back to Dev Hub
        </a>
      </header>
      <div className="flex-grow overflow-hidden">
        <PreviewSpellDataFlow />
      </div>
    </div>
  );
};

export default SpellPipelineAtlasPage;
