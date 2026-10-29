-- Run this complete file once in your Supabase project's SQL Editor.
-- Re-running is safe: existing bookings are preserved.
-- Guest calendar: anyone with the public app configuration can read/edit bookings.
-- Direct table access is disabled. Only these validated functions are exposed.
begin;
create table if not exists public.room_occupancy (
  date date primary key,
  names text[] not null,
  version bigint not null check (version > 0),
  constraint known_roommates check (
    names <@ array['Yoyo','Sum','Hilary','Leo','Wayne','Cindy']::text[]
    and array_position(names, null) is null
  )
);
alter table public.room_occupancy enable row level security;
revoke all on public.room_occupancy from public, anon, authenticated;

create or replace function public.list_room_occupancy()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'members', jsonb_build_array('Yoyo','Sum','Hilary','Leo','Wayne','Cindy'),
    'bookings', coalesce(jsonb_object_agg(to_char(date, 'YYYY-MM-DD'), jsonb_build_object('names', names, 'version', version)), '{}'::jsonb)
  ) from public.room_occupancy;
$$;

create or replace function public.set_room_occupancy(p_date text, p_names text[], p_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stay_date date;
  current_version bigint;
  ordered_names text[];
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_names is null or p_version is null or p_version < 0 or p_version > 9007199254740990
    or cardinality(p_names) > 6 or array_position(p_names, null) is not null
    or not (p_names <@ array['Yoyo','Sum','Hilary','Leo','Wayne','Cindy']::text[])
    or cardinality(p_names) <> (select count(distinct name) from unnest(p_names) as name)
  then
    raise exception 'Choose a valid date and room members.' using errcode = '22023';
  end if;
  stay_date := p_date::date;
  if to_char(stay_date, 'YYYY-MM-DD') <> p_date then
    raise exception 'Choose a valid date.' using errcode = '22023';
  end if;
  -- Serialize edits including the first booking on a date, which has no row to lock.
  perform pg_advisory_xact_lock(507, (stay_date - date '2000-01-01'));
  select version into current_version from public.room_occupancy where date = stay_date;
  if coalesce(current_version, 0) <> p_version then
    raise exception 'Someone just changed this date. Review the latest names and try again.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(name order by position), '{}'::text[]) into ordered_names
    from unnest(array['Yoyo','Sum','Hilary','Leo','Wayne','Cindy']) with ordinality as roommates(name, position)
    where name = any(p_names);
  insert into public.room_occupancy(date, names, version) values (stay_date, ordered_names, p_version + 1)
    on conflict (date) do update set names = excluded.names, version = excluded.version;
  return jsonb_build_object('date', p_date, 'names', ordered_names, 'version', p_version + 1);
end;
$$;
revoke all on function public.list_room_occupancy() from public;
revoke all on function public.set_room_occupancy(text, text[], bigint) from public;
grant execute on function public.list_room_occupancy() to anon, authenticated;
grant execute on function public.set_room_occupancy(text, text[], bigint) to anon, authenticated;
commit;
