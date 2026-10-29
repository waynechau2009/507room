# 507 room

A shared room occupancy calendar for Yoyo, Sum, Hilary, Leo, Wayne and Cindy.

## Run

Requires Node.js 24 or newer. There are no third-party dependencies or build steps.

```sh
npm start
```

The server listens on port 3000 (override with `PORT`). For development, use `npm run dev`. Run the integration tests with `npm test`.

Click a date, select everyone staying, and save. Uncheck everyone to make the date available again. Dates start blank, and multiple roommates can stay on the same day. The calendar uses each browser's local date. All guests using the same server share the same calendar; it refreshes every eight seconds and when a browser regains focus. Concurrent edits are detected and require review instead of silently overwriting another guest's changes.

Bookings persist in `data/room.sqlite`, using Node's built-in SQLite module. Set `DATA_FILE` to an absolute database path to change its location. Keep this directory on a persistent writable volume when hosting, and back it up with SQLite's backup tools. Restarting the server preserves bookings; deleting the database resets the calendar.

## Share with friends

Host this Node application on a server reachable by your friends, with HTTPS and persistent disk storage. Share that server's address. A local development server is not a public deployment. This is a guest calendar: everyone with access can edit any date, and names are selections rather than verified identities. For a private group, restrict access at your hosting provider or reverse proxy before exposing it publicly. No credentials are needed for local development.
