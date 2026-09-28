/**
 * wave-gif.mjs — capture an ANIMATION off a 3D surface as a GIF plus a frame sheet.
 *
 * A still cannot show a foot skating, a wrist popping, or a clip that plays for
 * two frames and freezes. This walks the page through N frames, writes each one,
 * and produces both a GIF (for a person) and a contact sheet (for an agent that
 * can only look at one image).
 *
 * USAGE
 *   node tools/entities3d/capture/wave-gif.mjs <url> <outBase> [frames=24] [intervalMs=90]
 *   CAM="px,py,pz;tx,ty,tz" node ... wave-gif.mjs <url> <outBase>   # aim the lab camera
 *
 * Writes <outBase>.gif, <outBase>-sheet.png and <outBase>-frames/*.png. Keep
 * <outBase> under .agent/scratch/ (gitignored). Needs ffmpeg (override with
 * CAPTURE_FFMPEG) and the `sharp` dependency for the sheet; a missing ffmpeg
 * costs the GIF only — the frames and the sheet are still written.
 *
 * CONVENTIONS: see ./captureLib.mjs. The one that matters most here is that
 * every frame comes from an explicit renderer.render() followed by
 * canvas.toDataURL() in the same task. `page.screenshot()` on an animating R3F
 * scene returns compositor frames that are stale by an unpredictable amount,
 * which produced GIFs that stuttered and repeated frames the scene never drew.
 * Also: 127.0.0.1 not localhost; headless system Chrome with the GPU
 * default-args removed; `&turn=1` for camera aiming; and the run aborts if the
 * dev server hot-reloaded the page part-way through the sequence, because half
 * a clip spliced onto half of the next mount looks like an animation bug.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import {
  launchCaptureBrowser, newCapturePage, gotoScene, assertLive,
  grabCanvasPng, writePng, sleep,
} from './captureLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');

const [url, outBaseArg, framesArg, intervalArg] = process.argv.slice(2);
if (!url || !outBaseArg) {
  console.error('usage: node tools/entities3d/capture/wave-gif.mjs <url> <outBase> [frames] [intervalMs]');
  process.exit(2);
}
const outBase = path.resolve(REPO, outBaseArg);
const FRAMES = Number(framesArg ?? 24);
const INTERVAL = Number(intervalArg ?? 90);
const FFMPEG = process.env.CAPTURE_FFMPEG || 'F:/Repos/VideoChunking/ffmpeg/bin/ffmpeg.exe';
const frameDir = outBase + '-frames';
mkdirSync(frameDir, { recursive: true });

const { browser, context } = await launchCaptureBrowser({ width: 640, height: 820 });
try {
  const { page, errors } = await newCapturePage(context);
  const nonce = await gotoScene(page, url, { hook: 'window.__partlab && window.__partlab.gl', settleMs: 4000 });

  // Optional camera aim. Needs &turn=1 on the URL: the turntable publishes
  // controls, and drei re-aims the camera at controls.target every frame.
  if (process.env.CAM) {
    const [pos, tgt] = process.env.CAM.split(';').map((s) => s.split(',').map(Number));
    await page.evaluate(([pos, tgt]) => {
      const lab = window.__partlab;
      if (!lab?.camera || !lab?.controls) throw new Error('no __partlab camera/controls — add &turn=1');
      lab.controls.autoRotate = false;
      lab.controls.target.set(tgt[0], tgt[1], tgt[2]);
      lab.camera.position.set(pos[0], pos[1], pos[2]);
      lab.controls.update();
    }, [pos, tgt]);
    await sleep(400);
  }

  const files = [];
  for (let i = 0; i < FRAMES; i++) {
    // A reload mid-sequence would splice two different mounts into one clip.
    await assertLive(page, nonce);
    const png = await grabCanvasPng(page);
    files.push(writePng(path.join(frameDir, `f${String(i).padStart(3, '0')}.png`), png));
    await sleep(INTERVAL);
  }

  // GIF via ffmpeg, palette pass for clean colors. The effective frame rate has
  // to account for the capture cost, not just INTERVAL, or the GIF plays fast.
  const gif = outBase + '.gif';
  const r = spawnSync(FFMPEG, [
    '-y', '-framerate', String(Math.max(1, Math.round(1000 / (INTERVAL + 120)))),
    '-i', path.join(frameDir, 'f%03d.png'),
    '-vf', 'scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
    gif,
  ], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.log('ffmpeg unavailable or failed; frames and sheet still written: ' + String(r.error ?? r.stderr).slice(-300));
  }

  // Frame sheet: six columns, for an eyeball or an agent that gets one image.
  const cols = 6;
  const thumbW = 300;
  const meta = await sharp(files[0]).metadata();
  const thumbH = Math.round((meta.height / meta.width) * thumbW);
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(thumbW, thumbH).toBuffer()));
  const sheet = outBase + '-sheet.png';
  await sharp({ create: { width: cols * thumbW, height: rows * thumbH, channels: 3, background: '#202020' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * thumbW, top: Math.floor(i / cols) * thumbH })))
    .png()
    .toFile(sheet);

  console.log(`gif ${gif}\nsheet ${sheet} frames=${files.length}`);
  if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 8).join('\n  '));
} finally {
  await browser.close();
}
