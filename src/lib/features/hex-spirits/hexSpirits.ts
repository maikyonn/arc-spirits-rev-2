import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { HexSpiritRow } from '$lib/types/gameData';

export interface HexSpiritFormData {
	id?: string;
	name: string;
	cost: number;
	origin_id: string | null;
	class_id: string | null;
	image_path: string | null;
}

const DEFAULT_COST = 1;

export function emptyHexSpiritForm(): HexSpiritFormData {
	return {
		name: '',
		cost: DEFAULT_COST,
		origin_id: null,
		class_id: null,
		image_path: null
	};
}

export function hexSpiritRowToForm(row: HexSpiritRow): HexSpiritFormData {
	return {
		id: row.id,
		name: row.name,
		cost: row.cost,
		origin_id: row.origin_id,
		class_id: row.class_id,
		image_path: row.image_path
	};
}

export async function fetchHexSpiritRecords(client: Rev2Client = supabase): Promise<HexSpiritRow[]> {
	const { data, error } = await client
		.from('hex_spirits')
		.select('*')
		.order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function saveHexSpiritRecord(
	form: HexSpiritFormData,
	client: Rev2Client = supabase
): Promise<HexSpiritRow> {
	const sanitized = sanitizeHexSpiritForm(form);
	let spiritId = sanitized.id;

	const payload = {
		name: sanitized.name,
		cost: sanitized.cost,
		origin_id: sanitized.origin_id,
		class_id: sanitized.class_id,
		image_path: sanitized.image_path,
		updated_at: new Date().toISOString()
	};

	if (spiritId) {
		const { error } = await client.from('hex_spirits').update(payload).eq('id', spiritId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('hex_spirits').insert(payload).select('*').single();
		if (error) throw error;
		spiritId = data?.id ?? null;
	}

	if (!spiritId) {
		throw new Error('Unable to determine hex spirit id after save.');
	}

	const { data, error } = await client.from('hex_spirits').select('*').eq('id', spiritId).single();
	if (error) throw error;
	return data;
}

export async function deleteHexSpiritRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('hex_spirits').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeHexSpiritForm(form: HexSpiritFormData): HexSpiritFormData {
	const name = form.name.trim();
	const cost = Number.isFinite(form.cost) ? Math.max(0, Math.round(form.cost)) : DEFAULT_COST;
	const origin_id = form.origin_id || null;
	const class_id = form.class_id || null;
	const image_path = form.image_path?.trim() || null;

	return {
		...form,
		name,
		cost,
		origin_id,
		class_id,
		image_path
	};
}
