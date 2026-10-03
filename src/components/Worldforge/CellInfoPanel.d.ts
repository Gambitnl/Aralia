/**
 * @file src/components/Worldforge/CellInfoPanel.tsx
 * Floating panel that reports the contents of a selected atlas cell.
 * Rendered by AtlasDemo when a cell is clicked; reads a pure CellInfo summary
 * (systems/worldforge/cellInfo) and offers a "Descend into region" action that
 * hands off to the existing L1 region generation.
 */
import React from "react";
import type { CellInfo } from "../../systems/worldforge/cellInfo";
export interface CellInfoPanelProps {
    info: CellInfo;
    /** Close the panel (clear selection). */
    onClose: () => void;
    /** Descend into the L1 region for this cell (land cells only). */
    onDescend: (cellId: number) => void;
}
declare const CellInfoPanel: React.FC<CellInfoPanelProps>;
export default CellInfoPanel;
