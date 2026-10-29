import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function publicConfig(url, key) {
  const normalized = (url || '').trim().replace(/\/$/, '');
  const publishableKey = (key || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(normalized)) throw new Error('Set the SUPABASE_URL repository variable to your project URL (https://YOUR-PROJECT.supabase.co).');
  let legacyAnon = false;
  try { legacyAnon = JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) && !legacyAnon) throw new Error('Set SUPABASE_PUBLISHABLE_KEY to the public publishable key (or legacy anon key). Never use a secret or service_role key.');
  return { backend: 'supabase', url: normalized, publishableKey };
}
export function build(destination = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')) {
  // Validate before generating anything. A missing database must not publish a broken calendar.
  const config = publicConfig(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  mkdirSync(destination, { recursive: true });
  cpSync(join(root, 'public'), destination, { recursive: true });
  writeFileSync(join(destination, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(join(destination, '.nojekyll'), '');
  console.log('GitHub Pages files built. Only the public Supabase URL and publishable key are included.');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) build();
