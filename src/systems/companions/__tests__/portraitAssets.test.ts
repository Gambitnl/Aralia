/**
 * Regression coverage for companion portrait compatibility.
 *
 * These tests protect legacy saves from requesting nonexistent placeholder
 * images while proving that the filter does not block real future assets.
 */

import { describe, expect, it } from 'vitest';
import { usableCompanionAvatarUrl } from '../portraitAssets';

describe('usableCompanionAvatarUrl', () => {
  it.each([undefined, '', '   ', '/avatars/kaelen.png', '/avatars/elara.png'])(
    'falls back to initials for %s',
    (avatarUrl) => {
      expect(usableCompanionAvatarUrl(avatarUrl)).toBeUndefined();
    },
  );

  it('preserves and trims a real authored portrait URL', () => {
    expect(usableCompanionAvatarUrl(' /portraits/companions/elara.webp ')).toBe(
      '/portraits/companions/elara.webp',
    );
  });
});
