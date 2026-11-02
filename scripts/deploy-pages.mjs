// Builds the web app for GitHub Pages and publishes it to the `gh-pages` branch.
//
// Usage: npm run deploy:pages
//
// Pages is set to "Deploy from a branch: gh-pages". A GitHub Actions workflow would be
// tidier, but pushing workflow files needs a token with the `workflow` scope; this only
// needs the normal push access. The branch holds nothing but the last build, so it is
// rewritten on every deploy.
import { execSync } from 'node:child_process';
import { copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = (command, options = {}) => execSync(command, { stdio: 'inherit', ...options });
const dist = join(process.cwd(), 'dist');
const remote = execSync('git remote get-url origin').toString().trim();
const sourceCommit = execSync('git rev-parse --short HEAD').toString().trim();

run('npm test');
run('npm run build', { env: { ...process.env, GITHUB_PAGES: 'true' } });

// Pages has no rewrites: serve the app for any unknown path (e.g. a reload on /notes).
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
// Netlify/Cloudflare files mean nothing to Pages; .nojekyll stops it reprocessing the build.
rmSync(join(dist, '_headers'), { force: true });
rmSync(join(dist, '_redirects'), { force: true });
writeFileSync(join(dist, '.nojekyll'), '');

const git = (command) => run(`git ${command}`, { cwd: dist });
rmSync(join(dist, '.git'), { recursive: true, force: true });
git('init -q -b gh-pages');
git('add -A');
git(`commit -q -m "Deploy ${sourceCommit}"`);
git(`push -q --force ${remote} gh-pages`);
rmSync(join(dist, '.git'), { recursive: true, force: true });

console.log(`\nDeployed ${sourceCommit} to gh-pages.`);
