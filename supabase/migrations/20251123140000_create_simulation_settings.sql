-- Simulation settings storage for shop analysis
create table if not exists simulation_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  shop_size integer not null default 8,
  draws_per_player integer not null default 2,
  monster_counts jsonb not null default '{}'::jsonb,
  monster_take_limits jsonb not null default '{}'::jsonb,
  rarity_overrides jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists simulation_settings_name_idx on simulation_settings (name);

-- keep updated_at current
create or replace function simulation_settings_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists simulation_settings_set_updated_at on simulation_settings;
create trigger simulation_settings_set_updated_at
before update on simulation_settings
for each row execute procedure simulation_settings_set_updated_at();
