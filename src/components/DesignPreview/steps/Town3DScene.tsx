import React, { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { TownPlan, CivicKind } from '@/systems/worldforge/town/townEngine';
import type { Pt } from '@/systems/worldforge/submap/submapEngine';
import { BUILDING_FILL, BUILDING_ROOF } from '@/systems/worldforge/town/buildingStyle';
import { STREET_TIER_SPECS } from '@/systems/worldforge/town/streetRibbons';
import { buildTownGeometry } from './townMesh';
import { PerfProbe } from '@/devtools/perf';

/**
 * 3D realization of a 2D `townEngine.TownPlan`. All geometry comes from the SAME
 * plan the 2D `TownPlanView` renders (see {@link buildTownGeometry}); buildings are
 * coloured by their engine `buildingType` using the SHARED `buildingStyle` tables,
 * so the 3D town adheres to the 2D map down to per-building type, with pitched
 * roofs, rural farmsteads and civic massing. This component only assigns materials
 * + lighting; the geometry math is pure and unit-tested in townMesh.
 *
 * Atmosphere: a dark dusk sky-to-ground gradient (NOT white), distance fog that
 * dissolves the flat ground's outer cell edges into the horizon, and a warm key
 * sun + cool sky fill so the massing casts grounding shadows.
 */

const SIZE = 320;
const SUN: [number, number, number] = [150, 210, 120];

/** Toggleable render layers for the town3d inspection panel. */
export type TownLayer = 'ground' | 'streets' | 'buildings' | 'walls' | 'civic' | 'water';
/** A layer renders unless its flag is explicitly false. */
const on = (show: Partial<Record<TownLayer, boolean>> | undefined, key: TownLayer): boolean =>
  show?.[key] !== false;

const CIVIC_COLOR: Record<CivicKind, string> = {
  // The plaza slab wears the plaza street tier's flagstone so the square and
  // its frontage ring read as ONE paved civic heart (streets-unify slice).
  plaza: STREET_TIER_SPECS.plaza.colorHex,
  temple: '#9fb0dc', keep: '#96413f', citadel: '#6f2f2c', dock: '#3f7fa8', bridge: '#caa86a',
};
// Civic landmarks glow faintly so the keep/temple/dock read as blue/red beacons
// against the dark sky the way they read as coloured blocks on the 2D map.
const CIVIC_EMISSIVE: Partial<Record<CivicKind, { color: string; intensity: number }>> = {
  keep: { color: '#c05038', intensity: 0.28 },
  citadel: { color: '#a83a2c', intensity: 0.3 },
  temple: { color: '#7f97e0', intensity: 0.3 },
  dock: { color: '#3f8fd0', intensity: 0.25 },
};
// Muted, dusk-toned field so the surround reads as evening countryside rather
// than raw bright Voronoi cells; fog fades their hard outer edges into the sky.
const OUTSKIRT_COLOR: Record<string, string> = { farm: '#83744a', pasture: '#67793f', scrub: '#736a4b' };
// Intramural open land. Warmer and lighter than the outskirt tones, so garden
// ground inside the walls reads as town rather than as countryside; ruins are
// pale rubble-grey so a shrunken town is legible from the air.
// Pushed well off the core (#c3b591) and block (#e4d9bf) tones: under this
// scene's dusk key light the first pass at these hues washed out to the same
// parchment as the ground it was meant to distinguish.
const OPEN_LAND_COLOR: Record<string, string> = {
  yard: '#8a7648', garden: '#7f8c4b', orchard: '#55702f', paddock: '#9a9560', ruin: '#8f8674',
};
const FOG_COLOR = '#2b3550';

/** Dusk gradient background + distance fog. Dissolves the ground's hard cell
 *  edges into the horizon and replaces the old stark-white canvas. */
const SceneChrome: React.FC = () => {
  const scene = useThree((s) => s.scene);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#0c1220'); // zenith — deep night
    grad.addColorStop(0.55, '#1b2540');
    grad.addColorStop(0.82, FOG_COLOR); // horizon band = fog colour
    grad.addColorStop(1.0, '#3a3244'); // warm dusk glow at the base
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => {
    scene.background = tex;
    scene.fog = new THREE.Fog(FOG_COLOR, SIZE * 1.4, SIZE * 4.2);
    return () => { scene.background = null; scene.fog = null; tex.dispose(); };
  }, [scene, tex]);
  return null;
};

