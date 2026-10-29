export const members = ['Yoyo', 'Sum', 'Hilary', 'Leo', 'Wayne', 'Cindy'];
export class ConfigurationError extends Error {}
export class ConflictError extends Error {}
let configuration;

async function config() {
  if (!configuration) {
    configuration = (async () => {
      const response = await fetch(new URL('./config.json', import.meta.url), { cache: 'no-store' });
      if (!response.ok) throw new ConfigurationError('Calendar setup is incomplete. Please contact Wayne.');
      const value = await response.json();
      if (value.backend === 'local') return value;
      if (value.backend !== 'supabase' || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value.url) || !value.publishableKey) {
        throw new ConfigurationError('Calendar setup is incomplete. Please contact Wayne.');
      }
      return value;
    })().catch(error => { configuration = undefined; throw error; });
  }
  return configuration;
}
async function request(operation, payload) {
  const settings = await config();
  let response;
  if (settings.backend === 'local') {
    response = await fetch(new URL('../api/occupancy', import.meta.url), payload ? {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    } : { cache: 'no-store' });
  } else {
    // Publishable keys identify this public app; privileged keys never belong here.
    response = await fetch(`${settings.url}/rest/v1/rpc/${operation}`, {
      method: 'POST', headers: { apikey: settings.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ? { p_date: payload.date, p_names: payload.names, p_version: payload.version } : {}),
      cache: 'no-store',
    });
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409 || data.code === 'P0001') throw new ConflictError('Someone just changed this date. Review the latest names and try again.');
    throw new Error(settings.backend === 'local' ? data.error || 'Could not save. Please try again.' : 'Cannot reach the shared calendar. Please try again, or ask Wayne to check the database setup.');
  }
  return data;
}
export async function loadOccupancy() {
  const data = await request('list_room_occupancy');
  // Only known names enter the calendar's HTML, even if a backend is misconfigured.
  if (!data || !data.bookings || typeof data.bookings !== 'object' || Array.isArray(data.bookings)) throw new Error('Invalid calendar response.');
  for (const [date, booking] of Object.entries(data.bookings)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(booking?.names) || booking.names.some(name => !members.includes(name)) || !Number.isSafeInteger(booking.version) || booking.version < 1) throw new Error('Invalid calendar response.');
  }
  return data;
}
export async function saveOccupancy(payload) {
  return request('set_room_occupancy', payload);
}
