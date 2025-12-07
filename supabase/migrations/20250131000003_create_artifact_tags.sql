-- Create artifact_tags table for managing tags
create table if not exists "arc-spirits-rev2".artifact_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create index for tag name lookups
create index if not exists artifact_tags_name_idx on "arc-spirits-rev2".artifact_tags (name);

-- Add updated_at trigger
drop trigger if exists update_artifact_tags_updated_at on "arc-spirits-rev2".artifact_tags;

create trigger update_artifact_tags_updated_at
before update on "arc-spirits-rev2".artifact_tags
for each row
execute function public.update_updated_at_column();

-- Insert default rarity tags
insert into "arc-spirits-rev2".artifact_tags (name, color) values
  ('Rare', '#60a5fa'),
  ('Epic', '#a78bfa'),
  ('Legendary', '#fbbf24')
on conflict (name) do nothing;

