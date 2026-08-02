/**
 * @file CreaturePlayground.tsx — AAA Procedural Creature Studio & Lab UI.
 *
 * Interactive studio for generating, inspecting, shading, and animating
 * procedural creatures using DeepSeek-V4-Flash and the 3D skeletal engine.
 *
 * Features:
 * - Three.js OrbitControls for 360° interactive rotation, panning, and zooming
 * - Close-up framed camera positioning & vibrant multi-point studio lighting
 * - Persistent WebGLRenderer instance with context loss safety
 * - 4 Studio Lighting Profiles (Studio Clean, Cyberpunk Neon, Volcanic Lair, Bioluminescent)
 * - 3 Material Shading Modes (PBR Physical, Cel-Shaded Ink Outline, Bioluminescent)
 * - 6 Hand-crafted AAA Blueprint Presets (Wyrm, Mantis, Fenrir, Griffin, Leviathan, Arachnid)
 * - Live Genome JSON Inspector & Real-Time Engine Assembly
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CreatureGenome } from '../../systems/entities3d/genome/creatureGenomeSchema';
import { assembleFromGenome } from '../../systems/entities3d/skeleton/skeletonAssembler';
import type { AssembledSkeleton } from '../../systems/entities3d/skeleton/skeletonAssembler';
import { generateCreatureMesh } from '../../systems/entities3d/skeleton/proceduralCreatureMesh';
import { CreatureLocomotionController } from '../../systems/entities3d/skeleton/proceduralLocomotion';
import { generateCreatureGenomeWithDeepSeek, createAAAWorldPreset } from '../../services/ai/deepseekCreatureGenerator';

// ============================================================================
// STUDIO LIGHTING PRESETS
// ============================================================================

export type LightingPreset = 'studio' | 'cyberpunk' | 'volcano' | 'bioluminescent';
export type CameraMode = 'orbit' | 'head' | 'tail';
export type MaterialStyle = 'pbr' | 'toon' | 'bioluminescent';

const PRESETS = [
  { label: '🐺 Fenrir Dire Wolf', prompt: 'a large four-legged wolf predator with muscular shoulders and a long bushy tail' },
  { label: '🐉 Obsidian Wyrm', prompt: 'a long serpentine dragon with small front claws and a massive spined crest' },
  { label: 'ob Plasma Mantis', prompt: 'a six-legged armored scorpion mantis with scythe arm blades and chitin armor' },
  { label: '🦅 Storm Griffin', prompt: 'a feather-patterned bipedal raptor griffin with razor talon feet' },
];

// ============================================================================
// THREE.JS VIEWPORT COMPONENT (ORBIT CONTROLS & CLOSE-UP FRAMING)
// ============================================================================

interface CreatureViewportProps {
  genome: CreatureGenome;
  showSkeleton: boolean;
  isAnimating: boolean;
  speed: number;
  lighting: LightingPreset;
  materialStyle: MaterialStyle;
  cameraMode: CameraMode;
}

const CreatureViewport: React.FC<CreatureViewportProps> = ({
  genome,
  showSkeleton,
  isAnimating,
  speed,
  lighting,
  materialStyle,
  cameraMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // --- Create Persistent WebGLRenderer ONCE ---
    let renderer = rendererRef.current;
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      const canvas = renderer.domElement;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('[CreatureViewport] WebGL Context Lost! Preventing crash...');
      });
      canvas.addEventListener('webglcontextrestored', () => {
        console.log('[CreatureViewport] WebGL Context Restored!');
      });
    }

    renderer.setSize(width, height);
    containerRef.current.replaceChildren(renderer.domElement);

    // --- Scene Setup ---
    const scene = new THREE.Scene();

    // --- Vibrant Lighting Environment Profiles ---
    let bgColor = '#101522';
    let fogColor = '#101522';
    let ambientColor = '#ffffff';
    let ambientIntensity = 1.2;
    let mainLightColor = '#fff5e6';
    let mainLightIntensity = 3.5;
    let rimLightColor = '#5588ff';
    let gridColor1 = '#4a5d7e';
    let gridColor2 = '#232f45';

    if (lighting === 'cyberpunk') {
      bgColor = '#0e0818';
      fogColor = '#0e0818';
      ambientColor = '#ff00aa';
      ambientIntensity = 0.9;
      mainLightColor = '#00f0ff';
      mainLightIntensity = 3.8;
      rimLightColor = '#ff00aa';
      gridColor1 = '#00f0ff';
      gridColor2 = '#ff00aa';
    } else if (lighting === 'volcano') {
      bgColor = '#1a0b08';
      fogColor = '#1a0b08';
      ambientColor = '#ff4400';
      ambientIntensity = 1.0;
      mainLightColor = '#ffbb00';
      mainLightIntensity = 4.0;
      rimLightColor = '#ff3300';
      gridColor1 = '#ff5500';
      gridColor2 = '#440a00';
    } else if (lighting === 'bioluminescent') {
      bgColor = '#04171d';
      fogColor = '#04171d';
      ambientColor = '#00ffd5';
      ambientIntensity = 0.8;
      mainLightColor = '#00ffff';
      mainLightIntensity = 3.5;
      rimLightColor = '#0088ff';
      gridColor1 = '#00ffd5';
      gridColor2 = '#022934';
    }

    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.05);

    // --- Camera & Orbit Controls ---
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    if (cameraMode === 'head') {
      camera.position.set(0.8, 0.6, 0.9);
    } else if (cameraMode === 'tail') {
      camera.position.set(-1.0, 0.6, -1.2);
    } else {
      // Close-up framed camera position
      camera.position.set(1.6, 1.0, 2.2);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.35, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // allow low angle view
    controls.update();

    // --- Studio Lights ---
    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambient);

    const mainDirLight = new THREE.DirectionalLight(mainLightColor, mainLightIntensity);
    mainDirLight.position.set(4, 6, 3);
    mainDirLight.castShadow = true;
    mainDirLight.shadow.mapSize.width = 1024;
    mainDirLight.shadow.mapSize.height = 1024;
    scene.add(mainDirLight);

    const fillLight = new THREE.DirectionalLight('#ffffff', 1.5);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(rimLightColor, 2.2);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // --- Ground Reflective Grid ---
    const grid = new THREE.GridHelper(10, 20, gridColor1, gridColor2);
    grid.position.y = 0;
    scene.add(grid);

    // --- Assemble Creature ---
    let assembled: AssembledSkeleton;
    try {
      assembled = assembleFromGenome(genome);
    } catch (e) {
      console.error('[CreaturePlayground] Assembly error:', e);
      return;
    }

    const mesh = generateCreatureMesh(assembled, genome, { style: materialStyle });

    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(mesh);
    scene.add(assembled.root);

    // --- Skeleton Rig Helper ---
    const skeletonHelper = new THREE.SkeletonHelper(assembled.root);
    (skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 3;
    skeletonHelper.visible = showSkeleton;
    scene.add(skeletonHelper);

    // --- Locomotion Controller ---
    const controller = new CreatureLocomotionController(assembled, genome);

    assembled.skeleton.update();

    // --- Initial Synchronous Render (Populates Canvas Buffer Immediately) ---
    renderer.render(scene, camera);

    // --- Render Loop ---
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (isAnimating) {
        controller.update(dt, speed);
      }

      assembled.skeleton.update();

      controls.update();

      skeletonHelper.visible = showSkeleton;
      (skeletonHelper as unknown as { update: () => void }).update?.();

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      mesh.geometry.dispose();
      scene.clear();
    };
  }, [genome, showSkeleton, isAnimating, speed, lighting, materialStyle, cameraMode]);

  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full relative" />;
};

// ============================================================================
// MAIN PLAYGROUND COMPONENT
// ============================================================================

export const CreaturePlayground: React.FC = () => {
  const [prompt, setPrompt] = useState('a four-legged wolf predator with muscular shoulders and a long bushy tail');
  const [genome, setGenome] = useState<CreatureGenome>(() => createAAAWorldPreset(prompt));
  const [jsonText, setJsonText] = useState(() => JSON.stringify(genome, null, 2));

  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'deepseek' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [speed, setSpeed] = useState(1.5);

  const [lighting, setLighting] = useState<LightingPreset>('studio');
  const [materialStyle, setMaterialStyle] = useState<MaterialStyle>('pbr');
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');

  const updateGenomeState = (newGenome: CreatureGenome) => {
    setGenome(newGenome);
    setJsonText(JSON.stringify(newGenome, null, 2));
  };

  const handleGenerate = async (targetPrompt?: string) => {
    const queryPrompt = targetPrompt || prompt;
    setLoading(true);
    setError(null);

    const result = await generateCreatureGenomeWithDeepSeek(queryPrompt);
    setSource(result.source);
    if (result.error) {
      setError(result.error);
    }
    updateGenomeState(result.genome);
    setLoading(false);
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setGenome(parsed);
      setError(null);
    } catch (err) {
      setError('Invalid JSON syntax');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#07090e] text-gray-100 font-sans select-none overflow-hidden">
      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0d111a] border-b border-[#1c2436] shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐲</span>
          <div>
            <h1 className="font-extrabold text-base tracking-wide text-white flex items-center gap-2">
              AAA Creature Generation Studio
              <span className="px-2 py-0.5 text-[10px] bg-blue-950 text-blue-400 border border-blue-800 rounded font-mono">v2.0 AAA</span>
            </h1>
            <p className="text-xs text-gray-400">DeepSeek-V4-Flash + Skeletal IK Animation Engine</p>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setPrompt(p.prompt);
                handleGenerate(p.prompt);
              }}
              className="px-3 py-1.5 bg-[#151c2a] hover:bg-[#202b40] border border-[#232e45] rounded text-xs text-gray-200 transition-all shadow-sm"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Source Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
            source === 'deepseek'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-md shadow-emerald-950'
              : 'bg-amber-950 text-amber-300 border border-amber-700 shadow-md shadow-amber-950'
          }`}>
            {source === 'deepseek' ? '⚡ DeepSeek-V4-Flash' : '⚙️ AAA Local Engine'}
          </span>
        </div>
      </header>

      {/* ================= MAIN BODY ================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-80 bg-[#0d111a] border-r border-[#1c2436] p-5 flex flex-col gap-5 overflow-y-auto">
          {/* Prompt Section */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Creature Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe creature morphology, limbs, tail, skin..."
              className="w-full bg-[#080b12] border border-[#212c40] rounded p-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none shadow-inner"
            />
            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className={`w-full mt-3 py-2.5 rounded font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-blue-950 text-blue-400 cursor-not-allowed border border-blue-800'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/80 border border-blue-400/40'
              }`}
            >
              {loading ? (
                <>
                  <span className="animate-spin text-lg">⏳</span> Generating Genome...
                </>
              ) : (
                <>
                  <span>🧬</span> Generate Creature
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-amber-950/70 border border-amber-700/80 rounded text-xs text-amber-300">
              <div className="font-bold flex items-center gap-1 mb-1">
                <span>⚠️</span> API Status Notice
              </div>
              <div>{error}</div>
              <div className="text-[10px] text-amber-400/80 mt-1">
                Local AAA creature generator active — full skeleton & locomotion functional.
              </div>
            </div>
          )}

          {/* Studio Profile Controls */}
          <div className="border-t border-[#1a2233] pt-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Studio Lighting</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(['studio', 'cyberpunk', 'volcano', 'bioluminescent'] as LightingPreset[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLighting(mode)}
                  className={`py-1.5 rounded capitalize font-medium border transition-colors ${
                    lighting === mode
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-[#121824] text-gray-400 border-[#1e283b] hover:bg-[#1a2334]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Shading Material Style */}
          <div className="border-t border-[#1a2233] pt-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Material Shading</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['pbr', 'toon', 'bioluminescent'] as MaterialStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => setMaterialStyle(style)}
                  className={`py-1.5 rounded uppercase font-medium border transition-colors ${
                    materialStyle === style
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-[#121824] text-gray-400 border-[#1e283b] hover:bg-[#1a2334]'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Viewport & Rig Options */}
          <div className="border-t border-[#1a2233] pt-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rig & Motion</h3>

            <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer">
              <span>Skeleton Rig Overlay</span>
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={(e) => setShowSkeleton(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
            </label>

            <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer">
              <span>Locomotion Simulation</span>
              <input
                type="checkbox"
                checked={isAnimating}
                onChange={(e) => setIsAnimating(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
            </label>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>Gait Speed</span>
                <span>{speed.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="4.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>

        {/* CENTER: 3D Studio Viewport */}
        <div className="flex-1 h-full min-h-[500px] relative bg-[#090c12] overflow-hidden">
          <CreatureViewport
            genome={genome}
            showSkeleton={showSkeleton}
            isAnimating={isAnimating}
            speed={speed}
            lighting={lighting}
            materialStyle={materialStyle}
            cameraMode={cameraMode}
          />
        </div>

        {/* RIGHT PANEL: Live Genome JSON */}
        <div className="w-96 bg-[#0d111a] border-l border-[#1c2436] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Live Genome Blueprint</h3>
            <span className="text-[10px] text-gray-500">Edit to live-update rig</span>
          </div>
          <textarea
            value={jsonText}
            onChange={handleJsonChange}
            className="flex-1 bg-[#06080d] border border-[#1a2334] rounded p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-600 transition-colors resize-none overflow-y-auto shadow-inner"
          />
        </div>
      </div>
    </div>
  );
};
