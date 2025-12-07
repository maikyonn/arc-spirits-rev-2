import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { SpecialCategoryRow } from '$lib/types/gameData';

export type { SpecialCategoryRow };

export interface SpecialCategoryFormData {
	id?: string;
	name: string;
	description: string;
	color: string;
	icon_emoji: string;
	position: number;
	slot_1_class_ids: string[];
	slot_2_class_ids: string[];
	slot_3_class_ids: string[];
}

const DEFAULT_COLOR = '#8b5cf6';
const DEFAULT_ICON_EMOJI = '⚡';

export function emptySpecialCategoryForm(position = 0): SpecialCategoryFormData {
	return {
		name: '',
		description: '',
		color: DEFAULT_COLOR,
		icon_emoji: DEFAULT_ICON_EMOJI,
		position,
		slot_1_class_ids: [],
		slot_2_class_ids: [],
		slot_3_class_ids: []
	};
}

export function specialCategoryRowToForm(row: SpecialCategoryRow): SpecialCategoryFormData {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? '',
		color: row.color ?? DEFAULT_COLOR,
		icon_emoji: row.icon_emoji ?? DEFAULT_ICON_EMOJI,
		position: row.position,
		slot_1_class_ids: row.slot_1_class_ids ?? [],
		slot_2_class_ids: row.slot_2_class_ids ?? [],
		slot_3_class_ids: row.slot_3_class_ids ?? []
	};
}

export async function fetchSpecialCategoryRecords(
	client: Rev2Client = supabase
): Promise<SpecialCategoryRow[]> {
	const { data, error } = await client
		.from('special_categories')
		.select('*')
		.order('position', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function saveSpecialCategoryRecord(
	form: SpecialCategoryFormData,
	client: Rev2Client = supabase
): Promise<SpecialCategoryRow> {
	const payload = {
		name: form.name,
		description: form.description || null,
		color: form.color || DEFAULT_COLOR,
		icon_emoji: form.icon_emoji || DEFAULT_ICON_EMOJI,
		position: form.position,
		slot_1_class_ids: form.slot_1_class_ids,
		slot_2_class_ids: form.slot_2_class_ids,
		slot_3_class_ids: form.slot_3_class_ids,
		updated_at: new Date().toISOString()
	};

	if (form.id) {
		const { data, error } = await client
			.from('special_categories')
			.update(payload)
			.eq('id', form.id)
			.select()
			.single();
		if (error) throw error;
		return data;
	} else {
		const { data, error } = await client
			.from('special_categories')
			.insert(payload)
			.select()
			.single();
		if (error) throw error;
		return data;
	}
}

export async function deleteSpecialCategoryRecord(
	id: string,
	client: Rev2Client = supabase
): Promise<void> {
	const { error } = await client.from('special_categories').delete().eq('id', id);
	if (error) throw error;
}
