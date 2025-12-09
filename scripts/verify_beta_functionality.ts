
import { AoECalculator } from '../src/systems/spells/targeting/AoECalculator';

// Helper to print grid
interface Position { x: number; y: number; }
function printGrid(tiles: Position[], label: string) {
  console.log(`\n--- ${label} ---`);
  console.log(`Total Tiles: ${tiles.length}`);
  if (tiles.length === 0) {
    console.log("No tiles affected.");
    return;
  }

  const xs = tiles.map(t => t.x);
  const ys = tiles.map(t => t.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Normalize to 0,0 for display if needed, but let's just print coordinates for verification
  // actually, let's print a small ascii map if it's small enough
  if (maxX - minX < 20 && maxY - minY < 20) {
     for (let y = minY; y <= maxY; y++) {
       let line = "";
       for (let x = minX; x <= maxX; x++) {
         if (tiles.some(t => t.x === x && t.y === y)) {
           line += "X ";
         } else {
           line += ". ";
         }
       }
       console.log(line);
     }
  } else {
    console.log(`Map too large to print (${maxX-minX}x${maxY-minY}). First 5 tiles:`, tiles.slice(0, 5));
  }
}

async function runSmokeTest() {
  console.log("=== Agent Beta Smoke Test ===");

  try {
    // 1. Fireball (Sphere 20ft)
    console.log("\n1. Testing Fireball (Sphere 20ft)");
    const fireballTiles = AoECalculator.getAffectedTiles(
      { x: 10, y: 10 },
      { shape: 'Sphere', size: 20 }
    );
    printGrid(fireballTiles, "Fireball (20ft Sphere)");
    if (fireballTiles.length < 10) throw new Error("Fireball seems too small");

    // 2. Burning Hands (Cone 15ft)
    console.log("\n2. Testing Burning Hands (Cone 15ft, East)");
    const coneTiles = AoECalculator.getAffectedTiles(
      { x: 5, y: 5 },
      { shape: 'Cone', size: 15 },
      { x: 1, y: 0 }
    );
    printGrid(coneTiles, "Burning Hands (15ft Cone East)");
    if (coneTiles.length === 0) throw new Error("Cone is empty");

    // 3. Lightning Bolt (Line 100ft)
    console.log("\n3. Testing Lightning Bolt (Line 100ft, East)");
    const lineTiles = AoECalculator.getAffectedTiles(
      { x: 0, y: 0 },
      { shape: 'Line', size: 100, width: 5 },
      { x: 1, y: 0 }
    );
    // Line 100ft / 5ft per tile = 20 tiles long approx
    console.log(`Line Tiles count: ${lineTiles.length}`);
    if (lineTiles.length < 15) throw new Error("Line seems too short");

    // 4. Thunderwave (Cube 15ft)
    console.log("\n4. Testing Thunderwave (Cube 15ft)");
    const cubeTiles = AoECalculator.getAffectedTiles(
      { x: 5, y: 5 },
      { shape: 'Cube', size: 15 }
    );
    printGrid(cubeTiles, "Thunderwave (15ft Cube)");
    // 15ft cube = 3x3 tiles = 9 tiles
    if (cubeTiles.length !== 9) throw new Error(`Expected 9 tiles for 15ft cube, got ${cubeTiles.length}`);

    console.log("\n✅ All Smoke Tests Passed!");

  } catch (error) {
    console.error("\n❌ Smoke Test Failed:", error);
    process.exit(1);
  }
}

runSmokeTest();
