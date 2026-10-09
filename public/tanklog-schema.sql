-- TankLog v2 — BYO Supabase schema
-- Source of truth: docs/v2-data-model.md
-- Run this once in the Supabase SQL Editor of YOUR project (after Auth is enabled).

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Force user_id from JWT on insert (defense in depth)
create or replace function public.set_row_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'Not authenticated';
  end if;
  return new;
end;
$$;

-- Ensure tank belongs to current user
create or replace function public.assert_tank_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tanks t
    where t.id = new.tank_id and t.user_id = auth.uid()
  ) then
    raise exception 'tank_id not owned by current user';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tanks
-- ---------------------------------------------------------------------------
create table if not exists public.tanks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('freshwater', 'planted', 'marine', 'reef')),
  volume_liters numeric null,
  start_date date null,
  notes text null,
  legacy_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create index if not exists tanks_user_id_idx on public.tanks (user_id);

drop trigger if exists tanks_set_user_id on public.tanks;
create trigger tanks_set_user_id
  before insert on public.tanks
  for each row execute function public.set_row_user_id();

drop trigger if exists tanks_set_updated_at on public.tanks;
create trigger tanks_set_updated_at
  before update on public.tanks
  for each row execute function public.set_updated_at();

alter table public.tanks enable row level security;

drop policy if exists tanks_select_own on public.tanks;
create policy tanks_select_own on public.tanks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists tanks_insert_own on public.tanks;
create policy tanks_insert_own on public.tanks
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists tanks_update_own on public.tanks;
create policy tanks_update_own on public.tanks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tanks_delete_own on public.tanks;
create policy tanks_delete_own on public.tanks
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- livestock (before events/photos that FK to it)
-- ---------------------------------------------------------------------------
create table if not exists public.livestock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  name_common text not null,
  name_scientific text null,
  category text not null check (category in ('fish', 'coral', 'invertebrate', 'plant')),
  sub_category text null,
  tank_zone text null check (tank_zone is null or tank_zone in ('top', 'mid', 'bottom', 'rock', 'sand')),
  origin text null check (origin is null or origin in ('wild', 'captive', 'frag')),
  date_added date not null,
  date_removed date null,
  status text not null check (status in ('active', 'removed', 'dead')),
  cost numeric null,
  notes text null,
  legacy_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists livestock_tank_status_idx on public.livestock (tank_id, status);
create index if not exists livestock_user_id_idx on public.livestock (user_id);

drop trigger if exists livestock_set_user_id on public.livestock;
create trigger livestock_set_user_id
  before insert on public.livestock
  for each row execute function public.set_row_user_id();

drop trigger if exists livestock_assert_tank on public.livestock;
create trigger livestock_assert_tank
  before insert or update on public.livestock
  for each row execute function public.assert_tank_owner();

drop trigger if exists livestock_set_updated_at on public.livestock;
create trigger livestock_set_updated_at
  before update on public.livestock
  for each row execute function public.set_updated_at();

alter table public.livestock enable row level security;

drop policy if exists livestock_select_own on public.livestock;
create policy livestock_select_own on public.livestock
  for select to authenticated using (user_id = auth.uid());

drop policy if exists livestock_insert_own on public.livestock;
create policy livestock_insert_own on public.livestock
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists livestock_update_own on public.livestock;
create policy livestock_update_own on public.livestock
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists livestock_delete_own on public.livestock;
create policy livestock_delete_own on public.livestock
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- water_tests
-- ---------------------------------------------------------------------------
create table if not exists public.water_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  test_group_id text not null,
  measured_at timestamptz not null,
  parameter text not null,
  value numeric not null,
  unit text not null,
  method text null,
  note text null,
  legacy_id text null,
  created_at timestamptz not null default now()
);

create index if not exists water_tests_tank_param_time_idx
  on public.water_tests (tank_id, parameter, measured_at desc);
create index if not exists water_tests_tank_group_idx
  on public.water_tests (tank_id, test_group_id);
create index if not exists water_tests_user_id_idx on public.water_tests (user_id);

drop trigger if exists water_tests_set_user_id on public.water_tests;
create trigger water_tests_set_user_id
  before insert on public.water_tests
  for each row execute function public.set_row_user_id();

