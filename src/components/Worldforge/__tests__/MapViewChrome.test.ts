import { describe, expect, it } from 'vitest';
import { localMapInfoChipClassName } from '../LocalMapView';
import { regionMapInfoChipClassName } from '../RegionMapView';

describe('Worldforge map view chrome', () => {
  it('keeps region and local readouts below shell controls on phone-width map panes', () => {
    for (const className of [regionMapInfoChipClassName, localMapInfoChipClassName]) {
      expect(className).toContain('top-40');
      expect(className).toContain('left-2');
      expect(className).toContain('right-2');
      expect(className).toContain('sm:top-4');
      expect(className).toContain('sm:left-4');
      expect(className).toContain('sm:right-auto');
    }
  });
});
