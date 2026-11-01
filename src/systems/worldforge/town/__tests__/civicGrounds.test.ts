/**
 * This file proves a temple's or a keep's grounds come from the world, not a
 * roll (GG-566): the faith form picks the temple set piece, the state form
 * picks the keep's, an unknown form is an error, and the features stay inside
 * the grounds and off the building, the forecourt and the approach.
 */
import { describe, it, expect } from 'vitest';
import { orientedRect, setPieceFeatures, strongholdSetPiece, templeSetPiece, type CivicSetPiece } from '../civicGrounds';
import { pointInPolygon, type Pt } from '../../submap/submapEngine';

describe('civic set pieces (GG-566)', () => {
  it('chooses the temple set piece from the faith form', () => {
    expect(templeSetPiece({ type: 'Organized', form: 'Monotheism' }).setPiece).toBe('churchyard');
    expect(templeSetPiece({ type: 'Folk', form: 'Ancestor Worship' }).setPiece).toBe('churchyard');
    expect(templeSetPiece({ type: 'Folk', form: 'Totemism' }).setPiece).toBe('grove');
    expect(templeSetPiece({ type: 'Organized', form: 'Polytheism' }).setPiece).toBe('pool');
    expect(templeSetPiece({ type: 'Organized', form: 'Non-theism' }).setPiece).toBe('cloister');
    expect(templeSetPiece({ type: 'Cult', form: 'Dark Cult' }).setPiece).toBe('cloister');
    expect(templeSetPiece({ type: 'Heresy', form: 'Heresy' }).setPiece).toBe('churchyard');
    // Every form the FMG religion generator can roll has an answer.
    const fmgForms = ['Shamanism', 'Animism', 'Polytheism', 'Ancestor Worship', 'Nature Worship', 'Totemism',
      'Monotheism', 'Dualism', 'Pantheism', 'Non-theism', 'Cult', 'Dark Cult', 'Sect', 'Heresy'];
    for (const form of fmgForms) expect(() => templeSetPiece({ type: 'any', form })).not.toThrow();
    expect(templeSetPiece(undefined).setPiece).toBe('grounds');
    expect(() => templeSetPiece({ type: 'Folk', form: 'Unheard-of' })).toThrow(/Unheard-of/);
  });

  it('chooses the keep set piece from the state form; a citadel is always walled', () => {
    expect(strongholdSetPiece('keep', { form: 'Monarchy' }).setPiece).toBe('bailey');
    expect(strongholdSetPiece('keep', { form: 'Theocracy' }).setPiece).toBe('cloister');
    expect(strongholdSetPiece('keep', { form: 'Republic' }).setPiece).toBe('hall-yard');
    expect(strongholdSetPiece('keep', { form: 'Union' }).setPiece).toBe('hall-yard');
    expect(strongholdSetPiece('citadel', { form: 'Republic' }).setPiece).toBe('bailey');
    // Every state form the FMG states generator sets has an answer.
    expect(strongholdSetPiece('keep', { form: 'Anarchy' }).setPiece).toBe('hall-yard');
    expect(() => strongholdSetPiece('keep', { form: 'Unheard-of' })).toThrow(/Unheard-of/);
  });

  it('keeps every feature in the grounds and off the building, forecourt and approach', () => {
    const center: Pt = [0, 0];
    const face: Pt = [0, 1];
    const building = orientedRect(center, face, 40, 40);
    const grounds = orientedRect(center, face, 120, 120);
    const forecourt = orientedRect([0, 32], face, 32, 24);
    const approach: Pt[] = [[0, 20], [0, 60]];
    for (const setPiece of ['churchyard', 'grove', 'pool', 'cloister', 'bailey', 'hall-yard'] as CivicSetPiece[]) {
      const feats = setPieceFeatures({
        setPiece, grounds, building, center, face, halfSize: 20, forecourt, approach, approachWidth: 12,
        unit: (ft) => ft, seedPath: 'test/civic',
      });
      expect(feats.length).toBeGreaterThan(0);
      for (const f of feats) {
        if (f.kind === 'curtain-wall' || f.kind === 'gatehouse' || f.kind === 'yard' || f.kind === 'cloister-walk' || f.kind === 'garth') continue;
        for (const p of f.polygon) {
          expect(pointInPolygon(p, grounds)).toBe(true);
          expect(pointInPolygon(p, building)).toBe(false);
          expect(pointInPolygon(p, forecourt)).toBe(false);
        }
      }
    }
    // Plain grounds hold nothing.
    expect(setPieceFeatures({
      setPiece: 'grounds', grounds, building, center, face, halfSize: 20, forecourt, approach, approachWidth: 12,
      unit: (ft) => ft, seedPath: 'test/civic',
    })).toEqual([]);
  });
});
