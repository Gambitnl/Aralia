import {describe,expect,it} from 'vitest';
import {FrameAttribution} from '../frameAttribution';

describe('matched frame interval attribution',()=>{
  it('retains accurate recent coverage for a many-pass scene within its bounded ring',()=>{
    const a=new FrameAttribution();
    for(let frame=0;frame<90;frame++){
      const start=100+frame*10;
      for(let pass=0;pass<5;pass++)a.recordCallback(start+pass*2,start+pass*2+1);
      a.recordCallback(start,start+9);a.recordFrame(start,start+10);
    }
    const r=a.read(1000)!;
    expect(r.frames).toBe(90);expect(r.callbackMs).toBe(9);expect(r.unknownMs).toBe(1);
  });
  it('clips late script reports to the same frame and excludes the render callback',()=>{
    const a=new FrameAttribution();a.recordFrame(100,160);a.recordCallback(100,120);
    a.recordBrowserFrame({startTime:90,duration:90,scripts:[
      {startTime:95,executionStart:99,duration:55,invoker:'Worker.onmessage',sourceURL:'/river.ts'}],styleAndLayoutStart:150});
    const r=a.read(160)!;
    expect(r.callbackMs).toBe(20);expect(r.outsideScriptMs).toBe(30);
    expect(r.browserRenderingMs).toBe(10);expect(r.unknownMs).toBe(0);
    expect(r.sources[0].name).toContain('Worker.onmessage');
  });
  it('counts nested operations, duplicate reports and overlapping callbacks only once',()=>{
    const a=new FrameAttribution();a.recordFrame(100,180);a.recordCallback(100,120);a.recordCallback(110,130);
    a.recordWork('reply',125,170,'operation');a.recordWork('geometry',135,155,'operation');
    a.recordWork('reply',125,170,'operation');a.recordWork('browser reply',120,175,'browser');
    const r=a.read(180)!;expect(r.callbackMs).toBe(30);expect(r.outsideScriptMs).toBe(45);expect(r.unknownMs).toBe(5);
    expect(r.sources.reduce((sum,s)=>sum+s.ms,0)).toBe(45);
    expect(r.sources.find(s=>s.name==='geometry')?.ms).toBe(20);
  });
  it('uses actual frame count rather than subtracting unrelated rolling means',()=>{
    const a=new FrameAttribution();a.recordFrame(100,140);a.recordFrame(140,220);
    a.recordCallback(100,110);a.recordCallback(140,160);a.recordWork('other RAF',160,200,'animation');
    const r=a.read(220)!;expect(r.frames).toBe(2);expect(r.meanFrameMs).toBe(60);
    expect(r.callbackMs+r.outsideScriptMs+r.browserRenderingMs+r.unknownMs).toBe(60);
    expect(r.unknownMs).toBe(25);
  });
  it('does not treat unsupported browser coverage or missing script starts as idle time',()=>{
    const a=new FrameAttribution();a.recordFrame(100,160);a.recordCallback(100,110);
    a.recordBrowserFrame({startTime:100,duration:60,scripts:[{duration:50}]});
    expect(a.read(160)?.unknownMs).toBe(50);expect(a.read(160)?.browserCoverage).toBe('unavailable');
  });
  it('drops hidden/reset evidence and rejects stale, invalid or suspension-sized frames',()=>{
    const a=new FrameAttribution();a.recordFrame(100,150);a.clear(150);
    a.recordBrowserFrame({startTime:100,duration:40,scripts:[{startTime:100,duration:40}]});
    a.recordFrame(150,200);a.recordFrame(200,2200);a.recordWork('bad',NaN,200,'browser');
    expect(a.read(200)?.unknownMs).toBe(50);expect(a.read(2200)).toBeNull();
  });
  it('includes main-thread work below the browser long-frame threshold',()=>{
    const a=new FrameAttribution();a.recordFrame(100,140);a.recordCallback(100,110);
    a.recordWork('other animation callback',112,124,'animation');a.recordWork('snapshot',125,130,'operation');
    expect(a.read(140)?.outsideScriptMs).toBe(17);expect(a.read(140)?.unknownMs).toBe(13);
  });
});