const Town3DScene: React.FC<{ plan: TownPlan; water?: Pt[][]; show?: Partial<Record<TownLayer, boolean>> }> = ({ plan, water, show }) => {
  const g = useMemo(() => buildTownGeometry(plan, SIZE, water ?? []), [plan, water]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0c1220' }}>
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.5, far: 8000, position: [SIZE * 0.65, SIZE * 0.55, SIZE * 0.8] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <PerfProbe id="town3d" label="Town 3D" />
        <SceneChrome />
        <hemisphereLight args={[0x6f86c4, 0x2a2620, 0.55]} />
        <ambientLight intensity={0.18} color={0x8fa3d6} />
        <directionalLight
          position={SUN}
          intensity={2.4}
          color={0xffe6c2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0006}
          shadow-normalBias={0.6}
          shadow-camera-near={1}
          shadow-camera-far={1400}
          shadow-camera-left={-SIZE}
          shadow-camera-right={SIZE}
          shadow-camera-top={SIZE}
          shadow-camera-bottom={-SIZE}
        />
        {/* Cool rim light from the opposite side so silhouettes separate from the dark sky. */}
        <directionalLight position={[-SIZE * 0.7, SIZE * 0.5, -SIZE * 0.6]} intensity={0.5} color={0x9fb4e6} />

        {/* Base ground: a large dark disc under the town so the plan sits grounded
            in the field/darkness instead of floating on a bright void; fog fades
            its rim into the horizon. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <circleGeometry args={[SIZE * 2.6, 64]} />
          <meshStandardMaterial color="#3a4232" roughness={1} />
        </mesh>

        {/* Ground: footprint base, outskirts ring, core (street/ground tone) and
            the raised parchment ward blocks. One toggleable layer. */}
        {on(show, 'ground') && (
          <group>
            <mesh geometry={g.footprintGeo} position={[0, -0.05, 0]} receiveShadow><meshStandardMaterial color="#55613a" roughness={0.97} /></mesh>
            {g.outskirts.map(({ kind, geo }) => (
              <mesh key={kind} geometry={geo} position={[0, -0.02, 0]} receiveShadow><meshStandardMaterial color={OUTSKIRT_COLOR[kind]} roughness={0.97} /></mesh>
            ))}
            {/* GROUND vs PAVING (roads slice, 2026-08-23). The core used to be
                painted in the STREET tone (#c3b591, a hair off the avenue tint
                #c7b48d) and the blocks in a parchment BRIGHTER than any street.
                Both together made the walled interior one pale slab with the
                street network invisible inside it. The core is now bare trodden
                earth, and the ward blocks — the yards, gardens and middens
                between the houses — take an olive khaki, so the tan street
                hierarchy separates by HUE and not by luminance alone. */}
            {g.coreGeo && <mesh geometry={g.coreGeo} receiveShadow><meshStandardMaterial color="#9d8f6d" roughness={0.95} /></mesh>}
            {g.blockGeo && <mesh geometry={g.blockGeo} receiveShadow><meshStandardMaterial color="#c9c69c" roughness={0.94} /></mesh>}
            {/* Intramural open land, drawn AFTER the blocks: a `ward` parcel has to
                sit on top of the raised block it replaces, a `rim` parcel just
                above the core ground between the built edge and the wall. */}
            {g.openLand.map(({ kind, source, geo }) => (
              <mesh key={`${kind}:${source}`} geometry={geo} receiveShadow
                position={[0, source === 'ward' ? 0.14 : 0.02, 0]}>
                <meshStandardMaterial color={OPEN_LAND_COLOR[kind] ?? '#7d8b52'} roughness={0.97} />
              </mesh>
            ))}
          </group>
        )}

        {/* Sunk river: a dark wet channel bed fills the carved trench (its exposed
            upper sides read as banks), and a translucent water surface sits just
            above it — so the river reads as water in a real channel, not a slab. */}
        {on(show, 'water') && (
          <group>
            {g.waterBedGeo && (
              <mesh geometry={g.waterBedGeo} position={[0, -0.3, 0]} receiveShadow>
                <meshStandardMaterial color="#2c3a2e" roughness={1} />
              </mesh>
            )}
            {g.waterGeo && (
              <mesh geometry={g.waterGeo} position={[0, -0.14, 0]}>
                <meshStandardMaterial
                  color="#2f5d7c"
                  roughness={0.18}
                  metalness={0.35}
                  transparent
                  opacity={0.86}
                  emissive="#12324a"
                  emissiveIntensity={0.22}
                />
              </mesh>
            )}
          </group>
        )}

        {/* Tiered street ribbons from the SHARED street module (streetRibbons.ts —
            same widths/tints/layers as the game 3D bake): flagstone plaza ring +
            edged avenues, cobble streets, rutted dirt lanes. One mesh per paint
            colour (cores, edging bands, rut stripes). */}
        {on(show, 'streets') && g.streets.map(({ colorHex, geo }) => (
          <mesh key={`st-${colorHex}`} geometry={geo} receiveShadow><meshStandardMaterial color={colorHex} roughness={0.95} /></mesh>
        ))}

        {/* Buildings — one mesh per engine building-type, coloured like the 2D map. */}
        {on(show, 'buildings') && (
          <group>
            {g.buildings.map(({ type, geo }) => (
              <mesh key={`b-${type}`} geometry={geo} castShadow receiveShadow>
                <meshStandardMaterial color={BUILDING_FILL[type]} roughness={0.88} />
              </mesh>
            ))}
            {/* Pitched roofs per type (terracotta / slate). */}
            {g.roofs.map(({ type, geo }) => (
              <mesh key={`r-${type}`} geometry={geo} castShadow>
                <meshStandardMaterial color={BUILDING_ROOF[type]} roughness={0.8} flatShading />
              </mesh>
            ))}
          </group>
        )}

        {/* Civic anatomy (distinct colours + massing); landmarks glow faintly. */}
        {on(show, 'civic') && g.civic.map(({ kind, geo }) => {
          const em = CIVIC_EMISSIVE[kind];
          return (
            <mesh key={kind} geometry={geo} castShadow receiveShadow>
              <meshStandardMaterial
                color={CIVIC_COLOR[kind]}
                roughness={0.82}
                emissive={em ? em.color : '#000000'}
                emissiveIntensity={em ? em.intensity : 0}
              />
            </mesh>
          );
        })}

        {/* Defensive walls + gatehouses — pale masonry so the crenellated curtain
            reads as stone, distinct from the warm-brown houses it rings. */}
        {on(show, 'walls') && g.wallGeo && <mesh geometry={g.wallGeo} castShadow receiveShadow><meshStandardMaterial color="#9a9380" roughness={0.85} /></mesh>}

        <OrbitControls target={[0, 6, 0]} minDistance={30} maxDistance={1600} />
      </Canvas>
    </div>
  );
};

export default Town3DScene;
