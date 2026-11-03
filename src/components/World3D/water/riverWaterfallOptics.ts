/**
 * Waterfall optical models and sky lighting calculations.
 * Extracted from riverWaterfallView.ts (agora-e9e1 split).
 */

import * as THREE from 'three/webgpu';

// ONE SET OF OPTICS (2026-11-03, claude-fall-lips; CI Typecheck run 41535506704).
// The agora-e9e1 split copied these as g 0.7 and 64 rows, while the view's
// shader kept g 0.75 and samples the tables as 65 rows. So the CPU tables and
// the shader disagreed, and riverWaterfallOptics.test.ts (14/15 forward mass at
// g 0.75) failed once its import was fixed. These are the pre-split values, and
// the view now reads g and skyRows from here, so the two cannot drift again.
export const WATERFALL_OPTICS = { g: 0.75, skyRows: 65 } as const;
export const WATERFALL_INTERFACE = { lowContrast: 1/8, highContrast: 1/4, halfRelative: 2**-10, halfAbsolute: 2**-24, quantizationFactor: 4, precisionFactor: 16*2**-23 } as const;

type WaterfallNormalVector = readonly [number,number,number];
type WaterfallSkyCell = { direction: [number, number, number]; mass: number; zenithMix: number };

/** CPU reference for the proof's finite-difference classifier. Analytic-field
 * tests check orientation, quantization rejection and local slab limits;
 * only native GPU captures verify the actual shader/advected-density result. */
export function waterfallInterfaceNormal(samples: readonly [number,number,number,number,number,number], steps: WaterfallNormalVector,
  axes: readonly [WaterfallNormalVector,WaterfallNormalVector,WaterfallNormalVector], envelope: WaterfallNormalVector, view: WaterfallNormalVector, enabled=true) {
  const dot3=(a:WaterfallNormalVector,b:WaterfallNormalVector)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const orient=(n:WaterfallNormalVector):[number,number,number]=>n.map(v=>v*(dot3(n,view)<0?-1:1)) as [number,number,number];
  const old = enabled ? orient(envelope) : [...envelope] as [number,number,number];
  const fallback=()=>({normal:old,candidate:old,confidence:0,fallback:true});
  if(!enabled || ![...samples,...steps,...axes.flat(),...view,...envelope].every(Number.isFinite) || steps.some(v=>v<=0))return fallback();
  const rhoMax=Math.max(...samples),differences=[samples[0]-samples[1],samples[2]-samples[3],samples[4]-samples[5]];
  const delta=Math.max(...differences.map(Math.abs));
  const quantization=WATERFALL_INTERFACE.quantizationFactor*(WATERFALL_INTERFACE.halfRelative*rhoMax+WATERFALL_INTERFACE.halfAbsolute);
  const gradient:[number,number,number]=[0,0,0];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)gradient[j]+=differences[i]/(2*steps[i])*axes[i][j];
  const norm=Math.hypot(...gradient);
  if(rhoMax<=WATERFALL_INTERFACE.halfAbsolute || delta<=quantization || !(norm>0))return fallback();
  const candidate=orient(gradient.map(v=>-v/norm) as [number,number,number]);
  const contrast=delta/Math.max(rhoMax,WATERFALL_INTERFACE.halfAbsolute);
  const t=Math.max(0,Math.min(1,(contrast-WATERFALL_INTERFACE.lowContrast)/(WATERFALL_INTERFACE.highContrast-WATERFALL_INTERFACE.lowContrast)));
  const confidence=t*t*(3-2*t);
  if(confidence===0)return fallback();
  const blended=old.map((v,i)=>v*(1-confidence)+candidate[i]*confidence) as [number,number,number];
  const length=Math.hypot(...blended);if(!(length>0))return fallback();
  return {normal:blended.map(v=>v/length) as [number,number,number],candidate,confidence,fallback:false};
}

/** Homogeneous-segment reference used to check attenuation and source energy.
 * Absorption takes energy away; only scattering contributes incident light.
 * The event mean stays near the entry of an opaque segment instead of placing
 * its visible scattering halfway through deeply shadowed liquid. */
export function waterfallOpticalSegment(scattering: number, absorption: number, distance: number) {
  const sigmaS = Math.max(0, scattering); const sigmaA = Math.max(0, absorption); const length = Math.max(0, distance);
  const sigmaT = sigmaS + sigmaA; const tau = sigmaT * length;
  const removed = -Math.expm1(-tau); const transmission = Math.exp(-tau);
  const eventMean = tau < 0.01 ? length * (0.5 - tau / 12 + tau * tau * tau / 720)
    : 1 / sigmaT - length * Math.exp(-tau) / Math.max(-Math.expm1(-tau), 1e-30);
  return { transmission, scattered: sigmaT > 0 ? removed * sigmaS / sigmaT : 0,
    absorbed: sigmaT > 0 ? removed * sigmaA / sigmaT : 0, eventMean };
}

