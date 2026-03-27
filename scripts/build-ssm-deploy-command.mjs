import fs from 'fs';

const deploySha = process.env.DEPLOY_SHA || process.env.GITHUB_SHA;

if (!deploySha) {
  throw new Error('DEPLOY_SHA ou GITHUB_SHA deve estar definido para gerar o payload do deploy.');
}

function readBase64(paths) {
  const candidates = Array.isArray(paths) ? paths : [paths];

  for (const path of candidates) {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path).toString('base64');
    }
  }

  throw new Error(`Nenhum arquivo encontrado para leitura: ${candidates.join(', ')}`);
}

const handoff = readBase64(['HANDOFF_AWS.md', 'HANDOFF.md']);
const agents = readBase64(['AGENTS_AWS.md', 'AGENTS.md']);
const skills = readBase64(['SKILLS_AWS.md', 'SKILLS.md']);

const deployScript = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `DEPLOY_SHA="${deploySha}"`,
  'cd /opt/lavajato/app',
  'git restore --worktree --staged HANDOFF.md AGENTS.md SKILLS.md || true',
  'git fetch origin',
  'git checkout main',
  'git pull --ff-only origin main',
  'CURRENT_SHA="$(git rev-parse HEAD)"',
  'echo "Repository SHA: ${CURRENT_SHA}"',
  'if [ "${CURRENT_SHA}" != "${DEPLOY_SHA}" ]; then',
  '  echo "Repository SHA mismatch. Expected ${DEPLOY_SHA}, got ${CURRENT_SHA}."',
  '  exit 1',
  'fi',
  'mkdir -p /opt/lavajato/runtime',
  `printf '%s' '${handoff}' | base64 -d > /opt/lavajato/runtime/HANDOFF_AWS.md`,
  `printf '%s' '${agents}' | base64 -d > /opt/lavajato/runtime/AGENTS_AWS.md`,
  `printf '%s' '${skills}' | base64 -d > /opt/lavajato/runtime/SKILLS_AWS.md`,
  'cp /opt/lavajato/runtime/HANDOFF_AWS.md /opt/lavajato/app/HANDOFF.md',
  'cp /opt/lavajato/runtime/AGENTS_AWS.md /opt/lavajato/app/AGENTS.md',
  'cp /opt/lavajato/runtime/SKILLS_AWS.md /opt/lavajato/app/SKILLS.md',
  'export APP_BUILD_SHA="${DEPLOY_SHA}"',
  'docker compose rm -sf web || true',
  'docker compose build --no-cache web',
  'docker compose up -d --build --force-recreate',
  'for attempt in $(seq 1 12); do',
  '  if curl -fsS http://localhost/ | grep -F "app-build-sha" | grep -F "${DEPLOY_SHA}" > /dev/null; then',
  '    echo "Frontend serving deployed SHA ${DEPLOY_SHA}."',
  '    break',
  '  fi',
  '  if [ "${attempt}" -eq 12 ]; then',
  '    echo "Frontend did not serve deployed SHA ${DEPLOY_SHA} after deploy."',
  '    curl -fsS http://localhost/ || true',
  '    exit 1',
  '  fi',
  '  sleep 5',
  'done',
  'docker compose ps',
  'curl -fsS http://localhost/api/health',
].join('\n');

const commandPayload = {
  commands: [
    `cat <<'SCRIPT' >/tmp/lavajato-deploy.sh\n${deployScript}\nSCRIPT`,
    'bash /tmp/lavajato-deploy.sh',
  ],
};

process.stdout.write(JSON.stringify(commandPayload));
