import {describe,it,expect} from 'vitest';
import {validateFrozenWaterfallSource,frozenWaterfallMismatch,type FrozenWaterfallSource,type FrozenWaterfallState,type FrozenWaterfallSolarProof} from '../waterfallFrozenSource';
function fixture(){
 const proof:FrozenWaterfallSource={sourceRGB:new Float32Array([1,2,3]),size:[1,1,1],boundsMin:[0,0,0],boundsMax:[1,1,1],frozenTime:20,camera:[-90,50,-48],fieldSignature:'density-A',lightingSignature:'cliff-sky-A',receipt:{ready:true,equationResidual:9e-7,relativePowerError:8e-7}};
 const current:FrozenWaterfallState={time:20,camera:[-90,50,-48],fieldSignature:'density-A',lightingSignature:'cliff-sky-A',sunZero:true};return{proof,current};
}
describe('frozen optical source contract',()=>{
 it('accepts a finite solved field without treating refinement as established',()=>{const {proof,current}=fixture();expect(()=>validateFrozenWaterfallSource(proof,current)).not.toThrow();});
 it('rejects changed time, camera, density, light and direct sunlight',()=>{
  const {proof,current}=fixture();for(const change of [{time:21},{camera:[-89,50,-48] as const},{camera:[NaN,50,-48] as const},{fieldSignature:'density-B'},{lightingSignature:'sky-B'},{sunZero:false}]){expect(frozenWaterfallMismatch(proof,{...current,...change})).not.toBeNull();expect(()=>validateFrozenWaterfallSource(proof,{...current,...change})).toThrow();}
 });
 it('never publishes an unconverged or invalid-energy field',()=>{
  const {proof,current}=fixture();for(const receipt of [{ready:false,equationResidual:0,relativePowerError:0},{ready:true,equationResidual:2e-6,relativePowerError:0},{ready:true,equationResidual:0,relativePowerError:NaN}])expect(()=>validateFrozenWaterfallSource({...proof,receipt},current)).toThrow();
 });
 it('rejects malformed storage, negative or overflowing HDR, invalid camera and empty extents',()=>{
  const {proof,current}=fixture();for(const change of [{sourceRGB:new Float32Array(2)},{sourceRGB:new Float32Array([1,-1,2])},{sourceRGB:new Float32Array([1,Infinity,2])},{sourceRGB:new Float32Array([1,70000,2])},{size:[1,.5,1] as const},{camera:[NaN,0,0] as const},{boundsMax:[0,1,1] as const}])expect(()=>validateFrozenWaterfallSource({...proof,...change},current)).toThrow();
 });
});
describe('signed solar source opt-in',()=>{
 function solarFixture(){const {proof,current}=fixture();const solar:FrozenWaterfallSolarProof={signature:'sun-A',visibilitySignature:'opaque-A',bounceSignature:'cliff-A',propagationDirection:[0,0,-1],irradiance:[2,3,4],relativePowerError:0,diffuseRelativePowerError:0,incoming:[2,3,4],outgoing:[1,1,1],absorbed:[.5,1,1],scattered:[.5,1,2],projectionSamples:8192,projectionVectorMomentError:.03,projectionTensorMomentError:.04};return{proof:{...proof,solar},current:{...current,sunZero:false,solar}};}
 it('allows signed, balanced solar data while preserving the diffuse-only guard',()=>{const {proof,current}=solarFixture();expect(()=>validateFrozenWaterfallSource(proof,current)).not.toThrow();expect(()=>validateFrozenWaterfallSource({...proof,solar:undefined},current)).toThrow(/sunlight/);});
 it('rejects solar state changes even when an adapter incorrectly retains the old signature',()=>{
  const {proof,current}=solarFixture();for(const change of [{signature:'sun-B'},{visibilitySignature:'opaque-B'},{bounceSignature:'cliff-B'},{irradiance:[3,3,4] as const},{propagationDirection:[0,0,1] as const},{irradiance:[NaN,3,4] as const}])expect(()=>validateFrozenWaterfallSource(proof,{...current,solar:{...current.solar,...change}})).toThrow();
  expect(()=>validateFrozenWaterfallSource(proof,{...current,solar:undefined})).toThrow();expect(()=>validateFrozenWaterfallSource(proof,{...current,sunZero:true})).toThrow();
 });
 it('requires both independent power checks and recomputes beam balance from its receipt',()=>{
  const {proof,current}=solarFixture();for(const change of [{relativePowerError:2e-6},{diffuseRelativePowerError:2e-6},{outgoing:[2,2,2] as const},{incoming:[NaN,3,4] as const},{projectionSamples:0},{projectionVectorMomentError:NaN}])expect(()=>validateFrozenWaterfallSource({...proof,solar:{...proof.solar,...change}},current)).toThrow();
 });
});
