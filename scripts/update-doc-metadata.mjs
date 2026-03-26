import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const DEFAULT_TIMEZONE = process.env.HANDOFF_TIMEZONE || 'America/Manaus';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function formatDate(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function replaceLine(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Nao encontrei a linha esperada para ${label} em ${targetPath}`);
  }

  return content.replace(pattern, replacement);
}

const targetPath = path.resolve(getArgValue('--file') || '');
const deployedSha = getArgValue('--deployed-sha');
const timeZone = getArgValue('--timezone') || DEFAULT_TIMEZONE;

if (!targetPath) {
  throw new Error('Use --file para informar o documento a atualizar.');
}

const currentCommit = deployedSha || runGit(['rev-parse', 'HEAD']);
const updatedAt = formatDate(timeZone);

let content = fs.readFileSync(targetPath, 'utf8');

content = replaceLine(content, /^Atualizado em: .*$/m, `Atualizado em: ${updatedAt}`, 'Atualizado em');
content = replaceLine(
  content,
  /^Commit de referencia: .*$/m,
  `Commit de referencia: \`${currentCommit}\``,
  'Commit de referencia'
);

fs.writeFileSync(targetPath, content, 'utf8');

console.log(`Metadados atualizados em ${targetPath}`);
