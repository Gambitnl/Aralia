// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 18:36:02
 * Dependents: components/BattleMap/pixi/PixiBoardPrototype.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// src/components/BattleMap/pixi/PixiBattleBoard.tsx
/**
 * @file PixiBattleBoard.tsx
 * Deliverable-1 prototype of the single-scene combat renderer (next-gen
 * combat map spec, Pillar 1). Renders ground + tokens + fog in one PixiJS v8
 * scene, WebGPU-first. Display only: no clicks, no targeting — the DOM board
 * remains the playable surface until the migration flips.
 */

// ============================================================================
// Imports
// ============================================================================
// Pixi owns the single rendered scene. Shared battle-map modules supply the
// same terrain, fog, camera, and token decisions used by the existing board.
// ============================================================================
import React, { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { BattleMapData, CombatCharacter, LightLevel } from '../../../types/combat';
import { TILE_SIZE_PX } from '../../../config/mapConfig';
import { loadGroundTextures, paintGround } from '../groundPainter';
import {
  blurFogAlphaGrid,
  buildFogAlphaGrid,
  FOG_TINT,
  FOG_TINT_WATER,
} from '../fogModel';
import { CameraView, fitView, groundResolutionFor, panBy, zoomAtCursor } from './cameraMath';
import { buildTokenViewModel } from './tokenViewModel';

// ============================================================================
// Public Board Contract and Internal Token Shape
// ============================================================================
// Combat supplies only the mechanical map, visibility, and character state.
// The renderer keeps its Pixi objects private so the default board is untouched.
// ============================================================================
export interface PixiBattleBoardProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  visibleTiles: Set<string>;
  getLightLevel: (tileId: string) => LightLevel;
  currentCharacterId: string | null;
  selectedCharacterId: string | null;
}

// New positions ease into place instead of snapping. Six blend steps per
// second keeps ordinary movement readable without pretending to be final
// walk-cycle animation; cinematic movement belongs to the later living board.
const GLIDE_PER_S = 6;

/** One rendered combatant: container with ring, label, HP arc. */
interface TokenNode {
  root: Container;
  ring: Graphics;
  hpArc: Graphics;
  label: Text;
  targetX: number;
  targetY: number;
  /** Last-drawn visual state; skips Graphics rebuilds when nothing changed. */
  drawKey: string;
}

