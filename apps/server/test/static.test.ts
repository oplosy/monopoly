import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

let dir = '';
let app: FastifyInstance;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'deal-city-web-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Deal City</title>');
  writeFileSync(join(dir, 'assets', 'index-AbC123.js'), 'console.log(1)');
  writeFileSync(join(dir, 'bg_loop.mp4'), 'video');
  ({ app } = await buildServer({ ...loadConfig({}), webDist: dir }));
});

afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the web app files', () => {
  it('lets the browser keep content-hashed build files for a year, unasked', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/index-AbC123.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('has the browser check the page and the unhashed media again, so an update is never missed', async () => {
    for (const url of ['/', '/bg_loop.mp4', '/room/ABCDEF']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.headers['cache-control'], url).toBe('public, max-age=0');
    }
  });
});
