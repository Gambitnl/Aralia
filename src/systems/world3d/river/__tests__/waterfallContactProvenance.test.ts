/** Sharing private birth records must never leak into editable public snapshots
 * or change the water restored after a later receiver rejects a transaction. */
import { describe, expect, it } from 'vitest';
import { WaterfallContactFlow, type ContactFlowState } from '../waterfallContactFlow';

const dt = 1 / 120;
const source = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
function seeded() {
  const flow = new WaterfallContactFlow({ startTime: 0, dt, maxStepsPerAdvance: 1 });
  flow.advanceTo(dt, () => source);
  const seed = flow.saveState();
  // Exercise both forms of retained birth geometry with the same finite data.
  seed.snapshot.parcels[0].sheetRelease = structuredClone(seed.snapshot.parcels[0].sourceRelease!);
  flow.restoreState(seed);
  return flow;
}
function clean(state: ContactFlowState) {
  state.snapshot.receipt.lastAdvanceMilliseconds = 0;
  return state;
}
describe('private waterfall provenance', () => {
  it('keeps public birth records mutable and isolated from live water and checkpoints', () => {
    const flow = seeded();
    const checkpoint = flow.saveTransactionState();
    const expected = clean(flow.saveState());
    const external = flow.saveState();
    external.snapshot.parcels[0].sourceRelease!.start[0] += 99;
    external.snapshot.parcels[0].sheetRelease!.velocity[1] -= 7;
    external.snapshot.parcels[0].sourceSection!.width += 4;
    expect(clean(flow.saveState())).toEqual(expected);
    flow.advanceTo(2 * dt, () => source);
    const accepted = clean(flow.saveState());
    flow.restoreTransactionState(checkpoint);
    flow.advanceTo(2 * dt, () => source);
    expect(clean(flow.saveState())).toEqual(accepted);
  });

  it('matches public-checkpoint recovery through source shutdown and reopening', () => {
    const compact = seeded(), publicOwner = seeded();
    for (let tick = 2; tick <= 8; tick++) {
      const c = compact.saveTransactionState(), p = publicOwner.saveState();
      const sample = () => ({ ...source, q: tick < 6 ? 0 : source.q });
      const first = compact.advanceTo(tick * dt, sample);
      publicOwner.advanceTo(tick * dt, sample);
      // A rejected downstream transaction rewinds both owners before replay.
      compact.restoreTransactionState(c); publicOwner.restoreState(p);
      expect(compact.advanceTo(tick * dt, sample)).toEqual(first);
      publicOwner.advanceTo(tick * dt, sample);
      expect(clean(compact.saveState())).toEqual(clean(publicOwner.saveState()));
    }
  });
});
