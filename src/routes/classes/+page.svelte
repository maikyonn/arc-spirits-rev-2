<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClassRow } from '$lib/types/gameData';
	import type {
		BackupTrimEffect,
		BenefitEffect,
		DiceEffect,
		Effect,
		EffectBreakpoint,
		FlatStatEffect,
		MultiplierEffect
	} from '$lib/types/effects';
	import html2canvas from 'html2canvas';
	import jsPDF from 'jspdf';
import { supabase } from '$lib/api/supabaseClient';
import { EditorModal } from '$lib';
import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import {
		classRowToForm,
		createEffect,
		deleteClassRecord,
		effectTypes,
		emptyClassForm,
		fetchClassRecords,
		formatEffectSummary,
		parseEffectSchema,
	parsePrismaticJson,
	saveClassRecord,
	EMPTY_PRISMATIC,
	type ClassFormData,
	type PrismaticForm
} from '$lib/features/classes/classes';
import {
	fetchSpecialCategoryRecords,
	saveSpecialCategoryRecord,
	deleteSpecialCategoryRecord,
	emptySpecialCategoryForm,
	specialCategoryRowToForm,
	type SpecialCategoryFormData
} from '$lib/features/special-categories/specialCategories';
import type { SpecialCategoryRow } from '$lib/types/gameData';
import { fetchDiceRecords } from '$lib/features/dice/dice';
import { emojiToPngBlob } from '$lib/utils/emojiToPng';

let classes: ClassRow[] = [];
let specialCategories: SpecialCategoryRow[] = [];
let loading = true;
let error: string | null = null;
let backfillingIcons = false;

	let search = '';

	let showClassForm = false;
	let editingClass: ClassRow | null = null;
	let formData: ClassFormData = emptyClassForm();
	let tagsInput = '';
	let prismaticEnabled = false;
	let prismaticCache: PrismaticForm = { ...EMPTY_PRISMATIC };
	const getPrismatic = parsePrismaticJson;

	// Special category form state
	let showSpecialCategoryForm = false;
	let editingSpecialCategory: SpecialCategoryRow | null = null;
	let specialCategoryFormData: SpecialCategoryFormData = emptySpecialCategoryForm();
let diceOptions: { id: string; name: string }[] = [];
let diceNameById = new Map<string, string>();
	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom Dice';
		return fallback ?? (id ?? 'Custom Dice');
	};
const summarizeEffectBase = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel);
const sorcererName = 'sorcerer';

	let uploadingIconId: string | null = null;
	let removingIconId: string | null = null;
	const gameAssetsStorage = supabase.storage.from('game_assets');

	function getIconUrl(iconPng: string | null | undefined): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('class_icons/') ? iconPng : `class_icons/${iconPng}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

	function isIconImage(iconPng: string | null | undefined): boolean {
		return !!iconPng;
	}

	function sanitizeFileName(name: string): string {
		// Convert to lowercase, replace spaces and special chars with underscores
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50); // Limit length
	}

	async function handleIconUpload(classEntry: ClassRow, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be smaller than 5MB.');
			return;
		}

		uploadingIconId = classEntry.id;
		try {
			// Remove old icon if it exists
			if (isIconImage(classEntry.icon_png)) {
				const oldPath = classEntry.icon_png!.startsWith('class_icons/') ? classEntry.icon_png! : `class_icons/${classEntry.icon_png!}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const sanitizedName = sanitizeFileName(classEntry.name);
			const fileName = `class_${sanitizedName}_icon.${extension}`;
			const path = `class_icons/${classEntry.id}/${fileName}`;

			const { error: uploadError } = await gameAssetsStorage.upload(path, file, {
				cacheControl: '3600',
				upsert: false,
				contentType: file.type
			});
			if (uploadError) {
				throw uploadError;
			}

			const { error: updateError } = await supabase
				.from('classes')
				.update({ icon_png: path, updated_at: new Date().toISOString() })
				.eq('id', classEntry.id);
			if (updateError) {
				throw updateError;
			}

			await loadClasses();
		} catch (err) {
			console.error(err);
			alert('Failed to upload icon. Please try again.');
		} finally {
			uploadingIconId = null;
		}
	}

	async function removeIcon(classEntry: ClassRow) {
		if (!isIconImage(classEntry.icon_png)) return;
		removingIconId = classEntry.id;
		try {
			const path = classEntry.icon_png!.startsWith('class_icons/') ? classEntry.icon_png! : `class_icons/${classEntry.icon_png!}`;
			await gameAssetsStorage.remove([path]);
			const { error: updateError } = await supabase
				.from('classes')
				.update({ icon_png: null, updated_at: new Date().toISOString() })
				.eq('id', classEntry.id);
			if (updateError) {
				throw updateError;
			}
			await loadClasses();
		} catch (err) {
			console.error(err);
			alert('Failed to remove icon.');
		} finally {
			removingIconId = null;
		}
	}

	function handleIconFileChange(classEntry: ClassRow, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) {
			handleIconUpload(classEntry, file);
		}
	}

