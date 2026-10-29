import { members, loadOccupancy, saveOccupancy, ConfigurationError, ConflictError } from './data.js';
const $ = id => document.getElementById(id);
const today = () => new Date();
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = date => new Date(`${date}T12:00:00`);
let month = new Date(today().getFullYear(), today().getMonth(), 1);
let bookings = {};
let loaded = false;
let saving = false;
let editVersion = 0;
let refreshing;
const avatar = name => `<span class="avatar" data-person="${name}">${name[0]}</span>`;
$('member-list').innerHTML = members.map(name => `<div class="person" data-person="${name}">${avatar(name)}<span>${name}</span><span class="person-dot"></span></div>`).join('');
$('member-options').innerHTML = members.map(name => `<label class="member-option">${avatar(name)}<span>${name}</span><input type="checkbox" name="member" value="${name}"></label>`).join('');

function render() {
  const year = month.getFullYear(), index = month.getMonth();
  $('month-title').textContent = month.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(year, index + 1, 0).getDate();
  const cells = Math.ceil((offset + days) / 7) * 7;
  const todayKey = key(today());
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < cells; i++) {
    const date = new Date(year, index, i - offset + 1);
    const dateKey = key(date), names = bookings[dateKey]?.names ?? [];
    const button = document.createElement('button');
    button.className = `day${date.getMonth() !== index ? ' other-month' : ''}${i % 7 >= 5 ? ' weekend' : ''}${dateKey === todayKey ? ' is-today' : ''}`;
    button.setAttribute('aria-label', `${date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}: ${names.length ? names.join(', ') : 'Available'}. Edit occupancy.`);
    if (dateKey === todayKey) button.setAttribute('aria-current', 'date');
    button.innerHTML = `<span class="day-number">${date.getDate()}</span>${names.map(name => `<span class="booking-chip" data-person="${name}">${name}</span>`).join('')}`;
    button.addEventListener('click', () => openDate(dateKey));
    fragment.append(button);
  }
  $('calendar').replaceChildren(fragment);
  let occupied = 0;
  for (let day = 1; day <= days; day++) if (bookings[key(new Date(year, index, day))]?.names.length) occupied++;
  $('occupied-count').textContent = loaded ? occupied : '—';
  $('available-count').textContent = loaded ? days - occupied : '—';
  const upcoming = Object.keys(bookings).sort().find(date => date >= todayKey && bookings[date].names.length);
  if (!loaded) return;
  if (upcoming) {
    const d = parse(upcoming);
    $('next-stay-content').innerHTML = `<div class="next-stay-detail"><div class="next-date"><small>${d.toLocaleDateString('en', { month: 'short' })}</small><strong>${d.getDate()}</strong></div><div><p>${bookings[upcoming].names.join(', ')}</p><span>${upcoming === todayKey ? 'Staying today' : d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</span></div></div>`;
  } else {
    $('next-stay-content').innerHTML = '<p class="empty-next">A little room for spontaneity.</p><span class="empty-caption">No upcoming stays. Pick a date to add yours.</span>';
  }
}
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const data = await loadOccupancy();
      $('connection-error').hidden = true;
      bookings = data.bookings;
      loaded = true;
      $('sync-status').textContent = 'All changes saved';
      render();
      return true;
    } catch (error) {
      $('connection-error').hidden = false;
      $('connection-error').textContent = error instanceof ConfigurationError ? error.message : 'We couldn’t load the shared calendar. Check your connection and try again. Blank dates may not reflect the latest bookings.';
      $('sync-status').textContent = loaded ? 'Offline · reconnecting…' : 'Cannot connect · retrying…';
      return false;
    } finally { refreshing = null; }
  })();
  return refreshing;
}
function loadSelection() {
  const booking = bookings[$('stay-date').value];
  editVersion = booking?.version ?? 0;
  document.querySelectorAll('input[name=member]').forEach(input => { input.checked = !!booking?.names.includes(input.value); });
}
async function openDate(date) {
  if (!await refresh()) return;
  $('stay-date').value = date;
  $('save-error').textContent = '';
  loadSelection();
  $('booking-dialog').showModal();
}
$('stay-date').addEventListener('change', () => { $('save-error').textContent = ''; loadSelection(); });
$('close-dialog').addEventListener('click', () => { if (!saving) $('booking-dialog').close(); });
$('booking-dialog').addEventListener('cancel', event => { if (saving) event.preventDefault(); });
$('clear-day').addEventListener('click', () => document.querySelectorAll('input[name=member]').forEach(input => { input.checked = false; }));
$('booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  saving = true;
  const payload = { date: $('stay-date').value, names: [...document.querySelectorAll('input[name=member]:checked')].map(input => input.value), version: editVersion };
  const controls = [...$('booking-form').elements];
  controls.forEach(control => { control.disabled = true; });
  $('save-booking').textContent = 'Saving…';
  $('save-error').textContent = '';
  try {
    const result = await saveOccupancy(payload);
    bookings[result.date] = { names: result.names, version: result.version };
    render();
    $('booking-dialog').close();
    await refresh();
  } catch (error) {
    if (error instanceof ConflictError) { await refresh(); loadSelection(); }
    $('save-error').textContent = error.message === 'Failed to fetch' ? 'Connection lost. Your changes haven’t been saved. Please try again.' : error.message; }
  finally {
    saving = false;
    controls.forEach(control => { control.disabled = false; });
    $('save-booking').innerHTML = 'Save changes <span aria-hidden="true">↗</span>';
  }
});
$('prev').addEventListener('click', () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); render(); });
$('next').addEventListener('click', () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); render(); });
$('today').addEventListener('click', () => { month = new Date(today().getFullYear(), today().getMonth(), 1); render(); });
$('book-today').addEventListener('click', () => openDate(key(today())));
window.addEventListener('focus', refresh);
setInterval(() => { if (!document.hidden && !saving) refresh(); }, 8000);
render();
refresh();
