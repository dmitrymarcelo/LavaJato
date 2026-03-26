import { execFileSync } from 'child_process';

function runNodeScript(script, args = []) {
  execFileSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

runNodeScript('scripts/update-handoff.mjs');
runNodeScript('scripts/update-doc-metadata.mjs', ['--file', 'AGENTS.md']);
runNodeScript('scripts/update-doc-metadata.mjs', ['--file', 'SKILLS.md']);

console.log('Documentacao persistente sincronizada com sucesso.');
