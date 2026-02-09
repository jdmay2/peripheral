const { spawnSync } = require('node:child_process');

const token = process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN;
if (!token) {
  // Keep the workflow green when publishing isn't configured yet.
  // Once `NPM_TOKEN` is set in GitHub secrets, this script will publish.
  console.log('NPM_TOKEN is not set; skipping npm publish.');
  process.exit(0);
}

const result = spawnSync('pnpm', ['release'], { stdio: 'inherit' });
process.exit(result.status ?? 1);

