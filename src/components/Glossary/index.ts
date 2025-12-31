// Export all glossary components
export { default as Glossary } from './Glossary';
export { default as GlossaryDisplay } from './GlossaryDisplay';
export { default as GlossaryTooltip } from './GlossaryTooltip';
export { default as SingleGlossaryEntryModal } from './SingleGlossaryEntryModal';
export { FullEntryDisplay } from './FullEntryDisplay';
export { GlossaryContentRenderer } from './GlossaryContentRenderer';
export { default as SpellCardTemplate } from './SpellCardTemplate';
export type { SpellData } from './SpellCardTemplate';

// Modular sub-components (extracted from Glossary.tsx)
export { GlossaryHeader } from './GlossaryHeader';
export { GlossarySidebar } from './GlossarySidebar';
export { GlossaryEntryPanel } from './GlossaryEntryPanel';
export { GlossaryFooter } from './GlossaryFooter';
export { GlossaryResizeHandles } from './GlossaryResizeHandles';

// Hooks
export * from './hooks';
