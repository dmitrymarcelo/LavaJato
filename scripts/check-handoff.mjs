import { execFileSync } from 'child_process';

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

const changedFiles = runGit(['show', '--name-only', '--format=', 'HEAD'])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (!changedFiles.includes('HANDOFF.md')) {
  throw new Error('O commit mais recente nao inclui o HANDOFF.md. Atualize o handoff antes de publicar.');
}

console.log('HANDOFF confirmado no commit mais recente.');
