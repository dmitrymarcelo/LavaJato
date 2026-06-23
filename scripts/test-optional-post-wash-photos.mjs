import assert from 'node:assert/strict';
import fs from 'node:fs';

const inspectionPost = fs.readFileSync(new URL('../src/components/InspectionPost.tsx', import.meta.url), 'utf8');
const inspectionPre = fs.readFileSync(new URL('../src/components/InspectionPre.tsx', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../src/components/Settings.tsx', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');

assert.match(
  inspectionPost,
  /const canComplete = !hasAlreadyCompleted;/,
  'a tela deve permitir finalizar a lavagem sem fotos'
);
assert.doesNotMatch(inspectionPost, /Capture ao menos 1 foto/i);
assert.doesNotMatch(inspectionPost, /foto final para habilitar/i);
assert.doesNotMatch(inspectionPost, /required=\{!completedCount\}/);
assert.match(inspectionPost, /Fotos opcionais/i);

assert.match(
  inspectionPre,
  /const canStart = isWashersSelected && !hasAlreadyStarted;/,
  'a tela deve permitir iniciar a lavagem sem fotos'
);
assert.doesNotMatch(inspectionPre, /Capture ao menos 1 foto/i);
assert.doesNotMatch(inspectionPre, /required=\{false\}/);
assert.match(inspectionPre, /Fotos opcionais/i);
assert.doesNotMatch(settings, /Pular Inspe/i);

assert.doesNotMatch(
  server,
  /Adicione ao menos uma foto da pos-inspecao antes de concluir a lavagem/i
);
assert.doesNotMatch(
  server,
  /countPersistedPhotoEntries\(nextPostPhotos\)/
);

console.log('optional post-wash photo tests passed');
