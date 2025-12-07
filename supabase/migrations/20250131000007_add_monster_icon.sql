-- Add icon column to monsters table
alter table if exists "arc-spirits-rev2".monsters
add column if not exists icon text null;

