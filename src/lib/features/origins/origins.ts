import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { OriginRow, CallingCard, Json } from '$lib/types/gameData';

export interface OriginFormData {
	id?: string;
	name: string;
	position: number;
	icon_emoji: string;
	icon_png: string | null;
	icon_token_png: string | null;
	color: string;
	description: string;
	calling_card: CallingCard | null;
}

const DEFAULT_ICON_EMOJI = '';
const DEFAULT_COLOR = '#64748b';

export function emptyOriginForm(position = 1): OriginFormData {
	return {
		name: '',
		position,
		icon_emoji: DEFAULT_ICON_EMOJI,
		icon_png: null,
		icon_token_png: null,
		color: DEFAULT_COLOR,
		description: '',
		calling_card: null
	};
}

export function originRowToForm(row: OriginRow): OriginFormData {
	return {
		id: row.id,
		name: row.name,
		position: row.position,
		icon_emoji: row.icon_emoji ?? DEFAULT_ICON_EMOJI,
		icon_png: row.icon_png,
		icon_token_png: row.icon_token_png,
		color: row.color ?? DEFAULT_COLOR,
		description: row.description ?? '',
		calling_card: parseCallingCard(row.calling_card)
	};
}

function parseCallingCard(json: Json | null): CallingCard | null {
	if (!json || typeof json !== 'object' || Array.isArray(json)) {
		return null;
	}

	const obj = json as Record<string, unknown>;

	if (typeof obj.enabled !== 'boolean') {
		return null;
	}

	if (!Array.isArray(obj.breakpoints)) {
		return null;
	}

	const breakpoints = obj.breakpoints
		.filter((bp): bp is Record<string, unknown> => typeof bp === 'object' && bp !== null && !Array.isArray(bp))
		.map((bp) => {
			const count = typeof bp.count === 'number' ? bp.count : 0;
			const label = typeof bp.label === 'string' ? bp.label : undefined;
			const icon_ids = Array.isArray(bp.icon_ids)
				? bp.icon_ids.filter((id): id is string => typeof id === 'string')
				: [];

			return {
				count,
				label,
				icon_ids
			};
		});

	const hex_spirit_id = typeof obj.hex_spirit_id === 'string' ? obj.hex_spirit_id : null;

	return {
		enabled: obj.enabled,
		hex_spirit_id,
		breakpoints
	};
}

export async function fetchOriginRecords(client: Rev2Client = supabase): Promise<OriginRow[]> {
	const { data, error } = await client.from('origins').select('*').order('position', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function saveOriginRecord(
	form: OriginFormData,
	client: Rev2Client = supabase
): Promise<OriginRow> {
	const sanitized = sanitizeOriginForm(form);
	let originId = sanitized.id;

	const payload = {
		name: sanitized.name,
		position: sanitized.position,
		icon_emoji: sanitized.icon_emoji || null,
		icon_png: sanitized.icon_png || null,
		icon_token_png: sanitized.icon_token_png || null,
		color: sanitized.color || null,
		description: sanitized.description || null,
		calling_card: sanitized.calling_card as Json | null,
		updated_at: new Date().toISOString()
	};

	if (originId) {
		const { error } = await client.from('origins').update(payload).eq('id', originId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('origins').insert(payload).select('*').single();
		if (error) throw error;
		originId = data?.id ?? null;
	}

	if (!originId) {
		throw new Error('Unable to determine origin id after save.');
	}

	const { data, error } = await client.from('origins').select('*').eq('id', originId).single();
	if (error) throw error;
	return data;
}

export async function deleteOriginRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('origins').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeOriginForm(form: OriginFormData): OriginFormData {
	const name = form.name.trim();
	const position = Number.isFinite(form.position) ? Math.max(1, Math.round(form.position)) : 1;
	const icon_emoji = form.icon_emoji.trim();
	const icon_png = form.icon_png?.trim() || null;
	const icon_token_png = form.icon_token_png?.trim() || null;
	const color = form.color.trim() || DEFAULT_COLOR;
	const description = form.description.replace(/\r\n/g, '\n').trim();

	return {
		...form,
		name,
		position,
		icon_emoji,
		icon_png,
		icon_token_png,
		color,
		description
	};
}
