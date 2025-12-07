begin;

alter table "arc-spirits-rev2".hex_spirits
	add column if not exists icon_slots jsonb not null default '[]'::jsonb;

update "arc-spirits-rev2".hex_spirits
set icon_slots = (
	case
		when origin_id is not null and class_id is not null then jsonb_build_array(
			jsonb_build_object('type', 'origin', 'ref_id', origin_id),
			jsonb_build_object('type', 'class', 'ref_id', class_id)
		)
		when origin_id is not null then jsonb_build_array(jsonb_build_object('type', 'origin', 'ref_id', origin_id))
		when class_id is not null then jsonb_build_array(jsonb_build_object('type', 'class', 'ref_id', class_id))
		else '[]'::jsonb
	end
)
where icon_slots = '[]'::jsonb;

commit;
