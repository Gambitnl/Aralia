const fs = require('fs');
const path = 'src/components/World3D/World3DDemo.tsx';
let code = fs.readFileSync(path, 'utf8');

const importToAdd = `import { createForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';
import { assetAddress } from '@/systems/worldforge/assets/assetKey';

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
let _stubService;
if (urlParams.get('stubForgeAssets') === '1') {
  _stubService = createForgeAssetService({
    generator: {
      async generate(key) {
        // Red checkerboard or simple texture data URI
        const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMDA4YAQFDzMCmAAAAAElFTkSuQmCC'; // 2x2 red and black
        return { key, address: assetAddress(key), source: 'generated', imageUri: dataUri };
      }
    },
    online: true,
  });
}
`;

code = code.replace("import World3DScene from './World3DScene';", "import World3DScene from './World3DScene';\n" + importToAdd);

code = code.replace(
  "viewProfile={groundMode ? 'ground' : 'continent'} />",
  "viewProfile={groundMode ? 'ground' : 'continent'}\n        forgeAssetService={_stubService}\n      />"
);

fs.writeFileSync(path, code);
console.log('Patched World3DDemo.tsx');
