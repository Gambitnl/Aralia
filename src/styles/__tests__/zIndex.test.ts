/**
 * @file zIndex.test.ts
 * Unit tests for the Z-Index Registry system
 */

import {
  Z_INDEX,
  getZIndexClass,
  getZIndexValue,
  isValidZIndex,
  getLayerByValue,
  getLayersInRange,
  getNextZIndex,
  isZIndexLayer,
  getZIndexDebugInfo,
  type ZIndexLayer,
  type ZIndexValue,
} from '../zIndex';

describe('Z-Index Registry', () => {
  describe('Registry Constants', () => {
    it('should export all expected layer constants', () => {
      expect(Z_INDEX.BASE).toBe(0);
      expect(Z_INDEX.CONTENT).toBe(1);
      expect(Z_INDEX.SUBMAP_OVERLAY).toBe(20);
      expect(Z_INDEX.MODAL_BACKGROUND).toBe(100);
      expect(Z_INDEX.MODAL_CONTENT).toBe(110);
      expect(Z_INDEX.MODAL_INTERACTIVE).toBe(120);
      expect(Z_INDEX.DICE_OVERLAY).toBe(300);
      expect(Z_INDEX.TOOLTIP).toBe(1000);
      expect(Z_INDEX.MAXIMUM).toBe(9999);
    });

    it('should maintain proper layering hierarchy', () => {
      // Base layers should be lowest
      expect(Z_INDEX.BASE).toBeLessThan(Z_INDEX.CONTENT);
      expect(Z_INDEX.CONTENT).toBeLessThan(Z_INDEX.SUBMAP_OVERLAY);

      // Modal system should be properly ordered
      expect(Z_INDEX.MODAL_BACKGROUND).toBeLessThan(Z_INDEX.MODAL_CONTENT);
      expect(Z_INDEX.MODAL_CONTENT).toBeLessThan(Z_INDEX.MODAL_INTERACTIVE);

      // Higher-level features should be above modals
      expect(Z_INDEX.MODAL_INTERACTIVE).toBeLessThan(Z_INDEX.DICE_OVERLAY);
      expect(Z_INDEX.DICE_OVERLAY).toBeLessThan(Z_INDEX.TOOLTIP);

      // Emergency override should be highest
      expect(Z_INDEX.TOOLTIP).toBeLessThan(Z_INDEX.MAXIMUM);
    });

    it('should have no duplicate values', () => {
      const values = Object.values(Z_INDEX);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('Type Safety', () => {
    it('should provide type-safe layer names', () => {
      const layer: ZIndexLayer = 'MODAL_BACKGROUND';
      expect(Z_INDEX[layer]).toBe(100);
    });

    it('should provide type-safe z-index values', () => {
      const value: ZIndexValue = 100;
      expect(value).toBe(Z_INDEX.MODAL_BACKGROUND);
    });
  });

  describe('Utility Functions', () => {
    describe('getZIndexClass', () => {
      it('should return proper Tailwind CSS class', () => {
        expect(getZIndexClass('MODAL_BACKGROUND')).toBe('z-[100]');
        expect(getZIndexClass('TOOLTIP')).toBe('z-[1000]');
      });
    });

    describe('getZIndexValue', () => {
      it('should return numeric z-index value', () => {
        expect(getZIndexValue('BASE')).toBe(0);
        expect(getZIndexValue('MAXIMUM')).toBe(9999);
      });
    });

    describe('isValidZIndex', () => {
      it('should validate existing z-index values', () => {
        expect(isValidZIndex(100)).toBe(true);
        expect(isValidZIndex(9999)).toBe(true);
        expect(isValidZIndex(50)).toBe(false);
        expect(isValidZIndex(999)).toBe(false);
      });
    });

    describe('getLayerByValue', () => {
      it('should return layer name for valid values', () => {
        expect(getLayerByValue(100)).toBe('MODAL_BACKGROUND');
        expect(getLayerByValue(1000)).toBe('TOOLTIP');
        expect(getLayerByValue(9999)).toBe('MAXIMUM');
      });

      it('should return undefined for invalid values', () => {
        expect(getLayerByValue(50)).toBeUndefined();
        expect(getLayerByValue(999)).toBeUndefined();
      });
    });

    describe('getLayersInRange', () => {
      it('should return layers within specified range', () => {
        const modalLayers = getLayersInRange(100, 199);
        expect(modalLayers).toContain('MODAL_BACKGROUND');
        expect(modalLayers).toContain('MODAL_CONTENT');
        expect(modalLayers).not.toContain('TOOLTIP');
      });

      it('should return layers sorted by z-index', () => {
        const layers = getLayersInRange(100, 120);
        const indices = layers.map(layer => Z_INDEX[layer]);
        const sorted = [...indices].sort((a, b) => a - b);
        expect(indices).toEqual(sorted);
      });
    });

    describe('getNextZIndex', () => {
      it('should calculate next available z-index', () => {
        expect(getNextZIndex('MODAL_BACKGROUND')).toBe(101);
        expect(getNextZIndex('TOOLTIP', 10)).toBe(1010);
      });
    });

    describe('isZIndexLayer', () => {
      it('should validate layer name strings', () => {
        expect(isZIndexLayer('MODAL_BACKGROUND')).toBe(true);
        expect(isZIndexLayer('TOOLTIP')).toBe(true);
        expect(isZIndexLayer('INVALID_LAYER')).toBe(false);
      });
    });
  });

  describe('Debug Information', () => {
    const debugInfo = getZIndexDebugInfo();

    it('should provide comprehensive debug information', () => {
      expect(debugInfo).toHaveProperty('totalLayers');
      expect(debugInfo).toHaveProperty('layersByValue');
      expect(debugInfo).toHaveProperty('layerNames');
      expect(debugInfo).toHaveProperty('valueRange');
      expect(debugInfo).toHaveProperty('layersByCategory');
    });

    it('should have correct total layer count', () => {
      expect(debugInfo.totalLayers).toBe(Object.keys(Z_INDEX).length);
    });

    it('should have properly sorted layers by value', () => {
      const values = debugInfo.layersByValue.map(([, value]) => value);
      const sorted = [...values].sort((a, b) => a - b);
      expect(values).toEqual(sorted);
    });

    it('should categorize layers correctly', () => {
      expect(debugInfo.layersByCategory.base).toContain('BASE');
      expect(debugInfo.layersByCategory.modal).toContain('MODAL_BACKGROUND');
      expect(debugInfo.layersByCategory.overlays).toContain('DICE_OVERLAY');
      expect(debugInfo.layersByCategory.alwaysOnTop).toContain('TOOLTIP');
      expect(debugInfo.layersByCategory.emergency).toContain('MAXIMUM');
    });

    it('should have valid value range', () => {
      expect(debugInfo.valueRange.min).toBe(0);
      expect(debugInfo.valueRange.max).toBe(9999);
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end for modal creation', () => {
      // Simulate creating a modal with proper layering
      const backgroundClass = getZIndexClass('MODAL_BACKGROUND');
      const contentClass = getZIndexClass('MODAL_CONTENT');

      expect(backgroundClass).toBe('z-[100]');
      expect(contentClass).toBe('z-[110]');

      // Verify the layering relationship
      expect(getZIndexValue('MODAL_BACKGROUND')).toBeLessThan(getZIndexValue('MODAL_CONTENT'));
    });

    it('should handle tooltip layering correctly', () => {
      const tooltipZIndex = getZIndexValue('TOOLTIP');
      const modalZIndex = getZIndexValue('MODAL_CONTENT');

      expect(tooltipZIndex).toBeGreaterThan(modalZIndex);
      expect(isValidZIndex(tooltipZIndex)).toBe(true);
    });

    it('should prevent layering conflicts', () => {
      // Ensure no two different layers have the same value
      const values = Object.values(Z_INDEX);
      const uniqueValues = new Set(values);

      expect(uniqueValues.size).toBe(values.length);
    });
  });
});