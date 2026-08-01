/**
 * @file CreaturePlayground.tsx — Interactive Procedural Creature Playground.
 *
 * Dev tool and playground for generating, inspecting, and animating
 * procedural creatures using DeepSeek-V4-Flash and the 3D skeletal engine.
 *
 * Layout:
 * - Top header: Title, preset buttons, provider badge
 * - Left sidebar: Prompt input, generate button, speed/animation controls
 * - Center: Three.js WebGL canvas (orbit controls, skeleton wireframe, procedural mesh, locomotion)
 * - Right sidebar: Live JSON genome inspector & editor
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CreatureGenome } from '../../systems/entities3d/genome/creatureGenomeSchema';
import { assembleFromGenome } from '../../systems/entities3d/skeleton/skeletonAssembler';
import type { AssembledSkeleton } from '../../systems/entities3d/skeleton/skeletonAssembler';
import { generateCreatureMesh } from '../../systems/entities3d/skeleton/proceduralCreatureMesh';
import { CreatureLocomotionController } from '../../systems/entities3d/skeleton/proceduralLocomotion';
import { generateCreatureGenomeWithDeepSeek, createFallbackGenome } from '../../services/ai/deepseekCreatureGenerator';

// ============================================================================
// PRESET PROMPTS
// ============================================================================

const PRESETS = [
  { label: '🐺 Quadruped Wolf', prompt: 'a large four-legged wolf predator with muscular legs and a long bushy tail' },
  { label: '🦂 Hexapod Scorpion', prompt: 'a six-legged armored scorpion creature with pincers and a stinger tail' },
  { label: '🐉 Serpentine Drake', prompt: 'a long serpentine dragon with small front claw legs and a massive spine' },
  { label: '🦅 Avian Raptor', prompt: 'a feather-patterned bipedal raptor creature with powerful hind leg claws' },
];

// ============================================================================
// THREE.JS VIEWPORT COMPONENT
// ============================================================================

interface CreatureViewportProps {
  genome: CreatureGenome;
  showSkeleton: boolean;
  isAnimating: boolean;
  speed: number;
}

const CreatureViewport: React.FC<CreatureViewportProps> = ({
  genome,
  showSkeleton,
  isAnimating,
  speed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#12161f');
    scene.fog = new THREE.FogExp2('#12161f', 0.08);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3, 2, 4);
    camera.lookAt(0, 0.6, 0);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.replaceChildren(renderer.domElement);

    // --- Lighting ---
    const ambient = new THREE.AmbientLight('#ffffff', 0.8);
    scene.add(ambient);

    const mainDirLight = new THREE.DirectionalLight('#fffaed', 2.0);
    mainDirLight.position.set(5, 8, 4);
    mainDirLight.castShadow = true;
    mainDirLight.shadow.mapSize.width = 1024;
    mainDirLight.shadow.mapSize.height = 1024;
    scene.add(mainDirLight);

    const rimLight = new THREE.DirectionalLight('#4d7cff', 1.2);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    // --- Ground Grid ---
    const grid = new THREE.GridHelper(20, 20, '#3a4b68', '#1e2638');
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

    const mesh = generateCreatureMesh(assembled, genome);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    scene.add(assembled.root);

    // --- Skeleton Helper ---
    const skeletonHelper = new THREE.SkeletonHelper(assembled.root);
    (skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 2;
    skeletonHelper.visible = showSkeleton;
    scene.add(skeletonHelper);

    // --- Controller ---
    const controller = new CreatureLocomotionController(assembled, genome);

    // --- Animation loop ---
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (isAnimating) {
        controller.update(dt, speed);
      }

      skeletonHelper.visible = showSkeleton;
      (skeletonHelper as unknown as { update: () => void }).update?.();

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // --- Resize handling ---
    const handleResize = () => {
      if (!containerRef.current) return;
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
      renderer.dispose();
    };
  }, [genome, showSkeleton, isAnimating, speed]);

  return <div ref={containerRef} className="w-full h-full relative" />;
};

// ============================================================================
// MAIN PLAYGROUND COMPONENT
// ============================================================================

export const CreaturePlayground: React.FC = () => {
  const [prompt, setPrompt] = useState('a four-legged armored beast with a long tail');
  const [genome, setGenome] = useState<CreatureGenome>(() => createFallbackGenome(prompt));
  const [jsonText, setJsonText] = useState(() => JSON.stringify(genome, null, 2));

  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'deepseek' | 'fallback'>('fallback');
  const [error, setError] = useState<string | null>(null);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [speed, setSpeed] = useState(1.5);

  // Synchronize JSON editor when genome state updates from API
  const updateGenomeState = (newGenome: CreatureGenome) => {
    setGenome(newGenome);
    setJsonText(JSON.stringify(newGenome, null, 2));
  };

  // Generate creature via DeepSeek API
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

  // Handle manual JSON edit in right sidebar
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
    <div className="flex flex-col h-screen bg-[#0b0e14] text-gray-100 font-sans select-none overflow-hidden">
      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#121722] border-b border-[#222c3d]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐋</span>
          <div>
            <h1 className="font-bold text-lg leading-none text-white">Procedural Creature Lab</h1>
            <p className="text-xs text-gray-400 mt-1">DeepSeek-V4-Flash + Skeletal IK Animation Engine</p>
          </div>
        </div>

        {/* Preset Prompt Buttons */}
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setPrompt(p.prompt);
                handleGenerate(p.prompt);
              }}
              className="px-3 py-1.5 bg-[#1c2433] hover:bg-[#283449] border border-[#2b374c] rounded text-xs text-gray-200 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Source Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
            source === 'deepseek'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              : 'bg-amber-950 text-amber-300 border border-amber-700'
          }`}>
            {source === 'deepseek' ? '⚡ DeepSeek-V4-Flash' : '⚙️ Fallback Engine'}
          </span>
        </div>
      </header>

      {/* ================= MAIN CONTENT BODY ================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: Controls & Prompts */}
        <div className="w-80 bg-[#121620] border-r border-[#20293a] p-5 flex flex-col gap-5 overflow-y-auto">
          {/* Prompt Section */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">Creature Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe creature morphology, limbs, tail, skin..."
              className="w-full bg-[#0d1017] border border-[#273246] rounded p-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className={`w-full mt-3 py-2.5 rounded font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-blue-900 text-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950'
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
            <div className="p-3 bg-red-950/80 border border-red-800/80 rounded text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Viewport Toggles */}
          <div className="border-t border-[#1f2838] pt-5 flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase text-gray-400">Viewport & Rig Options</h3>

            <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer">
              <span>Show Skeleton Rig</span>
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={(e) => setShowSkeleton(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
            </label>

            <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer">
              <span>Animate Locomotion</span>
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

          {/* Genome Summary stats */}
          <div className="border-t border-[#1f2838] pt-5">
            <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3">Morphology Overview</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0b0e14] p-2.5 rounded border border-[#1b2333]">
                <span className="text-gray-500 block">Archetype</span>
                <span className="font-semibold text-gray-200 capitalize">{genome.archetype}</span>
              </div>
              <div className="bg-[#0b0e14] p-2.5 rounded border border-[#1b2333]">
                <span className="text-gray-500 block">Mass</span>
                <span className="font-semibold text-gray-200">{genome.mass} kg</span>
              </div>
              <div className="bg-[#0b0e14] p-2.5 rounded border border-[#1b2333]">
                <span className="text-gray-500 block">Gait Type</span>
                <span className="font-semibold text-gray-200 capitalize">{genome.locomotion?.gaitType || 'walk'}</span>
              </div>
              <div className="bg-[#0b0e14] p-2.5 rounded border border-[#1b2333]">
                <span className="text-gray-500 block">Skin Pattern</span>
                <span className="font-semibold text-gray-200 capitalize">{genome.skin?.pattern || 'solid'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: 3D Viewport */}
        <div className="flex-1 relative bg-[#0e121a]">
          <CreatureViewport
            genome={genome}
            showSkeleton={showSkeleton}
            isAnimating={isAnimating}
            speed={speed}
          />
        </div>

        {/* RIGHT PANEL: Live JSON Genome Editor */}
        <div className="w-96 bg-[#121620] border-l border-[#20293a] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase text-gray-400">Live Genome JSON</h3>
            <span className="text-[10px] text-gray-500">Edit to live-update rig</span>
          </div>
          <textarea
            value={jsonText}
            onChange={handleJsonChange}
            className="flex-1 bg-[#090c12] border border-[#1c2433] rounded p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-600 transition-colors resize-none overflow-y-auto"
          />
        </div>
      </div>
    </div>
  );
};
