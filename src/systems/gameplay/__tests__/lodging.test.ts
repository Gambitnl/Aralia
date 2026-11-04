/** Money, source ownership and rest benefits must commit once without moving
 * the party. Fixtures exercise refusals rather than manufacturing runtime play. */
import { describe, expect, it } from 'vitest';
import {surfaceFixture} from '../../combat/worldScenario/__tests__/surfaceHostileFixtures';
import {reconcileSurfaceHostileOutcome} from '../../combat/worldScenario/surfaceHostileContinuity';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import { characterReducer } from '../../../state/reducers/characterReducer';
import { worldReducer } from '../../../state/reducers/worldReducer';
import { townBuildingVisit } from '../../../components/Worldforge/townBuildingVisit';
import { guestBedsForVisit, guestBedsWithStairAccess, guestBedStairIssue, guestBedDescription, lodgingKeeperOnDuty, lodgingOfferError, lodgingRestError, reserveLodging, submergedRestError, propertyRestError, rememberRestGround, restEnvironmentError } from '../lodging';
import type { GroundWorld } from '../../worldforge/bridge/groundChunkLoader';
import { metersToHeight } from '../../world3d/config';
import type { LodgingOffer, LodgingRestAdmission } from '../../../types/rest';
import type { WorldBusiness } from '../../../types/business';
import { enterDungeonExpedition, recordDungeonProgress, retreatDungeonExpedition } from '../../worldforge/dungeon/world/dungeonLifecycle';
import { canonicalDungeonId } from '../../worldforge/dungeon/world/dungeonIdentity';
import { GROUND_METERS_PER_CELL } from '../../worldforge/bridge/groundWorldAdapter';

const offer: LodgingOffer = {
  businessId: 'inn', businessName: 'Source inn', keeperId: 'keeper', keeperName: 'Bram',
  worldSeed: 1793176259475, cellId: 1389, locationId: 'cell_1389', burgId: 1, plotId: 106,
  partyIds: ['brea'], beds: [{level: 0, index: 0, roomId: 6}], costGp: 0.5,
  quotedAt: '0351-01-01T08:00:00.000Z',
};
function sourceGround(overrides: Partial<GroundWorld> = {}): GroundWorld {
  return {cols: 4, rows: 4, heights: Array(16).fill(0), biomeIds: Array(16).fill('plains'), extentMetersX: 4, extentMetersZ: 4,
    features: [], props: [], hostiles: [], hiddenSites: [], dungeonEntrances: [], rivers: [], roads: [], walls: [], waterBodies: [],
    decks: [], gatehouses: [], towns: [], buildings: [], rosters: [], occupants: [], ...overrides};
}
function fixture() {
  return createMockGameState({
    worldSeed: offer.worldSeed, currentLocationId: offer.locationId,
    playerCell: {cellId: offer.cellId, localeCoords: null},
    playerGroundPos: {tileX: 1389, tileY: 0, xM: 40, zM: 50, yM: 0},
    gameTime: new Date(offer.quotedAt), gold: 18.49, lastLongRestAt: null,
    party: [createMockPlayerCharacter({id: 'brea', hp: 3, maxHp: 10})],
    worldBusinesses: {inn: {id: 'inn', ownerId: 'keeper', locationId: offer.locationId, burgId: 1, plotId: 106} as WorldBusiness},
  });
}
function booked() {
  const state = fixture();
  const next = {...state, ...reserveLodging(state, offer)};
  const admission: LodgingRestAdmission = {reservationId: next.lodgingReservations![0].id,
    bed: offer.beds[0], position: {...next.playerGroundPos!}};
  return {state: next, admission};
}

