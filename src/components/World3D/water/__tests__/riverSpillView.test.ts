import { describe, expect, it, vi } from 'vitest';
import { buildSpillDisplayGeometry, buildSpillNappeGeometry, spillNappeEdges, spillNappeStations, trimSpillSurface, RiverSpillView, NAPPE_EDGES, NAPPE_JOIN_S, type SpillDisplayPacket } from '../riverSpillView';
import { breakupLengthM, coherentSpreadRate } from '@/systems/world3d/waterfall/waterfallTypes';
import { buildWaterSheetArrays } from '@/systems/world3d/river/riverWaterSheet';
import * as THREE from 'three/webgpu';
import { updateSpillInstances } from '../riverSpillInstances';

// This control tests display ownership/timing, independently of the native
// optical graph that is separately compiled and compared in the live renderer.
vi.mock('../riverWaterfallView',()=>({materialSheetMaterial:()=>new THREE.MeshBasicMaterial()}));

describe('airborne spill display ownership', () => {
  it('rotates emitting-face span, normals and conserved volume with the course',()=>{
    const angle=.63,c=Math.cos(angle),s=Math.sin(angle),rotation=new THREE.Matrix4().makeRotationY(-angle);
    const p:SpillDisplayPacket={id:1,faceId:'1:2',faceAxis:'x',birth:0,volume:.003,width:.5,releaseDuration:.05,releasePosition:[0,0,0],releaseVelocity:[1,0,.4],position:[1,3,2],velocity:[1,-6,.4]};
    const vector=(v:[number,number,number]):[number,number,number]=>[c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]];
    const rotated={...p,position:vector(p.position),velocity:vector(p.velocity),releasePosition:vector(p.releasePosition),releaseVelocity:vector(p.releaseVelocity),releaseAcross:vector([0,0,1])};
    const baseline=buildSpillDisplayGeometry([p]).applyMatrix4(rotation),candidate=buildSpillDisplayGeometry([rotated]);
    for(const name of ['position','normal','materialAcross','materialPlane'] as const){
      // applyMatrix4 turns positions/normals only. Optical directions require
      // the same independent rotation, without translation or width changes.
      const original=baseline.getAttribute(name),actual=candidate.getAttribute(name);
      for(let i=0;i<actual.count;i++){
        const expected=new THREE.Vector3().fromBufferAttribute(original,i);
        if(name!=='position'&&name!=='normal')expected.transformDirection(rotation);
        expect(new THREE.Vector3().fromBufferAttribute(actual,i).distanceTo(expected)).toBeLessThan(1e-6);
      }
    }
    const material=new THREE.MeshBasicMaterial(),mesh=updateSpillInstances([rotated],material),matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
    expect(matrix.determinant()).toBeCloseTo(p.volume,8);
    const base=mesh.geometry.getAttribute('position');
    for(let i=0;i<base.count;i++)expect(new THREE.Vector3().fromBufferAttribute(base,i).applyMatrix4(matrix).distanceTo(new THREE.Vector3().fromBufferAttribute(candidate.getAttribute('position'),i))).toBeLessThan(1e-6);
    baseline.dispose();candidate.dispose();mesh.geometry.dispose();mesh.dispose();material.dispose();
  });
  it('tiles a uniform emitted face under sideways flow without changing volume',()=>{
    const material=new THREE.MeshBasicMaterial();
    const p:SpillDisplayPacket={id:1,faceId:'1:2',faceAxis:'x',birth:0,volume:.003,width:.5,releaseDuration:.05,releasePosition:[0,0,0],releaseVelocity:[1,0,1],position:[0,0,0],velocity:[1,0,1]};
    const packets=[p,{...p,id:2,position:[0,0,.5] as [number,number,number]}];
    const matrix=new THREE.Matrix4();
    for(const shear of [false,true]){
      const mesh=updateSpillInstances(packets,material,undefined,shear);
      mesh.getMatrixAt(0,matrix);const a=new THREE.Vector3(.5,-.5,-.5).applyMatrix4(matrix);
      mesh.getMatrixAt(1,matrix);const b=new THREE.Vector3(-.5,-.5,-.5).applyMatrix4(matrix);
      if(shear)expect(a.distanceTo(b)).toBeLessThan(1e-7);
      else expect(a.distanceTo(b)).toBeGreaterThan(.35);
      expect(matrix.determinant()).toBeCloseTo(p.volume,8);
      mesh.geometry.dispose();mesh.dispose();
    }
    material.dispose();
  });
  it('keeps identical births and contact removal in both drawing paths',()=>{
    let now=0;const clock=vi.spyOn(performance,'now').mockImplementation(()=>now);
    const p:SpillDisplayPacket={id:1,faceId:'1:2',faceAxis:'x',birth:.25,arrivalTime:.75,volume:.03,width:.75,releaseDuration:.02,releasePosition:[0,0,0],releaseVelocity:[2,0,1],position:[1,3,2],velocity:[2,-3,1]};
    try{for(const instanced of [false,true]){
      now=1000;
      const view=new RiverSpillView({} as ConstructorParameters<typeof RiverSpillView>[0]);
      // The prism paths; the falling sheet (the default) has its own tests below.
      view.useSheet(false);view.useInstances(instanced);view.setSnapshot({time:0,packets:[]});
      now=2000;view.setSnapshot({time:1,packets:[],arrived:[p]});
      for(const [milliseconds,count]of [[2200,0],[2500,1],[2750,0]] as const){
        now=milliseconds;view.update();
        if(instanced){const child=view.mesh.children[0] as THREE.InstancedMesh;expect(child.count).toBe(count);}
        else expect(view.mesh.geometry.drawRange.count).toBe(count*36);
        expect(view.mesh.visible).toBe(count>0);
      }
      view.dispose();
    }}finally{clock.mockRestore();}
  });
  it('keeps instanced prism volume, normals and physical optical coordinates',()=>{
    const material=new THREE.MeshBasicMaterial(),matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
    for(const shear of [false,true])for(const faceAxis of ['x','z'] as const)for(const vertical of [0,-3,-10]){
      const p:SpillDisplayPacket={id:1,faceId:'1:2',faceAxis,birth:0,volume:.03,width:.75,releaseDuration:.02,releasePosition:[0,0,0],releaseVelocity:[2,0,1],position:[0,0,0],velocity:[2,vertical,1]};
      const mesh=updateSpillInstances([p],material,undefined,shear),fresh=buildSpillDisplayGeometry([p],undefined,shear);mesh.getMatrixAt(0,matrix);normalMatrix.getNormalMatrix(matrix);
      const base=mesh.geometry.getAttribute('position'),N=mesh.geometry.getAttribute('normal'),coordinate=mesh.geometry.getAttribute('materialCoordinate');
      const width=mesh.geometry.getAttribute('materialWidth').getX(0),thickness=mesh.geometry.getAttribute('materialThickness').getX(0);
      const points=Array.from({length:base.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(base,i).applyMatrix4(matrix));
      let volume=0;for(let i=0;i<points.length;i+=3)volume+=points[i].dot(new THREE.Vector3().crossVectors(points[i+1],points[i+2]))/6;
      expect(volume).toBeCloseTo(p.volume,7);
      for(let i=0;i<base.count;i++){
        const expected=new THREE.Vector3().fromBufferAttribute(fresh.getAttribute('position'),i);
        expect(points[i].distanceTo(expected)).toBeLessThan(1e-6);
        const normal=new THREE.Vector3().fromBufferAttribute(N,i).applyMatrix3(normalMatrix).normalize();
        expect(normal.distanceTo(new THREE.Vector3().fromBufferAttribute(fresh.getAttribute('normal'),i))).toBeLessThan(1e-6);
        // The actual instance shader uses this dual-frame normal instead of
        // Three's orthogonal-column shortcut, which is invalid under shear.
        const P=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('materialAcross'),0),B=new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('materialPlane'),0);
        const T=new THREE.Vector3().crossVectors(P,B).normalize(),gamma=mesh.geometry.getAttribute('materialShear').getX(0);
        const actual=P.clone().multiplyScalar(N.getX(i)).addScaledVector(B,N.getY(i)).addScaledVector(T.addScaledVector(P,-gamma).normalize(),N.getZ(i)).normalize();
        expect(actual.distanceTo(normal)).toBeLessThan(1e-6);
        expect(Math.fround(coordinate.getX(i)*width)).toBe(fresh.getAttribute('materialCoordinate').getX(i));
        expect(Math.fround(coordinate.getY(i)*thickness)).toBe(fresh.getAttribute('materialCoordinate').getY(i));
      }
      const matrixAttribute=mesh.instanceMatrix;
      expect(updateSpillInstances([],material,mesh)).toBe(mesh);expect(mesh.count).toBe(0);expect(mesh.instanceMatrix).toBe(matrixAttribute);
      expect(updateSpillInstances([p],material,mesh)).toBe(mesh);expect(mesh.count).toBe(1);
      mesh.geometry.dispose();mesh.dispose();fresh.dispose();
    }
    material.dispose();
  });
  it('retains buffers through births and landings while drawing exactly the fresh geometry',()=>{
    const packet:SpillDisplayPacket={id:1,faceId:'1:2',faceAxis:'x',birth:0,volume:.03,width:.75,releaseDuration:.02,releasePosition:[0,0,0],releaseVelocity:[2,0,1],position:[1,3,2],velocity:[2,-3,1]};
    let retained=buildSpillDisplayGeometry([]);
    for(const count of [1,3,2,0,5,4]){
      const packets=Array.from({length:count},(_,i)=>({...packet,id:i,position:[1+i,3-i,2] as [number,number,number]}));
      const old=retained,position=old.getAttribute('position'),capacity=old.userData.spillCapacity as number|undefined;
      retained=buildSpillDisplayGeometry(packets,old);
      if(capacity!==undefined&&capacity>=count*36){expect(retained).toBe(old);expect(retained.getAttribute('position')).toBe(position);}
      else old.dispose();
      const fresh=buildSpillDisplayGeometry(packets);
      expect(retained.drawRange.count).toBe(fresh.getAttribute('position').count);
      for(const name of Object.keys(fresh.attributes)){
        const expected=fresh.getAttribute(name).array;
        expect(Array.from(retained.getAttribute(name).array.slice(0,expected.length))).toEqual(Array.from(expected));
      }
      expect(retained.boundingSphere).toEqual(fresh.boundingSphere);fresh.dispose();
    }
    retained.dispose();
  });
  it('represents each supplied volume with a closed outward mesh at changing speeds', () => {
    for (const faceAxis of ['x', 'z'] as const) for (const fallSpeed of [0, -3, -10]) {
      const packet: SpillDisplayPacket = {
        id: 1, faceId: '1:2', faceAxis, birth: 0, volume: .03, width: .75,
        releaseDuration: .02, releasePosition: [0, 0, 0], releaseVelocity: [2, 0, 1],
        position: [0, 0, 0], velocity: [2, fallSpeed, 1],
      };
      const geometry = buildSpillDisplayGeometry([packet]);
      const pos = geometry.getAttribute('position');
      let volume = 0;
      // Independent signed tetrahedra integration, not width*length*thickness.
      for (let k = 0; k < pos.count; k += 3) {
        const ax = pos.getX(k), ay = pos.getY(k), az = pos.getZ(k);
        const bx = pos.getX(k + 1), by = pos.getY(k + 1), bz = pos.getZ(k + 1);
        const cx = pos.getX(k + 2), cy = pos.getY(k + 2), cz = pos.getZ(k + 2);
        volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
      }
      expect(volume).toBeCloseTo(packet.volume, 7);
      for (const attribute of Object.values(geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      }
      geometry.dispose();
    }
  });

  it('draws no invented water when the owner supplies no volume', () => {
    const geometry = buildSpillDisplayGeometry([]);
    expect(geometry.getAttribute('position').count).toBe(0);
    geometry.dispose();
  });

  it('cuts only the detached connection and restores the original surface when submerged', () => {
    const grid = { nx: 3, nz: 2, dx: 1, x0: 0, z0: 0 };
    const sheet = buildWaterSheetArrays(grid, new Float32Array([5, 1, 1, 5, 1, 1]));
    const clipped = trimSpillSurface(sheet, grid, [{ from: 0, to: 1, axis: 'x' }, { from: 3, to: 4, axis: 'x' }]);
    // The downstream quad remains. The two triangles bridging the drop leave.
    expect(Array.from(clipped.index)).toEqual([1, 4, 2, 2, 4, 5]);
    expect(clipped.pos).toBe(sheet.pos);
    expect(trimSpillSurface(sheet, grid, [])).toBe(sheet);
    expect(sheet.index.length).toBe(12);
  });
});

