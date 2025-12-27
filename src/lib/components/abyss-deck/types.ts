import type { MonsterRow, EventRow, SpecialEffectRow, RewardRow } from '$lib/types/gameData';

export type AbyssScenario = {
	id: string;
	name: string;
	description: string | null;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type ScenarioCard = {
	id: string;
	scenario_id: string;
	card_type: 'monster' | 'event';
	card_id: string;
	order_num: number;
	created_at: string | null;
};

export type ResolvedRewardRow = RewardRow & {
	icon_urls: (string | null)[];
};

export type Monster = MonsterRow & {
	icon_url: string | null;
	art_url: string | null;
	resolved_reward_rows: ResolvedRewardRow[];
	effects: SpecialEffectRow[];
};

export type Event = EventRow & {
	art_url: string | null;
};

export type ScenarioCardWithData = ScenarioCard & {
	card_data: Monster | Event;
};
