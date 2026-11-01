import {describe,it,expect} from 'vitest';
import {Group,PointLight,SphericalHarmonics3,Vector3} from 'three';
import {createDungeonBakeFixtures,createDungeonIndirectLight} from '../dungeonIndirectLight';
import {CellKind,type DungeonPlan} from '../../../../systems/worldforge/dungeon/types';

describe('room-local baked diffuse data',()=>{
  it('copies only fixed shadowed fixtures and leaves live lights/shadows unchanged',()=>{
    const scene=new Group(),fixed=new PointLight('#ffa060',4,12),carried=new PointLight('#ffbb55',3,8);
    fixed.userData.dungeonFixedLight=true;fixed.castShadow=true;fixed.position.set(2,1,4);
    const hidden=fixed.clone();hidden.visible=false;
    scene.add(fixed,carried,hidden);
    const bake=createDungeonBakeFixtures(scene),copy=[...bake.lights][0];
    expect(bake.lights.size).toBe(1);expect(copy).not.toBe(fixed);
    expect(copy.position.toArray()).toEqual(fixed.position.toArray());expect(copy.color).toEqual(fixed.color);
    expect(copy.intensity).toBe(fixed.intensity);expect(copy.shadow).not.toBe(fixed.shadow);
    expect(copy.shadow.autoUpdate).toBe(false);expect(fixed.shadow.autoUpdate).toBe(true);
    expect(bake.group.visible).toBe(false);expect(scene.children).toEqual([fixed,carried,hidden]);
    scene.add(bake.group);bake.dispose();expect(scene.children).toEqual([fixed,carried,hidden]);
  });
  it('uses true source floors, excludes corridor/rock, and never blends neighboring rooms',()=>{
    const grid=new Uint8Array(20).fill(CellKind.Floor),corridor=new Uint8Array(20);
    grid[0]=CellKind.Wall;corridor[5]=1;
    const plan={W:5,H:4,cellFt:5,grid,corridor,rooms:[
      {id:8,x:0,y:0,w:10,h:20},{id:17,x:10,y:0,w:15,h:20},
    ]} as unknown as DungeonPlan;
    const before=JSON.stringify(plan),light=createDungeonIndirectLight(plan);
    expect(light.slots[0]).toBe(-1);expect(light.slots[5]).toBe(-1);
    expect(light.slots[1]).toBe(0);expect(light.slots[2]).toBe(1);
    expect(light.probes.map(p=>p.roomId)).toEqual([8,17]);
    for(const probe of light.probes){
      const x=Math.floor(probe.position.x+plan.W/2),y=Math.floor(probe.position.z+plan.H/2);
      expect(light.slots[y*plan.W+x]).toBe(probe.slot);
    }
    const sh=new SphericalHarmonics3();sh.coefficients[0]=new Vector3(0.4,0.2,0.1);
    light.publish(0,sh);
    expect(light.coefficients[0]).toBeCloseTo(0.4);expect(light.coefficients[36]).toBe(0);
    expect(JSON.stringify(plan)).toBe(before);
    light.dispose();
  });
});