// THE FALLING SHEET (GG-428): one connected ribbon for each lip face.
describe('airborne spill falling sheet', () => {
  // One face at x = 0 launching east at 1.5 m/s, 0.1 s parcels, 0.5 m wide.
  const parcel = (id: number, birth: number, time: number, face = '1:2', z = 0): SpillDisplayPacket => {
    const age = time - birth;
    return { id, faceId: face, faceAxis: 'x', birth, volume: .15 * .5 * .1, width: .5, releaseDuration: .1, depth: .15,
      releasePosition: [0, 10, z], releaseVelocity: [1.5, 0, 0],
      position: [1.5 * age, 10 - 4.905 * age * age, z], velocity: [1.5, -9.81 * age, 0] };
  };
  it('joins the parcels of a face from the lip into one ribbon', () => {
    const time = 1, flying = [0, 1, 2, 3, 4, 5].map(k => parcel(k + 1, time - .05 - .1 * k, time));
    const chains = spillNappeStations(flying, [], time);
    expect(chains).toHaveLength(1);
    // The lip itself, then the six parcels, newest first.
    expect(chains[0]).toHaveLength(7);
    expect(chains[0][0].position).toEqual([0, 10, 0]);
    for (let k = 1; k < 7; k++) expect(chains[0][k].position[1]).toBeLessThan(chains[0][k - 1].position[1]);
    const g = buildSpillNappeGeometry(chains);
    // Four edges per station: three strips of two triangles per gap.
    expect(g.drawRange.count).toBe(6 * 3 * 6);
    // Continuity: the column q / speed thins as the water speeds up; before
    // break-up the sheet spreads by its own turbulence only (Ervine and
    // Falvey eq. 1 at the lip's Tu); it whitens with the distance travelled.
    const optics = g.getAttribute('nappeOptics'), pos = g.getAttribute('position');
    const station = (k: number) => ({ thick: optics.getZ(NAPPE_EDGES * k + 1), white: optics.getW(NAPPE_EDGES * k),
      width: Math.abs(pos.getZ(NAPPE_EDGES * k + NAPPE_EDGES - 1) - pos.getZ(NAPPE_EDGES * k)) });
    expect(chains[0][6].along).toBeLessThan(breakupLengthM(1.5, .15));
    expect(station(0).thick).toBeCloseTo(.15 / 1.5, 2);
    expect(station(6).thick).toBeLessThan(station(1).thick);
    expect(station(0).width).toBeCloseTo(.5, 3);
    expect(station(6).width).toBeCloseTo(.5 + 2 * coherentSpreadRate() * chains[0][6].along, 3);
    expect(station(6).white).toBeGreaterThan(station(0).white);
  });
  it('breaks the ribbon where the stream stopped and needs a lip only while water leaves it', () => {
    const time = 3;
    // Two bursts 0.8 s apart; the newest is older than the join window, so no lip station.
    const flying = [parcel(1, 2.0, time), parcel(2, 1.9, time), parcel(3, 1.1, time), parcel(4, 1.0, time)];
    const chains = spillNappeStations(flying, [], time);
    expect(time - 2.0).toBeGreaterThan(NAPPE_JOIN_S);
    expect(chains.map(c => c.length)).toEqual([2, 2]);
  });
  it('ends the sheet at the youngest landing and keeps separate faces apart', () => {
    const time = 1, landed = { ...parcel(9, .2, .9), arrivalTime: .9 };
    const chains = spillNappeStations([parcel(1, .95, time), parcel(2, .85, time, '3:4', .5)], [landed], time);
    expect(chains).toHaveLength(2);
    const a = chains.find(c => c.length === 2 && c[1].birth === .95)!;
    expect(a).toBeDefined();
    // Face 1:2 has a landed parcel older than its oldest flying one; but the
    // 0.75 s gap is past the join window, so the landing does not join.
    expect(chains.every(c => c.every(s => s.birth !== .2))).toBe(true);
    const near = spillNappeStations([parcel(1, .95, time), parcel(2, .85, time)], [{ ...parcel(9, .75, .9), arrivalTime: .9 }], time);
    expect(near[0][near[0].length - 1].birth).toBe(.75);
  });
  it('lays a stair-step lip sheet along the lip, square to the flow, with the lip true length', () => {
    // A 45-degree lip: an x face and a z face launch the same diagonal flow.
    const time = 1, v: [number, number, number] = [1, 0, -1];
    const at = (id: number, face: string, faceAxis: 'x' | 'z'): SpillDisplayPacket => ({ ...parcel(id, time - .05, time, face), faceAxis, releaseVelocity: v, velocity: [1, -.5, -1] });
    const chains = spillNappeStations([at(1, '1:2', 'x'), at(2, '3:4', 'z')], [], time);
    for (const c of chains) for (const s of c) {
      // Horizontal and square to the launch flow, whichever grid face emitted it.
      expect(s.across[1]).toBe(0);
      expect(s.across[0] * v[0] + s.across[2] * v[2]).toBeCloseTo(0, 9);
      // Each 0.5 m face covers 0.5 cos 45 m of the lip, so q (thickness)
      // rises to match; the drawn span keeps the face width to close the stair.
      expect(s.width).toBe(.5);
      expect(s.q).toBeCloseTo(.15 / Math.SQRT1_2, 9);
    }
  });
  it('breaks a slow nappe up metres below the lip, as the nappe laws do', () => {
    // Ervine, Falvey and Withers with Castillo's 1.2 % against Horeni's 6 q^0.32.
    const v0 = 1, d0 = .08, horeni = 6 * Math.pow(v0 * d0, .32);
    const lb = breakupLengthM(v0, d0);
    expect(lb).toBeGreaterThan(.8 * horeni);
    expect(lb).toBeLessThan(1.25 * horeni);
    // More turbulence at the lip breaks the jet up sooner.
    expect(breakupLengthM(v0, d0, .05)).toBeLessThan(lb);
  });
  it('spreads the broken water into a drop cloud with a fringe that keeps the flow (GG-572)', () => {
    // A slow, thin sheet (Steinsdalsfossen's q = 0.08 m^2/s at 1 m/s) seen 3.0 s
    // into its fall: about 44 m down, far past its break-up length.
    const time = 3.05, broken = (id: number, birth: number): SpillDisplayPacket => {
      const age = time - birth;
      return { id, faceId: '1:2', faceAxis: 'x', birth, volume: .08 * .5 * .1, width: .5, releaseDuration: .1, depth: .08,
        releasePosition: [0, 50, 0], releaseVelocity: [1, 0, 0], breakAge: .75,
        position: [age, 50 - 4.905 * age * age, 0], velocity: [1, -9.81 * age, 0] };
    };
    const s = spillNappeStations([broken(1, .05), broken(2, .15)], [], time)[0].at(-1)!;
    expect(s.along).toBeGreaterThan(breakupLengthM(1, .08) + 30);
    expect(s.broken).toBe(1);
    // The air's eddies have spread the drops by metres, not centimetres.
    expect(s.sigma).toBeGreaterThan(1);
    expect(s.dropM).toBeGreaterThan(.0054);
    const { offsets, columns } = spillNappeEdges(s);
    expect(offsets[3] - offsets[0]).toBeGreaterThan(.5 + 4 * s.sigma - .01);
    // A thin fringe at the outer edges, the face's own flow in between:
    // the trapezoid of the four columns holds the face's flow over its span.
    // (a Gaussian keeps 13.5 % of its center at 2 sigma)
    expect(columns[0]).toBeLessThan(.2 * columns[1]);
    let held = 0;
    for (let e = 0; e < 3; e++) held += .5 * (columns[e] + columns[e + 1]) * (offsets[e + 1] - offsets[e]);
    const speed = Math.hypot(...s.velocity), flow = s.q * s.lipWidth / speed;
    expect(held).toBeGreaterThan(.8 * flow);
    expect(held).toBeLessThan(1.2 * flow);
    // The cloud's attribute carries the drop and the broken share.
    const cloud = buildSpillNappeGeometry([[s, s]]).getAttribute('nappeCloud');
    expect(cloud.getX(0)).toBeCloseTo(s.dropM, 6);
    expect(cloud.getY(0)).toBe(1);
  });
  it('draws nothing when no water is in the air', () => {
    expect(spillNappeStations([], [], 1)).toEqual([]);
    expect(buildSpillNappeGeometry([]).drawRange.count).toBe(0);
  });
});
