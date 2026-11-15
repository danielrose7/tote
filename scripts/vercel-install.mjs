// Vercel install step for the web app (wired up via vercel.json "installCommand").
//
// The Vercel deploy only needs the Next.js app, but pnpm-lock.yaml also records
// the mobile-app and chrome-extension workspace projects. .vercelignore strips
// mobile-app from the upload, which leaves the lockfile describing a project
// whose package.json is missing, and recent pnpm versions refuse a frozen
// install in that state. So build a checkout that only contains the web app:
// delete the other projects and drop them from the workspace list. Extra
// importers left in the lockfile are fine; pnpm ignores importers that are not
// in the workspace.
//
// This deletes directories, so it only runs on Vercel's build machines.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

if (!process.env.VERCEL) {
  console.error(
    'scripts/vercel-install.mjs deletes mobile-app/ and chrome-extension/; it only runs when VERCEL is set.',
  );
  process.exit(1);
}

const REMOVED = ['mobile-app', 'chrome-extension', 'ios', 'android'];
for (const dir of REMOVED) rmSync(dir, { recursive: true, force: true });

const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
const trimmed = workspace
  .split('\n')
  .filter(
    (line) =>
      !REMOVED.some((dir) =>
        new RegExp(`^\\s*-\\s*['"]?${dir}['"]?\\s*$`).test(line),
      ),
  )
  .join('\n');
if (trimmed === workspace) {
  console.error(
    'pnpm-workspace.yaml did not list mobile-app or chrome-extension; update scripts/vercel-install.mjs.',
  );
  process.exit(1);
}
writeFileSync('pnpm-workspace.yaml', trimmed);

execFileSync('pnpm', ['install', '--frozen-lockfile'], { stdio: 'inherit' });