describe('source lodging', () => {
  it('keeps four source bed identities while refusing new legacy-stair offers', () => {
    // Same bed/chest index pattern as the observed inn; geometry and source
    // generation are qualified separately by native play, not by this fixture.
    const visit = {plan: {type:'inn', stairs:[{fromLevel:0,x:7.5,y:2.5}], floors:[{level:1,
      rooms:[{id:0,purpose:'guest-room'},{id:1,purpose:'guest-room'}],
      furnishings:[{kind:'bed',roomId:0},{kind:'chest',roomId:0},{kind:'bed',roomId:0},{kind:'bed',roomId:1},{kind:'chest',roomId:1},{kind:'bed',roomId:1}]}]}} as unknown as ReturnType<typeof townBuildingVisit>;
    const before = JSON.stringify(visit);
    const beds = guestBedsForVisit(visit);
    expect(beds).toHaveLength(4);
    expect(beds[0]).toEqual({level: 1, index: 0, roomId: 0});
    expect(guestBedsWithStairAccess(visit)).toEqual([]);
    expect(guestBedStairIssue(visit, beds[0])).toContain('No usable stair route');
    expect(guestBedsForVisit(visit)).toEqual(beds);
    expect(JSON.stringify(visit)).toBe(before);
  });
  it('retains ground offers and requires a return flight at every intermediate storey', () => {
    const visit = {plan:{type:'inn', stairs:[{fromLevel:0,x:0,y:0,layout:{kind:'return'}}], floors:[
      {level:0,rooms:[{id:0,purpose:'guest-room'}],furnishings:[{kind:'bed',roomId:0},{kind:'bed',roomId:0}]},
      {level:1,rooms:[{id:0,purpose:'guest-room'}],furnishings:[{kind:'bed',roomId:0}]},
      {level:2,rooms:[{id:0,purpose:'guest-room'}],furnishings:[{kind:'bed',roomId:0}]},
    ]}} as unknown as ReturnType<typeof townBuildingVisit>;
    const beds = guestBedsForVisit(visit), offered = guestBedsWithStairAccess(visit);
    expect(beds).toHaveLength(4);
    expect(offered.filter(bed => bed.level === 0)).toHaveLength(2);
    expect(offered.some(bed => bed.level === 1)).toBe(true);
    expect(offered.some(bed => bed.level === 2)).toBe(false);
    expect(offered.every(bed => guestBedStairIssue(visit, bed) === null)).toBe(true);
  });
  it('refuses the actual published river bank overdraw without widening the town water to its regional width', () => {
    const ground = sourceGround({rivers: [{sourceKind: 'river', points: [{x: 10, z: 64}, {x: 110, z: 64}],
      widthM: 68, surfaceWidthM: [4, 4], waterlineY: [6, 4]}]});
    expect(submergedRestError(ground, {xM: 60, zM: 67, yM: 4})).toContain('below the water');
    expect(submergedRestError(ground, {xM: 60, zM: 68, yM: 4})).toBeNull();
    expect(submergedRestError(ground, {xM: NaN, zM: 64, yM: 4})).toContain('footing must be verified');
  });
  it('refuses the current dungeon visit before using its retained outside body as a campsite', async () => {
    const state = fixture();
    const seedPath = `wf:${state.worldSeed}/cell:${offer.cellId}/dungeon:m28`;
    const identity = {seedPath, dungeonId: canonicalDungeonId(seedPath)};
    const entered = enterDungeonExpedition(identity);
    const current = recordDungeonProgress(entered, {activeVisit: {depth: 0, playerCell: {x: 1, y: 1}, entranceKind: 'ruin-door',
      returnContext: {worldSeed: state.worldSeed!, cellId: offer.cellId, ...state.playerGroundPos!}}});
    // This fixture exercises only the two source-water collections read here.
    rememberRestGround(state, sourceGround());
    const visiting = {...state, dungeonExpeditions: {[identity.dungeonId]: current}};
    expect(await restEnvironmentError(visiting)).toContain('inside this expedition');
    expect(await propertyRestError({...visiting, playerGroundPos: null})).toContain('inside this expedition');
    // A completed/revisited dungeon is still physically occupied.
    expect(await restEnvironmentError({...visiting, dungeonExpeditions: {[identity.dungeonId]: {...current, completion: 'completed' as const}}})).toContain('inside this expedition');
    for (const record of [entered, retreatDungeonExpedition(current)]) {
      expect(await restEnvironmentError({...state, dungeonExpeditions: {[identity.dungeonId]: record}})).toBeNull();
    }
    // A foreign frame may fail its own ground check; it must not inherit this
    // dungeon's physical presence or be declared a qualified outside campsite.
    expect((await restEnvironmentError({...visiting, playerCell: {cellId: offer.cellId + 1, localeCoords: null}})) ?? '').not.toContain('inside this expedition');
    expect((await restEnvironmentError({...visiting, worldSeed: state.worldSeed! + 1})) ?? '').not.toContain('inside this expedition');
  });
  it('uses the loader’s retained water source and refuses to reuse it for another ground frame', async () => {
    const state = fixture();
    state.playerGroundPos = {tileX: 1389, tileY: 0, xM: 5, zM: 0, yM: -5};
    const ground = sourceGround({rivers: [{points: [{x: 0, z: 0}, {x: 10, z: 0}], widthM: 4, waterlineY: [3, 2]}], waterRuns: []});
    rememberRestGround(state, ground);
    expect(await restEnvironmentError(state)).toContain('below the water');
    const foreign = {...state, entry3DAnchor: {cellId: 1400}};
    expect(await restEnvironmentError(foreign)).toContain('could not be verified');
  });
  it('rejects a camp below the drawn river or pond, but allows an actual dry bridge-height position', () => {
    const ground = sourceGround({rivers: [{points: [{x: 0, z: 0}, {x: 10, z: 0}], widthM: 4, waterlineY: [3, 2]}],
      waterBodies: [{kind: 'lake', pointsM: [{x: 20, z: 20}, {x: 25, z: 20}, {x: 25, z: 25}, {x: 20, z: 25}], surfaceY: 4}]});
    expect(submergedRestError(ground, {xM: 5, zM: 0, yM: -5})).toContain('below the water');
    expect(submergedRestError(ground, {xM: 22, zM: 22, yM: 3})).toContain('below the water');
    expect(submergedRestError(ground, {xM: 5, zM: 0, yM: 3})).toBeNull();
    expect(submergedRestError(ground, {xM: 5, zM: 8, yM: -5})).toBeNull();
  });
  it('retains refusal for a valid source-grid hydrology pool as well as town-plan water', () => {
    const m = GROUND_METERS_PER_CELL, cols = 40, rows = 40;
    const ground = sourceGround({cols, rows, heights: Array(cols * rows).fill(0), biomeIds: Array(cols * rows).fill('plains'),
      extentMetersX: cols * m, extentMetersZ: rows * m,
      waterRuns: Array.from({length: 4}, (_, row) => ({minX: 18 * m, maxX: 22 * m,
        minZ: (18 + row) * m, maxZ: (19 + row) * m, surfaceEnc: metersToHeight(4)}))});
    expect(submergedRestError(ground, {xM: 20 * m, zM: 20 * m, yM: 3})).toContain('below the water');
  });
  it('resolves the played legacy ground frame and refuses its submerged campsite', async () => {
    const state = fixture();
    state.entry3DAnchor = {cellId: 1389, centerPx: [521.4, 167.91]};
    state.playerGroundPos = {tileX: 1389, tileY: 0, xM: 461.7653487070642, zM: 440.5069050835613, yM: -5.4327929628891685};
    expect(await propertyRestError(state)).toContain('below the water');
  });
  it('offers actual guest beds in staffed inn 106, but no retired keeper consent in inn 3', () => {
    const active = townBuildingVisit(offer.worldSeed, 1, 106);
    expect(guestBedsForVisit(active).length).toBeGreaterThan(0);
    expect(guestBedDescription(active, guestBedsForVisit(active)[0])).toBe('Room 5, ground floor');
    expect(lodgingKeeperOnDuty(active, 8)).toBe(true);
    expect(lodgingKeeperOnDuty(townBuildingVisit(offer.worldSeed, 1, 3), 8)).toBe(false);
    expect(guestBedsForVisit(townBuildingVisit(offer.worldSeed, 1, 52))).toEqual([]);
    for (const bed of guestBedsForVisit(active)) {
      const floor = active.plan.floors.find(f => f.level === bed.level)!;
      const room = floor.rooms.find(r => r.id === bed.roomId)!;
      expect(room.purpose).toBe('guest-room');
      expect(room.forSlot).toBeFalsy();
      expect(floor.furnishings[bed.index].kind).toBe('bed');
    }
  });
  it('pays once and persists permission without recovery, elapsed time or relocation', () => {
    const before = fixture();
    const after = {...before, ...worldReducer(before, {type: 'RESERVE_LODGING', payload: offer})};
    expect(after.gold).toBe(17.99);
    expect(after.lodgingReservations).toHaveLength(1);
    expect(after.party).toEqual(before.party);
    expect(after.gameTime).toEqual(before.gameTime);
    expect(after.playerGroundPos).toEqual(before.playerGroundPos);
    expect(reserveLodging(after, offer)).toEqual({});
  });
  it.each(['funds', 'owner', 'party', 'place', 'expired', 'malformed'] as const)('refuses %s without any coin or permission update', reason => {
    const state = fixture();
    const quote = structuredClone(offer);
    if (reason === 'funds') state.gold = 0.49;
    if (reason === 'owner') quote.keeperId = 'replacement';
    if (reason === 'party') quote.partyIds = ['other'];
    if (reason === 'place') state.currentLocationId = 'cell_8';
    if (reason === 'expired') state.gameTime = new Date('0351-01-01T08:06:00Z');
    if (reason === 'malformed') quote.beds[0].index = -1;
    expect(lodgingOfferError(state, quote)).toBeTruthy();
    expect(reserveLodging(state, quote)).toEqual({});
  });
  it('consumes the paid night with accepted recovery and rejects repeated benefits', () => {
    const {state, admission} = booked();
    const after = {...state, ...characterReducer(state, {type: 'LONG_REST', payload: {lodgingRestAdmission: admission}})};
    expect(after.party[0].hp).toBe(10);
    expect(after.lodgingReservations![0].usedAt).toBe('0351-01-01T16:00:00.000Z');
    expect(after.gold).toBe(state.gold);
    expect(after.playerGroundPos).toEqual(state.playerGroundPos);
    expect(characterReducer(after, {type: 'LONG_REST', payload: {lodgingRestAdmission: admission}})).toEqual({});
  });
  it('leaves an unused night intact when recovery is on cooldown', () => {
    const {state, admission} = booked();
    state.lastLongRestAt = '0351-01-01T07:00:00.000Z';
    const after = {...state, ...characterReducer(state, {type: 'LONG_REST', payload: {lodgingRestAdmission: admission}})};
    expect(after.lodgingReservations![0].usedAt).toBeUndefined();
    expect(after.party).toEqual(state.party);
  });
  it.each(['moved', 'expired', 'other-bed', 'other-party'] as const)('refuses %s bed admission without recovery or consumption', reason => {
    const {state, admission} = booked();
    if (reason === 'moved') state.playerGroundPos = {...state.playerGroundPos!, xM: 43};
    if (reason === 'expired') state.gameTime = new Date('0351-01-02T01:00:01Z');
    if (reason === 'other-bed') admission.bed = {...admission.bed, index: 8};
    if (reason === 'other-party') state.party[0] = {...state.party[0], id: 'other'};
    expect(lodgingRestError(state, admission)).toBeTruthy();
    expect(characterReducer(state, {type: 'LONG_REST', payload: {lodgingRestAdmission: admission}})).toEqual({});
  });
});

