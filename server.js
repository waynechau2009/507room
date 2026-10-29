import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const members = ['Yoyo', 'Sum', 'Hilary', 'Leo', 'Wayne', 'Cindy'];
const root = dirname(fileURLToPath(import.meta.url));
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function createApp(databasePath = join(root, 'data', 'room.sqlite')) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS occupancy (date TEXT PRIMARY KEY, names TEXT NOT NULL, version INTEGER NOT NULL)');
  const get = db.prepare('SELECT names, version FROM occupancy WHERE date = ?');
  const put = db.prepare('INSERT INTO occupancy(date, names, version) VALUES(?, ?, ?) ON CONFLICT(date) DO UPDATE SET names=excluded.names, version=excluded.version');
  const server = http.createServer(async (req, res) => {
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/occupancy' && req.method === 'GET') {
        const bookings = Object.fromEntries(db.prepare('SELECT date, names, version FROM occupancy ORDER BY date').all().map(row => [row.date, { names: JSON.parse(row.names), version: row.version }]));
        return json(200, { members, bookings });
      }
      if (url.pathname === '/api/occupancy' && req.method === 'PUT') {
        // Same-origin writes only; guests do not need accounts.
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(403, { error: 'Please make changes from the room calendar.' });
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(413, { error: 'Request too large.' }); }
        let input;
        try { input = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON.' }); }
        const { date, names, version } = input;
        if (!validDate(date) || !Array.isArray(names) || names.some(n => !members.includes(n)) || new Set(names).size !== names.length || !Number.isSafeInteger(version) || version < 0) return json(400, { error: 'Choose a valid date and room members.' });
        db.exec('BEGIN IMMEDIATE');
        try {
          const current = get.get(date);
          if ((current?.version ?? 0) !== version) {
            db.exec('ROLLBACK');
            return json(409, { error: 'Someone just changed this date. Review the latest names and try again.' });
          }
          const ordered = members.filter(n => names.includes(n));
          put.run(date, JSON.stringify(ordered), version + 1);
          db.exec('COMMIT');
          return json(200, { date, names: ordered, version: version + 1 });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      if (url.pathname.startsWith('/api/')) return json(404, { error: 'Not found.' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/data.js': ['data.js', 'text/javascript; charset=utf-8'], '/config.json': ['config.json', 'application/json'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
      const file = files[url.pathname];
      if (!file) return json(404, { error: 'Not found.' });
      res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'" });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(join(root, 'public', file[0])));
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) json(500, { error: 'Could not save changes. Please try again.' });
      else res.end();
    }
  });
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const server = createApp(process.env.DATA_FILE);
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`507 room listening on port ${server.address().port}`));
}
