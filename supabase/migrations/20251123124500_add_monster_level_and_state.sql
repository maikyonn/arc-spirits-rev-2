-- Add level and state to monsters
alter table "arc-spirits-rev2".monsters
  add column if not exists level integer not null default 1 check (level >= 1),
  add column if not exists state text not null default 'normal' check (state in ('normal','tainted','corrupt','fallen','special'));