function toNumericCount(count: EffectBreakpoint['count']): number | null {
	if (typeof count === 'number' && Number.isFinite(count)) return count;
	if (typeof count === 'string') {
		const parsed = Number.parseInt(count, 10);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function sortBreakpointsByCount(breakpoints: EffectBreakpoint[]): EffectBreakpoint[] {
	return [...breakpoints]
		.map((bp, index) => ({ bp, index }))
		.sort((a, b) => {
			const aNumeric = toNumericCount(a.bp.count);
			const bNumeric = toNumericCount(b.bp.count);

			if (aNumeric !== null && bNumeric !== null) return aNumeric - bNumeric;
			if (aNumeric !== null) return -1;
			if (bNumeric !== null) return 1;
			return a.index - b.index;
		})
		.map(({ bp }) => bp);
}

function summarizeEffectWithScaling(className: string, effect: Effect): string {
	if (effect.type !== 'dice') {
		return summarizeEffectBase(effect);
	}

		const diceEffect = effect as DiceEffect;
		const diceLabelRaw = resolveDiceLabel(diceEffect.dice_id, diceEffect.dice_name);
		const diceLabel = (diceLabelRaw ?? diceEffect.dice_name ?? diceEffect.dice_id ?? 'Custom Dice')
			.replace(/\s+/g, ' ')
			.trim();
		const quantityValue = Number(diceEffect.quantity ?? 0);
		const quantityDisplay = Number.isFinite(quantityValue) ? Math.max(0, Math.floor(quantityValue)) : 0;
		const fallbackSummary = `${quantityDisplay}× ${diceLabel}`;

		const isSorcerer = className?.trim().toLowerCase() === sorcererName;
		if (isSorcerer) {
			return `${quantityDisplay}× ${diceLabel} × Runes`;
		}

		const baseSummary = summarizeEffectBase(effect);
		return baseSummary && baseSummary.trim().length ? baseSummary : fallbackSummary;
	}

function resolveDiceIdsInSchema(schema: EffectBreakpoint[]): EffectBreakpoint[] {
	return schema.map((bp) => {
		const updatedEffects = bp.effects.map((effect) => {
			if (effect.type !== 'dice') return effect;
			const typed = effect as DiceEffect;
			if (typed.dice_id && diceNameById.has(typed.dice_id)) {
				return { ...typed, dice_name: diceNameById.get(typed.dice_id) ?? typed.dice_name };
			}
			if (typed.dice_name) {
				const normalized = typed.dice_name.toLowerCase();
				const match = diceOptions.find(
					(option) => option.name.toLowerCase() === normalized
				);
				if (match) {
					return { ...typed, dice_id: match.id, dice_name: match.name };
				}
			}
			return typed;
		});
		return { ...bp, effects: updatedEffects };
	});
}

	onMount(async () => {
		await loadDiceOptions();
		await loadClasses();
	});

	async function loadClasses() {
		try {
			loading = true;
			error = null;
			const [classData, categoryData] = await Promise.all([
				fetchClassRecords(),
				fetchSpecialCategoryRecords()
			]);
			classes = classData;
			specialCategories = categoryData;
			void backfillMissingIcons();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	async function backfillMissingIcons(force = false) {
		if (backfillingIcons) return;
		const targets = classes.filter((c) => (force || !c.icon_png) && c.icon_emoji);
		if (!targets.length) return;
		backfillingIcons = true;
		for (const cls of targets) {
			try {
				const blob = await emojiToPngBlob(cls.icon_emoji ?? '', 512);
				if (!blob) continue;
				const path = `class_icons/${cls.id}/icon.png`;
				const { error: uploadError } = await gameAssetsStorage.upload(path, blob, {
					cacheControl: '3600',
					upsert: true,
					contentType: 'image/png'
				});
				if (uploadError) throw uploadError;
				const { error: updateError } = await supabase
					.from('classes')
					.update({ icon_png: path, updated_at: new Date().toISOString() })
					.eq('id', cls.id);
				if (updateError) throw updateError;
			} catch (err) {
				console.warn('Backfill class icon failed for', cls.name, err);
			}
		}
		backfillingIcons = false;
		void loadClasses();
	}

async function loadDiceOptions() {
	try {
		const records = await fetchDiceRecords();
		diceOptions = records.map(({ id, name }) => ({
			id,
			name: name?.trim() || `Dice ${id.slice(0, 6)}`
		}));
		diceNameById = new Map(diceOptions.map((option) => [option.id, option.name]));
			if (showClassForm) {
				formData = {
					...formData,
					effect_schema: resolveDiceIdsInSchema(formData.effect_schema)
				};
			}
		} catch (err) {
			console.error('Failed to load dice options', err);
		}
	}

	function openClassForm(entry?: ClassRow) {
		if (entry) {
			editingClass = entry;
			formData = classRowToForm(entry);
			formData = {
				...formData,
				effect_schema: resolveDiceIdsInSchema(formData.effect_schema)
			};
			prismaticEnabled = Boolean(formData.prismatic);
			prismaticCache = formData.prismatic ? { ...formData.prismatic } : { ...EMPTY_PRISMATIC };
			tagsInput = formData.tags.join(', ');
		} else {
			editingClass = null;
			const nextPosition = (classes.at(-1)?.position ?? classes.length) + 1;
			formData = emptyClassForm(nextPosition);
			prismaticEnabled = false;
			prismaticCache = { ...EMPTY_PRISMATIC };
			tagsInput = '';
		}
		showClassForm = true;
	}

	function closeClassForm() {
		showClassForm = false;
	}

	function handleTagsInput(value: string) {
		tagsInput = value;
		const parsed = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
		formData = { ...formData, tags: parsed };
	}

	function togglePrismatic(enabled: boolean) {
		prismaticEnabled = enabled;
		if (enabled) {
			const next = formData.prismatic ?? prismaticCache ?? { ...EMPTY_PRISMATIC };
			prismaticCache = { ...next };
			formData = { ...formData, prismatic: { ...next } };
		} else {
			prismaticCache = formData.prismatic ? { ...formData.prismatic } : prismaticCache;
			formData = { ...formData, prismatic: null };
		}
	}

	function addBreakpoint() {
		const lastCount = formData.effect_schema.at(-1)?.count ?? 2;
		const nextCount =
			typeof lastCount === 'number'
				? lastCount + 1
				: Number.parseInt(String(lastCount), 10) + 1 || formData.effect_schema.length + 2;
		const nextBreakpoint: EffectBreakpoint = {
			count: nextCount,
			color: undefined,
			description: '',
			effects: [createEffect('dice')]
		};
		formData = {
			...formData,
			effect_schema: [...formData.effect_schema, nextBreakpoint]
		};
	}

	function removeBreakpoint(index: number) {
		const updated = formData.effect_schema.filter((_, idx) => idx !== index);
		formData = { ...formData, effect_schema: updated };
	}

	function updateBreakpointCount(index: number, value: string) {
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, count: value } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function updateBreakpointColor(index: number, color: EffectBreakpoint['color'] | undefined) {
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, color: color || undefined } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function updateBreakpointDescription(index: number, value: string) {
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, description: value } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function addEffectToBreakpoint(index: number, type: Effect['type'] = 'dice') {
		const newEffect = createEffect(type);
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, effects: [...bp.effects, newEffect] } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function removeEffectFromBreakpoint(index: number, effectIndex: number) {
		const updated = formData.effect_schema.map((bp, idx) => {
			if (idx !== index) return bp;
			return {
				...bp,
				effects: bp.effects.filter((_, effIdx) => effIdx !== effectIndex)
			};
		});
		formData = { ...formData, effect_schema: updated };
	}

	function updateEffectAt(
		breakpointIndex: number,
		effectIndex: number,
		transformer: (effect: Effect) => Effect
	) {
		const updated = formData.effect_schema.map((bp, idx) => {
			if (idx !== breakpointIndex) return bp;
			return {
				...bp,
				effects: bp.effects.map((effect, effIdx) =>
					effIdx === effectIndex ? transformer(effect) : effect
				)
			};
		});
		formData = { ...formData, effect_schema: updated };
	}

	function setEffectType(breakpointIndex: number, effectIndex: number, type: Effect['type']) {
		updateEffectAt(breakpointIndex, effectIndex, () => createEffect(type));
	}

	function updateDiceEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: DiceEffect) => DiceEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'dice' ? updater(effect) : effect
		);
	}

	function updateFlatStatEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: FlatStatEffect) => FlatStatEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'flat_stat' ? updater(effect) : effect
		);
	}

	function updateMultiplierEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: MultiplierEffect) => MultiplierEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'multiplier' ? updater(effect) : effect
		);
	}

	function updateBenefitEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: BenefitEffect) => BenefitEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'benefit'
				? updater(effect)
				: effect
		);
	}

	function updateBackupTrimEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: BackupTrimEffect) => BackupTrimEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'backup_trim' ? updater(effect) : effect
		);
	}

	async function saveClass() {
		if (!formData.name.trim()) {
			alert('Class name is required.');
			return;
		}

		const payload: ClassFormData = {
			...formData,
			tags: [...formData.tags],
			prismatic: prismaticEnabled
				? formData.prismatic ?? { ...prismaticCache }
				: null
		};

		try {
			const saved = await saveClassRecord(payload);
			await loadClasses();
			editingClass = saved;
			closeClassForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save class: ${message}`);
		}
	}

	async function deleteClass(entry: ClassRow) {
		if (!confirm(`Delete class "${entry.name}"? Units referencing it will be orphaned.`)) return;
		try {
			await deleteClassRecord(entry.id);
			await loadClasses();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete class: ${message}`);
		}
	}

	// Special category functions
	function getClassById(id: string): ClassRow | undefined {
		return classes.find((c) => c.id === id);
	}

	function openSpecialCategoryForm(category?: SpecialCategoryRow) {
		if (category) {
			editingSpecialCategory = category;
			specialCategoryFormData = specialCategoryRowToForm(category);
		} else {
			editingSpecialCategory = null;
			const nextPosition = (specialCategories.at(-1)?.position ?? specialCategories.length) + 1;
			specialCategoryFormData = emptySpecialCategoryForm(nextPosition);
		}
		showSpecialCategoryForm = true;
	}

	function closeSpecialCategoryForm() {
		showSpecialCategoryForm = false;
	}

	async function saveSpecialCategory() {
		if (!specialCategoryFormData.name.trim()) {
			alert('Special category name is required.');
			return;
		}
		try {
			await saveSpecialCategoryRecord(specialCategoryFormData);
			await loadClasses();
			closeSpecialCategoryForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save special category: ${message}`);
		}
	}

	async function deleteSpecialCategory(category: SpecialCategoryRow) {
		if (!confirm(`Delete special category "${category.name}"?`)) return;
		try {
			await deleteSpecialCategoryRecord(category.id);
			await loadClasses();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete special category: ${message}`);
		}
	}

	function submitSpecialCategoryForm(event: Event) {
		event.preventDefault();
		void saveSpecialCategory();
	}

	function toggleClassInSlot(slotKey: 'slot_1_class_ids' | 'slot_2_class_ids' | 'slot_3_class_ids', classId: string) {
		const currentIds = specialCategoryFormData[slotKey];
		if (currentIds.includes(classId)) {
			specialCategoryFormData[slotKey] = currentIds.filter((id) => id !== classId);
		} else {
			specialCategoryFormData[slotKey] = [...currentIds, classId];
		}
	}

	function renderMultiline(value?: string | null): string {
		return (value ?? '').replace(/\r\n/g, '\n').trim();
	}

	function submitClassForm(event: Event) {
		event.preventDefault();
		void saveClass();
	}

	async function exportToPDF() {
	if (!classes.length && !specialCategories.length) {
		alert('No classes to export.');
		return;
	}

	// Get class IDs that are in special categories
	const specialClassIds = new Set(
		specialCategories.flatMap((cat) => [
			...cat.slot_1_class_ids,
			...cat.slot_2_class_ids,
			...cat.slot_3_class_ids
		])
	);

	// Filter out classes that are in special categories
	const regularClasses = classes.filter((c) => !specialClassIds.has(c.id));
	const sorted = [...regularClasses].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

	// Helper to render a regular class card
	const renderClassCard = (entry: ClassRow) => {
		const effectSchema = sortBreakpointsByCount(
			resolveDiceIdsInSchema(parseEffectSchema(entry.effect_schema))
		);
		const description = renderMultiline(entry.description);
		const footer = renderMultiline(entry.footer);
		const prismatic = getPrismatic(entry.prismatic);
		const tags =
			Array.isArray(entry.tags) && entry.tags.length
				? entry.tags
						.map(
							(tag) =>
								`<span style="display:inline-block; padding:2px 6px; border-radius:999px; background:#e2e8f0; color:#0f172a; font-size:8px; margin-right:4px; margin-bottom:4px;">${tag}</span>`
						)
						.join('')
				: '';

		const iconUrl = getIconUrl(entry.icon_png);
		const iconHtml = iconUrl
			? `<div style="width:24px; height:24px; background-color:#ffffff; border-radius:4px; display:flex; align-items:center; justify-content:center;"><img src="${iconUrl}" style="width:100%; height:100%; object-fit:contain;" crossorigin="anonymous" /></div>`
			: `<span style="font-size:18px; line-height:1;">${entry.icon_emoji ?? '🛡️'}</span>`;

		return `
			<div style="padding: 10px; border: 3px solid ${entry.color ?? '#8b5cf6'}; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column;">
				<div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
					${iconHtml}
					<div style="flex:1;">
						<h3 style="margin:0; font-size:14px; font-weight:700; color:#1e293b; line-height:1.2;">${entry.name}</h3>
					</div>
					${tags ? `<div style="display:flex; flex-wrap:wrap; justify-content:flex-end; gap:2px;">${tags}</div>` : ''}
				</div>
				${description ? `<p style="margin:4px 0; font-size:9px; color:#475569; line-height:1.3; white-space:pre-line;">${description}</p>` : ''}
				${
					effectSchema.length
						? effectSchema
								.map(
									(bp) => `
							<div style="margin:3px 0; font-size:8px; line-height:1.3;">
								<strong style="color:#0f172a;">${bp.count}:</strong>
								<span style="color:#64748b;">
									${bp.effects.map((effect) => summarizeEffectWithScaling(entry.name, effect)).join(', ')}
								</span>
							</div>
						`
								)
								.join('')
						: '<p style="margin:4px 0; font-size:8px; font-style:italic; color:#94a3b8;">No effects configured.</p>'
				}
				${
					prismatic
						? `
					<div style="margin:4px 0; padding:6px; background:linear-gradient(135deg, #ede9fe, #ddd6fe, #c7d2fe); border-radius:4px; font-size:8px; line-height:1.3;">
						<strong style="color:#7c3aed; font-size:9px;">${prismatic.count || ''} ${prismatic.name}</strong>
						${prismatic.description ? `<div style="margin-top:3px; color:#6b21a8;">${prismatic.description}</div>` : ''}
					</div>
				`
						: ''
				}
				${footer ? `<div style="margin-top:6px; padding-top:4px; border-top:1px solid #e2e8f0; font-size:7px; color:#94a3b8; white-space:pre-line;">${footer}</div>` : ''}
			</div>
		`;
	};

	// Helper to render a special category card
	const renderSpecialCategoryCard = (category: SpecialCategoryRow) => {
		const renderSlot = (slotIds: string[], slotIndex: number) => {
			if (slotIds.length === 0) {
				return `<div style="flex:1; padding:6px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:4px; display:flex; align-items:center; justify-content:center;">
					<span style="font-size:7px; color:#94a3b8; font-style:italic;">Slot ${slotIndex + 1}</span>
				</div>`;
			}

			const classesHtml = slotIds
				.map((classId) => {
					const cls = getClassById(classId);
					if (!cls) return '';

					const effectSchema = sortBreakpointsByCount(
						resolveDiceIdsInSchema(parseEffectSchema(cls.effect_schema))
					);

					const breakpointsHtml = effectSchema
						.map(
							(bp) =>
								`<div style="font-size:6px; color:#64748b; line-height:1.2;">(${bp.count}) ${bp.effects.map((e) => summarizeEffectWithScaling(cls.name, e)).join(', ')}</div>`
						)
						.join('');

					return `
						<div style="padding-left:6px; border-left:2px solid ${cls.color ?? '#8b5cf6'};">
							<div style="display:flex; align-items:center; gap:4px; margin-bottom:2px;">
								<span style="font-size:10px;">${cls.icon_emoji ?? '🛡️'}</span>
								<span style="font-size:8px; font-weight:600; color:#1e293b;">${cls.name}</span>
							</div>
							${breakpointsHtml}
						</div>
					`;
				})
				.join('');

			return `<div style="flex:1; padding:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; display:flex; flex-direction:column; gap:4px;">
				${classesHtml}
			</div>`;
		};

		const description = category.description ? `<p style="margin:4px 0 6px 0; font-size:8px; color:#475569; line-height:1.3;">${category.description}</p>` : '';

		return `
			<div style="padding: 10px; border: 3px solid ${category.color ?? '#8b5cf6'}; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column;">
				<div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
					<span style="font-size:18px; line-height:1;">${category.icon_emoji ?? '⚡'}</span>
					<h3 style="margin:0; font-size:14px; font-weight:700; color:#1e293b; line-height:1.2;">${category.name}</h3>
				</div>
				${description}
				<div style="display:flex; flex-direction:column; gap:4px; flex:1;">
					${renderSlot(category.slot_1_class_ids, 0)}
					${renderSlot(category.slot_2_class_ids, 1)}
					${renderSlot(category.slot_3_class_ids, 2)}
				</div>
			</div>
		`;
	};

	// Build combined list: special categories first, then regular classes
	type CardItem = { type: 'class'; data: ClassRow } | { type: 'special'; data: SpecialCategoryRow };
	const allCards: CardItem[] = [
		...specialCategories.map((cat) => ({ type: 'special' as const, data: cat })),
		...sorted.map((cls) => ({ type: 'class' as const, data: cls }))
	];

	const chunkSize = 9; // 3 columns × 3 rows per page
	const chunks: CardItem[][] = [];
	for (let i = 0; i < allCards.length; i += chunkSize) {
		chunks.push(allCards.slice(i, i + chunkSize));
	}

	const pdf = new jsPDF({
		orientation: 'portrait',
		unit: 'in',
		format: 'letter'
	});

	const tempContainer = document.createElement('div');
	tempContainer.style.position = 'absolute';
	tempContainer.style.left = '-9999px';
	tempContainer.style.width = '8.5in';
	tempContainer.style.height = '11in';
	tempContainer.style.backgroundColor = '#ffffff';
	tempContainer.style.padding = '0.5in';
	tempContainer.style.colorScheme = 'light';
	tempContainer.style.boxSizing = 'border-box';
	tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
	document.body.appendChild(tempContainer);

	try {
		for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
			const group = chunks[pageIndex];

			tempContainer.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
          <h1 style="margin: 0 0 16px 0; font-size: 22px; color: #1e293b; text-align: center;">
            Arc Spirits Classes
          </h1>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; grid-auto-rows: min-content;">
            ${group
							.map((item) => {
								if (item.type === 'special') {
									return renderSpecialCategoryCard(item.data);
								} else {
									return renderClassCard(item.data);
								}
							})
							.join('')}
          </div>
        </div>
      `;

			// Wait for images to load
			const images = tempContainer.querySelectorAll('img');
			await Promise.all(
				Array.from(images).map(
					(img) =>
						new Promise<void>((resolve) => {
							if (img.complete) {
								resolve();
							} else {
								img.onload = () => resolve();
								img.onerror = () => resolve(); // Continue even if image fails
							}
						})
				)
			);

			const canvas = await html2canvas(tempContainer, {
				scale: 2,
				backgroundColor: '#ffffff',
				useCORS: true,
				allowTaint: false
			});
			const imgData = canvas.toDataURL('image/png');
			if (pageIndex > 0) {
				pdf.addPage();
			}
			pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
		}

		pdf.save('arc-spirits-classes.pdf');
	} catch (err) {
		console.error(err);
		alert('Failed to export classes. Please try again.');
	} finally {
		document.body.removeChild(tempContainer);
	}
}

	// Compute set of class IDs that are in any special category
	$: specialCategoryClassIds = new Set(
		specialCategories.flatMap((cat) => [
			...cat.slot_1_class_ids,
			...cat.slot_2_class_ids,
			...cat.slot_3_class_ids
		])
	);

	$: filteredClasses = classes.filter((entry) => {
		// Exclude classes that are in a special category
		if (specialCategoryClassIds.has(entry.id)) return false;
		if (!search.trim()) return true;
		const term = search.trim().toLowerCase();
		return (
			entry.name.toLowerCase().includes(term) ||
			(entry.description ?? '').toLowerCase().includes(term) ||
			(entry.footer ?? '').toLowerCase().includes(term)
		);
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Classes</h1>
			<p>Combat archetypes with structured effect breakpoints.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => backfillMissingIcons(true)} aria-busy={backfillingIcons}>
				{backfillingIcons ? 'Resetting PNGs…' : 'Reset PNGs'}
			</button>
			<button class="btn" onclick={exportToPDF}>Export PDF</button>
			<button class="btn" onclick={() => openSpecialCategoryForm()}>Create Special</button>
			<button class="btn" onclick={() => openClassForm()}>Create Class</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search classes" bind:value={search} />
		</label>
	</section>

	{#if loading}
		<div class="card loading">Loading classes…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		{#if filteredClasses.length === 0 && specialCategories.length === 0}
			<div class="card empty">No classes match the current search.</div>
		{:else}
			<section class="class-grid">
				<!-- Special Category Cards - 3 classes in 1 card space -->
				{#each specialCategories as category (category.id)}
					<article class="special-category-card" style="border-left-color: {category.color ?? '#8b5cf6'}">
						<header class="special-category-card__header">
							<div class="special-category-card__identity">
								<span class="special-category-card__icon">{category.icon_emoji ?? '⚡'}</span>
								<div>
									<h2>{category.name}</h2>
								</div>
							</div>
							<CardActionMenu
								onEdit={() => openSpecialCategoryForm(category)}
								onDelete={() => deleteSpecialCategory(category)}
								onGenerate={null}
							/>
						</header>

						{#if category.description}
							<p class="special-category-card__description">{category.description}</p>
						{/if}

						<div class="special-slots">
							{#each [category.slot_1_class_ids, category.slot_2_class_ids, category.slot_3_class_ids] as slotIds, slotIndex}
								<div class="special-slot" class:special-slot--empty={slotIds.length === 0}>
									{#each slotIds as classId}
										{@const cls = getClassById(classId)}
										{#if cls}
											{@const slotEffectSchema = sortBreakpointsByCount(
												resolveDiceIdsInSchema(parseEffectSchema(cls.effect_schema))
											)}
											<div class="special-slot__class" style="border-left-color: {cls.color ?? '#8b5cf6'}">
												<div class="special-slot__header">
													<span class="special-slot__icon">{cls.icon_emoji ?? '🛡️'}</span>
													<span class="special-slot__name">{cls.name}</span>
													<button
														type="button"
														class="special-slot__edit-btn"
														onclick={() => openClassForm(cls)}
														title="Edit {cls.name}"
													>
														✏️
													</button>
												</div>
												{#if slotEffectSchema.length}
													<div class="special-slot__breakpoints">
														{#each slotEffectSchema as bp, bpIndex (`${classId}-bp-${bpIndex}`)}
															<span
																class="special-slot__bp"
																class:bronze={bp.color === 'bronze'}
																class:silver={bp.color === 'silver'}
																class:gold={bp.color === 'gold'}
																class:prismatic={bp.color === 'prismatic'}
															>
																({bp.count}) {bp.effects.map((e) => summarizeEffectWithScaling(cls.name, e)).join(', ')}
															</span>
														{/each}
													</div>
												{/if}
											</div>
										{/if}
									{/each}
									{#if slotIds.length === 0}
										<span class="special-slot__placeholder">Slot {slotIndex + 1}</span>
									{/if}
								</div>
							{/each}
						</div>
					</article>
				{/each}

				<!-- Regular Class Cards -->
				{#each filteredClasses as entry (entry.id)}
					{@const description = renderMultiline(entry.description)}
					{@const footer = renderMultiline(entry.footer)}
                    {@const prismatic = getPrismatic(entry.prismatic)}
                    {@const effectSchema = sortBreakpointsByCount(
                     resolveDiceIdsInSchema(parseEffectSchema(entry.effect_schema))
                    )}
					<article class="class-card" style={`border-left-color: ${entry.color ?? '#8b5cf6'}`}>
						<header class="class-card__header">
							<div class="class-card__identity">
								{#if getIconUrl(entry.icon_png)}
									<img class="class-card__icon-image" src={getIconUrl(entry.icon_png)} alt={`${entry.name} icon`} />
								{:else}
									<span class="class-card__icon">{entry.icon_emoji ?? '🛡️'}</span>
								{/if}
								<div>
									<h2>{entry.name}</h2>
									<small>Position {entry.position}</small>
								</div>
							</div>
						<CardActionMenu
								onEdit={() => openClassForm(entry)}
								onDelete={() => deleteClass(entry)}
								onGenerate={null}
							/>
						</header>

						<div class="class-card__icon-actions">
							<label class="upload-button">
								<input
									type="file"
									accept="image/*"
									onchange={(event) => handleIconFileChange(entry, event)}
									aria-label={`Upload icon for ${entry.name}`}
								/>
								<span>{uploadingIconId === entry.id ? 'Uploading…' : 'Upload Icon'}</span>
							</label>
							<button
								class="btn danger"
								type="button"
								onclick={() => removeIcon(entry)}
								disabled={removingIconId === entry.id || !isIconImage(entry.icon_png)}
							>
								{removingIconId === entry.id ? 'Removing…' : 'Remove Icon'}
							</button>
						</div>

						{#if description}
							<p class="class-card__description">{description}</p>
						{:else}
							<p class="class-card__description class-card__description--empty">
								No description provided.
							</p>
						{/if}

						{#if Array.isArray(entry.tags) && entry.tags.length}
							<div class="trait-tag-list">
								{#each entry.tags as tag (tag)}
									<span class="trait-tag">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if effectSchema.length}
							<ul class="breakpoints">
								{#each effectSchema as bp, index (`${entry.id}-bp-${index}`)}
									<li class="breakpoints__item">
										<div class="breakpoints__line">
											<span
												class="breakpoints__count"
												class:bronze={bp.color === 'bronze'}
												class:silver={bp.color === 'silver'}
												class:gold={bp.color === 'gold'}
												class:prismatic={bp.color === 'prismatic'}
											>
												({bp.count})
											</span>
											<div class="breakpoints__effects">
								{#each bp.effects as effect, effectIndex (`${entry.id}-bp-${index}-effect-${effectIndex}`)}
									<span class="effect-tag">
										{summarizeEffectWithScaling(entry.name, effect)}
									</span>
												{/each}
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="class-card__description class-card__description--empty">
								No effects configured.
							</p>
						{/if}

						{#if prismatic}
							<section class="prismatic">
								<header class="prismatic__header">
									<span class="prismatic__lead">
										{#if prismatic.count}
											<span class="prismatic__count">({prismatic.count})</span>
										{/if}
										<span class="prismatic__title">{prismatic.name || 'Prismatic Bonus'}</span>
									</span>
								</header>
								{#if prismatic.description}
									<p class="prismatic__description">{prismatic.description}</p>
								{/if}
							</section>
						{/if}

						{#if footer}
							<footer class="class-card__footer">{footer}</footer>
						{/if}
					</article>
				{/each}
			</section>
		{/if}
	{/if}

	{#if showClassForm}
		<EditorModal
			title={editingClass ? 'Edit Class' : 'Create Class'}
			description="Update core class info, tags, prismatic bonus, and breakpoint effects."
			size="lg"
			on:close={closeClassForm}
		>
			<form id="class-editor-form" class="class-form" onsubmit={submitClassForm}>
				<section class="class-form__grid">
					<label>
						Name
						<input type="text" bind:value={formData.name} required />
					</label>
					<label>
						Position
						<input type="number" min="1" bind:value={formData.position} />
					</label>
					<label>
						Icon Emoji
						<input type="text" bind:value={formData.icon_emoji} placeholder="e.g. 🛡️" />
					</label>
					<label>
						Icon PNG (uploads to storage)
						<input
							type="file"
							accept="image/*"
							onchange={(event) =>
								handleIconFileChange(
									(editingClass as any) ?? { id: (formData as any).id ?? crypto.randomUUID(), ...(formData as any) },
									event
								)}
						/>
						{#if formData.icon_png}
							<small>Current path: {formData.icon_png}</small>
						{/if}
					</label>
					<label>
						Color
						<input type="color" bind:value={formData.color} />
					</label>
				</section>

				<label class="span-full">
					Description
					<textarea rows="3" bind:value={formData.description}></textarea>
				</label>

				<label class="span-full">
					Footer
					<textarea rows="2" bind:value={formData.footer}></textarea>
				</label>

				<label class="span-full">
					Tags
					<input
						type="text"
						placeholder="comma separated tags"
						bind:value={tagsInput}
						oninput={(event) => handleTagsInput(event.currentTarget.value)}
					/>
				</label>

				<section class="prismatic-editor">
					<header>
						<h3>Prismatic Bonus</h3>
						<label class="switch">
							<input
								type="checkbox"
								checked={prismaticEnabled}
								onchange={(event) => togglePrismatic(event.currentTarget.checked)}
							/>
							<span>Enable</span>
						</label>
					</header>

					{#if prismaticEnabled}
						<div class="prismatic-fields">
							<label>
								Name
								<input
									type="text"
									value={formData.prismatic?.name ?? ''}
									oninput={(event) => {
										const next = formData.prismatic ?? { ...EMPTY_PRISMATIC };
										next.name = event.currentTarget.value;
										prismaticCache = { ...next };
										formData = { ...formData, prismatic: { ...next } };
									}}
								/>
							</label>
							<label>
								Count
								<input
									type="text"
									value={formData.prismatic?.count ?? ''}
									oninput={(event) => {
										const next = formData.prismatic ?? { ...EMPTY_PRISMATIC };
										next.count = event.currentTarget.value;
										prismaticCache = { ...next };
										formData = { ...formData, prismatic: { ...next } };
									}}
								/>
							</label>
							<label class="prismatic-description">
								Description
								<textarea
									rows="3"
									value={formData.prismatic?.description ?? ''}
									oninput={(event) => {
										const next = formData.prismatic ?? { ...EMPTY_PRISMATIC };
										next.description = event.currentTarget.value;
										prismaticCache = { ...next };
										formData = { ...formData, prismatic: { ...next } };
									}}
								></textarea>
							</label>
						</div>
					{:else}
						<p class="prismatic-disabled">Enable to configure prismatic bonuses.</p>
					{/if}
				</section>

				<section class="breakpoint-editor">
					<header class="breakpoint-editor__header">
						<h3>Breakpoints</h3>
						<button class="btn" type="button" onclick={addBreakpoint}>
							Add Breakpoint
						</button>
					</header>

					{#if formData.effect_schema.length === 0}
						<p class="muted">No breakpoints defined yet.</p>
					{:else}
						{#each formData.effect_schema as breakpoint, index (index)}
							<article class="breakpoint-card">
								<header class="breakpoint-card__header">
									<label>
										Count
										<input
											type="text"
											value={breakpoint.count}
											oninput={(event) => updateBreakpointCount(index, event.currentTarget.value)}
										/>
									</label>
									<label>
										Color
										<select
											value={breakpoint.color ?? ''}
											onchange={(event) =>
												updateBreakpointColor(
													index,
													(event.currentTarget.value || undefined) as EffectBreakpoint['color']
												)}
										>
											<option value="">Default</option>
											<option value="bronze">Bronze</option>
											<option value="silver">Silver</option>
											<option value="gold">Gold</option>
											<option value="prismatic">Prismatic</option>
										</select>
									</label>
									<button class="icon-btn danger" type="button" onclick={() => removeBreakpoint(index)}>
										🗑️
									</button>
								</header>

								<label>
									Description
									<textarea
										rows="2"
										value={breakpoint.description ?? ''}
										oninput={(event) => updateBreakpointDescription(index, event.currentTarget.value)}
									></textarea>
								</label>

								<section class="effects">
									<header class="effects__header">
										<h4>Effects</h4>
										<div class="effect-buttons">
											{#each effectTypes as type (type)}
												<button
													type="button"
													class="btn"
													onclick={() => addEffectToBreakpoint(index, type)}
												>
													Add {type.replace('_', ' ')}
												</button>
											{/each}
										</div>
									</header>

									{#if breakpoint.effects.length === 0}
										<p class="muted">No effects yet.</p>
									{:else}
										<ul class="effects__list">
											{#each breakpoint.effects as effect, effectIndex (`${index}-${effectIndex}`)}
												<li class="effect-row">
													<header class="effect-row__header">
														<select
															value={effect.type}
															onchange={(event) =>
																setEffectType(index, effectIndex, event.currentTarget.value as Effect['type'])}
														>
															{#each effectTypes as type (type)}
																<option value={type}>{type.replace('_', ' ')}</option>
															{/each}
														</select>
														<button
															type="button"
															class="icon-btn danger"
															onclick={() => removeEffectFromBreakpoint(index, effectIndex)}
														>
															🗑️
														</button>
													</header>
													<p class="effect-row__summary">
														{summarizeEffectWithScaling(formData.name ?? '', effect)}
													</p>

							{#if effect.type === 'dice'}
								<section class="effect-body effect-body--dice">
									<label>
										Custom Dice
										<select
											value={effect.dice_id ?? ''}
											onchange={(event) =>
												updateDiceEffect(index, effectIndex, (current) => ({
													...current,
													dice_id: event.currentTarget.value ? event.currentTarget.value : null,
													dice_name:
														event.currentTarget.value
															? diceNameById.get(event.currentTarget.value) ?? current.dice_name ?? ''
															: current.dice_name ?? ''
												}))}
										>
											<option value="">Select dice</option>
											{#each diceOptions as option}
												<option value={option.id}>{option.name}</option>
											{/each}
										</select>
									</label>
									{#if !diceOptions.length}
										<p class="muted span-full">Create custom dice to reference them here.</p>
									{/if}
									<label>
										Quantity
										<input
											type="number"
											min="1"
											value={effect.quantity}
											oninput={(event) =>
												updateDiceEffect(index, effectIndex, (current) => ({
													...current,
													quantity: Number(event.currentTarget.value)
												}))}
										/>
									</label>
									{#if !effect.dice_id}
										<label class="span-full">
											Legacy label
											<input
												type="text"
												value={effect.dice_name ?? ''}
												oninput={(event) =>
													updateDiceEffect(index, effectIndex, (current) => ({
														...current,
														dice_name: event.currentTarget.value
													}))}
											/>
										</label>
									{/if}
									{#if (formData.name ?? '').trim().toLowerCase() === sorcererName}
										<p class="effect-body__note span-full">
											Preview: {summarizeEffectWithScaling(formData.name ?? '', effect)}.
											Rune count multiplies the dice quantity during gameplay.
										</p>
									{/if}
								</section>
							{:else if effect.type === 'flat_stat'}
														<section class="effect-body">
															<label>
																Stat
																<select
																	value={effect.stat}
																	onchange={(event) =>
																		updateFlatStatEffect(index, effectIndex, (current) => ({
																			...current,
																			stat: event.currentTarget.value as FlatStatEffect['stat']
																		}))}
																>
																	<option value="attack">Attack</option>
																	<option value="defense">Defense</option>
																</select>
															</label>
															<label>
																Value
																<input
																	type="number"
																	value={effect.value}
																	oninput={(event) =>
																		updateFlatStatEffect(index, effectIndex, (current) => ({
																			...current,
																			value: Number(event.currentTarget.value)
																		}))}
																/>
															</label>
															<label>
																Condition
																<input
																	type="text"
																	value={effect.condition ?? ''}
																	oninput={(event) =>
																		updateFlatStatEffect(index, effectIndex, (current) => ({
																			...current,
																			condition: event.currentTarget.value
																		}))}
																/>
															</label>
														</section>
													{:else if effect.type === 'multiplier'}
														<section class="effect-body">
															<label>
																Stat
																<select
																	value={effect.stat}
																	onchange={(event) =>
																		updateMultiplierEffect(index, effectIndex, (current) => ({
																			...current,
																			stat: event.currentTarget.value as MultiplierEffect['stat']
																		}))}
																>
																	<option value="attack">Attack</option>
																	<option value="defense">Defense</option>
																</select>
															</label>
															<label>
																Multiplier
																<input
																	type="number"
																	min="0"
																	step="0.1"
																	value={effect.value}
																	oninput={(event) =>
																		updateMultiplierEffect(index, effectIndex, (current) => ({
																			...current,
																			value: Number(event.currentTarget.value)
																		}))}
																/>
															</label>
														</section>
													{:else if effect.type === 'benefit'}
														<section class="effect-body">
															<label>
																Description
																<textarea
																	rows="2"
																	value={effect.description}
																	oninput={(event) =>
																		updateBenefitEffect(index, effectIndex, (current) => ({
																			...current,
																			description: event.currentTarget.value
																		}))}
																></textarea>
															</label>
															<label>
																Value
																<input
																	type="number"
																	step="0.1"
																	value={effect.value ?? ''}
																	oninput={(event) =>
																		updateBenefitEffect(index, effectIndex, (current) => ({
																			...current,
																			value: event.currentTarget.value
																				? Number(event.currentTarget.value)
																				: undefined
																		}))}
																/>
															</label>
															<label>
																Type
																<input
																	type="text"
																	value={effect.benefit_type ?? ''}
																	oninput={(event) =>
																		updateBenefitEffect(index, effectIndex, (current) => ({
																			...current,
																			benefit_type: event.currentTarget.value || undefined
																		}))}
																/>
															</label>
														</section>
													{:else if effect.type === 'backup_trim'}
														<section class="effect-body">
															<label>
																Remove Dice
																<input
																	type="number"
																	min="0"
																	value={effect.value}
																	oninput={(event) =>
																		updateBackupTrimEffect(index, effectIndex, (current) => ({
																			...current,
																			value: Number(event.currentTarget.value)
																		}))}
																/>
															</label>
														</section>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
								</section>
							</article>
						{/each}
					{/if}
				</section>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="class-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeClassForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}

	{#if showSpecialCategoryForm}
		<EditorModal
			title={editingSpecialCategory ? 'Edit Special Category' : 'Create Special Category'}
			description="A special category card displays 3 slots, each containing multiple classes."
			size="lg"
			on:close={closeSpecialCategoryForm}
		>
			<form id="special-category-form" class="special-category-form" onsubmit={submitSpecialCategoryForm}>
				<div class="special-category-form__grid">
					<label>
						Name
						<input type="text" bind:value={specialCategoryFormData.name} required />
					</label>
					<label>
						Icon Emoji
						<input type="text" bind:value={specialCategoryFormData.icon_emoji} placeholder="e.g. ⚡" />
					</label>
					<label>
						Color
						<input type="color" bind:value={specialCategoryFormData.color} />
					</label>
					<label>
						Position
						<input type="number" min="0" bind:value={specialCategoryFormData.position} />
					</label>
				</div>

				<label class="span-full">
					Description
					<textarea rows="2" bind:value={specialCategoryFormData.description}></textarea>
				</label>

				<div class="slot-editors">
					{#each [
						{ key: 'slot_1_class_ids' as const, label: 'Slot 1' },
						{ key: 'slot_2_class_ids' as const, label: 'Slot 2' },
						{ key: 'slot_3_class_ids' as const, label: 'Slot 3' }
					] as slot}
						<fieldset class="slot-fieldset">
							<legend>{slot.label}</legend>
							<div class="slot-class-grid">
								{#each classes as cls (cls.id)}
									<label class="slot-class-checkbox">
										<input
											type="checkbox"
											checked={specialCategoryFormData[slot.key].includes(cls.id)}
											onchange={() => toggleClassInSlot(slot.key, cls.id)}
										/>
										<span class="slot-class-label" style="border-color: {cls.color ?? '#8b5cf6'}">
											{cls.icon_emoji ?? '🛡️'} {cls.name}
										</span>
									</label>
								{/each}
							</div>
						</fieldset>
					{/each}
				</div>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="special-category-form">Save</button>
				<button class="btn" type="button" onclick={closeSpecialCategoryForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.class-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.class-form__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.6rem;
	}

	.class-form .span-full {
		grid-column: 1 / -1;
		width: 100%;
	}

	.prismatic-editor {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border: 1px solid rgba(124, 58, 237, 0.35);
		background: rgba(19, 26, 46, 0.82);
		border-radius: 10px;
		padding: 0.65rem;
	}

	.prismatic-editor header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.switch input {
		transform: scale(1.05);
	}

	.prismatic-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.6rem;
	}

	.prismatic-description {
		grid-column: 1 / -1;
	}

	.prismatic-disabled {
		margin: 0;
		color: #9ca3c9;
		font-style: italic;
	}

	.breakpoint-editor {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.breakpoint-editor__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.breakpoint-editor__header h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.breakpoint-editor__header .btn {
		padding: 0.32rem 0.6rem;
		font-size: 0.85rem;
	}

	.breakpoint-card {
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(18, 24, 42, 0.85);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.65rem;
	}

	.breakpoint-card__header {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.5rem;
		align-items: end;
	}

	.effects {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effects__header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.45rem;
	}

	.effects__header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.effect-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.effect-buttons .btn {
		padding: 0.28rem 0.55rem;
		font-size: 0.8rem;
	}

	.effects__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-row {
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		background: rgba(27, 35, 56, 0.82);
		padding: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-row__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.effect-row__header select {
		min-width: 140px;
	}

	.effect-row__header .icon-btn {
		padding: 0.22rem 0.45rem;
	}

	.effect-row__summary {
		margin: 0;
		font-size: 0.85rem;
		color: #cbd5f5;
	}

	.effect-body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.effect-body--dice {
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}

	.effect-body--dice .span-full {
		grid-column: 1 / -1;
	}

	.effect-body__note {
		margin: 0;
		font-size: 0.8rem;
		color: #a5b4fc;
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: 6px;
		padding: 0.35rem 0.55rem;
	}

	.class-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
	}

	.class-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border-left: 4px solid rgba(139, 92, 246, 0.6);
		background: rgba(15, 23, 42, 0.7);
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.class-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.class-card__identity {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.class-card__icon {
		font-size: 1.75rem;
	}

	.class-card__icon-image {
		width: 28px;
		height: 28px;
		object-fit: contain;
		border-radius: 4px;
	}

	.class-card__icon-actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		margin: 0.5rem 0;
	}

	.upload-button {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}

	.upload-button input[type="file"] {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.upload-button span {
		display: inline-block;
		padding: 0.4rem 0.7rem;
		background: rgba(59, 130, 246, 0.3);
		border: 1px solid rgba(59, 130, 246, 0.5);
		border-radius: 6px;
		color: #93c5fd;
		font-size: 0.875rem;
		transition: opacity 0.15s ease;
	}

	.upload-button:hover span {
		background: rgba(59, 130, 246, 0.4);
		border-color: rgba(59, 130, 246, 0.7);
	}

	.class-card__description {
		margin: 0;
		color: #d1d5f9;
		white-space: pre-wrap;
	}

	.class-card__description--empty {
		color: #94a3b8;
		font-style: italic;
	}

	.class-card__footer {
		margin: 0;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.breakpoints {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
	}

	.breakpoints__item {
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 10px;
		padding: 0.6rem 0.7rem;
	}

	.breakpoints__line {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.breakpoints__count {
		font-weight: 600;
		color: #cbd5f5;
	}

	.breakpoints__count.bronze {
		color: #fbbf24;
	}

	.breakpoints__count.silver {
		color: #cbd5f5;
	}

	.breakpoints__count.gold {
		color: #facc15;
	}

	.breakpoints__count.prismatic {
		background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
		color: #0f172a;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
	}

	.breakpoints__effects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.effect-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.18);
		color: #e0e7ff;
		font-size: 0.75rem;
		letter-spacing: 0.02em;
	}

	.trait-tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.2rem 0 0.4rem;
	}

	.trait-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.18rem 0.45rem;
		border-radius: 999px;
		background: rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
		font-size: 0.72rem;
		letter-spacing: 0.03em;
	}

	.prismatic {
		border-radius: 10px;
		border: 1px solid rgba(129, 140, 248, 0.35);
		background: rgba(30, 41, 59, 0.65);
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.prismatic__header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.prismatic__lead {
		display: inline-flex;
		gap: 0.4rem;
		align-items: baseline;
	}

	.prismatic__count {
		font-weight: 600;
		color: #a855f7;
	}

	.prismatic__title {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		color: #ede9fe;
	}

	.prismatic__description {
		margin: 0;
		color: #d8b4fe;
		white-space: pre-wrap;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	/* Special Category Card Styles - matches regular class card styling */
	.special-category-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border-left: 4px solid rgba(139, 92, 246, 0.6);
		background: rgba(15, 23, 42, 0.7);
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.special-category-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.special-category-card__identity {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.special-category-card__icon {
		font-size: 1.75rem;
	}

	.special-category-card__description {
		margin: 0;
		color: #d1d5f9;
		white-space: pre-wrap;
		font-size: 0.9rem;
	}

	.special-slots {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.special-slot {
		display: flex;
		align-items: flex-start;
		padding: 0.5rem;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
	}

	.special-slot--empty {
		justify-content: center;
		padding: 0.75rem;
	}

	.special-slot__class {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-left: 0.5rem;
		border-left: 3px solid;
		flex: 1;
	}

	.special-slot__header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.special-slot__icon {
		font-size: 1rem;
	}

	.special-slot__name {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
		flex: 1;
	}

	.special-slot__edit-btn {
		padding: 0.15rem 0.3rem;
		font-size: 0.7rem;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.15s ease, background 0.15s ease;
	}

	.special-slot__edit-btn:hover {
		opacity: 1;
		background: rgba(59, 130, 246, 0.35);
	}

	.special-slot__breakpoints {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.special-slot__bp {
		font-size: 0.7rem;
		color: #94a3b8;
		line-height: 1.25;
	}

	.special-slot__bp.bronze {
		color: #fbbf24;
	}

	.special-slot__bp.silver {
		color: #cbd5f5;
	}

	.special-slot__bp.gold {
		color: #facc15;
	}

	.special-slot__bp.prismatic {
		background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.special-slot__placeholder {
		font-size: 0.8rem;
		color: #475569;
		font-style: italic;
	}

	/* Special Category Form Styles */
	.special-category-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.special-category-form__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}

	.slot-editors {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.slot-fieldset {
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.slot-fieldset legend {
		padding: 0 0.5rem;
		font-weight: 600;
		color: #e2e8f0;
		font-size: 0.9rem;
	}

	.slot-class-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.slot-class-checkbox {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.slot-class-checkbox input {
		margin: 0;
	}

	.slot-class-label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid;
		border-radius: 5px;
		font-size: 0.8rem;
		color: #cbd5e1;
	}
</style>
