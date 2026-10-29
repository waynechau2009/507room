import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicConfig } from '../scripts/build-pages.js';

test('Pages build requires project settings and rejects privileged keys', () => {
  assert.throws(() => publicConfig('', ''), /SUPABASE_URL/);
  assert.throws(() => publicConfig('http://project.supabase.co', 'sb_publishable_test'), /SUPABASE_URL/);
  assert.throws(() => publicConfig('https://project.supabase.co', 'sb_secret_do_not_publish'), /public publishable key/);
  const jwt = role => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.throws(() => publicConfig('https://project.supabase.co', jwt('service_role')), /Never use/);
  assert.equal(publicConfig('https://project.supabase.co/', jwt('anon')).backend, 'supabase');
  assert.deepEqual(publicConfig(' https://project.supabase.co/ ', 'sb_publishable_test'), { backend: 'supabase', url: 'https://project.supabase.co', publishableKey: 'sb_publishable_test' });
});
test('Supabase adapter sends guest RPC calls and recognizes concurrent edits', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const module = await import('../public/data.js?adapter');
  globalThis.fetch = async (url, options) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('config.json')) return Response.json({ backend: 'supabase', url: 'https://project.supabase.co', publishableKey: 'sb_publishable_test' });
    if (String(url).endsWith('list_room_occupancy')) return Response.json({ bookings: { '2026-11-01': { names: ['Yoyo'], version: 1 } } });
    return Response.json({ code: 'P0001' }, { status: 400 });
  };
  try {
    const result = await module.loadOccupancy();
    assert.deepEqual(result.bookings['2026-11-01'].names, ['Yoyo']);
    await assert.rejects(module.saveOccupancy({ date: '2026-11-01', names: ['Leo'], version: 0 }), module.ConflictError);
    assert.equal(calls[1][0], 'https://project.supabase.co/rest/v1/rpc/list_room_occupancy');
    assert.equal(calls[1][1].headers.apikey, 'sb_publishable_test');
    assert.equal(calls[2][1].body, JSON.stringify({ p_date: '2026-11-01', p_names: ['Leo'], p_version: 0 }));
  } finally { globalThis.fetch = originalFetch; }
});
test('Calendar rejects unexpected names in remote data', async () => {
  const originalFetch = globalThis.fetch;
  const module = await import('../public/data.js?invalid-data');
  globalThis.fetch = async url => String(url).endsWith('config.json') ? Response.json({ backend: 'local' }) : Response.json({ bookings: { '2026-11-01': { names: ['<img onerror=alert(1)>'], version: 1 } } });
  try { await assert.rejects(module.loadOccupancy(), /Invalid calendar response/); }
  finally { globalThis.fetch = originalFetch; }
});
