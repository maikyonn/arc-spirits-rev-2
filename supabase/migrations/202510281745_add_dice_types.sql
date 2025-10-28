alter table "arc-spirits-rev2".custom_dice
  add column if not exists dice_type text;

update "arc-spirits-rev2".custom_dice
set dice_type = coalesce(dice_type, 'attack');

alter table "arc-spirits-rev2".custom_dice
  drop constraint if exists custom_dice_type_check;

alter table "arc-spirits-rev2".custom_dice
  add constraint custom_dice_type_check
    check (dice_type = any (array['attack','special']));

update "arc-spirits-rev2".dice_sides
set reward_type = 'attack'
where reward_type is null or reward_type not in ('attack','special');

alter table "arc-spirits-rev2".dice_sides
  drop constraint if exists dice_sides_reward_type_check;

alter table "arc-spirits-rev2".dice_sides
  add constraint dice_sides_reward_type_check
    check (reward_type = any (array['attack','special']));
