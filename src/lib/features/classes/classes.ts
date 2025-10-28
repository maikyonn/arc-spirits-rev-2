import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { ClassRow, Json } from '$lib/types/gameData';
import type {
	BackupTrimEffect,
	BenefitEffect,
	BreakpointColor,
	DiceEffect,
	Effect,
	EffectBreakpoint,
	FlatStatEffect,
	MultiplierEffect
} from '$lib/types/effects';

export interface PrismaticForm {
	name: string;
	count: string;
	description: string;
}

export interface ClassFormData {
	id?: string;
	name: string;
	position: number;
	icon: string;
	color: string;
	description: string;
	footer: string;
	tags: string[];
	prismatic: PrismaticForm | null;
	effect_schema: EffectBreakpoint[];
}

const DEFAULT_ICON = '🛡️';
const DEFAULT_COLOR = '#8b5cf6';
const EFFECT_COLORS: BreakpointColor[] = ['bronze', 'silver', 'gold', 'prismatic'];
const EMPTY_PRISMATIC: PrismaticForm = { name: '', count: '', description: '' };
const EFFECT_TYPES: Effect['type'][] = ['dice', 'flat_stat', 'multiplier', 'benefit', 'backup_trim'];

export const effectTypes = [...EFFECT_TYPES];

export function emptyClassForm(position = 1): ClassFormData {
	return {
		name: '',
		position,
		icon: DEFAULT_ICON,
		color: DEFAULT_COLOR,
		description: '',
		footer: '',
		tags: [],
		prismatic: null,
		effect_schema: []
	};
}

export function classRowToForm(row: ClassRow): ClassFormData {
	return {
		id: row.id,
		name: row.name,
		position: row.position,
		icon: row.icon ?? DEFAULT_ICON,
		color: row.color ?? DEFAULT_COLOR,
		description: row.description ?? '',
		footer: row.footer ?? '',
		tags: Array.isArray(row.tags) ? [...row.tags] : [],
		prismatic: parsePrismaticJson(row.prismatic),
		effect_schema: parseEffectSchema(row.effect_schema)
	};
}