/** Hemispheric two-stream slab reference. Normal-column optical depths
 * retain the actual liquid attenuation and dispersed interface area. The
 * transport reduction (1-g) belongs only to diffuse reflection/transmission;
 * a direct background or sunlight beam still uses full extinction.
 * Based on the energy-conserving hemispheric equations in Heng et al. (2014),
 * section III and table 3: https://arxiv.org/html/1405.0026.
 * DEBT: A local homogeneous slab cannot resolve lateral escape, turbulent
 * light paths, or the angular structure of each repeated scattering order. */
export function waterfallTwoStream(scatteringDepth: number, absorptionDepth: number, asymmetry: number = WATERFALL_OPTICS.g) {
  const s = Math.max(0, scatteringDepth); const absorption = Math.max(0, absorptionDepth);
  const g = Math.max(0, Math.min(1, asymmetry)); const b = (1 - g) * s; const a = 2 * absorption + b;
  const k = 2 * Math.sqrt(absorption * (absorption + b)); const e = Math.exp(-k);
  const sinhc = k < 0.01 ? 1 - k + 2 * k * k / 3 - k * k * k / 3 + 2 * k ** 4 / 15
    : -Math.expm1(-2 * k) / (2 * k);
  const denominator = (1 + e * e) * 0.5 + a * sinhc;
  const reflection = b * sinhc / denominator; const transmission = e / denominator;
  const absorbed = Math.max(0, 1 - reflection - transmission);
  const total = s + absorption; const collision = -Math.expm1(-2 * total);
  const redirectedTransmission = Math.max(0, transmission - Math.exp(-2 * total));
  const budget = reflection + redirectedTransmission + absorbed;
  const omega = total > 0 ? s / total : 0;
  const conditionalReflection = total < 0.001 ? (1 - g) * omega * 0.5 : reflection / budget;
  const conditionalTransmission = total < 0.001 ? (1 + g) * omega * 0.5 : redirectedTransmission / budget;
  const conditionalAbsorption = total < 0.001 ? (total > 0 ? 1 - omega : 0) : absorbed / budget;
  return { reflection, transmission, absorption: absorbed, collision,
    conditionalReflection, conditionalTransmission, conditionalAbsorption };
}

let waterfallSkyIrradianceData: Float32Array | null = null;
let waterfallSkyIrradianceTexture: THREE.DataTexture | null = null;

function getWaterfallSkyIrradianceData() {
  if (waterfallSkyIrradianceData) return waterfallSkyIrradianceData;
  const data = new Float32Array(WATERFALL_OPTICS.skyRows * 4); const ny = 256;
  for (let row = 0; row < WATERFALL_OPTICS.skyRows; row += 1) {
    const normalY = 2 * row / (WATERFALL_OPTICS.skyRows - 1) - 1;
    const normalH = Math.sqrt(Math.max(0, 1 - normalY * normalY)); let front = 0; let back = 0;
    const azimuthIntegral = (a: number, b: number) => {
      if (b >= a) return 2 * Math.PI * b;
      if (b <= -a) return 0;
      const angle = Math.acos(-b / a); return 2 * (a * Math.sin(angle) + b * angle);
    };
    for (let j = 0; j < ny; j += 1) {
      const y = (j + 0.5) / ny; const a = normalH * Math.sqrt(1 - y * y); const b = normalY * y;
      front += Math.sqrt(y) * azimuthIntegral(a, b) / (ny * Math.PI);
      back += Math.sqrt(y) * azimuthIntegral(a, -b) / (ny * Math.PI);
    }
    data.set([(1 + normalY) * 0.5, front, (1 - normalY) * 0.5, back], row * 4);
  }
  waterfallSkyIrradianceData = data; return data;
}

/** Same boundary table as the shader, available to energy tests without GPU. */
export function waterfallSkyIrradiance(normalY: number) {
  const data = getWaterfallSkyIrradianceData();
  const p = (Math.max(-1, Math.min(1, normalY)) + 1) * 0.5 * (WATERFALL_OPTICS.skyRows - 1);
  const lo = Math.floor(p); const hi = Math.min(WATERFALL_OPTICS.skyRows - 1, lo + 1); const t = p - lo;
  const at = (channel: number) => data[lo * 4 + channel] * (1 - t) + data[hi * 4 + channel] * t;
  return { frontHorizon: at(0), frontZenith: at(1), backHorizon: at(2), backZenith: at(3) };
}

