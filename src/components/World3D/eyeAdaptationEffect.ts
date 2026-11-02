/**
 * @file eyeAdaptationEffect.ts — the WebGL half of eye adaptation (GG-594
 * part 1). The shared controller and the reasons are in
 * `src/systems/world3d/eyeAdaptation.ts`.
 *
 * WHERE IT SITS. One postprocessing Effect in the ground view's composer,
 * mounted just before `<ToneMapping>`. The composer merges consecutive effects
 * into one pass, in order, so the multiply below runs on the linear color just
 * before ACES. `renderer.toneMappingExposure` does not reach that ACES (a 12x
 * value changed nothing in the earlier test), which is why the exposure is a
 * step of its own in the chain.
 *
 * THE METER. `update()` gets the pass's input buffer: the linear frame after
 * the AO pass. A ShaderPass draws it into a METER_W by METER_H RGBA8 grid of
 * log2 luminance codes (four taps a cell), and an async readback brings the
 * grid to the CPU every few frames. three r172 reads it through a pixel buffer
 * and a fence, so the frame does not wait for the GPU.
 */
import * as THREE from 'three';
import { Effect, ShaderPass } from 'postprocessing';
import { EYE_ADAPTATION, EyeAdaptation } from '../../systems/world3d/eyeAdaptation';

const { METER_W, METER_H, LOG2_MIN, LOG2_MAX } = EYE_ADAPTATION;

/** The GLSL float literal of a number (an integer needs a decimal point). */
const glslFloat = (v: number): string => (Number.isInteger(v) ? `${v}.0` : `${v}`);

const METER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`;

const METER_FRAGMENT = /* glsl */ `
uniform sampler2D inputBuffer;
varying vec2 vUv;
const float LOG2_MIN = ${glslFloat(LOG2_MIN)};
const float LOG2_MAX = ${glslFloat(LOG2_MAX)};
float logLum(vec2 uv) {
  vec3 c = texture2D(inputBuffer, uv).rgb;
  return log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), exp2(LOG2_MIN)));
}
void main() {
  // Four taps at the quarter points of this meter cell.
  vec2 q = vec2(0.25 / ${glslFloat(METER_W)}, 0.25 / ${glslFloat(METER_H)});
  float a = (logLum(vUv + vec2(-q.x, -q.y)) + logLum(vUv + vec2(q.x, -q.y))
           + logLum(vUv + vec2(-q.x, q.y)) + logLum(vUv + vec2(q.x, q.y))) * 0.25;
  gl_FragColor = vec4(clamp((a - LOG2_MIN) / (LOG2_MAX - LOG2_MIN), 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const EXPOSURE_FRAGMENT = /* glsl */ `
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}`;

/** The exposure step and its meter. Owns one small render target. */
export class EyeAdaptationEffect extends Effect {
  readonly eye: EyeAdaptation;
  private readonly meterTarget: THREE.WebGLRenderTarget;
  private readonly meterPass: ShaderPass;
  private readonly meterPixels = new Uint8Array(METER_W * METER_H * 4);

  constructor(eye: EyeAdaptation) {
    super('EyeAdaptationEffect', EXPOSURE_FRAGMENT, {
      uniforms: new Map([['exposure', new THREE.Uniform(1)]]),
    });
    this.eye = eye;
    this.meterTarget = new THREE.WebGLRenderTarget(METER_W, METER_H, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.meterTarget.texture.name = 'EyeAdaptation.meter';
    this.meterPass = new ShaderPass(new THREE.ShaderMaterial({
      name: 'EyeAdaptationMeter',
      uniforms: { inputBuffer: new THREE.Uniform(null) },
      vertexShader: METER_VERTEX,
      fragmentShader: METER_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }), 'inputBuffer');
  }

  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime?: number): void {
    const eye = this.eye;
    if (eye.hold === null && eye.wantsReading()) {
      this.meterPass.render(renderer, inputBuffer, this.meterTarget);
      const target = this.meterTarget;
      const px = this.meterPixels;
      eye.read(() => renderer.readRenderTargetPixelsAsync(target, 0, 0, METER_W, METER_H, px).then(() => px), METER_W, METER_H);
    }
    (this.uniforms.get('exposure') as THREE.Uniform<number>).value = eye.step(deltaTime ?? 0);
  }

  override dispose(): void {
    super.dispose();
    this.meterTarget.dispose();
    this.meterPass.dispose();
  }
}
