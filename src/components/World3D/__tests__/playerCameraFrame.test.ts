import {describe, expect, it} from 'vitest';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {playerCameraFrame, sameRoomCameraCompanions, type PlayerCameraRoom} from '../playerCameraFrame';
import * as THREE from 'three';
import {createPlayerCameraSightline} from '../playerCameraVisibility';

function fixture(parts: Array<Record<string, unknown>> = []): GroundWorld {
  return {cols: 1, rows: 1, heights: [0], buildings: [{id: 'home', xM: 100, zM: 100,
    cornersM: [{x: 95, z: 95}, {x: 105, z: 95}, {x: 105, z: 105}, {x: 95, z: 105}], parts}]} as unknown as GroundWorld;
}
const origin = {x: 80, z: 90};
const foot = Object.freeze({xM: 100, zM: 100, yM: 0});

describe('camera return to accepted footing', () => {
  it('uses a clear three-meter inn passage before collapsing the view to two meters', () => {
    // The played inn admits a three-meter arm while its walls reject four.
    // Model the same narrow, off-center passage with actual opaque geometry.
    const scene = new THREE.Scene(), building = new THREE.Group();
    building.name = 'world3d:site-building';
    for (const [x, z, w, d] of [[-.8, 0, .1, 8], [.8, 0, .1, 8], [0, 1.2, 2, .1], [0, -3.4, 2, .1]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), new THREE.MeshBasicMaterial());
      wall.position.set(x + 20, 1.5, z + 10); building.add(wall);
    }
    scene.add(building);
    const query = createPlayerCameraSightline(() => scene);
    const ground = fixture(), before = JSON.stringify(ground);
    const frame = playerCameraFrame(ground, foot, origin, 9, query)!;
    expect(Math.hypot(frame.position![0] - 20, frame.position![2] - 10)).toBeCloseTo(3);
    expect(frame.position![2]).toBeCloseTo(7);
    expect(query(frame.target, frame.position!)).toBeNull();
    expect(JSON.stringify(ground)).toBe(before);
    expect(foot).toEqual({xM: 100, zM: 100, yM: 0});
  });

  it('checks the eye-line at an indoor height instead of rejecting it at walking width', () => {
    const queried: number[] = [];
    const wall = {h: 10, colorHex: '#cfc7b8'};
    const ground = fixture([{...wall, x: 0, z: 0, w: 20, d: 20}]);
    const frame = playerCameraFrame(ground, foot, origin, 2, (_target, eye) => {
      queried.push(eye[1]); return eye[1] > 2 ? 0.5 : null;
    });
    expect(queried).toContain(2.6);
    expect(frame?.position?.[1]).toBe(1.85);
    expect(frame?.target).toEqual([20, 1.15, 10]);
  });
  it('does not claim a usable return when every rendered eye-line is blocked', () => {
    expect(playerCameraFrame(fixture(), foot, origin, 3, () => 0.1)).toBeNull();
  });
  it('uses actual footing and floating origin without changing either source', () => {
    const ground = fixture(), before = JSON.stringify(ground);
    const frame = playerCameraFrame(ground, foot, origin, 7)!;
    expect(frame).toMatchObject({kind: 'player', nonce: 7, target: [20, 1.15, 10]});
    expect(JSON.stringify(ground)).toBe(before);
    expect(foot).toEqual({xM: 100, zM: 100, yM: 0});
    expect(playerCameraFrame(ground, {...foot, xM: 104}, origin, 8)?.target).toEqual([24, 1.15, 10]);
  });
  it('frames only companions with the exact same source site, room, and floor', () => {
    const player: PlayerCameraRoom = {siteId: 'wf-plot-10-1', level: 0, roomId: 3};
    const same = {id:'elara',position: {xM: 106, zM: 100, yM: 0}, room: {...player}};
    const otherRoom = {id:'other-room',position: {xM: 108, zM: 100, yM: 0}, room: {...player, roomId: 4}};
    const otherFloor = {id:'other-floor',position: {xM: 109, zM: 100, yM: 3.048}, room: {...player, level: 1}};
    const otherSite = {id:'other-site',position: {xM: 110, zM: 100, yM: 0}, room: {...player, siteId: 'wf-plot-10-2'}};
    expect(sameRoomCameraCompanions(player, [same, otherRoom, otherFloor, otherSite, {...same, room: null}])).toEqual([same]);
    const frame = playerCameraFrame(fixture(), foot, origin, 11, () => null,
      {player, companions: [same, otherRoom, otherFloor, otherSite]})!;
    expect(frame).toMatchObject({kind:'party',target:[23, 1.15, 10]});
    expect(frame.position![0]).toBeGreaterThan(20);
    expect(frame.position![0]).toBeLessThan(34);
  });
  it('keeps player-only framing when room facts are absent or the same-room party is too far apart', () => {
    const player: PlayerCameraRoom = {siteId: 'wf-plot-10-1', level: 0, roomId: 3};
    const far = {id:'far',position: {xM: 120, zM: 100, yM: 0}, room: {...player}};
    expect(playerCameraFrame(fixture(), foot, origin, 12, undefined,
      {player: null, companions: [far]})?.target).toEqual([20, 1.15, 10]);
    expect(playerCameraFrame(fixture(), foot, origin, 13, undefined,
      {player, companions: [far]})?.target).toEqual([20, 1.15, 10]);
  });
  it('falls back to the player frame when the centered player ray is clear but the same-room companion is occluded', () => {
    const scene = new THREE.Scene(), player = new THREE.Group(), companion = new THREE.Group(), building = new THREE.Group();
    player.name='world3d:player'; companion.name='world3d:companion:elara'; building.name='world3d:site-building';
    player.position.set(20,0,10); companion.position.set(26,0,10);
    player.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1.7,.5),new THREE.MeshBasicMaterial()));
    companion.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1.7,.5),new THREE.MeshBasicMaterial()));
    const opaqueRoomEdge=new THREE.Mesh(new THREE.BoxGeometry(.1,3,20),new THREE.MeshBasicMaterial());
    opaqueRoomEdge.position.set(24.5,1.5,10);building.add(opaqueRoomEdge);scene.add(player,companion,building);
    const query=createPlayerCameraSightline(()=>scene,()=>0),playerRoom:PlayerCameraRoom={siteId:'wf-plot-10-1',level:0,roomId:3};
    expect(query([23,1.15,10],[20,2.6,5])).toBeNull();
    expect(query([26,1.15,10],[20,2.6,5],'elara')).not.toBeNull();
    const frame=playerCameraFrame(fixture(),foot,origin,14,query,{player:playerRoom,
      companions:[{id:'elara',position:{xM:106,zM:100,yM:0},room:playerRoom}]})!;
    expect(frame.target).toEqual([20,1.15,10]);
  });
  it('keeps both people in a small room by trying a shorter clear party arm', () => {
    const scene = new THREE.Scene(), building = new THREE.Group();
    building.name = 'world3d:site-building';
    for (const [name, x] of [['world3d:player', 20], ['world3d:companion:elara', 21]] as const) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.8, .4), new THREE.MeshBasicMaterial());
      body.name = name; body.position.set(x, .9, 10); scene.add(body);
    }
    // The played guest room rejects every wide arm. Keep its opaque walls
    // intact and look for a shorter view that still clears both real bodies.
    for (const [x, z, width, depth] of [[18.6, 10, .1, 4], [22.4, 10, .1, 4],
      [20.5, 8.1, 4, .1], [20.5, 11.9, 4, .1]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 6, depth),
        new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
      wall.position.set(x, 3, z); building.add(wall);
    }
    scene.add(building);
    const room: PlayerCameraRoom = {siteId:'wf-plot-10-1', level:0, roomId:3};
    const query = createPlayerCameraSightline(() => scene, () => 0);
    const frame = playerCameraFrame(fixture(), foot, origin, 15, query,
      {player:room, companions:[{id:'elara',position:{xM:101,zM:100,yM:0},room}]})!;
    expect(frame).toMatchObject({kind:'party',target:[20.5,1.15,10]});
    expect(Math.hypot(frame.position![0]-20.5,frame.position![2]-10)).toBeCloseTo(2);
    expect(query(frame.target,frame.position!)).toBeNull();
    expect(query([21,1.15,10],frame.position!,'elara')).toBeNull();
  });
  it('rejects the arm through a real wall and chooses the open street side', () => {
    const wall = {x: 1, z: 0, w: 0.12, d: 12, h: 10, colorHex: '#cfc7b8'};
    const frame = playerCameraFrame(fixture([wall]), foot, origin, 1)!;
    expect(frame.position![0]).toBeLessThan(20.7);
    expect(frame.position![2]).toBeGreaterThan(15);
    expect(frame.target).toEqual([20, 1.15, 10]);
  });
  it('fails closed when enclosed or missing footing instead of placing the camera across walls', () => {
    const wall = {h: 10, colorHex: '#cfc7b8'};
    const ground = fixture([
      {...wall, x: -0.7, z: 0, w: 0.12, d: 2}, {...wall, x: 0.7, z: 0, w: 0.12, d: 2},
      {...wall, x: 0, z: -0.7, w: 2, d: 0.12}, {...wall, x: 0, z: 0.7, w: 2, d: 0.12},
    ]);
    expect(playerCameraFrame(ground, foot, origin, 1)).toBeNull();
    expect(playerCameraFrame(ground, null, origin, 1)).toBeNull();
    expect(playerCameraFrame(null, foot, origin, 1)).toBeNull();
  });
});