drop trigger if exists water_tests_assert_tank on public.water_tests;
create trigger water_tests_assert_tank
  before insert or update on public.water_tests
  for each row execute function public.assert_tank_owner();

alter table public.water_tests enable row level security;

drop policy if exists water_tests_select_own on public.water_tests;
create policy water_tests_select_own on public.water_tests
  for select to authenticated using (user_id = auth.uid());

drop policy if exists water_tests_insert_own on public.water_tests;
create policy water_tests_insert_own on public.water_tests
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists water_tests_update_own on public.water_tests;
create policy water_tests_update_own on public.water_tests
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists water_tests_delete_own on public.water_tests;
create policy water_tests_delete_own on public.water_tests
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  occurred_at timestamptz not null,
  type text not null,
  description text not null,
  quantity numeric null,
  unit text null,
  product text null,
  note text null,
  target_type text not null default 'tank' check (target_type in ('tank', 'livestock')),
  livestock_id uuid null references public.livestock (id) on delete set null,
  legacy_id text null,
  created_at timestamptz not null default now(),
  constraint events_target_coherent check (
    (target_type = 'tank' and livestock_id is null)
    or (target_type = 'livestock' and livestock_id is not null)
  ),
  constraint events_type_allowed check (
    (
      target_type = 'tank'
      and type in (
        'water_change', 'dosing', 'maintenance',
        'livestock_addition', 'livestock_removal'
      )
    )
    or (
      target_type = 'livestock'
      and type in (
        'feeding', 'health', 'treatment', 'observation',
        'molt', 'spawn', 'fragging', 'other'
      )
    )
  )
);

create index if not exists events_tank_time_idx on public.events (tank_id, occurred_at desc);
create index if not exists events_user_id_idx on public.events (user_id);

drop trigger if exists events_set_user_id on public.events;
create trigger events_set_user_id
  before insert on public.events
  for each row execute function public.set_row_user_id();

drop trigger if exists events_assert_tank on public.events;
create trigger events_assert_tank
  before insert or update on public.events
  for each row execute function public.assert_tank_owner();

alter table public.events enable row level security;

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists events_delete_own on public.events;
create policy events_delete_own on public.events
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  title text not null,
  next_due timestamptz not null,
  start_due timestamptz null,
  end_due date null,
  repeat_every_days integer null check (repeat_every_days is null or repeat_every_days > 0),
  last_done timestamptz null,
  notes text null,
  event_type text not null check (
    event_type in (
      'water_change', 'dosing', 'maintenance',
      'livestock_addition', 'livestock_removal'
    )
  ),
  quantity numeric null,
  unit text null,
  product text null,
  onesignal_message_id text null,
  legacy_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_tank_next_due_idx on public.reminders (tank_id, next_due);
create index if not exists reminders_user_id_idx on public.reminders (user_id);

drop trigger if exists reminders_set_user_id on public.reminders;
create trigger reminders_set_user_id
  before insert on public.reminders
  for each row execute function public.set_row_user_id();

drop trigger if exists reminders_assert_tank on public.reminders;
create trigger reminders_assert_tank
  before insert or update on public.reminders
  for each row execute function public.assert_tank_owner();

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;

drop policy if exists reminders_select_own on public.reminders;
create policy reminders_select_own on public.reminders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists reminders_insert_own on public.reminders;
create policy reminders_insert_own on public.reminders
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reminders_update_own on public.reminders;
create policy reminders_update_own on public.reminders
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reminders_delete_own on public.reminders;
create policy reminders_delete_own on public.reminders
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  taken_at timestamptz not null,
  related_type text not null check (related_type in ('tank', 'livestock')),
  livestock_id uuid null references public.livestock (id) on delete set null,
  storage_path text not null,
  note text null,
  tags text[] not null default '{}',
  legacy_id text null,
  created_at timestamptz not null default now(),
  constraint photos_related_coherent check (
    (related_type = 'tank' and livestock_id is null)
    or (related_type = 'livestock' and livestock_id is not null)
  )
);

create index if not exists photos_tank_time_idx on public.photos (tank_id, taken_at desc);
create index if not exists photos_user_id_idx on public.photos (user_id);

drop trigger if exists photos_set_user_id on public.photos;
create trigger photos_set_user_id
  before insert on public.photos
  for each row execute function public.set_row_user_id();

