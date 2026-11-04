/**
 * @file clothShaders.ts — the GLSL of the WebGL GPU cloth solver.
 *
 * Character cloth+armor campaign, slice 1c (2026-11-04). Three passes, each a
 * full-atlas draw (clothSystem.ts scissors it to the used rows):
 *
 *   INTEGRATE  Verlet: p' = p + (p − prev)·damping + g·dt². A new garment's
 *              points start at their rest position (the init texture), and a
 *              pinned point goes straight to its pin target.
 *   PREV       prev' = p (the position before this substep's integrate).
 *   SOLVE      run several times per substep. Each point GATHERS every
 *              distance constraint it is part of (structural, shear, bend),
 *              moves by the averaged correction (Jacobi, over-relaxed), then
 *              is pushed out of its garment's body colliders and above the
 *              floor. The constraint method is the entity-forge one (position
 *              based dynamics, after the MIT cape-physics demo); Jacobi
 *              gathering is what lets every point solve in parallel on a GPU.
 *
 * Data layout: see clothAtlas.ts (per-texel static textures) and
 * bodyColliders.ts (8 texels per collider: A, B, X, Z, hx0-3, hx4-7,
 * hz0-3, hz4-7; A.w = push weight, B.w = section exponent). three r172 compiles every ShaderMaterial as GLSL 300 es on
 * WebGL2, so texelFetch is available and gl_FragColor is mapped for us.
 */
import { ATLAS_SIZE } from './clothAtlas';

export const COLLIDERS_PER_ROW = 16;
/** Most colliders one garment tests. A cape uses 17 of the 20 body ones. */
export const MAX_GARMENT_COLLIDERS = 24;

