begin;

alter table "arc-spirits-rev2".hex_spirits
	rename column image_path to game_print_image_path;

alter table "arc-spirits-rev2".hex_spirits
	add column if not exists art_raw_image_path text;

commit;