drop trigger if exists photos_assert_tank on public.photos;
create trigger photos_assert_tank
  before insert or update on public.photos
  for each row execute function public.assert_tank_owner();

alter table public.photos enable row level security;

drop policy if exists photos_select_own on public.photos;
create policy photos_select_own on public.photos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists photos_insert_own on public.photos;
create policy photos_insert_own on public.photos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists photos_update_own on public.photos;
create policy photos_update_own on public.photos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists photos_delete_own on public.photos;
create policy photos_delete_own on public.photos
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- parameter_ranges
-- ---------------------------------------------------------------------------
create table if not exists public.parameter_ranges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  parameter text not null,
  min_value numeric null,
  max_value numeric null,
  unit text not null,
  status text not null check (status in ('optimal', 'acceptable', 'critical')),
  color text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parameter_ranges_minmax check (
    min_value is not null or max_value is not null
  ),
  unique (tank_id, parameter, status)
);

create index if not exists parameter_ranges_tank_param_idx
  on public.parameter_ranges (tank_id, parameter);

drop trigger if exists parameter_ranges_set_user_id on public.parameter_ranges;
create trigger parameter_ranges_set_user_id
  before insert on public.parameter_ranges
  for each row execute function public.set_row_user_id();

drop trigger if exists parameter_ranges_assert_tank on public.parameter_ranges;
create trigger parameter_ranges_assert_tank
  before insert or update on public.parameter_ranges
  for each row execute function public.assert_tank_owner();

drop trigger if exists parameter_ranges_set_updated_at on public.parameter_ranges;
create trigger parameter_ranges_set_updated_at
  before update on public.parameter_ranges
  for each row execute function public.set_updated_at();

alter table public.parameter_ranges enable row level security;

drop policy if exists parameter_ranges_select_own on public.parameter_ranges;
create policy parameter_ranges_select_own on public.parameter_ranges
  for select to authenticated using (user_id = auth.uid());

drop policy if exists parameter_ranges_insert_own on public.parameter_ranges;
create policy parameter_ranges_insert_own on public.parameter_ranges
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists parameter_ranges_update_own on public.parameter_ranges;
create policy parameter_ranges_update_own on public.parameter_ranges
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists parameter_ranges_delete_own on public.parameter_ranges;
create policy parameter_ranges_delete_own on public.parameter_ranges
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- equipment
-- ---------------------------------------------------------------------------
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tank_id uuid not null references public.tanks (id) on delete cascade,
  type text not null,
  brand_model text not null,
  installation_date date null,
  maintenance_interval text null,
  cost numeric null,
  notes text null,
  legacy_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_tank_id_idx on public.equipment (tank_id);

drop trigger if exists equipment_set_user_id on public.equipment;
create trigger equipment_set_user_id
  before insert on public.equipment
  for each row execute function public.set_row_user_id();

drop trigger if exists equipment_assert_tank on public.equipment;
create trigger equipment_assert_tank
  before insert or update on public.equipment
  for each row execute function public.assert_tank_owner();

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

alter table public.equipment enable row level security;

drop policy if exists equipment_select_own on public.equipment;
create policy equipment_select_own on public.equipment
  for select to authenticated using (user_id = auth.uid());

drop policy if exists equipment_insert_own on public.equipment;
create policy equipment_insert_own on public.equipment
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists equipment_update_own on public.equipment;
create policy equipment_update_own on public.equipment
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists equipment_delete_own on public.equipment;
create policy equipment_delete_own on public.equipment
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/{tank_id}/{tank|livestock}/{filename}
drop policy if exists photos_storage_select_own on storage.objects;
create policy photos_storage_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists photos_storage_insert_own on storage.objects;
create policy photos_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists photos_storage_update_own on storage.objects;
create policy photos_storage_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists photos_storage_delete_own on storage.objects;
create policy photos_storage_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Privileges for Data API (needed when "Automatically expose new tables" is OFF)
-- RLS still enforces per-user access.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.tanks to authenticated;
grant select, insert, update, delete on table public.livestock to authenticated;
grant select, insert, update, delete on table public.water_tests to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.reminders to authenticated;
grant select, insert, update, delete on table public.photos to authenticated;
grant select, insert, update, delete on table public.parameter_ranges to authenticated;
grant select, insert, update, delete on table public.equipment to authenticated;
