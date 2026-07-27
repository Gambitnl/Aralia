/**
 * @file GlossaryResizeHandles.tsx
 * Resize handle buttons for the glossary modal.
 * Extracted from Glossary.tsx for better modularity.
 */
import React from 'react';
interface GlossaryResizeHandlesProps {
    onResizeStart: (e: React.MouseEvent, handle: string) => void;
}
/**
 * Renders all resize handles (corners and edges) for the glossary modal.
 */
export declare const GlossaryResizeHandles: React.FC<GlossaryResizeHandlesProps>;
export default GlossaryResizeHandles;
