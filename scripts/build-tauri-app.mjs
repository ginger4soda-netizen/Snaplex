import { copyFileSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWindows = process.platform === 'win32';
const bridgeName = isWindows ? 'snaplex-bridge.exe' : 'snaplex-bridge';
const stagedBridge = join(root, 'src-tauri', 'app', 'resources', bridgeName);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('pnpm', ['build']);
run('cargo', [
  'build',
  '--manifest-path',
  join(root, 'src-tauri', 'Cargo.toml'),
  '-p',
  'snaplex-bridge',
  '--release',
]);

mkdirSync(dirname(stagedBridge), { recursive: true });
copyFileSync(join(root, 'src-tauri', 'target', 'release', bridgeName), stagedBridge);
if (!isWindows) {
  chmodSync(stagedBridge, 0o755);
}
