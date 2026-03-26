import { execFileSync } from 'child_process';

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

const requiredFiles = ['HANDOFF.md', 'AGENTS.md', 'SKILLS.md'];

const changedFiles = runGit(['show', '--name-only', '--format=', 'HEAD'])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const missingFiles = requiredFiles.filter((file) => !changedFiles.includes(file));

if (missingFiles.length > 0) {
  throw new Error(
    `O commit mais recente nao inclui os arquivos persistentes obrigatorios: ${missingFiles.join(', ')}. Atualize a documentacao antes de publicar.`
  );
}

console.log(`Documentacao persistente confirmada no commit mais recente: ${requiredFiles.join(', ')}`);
