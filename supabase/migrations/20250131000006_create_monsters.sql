-- Create monsters table
create table if not exists "arc-spirits-rev2".monsters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythic')),
  attack_dice jsonb not null default '[]'::jsonb,
  defense integer not null default 0 check (defense >= 0),
  barrier integer not null default 0 check (barrier >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create index for rarity lookups
create index if not exists monsters_rarity_idx on "arc-spirits-rev2".monsters (rarity);

-- Create index for name lookups
create index if not exists monsters_name_idx on "arc-spirits-rev2".monsters (name);

-- Add updated_at trigger
drop trigger if exists update_monsters_updated_at on "arc-spirits-rev2".monsters;

create trigger update_monsters_updated_at
before update on "arc-spirits-rev2".monsters
for each row
execute function public.update_updated_at_column();

