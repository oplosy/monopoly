import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from './app';
import { loadConfig } from './config';

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
// Both src/ (tsx) and dist/ (built) sit two levels below the repo's apps/ directory.
config.webDist ??= resolve(here, '../../web/dist');

const { app } = await buildServer(config);
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Deal City server listening on :${config.port}`);
