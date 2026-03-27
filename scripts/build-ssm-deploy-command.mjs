const deploySha = process.env.DEPLOY_SHA || process.env.GITHUB_SHA;

if (!deploySha) {
  throw new Error('DEPLOY_SHA ou GITHUB_SHA deve estar definido para gerar o payload do deploy.');
}

const deployScript = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `DEPLOY_SHA="${deploySha}"`,
  'cd /opt/lavajato/app',
  'if ! git restore --worktree --staged HANDOFF.md AGENTS.md SKILLS.md 2>/dev/null; then',
  '  git checkout -- HANDOFF.md AGENTS.md SKILLS.md || true',
  'fi',
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
  'cp HANDOFF.md /opt/lavajato/runtime/HANDOFF_AWS.md',
  'cp AGENTS.md /opt/lavajato/runtime/AGENTS_AWS.md',
  'cp SKILLS.md /opt/lavajato/runtime/SKILLS_AWS.md',
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