function getWaterfallSkyIrradianceTexture() {
  if (waterfallSkyIrradianceTexture) return waterfallSkyIrradianceTexture;
  const half = Uint16Array.from(getWaterfallSkyIrradianceData(), value => THREE.DataUtils.toHalfFloat(value));
  const map = new THREE.DataTexture(half, WATERFALL_OPTICS.skyRows, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter; map.generateMipmaps = false; map.needsUpdate = true;
  waterfallSkyIrradianceTexture = map; return map;
}

let waterfallSkyData: { directions: Float32Array; moments: Float32Array } | null = null;

function getWaterfallSkyData() {
  if (waterfallSkyData) return waterfallSkyData;
  const directions = new Float32Array(WATERFALL_OPTICS.skyRows * 3 * 4);
  const moments = new Float32Array(directions.length); const g = WATERFALL_OPTICS.g;
  const ny = 128; const na = 64; const cellAngle = 2 * Math.PI / 3;
  for (let row = 0; row < WATERFALL_OPTICS.skyRows; row += 1) {
    const viewY = 2 * row / (WATERFALL_OPTICS.skyRows - 1) - 1;
    const incomingY = -viewY; const incomingH = Math.sqrt(Math.max(0, 1 - viewY * viewY));
    for (let cell = 0; cell < 3; cell += 1) {
      let mass = 0; let dx = 0; let dy = 0; let dz = 0; let skyMoment = 0;
      for (let j = 0; j < ny; j += 1) for (let k = 0; k < na; k += 1) {
        const y = (j + 0.5) / ny; const h = Math.sqrt(1 - y * y);
        const azimuth = cell * cellAngle + ((k + 0.5) / na - 0.5) * cellAngle;
        const x = h * Math.cos(azimuth); const z = h * Math.sin(azimuth);
        const cosine = incomingH * x + incomingY * y;
        const weight = (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * cosine, 1.5)) * cellAngle / (ny * na);
        mass += weight; dx += x * weight; dy += y * weight; dz += z * weight; skyMoment += Math.sqrt(y) * weight;
      }
      const norm = Math.hypot(dx, dy, dz); const index = (cell * WATERFALL_OPTICS.skyRows + row) * 4;
      directions.set([dx / norm, dy / norm, dz / norm, mass], index);
      moments[index] = skyMoment / mass;
    }
  }
  waterfallSkyData = { directions, moments }; return waterfallSkyData;
}

/** CPU interpolation reads the same table the shader uses, so tests can check
 * hemisphere energy without starting a renderer or changing the live river. */
export function waterfallSkyBasis(viewY: number): WaterfallSkyCell[] {
  const data = getWaterfallSkyData(); const p = (Math.max(-1, Math.min(1, viewY)) + 1) * 0.5 * (WATERFALL_OPTICS.skyRows - 1);
  const lo = Math.floor(p); const hi = Math.min(WATERFALL_OPTICS.skyRows - 1, lo + 1); const t = p - lo;
  return Array.from({ length: 3 }, (_, cell) => {
    const a = (cell * WATERFALL_OPTICS.skyRows + lo) * 4; const b = (cell * WATERFALL_OPTICS.skyRows + hi) * 4;
    const blend: [number, number, number] = [
      data.directions[a] * (1 - t) + data.directions[b] * t,
      data.directions[a + 1] * (1 - t) + data.directions[b + 1] * t,
      data.directions[a + 2] * (1 - t) + data.directions[b + 2] * t,
    ];
    // The shader normalizes the filtered table direction before it traces the
    // ray; a blend of two unit rows is shorter than one, so do the same here.
    const length = Math.hypot(...blend);
    const direction = blend.map(v => v / length) as [number, number, number];
    const mass = data.directions[a + 3] * (1 - t) + data.directions[b + 3] * t;
    const zenithMix = data.moments[a] * (1 - t) + data.moments[b] * t;
    return { direction, mass, zenithMix };
  });
}

let waterfallSkyTextures: { directions: THREE.DataTexture; moments: THREE.DataTexture } | null = null;

function getWaterfallSkyTextures() {
  if (waterfallSkyTextures) return waterfallSkyTextures;
  const data = getWaterfallSkyData();
  const make = (pixels: Float32Array) => {
    const half = Uint16Array.from(pixels, value => THREE.DataUtils.toHalfFloat(value));
    const map = new THREE.DataTexture(half, WATERFALL_OPTICS.skyRows, 3, THREE.RGBAFormat, THREE.HalfFloatType);
    map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter; map.generateMipmaps = false; map.needsUpdate = true;
    return map;
  };
  waterfallSkyTextures = { directions: make(data.directions), moments: make(data.moments) }; return waterfallSkyTextures;
}

export { getWaterfallSkyIrradianceTexture, getWaterfallSkyTextures };
