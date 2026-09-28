/**
 * @file gaits/airborneDriver.ts — AirborneDriver: the flapping flyer and the
 * drifting floater (`flapping` selects the power stroke and the body loft).
 *
 * Split out of gaits.ts (MOD-3.8, 2026-09-09), verbatim.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: systems/entities3d/three/gaits.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Frame, SegmentSink } from '../../types';
import { BaseDriver } from './baseDriver';

/* ---------------------------------------------------------- flyer + float */

export class AirborneDriver extends BaseDriver {
  constructor(frame: Frame, private readonly flapping: boolean) {
    super(frame);
  }

  protected advance(t: number): void {
    this.flap = this.flapping ? Math.sin(t * 9) * 0.65 : 0;
    const bob = this.flapping
      ? Math.sin(t * 9 - Math.PI / 2) * this.hM * 0.04
      : Math.sin(t * 1.6) * this.hM * 0.06;
    this.verticalOffsetM = this.hM * (this.flapping ? 0.9 : 0.55) + bob;
    // body floats around local origin; the assembler lifts the body root
    const headZ = this.hM * (this.flapping ? 0.28 : 0.05);
    const headY = this.hM * (this.flapping ? 0.16 : 0.3);
    this.setHeadAnchors(0, headY, headZ);
    this.setAnchor('chest', 0, this.hM * 0.03, this.hM * 0.12);
    this.setAnchor('back', 0, this.hM * 0.1, -this.hM * 0.02);
    this.setAnchor('hips', 0, -this.hM * 0.05, -this.hM * 0.1);
    this.setAnchor('tailRoot', 0, 0, -this.hM * 0.22);
    const dang = Math.sin(this.t * 9 + 1.4) * this.hM * 0.02;
    for (const sgn of [-1, 1] as const) {
      this.setAnchor(sgn < 0 ? 'handL' : 'handR', sgn * this.hM * 0.12, -this.hM * 0.16 + dang, this.hM * 0.08);
      this.setAnchor(sgn < 0 ? 'hipL' : 'hipR', sgn * this.hM * 0.1, -this.hM * 0.2 + dang, -this.hM * 0.02);
    }
  }

  buildBody(sink: SegmentSink): void {
    const r = this.baseR;
    const head = this.pose.anchors.head.pos;
    if (this.flapping) {
      // bird fuselage: tail -> belly -> chest, neck to the head, tail fin
      sink.seg('body.rear', 0, this.hM * 0.02, -this.hM * 0.18, 0, 0, -this.hM * 0.02, r * 0.55, r * 0.95);
      sink.seg('body.front', 0, 0, -this.hM * 0.02, 0, this.hM * 0.02, this.hM * 0.13, r * 0.95, r * 0.75);
      sink.seg('neck', 0, this.hM * 0.04, this.hM * 0.13, head.x, head.y - this.hr * 0.3, head.z - this.hr * 0.2, r * 0.4, r * 0.32);
      sink.ball('head', head.x, head.y, head.z, this.hr);
      sink.seg('tail', 0, this.hM * 0.03, -this.hM * 0.18, 0, this.hM * 0.06, -this.hM * 0.32, r * 0.4, r * 0.22);
      const dang = Math.sin(this.t * 9 + 1.4) * this.hM * 0.02;
      for (const sgn of [-1, 1] as const) {
        const side = sgn < 0 ? 'L' : 'R';
        sink.seg('foot' + side, sgn * this.hM * 0.08, -this.hM * 0.08, this.hM * 0.02, sgn * this.hM * 0.1, -this.hM * 0.2 + dang, -this.hM * 0.02, r * 0.2, r * 0.14);
      }
    } else {
      // floater: a hovering mass with side lobes and a crown-ward head
      sink.seg('body.core', 0, -this.hM * 0.08, 0, 0, this.hM * 0.14, this.hM * 0.02, r * 1.15, r * 0.95);
      sink.seg('body.lobeL', -r * 0.9, -this.hM * 0.03, 0, -r * 0.25, this.hM * 0.05, 0, r * 0.5, r * 0.7);
      sink.seg('body.lobeR', r * 0.9, -this.hM * 0.03, 0, r * 0.25, this.hM * 0.05, 0, r * 0.5, r * 0.7);
      sink.ball('head', head.x, head.y, head.z, this.hr * 1.05);
    }
  }
}

