create table if not exists "arc-spirits-rev2".custom_dice (
  id uuid primary key default gen_random_uuid(),
  name varchar not null unique,
  description text,
  icon varchar,
  color varchar default '#4a9eff',
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_dice_category_check check (
    category is null or category = any (array['attack','critical','defense','utility'])
  )
);

create table if not exists "arc-spirits-rev2".dice_sides (
  id uuid primary key default gen_random_uuid(),
  dice_id uuid not null references "arc-spirits-rev2".custom_dice(id) on delete cascade,
  side_number integer not null,
  reward_type varchar not null,
  reward_value text not null,
  reward_description text,
  icon varchar,
  created_at timestamptz not null default now(),
  constraint dice_sides_side_number_check check (side_number >= 1),
  constraint dice_sides_dice_id_side_number_key unique (dice_id, side_number)
);

insert into "arc-spirits-rev2".custom_dice (id, name, description, icon, color, category, created_at, updated_at)
select id, name, description, icon, color, category, created_at, updated_at
from game_data.custom_dice
on conflict (id) do nothing;

insert into "arc-spirits-rev2".dice_sides (id, dice_id, side_number, reward_type, reward_value, reward_description, icon, created_at)
select id, dice_id, side_number, reward_type, reward_value, reward_description, icon, created_at
from game_data.dice_sides
on conflict (id) do nothing;
