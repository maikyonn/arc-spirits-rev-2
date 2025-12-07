-- Create extra_components table for misc game components
create table if not exists "arc-spirits-rev2".extra_components (
  id uuid primary key default gen_random_uuid(),
  name varchar not null,
  description text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create index for name lookups
create index if not exists extra_components_name_idx on "arc-spirits-rev2".extra_components (name);

-- Add updated_at trigger
drop trigger if exists update_extra_components_updated_at on "arc-spirits-rev2".extra_components;

create trigger update_extra_components_updated_at
before update on "arc-spirits-rev2".extra_components
for each row
execute function public.update_updated_at_column();

