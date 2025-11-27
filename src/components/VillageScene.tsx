import React, { useEffect, useMemo, useRef } from 'react';
import { describeBuilding, findBuildingAtWithCache, generateVillageLayout, VillageTileType } from '../services/villageGenerator';
import { villageBuildingVisuals } from '../config/submapVisualsConfig';
import { Action, VillageActionContext } from '../types';

interface VillageSceneProps {
  worldSeed: number;
  worldX: number;
  worldY: number;
  biomeId: string;
  // Type-safe action contract keeps upstream reducers honest and prevents
  // accidental payload drift whenever the village integration context expands.
  onAction?: (action: Action) => void;
}

const TILE_SIZE = 16;

const baseTileFill: Record<VillageTileType, string> = {
  grass: '#14532d',
  path: villageBuildingVisuals.path.colors[0],
  plaza: villageBuildingVisuals.plaza.colors[0],
  market: villageBuildingVisuals.market.colors[1],
  well: villageBuildingVisuals.well.colors[1],
  guard_post: villageBuildingVisuals.guard_post.colors[0],
  house_small: villageBuildingVisuals.house_small.colors[0],
  house_medium: villageBuildingVisuals.house_medium.colors[0],
  house_large: villageBuildingVisuals.house_large.colors[0],
  shop_blacksmith: villageBuildingVisuals.shop_blacksmith.colors[0],
  shop_general: villageBuildingVisuals.shop_general.colors[0],
  shop_tavern: villageBuildingVisuals.shop_tavern.colors[0],
  shop_temple: villageBuildingVisuals.shop_temple.colors[0]
};

// Keep merchant type lookup at module scope so clicks do not recreate the map
// every render; leaving non-shop keys out keeps the object minimal because
// missing keys already return undefined in JS.
const shopMerchantTypeMap: Partial<Record<VillageTileType, string>> = {
  shop_blacksmith: 'Blacksmith',
  shop_general: 'General Store',
  shop_tavern: 'Tavern',
  shop_temple: 'Temple'
};

const interactionLabels: Record<VillageTileType, string> = {
  grass: 'Wander the Green',
  path: 'Stroll the Lane',
  plaza: 'Visit Central Plaza',
  market: 'Browse Market Square',
  well: 'Draw Water at the Well',
  guard_post: 'Speak to the Guard',
  house_small: 'Knock on Cottage Door',
  house_medium: 'Visit Family Home',
  house_large: 'Call on Manor',
  shop_blacksmith: 'Visit Blacksmith',
  shop_general: 'Visit General Store',
  shop_tavern: 'Enter Tavern',
  shop_temple: 'Enter Temple'
};

const VillageScene: React.FC<VillageSceneProps> = ({ worldSeed, worldX, worldY, biomeId, onAction }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Deterministically regenerate when world coordinates or seed change so
  // villages stay anchored to their parent tile.
  const layout = useMemo(
    () => generateVillageLayout({ worldSeed, worldX, worldY, biomeId }),
    [worldSeed, worldX, worldY, biomeId]
  );

  // Draw the deterministic canvas every time layout changes.
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = layout.width * TILE_SIZE;
    canvas.height = layout.height * TILE_SIZE;

    ctx.fillStyle = '#0b1722';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render tile layer.
    for (let y = 0; y < layout.height; y++) {
      for (let x = 0; x < layout.width; x++) {
        const tile = layout.tiles[y][x];
        const baseColor = baseTileFill[tile] || '#0f172a';
        ctx.fillStyle = baseColor;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Add light texture based on visual pattern for variety
        const visuals = villageBuildingVisuals[tile];
        if (visuals?.pattern) {
          ctx.strokeStyle = visuals.accent;
          ctx.lineWidth = 1;
          if (visuals.pattern === 'stripe') {
            ctx.beginPath();
            ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
            ctx.lineTo((x + 1) * TILE_SIZE, (y + 1) * TILE_SIZE);
            ctx.stroke();
          } else if (visuals.pattern === 'check') {
            ctx.strokeRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          } else if (visuals.pattern === 'dot') {
            ctx.fillStyle = visuals.accent;
            ctx.beginPath();
            ctx.arc(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Draw road overlay to keep paths legible over buildings
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 0.5;
    layout.buildings.forEach(building => {
      const { footprint } = building;
      ctx.strokeRect(
        footprint.x * TILE_SIZE,
        footprint.y * TILE_SIZE,
        footprint.width * TILE_SIZE,
        footprint.height * TILE_SIZE
      );
    });
  }, [layout]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);
    const building = findBuildingAtWithCache(layout, x, y);
    const tileType: VillageTileType = building?.type || layout.tiles[y]?.[x] || 'grass';
    const label = interactionLabels[tileType] || 'Investigate';

    const villageContext: VillageActionContext = {
      worldX,
      worldY,
      biomeId,
      buildingId: building?.id,
      buildingType: tileType,
      description: building ? describeBuilding(building, layout.personality) : 'A quiet corner of the village.',
      // Carry all integration metadata so downstream actions (merchants,
      // NPC greetings, etc.) can reuse the same cultural tone without
      // re-resolving the personality profile.
      integrationProfileId: layout.integrationProfile.id,
      integrationPrompt: layout.integrationProfile.aiPrompt,
      integrationTagline: layout.integrationProfile.tagline,
      culturalSignature: layout.integrationProfile.culturalSignature,
      encounterHooks: layout.integrationProfile.encounterHooks
    };

    // For shop tiles, open the dynamic merchant flow directly so gameplay hooks
    // receive the culture-aware context instead of just a descriptive blurb.
    const merchantType = shopMerchantTypeMap[tileType];

    const action: Action = merchantType
      ? {
          type: 'OPEN_DYNAMIC_MERCHANT',
          label: label || `Enter ${merchantType}`,
          payload: { merchantType, villageContext }
        }
      : {
          type: 'custom',
          label,
          payload: { villageContext }
        };

    // Emit a fully typed action so downstream handlers can immediately forward
    // the AI-friendly prompt and profile id without guessing at field names.
    onAction?.(action);
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="flex items-center justify-between text-amber-200 text-xs font-cinzel">
        <span>
          Village mood: {layout.personality.wealth} / {layout.personality.culture} / {layout.personality.biomeStyle}
        </span>
        <span
          className="italic text-amber-100/70 cursor-help"
          title={layout.integrationProfile.culturalSignature}
        >
          &ldquo;{layout.integrationProfile.tagline}&rdquo;
        </span>
        <span>Population: {layout.personality.population}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={layout.width * TILE_SIZE}
        height={layout.height * TILE_SIZE}
        className="w-full max-h-[70vh] rounded-lg border border-amber-700 shadow-inner bg-black"
        onClick={handleClick}
      />
    </div>
  );
};

export default VillageScene;
