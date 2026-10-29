import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, members } from '../server.js';

async function start(path) {
  const app = createApp(path);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.address().port}`;
  return { app, url, close: () => new Promise(resolve => app.close(resolve)) };
}
const put = (url, data, headers = {}) => fetch(`${url}/api/occupancy`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
test('shared calendar saves, detects conflicts, clears, validates and survives restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), '507room-'));
  let server = await start(join(dir, 'test.sqlite'));
  try {
    const initial = await (await fetch(`${server.url}/api/occupancy`)).json();
    assert.deepEqual(initial, { members, bookings: {} });
    const home = await fetch(server.url);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Make room for/);
    const data = { date: '2026-11-01', names: ['Wayne', 'Yoyo'], version: 0 };
    const saved = await put(server.url, data);
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).names, ['Yoyo', 'Wayne']);
    assert.equal((await put(server.url, data)).status, 409);
    for (const invalid of [ { ...data, date: '2026-02-30' }, { ...data, names: ['Unknown'] }, { ...data, names: ['Yoyo', 'Yoyo'] }, { ...data, version: -1 } ]) assert.equal((await put(server.url, invalid)).status, 400);
    assert.equal((await put(server.url, { ...data, version: 1 }, { Origin: 'https://other.example' })).status, 403);
    const malformed = await fetch(`${server.url}/api/occupancy`, { method: 'PUT', body: '{' });
    assert.equal(malformed.status, 400);
    await server.close();
    server = await start(join(dir, 'test.sqlite'));
    let shared = await (await fetch(`${server.url}/api/occupancy`)).json();
    assert.deepEqual(shared.bookings[data.date], { names: ['Yoyo', 'Wayne'], version: 1 });
    assert.equal((await put(server.url, { ...data, names: [], version: 1 })).status, 200);
    shared = await (await fetch(`${server.url}/api/occupancy`)).json();
    assert.deepEqual(shared.bookings[data.date], { names: [], version: 2 });
    assert.equal((await fetch(`${server.url}/data/room.sqlite`)).status, 404);
  } finally { await server.close(); rmSync(dir, { recursive: true, force: true }); }
});
