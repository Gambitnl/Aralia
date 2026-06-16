const fs = require('fs');
const path = 'src/components/World3D/World3DScene.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add forgeAssetService to World3DSceneProps
code = code.replace(
  "viewProfile?: 'continent' | 'ground';",
  "viewProfile?: 'continent' | 'ground';\n  /** Service for runtime AI-generated textures. */\n  forgeAssetService?: ForgeAssetService;"
);

// 2. Destructure forgeAssetService from props
code = code.replace(
  "viewProfile = 'continent',\n}) => {",
  "viewProfile = 'continent',\n  forgeAssetService,\n}) => {"
);

// 3. Wrap Canvas with Provider
code = code.replace(
  "<Canvas",
  "<ForgeAssetContext.Provider value={forgeAssetService}>\n      <Canvas"
);

code = code.replace(
  "</Canvas>",
  "</Canvas>\n      </ForgeAssetContext.Provider>"
);

// 4. Update TerrainPiece
const terrainBody = `
  const service = React.useContext(ForgeAssetContext);
  const tex = useForgeTexture(getSemanticAssetKey({ surface: 'ground' }), service);
  return (
    <mesh geometry={geometry} position={chunkScenePos(chunk.cx, chunk.cy, origin)} receiveShadow={SHADOWS}>
      <meshStandardMaterial vertexColors flatShading map={tex || null} />
    </mesh>
  );
`;
code = code.replace(
  /return \(\s*<mesh geometry=\{geometry\} position=\{chunkScenePos\(chunk\.cx, chunk\.cy, origin\)\} receiveShadow=\{SHADOWS\}>\s*<meshStandardMaterial vertexColors flatShading \/>\s*<\/mesh>\s*\);/m,
  terrainBody.trim()
);

// 5. Update SiteBuilding
const siteBuildingStart = `  useFrame(({ camera }) => {`;

const siteBuildingStartWithHook = `  const service = React.useContext(ForgeAssetContext);
  const role = s.colorHex === '#c8923f' ? 'market' : s.colorHex === '#b09a72' ? 'house' : s.kind;
  const wallTex = useForgeTexture(getSemanticAssetKey({ surface: 'wall', role }), service);
  const roofTex = useForgeTexture(getSemanticAssetKey({ surface: 'roof', role }), service);

  useFrame(({ camera }) => {`;

code = code.replace(siteBuildingStart, siteBuildingStartWithHook);

code = code.replace(
  /<meshStandardMaterial color=\{p\.colorHex\} \/>/g,
  "{/* Apply wall texture only to tall perimeter/interior walls (h >= 2.0) */}\n            <meshStandardMaterial color={p.colorHex} map={p.h >= 2.0 ? (wallTex || null) : null} />"
);

code = code.replace(
  /<meshStandardMaterial color=\{s\.colorHex \?\? '#b09a72'\} \/>/g,
  "<meshStandardMaterial color={s.colorHex ?? '#b09a72'} map={wallTex || null} />"
);

code = code.replace(
  /<meshStandardMaterial color="#7a4a32" flatShading side=\{THREE\.DoubleSide\} \/>/g,
  "<meshStandardMaterial color=\"#7a4a32\" flatShading side={THREE.DoubleSide} map={roofTex || null} />"
);

fs.writeFileSync(path, code);
console.log('Patched World3DScene.tsx');
