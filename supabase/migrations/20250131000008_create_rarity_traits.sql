-- Create rarity_traits table
create table if not exists "arc-spirits-rev2".rarity_traits (
  id uuid primary key default gen_random_uuid(),
  cost integer not null unique check (cost > 0),
  origin_traits integer not null default 0 check (origin_traits >= 0),
  class_traits integer not null default 0 check (class_traits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create index for cost lookups
create index if not exists rarity_traits_cost_idx on "arc-spirits-rev2".rarity_traits (cost);

-- Add updated_at trigger
drop trigger if exists update_rarity_traits_updated_at on "arc-spirits-rev2".rarity_traits;

create trigger update_rarity_traits_updated_at
before update on "arc-spirits-rev2".rarity_traits
for each row
execute function public.update_updated_at_column();

-- Insert initial data based on cost requirements
insert into "arc-spirits-rev2".rarity_traits (cost, origin_traits, class_traits)
values
  (1, 1, 1),  -- 1 cost (commons): 1 origin trait, 1 class trait
  (3, 1, 1),  -- 3 cost: 1 origin trait, 1 class trait
  (5, 1, 2),  -- 5 cost: 1 origin trait, 2 class traits
  (7, 2, 2),  -- 7 cost: 2 origin traits, 2 class traits
  (9, 2, 3)   -- 9 cost: 2 origin traits, 3 class traits
on conflict (cost) do update
set
  origin_traits = excluded.origin_traits,
  class_traits = excluded.class_traits,
  updated_at = now();

