import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonsterData } from '../../../../types/ui';
import { resolveSurfaceHostileTemplate } from '../surfaceHostileTemplate';

const registry = vi.hoisted(() => ({ ensure: vi.fn(), get: vi.fn() }));
vi.mock('../../../../data/adapters/runtimeMonsterRegistry', () => ({
  ensureMonsterRegistryLoaded: registry.ensure,
  getMonster: registry.get,
}));
const bandit = {
  id: 'bandit', name: 'Bandit', maxHP: 11, armorClass: 12,
  baseStats: { cr: '1/8' },
} as MonsterData;
beforeEach(() => { vi.clearAllMocks(); registry.ensure.mockResolvedValue(undefined); registry.get.mockReturnValue(bandit); });

describe('source surface creature template validation', () => {
  it('preserves the authored Highwayman CR conflict instead of substituting a weaker Bandit', async () => {
    const result = await resolveSurfaceHostileTemplate({id: 'source-h', name: 'Highwayman', monsterId: 'Bandit'});
    expect(result).toEqual({status: 'source-gap', detail: 'Its source declares CR 3, but the Bandit template is CR 1/8.'});
    expect(registry.get).toHaveBeenCalledExactlyOnceWith('Bandit');
  });
  it('uses the stable bestiary key and exact canonical CR, retaining the source alias', async () => {
    const result = await resolveSurfaceHostileTemplate({id: 'source-b', name: 'Roadside lookout', monsterId: 'Bandit'});
    expect(result).toMatchObject({status: 'ready', monster: {id: 'bandit', name: 'Roadside lookout', quantity: 1, cr: '1/8'}});
  });
  it('waits for catalog readiness before looking up a template', async () => {
    let release!: () => void;
    registry.ensure.mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
    const pending = resolveSurfaceHostileTemplate({id: 'b', name: 'Bandit', monsterId: 'Bandit'});
    expect(registry.get).not.toHaveBeenCalled();
    release(); await expect(pending).resolves.toMatchObject({status: 'ready'});
  });
  it('does not replace a missing explicit template by looking up the display alias', async () => {
    registry.get.mockReturnValueOnce(undefined);
    expect(await resolveSurfaceHostileTemplate({id: 'source-b', name: 'Bandit', monsterId: 'Missing Template'})).toMatchObject({status: 'source-gap'});
    expect(registry.get).toHaveBeenCalledExactlyOnceWith('Missing Template');
  });
  it('refuses a missing source identity before catalog work', async () => {
    expect(await resolveSurfaceHostileTemplate({id: '', name: 'Bandit', monsterId: 'Bandit'})).toMatchObject({status: 'source-gap'});
    expect(registry.ensure).not.toHaveBeenCalled();
  });
  it('propagates loader failure instead of returning a generic enemy', async () => {
    registry.ensure.mockRejectedValueOnce(new Error('catalog unavailable'));
    await expect(resolveSurfaceHostileTemplate({id: 'b', name: 'Bandit', monsterId: 'Bandit'})).rejects.toThrow('catalog unavailable');
    expect(registry.get).not.toHaveBeenCalled();
  });
  it('keeps CR zero as an authored value', async () => {
    registry.get.mockReturnValueOnce({...bandit, id: 'zero', baseStats: {cr: '0'}});
    expect(await resolveSurfaceHostileTemplate({id: 'z', name: 'Small creature', monsterId: 'zero'})).toMatchObject({status: 'ready', monster: {cr: '0'}});
  });
  it.each([{maxHP: 0}, {armorClass: NaN}, {baseStats: {cr: 'unknown'}}, {baseStats: {}}, {baseStats: {cr: '3junk'}}, {baseStats: {cr: '1/0'}}])('refuses incomplete bestiary statistics %j', async partial => {
    registry.get.mockReturnValueOnce({...bandit, ...partial});
    expect(await resolveSurfaceHostileTemplate({id: 'b', name: 'Roadside lookout', monsterId: 'Bandit'})).toEqual({status: 'source-gap', detail: 'Its Bandit bestiary profile has incomplete combat statistics.'});
  });
});