describe('lodging earned currency', () => {
  it('pays the posted night with carried coins and commits permission exactly once', () => {
    const before=fixture();before.gold=0.1;
    const coin={id:'gold_piece',quantity:8,sourceId:'cache9',containerId:'pouch',acquiredAt:42} as unknown as import('../../../types').Item;
    before.inventory=[coin];
    expect(lodgingOfferError(before,offer)).toBeNull();
    const after={...before,...reserveLodging(before,offer)};
    expect(after.gold).toBe(0.6);
    expect(after.inventory).toEqual([{...coin,quantity:7}]);
    expect(after.lodgingReservations).toHaveLength(1);
    expect(after.playerGroundPos).toEqual(before.playerGroundPos);
    expect(after.party).toEqual(before.party);
    expect(reserveLodging(after,offer)).toEqual({});
    expect(before.inventory[0]).toBe(coin);expect(coin.quantity).toBe(8);
  });
  it('leaves earned coin records intact when liquid money covers the night', () => {
    const before=fixture();const coin={id:'electrum_piece',quantity:2,sourceId:'earned'} as unknown as import('../../../types').Item;
    before.inventory=[coin];const after=reserveLodging(before,offer);
    expect(after.gold).toBe(17.99);expect(after.inventory![0]).toBe(coin);
  });
});

