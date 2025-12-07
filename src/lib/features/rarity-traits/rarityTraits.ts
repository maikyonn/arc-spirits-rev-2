import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { RarityTraitRow } from '$lib/types/gameData';

export interface RarityTraitFormData {
	id?: string;
	cost: number;
	origin_traits: number;
	class_traits: number;
}

export async function fetchRarityTraitRecords(
	client: Rev2Client = supabase
): Promise<RarityTraitRow[]> {
	const { data, error } = await client
		.from('rarity_traits')
		.select('*')
		.order('cost', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export function rarityTraitRowToForm(row: RarityTraitRow): RarityTraitFormData {
	return {
		id: row.id,
		cost: row.cost,
		origin_traits: row.origin_traits,
		class_traits: row.class_traits
	};
}

export async function saveRarityTraitRecord(
	form: RarityTraitFormData,
	client: Rev2Client = supabase
): Promise<RarityTraitRow> {
	const payload = {
		cost: Math.max(1, Math.round(form.cost)),
		origin_traits: Math.max(0, Math.round(form.origin_traits)),
		class_traits: Math.max(0, Math.round(form.class_traits)),
		updated_at: new Date().toISOString()
	};

	if (form.id) {
		const { error } = await client.from('rarity_traits').update(payload).eq('id', form.id);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('rarity_traits').insert(payload).select('*').single();
		if (error) throw error;
		const traitId = data?.id;
		if (!traitId) {
			throw new Error('Unable to determine rarity trait id after save.');
		}
		const { data: updatedData, error: fetchError } = await client
			.from('rarity_traits')
			.select('*')
			.eq('id', traitId)
			.single();
		if (fetchError) throw fetchError;
		return updatedData;
	}

	const { data, error } = await client.from('rarity_traits').select('*').eq('id', form.id).single();
	if (error) throw error;
	return data;
}

