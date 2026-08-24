/**
 * @file rigbench.mjs — the Rig Bench: an AI-native rigging pipeline. Each
 * stage takes files, writes files plus a JSON report, and leaves a picture.
 * Workspace: .agent/rigbench/<id>/
 *
 * Stages:
 *   intake <file> [--id <id>]   normalize any humanoid model at the door ->
 *                               intake.glb + intake.json (report)
 *   render <id> [--rig <glb>]   clay renders front/side/quarter + cameras.json;
 *                               with --rig, red-rod overlay renders instead
 *   solve <id>                  landmarks.2d.json (annotated pixels) ->
 *                               landmarks.3d.json (glTF-space joints)
 *   fit <id>                    pack-skeleton fit with landmark override ->
 *                               <id>.packrig.glb + overlay renders
 *   gate <id|glb>               measured checks -> gate.json (pass/fail)
 *
 * Run: node tools/rigbench/rigbench.mjs <stage> ...
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const BENCH = path.join(ROOT, '.agent', 'rigbench');
const BLENDER_DIR = path.join(ROOT, 'tools', 'blender');

function findBlender() {
  if (process.env.BLENDER_EXE) {
    if (!existsSync(process.env.BLENDER_EXE)) throw new Error(`BLENDER_EXE points at a missing file: ${process.env.BLENDER_EXE}`);
    return process.env.BLENDER_EXE;
  }
  for (const drive of ['C', 'D', 'E', 'F', 'G']) {
    const vendor = `${drive}:\\Program Files\\Blender Foundation`;
    if (!existsSync(vendor)) continue;
    const versions = readdirSync(vendor)
      .filter((d) => /^Blender \d/.test(d) && existsSync(path.join(vendor, d, 'blender.exe')))
      .sort((a, b) => parseFloat(b.slice(8)) - parseFloat(a.slice(8)));
    if (versions.length) return path.join(vendor, versions[0], 'blender.exe');
  }
  throw new Error('Blender not found: set BLENDER_EXE or install under <drive>:\\Program Files\\Blender Foundation');
}

function blenderRun(job, args) {
  const blender = findBlender();
  const r = spawnSync(blender, ['-b', '--python', path.join(BLENDER_DIR, job), '--', ...args], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  const tail = (r.stdout + '\n' + r.stderr)
    .split('\n')
    .filter((l) => /rigbench_|rig_basemesh|Error|Traceback/.test(l))
    .join('\n');
  if (r.status !== 0) throw new Error(`${job} failed (exit ${r.status})\n${tail}`);
  return tail;
}

function workspace(id) {
  const dir = path.join(BENCH, id);
  if (!existsSync(dir)) throw new Error(`rigbench: no workspace ${dir} — run intake first`);
  return dir;
}

const [stage, ...rest] = process.argv.slice(2);

function flag(name) {
  const i = rest.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = rest[i + 1];
  rest.splice(i, 2);
  return v;
}

if (stage === 'intake') {
  const idArg = flag('id');
  const file = rest[0];
  if (!file || !existsSync(file)) throw new Error(`rigbench intake: missing input file "${file ?? ''}"`);
  const id = idArg ?? path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const dir = path.join(BENCH, id);
  mkdirSync(dir, { recursive: true });
  console.log(blenderRun('rigbench_intake.py', [path.resolve(file), dir]));
  const report = JSON.parse(readFileSync(path.join(dir, 'intake.json'), 'utf8'));
  console.log(`rigbench: workspace ${dir}`);
  if (!report.tpose) console.log('rigbench: NOTE — arms down; the pack fit needs a T-pose (tpose_basemesh.py bakes one from a rigged GLB)');
} else if (stage === 'render') {
  const rig = flag('rig');
  const id = rest[0];
  const dir = workspace(id);
  const args = [path.join(dir, 'intake.glb'), dir];
  if (rig) args.push('--rig', path.resolve(rig));
  console.log(blenderRun('rigbench_render.py', args));
} else if (stage === 'solve') {
  const id = rest[0];
  const dir = workspace(id);
  const lm2dPath = path.join(dir, 'landmarks.2d.json');
  if (!existsSync(lm2dPath)) throw new Error(`rigbench solve: missing ${lm2dPath} — annotate the renders first`);
  const cams = JSON.parse(readFileSync(path.join(dir, 'cameras.json'), 'utf8'));
  const lm2d = JSON.parse(readFileSync(lm2dPath, 'utf8'));

  const project = (view, px, py) => {
    const c = cams[view];
    if (!c) throw new Error(`rigbench solve: unknown view "${view}" (have: ${Object.keys(cams).join(', ')})`);
    const [W, H] = c.resolution;
    const u = (px / W - 0.5) * c.orthoScale;
    const v = (0.5 - py / H) * c.orthoScale;
    return {
      x: c.center[0] + c.rightAxis[0] * u + c.upAxis[0] * v,
      y: c.center[1] + c.rightAxis[1] * u + c.upAxis[1] * v,
      z: c.center[2] + c.rightAxis[2] * u + c.upAxis[2] * v,
      // which world components this view pins (nonzero right/up rows)
      pins: ['x', 'y', 'z'].filter((_, i) => c.rightAxis[i] !== 0 || c.upAxis[i] !== 0),
    };
  };

  // Each landmark: { front: [px,py], side?: [px,py] }. Front pins x,y; side
  // pins z,y. y comes from the front view when both give it. Side-view z
  // applies to L and R alike (a profile cannot separate the two sides).
  const out = {};
  for (const [name, views] of Object.entries(lm2d)) {
    const p = { x: 0, y: 0, z: 0 };
    let zPinned = false;
    if (views.front) {
      const f = project('front', views.front[0], views.front[1]);
      p.x = f.x;
      p.y = f.y;
    } else {
      throw new Error(`rigbench solve: landmark "${name}" has no front view — front is mandatory`);
    }
    if (views.side) {
      const s = project('side', views.side[0], views.side[1]);
      p.z = s.z;
      zPinned = true;
    }
    // a landmark the profile cannot read (a thumb in front of the palm)
    // takes an explicit world z instead of a side-view click
    if (views.z !== undefined) {
      p.z = views.z;
      zPinned = true;
    }
    out[name] = { pos: [round4(p.x), round4(p.y), round4(p.z)], zPinned };
  }
  const outPath = path.join(dir, 'landmarks.3d.json');
  writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`rigbench: solved ${Object.keys(out).length} landmarks -> ${outPath}`);
} else if (stage === 'fit') {
  const id = rest[0];
  const dir = workspace(id);
  const spec = path.join(ROOT, 'tools', 'entities3d', 'bipedBoneSpec.json');
  const pack = path.join(ROOT, 'public', 'anim', 'humanoid', 'human-base-animations.glb');
  if (!existsSync(spec)) throw new Error(`rigbench fit: missing ${spec} — run: npx tsx tools/entities3d/exportBoneSpec.ts`);
  const out = path.join(dir, `${id}.packrig.glb`);
  const args = [path.join(dir, 'intake.glb'), out, spec, '--pack', pack];
  const lm = path.join(dir, 'landmarks.3d.json');
  if (existsSync(lm)) args.push('--landmarks', lm);
  else console.log('rigbench fit: no landmarks.3d.json — heuristic fit only');
  console.log(blenderRun('rig_basemesh.py', args));
  console.log(blenderRun('rigbench_render.py', [path.join(dir, 'intake.glb'), dir, '--rig', out]));
  console.log(`rigbench: fitted ${out} — eyeball front-rig.png / side-rig.png / quarter-rig.png`);
} else if (stage === 'gate') {
  const target = rest[0];
  const glb = existsSync(target) ? target : path.join(workspace(target), `${target}.packrig.glb`);
  const { runGate } = await import('./gate.mjs');
  const result = runGate(glb);
  for (const c of result.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(20)} ${c.detail}`);
  const outPath = existsSync(target) ? glb.replace(/\.glb$/i, '.gate.json') : path.join(workspace(target), 'gate.json');
  writeFileSync(outPath, JSON.stringify(result, null, 1));
  console.log(`rigbench: ${result.pass ? 'GATE PASSED' : 'GATE FAILED'} -> ${outPath}`);
  if (!result.pass) process.exitCode = 1;
} else if (stage === 'sheet') {
  // one PNG per body: bind pose, three frozen clips, and the weight map,
  // captured from the live Part Lab (:3000) with headless system Chrome
  const id = rest[0];
  const dir = path.join(BENCH, id, 'sheet');
  mkdirSync(dir, { recursive: true });
  const { chromium } = await import('playwright');
  const base = `http://localhost:3000/Aralia/misc/design.html?step=partlab&race=hill_dwarf&class=fighter&seed=1&ink=0&body=${id}`;
  const shots = [
    ['rest', '&pose=rest&bones=1'],
    ['idle', '&pose=pack%3AIdle_A&t=0.5'],
    ['walk', '&pose=pack%3AWalk&t=0.3'],
    ['greeting', '&pose=pack%3AGreeting&t=0.5'],
    ['weights', '&pose=rest&skin=weights'],
  ];
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    for (const [label, extra] of shots) {
      await page.goto(base + extra, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(9000);
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = '*{visibility:hidden!important} canvas{visibility:visible!important}';
        document.head.appendChild(style);
      });
      await page.waitForTimeout(300);
      await page.locator('canvas').first().screenshot({ path: path.join(dir, `${label}.png`), timeout: 20000 });
      console.log(`rigbench sheet: shot ${label}`);
    }
  } finally {
    await browser.close();
  }
  const py = `
from PIL import Image, ImageDraw
import os
d = ${JSON.stringify(dir.replaceAll('\\', '/'))}
labels = ${JSON.stringify(shots.map(([l]) => l))}
cells = [Image.open(os.path.join(d, l + '.png')).resize((550, 450)) for l in labels]
sheet = Image.new('RGB', (550 * 3, 450 * 2 + 30), (24, 26, 32))
draw = ImageDraw.Draw(sheet)
for i, (img, l) in enumerate(zip(cells, labels)):
    x, y = (i % 3) * 550, (i // 3) * 450
    sheet.paste(img, (x, y))
    draw.text((x + 8, y + 6), l, fill=(255, 210, 90))
draw.text((8, 450 * 2 + 8), ${JSON.stringify(id)} + ' — Rig Bench contact sheet', fill=(200, 200, 210))
out = os.path.join(d, '..', 'contact-sheet.png')
sheet.save(out)
print('sheet ->', os.path.abspath(out))
`;
  const r = spawnSync('python', ['-'], { input: py, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`sheet compose failed: ${r.stderr}`);
  console.log(r.stdout.trim());
} else {
  throw new Error(`rigbench: unknown stage "${stage ?? ''}" (intake | render | solve | fit | gate | sheet)`);
}

function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}