describe('immediate surface danger and ordinary rest',()=>{
  it('refuses the same immediate hostile contact as combat without changing resources or time',async()=>{
    const f=surfaceFixture();rememberRestGround(f.state,sourceGround({hostiles:[f.args.hostile]}));
    const before=JSON.stringify(f.state);
    expect(await restEnvironmentError(f.state)).toContain('Bandit is too close');
    expect(JSON.stringify(f.state)).toBe(before);
    const boundary={...f.state,playerGroundPos:{...f.state.playerGroundPos!,xM:f.args.hostile.xM-4,zM:f.args.hostile.zM}};
    expect(await restEnvironmentError(boundary)).toBeNull();
  });
  it('does not turn a defeated saved source body into a living rest threat',async()=>{
    const f=surfaceFixture();rememberRestGround(f.state,sourceGround({hostiles:[f.args.hostile]}));
    const result=reconcileSurfaceHostileOutcome(f.state,[{...f.enemySnapshot,currentHP:0}],[{...f.partySnapshot,position:{x:5,y:5}}],'victory',true);
    if(result.status!=='ready')throw Error('missing source outcome');
    expect(await restEnvironmentError({...f.state,...result.patch})).toBeNull();
  });
  it('checks the surviving creature\'s accepted meters rather than its stale generated spawn',async()=>{
    const f=surfaceFixture();rememberRestGround(f.state,sourceGround({hostiles:[f.args.hostile]}));
    const result=reconcileSurfaceHostileOutcome(f.state,[f.enemySnapshot],[{...f.partySnapshot,position:{x:5,y:5}}],'flee',false);
    if(result.status!=='ready')throw Error('missing source outcome');
    expect(await restEnvironmentError({...f.state,...result.patch})).toBeNull();
  });
});