export async function fetchClassRecords(client: Rev2Client = supabase): Promise<ClassRow[]> {
	const { data, error } = await client.from('classes').select('*').order('position', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function saveClassRecord(
	form: ClassFormData,
	client: Rev2Client = supabase
): Promise<ClassRow> {
	const sanitized = sanitizeClassForm(form);
	let classId = sanitized.id;

	const payload = {
		name: sanitized.name,
		position: sanitized.position,
		icon: sanitized.icon ?? null,
		color: sanitized.color ?? null,
		description: sanitized.description ?? null,
		footer: sanitized.footer ?? null,
		tags: sanitized.tags.length ? sanitized.tags : null,
		prismatic: sanitized.prismatic ?? null,
		effect_schema: sanitized.effect_schema.length ? sanitized.effect_schema : null,
		updated_at: new Date().toISOString()
	};

	if (classId) {
		const { error } = await client.from('classes').update(payload).eq('id', classId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('classes').insert(payload).select('*').single();
		if (error) throw error;
		classId = data?.id ?? null;
	}

	if (!classId) {
		throw new Error('Unable to determine class id after save.');
	}

	const { data, error } = await client.from('classes').select('*').eq('id', classId).single();
	if (error) throw error;
	return data;
}

export async function deleteClassRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('classes').delete().eq('id', id);
	if (error) throw error;
}

export function parseEffectSchema(value: Json | null): EffectBreakpoint[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((raw) => coerceBreakpoint(raw))
		.filter((bp): bp is EffectBreakpoint => bp !== null);
}

export function formatEffectSummary(
    effect: Effect,
    resolveDiceName?: (id: string | null | undefined, fallback?: string) => string
): string {
    switch (effect.type) {
        case 'dice': {
            const diceEffect = effect as DiceEffect;
            const label = resolveDiceName
                ? resolveDiceName(diceEffect.dice_id, diceEffect.dice_name)
                : diceEffect.dice_name ?? diceEffect.dice_id ?? 'Custom dice';
            return `${diceEffect.quantity}× ${label}`;
        }
        case 'flat_stat':
            return `+${effect.value} ${effect.stat}${effect.condition ? ` (${effect.condition})` : ''}`;
        case 'multiplier':
            return `${effect.value}× ${effect.stat}`;
        case 'backup_trim':
            return `Backup remove ${effect.value} die${effect.value === 1 ? '' : 's'}`;
        case 'benefit':
            return effect.description;
        default:
            return JSON.stringify(effect);
    }
}

export function createEffect(type: Effect['type'] = 'dice'): Effect {
    switch (type) {
        case 'dice':
            return { type: 'dice', dice_id: null, dice_name: '', quantity: 1 };
        case 'flat_stat':
            return { type: 'flat_stat', stat: 'attack', value: 1, condition: '' };
		case 'multiplier':
			return { type: 'multiplier', stat: 'attack', value: 2 };
		case 'benefit':
			return { type: 'benefit', description: '', value: undefined, benefit_type: undefined };
        case 'backup_trim':
            return { type: 'backup_trim', value: 1 };
        default:
            return { type: 'dice', dice_id: null, dice_name: '', quantity: 1 };
    }
}

function coerceBreakpoint(raw: unknown): EffectBreakpoint | null {
	if (!raw || typeof raw !== 'object') return null;
	const record = raw as Record<string, unknown>;
	const countRaw = record.count;
	const countNumber = typeof countRaw === 'number' ? countRaw : parseInt(String(countRaw ?? ''), 10);
	const count = Number.isFinite(countNumber) ? countNumber : String(countRaw ?? '');

	const colorRaw = record.color;
	const color = EFFECT_COLORS.includes(colorRaw as BreakpointColor)
		? (colorRaw as BreakpointColor)
		: undefined;

	const description =
		typeof record.description === 'string' ? record.description.replace(/\r\n/g, '\n') : undefined;

	const effectsRaw = Array.isArray(record.effects) ? record.effects : [];
	const effects: Effect[] = effectsRaw
		.map((effect) => coerceEffect(effect))
		.filter((value): value is Effect => value !== null);

	return {
		count,
		color,
		description,
		effects
	};
}

function coerceEffect(raw: unknown): Effect | null {
	if (!raw || typeof raw !== 'object') return null;
	const record = raw as Record<string, unknown>;
	const type = record.type;
	if (typeof type !== 'string' || !EFFECT_TYPES.includes(type as Effect['type'])) {
		return null;
	}
	switch (type as Effect['type']) {
        case 'dice':
            return {
                type: 'dice',
                dice_id:
                    typeof record.dice_id === 'string' && record.dice_id.trim().length
                        ? record.dice_id.trim()
                        : null,
                dice_name: typeof record.dice_name === 'string' ? record.dice_name : undefined,
                quantity: toPositiveInt(record.quantity, 1)
            };
		case 'flat_stat':
			return {
				type: 'flat_stat',
				stat: record.stat === 'defense' ? 'defense' : 'attack',
				value: toPositiveNumber(record.value, 1),
				condition: typeof record.condition === 'string' ? record.condition : undefined
			};
		case 'multiplier':
			return {
				type: 'multiplier',
				stat: record.stat === 'defense' ? 'defense' : 'attack',
				value: toPositiveNumber(record.value, 2)
			};
		case 'benefit':
			return {
				type: 'benefit',
				description: typeof record.description === 'string' ? record.description : '',
				value: typeof record.value === 'number' ? record.value : undefined,
				benefit_type: typeof record.benefit_type === 'string' ? record.benefit_type : undefined
			};
		case 'backup_trim':
			return {
				type: 'backup_trim',
				value: toPositiveInt(record.value, 1)
			};
		default:
			return null;
	}
}

function sanitizeClassForm(form: ClassFormData): ClassFormData {
	const name = form.name.trim();
	const position = Number.isFinite(form.position) ? Math.max(1, Math.round(form.position)) : 1;
	const icon = form.icon.trim() || DEFAULT_ICON;
	const color = form.color.trim() || DEFAULT_COLOR;
	const description = sanitizeMultiline(form.description);
	const footer = sanitizeMultiline(form.footer);
	const tags = sanitizeTags(form.tags);
	const prismatic = sanitizePrismatic(form.prismatic);
	const effect_schema = sanitizeEffectSchema(form.effect_schema);

	return Object.assign({}, form, {
		name,
		position,
		icon,
		color,
		description: description ?? '',
		footer: footer ?? '',
		tags,
		prismatic,
		effect_schema
	});
}

function sanitizeMultiline(value: string): string | null {
	const trimmed = value.replace(/\r\n/g, '\n').trim();
	return trimmed.length ? trimmed : null;
}

function sanitizeTags(tags: string[]): string[] {
	return tags.map((tag) => tag.trim()).filter(Boolean);
}

function sanitizePrismatic(value: PrismaticForm | null): Record<string, string> | null {
	if (!value) return null;
	const name = value.name.trim();
	const count = value.count.trim();
	const description = value.description.replace(/\r\n/g, '\n').trim();
	if (!name && !count && !description) {
		return null;
	}
	const payload: Record<string, string> = {};
	if (name) payload.name = name;
	if (count) payload.count = count;
	if (description) payload.description = description;
	return payload;
}

function sanitizeEffectSchema(schema: EffectBreakpoint[]): any[] {
	return schema
		.map((bp) => sanitizeBreakpoint(bp))
		.filter((bp): bp is Record<string, unknown> => bp !== null);
}

function sanitizeBreakpoint(bp: EffectBreakpoint): Record<string, unknown> | null {
	const countNumber =
		typeof bp.count === 'number'
			? bp.count
			: Number.parseInt(String(bp.count ?? '').trim(), 10);
	const count = Number.isFinite(countNumber) ? countNumber : String(bp.count ?? '').trim();

	const color = EFFECT_COLORS.includes(bp.color ?? ('' as BreakpointColor))
		? bp.color
		: undefined;
	const description = bp.description ? bp.description.replace(/\r\n/g, '\n').trim() : undefined;
	const effects = Array.isArray(bp.effects)
		? bp.effects
				.map((effect) => sanitizeEffect(effect))
				.filter((effect): effect is Record<string, unknown> => effect !== null)
		: [];

	if (effects.length === 0 && (!count || count === '')) {
		return null;
	}

	const payload: Record<string, unknown> = {
		count,
		effects
	};
	if (color) payload.color = color;
	if (description && description.length) payload.description = description;
	return payload;
}

function sanitizeEffect(effect: Effect): Record<string, unknown> | null {
    switch (effect.type) {
        case 'dice': {
            const typed = effect as DiceEffect;
            const quantity = toPositiveInt(typed.quantity, 1);
            const diceId = typed.dice_id && typed.dice_id.trim().length ? typed.dice_id.trim() : null;
            const diceName = typed.dice_name && typed.dice_name.trim().length ? typed.dice_name.trim() : undefined;
            if (!diceId && !diceName && quantity <= 0) {
                return null;
            }
            const payload: Record<string, unknown> = {
                type: 'dice',
                quantity
            };
            if (diceId) payload.dice_id = diceId;
            if (!diceId && diceName) payload.dice_name = diceName;
            return payload;
        }
		case 'flat_stat': {
			const typed = effect as FlatStatEffect;
			return {
				type: 'flat_stat',
				stat: typed.stat === 'defense' ? 'defense' : 'attack',
				value: toPositiveNumber(typed.value, 1),
				...(typed.condition?.trim()
					? {
							condition: typed.condition.trim()
						}
					: {})
			};
		}
		case 'multiplier': {
			const typed = effect as MultiplierEffect;
			return {
				type: 'multiplier',
				stat: typed.stat === 'defense' ? 'defense' : 'attack',
				value: toPositiveNumber(typed.value, 2)
			};
		}
		case 'benefit': {
			const typed = effect as BenefitEffect;
			const description = typed.description.trim();
			const payload: Record<string, unknown> = {
				type: 'benefit',
				description
			};
			if (typeof typed.value === 'number') payload.value = typed.value;
			if (typed.benefit_type?.trim()) payload.benefit_type = typed.benefit_type.trim();
			return payload;
		}
		case 'backup_trim': {
			const typed = effect as BackupTrimEffect;
			return {
				type: 'backup_trim',
				value: toPositiveInt(typed.value, 1)
			};
		}
		default:
			return null;
	}
}

export function parsePrismaticJson(value: Json | null): PrismaticForm | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	const name = typeof record.name === 'string' ? record.name : '';
	const count = typeof record.count === 'string' ? record.count : '';
	const description = typeof record.description === 'string' ? record.description : '';
	if (!name && !count && !description) return null;
	return {
		name,
		count,
		description
	};
}

function toPositiveInt(value: unknown, fallback: number): number {
	const num = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(num) || num <= 0) return fallback;
	return Math.floor(num);
}

function toPositiveNumber(value: unknown, fallback: number): number {
	const num = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
	if (!Number.isFinite(num) || num <= 0) return fallback;
	return Number(num.toFixed(2));
}

export { EMPTY_PRISMATIC };
