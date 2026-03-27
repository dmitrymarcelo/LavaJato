import { spawnSync } from 'child_process';

const nextEnv = {
  ...process.env,
  VITE_APP_BUILD_SHA: process.env.VITE_APP_BUILD_SHA || process.env.APP_BUILD_SHA || 'local',
};

const viteBin = process.platform === 'win32'
  ? 'node_modules/vite/bin/vite.js'
  : './node_modules/vite/bin/vite.js';

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd: process.cwd(),
  env: nextEnv,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
