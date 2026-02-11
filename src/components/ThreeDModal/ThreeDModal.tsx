import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BIOMES } from '../../constants';
import type { NPC, PlayerCharacter } from '../../types';
import { generateNPC, type NPCGenerationConfig } from '../../services/npcGenerator';
import { generateNPCResponse } from '../../services/geminiService';
import Scene3D from './Scene3D';
import type { SceneEntity } from './sceneEntities';
import { simpleHash } from '../../utils/spatial/submapUtils';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';

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
  onMove?: (direction: 'North' | 'South' | 'East' | 'West') => void;
  isDevModeEnabled?: boolean;
  devModelOverride?: string | null;
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
  onMove,
  isDevModeEnabled,
  devModelOverride = null,
}: ThreeDModalProps) => {
  const [showGrid, setShowGrid] = useState(false);
  const [isCombatMode, setIsCombatMode] = useState(false);
  const [isDashing, setIsDashing] = useState(false);
  const [renderQuality, setRenderQuality] = useState<'safe' | 'enhanced'>('enhanced');
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [playerSpeedPerRound, setPlayerSpeedPerRound] = useState(0);
  const [isDevTurbo, setIsDevTurbo] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [isHmrDisconnected, setIsHmrDisconnected] = useState(false);
  const [hoveredEntity, setHoveredEntity] = useState<SceneEntity | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SceneEntity | null>(null);
  const [interactionHint, setInteractionHint] = useState<string | null>(null);

  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [socialDraft, setSocialDraft] = useState('');
  const [isSocialThinking, setIsSocialThinking] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialLog, setSocialLog] = useState<Array<{ speaker: 'player' | 'npc' | 'system'; text: string }>>([]);

  const localNpcRegistryRef = useRef<Record<string, NPC>>({});

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

  const interactionTarget = selectedEntity ?? hoveredEntity;
  const interactionDistanceFt = useMemo(() => {
    if (!interactionTarget || !playerPosition) return null;
    return Math.hypot(playerPosition.x - interactionTarget.position.x, playerPosition.z - interactionTarget.position.z);
  }, [interactionTarget, playerPosition]);
  const canInteract = !!interactionTarget && interactionDistanceFt !== null && interactionDistanceFt <= interactionTarget.interactRadiusFt;

  const travelAvailability = useMemo(() => {
    return {
      West: true,
      East: true,
      North: true,
      South: true,
    };
  }, []);

  const getOrCreateLocalNpc = useCallback((entity: SceneEntity): NPC => {
    const cached = localNpcRegistryRef.current[entity.id];
    if (cached) return cached;

    const config: NPCGenerationConfig = {
      id: entity.id,
      role: 'civilian',
    };
    const generated = generateNPC(config);
    localNpcRegistryRef.current[entity.id] = generated;
    return generated;
  }, []);

  const closeSocial = useCallback(() => {
    setIsSocialOpen(false);
    setIsSocialThinking(false);
    setSocialError(null);
    setSocialDraft('');
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if (event.key === 'Escape') {
        event.preventDefault();
        if (isSocialOpen) {
          closeSocial();
          return;
        }
        onClose();
      }

      if (event.code === 'KeyE') {
        if (isEditableTarget) return;
        if (isSocialOpen) return;
        if (!interactionTarget) return;
        if (!canInteract) {
          setInteractionHint('Move closer to interact.');
          return;
        }

        if (interactionTarget.kind === 'npc') {
          const npc = getOrCreateLocalNpc(interactionTarget);
          setActiveNpcId(npc.id);
          setIsSocialOpen(true);
          setSocialError(null);
          setInteractionHint(null);

          setSocialLog((prev) => {
            const continuing = prev.length > 0 && activeNpcId === npc.id;
            if (continuing) return prev;
            return [{ speaker: 'system', text: `You approach ${npc.name} (${interactionTarget.label}).` }];
          });
          return;
        }

        setInteractionHint(`The ${interactionTarget.label} watches you warily.`);
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
  }, [activeNpcId, canInteract, closeSocial, getOrCreateLocalNpc, interactionTarget, isOpen, isSocialOpen, onClose]);

  useEffect(() => {
    if (!import.meta.hot) return;
    // Pause the render loop when the Vite dev server disconnects so the 3D
    // scene doesn't keep animating after HMR drops.
    import.meta.hot.on('vite:ws:disconnect', () => setIsHmrDisconnected(true));
    import.meta.hot.on('vite:ws:connect', () => setIsHmrDisconnected(false));
  }, []);

  if (!isOpen) return null;

  const effectivePlayerSpeed = isDevTurbo ? playerSpeed * 10 : playerSpeed;
  const biome = BIOMES[biomeId];
  const biomeLabel = biome
    ? `${biome.name}${biome.family ? ` (${biome.family}${biome.variant ? ` · ${biome.variant}` : ''})` : ''}`
    : `Biome: ${biomeId}`;
  const biomeColorStyle = biome?.rgbaColor ? { backgroundColor: biome.rgbaColor } : undefined;
  const activeNpc = activeNpcId ? localNpcRegistryRef.current[activeNpcId] ?? null : null;

  return (
    <div id={UI_ID.THREE_D_MODAL} data-testid={UI_ID.THREE_D_MODAL} className={`fixed inset-0 z-[${Z_INDEX.MODAL_IMMERSIVE_BACKGROUND}] bg-black`}>
      <div className="absolute inset-0">
        <Scene3D
          key={`${biomeId}:${submapSeed}`}
          biomeId={biomeId}
          gameTime={gameTime}
          playerSpeed={effectivePlayerSpeed}
          submapSeed={submapSeed}
          submapFootprintFt={SUBMAP_FOOTPRINT_FT}
          renderQuality={renderQuality}
          showGrid={showGrid}
          partyMembers={partyMembers}
          isCombatMode={isCombatMode}
          onPlayerPosition={setPlayerPosition}
          onPlayerSpeed={setPlayerSpeedPerRound}
          onFps={setFps}
          onEntityHover={setHoveredEntity}
          onEntitySelect={(entity) => {
            setSelectedEntity(entity);
            if (!entity) setInteractionHint(null);
          }}
          hoveredEntityId={hoveredEntity?.id ?? null}
          selectedEntityId={selectedEntity?.id ?? null}
          pauseRender={isHmrDisconnected}
        />
      </div>
      {isHmrDisconnected && (
        <div className={`absolute inset-0 z-[${Z_INDEX.MODAL_IMMERSIVE_CONTENT}] flex items-center justify-center bg-black/70 text-gray-100`}>
          <div className="rounded-lg bg-black/80 px-4 py-3 text-center text-sm shadow-lg">
            <div className="font-semibold">Dev server disconnected</div>
            <div>3D render paused until HMR reconnects.</div>
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 text-xs text-gray-100 bg-black/60 rounded px-3 py-2 space-y-1">
        <div className="font-semibold">3D Exploration Mode</div>
        <div>WASD move | Shift dash | Mouse orbit/zoom</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-200/90">Render:</span>
          <button
            type="button"
            className={`px-2 py-0.5 rounded border ${renderQuality === 'enhanced' ? 'bg-white/10 border-white/30' : 'bg-black/30 border-white/10 hover:bg-white/5'}`}
            onClick={() => setRenderQuality('enhanced')}
          >
            Enhanced
          </button>
          <button
            type="button"
            className={`px-2 py-0.5 rounded border ${renderQuality === 'safe' ? 'bg-white/10 border-white/30' : 'bg-black/30 border-white/10 hover:bg-white/5'}`}
            onClick={() => setRenderQuality('safe')}
          >
            Safe
          </button>
        </div>
        <div className="flex items-center gap-2">
          {biome && <span className="inline-block h-3 w-3 rounded-sm border border-white/40" style={biomeColorStyle} aria-hidden />}
          <span>{biomeLabel}</span>
        </div>
        <div>World seed: {worldSeed}</div>
        <div>World tile: ({parentWorldMapCoords.x}, {parentWorldMapCoords.y})</div>
        <div>Submap tile: ({playerSubmapCoords.x}, {playerSubmapCoords.y})</div>
        <div>Submap seed: {submapSeed}</div>
        <div>
          Speed: {playerSpeedPerRound.toFixed(0)} ft/round{isDashing && playerSpeedPerRound > 0 ? ' (Dashing)' : ''}
        </div>
        {playerPosition && (
          <div>
            Position: {playerPosition.x.toFixed(1)} ft, {playerPosition.z.toFixed(1)} ft
          </div>
        )}
        <div>FPS: {fps ?? "--"}</div>
      </div>
      {interactionTarget && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-100 bg-black/70 rounded px-4 py-2 space-y-1 pointer-events-none">
          <div className="font-semibold">
            {interactionTarget.kind === 'npc' ? 'NPC' : 'Creature'}: {interactionTarget.label}
          </div>
          <div>
            Distance: {interactionDistanceFt === null ? '--' : `${interactionDistanceFt.toFixed(0)} ft`}
            {canInteract ? ' - Press E to interact' : ' - Move closer'}
          </div>
          {interactionHint && <div className="text-gray-200">{interactionHint}</div>}
        </div>
      )}
      {onMove && (
        <div className={`absolute bottom-5 left-5 z-[${Z_INDEX.MODAL_IMMERSIVE_CONTENT}] text-xs text-gray-100 bg-black/70 rounded px-3 py-2 space-y-2`}>
          <div className="font-semibold">Travel To Adjacent Submap Tile</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700"
              disabled={!travelAvailability.North || isSocialOpen}
              onClick={() => {
                setSelectedEntity(null);
                setHoveredEntity(null);
                setInteractionHint(null);
                if (isSocialOpen) closeSocial();
                onMove('North');
              }}
            >
              North
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700"
              disabled={!travelAvailability.West || isSocialOpen}
              onClick={() => {
                setSelectedEntity(null);
                setHoveredEntity(null);
                setInteractionHint(null);
                if (isSocialOpen) closeSocial();
                onMove('West');
              }}
            >
              West
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700"
              disabled={!travelAvailability.East || isSocialOpen}
              onClick={() => {
                setSelectedEntity(null);
                setHoveredEntity(null);
                setInteractionHint(null);
                if (isSocialOpen) closeSocial();
                onMove('East');
              }}
            >
              East
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700"
              disabled={!travelAvailability.South || isSocialOpen}
              onClick={() => {
                setSelectedEntity(null);
                setHoveredEntity(null);
                setInteractionHint(null);
                if (isSocialOpen) closeSocial();
                onMove('South');
              }}
            >
              South
            </button>
          </div>
          <div className="text-[11px] text-gray-300">
            Use these to force a new tile seed without leaving 3D.
          </div>
        </div>
      )}
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

      {isSocialOpen && activeNpc && (
        <div className={`absolute inset-0 z-[${Z_INDEX.MODAL_IMMERSIVE_CONTENT}] flex items-end justify-center p-4`}>
          <div className="w-full max-w-3xl rounded-lg border border-stone-700 bg-stone-950/95 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-stone-800 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-amber-400 truncate">{activeNpc.name}</div>
                <div className="text-[11px] text-stone-400 truncate">{activeNpc.baseDescription || 'A traveler on the road.'}</div>
              </div>
              <button
                type="button"
                onClick={closeSocial}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-stone-700 hover:bg-stone-600 text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto px-4 py-3 space-y-2 text-sm">
              {socialLog.map((entry, idx) => (
                <div
                  key={`${entry.speaker}-${idx}`}
                  className={entry.speaker === 'player' ? 'text-sky-100' : entry.speaker === 'npc' ? 'text-amber-100' : 'text-stone-300'}
                >
                  <span className="font-semibold">
                    {entry.speaker === 'player' ? 'You' : entry.speaker === 'npc' ? activeNpc.name : 'System'}:
                  </span>{' '}
                  <span>{entry.text}</span>
                </div>
              ))}
              {socialError && <div className="text-red-200">Error: {socialError}</div>}
            </div>

            <form
              className="border-t border-stone-800 px-4 py-3 flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!socialDraft.trim() || isSocialThinking) return;

                const playerText = socialDraft.trim();
                setSocialDraft('');
                setSocialError(null);
                setIsSocialThinking(true);
                setSocialLog((prev) => [...prev, { speaker: 'player', text: playerText }]);

                try {
                  const npcContext = JSON.stringify({
                    biomeId,
                    gameTime: gameTime.toISOString(),
                    promptSeed: activeNpc.dialoguePromptSeed ?? null,
                    recentConversation: socialLog.slice(-6),
                  });
                  const result = await generateNPCResponse(activeNpc.name, playerText, npcContext, devModelOverride);
                  const reply = result.data?.text ?? result.error ?? '...';
                  setSocialLog((prev) => [...prev, { speaker: 'npc', text: reply }]);
                } catch (err) {
                  setSocialError(err instanceof Error ? err.message : String(err));
                } finally {
                  setIsSocialThinking(false);
                }
              }}
            >
              <input
                value={socialDraft}
                onChange={(e) => setSocialDraft(e.target.value)}
                className="flex-1 rounded bg-stone-900 border border-stone-700 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                placeholder={isSocialThinking ? 'Thinking...' : 'Say something...'}
                disabled={isSocialThinking}
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-60 disabled:hover:bg-amber-500"
                disabled={isSocialThinking || !socialDraft.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeDModal;
