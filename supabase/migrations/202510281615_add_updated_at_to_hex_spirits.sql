alter table if exists "arc-spirits-rev2".hex_spirits
  add column if not exists updated_at timestamptz not null default now();
