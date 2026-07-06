import { describe, expect, it } from 'vitest';
import {
  atlasDemoBreadcrumbClassName,
  atlasDemoBreadcrumbHintClassName,
  atlasDemoBreadcrumbIdentityClassName,
  measureAtlasDemoMapSize,
} from '../AtlasDemo';

describe('AtlasDemo sizing', () => {
  it('fits the atlas canvas to a phone-width workspace instead of forcing 480px overflow', () => {
    expect(measureAtlasDemoMapSize({ width: 320, height: 640 })).toEqual({
      width: 320,
      height: 640,
    });
  });

  it('keeps a minimal nonzero canvas for hidden or not-yet-measured workspaces', () => {
    expect(measureAtlasDemoMapSize({ width: 0, height: 0 })).toEqual({
      width: 1,
      height: 260,
    });
  });
});

describe('AtlasDemo breadcrumb layout', () => {
  it('bounds and wraps the breadcrumb strip on phone-width map views', () => {
    expect(atlasDemoBreadcrumbClassName).toContain('left-2');
    expect(atlasDemoBreadcrumbClassName).toContain('right-2');
    expect(atlasDemoBreadcrumbClassName).toContain('top-20');
    expect(atlasDemoBreadcrumbClassName).toContain('max-w-[calc(100%-1rem)]');
    expect(atlasDemoBreadcrumbClassName).toContain('sm:left-auto');
    expect(atlasDemoBreadcrumbIdentityClassName).toContain('flex-wrap');
    expect(atlasDemoBreadcrumbHintClassName).toContain('items-start');
  });
});
