/** The globe is an inspection view of the same atlas, loaded only on request.
 * AtlasLayers supplies its artwork and mapCoordinates supplies its footprint.
 * Uncharted regions stay distinct from ocean. Travel remains on the flat map.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/10/2026, 14:37:32
 * Dependents: components/Worldforge/AtlasSvgView.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import AtlasLayers from './AtlasLayers';
import type { AtlasSvgModel } from './atlasSvg';
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { globeDirection, globeRegion } from './atlasGlobe';
import { Button } from '../ui/Button';

interface Props {
  atlas: FmgAtlasResult;
  model: AtlasSvgModel;
  visible: Record<string, boolean>;
  width: number;
  height: number;
}
type Viewer = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  material: THREE.MeshBasicMaterial;
  render: () => void;
};
// The globe controls use the shared Button style. The old inline buttonStyle
// object served only these three buttons; min-h-11 min-w-11 keep its 44 px target.

export default function AtlasGlobeView({ atlas, model, visible, width, height }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const artwork = useRef<SVGSVGElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const region = globeRegion(atlas.mapCoordinates);
  const reset = () => {
    const v = viewer.current;
    if (!v || !region) return;
    v.camera.position.set(...globeDirection(region.latitude, region.longitude)).multiplyScalar(3.4 / Math.min(1, v.camera.aspect));
    v.controls.target.set(0, 0, 0);
    v.controls.update();
    v.render();
  };
  const zoom = (factor: number) => {
    const v = viewer.current;
    if (!v) return;
    v.camera.position.setLength(THREE.MathUtils.clamp(v.camera.position.length() * factor, 1.3, v.controls.maxDistance));
    v.controls.update();
    v.render();
  };

  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError('Globe rendering is unavailable here. You can keep using Map.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x081321, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 20);
    camera.position.set(0, 0, 3.4);
    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    scene.add(new THREE.Mesh(geometry, material));
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 1.3;
    controls.maxDistance = 7;
    controls.rotateSpeed = 0.65;
    const render = () => {
      renderer.render(scene, camera);
      // Small camera receipt makes browser checks independent of pixel colors.
      renderer.domElement.dataset.camera = camera.position.toArray().join(',');
    };
    controls.addEventListener('change', render);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'World globe. Drag or use arrow keys to rotate. Scroll or use plus and minus to zoom. Home resets.');
    canvas.style.touchAction = 'none';
    const lost = (event: Event) => { event.preventDefault(); setError('The globe graphics connection was lost. Switch to Map and back to retry.'); };
    canvas.addEventListener('webglcontextlost', lost);
    host.current.appendChild(canvas);
    viewer.current = { renderer, camera, controls, material, render };
    return () => {
      viewer.current = null;
      canvas.removeEventListener('webglcontextlost', lost);
      controls.dispose();
      material.map?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.renderer.setSize(Math.max(1, width), Math.max(1, height));
    const aspect = Math.max(1, width) / Math.max(1, height);
    // Preserve relative zoom when a narrow viewport needs more camera distance.
    v.camera.position.multiplyScalar(Math.min(1, v.camera.aspect) / Math.min(1, aspect));
    v.camera.aspect = aspect;
    v.controls.maxDistance = 7 / Math.min(1, aspect);
    v.camera.updateProjectionMatrix();
    v.render();
  }, [width, height]);

  useEffect(() => { reset(); }, [atlas]);

  useEffect(() => {
    const v = viewer.current;
    if (!v || !artwork.current || !region) return;
    setReady(false);
    const svg = artwork.current.cloneNode(true) as SVGSVGElement;
    svg.removeAttribute('style');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const image = new Image();
    let canceled = false;
    image.onload = () => {
      if (canceled) return;
      const canvas = document.createElement('canvas');
      canvas.width = 2048; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setError('Could not draw the globe. You can keep using Map.'); return; }
      // A slate graticule denotes ungenerated territory, never invented sea.
      ctx.fillStyle = '#253445'; ctx.fillRect(0, 0, 2048, 1024);
      ctx.strokeStyle = '#425466'; ctx.lineWidth = 1;
      for (let x = 0; x <= 2048; x += 2048 / 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
      for (let y = 0; y <= 1024; y += 1024 / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke(); }
      ctx.drawImage(image, region.x * 2048, region.y * 1024, region.width * 2048, region.height * 1024);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, v.renderer.capabilities.getMaxAnisotropy());
      v.material.map?.dispose();
      v.material.map = texture;
      v.material.needsUpdate = true;
      v.render();
      setReady(true);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => { URL.revokeObjectURL(url); if (!canceled) setError('Could not load globe artwork. You can keep using Map.'); };
    image.src = url;
    return () => {
      canceled = true;
      // StrictMode may tear down an effect before the browser reads its blob.
      // Let that decode finish before revoking, while forbidding stale uploads.
      image.onload = image.onerror = () => URL.revokeObjectURL(url);
      if (image.complete) URL.revokeObjectURL(url);
    };
  }, [atlas, model, visible]);

  return <div data-testid="atlas-globe" data-ready={ready} style={{ position: 'absolute', inset: 0, background: '#081321' }}>
    <div ref={host} onKeyDown={(event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target !== viewer.current?.renderer.domElement) return;
      const v = viewer.current;
      if (!v) return;
      if (event.key === 'Home') { event.preventDefault(); reset(); }
      else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? 1.2 : 1 / 1.2); }
      else if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        const p = new THREE.Spherical().setFromVector3(v.camera.position);
        p.theta += event.key === 'ArrowLeft' ? 0.12 : event.key === 'ArrowRight' ? -0.12 : 0;
        p.phi += event.key === 'ArrowUp' ? -0.12 : event.key === 'ArrowDown' ? 0.12 : 0;
        p.makeSafe(); v.camera.position.setFromSpherical(p); v.controls.update(); v.render();
      }
    }} />
    {/* This offscreen SVG reuses canonical artwork; it never receives input. */}
    <svg ref={artwork} aria-hidden="true" width={2048} height={2048 * model.height / model.width} viewBox={`0 0 ${model.width} ${model.height}`} style={{ display: 'none' }}>
      <defs><pattern id="danger-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,6L6,0" stroke="#9f1239" strokeWidth="1" /></pattern></defs>
      <rect width={model.width} height={model.height} fill="#1f4a73" />
      <AtlasLayers model={model} visible={visible} softenActive={false} />
      {visible.burgs ? model.burgs?.map(b => <circle key={b.id} cx={b.x} cy={b.y} r={b.capital ? 2.5 : 1} fill="#fff4ca" stroke="#352819" strokeWidth={0.6} />) : null}
      {visible.labels ? model.labels?.filter(l => l.kind === 'state').map((l, i) => <text key={i} x={l.x} y={l.y} textAnchor="middle" fontFamily="Georgia, serif" fontSize={12} fill="#251b32" stroke="#fff6df" strokeWidth={2} paintOrder="stroke">{l.text}</text>) : null}
    </svg>
    <div style={{ position: 'absolute', top: 62, left: 8, display: 'flex', gap: 4 }}>
      <Button type="button" variant="secondary" size="sm" className="min-h-11 min-w-11" aria-label="Zoom globe in" onClick={() => zoom(1 / 1.2)}>+</Button>
      <Button type="button" variant="secondary" size="sm" className="min-h-11 min-w-11" aria-label="Zoom globe out" onClick={() => zoom(1.2)}>−</Button>
      <Button type="button" variant="secondary" size="sm" className="min-h-11 min-w-11" onClick={reset}>Reset globe</Button>
    </div>
    <p role="status" style={{ position: 'absolute', bottom: 64, left: 12, right: 12, margin: 0, textAlign: 'center', color: '#cbd5e1', fontSize: 11, pointerEvents: 'none' }}>
      {error ?? (!region ? 'This atlas has no valid globe coordinates. Switch to Map.' : !ready ? 'Drawing globe…' : 'Drag to rotate · Scroll to zoom · Slate grid: uncharted · Select destinations in Map')}
    </p>
  </div>;
}
