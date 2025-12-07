-- Add background_image_path column to custom_dice table
alter table "arc-spirits-rev2".custom_dice
add column if not exists background_image_path text;

