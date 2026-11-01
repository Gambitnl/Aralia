/** Copies only actual occupied faces and provenance from frozen water proof.
 * These small tracked assets keep the native study area independent of local
 * scratch reports. No solver is executed and no missing water is invented.
 */
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {writeFileWithRetry} from '../writeWithRetry.mjs';
const root=new URL('../../',import.meta.url);
const folder=new URL('public/assets/water-experiments/',root);
mkdirSync(folder,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=process.argv.includes('--check');
async function output(name,text){const url=new URL(name,folder);if(check){if(readFileSync(url,'utf8')!==text)throw Error('Stored experiment asset is stale: '+name);}else await writeFileWithRetry(url,text);}
const faces=pieces=>pieces.map(piece=>piece.poly?.faces??piece.faces);
const specs=[
  {id:'oblique-interface',source:'cascade-endpoint/oblique-failure-state.json',extract:v=>({time:v.report.acceptedTime,solverSources:v.report.hashes,receipt:v.report,states:[{id:'before',label:'Before transport; retained physical state',kind:'retained',pieces:faces(v.input)},{id:'rejected',label:'Rejected reconstruction; diagnostic only',kind:'rejected',pieces:faces(v.reconstruction.pieces)}]})},
  {id:'connected-basin',source:'behavior-vof-worker/U-local-frozen.json',extract:v=>({time:null,solverSources:null,receipt:v.receipt,states:[{id:'stored',label:'Stored occupied boundary; pressure control only',kind:'retained',pieces:faces(v.pieces)}]})},
];
const manifest={schema:1,assets:{},nativeSources:Object.fromEntries(['src/systems/world3d/river/riverSolver.ts','src/systems/world3d/river/riverFlowField.ts','src/components/World3D/water/riverWaterMaterial.ts','src/components/World3D/water/riverExperimentPool.ts'].map(path=>[path,hash(readFileSync(new URL(path,root)))]))};
for(const spec of specs){
  const source=new URL('.agent/scratch/waterfall-gauntlet/'+spec.source,root),bytes=readFileSync(source),value=JSON.parse(bytes);
  const capture={schema:1,id:spec.id,captureSha256:hash(bytes),capturePath:spec.source,...spec.extract(value)};
  for(const state of capture.states)for(const piece of state.pieces)for(const face of piece)for(const point of face)if(point.length!==3||point.some(x=>!Number.isFinite(x)))throw Error('Invalid captured coordinate');
  const text=JSON.stringify(capture),name=spec.id+'.json';
  await output(name,text+'\n');
  manifest.assets[spec.id]={file:name,sha256:hash(text+'\n'),captureSha256:capture.captureSha256,pieces:capture.states.map(s=>({state:s.id,count:s.pieces.length}))};
}
await output('manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({mode:check?'exact frozen extraction verified':'exported',output:fileURLToPath(folder),...manifest},null,2));