export const PASS_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uPos;
uniform sampler2D uPrev;
uniform sampler2D uMeta;
uniform sampler2D uInit;
uniform sampler2D uPin;
uniform float uPinWidth;
vec4 at(sampler2D t, ivec2 p) { return texelFetch(t, p, 0); }
ivec2 self() { return ivec2(floor(gl_FragCoord.xy)); }
vec4 pinTarget(float slot) {
  int s = int(slot);
  int w = int(uPinWidth);
  return texelFetch(uPin, ivec2(s - (s / w) * w, s / w), 0);
}
`;

export const INTEGRATE_FRAGMENT = /* glsl */ `
${COMMON}
uniform float uDt;
uniform float uDtRatio;
uniform float uDamping;
uniform vec3 uGravity;
void main() {
  ivec2 t = self();
  vec4 meta = at(uMeta, t);
  if (meta.z < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec4 init = at(uInit, t);
  if (init.w > 0.5) { gl_FragColor = vec4(init.xyz, 1.0); return; }
  if (meta.y >= 0.0) { gl_FragColor = vec4(pinTarget(meta.y).xyz, 1.0); return; }
  vec3 p = at(uPos, t).xyz;
  vec3 v = (p - at(uPrev, t).xyz) * uDamping * uDtRatio;
  // A teleport (a figure placed somewhere new) would fling the cloth: any
  // point moving more than 1 m in one substep loses its velocity instead.
  if (dot(v, v) > 1.0) v = vec3(0.0);
  gl_FragColor = vec4(p + v + uGravity * uDt * uDt, 1.0);
}
`;

export const PREV_FRAGMENT = /* glsl */ `
${COMMON}
void main() {
  ivec2 t = self();
  vec4 meta = at(uMeta, t);
  if (meta.z < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec4 init = at(uInit, t);
  gl_FragColor = vec4(init.w > 0.5 ? init.xyz : at(uPos, t).xyz, 1.0);
}
`;

export const SOLVE_FRAGMENT = /* glsl */ `
${COMMON}
uniform sampler2D uRest;
uniform sampler2D uRest2;
uniform sampler2D uGrid;
uniform sampler2D uGarment;
uniform sampler2D uColl;
uniform float uOmega;

// Neighbor of this point at (dc, dr) in its own garment grid. False past an
// open edge; a tube wraps its columns.
bool nb(ivec2 t, vec4 grid, int dc, int dr, out ivec2 o) {
  int cols = int(abs(grid.z));
  int c = int(grid.x) + dc;
  int r = int(grid.y) + dr;
  if (r < 0 || r >= int(grid.w)) return false;
  if (grid.z < 0.0) { c = c - (c >= cols ? cols : 0) + (c < 0 ? cols : 0); }
  else if (c < 0 || c >= cols) return false;
  o = t + ivec2(c - int(grid.x), r - int(grid.y));
  return true;
}

void gather(inout vec3 acc, inout float n, vec3 p, ivec2 q, float rest, float stiff) {
  if (rest < 0.0) return;
  vec3 d = at(uPos, q).xyz - p;
  float L = length(d);
  if (L < 1e-7) return;
  // a pinned neighbor cannot move, so this point takes the whole correction
  float w = at(uMeta, q).y >= 0.0 ? 1.0 : 0.5;
  acc += d * ((L - rest) / L) * stiff * w;
  n += 1.0;
}

float knot(vec4 a, vec4 b, int k) {
  return k == 0 ? a.x : k == 1 ? a.y : k == 2 ? a.z : k == 3 ? a.w : k == 4 ? b.x : k == 5 ? b.y : k == 6 ? b.z : b.w;
}
float profileAt(vec4 a, vec4 b, float u) {
  float t = u * 7.0;
  int k = int(min(6.0, floor(t)));
  return mix(knot(a, b, k), knot(a, b, k + 1), t - float(k));
}

// Push p out of one rounded-box collider (bodyColliders.ts contact rule).
// Returns the pushed point and, in w, the collider's push weight (A.w in the
// packed texel; clothSystem.ts pushWeight) — 0 when the point was outside.
vec4 pushOut(vec3 p, int ci) {
  ivec2 base = ivec2((ci - (ci / ${COLLIDERS_PER_ROW}) * ${COLLIDERS_PER_ROW}) * 8, ci / ${COLLIDERS_PER_ROW});
  vec4 Aw = at(uColl, base);
  vec3 A = Aw.xyz;
  vec4 Be = at(uColl, base + ivec2(1, 0));
  vec3 B = Be.xyz;
  float e = Be.w;
  vec3 X = at(uColl, base + ivec2(2, 0)).xyz;
  vec3 Z = at(uColl, base + ivec2(3, 0)).xyz;
  vec3 ab = B - A;
  float len = length(ab);
  vec3 Y = len > 1e-6 ? ab / len : cross(Z, X);
  vec3 r = p - A;
  float s = dot(r, Y);
  float sc = clamp(s, 0.0, len);
  float u = len > 1e-6 ? sc / len : 0.0;
  float ox = dot(r, X);
  float oz = dot(r, Z);
  float al = s - sc;
  float hx = profileAt(at(uColl, base + ivec2(4, 0)), at(uColl, base + ivec2(5, 0)), u);
  float hz = profileAt(at(uColl, base + ivec2(6, 0)), at(uColl, base + ivec2(7, 0)), u);
  float hy = min(hx, hz);
  float qx = abs(ox / hx), qz = abs(oz / hz), qy = abs(al / hy);
  // section exponent per piece (2 ellipse .. 4 rounded box), bodyColliders.ts
  float n4 = pow(qx, e) + pow(qz, e) + pow(qy, e);
  if (n4 >= 1.0 || n4 < 1e-12) return vec4(p, 0.0);
  float k = pow(n4, -1.0 / e);
  return vec4(A + Y * sc + (X * ox + Z * oz + Y * al) * k, Aw.w);
}

// True when c is outside every collider of the garment.
bool clearOfAll(vec3 c, int start, int count) {
  for (int k = 0; k < ${MAX_GARMENT_COLLIDERS}; k++) {
    if (k >= count) break;
    if (pushOut(c, start + k).w > 0.0) return false;
  }
  return true;
}

void main() {
  ivec2 t = self();
  vec4 meta = at(uMeta, t);
  if (meta.z < 0.5) { gl_FragColor = vec4(0.0); return; }
  if (meta.y >= 0.0) { gl_FragColor = vec4(pinTarget(meta.y).xyz, 1.0); return; }
  vec3 p = at(uPos, t).xyz;
  vec4 grid = at(uGrid, t);
  vec4 rest = at(uRest, t);
  vec4 rest2 = at(uRest2, t);
  vec3 acc = vec3(0.0);
  float n = 0.0;
  ivec2 q;
  // structural: right and down are this point's own entries; left and up are
  // the neighbor's right and down entries (each constraint stored once)
  if (nb(t, grid, 1, 0, q)) gather(acc, n, p, q, rest.x, 1.0);
  if (nb(t, grid, -1, 0, q)) gather(acc, n, p, q, at(uRest, q).x, 1.0);
  if (nb(t, grid, 0, 1, q)) gather(acc, n, p, q, rest.y, 1.0);
  if (nb(t, grid, 0, -1, q)) gather(acc, n, p, q, at(uRest, q).y, 1.0);
  // shear
  if (nb(t, grid, 1, 1, q)) gather(acc, n, p, q, rest.z, 0.5);
  if (nb(t, grid, -1, -1, q)) gather(acc, n, p, q, at(uRest, q).z, 0.5);
  if (nb(t, grid, -1, 1, q)) gather(acc, n, p, q, rest.w, 0.5);
  if (nb(t, grid, 1, -1, q)) gather(acc, n, p, q, at(uRest, q).w, 0.5);
  // bend (two apart): low stiffness lets the sheet fold
  float bend = rest2.z;
  if (nb(t, grid, 2, 0, q)) gather(acc, n, p, q, rest2.x, bend);
  if (nb(t, grid, -2, 0, q)) gather(acc, n, p, q, at(uRest2, q).x, bend);
  if (nb(t, grid, 0, 2, q)) gather(acc, n, p, q, rest2.y, bend);
  if (nb(t, grid, 0, -2, q)) gather(acc, n, p, q, at(uRest2, q).y, bend);
  if (n > 0.0) p += acc * (uOmega / n);

  // tether: never farther from the nearest pin than the rest distance plus
  // a little give (clothAtlas.ts TETHER_GIVE) — stops the sheet stretching
  if (meta.w >= 0.0) {
    vec3 a = pinTarget(meta.w).xyz;
    vec3 d = p - a;
    float L = length(d);
    if (L > rest2.w && L > 1e-6) p = a + d * (rest2.w / L);
  }

  // body colliders of this garment, then the floor.
  // OVERLAP RULE (2026-11-04): a point inside ONE collider takes its push.
  // A point inside several (the chest and a deltoid at the shoulder; a
  // deltoid and the upper arm when the arm swings back on the cape's edge)
  // has no single exit: each collider's push lands inside the other, and
  // their averaged push cancels where the two faces oppose. So the point
  // tries every single exit and every exit PAIR (out of i, then out of j
  // from there) and takes the shortest that lands clear of all of them —
  // for two overlapping shapes that is the rim where their surfaces meet.
  // When no try is clear, the weighted average still makes progress; the
  // weight favors the body over a hand, so a hand that swings back onto
  // the cape pinches it against the back instead of through it.
  int gs = int(meta.x);
  vec4 g = texelFetch(uGarment, ivec2(gs - (gs / 256) * 256, gs / 256), 0);
  int start = int(g.x);
  int count = int(g.y);
  for (int round = 0; round < 3; round++) {
    vec3 push = vec3(0.0);
    float wsum = 0.0;
    int inside = 0;
    for (int k = 0; k < ${MAX_GARMENT_COLLIDERS}; k++) {
      if (k >= count) break;
      vec4 q = pushOut(p, start + k);
      if (q.w > 0.0) { push += (q.xyz - p) * q.w; wsum += q.w; inside++; }
    }
    if (inside == 0) break;
    if (inside == 1) { p += push / wsum; continue; }
    vec3 best = p + push / wsum;
    float bestD = 1e9;
    for (int i = 0; i < ${MAX_GARMENT_COLLIDERS}; i++) {
      if (i >= count) break;
      vec4 qi = pushOut(p, start + i);
      if (qi.w <= 0.0) continue;
      for (int j = -1; j < ${MAX_GARMENT_COLLIDERS}; j++) {
        if (j >= count) break;
        vec3 c = qi.xyz;
        if (j >= 0) {
          if (j == i) continue;
          vec4 qj = pushOut(c, start + j);
          if (qj.w <= 0.0) continue; // c is already clear of j: the single exit covers it
          c = qj.xyz;
        }
        float d = distance(c, p);
        if (d >= bestD) continue;
        if (clearOfAll(c, start, count)) { bestD = d; best = c; }
      }
    }
    p = best;
  }
  p.y = max(p.y, g.z);
  gl_FragColor = vec4(p, 1.0);
}
`;

/** Atlas edge length as a GLSL literal, for the render-side shader chunks. */
export const ATLAS_GLSL = ATLAS_SIZE.toFixed(1);
