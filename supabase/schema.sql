create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  dob date,
  gender text,
  height_cm numeric(6,2),
  weight_kg numeric(6,2),
  activity_level text not null default 'sedentary',
  goal_weight_intent text not null default 'maintain',
  goal_muscle_intent text not null default 'maintain',
  calorie_goal integer,
  target_weight_kg numeric(6,2),
  target_body_fat_pct numeric(5,2),
  pref_show_calories boolean not null default true,
  pref_show_macros boolean not null default true,
  pref_show_micros boolean not null default false,
  pref_show_exercise boolean not null default true,
  pref_show_weight boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('meal', 'snack', 'ingredient')),
  created_at timestamptz not null default timezone('utc', now()),
  kcal_per_100g numeric(10,2) not null default 0,
  protein_g_per_100g numeric(10,2) not null default 0,
  carbs_g_per_100g numeric(10,2) not null default 0,
  fat_g_per_100g numeric(10,2) not null default 0,
  unit_conversions jsonb not null default '{}'::jsonb,
  food_id text
);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_id text,
  qty numeric(10,2) not null default 0,
  unit_code text not null,
  grams_resolved numeric(10,2),
  logged_at timestamptz not null default timezone('utc', now()),
  kcal numeric(10,2) not null default 0,
  protein_g numeric(10,2) not null default 0,
  carbs_g numeric(10,2) not null default 0,
  fat_g numeric(10,2) not null default 0
);

create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  value numeric(10,2) not null,
  unit text not null default 'kg',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exercise_types (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type_id text not null,
  minutes integer not null check (minutes > 0),
  timestamp_iso timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_updated_at on public.profiles(updated_at desc);
create index if not exists idx_meals_user_type_created on public.meals(user_id, type, created_at desc);
create index if not exists idx_meal_logs_user_logged_at on public.meal_logs(user_id, logged_at desc);
create index if not exists idx_meal_logs_user_day on public.meal_logs(user_id, logged_at);
create index if not exists idx_weights_user_date on public.weights(user_id, date desc);
create index if not exists idx_exercise_types_user on public.exercise_types(user_id);
create index if not exists idx_exercise_logs_user_timestamp on public.exercise_logs(user_id, timestamp_iso desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.daily_calorie_totals(p_user_id uuid)
returns table (
  date date,
  total_kcal numeric
)
language sql
security definer
set search_path = public
as $$
  select
    timezone('utc', logged_at)::date as date,
    coalesce(sum(kcal), 0)::numeric as total_kcal
  from public.meal_logs
  where user_id = p_user_id
  group by timezone('utc', logged_at)::date
  order by date asc
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.meal_logs to authenticated;
grant select, insert, update, delete on public.weights to authenticated;
grant select, insert, update, delete on public.exercise_types to authenticated;
grant select, insert, update, delete on public.exercise_logs to authenticated;
grant execute on function public.daily_calorie_totals(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_logs enable row level security;
alter table public.weights enable row level security;
alter table public.exercise_types enable row level security;
alter table public.exercise_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own" on public.meals
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own" on public.meals
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "meals_update_own" on public.meals;
create policy "meals_update_own" on public.meals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meals_delete_own" on public.meals;
create policy "meals_delete_own" on public.meals
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "meal_logs_select_own" on public.meal_logs;
create policy "meal_logs_select_own" on public.meal_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "meal_logs_insert_own" on public.meal_logs;
create policy "meal_logs_insert_own" on public.meal_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "meal_logs_update_own" on public.meal_logs;
create policy "meal_logs_update_own" on public.meal_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_logs_delete_own" on public.meal_logs;
create policy "meal_logs_delete_own" on public.meal_logs
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "weights_select_own" on public.weights;
create policy "weights_select_own" on public.weights
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "weights_insert_own" on public.weights;
create policy "weights_insert_own" on public.weights
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "weights_update_own" on public.weights;
create policy "weights_update_own" on public.weights
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "weights_delete_own" on public.weights;
create policy "weights_delete_own" on public.weights
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "exercise_types_select_own" on public.exercise_types;
create policy "exercise_types_select_own" on public.exercise_types
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "exercise_types_insert_own" on public.exercise_types;
create policy "exercise_types_insert_own" on public.exercise_types
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "exercise_types_update_own" on public.exercise_types;
create policy "exercise_types_update_own" on public.exercise_types
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "exercise_types_delete_own" on public.exercise_types;
create policy "exercise_types_delete_own" on public.exercise_types
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "exercise_logs_select_own" on public.exercise_logs;
create policy "exercise_logs_select_own" on public.exercise_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "exercise_logs_insert_own" on public.exercise_logs;
create policy "exercise_logs_insert_own" on public.exercise_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "exercise_logs_update_own" on public.exercise_logs;
create policy "exercise_logs_update_own" on public.exercise_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "exercise_logs_delete_own" on public.exercise_logs;
create policy "exercise_logs_delete_own" on public.exercise_logs
for delete
to authenticated
using (auth.uid() = user_id);
