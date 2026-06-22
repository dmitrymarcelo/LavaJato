import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sidebarSource = fs.readFileSync(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(
  appSource,
  /alt="Norte Tech Logo"/,
  'o cabecalho nao deve repetir a logomarca da barra lateral'
);
assert.match(
  sidebarSource,
  /alt="Norte Tech Logo"/,
  'a logomarca principal deve permanecer na barra lateral'
);

console.log('single app logo tests passed');
