# Sub-spec: Lighting/atmosphere migration

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** specced, not built.

## Decision
The battle map's theme lighting/atmosphere moves into ground mode. Sky: adopt three.js in-tree `Sky` (MIT) as baseline. Clouds: trial the Nubis-port and WebGPU-fallback repos (verify licenses). Fog: port the analytic volumetric-primitive technique (closed-form GLSL, re-derive the math — the source blog post has no license, so no literal code copying). Region-bounded fog volumes (valley mist, swamp fog) are the target use.

## Open
- Time-of-day integration with the game clock (occupant schedules already keyed to hours).
- Whether Bruneton-quality sky (`@takram/three-atmosphere` trial) is worth the lift now or later.
