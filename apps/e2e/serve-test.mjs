/* global process */
// Builds the app for production, then runs the built server in test mode (client seeds allowed).
// NODE_ENV=test must not reach the builds: Vite would then emit React's development bundle.
import { execSync, spawn } from 'node:child_process';

const buildEnv = { ...process.env };
delete buildEnv.NODE_ENV;
execSync('pnpm --filter @deal-city/web build && pnpm --filter @deal-city/server build', { stdio: 'inherit', env: buildEnv });

const server = spawn(process.execPath, ['../server/dist/main.js'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
