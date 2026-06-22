import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const loadBootstrapStart = appSource.indexOf('const loadBootstrap = async');
const bootstrapEffectStart = appSource.indexOf('useEffect(() => {', loadBootstrapStart);

assert.notEqual(loadBootstrapStart, -1, 'loadBootstrap precisa existir em App.tsx');
assert.notEqual(bootstrapEffectStart, -1, 'efeito de bootstrap precisa existir em App.tsx');

const loadBootstrapSource = appSource.slice(loadBootstrapStart, bootstrapEffectStart);
const bootstrapEffectSource = appSource.slice(
  bootstrapEffectStart,
  appSource.indexOf('useEffect(() => {', bootstrapEffectStart + 1)
);

assert.match(
  loadBootstrapSource,
  /background\s*=\s*false/,
  'loadBootstrap deve diferenciar carga inicial de sincronizacao em segundo plano'
);
assert.match(
  loadBootstrapSource,
  /if\s*\(\s*!background\s*\)\s*\{[\s\S]*?setIsBootstrapping\(true\)/,
  'sincronizacao em segundo plano nao deve ativar o loading global'
);
assert.match(
  loadBootstrapSource,
  /if\s*\(\s*!background\s*\)\s*\{[\s\S]*?setCurrentScreen\(getHomeScreenForUser/,
  'sincronizacao em segundo plano nao deve alterar a tela atual'
);
assert.match(
  bootstrapEffectSource,
  /setInterval\([\s\S]*?loadBootstrap\(\{\s*background:\s*true\s*\}\)/,
  'o refresh periodico deve executar em segundo plano'
);

console.log('bootstrap refresh tests passed');
