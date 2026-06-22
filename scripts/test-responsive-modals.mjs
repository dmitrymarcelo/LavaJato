import assert from 'node:assert/strict';
import fs from 'node:fs';

const modalSource = fs.readFileSync(new URL('../src/components/ModalSurface.tsx', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const screenAnimation = cssSource.slice(
  cssSource.indexOf('@keyframes screen-enter'),
  cssSource.indexOf('@keyframes surface-enter')
);

assert.match(modalSource, /createPortal/);
assert.match(modalSource, /document\.body/);
assert.match(modalSource, /overflow-y-auto/);
assert.match(modalSource, /100dvh/);
assert.doesNotMatch(
  screenAnimation,
  /transform:/,
  'a animacao global da tela nao pode criar um containing block para modais fixed'
);

console.log('responsive modal tests passed');
