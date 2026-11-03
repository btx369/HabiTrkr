// Runs every end-to-end suite in turn and fails if any of them did.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const suite of ['habits', 'notes', 'events', 'profile', 'pages']) {
  console.log(`\n===== ${suite}`);
  const { status } = spawnSync(process.execPath, [path.join(dir, `${suite}.mjs`)], { stdio: 'inherit' });
  if (status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll suites passed');
process.exitCode = failed ? 1 : 0;
