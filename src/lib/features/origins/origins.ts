import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { OriginRow } from '$lib/types/gameData';

export interface OriginFormData {
	id?: string;
	name: string;
	position: number;
	icon: string;
	color: string;
	description: string;
	footer: string;
}

const DEFAULT_ICON = '';
const DEFAULT_COLOR = '#64748b';

export function emptyOriginForm(position = 1): OriginFormData {
	return {
		name: '',
		position,
		icon: DEFAULT_ICON,
		color: DEFAULT_COLOR,
		description: '',
		footer: ''
	};
}

export function originRowToForm(row: OriginRow): OriginFormData {
	return {
		id: row.id,
		name: row.name,
		position: row.position,
		icon: row.icon ?? DEFAULT_ICON,
		color: row.color ?? DEFAULT_COLOR,
		description: row.description ?? '',
		footer: row.footer ?? ''
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
		icon: sanitized.icon || null,
		color: sanitized.color || null,
		description: sanitized.description || null,
		footer: sanitized.footer || null,
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
	const icon = form.icon.trim();
	const color = form.color.trim() || DEFAULT_COLOR;
	const description = form.description.replace(/\r\n/g, '\n').trim();
	const footer = form.footer.replace(/\r\n/g, '\n').trim();

	return {
		...form,
		name,
		position,
		icon,
		color,
		description,
		footer
	};
}
