const fs = require('fs');

let content = fs.readFileSync('.gitignore', 'utf8');

content = content.replace(
  '# Design Preview Tool (local-only developer tool)\n!src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx\nsrc/components/DesignPreview/\n',
  '# Design Preview Tool (local-only developer tool)\nsrc/components/DesignPreview/*\n!src/components/DesignPreview/steps/\nsrc/components/DesignPreview/steps/*\n!src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx\n'
);

fs.writeFileSync('.gitignore', content);
