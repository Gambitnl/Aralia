import { useEffect, useMemo, useState } from 'react';
import { BIOMES } from '../../constants';
import type { PlayerCharacter } from '../../types';
import Scene3D from './Scene3D';
import { simpleHash } from '../../utils/spatial/submapUtils';

interface ThreeDModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldSeed: number;
  biomeId: string;
  gameTime: Date;
  playerSpeed: number;
  partyMembers: PlayerCharacter[];
  parentWorldMapCoords: { x: number; y: number };
  playerSubmapCoords: { x: number; y: number };
  isDevModeEnabled?: boolean;
}

const SUBMAP_FOOTPRINT_FT = 9000;

const ThreeDModal = ({
  isOpen,
  onClose,
  worldSeed,
  biomeId,
  gameTime,
  playerSpeed,
  partyMembers,
  parentWorldMapCoords,
  playerSubmapCoords,
  isDevModeEnabled,
}: ThreeDModalProps) => {
  const [showGrid, setShowGrid] = useState(false);
  const [isCombatMode, setIsCombatMode] = useState(false);
  const [isDashing, setIsDashing] = useState(false);
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [playerSpeedPerRound, setPlayerSpeedPerRound] = useState(0);
  const [isDevTurbo, setIsDevTurbo] = useState(false);

  const submapSeed = useMemo(() => (
    simpleHash(
      worldSeed,
      parentWorldMapCoords.x,
      parentWorldMapCoords.y,
      biomeId,
      playerSubmapCoords.x,
      playerSubmapCoords.y,
      '3d_tile_seed'
    )
  ), [worldSeed, parentWorldMapCoords.x, parentWorldMapCoords.y, biomeId, playerSubmapCoords.x, playerSubmapCoords.y]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const handleDashDown = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setIsDashing(true);
      }
    };
    const handleDashUp = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setIsDashing(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleDashDown);
    window.addEventListener('keyup', handleDashUp);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleDashDown);
      window.removeEventListener('keyup', handleDashUp);
      setIsDashing(false);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectivePlayerSpeed = isDevTurbo ? playerSpeed * 10 : playerSpeed;
  const biome = BIOMES[biomeId];
  const biomeLabel = biome
    ? `${biome.name}${biome.family ? ` (${biome.family}${biome.variant ? ` · ${biome.variant}` : ''})` : ''}`
    : `Biome: ${biomeId}`;
  const biomeColorStyle = biome?.rgbaColor ? { backgroundColor: biome.rgbaColor } : undefined;

  return (
    <div className="fixed inset-0 z-[150] bg-black">
      <div className="absolute inset-0">
        <Scene3D
          biomeId={biomeId}
          gameTime={gameTime}
          playerSpeed={effectivePlayerSpeed}
          submapSeed={submapSeed}
          submapFootprintFt={SUBMAP_FOOTPRINT_FT}
          showGrid={showGrid}
          partyMembers={partyMembers}
          isCombatMode={isCombatMode}
          onPlayerPosition={setPlayerPosition}
          onPlayerSpeed={setPlayerSpeedPerRound}
        />
      </div>
      <div className="absolute top-4 left-4 text-xs text-gray-100 bg-black/60 rounded px-3 py-2 space-y-1">
        <div className="font-semibold">3D Exploration Mode</div>
        <div>WASD move · Shift dash · Mouse orbit/zoom</div>
        <div className="flex items-center gap-2">
          {biome && <span className="inline-block h-3 w-3 rounded-sm border border-white/40" style={biomeColorStyle} aria-hidden />}
          <span>{biomeLabel}</span>
        </div>
        <div>Submap seed: {submapSeed}</div>
        <div>
          Speed: {playerSpeedPerRound.toFixed(0)} ft/round{isDashing && playerSpeedPerRound > 0 ? ' (Dashing)' : ''}
        </div>
        {playerPosition && (
          <div>
            Position: {playerPosition.x.toFixed(1)} ft, {playerPosition.z.toFixed(1)} ft
          </div>
        )}
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowGrid((prev) => !prev)}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {showGrid ? 'Hide Combat Grid' : 'Show Combat Grid'}
        </button>
        <button
          type="button"
          onClick={() => setIsCombatMode((prev) => !prev)}
          className={`px-3 py-1.5 text-xs font-semibold rounded ${isCombatMode ? 'bg-amber-500 hover:bg-amber-400 text-gray-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
          >
            {isCombatMode ? 'Exit Combat Mode' : 'Enter Combat Mode'}
          </button>
        {isDevModeEnabled && (
          <button
            type="button"
            onClick={() => setIsDevTurbo((prev) => !prev)}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${
              isDevTurbo ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white' : 'bg-fuchsia-400 hover:bg-fuchsia-300 text-gray-900'
            }`}
            aria-pressed={isDevTurbo}
          >
            {isDevTurbo ? 'Turbo Speed On' : 'Turbo Speed Off'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 text-white"
        >
          Exit 3D
        </button>
      </div>
    </div>
  );
};

export default ThreeDModal;
