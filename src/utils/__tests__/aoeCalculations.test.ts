const result = calculateAffectedTiles({
    shape: 'Sphere',
    origin: { x: 5, y: 5 },
    size: 20
});
// Should satisfy distance <= 4.
// E.g. (5,5) is dist 0. (5,9) is dist 4. (5,10) is dist 5 (out).
// (9,5) is dist 4.
const center = result.find(p => p.x === 5 && p.y === 5);
const edge = result.find(p => p.x === 9 && p.y === 5);
const outside = result.find(p => p.x === 10 && p.y === 5);

expect(center).toBeDefined();
expect(edge).toBeDefined();
expect(outside).toBeUndefined();

// Approximate count check: PI * r^2 area in tiles?
// r=4. Area ~ 50. 
// Manhattan/Grid circles are rough.
expect(result.length).toBeGreaterThan(30);
expect(result.length).toBeLessThan(60);
        });
    });

describe('Cone', () => {
    it('calculates 15-foot cone facing North (0 deg)', () => {
        // 15 ft = 3 tiles
        // North = -Y direction in logic check
        const result = calculateAffectedTiles({
            shape: 'Cone',
            origin: { x: 5, y: 5 },
            size: 15,
            direction: 0
        });

        // Should assume general Northward direction (y <= 5)
        const allNorth = result.every(p => p.y <= 5);
        expect(allNorth).toBe(true);

        // Should include directly north tiles
        expect(result).toContainEqual({ x: 5, y: 4 });
        expect(result).toContainEqual({ x: 5, y: 3 });
        expect(result).toContainEqual({ x: 5, y: 2 });

        // Should NOT include South
        expect(result).not.toContainEqual({ x: 5, y: 6 });
    });

    it('calculates 15-foot cone facing East (90 deg)', () => {
        const result = calculateAffectedTiles({
            shape: 'Cone',
            origin: { x: 5, y: 5 },
            size: 15,
            direction: 90
        });

        // Should be Eastward (x >= 5)
        const allEast = result.every(p => p.x >= 5);
        expect(allEast).toBe(true);

        // 15ft = 3 tiles.
        expect(result).toContainEqual({ x: 8, y: 5 }); // Edge
        expect(result).not.toContainEqual({ x: 9, y: 5 }); // Out
    });
});

describe('Cube', () => {
    it('calculates 10-foot cube', () => {
        // 10 ft = 2 tiles. 2x2 = 4 tiles.
        const result = calculateAffectedTiles({
            shape: 'Cube',
            origin: { x: 5, y: 5 },
            size: 10
        });

        expect(result.length).toBe(4);
        expect(result).toContainEqual({ x: 5, y: 5 });
        expect(result).toContainEqual({ x: 6, y: 5 });
        expect(result).toContainEqual({ x: 5, y: 6 });
        expect(result).toContainEqual({ x: 6, y: 6 });
    });
});

describe('Line', () => {
    it('calculates 30-foot line (North)', () => {
        // 30ft = 6 tiles.
        const result = calculateAffectedTiles({
            shape: 'Line',
            origin: { x: 5, y: 10 },
            size: 30,
            direction: 0 // North (-Y)
        });

        // Includes origin? Logic says yes if dist <= width/2 (0 is <= 0.5)
        expect(result).toContainEqual({ x: 5, y: 10 });
        // End point roughly 5, 4
        expect(result).toContainEqual({ x: 5, y: 4 });

        // Should be approximately straight line
        const xVariance = result.every(p => p.x === 5);
        expect(xVariance).toBe(true);

        expect(result.length).toBeGreaterThanOrEqual(6);
    });

    it('calculates diagonal line', () => {
        // 45 degrees (North East)
        const result = calculateAffectedTiles({
            shape: 'Line',
            origin: { x: 0, y: 0 },
            size: 10, // 2 tiles length (diagonal is sqrt(2)*tile)
            direction: 45
        });

        // Just check it generates something
        expect(result.length).toBeGreaterThan(0);
        // Should contain 1, -1 (approx NE if Y is down? 0 deg N is -Y, 90 E is X. 45 is NE.)
        // 0=N(-Y), 90=E(+X). 45 is between N and E. +X, -Y.
        // So x increases, y decreases.
        // Origin is 0,0. Target roughly 1, -1.
        // Let's verify coordinates
        const hasDiagonal = result.some(p => p.x > 0 && p.y < 0);
        expect(hasDiagonal).toBe(true);
    });
});
});
