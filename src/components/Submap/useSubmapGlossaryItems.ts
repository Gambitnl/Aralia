/**
 * @file useSubmapGlossaryItems.ts
 * Builds the legend data shown in the modal. Kept here so SubmapPane stays lean and so
 * other submap renderers (Pixi or future canvas) can share the same glossary logic.
 * Dependencies: visualsConfig (BiomeVisuals) + SUBMAP_ICON_MEANINGS lookup table.
 */
import { useMemo } from 'react';
import { BiomeVisuals, GlossaryDisplayItem } from '../../types';
import { SUBMAP_ICON_MEANINGS } from '../../data/glossaryData';

export const useSubmapGlossaryItems = (visualsConfig: BiomeVisuals): GlossaryDisplayItem[] => {
  return useMemo(() => {
    const items: GlossaryDisplayItem[] = [];
    const addedIcons = new Set<string>();

    const addIcon = (icon: string | undefined, meaningKey: string, category?: string) => {
      if (icon && !addedIcons.has(icon)) {
        items.push({ icon, meaning: SUBMAP_ICON_MEANINGS[icon] || meaningKey, category });
        addedIcons.add(icon);
      }
    };

    addIcon('🧍', 'Your Position', 'Player');
    if (visualsConfig.pathIcon) addIcon(visualsConfig.pathIcon, 'Path Marker', 'Path');
    visualsConfig.seededFeatures?.forEach((sf) => addIcon(sf.icon, sf.name || sf.id, 'Seeded Feature'));
    visualsConfig.scatterFeatures?.forEach((sc) => addIcon(sc.icon, `Scatter: ${sc.icon}`, 'Scatter Feature'));
    visualsConfig.pathAdjacency?.scatter?.forEach((paSc) =>
      addIcon(paSc.icon, `Path Adjacency: ${paSc.icon}`, 'Path Adjacency Scatter')
    );
    if (visualsConfig.caTileVisuals) {
      if (visualsConfig.caTileVisuals.wall.icon) addIcon(visualsConfig.caTileVisuals.wall.icon, 'Wall', 'Structure');
      if (visualsConfig.caTileVisuals.floor.icon) addIcon(visualsConfig.caTileVisuals.floor.icon, 'Floor', 'Structure');
    }

    return items.sort(
      (a, b) => (a.category || '').localeCompare(b.category || '') || a.meaning.localeCompare(b.meaning)
    );
  }, [visualsConfig]);
};

export default useSubmapGlossaryItems;