describe('rest geometry cache source identity',()=>{
  function town(revision:1|2){return {burgId:1,layoutRevision:revision,villagers:{},
    chronicle:{burgId:1,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:1};}
  function wet(){return sourceGround({rivers:[{points:[{x:0,z:0},{x:10,z:0}],widthM:4,waterlineY:[3,2]}],waterRuns:[]});}
  function stateAtSource(){const state=fixture();state.playerGroundPos={tileX:1389,tileY:0,xM:5,zM:0,yM:0};return state;}
  it('does not reuse another saved layout footing verdict at the same position',async()=>{
    const first={...stateAtSource(),townSim:{1:town(1)}};
    const second={...first,townSim:{1:town(2)}};
    rememberRestGround(first,wet());rememberRestGround(second,sourceGround());
    expect(await restEnvironmentError(first)).toContain('below the water');
    expect(await restEnvironmentError(second)).toBeNull();
  });
  it('separates admitted household layouts over the same observed foundation',async()=>{
    // Remembered worlds isolate cache identity; these partial source fixtures
    // do not admit a layout or prove a property permission.
    const first={...stateAtSource(),townSim:{1:{...town(2),buildingSources:{4:{planSignature:'same-observation'} as never}}}};
    const second={...first,townSim:{1:{...town(2),buildingSources:{4:{planSignature:'same-observation',householdRevision:{planSignature:'admitted-household'}} as never}}}};
    const before=JSON.stringify({first,second});
    rememberRestGround(first,wet());rememberRestGround(second,sourceGround());
    expect(await restEnvironmentError(first)).toContain('below the water');
    expect(await restEnvironmentError(second)).toBeNull();
    expect(JSON.stringify({first,second})).toBe(before);
  });
  it('separates retained building fingerprints without treating them as admission proof',async()=>{
    // Only the source fingerprint is consulted in this remembered-ground test.
    // The partial fixtures do not qualify a building source or any migration.
    const first={...stateAtSource(),townSim:{1:{...town(1),buildingSources:{4:{planSignature:'observed-a'} as never}}}};
    const second={...first,townSim:{1:{...town(1),buildingSources:{4:{planSignature:'observed-b'} as never}}}};
    const before=JSON.stringify({first,second});
    rememberRestGround(first,wet());rememberRestGround(second,sourceGround());
    expect(await restEnvironmentError(first)).toContain('below the water');
    expect(await restEnvironmentError(second)).toBeNull();
    expect(JSON.stringify({first,second})).toBe(before);
  });
});
