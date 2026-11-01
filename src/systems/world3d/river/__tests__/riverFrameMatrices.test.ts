/** Uses real scene transforms to check both cameras see current positions without a duplicate walk. */
import { describe, expect, it, vi } from 'vitest';
import { Object3D, Scene, Vector3 } from 'three';
import { shareRiverWorldMatrices } from '@/components/World3D/water/riverFrameMatrices';

describe('river reflection and main world-matrix reuse', () => {
  it('shares current nested object positions and refreshes them on the next frame', () => {
    const scene = new Scene();
    const bank = new Object3D(); const rock = new Object3D();
    bank.position.set(5, 2, 0); rock.position.set(1, 3, 4);
    bank.add(rock); scene.add(bank);
    const update = vi.spyOn(scene, 'updateMatrixWorld');
    const positions: number[][] = [];
    const draw = () => {
      // This is the renderer's existing automatic-update contract. Camera
      // changes do not alter the objects' shared world transforms.
      if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
      positions.push(new Vector3().setFromMatrixPosition(rock.matrixWorld).toArray());
    };
    shareRiverWorldMatrices(scene, () => { draw(); draw(); });
    expect(positions).toEqual([[6, 5, 4], [6, 5, 4]]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(scene.matrixWorldAutoUpdate).toBe(true);
    rock.position.y = 7;
    shareRiverWorldMatrices(scene, () => { draw(); draw(); });
    expect(positions.slice(-2)).toEqual([[6, 9, 4], [6, 9, 4]]);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('restores automatic updates after a failed reflection draw', () => {
    const scene = new Scene();
    expect(() => shareRiverWorldMatrices(scene, () => { throw new Error('renderer failed'); })).toThrow('renderer failed');
    expect(scene.matrixWorldAutoUpdate).toBe(true);
  });

  it('respects a scene whose caller owns manual transforms', () => {
    const scene = new Scene(); scene.matrixWorldAutoUpdate = false;
    const update = vi.spyOn(scene, 'updateMatrixWorld');
    shareRiverWorldMatrices(scene, () => {});
    expect(update).not.toHaveBeenCalled();
    expect(scene.matrixWorldAutoUpdate).toBe(false);
  });
});
