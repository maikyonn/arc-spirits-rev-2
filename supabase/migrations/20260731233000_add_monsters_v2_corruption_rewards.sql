-- Add rewards granted to a player when a monster corrupts them.
-- The editor treats this as an ordered list of up to six icon_pool IDs.

alter table arc_spirits_assets.monsters_v2
  add column if not exists corruption_reward_track jsonb not null default '[]'::jsonb;

alter table arc_spirits_assets.monsters_v2
  add column if not exists corruption_choose_amount integer not null default 2;

comment on column arc_spirits_assets.monsters_v2.corruption_reward_track is
  'Ordered icon_pool UUID strings granted to a player when this monster corrupts them (maximum 6).';

comment on column arc_spirits_assets.monsters_v2.corruption_choose_amount is
  'Exact number of rewards the corrupted player chooses from corruption_reward_track.';

do $$
declare
  broken_barrier_icon_id text;
	arcane_abyss_summon_icon_id text;
begin
  select id::text
    into broken_barrier_icon_id
  from arc_spirits_assets.icon_pool
  where id = '80f1d5a8-812e-4bb2-b341-68e69d9a3e38'::uuid
     or lower(name) = 'broken_barrier'
  order by (id = '80f1d5a8-812e-4bb2-b341-68e69d9a3e38'::uuid) desc, created_at
  limit 1;

  if broken_barrier_icon_id is null then
    raise exception 'Broken Barrier icon is required before adding monster corruption rewards';
  end if;

	select id::text
		into arcane_abyss_summon_icon_id
	from arc_spirits_assets.icon_pool
	where id = '12ff8ffe-20cb-4a86-a493-5e4ff8b9dc3e'::uuid
	   or name = 'Arcane Abyss Summon'
	order by (id = '12ff8ffe-20cb-4a86-a493-5e4ff8b9dc3e'::uuid) desc
	limit 1;

	if arcane_abyss_summon_icon_id is null then
		raise exception 'Arcane Abyss Summon icon is required before adding monster corruption rewards';
	end if;

  update arc_spirits_assets.monsters_v2
	set corruption_reward_track = jsonb_build_array(
		broken_barrier_icon_id,
		broken_barrier_icon_id,
		arcane_abyss_summon_icon_id
	),
	corruption_choose_amount = 2;

  execute format(
    'alter table arc_spirits_assets.monsters_v2 alter column corruption_reward_track set default %L::jsonb',
		jsonb_build_array(broken_barrier_icon_id, broken_barrier_icon_id, arcane_abyss_summon_icon_id)::text
  );
end
$$;

alter table arc_spirits_assets.monsters_v2
  drop constraint if exists monsters_v2_corruption_reward_track_shape_check;

alter table arc_spirits_assets.monsters_v2
  add constraint monsters_v2_corruption_reward_track_shape_check
  check (
    jsonb_typeof(corruption_reward_track) = 'array'
    and jsonb_array_length(corruption_reward_track) <= 6
  );

alter table arc_spirits_assets.monsters_v2
  drop constraint if exists monsters_v2_corruption_choose_amount_check;

alter table arc_spirits_assets.monsters_v2
  add constraint monsters_v2_corruption_choose_amount_check
  check (corruption_choose_amount between 0 and 6);
