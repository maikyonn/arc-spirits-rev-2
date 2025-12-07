-- Rework monsters schema: remove dice/defense, add damage and image_path
alter table "arc-spirits-rev2".monsters
  add column if not exists damage integer not null default 0 check (damage >= 0),
  add column if not exists image_path text;

alter table "arc-spirits-rev2".monsters
  drop column if exists attack_dice,
  drop column if exists defense,
  drop column if exists barrier;