// ============================================================================
// Prototype Renderer
// ============================================================================
// One long-lived Pixi scene paints the ground, synchronizes tokens and fog from
// live combat props, and owns the prototype camera until the battlefield changes.
// ============================================================================
const PixiBattleBoard: React.FC<PixiBattleBoardProps> = ({
  mapData, characters, visibleTiles, getLightLevel, currentCharacterId, selectedCharacterId,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  // Live prop mirror lets the one long-lived Pixi effect consume fresh combat
  // state without rebuilding the renderer whenever a token or sight line moves.
  const propsRef = useRef({
    characters,
    visibleTiles,
    getLightLevel,
    currentCharacterId,
    selectedCharacterId,
    fogRevision: 0,
  });

  // React prop changes are the cheap boundary for fog work. After each commit,
  // changed visibility or light inputs advance a numeric revision; the Pixi
  // ticker then compares only that number before considering the two-pass blur.
  useEffect(() => {
    const previous = propsRef.current;
    const fogInputsChanged = previous.visibleTiles !== visibleTiles
      || previous.getLightLevel !== getLightLevel;
    propsRef.current = {
      characters,
      visibleTiles,
      getLightLevel,
      currentCharacterId,
      selectedCharacterId,
      fogRevision: previous.fogRevision + (fogInputsChanged ? 1 : 0),
    };
  }, [characters, currentCharacterId, getLightLevel, selectedCharacterId, visibleTiles]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;
    const app = new Application();
    const tokens = new Map<string, TokenNode>();
    let view: CameraView = { x: 0, y: 0, zoom: 1 };
    let groundRes = 0;
    let fogKey = '';
    let renderedFogRevision = -1;
    let fogRenderCount = 0;

    const W = mapData.dimensions.width;
    const H = mapData.dimensions.height;
    const mapPxW = W * TILE_SIZE_PX;
    const mapPxH = H * TILE_SIZE_PX;

    const world = new Container();
    const groundLayer = new Container();
    const tokenLayer = new Container();
    const fogLayer = new Container();
    world.addChild(groundLayer, tokenLayer, fogLayer);

    const applyCamera = () => {
      world.scale.set(view.zoom);
      world.position.set(-view.x * view.zoom, -view.y * view.zoom);
    };

    const rasterizeGround = async (res: number) => {
      const textures = await loadGroundTextures(mapData.theme);
      if (destroyed) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(mapPxW * res);
      canvas.height = Math.round(mapPxH * res);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      paintGround(ctx, mapData, TILE_SIZE_PX, textures, res);
      const sprite = new Sprite(Texture.from(canvas));
      sprite.width = mapPxW;
      sprite.height = mapPxH;
      // Free the old plate's GPU texture AND its canvas-backed source.
      groundLayer.removeChildren().forEach((c) => c.destroy({ texture: true, textureSource: true }));
      groundLayer.addChild(sprite);
      groundRes = res;
    };

    const redrawFogIfChanged = () => {
      const {
        visibleTiles: vis,
        getLightLevel: light,
        fogRevision,
      } = propsRef.current;

      // Animation frames normally stop here. Mark the revision before doing
      // canvas work so an unavailable context cannot turn a failed draw into an
      // expensive blur retry on every following ticker frame.
      if (fogRevision === renderedFogRevision) return;
      renderedFogRevision = fogRevision;

      // Use the same two-pass penumbra as the DOM fog canvas. Later look work
      // softened diagonal sight boundaries there; keeping the raw grid here
      // would make the two renderers disagree at the D1 eyeball gate.
      const grid = blurFogAlphaGrid(
        buildFogAlphaGrid(mapData, vis, light),
        2,
      );
      fogKey = grid.alphas.join(',');

      // The shared two-pass blur creates the penumbra on the one-pixel-per-tile
      // grid; linear GPU scaling then keeps that softened grid smooth at map size.
      const mini = document.createElement('canvas');
      mini.width = grid.width;
      mini.height = grid.height;
      const mctx = mini.getContext('2d');
      if (!mctx) return;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const a = grid.alphas[y * grid.width + x];
          if (a <= 0) continue;
          // Water keeps its blue family under fog instead of turning muddy,
          // matching the shared look decision already used by the DOM canvas.
          const tint =
            mapData.tiles.get(`${x}-${y}`)?.terrain === 'water'
              ? FOG_TINT_WATER
              : FOG_TINT;
          mctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${a})`;
          mctx.fillRect(x, y, 1, 1);
        }
      }
      const tex = Texture.from(mini);
      tex.source.scaleMode = 'linear';
      const sprite = new Sprite(tex);
      sprite.width = mapPxW;
      sprite.height = mapPxH;
      fogLayer.removeChildren().forEach((c) => c.destroy({ texture: true, textureSource: true }));
      fogLayer.addChild(sprite);
      fogRenderCount += 1;
    };

    const syncTokens = () => {
      const { characters: chars, currentCharacterId: turnId, selectedCharacterId: selId } = propsRef.current;
      const seen = new Set<string>();
      chars.forEach((ch) => {
        seen.add(ch.id);
        const vm = buildTokenViewModel(ch, { isSelected: ch.id === selId, isTurn: ch.id === turnId });
        const size = TILE_SIZE_PX * vm.sizeMultiplier;
        const r = size * 0.4;
        let node = tokens.get(ch.id);
        if (!node) {
          const root = new Container();
          const ring = new Graphics();
          const hpArc = new Graphics();
          const label = new Text({
            text: vm.label,
            style: { fill: 0xffffff, fontSize: r, fontWeight: '700', fontFamily: 'sans-serif' },
          });
          label.anchor.set(0.5);
          root.addChild(ring, hpArc, label);
          tokenLayer.addChild(root);
          node = { root, ring, hpArc, label, targetX: 0, targetY: 0, drawKey: '' };
          tokens.set(ch.id, node);
          // First appearance: snap, later moves glide.
          node.root.position.set(
            ch.position.x * TILE_SIZE_PX + size / 2,
            ch.position.y * TILE_SIZE_PX + size / 2,
          );
        }
        node.targetX = ch.position.x * TILE_SIZE_PX + size / 2;
        node.targetY = ch.position.y * TILE_SIZE_PX + size / 2;
        // Only rebuild the vector graphics when the visual state changed —
        // syncTokens runs every frame and Graphics rebuilds are not free.
        const drawKey = `${vm.ringColor}|${vm.hpPct}|${vm.hpColor}|${vm.label}|${vm.isDown}|${size}`;
        if (drawKey === node.drawKey) return;
        node.drawKey = drawKey;
        node.root.alpha = vm.isDown ? 0.35 : 1;
        node.ring.clear()
          .circle(0, 0, r).fill(0x1f2937)
          .stroke({ width: 3, color: vm.ringColor })
          .circle(0, 0, r + 2.5).stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 });
        node.hpArc.clear();
        if (vm.hpPct < 1 && vm.hpPct > 0) {
          node.hpArc
            .arc(0, 0, r + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * vm.hpPct)
            .stroke({ width: 2.4, color: vm.hpColor, cap: 'round' });
        }
        node.label.text = vm.label;
      });
      // Remove tokens for combatants no longer present.
      tokens.forEach((node, id) => {
        if (seen.has(id)) return;
        // context: true is required or the owned GraphicsContext survives a
        // children-only destroy and strands its GPU data until full unmount.
        node.root.destroy({ children: true, context: true, texture: true, textureSource: true });
        tokens.delete(id);
      });
    };

    let raf = 0;
    (async () => {
      // Camera math has no zero-size guards (NaN would propagate), and Pixi
      // dislikes a 0×0 backing store — wait until the host has real bounds.
      while (!destroyed && (host.clientWidth === 0 || host.clientHeight === 0)) {
        await new Promise<void>((resolve) => { raf = requestAnimationFrame(() => resolve()); });
      }
      if (destroyed) return;

      await app.init({
        preference: 'webgpu',
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true, { children: true, texture: true, textureSource: true }); return; }
      host.appendChild(app.canvas);
      app.stage.addChild(world);

      view = fitView(mapPxW, mapPxH, host.clientWidth, host.clientHeight);
      applyCamera();
      await rasterizeGround(groundResolutionFor(view.zoom, window.devicePixelRatio || 1, mapPxW, mapPxH));
      if (destroyed) return;
      redrawFogIfChanged();
      syncTokens();

      // The ticker animates tokens continuously, but fog only crosses its cheap
      // numeric revision gate when React has supplied changed visibility inputs.
      app.ticker.add((tick) => {
        syncTokens();
        redrawFogIfChanged();
        const dt = Math.min(0.1, tick.deltaMS / 1000);
        tokens.forEach((node) => {
          node.root.x += (node.targetX - node.root.x) * Math.min(1, GLIDE_PER_S * dt);
          node.root.y += (node.targetY - node.root.y) * Math.min(1, GLIDE_PER_S * dt);
        });
      });

      // Wheel zoom anchored at the cursor; drag to pan.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = host.getBoundingClientRect();
        view = zoomAtCursor(view, e.deltaY < 0 ? 1.15 : 1 / 1.15, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        applyCamera();
        // Re-rasterize the ground when the needed density steps up past what
        // we last painted — this is the "crisp at any zoom" proof.
        const wanted = groundResolutionFor(view.zoom, window.devicePixelRatio || 1, mapPxW, mapPxH);
        if (wanted > groundRes * 1.4) void rasterizeGround(wanted);
      };
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        view = panBy(view, e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
        applyCamera();
      };
      const onUp = () => { dragging = false; };
      host.addEventListener('wheel', onWheel, { passive: false });
      host.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);

      const cleanupInput = () => {
        host.removeEventListener('wheel', onWheel);
        host.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      // Stash for the effect cleanup below.
      (app as unknown as { __cleanupInput?: () => void }).__cleanupInput = cleanupInput;

      // Debug handle for headless capture scripts (same pattern as the 3D
      // board's window.__bm3dCam): deterministic camera framing + state probe.
      // This component only mounts under the ?pixiboard=1 dev flag.
      (window as unknown as { __pixiBoard?: unknown }).__pixiBoard = {
        state: () => ({
          zoom: view.zoom,
          groundRes,
          rendererType: app.renderer.name,
          tokens: [...tokens.entries()].map(([id, n]) => ({ id, x: n.root.x, y: n.root.y, visible: n.root.visible, alpha: n.root.alpha })),
          fogDarkTiles: fogKey === '' ? -1 : fogKey.split(',').filter((a) => Number(a) > 0).length,
          fogRevision: renderedFogRevision,
          fogRenderCount,
        }),
        // World-px centers of water tiles, so capture scripts can frame a
        // shoreline without knowing the map roll.
        waterCenters: () => {
          const out: Array<{ x: number; y: number }> = [];
          mapData.tiles.forEach((t) => {
            if (t.terrain === 'water') out.push({
              x: t.coordinates.x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
              y: t.coordinates.y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            });
          });
          return out;
        },
        frame: (wx: number, wy: number, zoom: number) => {
          view = {
            zoom,
            x: wx - host.clientWidth / zoom / 2,
            y: wy - host.clientHeight / zoom / 2,
          };
          applyCamera();
          const wanted = groundResolutionFor(zoom, window.devicePixelRatio || 1, mapPxW, mapPxH);
          if (wanted > groundRes * 1.4) void rasterizeGround(wanted);
        },
      };
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      (app as unknown as { __cleanupInput?: () => void }).__cleanupInput?.();
      // Guard: init may not have finished when unmounting under StrictMode —
      // `renderer` is only assigned once init resolves, and the async body
      // above handles its own teardown in that case.
      if (app.renderer) app.destroy(true, { children: true, texture: true, textureSource: true });
    };
    // The board is rebuilt only for a new battlefield; live combat state flows
    // through propsRef + the ticker.
  }, [mapData]);

  return (
    <div
      ref={hostRef}
      data-testid="pixi-battle-board"
      className="relative h-full w-full overflow-hidden rounded-xl border-2 border-amber-800/50 bg-slate-950/70"
      aria-label="Battle map (prototype renderer)"
      role="img"
    />
  );
};

// ============================================================================
// Default Export
// ============================================================================
// CombatView lazy-loads this renderer only through the ?pixiboard=1 harness.
// ============================================================================
export default PixiBattleBoard;
