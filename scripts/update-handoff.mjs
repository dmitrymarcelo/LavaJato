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

function replaceLine(content, pattern, replacement) {
  if (!pattern.test(content)) {
    throw new Error(`Nao encontrei o trecho esperado para ${pattern}`);
  }

  return content.replace(pattern, replacement);
}

function buildCommitLines(count) {
  return runGit(['log', '--oneline', `-${count}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, ...messageParts] = line.trim().split(' ');
      const message = messageParts.join(' ').trim();
      return `- \`${hash}\` \`${message}\``;
    })
    .join('\n');
}

function replaceSection(content, heading, nextHeadingPattern, sectionBody) {
  const pattern = new RegExp(`(${heading}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n${nextHeadingPattern})`);
  const match = content.match(pattern);

  if (!match) {
    throw new Error(`Nao encontrei a secao ${heading}`);
  }

  return content.replace(pattern, `$1${sectionBody}\n`);
}

const targetPath = path.resolve(getArgValue('--output') || 'HANDOFF.md');
const deployedSha = getArgValue('--deployed-sha');
const recentCount = Number(getArgValue('--recent-count') || 8);
const timeZone = getArgValue('--timezone') || DEFAULT_TIMEZONE;

const currentCommit = deployedSha || runGit(['rev-parse', 'HEAD']);
const currentShortCommit = runGit(['rev-parse', '--short', currentCommit]);
const updatedAt = formatDate(timeZone);
const recentCommits = buildCommitLines(recentCount);

let handoff = fs.readFileSync(targetPath, 'utf8');

handoff = replaceLine(handoff, /^Atualizado em: .*$/m, `Atualizado em: ${updatedAt}`);
handoff = replaceLine(handoff, /^- Commit atual: .*$/m, `- Commit atual: \`${currentCommit}\``);
handoff = replaceLine(
  handoff,
  /^- Se mudar de computador, o ideal e continuar a partir do commit `[^`]+` ou posterior\.$/m,
  `- Se mudar de computador, o ideal e continuar a partir do commit \`${currentShortCommit}\` ou posterior.`
);
handoff = replaceSection(handoff, '## Commits recentes relevantes', '## ', recentCommits);

fs.writeFileSync(targetPath, handoff, 'utf8');

console.log(`HANDOFF atualizado em ${targetPath}`);
