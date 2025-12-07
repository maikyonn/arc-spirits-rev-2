<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { MonsterRow, EventRow, RewardRow, RewardRowType, SpecialEffectRow } from '$lib/types/gameData';
	import { REWARD_ROW_CONFIG } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import {
		deleteMonsterRecord,
		emptyMonsterForm,
		emptyRewardRow,
		fetchMonsterRecords,
		monsterRowToForm,
		saveMonsterRecord,
		type MonsterFormData
	} from '$lib/features/monsters/monsters';
	import {
		deleteEventRecord,
		emptyEventForm,
		fetchEventRecords,
		eventRowToForm,
		saveEventRecord,
		type EventFormData
	} from '$lib/features/events/events';
	import { generateMonsterCardPNG } from '$lib/utils/monsterCardGenerator';
	import { generateEventCardPNG } from '$lib/utils/eventCardGenerator';
	import MonsterCardGallery from '$lib/components/monsters/MonsterCardGallery.svelte';
	import { publicAssetUrl } from '$lib/utils/storage';
	import html2canvas from 'html2canvas';
	import jsPDF from 'jspdf';

	// Resolved reward row with icon URLs for display
	type ResolvedRewardRow = RewardRow & {
		icon_urls: (string | null)[];
	};

	type Monster = MonsterRow & {
		icon_url: string | null;
		art_url: string | null;
		resolved_reward_rows: ResolvedRewardRow[];
		effects: SpecialEffectRow[];
	};

	type EventCard = EventRow & {
		art_url: string | null;
	};

	type CardItem = 
		| { type: 'monster'; data: Monster }
		| { type: 'event'; data: EventCard };

	let monsters: Monster[] = [];
	let events: EventCard[] = [];
	let loading = true;
	let error: string | null = null;
	let combinedCards: CardItem[] = [];
	let filteredMonsters: Monster[] = [];

	const gameAssetsStorage = supabase.storage.from('game_assets');

	let search = '';
let stateFilter: 'all' | 'tainted' | 'corrupt' | 'fallen' | 'boss' = 'all';
let rewardIconLookup: Record<string, string> = {};
let availableIcons: { id: string; name: string; file_path: string; url: string | null }[] = [];
let hexSpiritArts: string[] = [];

// Special effects
let specialEffects: SpecialEffectRow[] = [];
let monsterSpecialEffects: Record<string, string[]> = {}; // monster_id -> effect_ids
let showEffectsManager = false;
let effectFormData = { name: '', description: '', icon: '', color: '#a78bfa' };
let editingEffect: SpecialEffectRow | null = null;
let selectedEffectIds: string[] = []; // For monster form

// Form state for editing reward rows
let editingRowIndex: number | null = null;
let rowIconQuantities: Record<string, number> = {};

	let showMonsterForm = false;
	let editingMonster: Monster | null = null;
	let formData: MonsterFormData = emptyMonsterForm();

	// Event form state
	let showEventForm = false;
	let editingEvent: EventCard | null = null;
	let eventFormData: EventFormData = emptyEventForm();

	let uploadingIconId: string | null = null;
	let removingIconId: string | null = null;
	let uploadingArtId: string | null = null;
	let removingArtId: string | null = null;
	let uploadingEventArtId: string | null = null;
	let removingEventArtId: string | null = null;
	let generatingCard: string | null = null;
	let generatingAllCards = false;
	let generationProgress = { current: 0, total: 0 };
	let isGalleryOpen = false;

	

	const stateColors: Record<string, string> = {
		tainted: '#c084fc', // light purple
		corrupt: '#6b21a8', // dark purple
		fallen: '#065f46', // dark green
		boss: '#ef4444' // red
	};

	onMount(async () => {
		// Load hex spirit arts first so both monsters and events can use random fallback images
		await loadHexSpiritArts();
		// Load special effects first so they're available when loading monsters
		await Promise.all([loadSpecialEffects(), loadMonsterSpecialEffects()]);
		await Promise.all([loadMonsters(), loadEvents()]);
	});

	async function loadMonsters() {
		loading = true;
		error = null;
		try {
		const data = await fetchMonsterRecords();
		await Promise.all([loadAvailableIcons(), loadHexSpiritArts()]);
		
		// Collect all icon IDs from all reward_rows
		const rewardIds = Array.from(
			new Set(
				data.flatMap((m) => {
					const rows = m.reward_rows ?? [];
					return rows.flatMap((row: RewardRow) => row.icon_ids ?? []);
				})
			)
		);
		rewardIconLookup = await loadRewardIconLookup(rewardIds);
		
		monsters = data.map((monster) => {
			const artUrl =
				getImageUrl(monster.image_path, monster.updated_at) ??
				getRandomHexSpiritArt(hexSpiritArts);
			
			// Resolve icon URLs for each reward row
			const resolvedRewardRows: ResolvedRewardRow[] = (monster.reward_rows ?? []).map((row: RewardRow) => ({
				...row,
				icon_urls: (row.icon_ids ?? []).map((id: string) =>
					rewardIconLookup[id] ? publicAssetUrl(rewardIconLookup[id], { updatedAt: monster.updated_at ?? undefined }) : null
				)
			}));
			
			// Get effects for this monster
			const effectIds = monsterSpecialEffects[monster.id] ?? [];
			const monsterEffects = effectIds
				.map(id => specialEffects.find(e => e.id === id))
				.filter((e): e is SpecialEffectRow => e !== undefined);
			
			return {
				...monster,
				icon_url: getIconUrl(monster.icon, monster.updated_at),
				art_url: artUrl,
				resolved_reward_rows: resolvedRewardRows,
				effects: monsterEffects,
				state: monster.state ?? 'tainted'
			};
		});
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	async function loadEvents() {
		try {
			const data = await fetchEventRecords();
			events = data.map((event) => ({
				...event,
				art_url: getEventImageUrl(event.image_path, event.updated_at) ?? getRandomHexSpiritArt(hexSpiritArts)
			}));
		} catch (err) {
			console.warn('Failed to load events', err);
			events = [];
		}
	}

	function getEventImageUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('events/') ? imagePath : `events/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function getIconUrl(icon: string | null | undefined, updatedAt?: string | null): string | null {
		if (!icon) return null;
		if (icon.includes('/')) {
			const path = icon.startsWith('monster_icons/') ? icon : `monster_icons/${icon}`;
			return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
		}
		return null;
	}

	function getImageUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('monsters/') ? imagePath : `monsters/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	async function loadRewardIconLookup(ids: string[]): Promise<Record<string, string>> {
		if (!ids.length) return {};
		const { data, error } = await supabase.from('misc_assets').select('id,file_path').in('id', ids);
		if (error) {
			console.warn('Failed to load reward icons', error);
			return {};
		}
		return Object.fromEntries((data ?? []).map((row) => [row.id, row.file_path]));
	}

	async function loadAvailableIcons() {
		const { data, error } = await supabase
			.from('misc_assets')
			.select('id,name,file_path')
			.eq('category', 'icon');
		if (error) {
			console.warn('Failed to load icons', error);
			availableIcons = [];
			return;
		}
		availableIcons = (data ?? []).map((row) => ({
			id: row.id,
			name: row.name ?? 'Icon',
			file_path: row.file_path ?? '',
			url: row.file_path ? publicAssetUrl(row.file_path) : null
		}));
	}

	async function loadHexSpiritArts() {
		const { data, error } = await supabase
			.from('hex_spirits')
			.select('art_raw_image_path, game_print_image_path')
			.limit(200);
		if (error) {
			console.warn('Failed to load hex spirit art', error);
			hexSpiritArts = [];
			return;
		}
		hexSpiritArts = (data ?? [])
			.map((row) => row.art_raw_image_path ?? row.game_print_image_path)
			.filter((p): p is string => !!p);
	}

	function getRandomHexSpiritArt(list: string[]): string | null {
		if (!list.length) return null;
		const pick = list[Math.floor(Math.random() * list.length)];
		return pick ? publicAssetUrl(pick) : null;
	}

	// Special Effects functions
	async function loadSpecialEffects() {
		const { data, error } = await supabase
			.from('special_effects')
			.select('*')
			.order('name');
		if (error) {
			console.warn('Failed to load special effects', error);
			specialEffects = [];
			return;
		}
		specialEffects = data ?? [];
	}

	async function loadMonsterSpecialEffects() {
		const { data, error } = await supabase
			.from('monster_special_effects')
			.select('monster_id, special_effect_id, position')
			.order('position', { ascending: true });
		if (error) {
			console.warn('Failed to load monster special effects', error);
			monsterSpecialEffects = {};
			return;
		}
		// Group by monster_id, preserving order
		monsterSpecialEffects = {};
		for (const row of data ?? []) {
			if (!monsterSpecialEffects[row.monster_id]) {
				monsterSpecialEffects[row.monster_id] = [];
			}
			monsterSpecialEffects[row.monster_id].push(row.special_effect_id);
		}
	}

	function openEffectsManager() {
		effectFormData = { name: '', description: '', icon: '', color: '#a78bfa' };
		editingEffect = null;
		showEffectsManager = true;
	}

	function closeEffectsManager() {
		showEffectsManager = false;
		editingEffect = null;
	}

	function editEffect(effect: SpecialEffectRow) {
		editingEffect = effect;
		effectFormData = {
			name: effect.name,
			description: effect.description ?? '',
			icon: effect.icon ?? '',
			color: effect.color
		};
	}

	async function saveEffect() {
		if (!effectFormData.name.trim()) return;
		
		if (editingEffect) {
			const { error } = await supabase
				.from('special_effects')
				.update({
					name: effectFormData.name,
					description: effectFormData.description || null,
					icon: effectFormData.icon || null,
					color: effectFormData.color,
					updated_at: new Date().toISOString()
				})
				.eq('id', editingEffect.id);
			if (error) {
				console.error('Failed to update effect', error);
				return;
			}
		} else {
			const { error } = await supabase
				.from('special_effects')
				.insert({
					name: effectFormData.name,
					description: effectFormData.description || null,
					icon: effectFormData.icon || null,
					color: effectFormData.color
				});
			if (error) {
				console.error('Failed to create effect', error);
				return;
			}
		}
		
		await loadSpecialEffects();
		effectFormData = { name: '', description: '', icon: '', color: '#a78bfa' };
		editingEffect = null;
	}

	async function deleteEffect(effect: SpecialEffectRow) {
		if (!confirm(`Delete "${effect.name}"? This will remove it from all monsters.`)) return;
		
		const { error } = await supabase
			.from('special_effects')
			.delete()
			.eq('id', effect.id);
		if (error) {
			console.error('Failed to delete effect', error);
			return;
		}
		
		await Promise.all([loadSpecialEffects(), loadMonsterSpecialEffects()]);
	}

	async function saveMonsterEffects(monsterId: string, effectIds: string[]) {
		// Delete existing associations
		await supabase
			.from('monster_special_effects')
			.delete()
			.eq('monster_id', monsterId);
		
		// Insert new associations with position
		if (effectIds.length > 0) {
			const { error } = await supabase
				.from('monster_special_effects')
				.insert(effectIds.map((effectId, index) => ({
					monster_id: monsterId,
					special_effect_id: effectId,
					position: index
				})));
			if (error) {
				console.error('Failed to save monster effects', error);
			}
		}
		
		await loadMonsterSpecialEffects();
	}

	function toggleEffect(effectId: string) {
		if (selectedEffectIds.includes(effectId)) {
			selectedEffectIds = selectedEffectIds.filter(id => id !== effectId);
		} else {
			selectedEffectIds = [...selectedEffectIds, effectId];
		}
	}

	function moveEffectUp(index: number) {
		if (index <= 0) return;
		const newIds = [...selectedEffectIds];
		[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
		selectedEffectIds = newIds;
	}

	function moveEffectDown(index: number) {
		if (index >= selectedEffectIds.length - 1) return;
		const newIds = [...selectedEffectIds];
		[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
		selectedEffectIds = newIds;
	}

	function removeEffect(effectId: string) {
		selectedEffectIds = selectedEffectIds.filter(id => id !== effectId);
	}

	function isIconImage(icon: string | null | undefined): boolean {
		return icon?.includes('/') ?? false;
	}

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50);
	}

	async function handleIconUpload(monsterId: string, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Icon must be smaller than 5MB.');
			return;
		}

		uploadingIconId = monsterId;
		try {
			const monster = editingMonster || monsters.find((m) => m.id === monsterId);
			if (!monster) throw new Error('Monster not found');

			// Remove old icon if it exists
			if (isIconImage(monster.icon)) {
				const oldPath = monster.icon!.startsWith('monster_icons/') ? monster.icon! : `monster_icons/${monster.icon!}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const sanitizedName = sanitizeFileName(formData.name || monster.name);
			const fileName = `monster_${sanitizedName}_icon.${extension}`;
			const path = `monster_icons/${monsterId}/${fileName}`;

			const { error: uploadError } = await gameAssetsStorage.upload(path, file, {
				cacheControl: '3600',
				upsert: true,
				contentType: file.type
			});
			if (uploadError) {
				throw uploadError;
			}

			const { error: updateError } = await supabase
				.from('monsters')
				.update({ icon: path, updated_at: new Date().toISOString() })
				.eq('id', monsterId);
			if (updateError) {
				throw updateError;
			}

			formData.icon = path;
			await loadMonsters();
		} catch (err) {
			console.error(err);
			alert('Failed to upload icon. Please try again.');
		} finally {
			uploadingIconId = null;
		}
	}

	async function removeIcon(monsterId: string) {
		const monster = editingMonster || monsters.find((m) => m.id === monsterId);
		if (!monster || !isIconImage(monster.icon)) return;
		removingIconId = monsterId;
		try {
			const oldPath = monster.icon!.startsWith('monster_icons/') ? monster.icon! : `monster_icons/${monster.icon!}`;
			await gameAssetsStorage.remove([oldPath]);
			const { error: updateError } = await supabase
				.from('monsters')
				.update({ icon: null, updated_at: new Date().toISOString() })
				.eq('id', monsterId);
			if (updateError) {
				throw updateError;
			}
			formData.icon = null;
			await loadMonsters();
		} catch (err) {
			console.error(err);
			alert('Failed to remove icon.');
		} finally {
			removingIconId = null;
		}
	}

	async function handleArtUpload(monsterId: string, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			alert('Image must be smaller than 10MB.');
			return;
		}

		uploadingArtId = monsterId;
		try {
			const monster = editingMonster || monsters.find((m) => m.id === monsterId);
			if (!monster) throw new Error('Monster not found');

			if (monster.image_path) {
				const existingPath = monster.image_path.startsWith('monsters/')
					? monster.image_path
					: `monsters/${monster.image_path}`;
				await gameAssetsStorage.remove([existingPath]);
			}

			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const sanitizedName = sanitizeFileName(formData.name || monster.name);
			const path = `monsters/${monsterId}/art_${sanitizedName}.${extension}`;

			const { error: uploadError } = await gameAssetsStorage.upload(path, file, {
				cacheControl: '3600',
				upsert: true,
				contentType: file.type
			});
			if (uploadError) throw uploadError;

			const { error: updateError } = await supabase
				.from('monsters')
				.update({ image_path: path, updated_at: new Date().toISOString() })
				.eq('id', monsterId);
			if (updateError) throw updateError;

			formData.image_path = path;
			await loadMonsters();
		} catch (err) {
			console.error(err);
			alert('Failed to upload monster image.');
		} finally {
			uploadingArtId = null;
		}
	}

	async function removeArt(monsterId: string) {
		const monster = editingMonster || monsters.find((m) => m.id === monsterId);
		if (!monster?.image_path) return;
		removingArtId = monsterId;
		try {
			const path = monster.image_path.startsWith('monsters/') ? monster.image_path : `monsters/${monster.image_path}`;
			await gameAssetsStorage.remove([path]);
			const { error: updateError } = await supabase
				.from('monsters')
				.update({ image_path: null, updated_at: new Date().toISOString() })
				.eq('id', monsterId);
			if (updateError) throw updateError;
			formData.image_path = null;
			await loadMonsters();
		} catch (err) {
			console.error(err);
			alert('Failed to remove monster image.');
		} finally {
			removingArtId = null;
		}
	}

	function handleFileChange(monsterId: string, event: Event, type: 'icon' | 'art') {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file) return;
		if (type === 'icon') void handleIconUpload(monsterId, file);
		if (type === 'art') void handleArtUpload(monsterId, file);
	}

	// Helper to convert icon IDs to quantities for editing
	function buildQuantities(ids: string[]): Record<string, number> {
		return ids.reduce<Record<string, number>>((acc, id) => {
			acc[id] = (acc[id] ?? 0) + 1;
			return acc;
		}, {});
	}

	// Helper to convert quantities back to icon ID list
	function buildIconIdList(qty: Record<string, number>): string[] {
		const list: string[] = [];
		for (const [id, count] of Object.entries(qty)) {
			const n = Math.max(0, Math.floor(count ?? 0));
			for (let i = 0; i < n; i += 1) list.push(id);
		}
		return list;
	}

	// Reward row management
	function addRewardRow() {
		formData.reward_rows = [...formData.reward_rows, emptyRewardRow()];
		editingRowIndex = formData.reward_rows.length - 1;
		rowIconQuantities = {};
	}

	function removeRewardRow(index: number) {
		formData.reward_rows = formData.reward_rows.filter((_, i) => i !== index);
		if (editingRowIndex === index) {
			editingRowIndex = null;
			rowIconQuantities = {};
		} else if (editingRowIndex !== null && editingRowIndex > index) {
			editingRowIndex -= 1;
		}
	}

	function startEditingRow(index: number) {
		editingRowIndex = index;
		rowIconQuantities = buildQuantities(formData.reward_rows[index]?.icon_ids ?? []);
	}

	function updateRowType(index: number, type: RewardRowType) {
		formData.reward_rows = formData.reward_rows.map((row, i) =>
			i === index ? { ...row, type } : row
		);
	}

	function saveRowIcons() {
		if (editingRowIndex === null) return;
		const iconIds = buildIconIdList(rowIconQuantities);
		formData.reward_rows = formData.reward_rows.map((row, i) =>
			i === editingRowIndex ? { ...row, icon_ids: iconIds } : row
		);
		editingRowIndex = null;
		rowIconQuantities = {};
	}

	function openMonsterForm(monster?: Monster) {
		if (monster) {
			editingMonster = monster;
			formData = monsterRowToForm(monster);
			selectedEffectIds = monsterSpecialEffects[monster.id] ?? [];
		} else {
			editingMonster = null;
			formData = emptyMonsterForm();
			selectedEffectIds = [];
		}
		editingRowIndex = null;
		rowIconQuantities = {};
		showMonsterForm = true;
	}

	function closeMonsterForm() {
		showMonsterForm = false;
		editingRowIndex = null;
		rowIconQuantities = {};
	}

	function submitMonsterForm(event: Event) {
		event.preventDefault();
		void saveMonster();
	}

	async function saveMonster() {
		if (!formData.name.trim()) {
			alert('Monster name is required.');
			return;
		}

		try {
			const savedMonster = await saveMonsterRecord(formData);
			// Save special effects associations
			await saveMonsterEffects(savedMonster.id, selectedEffectIds);
			await loadMonsters();
			closeMonsterForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save monster: ${message}`);
		}
	}

	async function deleteMonster(monster: Monster) {
		if (!confirm(`Delete monster "${monster.name}"?`)) return;
		try {
			await deleteMonsterRecord(monster.id);
			await loadMonsters();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete monster: ${message}`);
		}
	}

	// Event CRUD functions
	function openEventForm(eventCard?: EventCard) {
		if (eventCard) {
			editingEvent = eventCard;
			eventFormData = eventRowToForm(eventCard);
		} else {
			editingEvent = null;
			eventFormData = emptyEventForm();
		}
		showEventForm = true;
	}

	function closeEventForm() {
		showEventForm = false;
	}

	function submitEventForm(e: SubmitEvent) {
		e.preventDefault();
		void saveEvent();
	}

	async function saveEvent() {
		if (!eventFormData.name.trim()) {
			alert('Event name is required.');
			return;
		}
		if (!eventFormData.title.trim()) {
			alert('Event title is required.');
			return;
		}

		try {
			await saveEventRecord(eventFormData);
			await loadEvents();
			closeEventForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save event: ${message}`);
		}
	}

	async function deleteEvent(eventCard: EventCard) {
		if (!confirm(`Delete event "${eventCard.name}"?`)) return;
		try {
			await deleteEventRecord(eventCard.id);
			await loadEvents();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete event: ${message}`);
		}
	}

	async function handleEventArtUpload(eventId: string, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			alert('Image must be smaller than 10MB.');
			return;
		}

		uploadingEventArtId = eventId;
		try {
			const event = editingEvent || events.find((e) => e.id === eventId);
			if (!event) throw new Error('Event not found');

			if (event.image_path) {
				const existingPath = event.image_path.startsWith('events/')
					? event.image_path
					: `events/${event.image_path}`;
				await gameAssetsStorage.remove([existingPath]);
			}

			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const sanitizedName = sanitizeFileName(eventFormData.name || event.name);
			const path = `events/${eventId}/art_${sanitizedName}.${extension}`;

			const { error: uploadError } = await gameAssetsStorage.upload(path, file, {
				cacheControl: '3600',
				upsert: true,
				contentType: file.type
			});
			if (uploadError) throw uploadError;

			const { error: updateError } = await supabase
				.from('events')
				.update({ image_path: path, updated_at: new Date().toISOString() })
				.eq('id', eventId);
			if (updateError) throw updateError;

			eventFormData.image_path = path;
			await loadEvents();
		} catch (err) {
			console.error(err);
			alert('Failed to upload event image.');
		} finally {
			uploadingEventArtId = null;
		}
	}

	async function removeEventArt(eventId: string) {
		const event = editingEvent || events.find((e) => e.id === eventId);
		if (!event?.image_path) return;
		removingEventArtId = eventId;
		try {
			const path = event.image_path.startsWith('events/') ? event.image_path : `events/${event.image_path}`;
			await gameAssetsStorage.remove([path]);
			const { error: updateError } = await supabase
				.from('events')
				.update({ image_path: null, updated_at: new Date().toISOString() })
				.eq('id', eventId);
			if (updateError) throw updateError;
			eventFormData.image_path = null;
			await loadEvents();
		} catch (err) {
			console.error(err);
			alert('Failed to remove event image.');
		} finally {
			removingEventArtId = null;
		}
	}

	function handleEventFileChange(eventId: string, e: Event & { currentTarget: HTMLInputElement }) {
		const target = e.currentTarget;
		const file = target.files?.[0];
		target.value = '';
		if (file) void handleEventArtUpload(eventId, file);
	}

	$: {
		const term = search.trim().toLowerCase();
		
		filteredMonsters = monsters.filter((monster) => {
			if (stateFilter !== 'all' && monster.state !== stateFilter) return false;
			if (term && !monster.name.toLowerCase().includes(term)) return false;
			return true;
		});

		const filteredEvents = events.filter((eventCard) => {
			if (term && !eventCard.name.toLowerCase().includes(term) && !eventCard.title.toLowerCase().includes(term)) {
				return false;
			}
			return true;
		});

		// Combine and sort by order_num
		const monsterCards: CardItem[] = filteredMonsters.map((m) => ({ type: 'monster', data: m }));
		const eventCards: CardItem[] = filteredEvents.map((e) => ({ type: 'event', data: e }));
		
		combinedCards = [...monsterCards, ...eventCards].sort((a, b) => {
			const orderA = a.type === 'monster' ? a.data.order_num : a.data.order_num;
			const orderB = b.type === 'monster' ? b.data.order_num : b.data.order_num;
			if (orderA !== orderB) return orderA - orderB;
			const nameA = a.type === 'monster' ? a.data.name : a.data.name;
			const nameB = b.type === 'monster' ? b.data.name : b.data.name;
			return nameA.localeCompare(nameB);
		});
	}

	async function generateCardPNG(monster: Monster) {
		if (!monster.id || !monster.name) {
			alert('Please save the monster first before generating a card image.');
			return;
		}

		generatingCard = monster.id;
		try {
			const artUrl = monster.art_url ?? getImageUrl(monster.image_path, monster.updated_at);
			const iconUrl = monster.icon_url ?? getIconUrl(monster.icon, monster.updated_at);
			const pngBlob = await generateMonsterCardPNG(monster, artUrl, iconUrl, monster.resolved_reward_rows);

			const fileName = `monsters/${monster.id}/card.png`;
			const file = new File([pngBlob], 'card.png', { type: 'image/png' });

			const { error: uploadError } = await gameAssetsStorage.upload(fileName, file, {
				contentType: 'image/png',
				upsert: true
			});
			if (uploadError) throw new Error(`Failed to upload card image: ${uploadError.message}`);

			const { error: updateError } = await supabase
				.from('monsters')
				.update({ card_image_path: fileName, updated_at: new Date().toISOString() })
				.eq('id', monster.id);
			if (updateError) throw new Error(`Failed to update monster: ${updateError.message}`);

			monster.card_image_path = fileName;
			alert('Card image generated successfully!');
		} catch (err) {
			console.error('Error generating card:', err);
			alert(`Failed to generate card: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			generatingCard = null;
		}
	}

	async function generateAllCards() {
		const totalCards = monsters.length + events.length;
		if (!confirm(`Generate card images for all ${totalCards} cards (${monsters.length} monsters, ${events.length} events)? This may take a while.`)) {
			return;
		}

		generatingAllCards = true;
		generationProgress = { current: 0, total: totalCards };

		const errors: string[] = [];
		const successes: string[] = [];

		// Generate monster cards
		for (let i = 0; i < monsters.length; i++) {
			const monster = monsters[i];
			generationProgress.current = i + 1;

			if (!monster.id || !monster.name) {
				errors.push(`${monster.name || 'Unknown'}: Missing ID or name`);
				continue;
			}

			try {
				const artUrl = monster.art_url ?? getImageUrl(monster.image_path, monster.updated_at);
				const iconUrl = monster.icon_url ?? getIconUrl(monster.icon, monster.updated_at);
				const pngBlob = await generateMonsterCardPNG(monster, artUrl, iconUrl, monster.resolved_reward_rows);

				const fileName = `monsters/${monster.id}/card.png`;
				const file = new File([pngBlob], 'card.png', { type: 'image/png' });

				const { error: uploadError } = await gameAssetsStorage.upload(fileName, file, {
					contentType: 'image/png',
					upsert: true
				});

				if (uploadError) {
					errors.push(`${monster.name}: ${uploadError.message}`);
					continue;
				}

				const { error: updateError } = await supabase
					.from('monsters')
					.update({ card_image_path: fileName, updated_at: new Date().toISOString() })
					.eq('id', monster.id);

				if (updateError) {
					errors.push(`${monster.name}: ${updateError.message}`);
				} else {
					successes.push(monster.name);
				}
			} catch (err) {
				errors.push(`${monster.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
			}

			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Generate event cards
		for (let i = 0; i < events.length; i++) {
			const event = events[i];
			generationProgress.current = monsters.length + i + 1;

			if (!event.id || !event.name) {
				errors.push(`${event.title || 'Unknown Event'}: Missing ID or name`);
				continue;
			}

			try {
				const artUrl = event.art_url ?? getEventImageUrl(event.image_path, event.updated_at) ?? getRandomHexSpiritArt(hexSpiritArts);
				const pngBlob = await generateEventCardPNG(event, artUrl);

				const fileName = `events/${event.id}/card.png`;
				const file = new File([pngBlob], 'card.png', { type: 'image/png' });

				const { error: uploadError } = await gameAssetsStorage.upload(fileName, file, {
					contentType: 'image/png',
					upsert: true
				});

				if (uploadError) {
					errors.push(`${event.title}: ${uploadError.message}`);
					continue;
				}

				const { error: updateError } = await supabase
					.from('events')
					.update({ card_image_path: fileName, updated_at: new Date().toISOString() })
					.eq('id', event.id);

				if (updateError) {
					errors.push(`${event.title}: ${updateError.message}`);
				} else {
					successes.push(`[Event] ${event.title}`);
				}
			} catch (err) {
				errors.push(`${event.title}: ${err instanceof Error ? err.message : 'Unknown error'}`);
			}

			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		generatingAllCards = false;
		generationProgress = { current: 0, total: 0 };
		await Promise.all([loadMonsters(), loadEvents()]);

		const message = `Generated ${successes.length} card images successfully.\n${errors.length > 0 ? `\n${errors.length} errors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` : ''}`;
		alert(message);
	}

	async function exportToPDF() {
		if (!filteredMonsters.length && !events.length) {
			alert('No cards to export.');
			return;
		}

		// Combine monsters and events, sorted by order_num
		const allCards: CardItem[] = [
			...filteredMonsters.map((m) => ({ type: 'monster' as const, data: m })),
			...events.map((e) => ({ type: 'event' as const, data: e }))
		].sort((a, b) => {
			const sa = a.data.order_num ?? 0;
			const sb = b.data.order_num ?? 0;
			if (sa !== sb) return sa - sb;
			return (a.data.name ?? '').localeCompare(b.data.name ?? '');
		});

		// Two cards per page
		const chunkSize = 2;
		const chunks: CardItem[][] = [];
		for (let i = 0; i < allCards.length; i += chunkSize) {
			chunks.push(allCards.slice(i, i + chunkSize));
		}

		const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

		const tempContainer = document.createElement('div');
		tempContainer.style.position = 'absolute';
		tempContainer.style.left = '-9999px';
		tempContainer.style.width = '8.5in';
		tempContainer.style.height = '11in';
		tempContainer.style.backgroundColor = '#0f172a';
		tempContainer.style.padding = '0.25in';
		tempContainer.style.colorScheme = 'dark';
		tempContainer.style.boxSizing = 'border-box';
		tempContainer.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
		document.body.appendChild(tempContainer);

		const toDataUrl = async (url: string | null | undefined, grayscale = false): Promise<string | null> => {
			if (!url) return null;
			try {
				const response = await fetch(url.startsWith('data:') ? url : url);
				const blob = url.startsWith('data:') ? await (await fetch(url)).blob() : await response.blob();
				
				if (!grayscale) {
					return await new Promise((resolve) => {
						const reader = new FileReader();
						reader.onloadend = () => resolve(reader.result as string);
						reader.readAsDataURL(blob);
					});
				}
				
				// Convert to grayscale using canvas
				const img = new Image();
				img.crossOrigin = 'anonymous';
				const imgLoaded = new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = reject;
				});
				img.src = URL.createObjectURL(blob);
				await imgLoaded;
				
				const canvas = document.createElement('canvas');
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext('2d');
				if (!ctx) return null;
				
				ctx.filter = 'grayscale(1)';
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(img.src);
				
				return canvas.toDataURL('image/png');
			} catch (err) {
				console.warn('Failed to load image for PDF', err);
				return null;
			}
		};

		try {
			for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
				const group = chunks[pageIndex];

		const cardsHtml = await Promise.all(
			group.map(async (card) => {
				if (card.type === 'event') {
					const event = card.data;
					const artSrc = await toDataUrl(event.art_url ?? getEventImageUrl(event.image_path, event.updated_at), true);
					return `
						<div class="pdf-card pdf-card--event">
							<div class="pdf-card__left pdf-card__left--event">
								<header class="pdf-card__header">
									<div class="pdf-card__identity">
										<div class="pdf-card__title">
											<h2>${event.title}</h2>
											<div class="pdf-card__badges">
												<span class="badge badge--event">Event</span>
											</div>
										</div>
									</div>
								</header>
								<div class="pdf-card__description">
									${event.description ?? ''}
								</div>
								<div class="pdf-card__footer">Arc Spirits // Event</div>
							</div>
							<div class="pdf-card__right pdf-card__right--event" style="${artSrc ? `background-image: url('${artSrc}');` : 'background: linear-gradient(135deg, #1e3a5f, #0f172a); color: #94a3b8;'}">
								${artSrc ? '' : '<span class="placeholder">Add artwork</span>'}
							</div>
						</div>`;
				}
				
				// Monster card
				const monster = card.data;
				const stateColor = stateColors[monster.state] ?? '#94a3b8';
				const iconSrc = await toDataUrl(monster.icon_url ?? getIconUrl(monster.icon, monster.updated_at));
				const artSrc = await toDataUrl(monster.art_url ?? getImageUrl(monster.image_path, monster.updated_at), true);
				
				// Build rewards HTML from resolved_reward_rows
				const rewardRowsHtml: string[] = [];
				for (const row of (monster.resolved_reward_rows ?? [])) {
					const config = REWARD_ROW_CONFIG[row.type];
					const iconDataUrls = await Promise.all(row.icon_urls.map((url: string | null) => toDataUrl(url)));
					const validUrls = iconDataUrls.filter(Boolean);
					if (validUrls.length === 0) continue;
					
					if (row.type === 'tournament') {
						const headersHtml = `
							<div class="tournament-header-slot has-divider"><span class="placement-label">1st</span><span class="choose-label">Choose 3</span></div>
							<div class="tournament-header-slot has-divider"><span class="placement-label">2nd</span><span class="choose-label">Choose 2</span></div>
							<div class="tournament-header-slot"><span class="placement-label">3rd+</span><span class="choose-label">Choose 1</span></div>
						`;
						const iconsHtml = validUrls.slice(0, 5).map((src: string | null) => 
							`<img src="${src}" alt="reward icon" />`
						).join('');
						rewardRowsHtml.push(`<div class="pdf-card__rewards pdf-card__rewards--tournament">
							<div class="tournament-title">those that kill, rank damage</div>
							<div class="tournament-headers">${headersHtml}</div>
							<div class="tournament-icons-panel">${iconsHtml}</div>
						</div>`);
					} else {
						const label = row.label || config.label;
						const iconsHtml = validUrls.slice(0, 5).map((src: string | null) => 
							`<img src="${src}" alt="reward icon" />`
						).join('');
						rewardRowsHtml.push(`<div class="pdf-card__rewards pdf-card__rewards--row" style="--row-color: ${config.color}; --row-bg: ${config.bgColor}; --row-border: ${config.borderColor}">
							<div class="default-header"><span class="default-label" style="color: ${config.color}">${label}</span></div>
							<div class="default-icons-panel" style="background: ${config.bgColor}; border-color: ${config.borderColor}">${iconsHtml}</div>
						</div>`);
					}
				}
				const rewardsHtml = rewardRowsHtml.join('');

				return `
				<div class="pdf-card">
					<div class="pdf-card__left">
						<header class="pdf-card__header">
							<div class="pdf-card__identity">
								${iconSrc ? `<img src="${iconSrc}" alt="${monster.name} icon" class="pdf-card__icon" />` : monster.icon ? `<span class="pdf-card__icon">${monster.icon}</span>` : ''}
								<div class="pdf-card__title">
									<h2>${monster.name}</h2>
									<div class="pdf-card__badges">
										<span class="badge" style="background:${stateColors[monster.state] ?? '#94a3b8'}">${monster.state}</span>
									</div>
								</div>
							</div>
						</header>
						<div class="pdf-card__stat">
							<div class="stat-labels">
								<span>Damage</span>
								<span>Barrier</span>
							</div>
							<div class="stat-values">
								<span>${monster.damage ?? 0}</span>
								<span>${monster.barrier ?? 0}</span>
							</div>
							${monster.effects.length > 0 ? `<div class="special-effects-list">${monster.effects.map(e => `<div class="effect-line" style="--effect-color: ${e.color}"><span class="effect-name">${e.name}:</span>${e.description ? `<span class="effect-desc">${e.description}</span>` : ''}</div>`).join('')}</div>` : ''}
						</div>
						${rewardsHtml}
					</div>
					<div class="pdf-card__right" style="${artSrc ? `background-image: url('${artSrc}');` : 'background: linear-gradient(135deg, #1e293b, #0f172a); color: #94a3b8;'}">
						${artSrc ? '' : '<span class="placeholder">Add artwork</span>'}
					</div>
				</div>`;
			})
		);

				tempContainer.innerHTML = `
						<style>
							.pdf-page { width: 100%; height: 100%; display: grid; grid-template-columns: 1fr; grid-auto-rows: min-content; gap: 12px; justify-items: center; }
							.pdf-card { width: 600px; height: 400px; display: grid; grid-template-columns: 1fr 1fr; background: rgba(15,23,42,0.85); border-radius: 12px; border: 2px solid rgba(148,163,184,0.25); overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.35); }
							.pdf-card__left { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.85)); }
							.pdf-card__right { position: relative; background-size: auto 100%; background-position: center; }
							.pdf-card__header { display: flex; justify-content: space-between; align-items: center; }
							.pdf-card__identity { display: flex; gap: 12px; align-items: center; }
							.pdf-card__icon { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.05); display: inline-flex; align-items: center; justify-content: center; font-size: 32px; }
							.pdf-card__title h2 { margin: 0; font-size: 22px; color: #f8fafc; }
							.pdf-card__title small { display: block; font-weight: 600; text-transform: capitalize; }
							.pdf-card__badges { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
							.badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(148, 163, 184, 0.25); color: #0f172a; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.02em; }
							.pdf-card__stat { background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.35); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; width: 100%; }
							.pdf-card__stat .stat-labels, .pdf-card__stat .stat-values { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; align-items: end; }
							.pdf-card__stat .stat-labels span { color: #d8b4fe; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
							.pdf-card__stat .stat-values span { color: #f8fafc; font-size: 22px; font-weight: 800; }
							.pdf-card__stat .special-effects-list { margin: 8px 0 0 0; padding: 8px 0 0 0; border-top: 1px solid rgba(168,85,247,0.3); display: flex; flex-direction: column; gap: 3px; }
							.pdf-card__stat .special-effects-list .effect-line { font-size: 10px; line-height: 1.3; }
							.pdf-card__stat .special-effects-list .effect-name { color: var(--effect-color, #a78bfa); font-weight: 700; }
							.pdf-card__stat .special-effects-list .effect-desc { color: #cbd5e1; font-weight: 400; margin-left: 4px; }
							.pdf-card__rewards { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
							.pdf-card__rewards--default { display: flex; flex-direction: column; gap: 4px; }
							.pdf-card__rewards--default .default-header { display: flex; justify-content: flex-start; }
							.pdf-card__rewards--default .default-label { font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.03em; }
							.pdf-card__rewards--default .default-icons-panel { display: flex; gap: 6px; background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.4); border-radius: 8px; padding: 6px 8px; justify-content: center; }
							.pdf-card__rewards--default .default-icons-panel img { width: 42px; height: 42px; object-fit: contain; }
							.pdf-card__rewards--default .default-header + .default-icons-panel + .default-header { margin-top: 4px; }
							.pdf-card__rewards--default .default-header + .default-icons-panel + .default-header .default-label { color: #a78bfa; font-size: 10px; }
							.pdf-card__rewards--default .default-header + .default-icons-panel + .default-header + .default-icons-panel { background: rgba(167, 139, 250, 0.12); border-color: rgba(167, 139, 250, 0.4); }
							.pdf-card__rewards--default .default-header + .default-icons-panel + .default-header + .default-icons-panel img { width: 32px; height: 32px; }
							.pdf-card__rewards--tournament { display: flex; flex-direction: column; gap: 4px; }
							.pdf-card__rewards--tournament .tournament-headers { display: flex; gap: 0; }
							.pdf-card__rewards--tournament .tournament-header-slot { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0; padding: 0 4px; position: relative; }
							.pdf-card__rewards--tournament .tournament-header-slot.has-divider::after { content: ''; position: absolute; right: 0; top: 2px; bottom: 2px; width: 1px; background: rgba(251,191,36,0.4); }
							.pdf-card__rewards--tournament .placement-label { font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase; line-height: 1.2; }
							.pdf-card__rewards--tournament .choose-label { font-size: 8px; font-weight: 600; color: #d97706; text-transform: uppercase; line-height: 1.1; }
							.pdf-card__rewards--tournament .tournament-icons-panel { display: flex; gap: 6px; background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.4); border-radius: 8px; padding: 6px 8px; justify-content: center; }
							.pdf-card__rewards--tournament .tournament-icons-panel img { width: 42px; height: 42px; object-fit: contain; }
							.pdf-card__rewards--tournament .tournament-title { font-size: 10px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; margin-bottom: 2px; }
							.pdf-card__footer { margin-top: auto; color: #94a3b8; font-size: 13px; font-weight: 600; }
							.pdf-card__right .placeholder { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 600; }
							/* Event card styles */
							.pdf-card--event { border-color: rgba(59, 130, 246, 0.4); }
							.pdf-card__left--event { background: linear-gradient(180deg, rgba(15,23,42,0.95), rgba(30,58,95,0.85)); }
							.pdf-card__right--event { clip-path: polygon(30% 0, 100% 0, 100% 100%, 0 100%); }
							.badge--event { background: #3b82f6; color: white; }
							.pdf-card__description { flex: 1; color: #e2e8f0; font-size: 14px; line-height: 1.5; overflow: hidden; }
						</style>
					<div class="pdf-page">${cardsHtml.join('')}</div>
				`;

				const images = tempContainer.querySelectorAll('img');
				await Promise.all(Array.from(images).map((img) => new Promise<void>((resolve) => {
					if (img.complete) return resolve();
					img.onload = () => resolve();
					img.onerror = () => resolve();
				})));

				await new Promise((resolve) => setTimeout(resolve, 50));

				const canvas = await html2canvas(tempContainer, {
					scale: 2,
					backgroundColor: '#0f172a',
					useCORS: true,
					allowTaint: true
				});
				const imgData = canvas.toDataURL('image/png');
				if (pageIndex > 0) pdf.addPage();
				pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
			}

			pdf.save('arc-spirits-monsters.pdf');
		} catch (err) {
			console.error(err);
			alert('Failed to export monsters. Please try again.');
		} finally {
			document.body.removeChild(tempContainer);
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Monster & Event Cards</h1>
			<p>Manage monsters and event cards in a unified deck. Use order numbers to arrange cards.</p>
		</div>
		<div class="actions">
			<button class="btn" on:click={generateAllCards} disabled={generatingAllCards || (monsters.length === 0 && events.length === 0)}>
				{generatingAllCards
					? `Generating... (${generationProgress.current}/${generationProgress.total})`
					: 'Generate All Cards'}
			</button>
			<button class="btn" on:click={() => (isGalleryOpen = true)} disabled={monsters.filter((m) => m.card_image_path).length + events.filter((e) => e.card_image_path).length === 0}>
				View Gallery ({monsters.filter((m) => m.card_image_path).length + events.filter((e) => e.card_image_path).length})
			</button>
			<button class="btn" on:click={exportToPDF}>Export PDF</button>
			<button class="btn btn--effects" on:click={openEffectsManager}>⚡ Effects</button>
			<button class="btn" on:click={() => openMonsterForm()}>+ Monster</button>
			<button class="btn btn--event" on:click={() => openEventForm()}>+ Event</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search cards..." bind:value={search} />
		</label>
		<label>
			Monster State
			<select bind:value={stateFilter}>
				<option value="all">All States</option>
				<option value="tainted">Tainted</option>
				<option value="corrupt">Corrupt</option>
				<option value="fallen">Fallen</option>
				<option value="boss">Boss</option>
			</select>
		</label>
		<div class="card-counts">
			<span class="count-badge count-badge--monster">{monsters.length} Monsters</span>
			<span class="count-badge count-badge--event">{events.length} Events</span>
		</div>
	</section>

	{#if loading}
		<div class="card">Loading cards…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid card-grid--mixed">
			{#each combinedCards as card (card.type + '-' + card.data.id)}
				{#if card.type === 'monster'}
					{@const monster = card.data}
					<article class="monster-card" style={`--state-color: ${stateColors[monster.state] ?? '#94a3b8'}`}>
						<div class="monster-card__left">
							<header class="monster-card__header">
								<div class="monster-card__identity">
									{#if monster.icon_url}
										<div class="monster-card__icon-wrapper">
											<img class="monster-card__icon-image" src={monster.icon_url} alt={`${monster.name} icon`} />
										</div>
									{:else if monster.icon}
										<span class="monster-card__icon">{monster.icon}</span>
									{/if}
									<div class="monster-card__title">
										<h2>{monster.name}</h2>
										<div class="monster-badges">
											<span class="badge" style={`background:${stateColors[monster.state] ?? '#94a3b8'}`}>{monster.state}</span>
											<span class="badge badge--order">#{monster.order_num}</span>
										</div>
									</div>
								</div>
								<CardActionMenu
									onEdit={() => openMonsterForm(monster)}
									onDelete={() => deleteMonster(monster)}
									onGenerate={() => generateCardPNG(monster)}
								/>
							</header>
							<div class="monster-card__stats-row">
								<div class="monster-card__stat monster-card__stat--combo">
									<div class="stat-labels">
										<span>Damage</span>
										<span>Barrier</span>
									</div>
									<div class="stat-values">
										<span>{monster.damage ?? 0}</span>
										<span>{monster.barrier ?? 0}</span>
									</div>
									{#if monster.effects.length > 0}
										<div class="special-effects-list">
											{#each monster.effects as effect}
												<div class="effect-line" style="--effect-color: {effect.color}">
													<span class="effect-name">{effect.name}:</span>
													{#if effect.description}<span class="effect-desc">{effect.description}</span>{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
							{#if monster.resolved_reward_rows?.length}
								<div class="monster-card__rewards-multi">
									{#each monster.resolved_reward_rows as row}
										{@const config = REWARD_ROW_CONFIG[row.type]}
										{#if row.type === 'tournament'}
											<div class="reward-tournament-container" style="--row-color: {config.color}; --row-bg: {config.bgColor}; --row-border: {config.borderColor}">
												<div class="tournament-title">those that kill, rank damage</div>
												<div class="tournament-headers">
													<div class="tournament-header-slot has-divider">
														<span class="placement-label">1st</span>
														<span class="choose-label">Choose 3</span>
													</div>
													<div class="tournament-header-slot has-divider">
														<span class="placement-label">2nd</span>
														<span class="choose-label">Choose 2</span>
													</div>
													<div class="tournament-header-slot">
														<span class="placement-label">3rd+</span>
														<span class="choose-label">Choose 1</span>
													</div>
												</div>
												<div class="tournament-icons-panel">
													{#each row.icon_urls.slice(0,5) as iconUrl}
														{#if iconUrl}
															<img src={iconUrl} alt="reward icon" loading="lazy" />
														{:else}
															<span class="reward-placeholder-small"></span>
														{/if}
													{/each}
												</div>
											</div>
										{:else}
											<div class="reward-row-container" style="--row-color: {config.color}; --row-bg: {config.bgColor}; --row-border: {config.borderColor}">
												<div class="reward-row-header-label">
													<span class="reward-row-label">{row.label || config.label}</span>
												</div>
												<div class="reward-row-icons-panel">
													{#each row.icon_urls.slice(0,5) as iconUrl}
														{#if iconUrl}
															<img src={iconUrl} alt="reward icon" loading="lazy" />
														{:else}
															<span class="reward-placeholder-small"></span>
														{/if}
													{/each}
												</div>
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
						<div class="monster-card__right" style={monster.art_url ? `background-image: url('${monster.art_url}')` : ''}>
							{#if !monster.art_url}
								<span class="placeholder">Add artwork</span>
							{/if}
						</div>
					</article>
				{:else}
					{@const event = card.data}
					<article class="event-card">
						<div class="event-card__bg" style={event.art_url ? `background-image: url('${event.art_url}')` : ''}>
							{#if !event.art_url}
								<span class="placeholder">Add artwork</span>
							{/if}
						</div>
						<div class="event-card__overlay">
							<div class="event-card__content">
								<span class="event-card__order">#{event.order_num}</span>
								<h2 class="event-card__title">{event.title}</h2>
								{#if event.description}
									<p class="event-card__description">{event.description}</p>
								{/if}
								<div class="event-card__footer">Arc Spirits // Event</div>
							</div>
						</div>
						<div class="event-card__actions">
							<CardActionMenu
								onEdit={() => openEventForm(event)}
								onDelete={() => deleteEvent(event)}
							/>
						</div>
					</article>
				{/if}
			{:else}
				<div class="card empty">No cards match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showMonsterForm}
			<EditorModal
				title={editingMonster ? 'Edit Monster' : 'Create Monster'}
				description="Manage monster stats, damage, and artwork."
				size="md"
				on:close={closeMonsterForm}
			>
			<form id="monster-editor-form" class="monster-form" on:submit={submitMonsterForm}>
		<label>
			Name
			<input type="text" bind:value={formData.name} required />
		</label>
		<label>
			Damage
			<input type="number" min="0" bind:value={formData.damage} />
		</label>
			<label>
				Barrier
				<input type="number" min="0" bind:value={formData.barrier} />
			</label>
		<label>
			Order
			<input type="number" min="0" bind:value={formData.order_num} />
		</label>
		
		<!-- Reward Rows Editor -->
		<div class="reward-rows-editor">
			<div class="reward-rows-header">
				<h3>Reward Rows</h3>
				<p>Add multiple reward rows with different types (All In Combat, Losers, Winners, Tournament).</p>
				<button type="button" class="btn btn--small" on:click={addRewardRow}>+ Add Row</button>
			</div>
			
			{#if formData.reward_rows.length === 0}
				<div class="card empty">No reward rows. Click "Add Row" to create one.</div>
			{:else}
				<div class="reward-rows-list">
					{#each formData.reward_rows as row, index}
						<div class="reward-row-item" style="--row-color: {REWARD_ROW_CONFIG[row.type]?.color || '#fbbf24'}">
							<div class="reward-row-header">
								<select 
									value={row.type}
									on:change={(e) => updateRowType(index, (e.currentTarget as HTMLSelectElement).value as RewardRowType)}
								>
									<option value="all_in_combat">All In Combat Gain</option>
									<option value="all_winners">All Winners Gain</option>
									<option value="one_winner">One Winner Gains</option>
									<option value="all_losers">All Losers Gain</option>
									<option value="tournament">Tournament (1st/2nd/3rd+)</option>
								</select>
								<span class="reward-row-count">{row.icon_ids.length} icon{row.icon_ids.length !== 1 ? 's' : ''}</span>
								<button type="button" class="btn btn--small" on:click={() => startEditingRow(index)}>Edit Icons</button>
								<button type="button" class="btn btn--small danger" on:click={() => removeRewardRow(index)}>Remove</button>
							</div>
							
							{#if row.icon_ids.length > 0}
								<div class="reward-row-preview">
									{#each row.icon_ids.slice(0, 8) as iconId}
										{@const icon = availableIcons.find(i => i.id === iconId)}
										{#if icon?.url}
											<img src={icon.url} alt={icon.name} class="reward-preview-icon" />
										{/if}
									{/each}
									{#if row.icon_ids.length > 8}
										<span class="reward-preview-more">+{row.icon_ids.length - 8}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			
			<!-- Icon picker modal for editing a specific row -->
			{#if editingRowIndex !== null}
				<div class="reward-icon-picker-overlay">
					<div class="reward-icon-picker">
						<div class="reward-icon-picker-header">
							<h4>Select Icons for Row</h4>
							<button type="button" class="btn" on:click={saveRowIcons}>Done</button>
						</div>
						{#if availableIcons.length === 0}
							<div class="card empty">No icons available. Upload icons to misc_assets.</div>
						{:else}
							<div class="reward-grid">
								{#each availableIcons as icon}
									<div class="reward-tile">
										<div class="reward-thumb">
											{#if icon.url}
												<img src={icon.url} alt={icon.name} loading="lazy" />
											{:else}
												<span class="placeholder">No image</span>
											{/if}
										</div>
										<div class="reward-info">
											<div class="reward-name">{icon.name}</div>
										</div>
										<div class="reward-qty">
											<input
												type="number"
												min="0"
												value={rowIconQuantities[icon.id] || 0}
												on:input={(e) => {
													const val = Math.max(0, Math.floor(Number((e.currentTarget as HTMLInputElement).value) || 0));
													rowIconQuantities = { ...rowIconQuantities, [icon.id]: val };
												}}
											/>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		<label>
			State
			<select bind:value={formData.state}>
				<option value="tainted">Tainted</option>
				<option value="corrupt">Corrupt</option>
				<option value="fallen">Fallen</option>
				<option value="boss">Boss</option>
			</select>
		</label>
		
		<!-- Special Effects -->
		<div class="special-effects-picker">
			<div class="special-effects-header">
				<h3>Special Effects</h3>
				<span class="effects-count">{selectedEffectIds.length} selected</span>
			</div>
			
			<!-- Selected effects with order controls -->
			{#if selectedEffectIds.length > 0}
				<div class="selected-effects-list">
					{#each selectedEffectIds as effectId, index}
						{@const effect = specialEffects.find(e => e.id === effectId)}
						{#if effect}
							<div class="selected-effect-item" style="--effect-color: {effect.color}">
								<div class="effect-order-controls">
									<button type="button" class="order-btn" on:click={() => moveEffectUp(index)} disabled={index === 0}>↑</button>
									<button type="button" class="order-btn" on:click={() => moveEffectDown(index)} disabled={index === selectedEffectIds.length - 1}>↓</button>
								</div>
								<span class="effect-order-num">{index + 1}</span>
								{#if effect.icon}<span class="effect-icon">{effect.icon}</span>{/if}
								<span class="effect-name">{effect.name}</span>
								<button type="button" class="remove-effect-btn" on:click={() => removeEffect(effectId)}>×</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
			
			<!-- Available effects to add -->
			{#if specialEffects.length === 0}
				<div class="card empty">No special effects available. Create some in the Effects Manager.</div>
			{:else}
				<div class="effects-grid">
					{#each specialEffects.filter(e => !selectedEffectIds.includes(e.id)) as effect}
						<button
							type="button"
							class="effect-chip"
							style="--effect-color: {effect.color}"
							on:click={() => toggleEffect(effect.id)}
						>
							{#if effect.icon}<span class="effect-icon">{effect.icon}</span>{/if}
							<span class="effect-name">{effect.name}</span>
							<span class="add-icon">+</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		
				<label>
					Icon
					<input type="text" bind:value={formData.icon} placeholder="Emoji or icon path" />
					<small style="color: #94a3b8; font-size: 0.75rem;">Use upload button below to upload image</small>
				</label>
				{#if editingMonster}
					<div class="icon-actions">
						<label class="upload-button">
						<input
							type="file"
							accept="image/*"
							on:change={(event) => editingMonster && handleFileChange(editingMonster.id, event, 'icon')}
							aria-label={editingMonster ? `Upload icon for ${editingMonster.name}` : ''}
						/>
							<span>{uploadingIconId === editingMonster?.id ? 'Uploading…' : 'Upload Icon'}</span>
						</label>
						<button
							class="btn danger"
							type="button"
							on:click={() => editingMonster && removeIcon(editingMonster.id)}
							disabled={removingIconId === editingMonster?.id || !isIconImage(editingMonster?.icon)}
						>
							{removingIconId === editingMonster?.id ? 'Removing…' : 'Remove Icon'}
						</button>
					</div>
				{/if}

				<label>
					Artwork Path
					<input type="text" bind:value={formData.image_path} placeholder="monsters/<id>/art.png" />
				</label>
				{#if editingMonster}
					<div class="icon-actions">
						<label class="upload-button">
						<input
							type="file"
							accept="image/*"
							on:change={(event) => editingMonster && handleFileChange(editingMonster.id, event, 'art')}
							aria-label={editingMonster ? `Upload art for ${editingMonster.name}` : ''}
						/>
							<span>{uploadingArtId === editingMonster?.id ? 'Uploading…' : 'Upload Artwork'}</span>
						</label>
						<button
							class="btn danger"
							type="button"
							on:click={() => editingMonster && removeArt(editingMonster.id)}
							disabled={removingArtId === editingMonster?.id || !editingMonster.image_path}
						>
							{removingArtId === editingMonster?.id ? 'Removing…' : 'Remove Artwork'}
						</button>
					</div>
				{/if}
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="monster-editor-form">Save</button>
			<button class="btn" type="button" on:click={closeMonsterForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}

	{#if showEventForm}
		<EditorModal
			title={editingEvent ? 'Edit Event' : 'Create Event'}
			description="Manage event card title, description, and artwork."
			size="md"
			on:close={closeEventForm}
		>
			<form id="event-editor-form" class="event-form" on:submit={submitEventForm}>
				<label>
					Name (Internal)
					<input type="text" bind:value={eventFormData.name} required placeholder="Internal reference name" />
				</label>
				<label>
					Title (Displayed)
					<input type="text" bind:value={eventFormData.title} required placeholder="Card title" />
				</label>
				<label class="full-width">
					Description
					<textarea bind:value={eventFormData.description} rows="4" placeholder="Event description text..."></textarea>
				</label>
				<label>
					Order
					<input type="number" min="0" bind:value={eventFormData.order_num} />
				</label>
				<label>
					Artwork Path
					<input type="text" bind:value={eventFormData.image_path} placeholder="events/<id>/art.png" />
				</label>
				{#if editingEvent}
					<div class="icon-actions">
						<label class="upload-button">
							<input
								type="file"
								accept="image/*"
								on:change={(e) => editingEvent && handleEventFileChange(editingEvent.id, e)}
								aria-label={editingEvent ? `Upload art for ${editingEvent.name}` : ''}
							/>
							<span>{uploadingEventArtId === editingEvent?.id ? 'Uploading…' : 'Upload Artwork'}</span>
						</label>
						<button
							class="btn danger"
							type="button"
							on:click={() => editingEvent && removeEventArt(editingEvent.id)}
							disabled={removingEventArtId === editingEvent?.id || !editingEvent.image_path}
						>
							{removingEventArtId === editingEvent?.id ? 'Removing…' : 'Remove Artwork'}
						</button>
					</div>
				{/if}
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="event-editor-form">Save</button>
				<button class="btn" type="button" on:click={closeEventForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}

	{#if showEffectsManager}
		<EditorModal
			title="Special Effects Manager"
			description="Create and manage special effects that can be applied to monsters."
			size="md"
			on:close={closeEffectsManager}
		>
			<div class="effects-manager">
				<div class="effects-form">
					<h4>{editingEffect ? 'Edit Effect' : 'Create New Effect'}</h4>
					<div class="effects-form-grid">
						<label>
							Name
							<input type="text" bind:value={effectFormData.name} placeholder="Effect name" />
						</label>
						<label>
							Icon (emoji)
							<input type="text" bind:value={effectFormData.icon} placeholder="⚡" />
						</label>
						<label>
							Color
							<input type="color" bind:value={effectFormData.color} />
						</label>
						<label class="full-width">
							Description
							<textarea bind:value={effectFormData.description} placeholder="Optional description" rows="2"></textarea>
						</label>
					</div>
					<div class="effects-form-actions">
						<button type="button" class="btn btn--primary" on:click={saveEffect}>
							{editingEffect ? 'Update' : 'Create'}
						</button>
						{#if editingEffect}
							<button type="button" class="btn" on:click={() => { editingEffect = null; effectFormData = { name: '', description: '', icon: '', color: '#a78bfa' }; }}>
								Cancel Edit
							</button>
						{/if}
					</div>
				</div>

				<div class="effects-list">
					<h4>Existing Effects</h4>
					{#if specialEffects.length === 0}
						<div class="card empty">No special effects created yet.</div>
					{:else}
						<div class="effects-list-grid">
							{#each specialEffects as effect}
								<div class="effect-item" style="--effect-color: {effect.color}">
									<div class="effect-item-info">
										{#if effect.icon}<span class="effect-icon">{effect.icon}</span>{/if}
										<span class="effect-name">{effect.name}</span>
										{#if effect.description}
											<span class="effect-description">{effect.description}</span>
										{/if}
									</div>
									<div class="effect-item-actions">
										<button type="button" class="btn btn--small" on:click={() => editEffect(effect)}>Edit</button>
										<button type="button" class="btn btn--small danger" on:click={() => deleteEffect(effect)}>Delete</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn" type="button" on:click={closeEffectsManager}>Close</button>
			</div>
		</EditorModal>
	{/if}
</section>

<MonsterCardGallery bind:isOpen={isGalleryOpen} {monsters} {events} />

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.page__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.filters {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.filters label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 600;
		color: #cbd5f5;
	}

	.card-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		justify-content: center;
		align-items: stretch;
	}

	.card {
	background: linear-gradient(135deg, #0b0b14, #120f1f);
	border-radius: 12px;
	padding: 1rem;
	border: 1px solid rgba(168, 85, 247, 0.35);
	box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
}

	.card.error {
		border-color: #ef4444;
		color: #fecdd3;
	}

	.card.empty {
		text-align: center;
		color: #94a3b8;
	}

	.monster-card {
	display: grid;
	grid-template-columns: 1fr 1fr;
	width: 600px;
	height: 400px;
	flex: 0 0 auto;
	background: linear-gradient(160deg, #0c0b13 0%, #100a1a 60%, #0c0b13 100%);
	border-radius: 12px;
	border: 2px solid rgba(168, 85, 247, 0.35);
	overflow: hidden;
	box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
}


	.monster-card__left {
	padding: 20px 24px;
	display: grid;
	grid-template-rows: auto auto 1fr auto;
	gap: 16px;
	background: linear-gradient(180deg, rgba(12,11,19,0.95), rgba(12,11,19,0.75));
}


	.monster-card__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.monster-card__identity {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.monster-card__icon-wrapper {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.05);
		display: grid;
		place-items: center;
	}

	.monster-card__icon-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.monster-card__icon {
		font-size: 32px;
	}

	.monster-card__title h2 {
		margin: 0;
		font-size: 22px;
		color: #f8fafc;
	}

	.monster-badges {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.25rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: rgba(148, 163, 184, 0.25);
		color: #0f172a;
		font-weight: 700;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	
	.monster-card__stats-row {
		display: grid;
		grid-template-columns: 1fr;
	}

	.monster-card__stat {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.85rem 1rem;
		background: rgba(168, 85, 247, 0.12);
		border: 1px solid rgba(168, 85, 247, 0.35);
		border-radius: 10px;
	}

	.monster-card__stat--combo .stat-labels,
	.monster-card__stat--combo .stat-values {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
		align-items: end;
	}

	.monster-card__stat--combo .stat-labels span {
		font-size: 0.78rem;
		color: #d8b4fe;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.monster-card__stat--combo .stat-values span {
		font-size: 1.3rem;
		font-weight: 800;
		color: #f5f3ff;
	}

	.monster-card__stat--combo .special-effects-list {
		margin: 0.5rem 0 0 0;
		padding: 0.5rem 0 0 0;
		border-top: 1px solid rgba(168, 85, 247, 0.3);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.monster-card__stat--combo .special-effects-list .effect-line {
		font-size: 0.7rem;
		line-height: 1.3;
	}

	.monster-card__stat--combo .special-effects-list .effect-name {
		color: var(--effect-color, #a78bfa);
		font-weight: 700;
	}

	.monster-card__stat--combo .special-effects-list .effect-desc {
		color: #cbd5e1;
		font-weight: 400;
		margin-left: 0.25rem;
	}

	.monster-card__stat--combo .special-conditions {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(168, 85, 247, 0.3);
		font-size: 0.75rem;
		color: #fbbf24;
		font-weight: 600;
		font-style: italic;
		text-align: center;
	}

	.monster-card__footer {
		margin-top: auto;
		color: #94a3b8;
		font-size: 13px;
		font-weight: 600;
	}

	.monster-card__rewards {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.35rem;
	}

	/* Tournament style rewards */
	.reward-tournament-container {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.tournament-title {
		font-size: 0.65rem;
		font-weight: 700;
		color: #fbbf24;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: left;
		margin-bottom: 0.15rem;
	}

	.tournament-headers {
		display: flex;
		gap: 0;
	}

	.tournament-header-slot {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		padding: 0 4px;
		position: relative;
	}

	.tournament-header-slot.has-divider::after {
		content: '';
		position: absolute;
		right: 0;
		top: 2px;
		bottom: 2px;
		width: 1px;
		background: rgba(251, 191, 36, 0.4);
	}

	.tournament-headers .placement-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #fbbf24;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		line-height: 1.2;
	}

	.tournament-headers .choose-label {
		font-size: 0.55rem;
		font-weight: 600;
		color: #d97706;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		line-height: 1.1;
	}

	.tournament-icons-panel {
		display: flex;
		gap: 6px;
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.4);
		border-radius: 8px;
		padding: 6px 8px;
		justify-content: center;
	}

	.tournament-icons-panel img {
		width: 42px;
		height: 42px;
		object-fit: contain;
	}

	.reward-placeholder-small {
		width: 42px;
		height: 42px;
	}

	.monster-card__rewards.tournament {
		margin-top: 0.5rem;
	}

	/* Default style rewards (All Fighters Gain) */
	.reward-default-container {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.default-header {
		display: flex;
		justify-content: flex-start;
	}

	.default-header .default-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #fbbf24;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.default-icons-panel {
		display: flex;
		gap: 6px;
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.4);
		border-radius: 8px;
		padding: 6px 8px;
		justify-content: center;
	}

	.default-icons-panel img {
		width: 42px;
		height: 42px;
		object-fit: contain;
	}

	/* Multiple reward rows display */
	.monster-card__rewards-multi {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.reward-row-container {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.reward-row-header-label {
		display: flex;
		justify-content: flex-start;
	}

	.reward-row-label {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--row-color, #fbbf24);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.reward-row-icons-panel {
		display: flex;
		gap: 4px;
		background: var(--row-bg, rgba(251, 191, 36, 0.12));
		border: 1px solid var(--row-border, rgba(251, 191, 36, 0.4));
		border-radius: 6px;
		padding: 4px 6px;
		justify-content: center;
	}

	.reward-row-icons-panel img {
		width: 32px;
		height: 32px;
		object-fit: contain;
	}

	/* Reward rows form editor */
	.reward-rows-editor {
		grid-column: 1 / -1;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.reward-rows-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.reward-rows-header h3 {
		margin: 0;
		font-size: 1rem;
		color: #e2e8f0;
	}

	.reward-rows-header p {
		flex: 1;
		margin: 0;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.reward-rows-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.reward-row-item {
		background: rgba(30, 41, 59, 0.6);
		border-radius: 8px;
		padding: 0.75rem;
		border-left: 3px solid var(--row-color, #fbbf24);
	}

	.reward-row-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.reward-row-header select {
		padding: 0.4rem 0.6rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.reward-row-count {
		font-size: 0.75rem;
		color: #94a3b8;
		margin-left: auto;
	}

	.reward-row-preview {
		display: flex;
		gap: 4px;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.reward-preview-icon {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		object-fit: contain;
		background: rgba(0, 0, 0, 0.2);
	}

	.reward-preview-more {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		background: rgba(148, 163, 184, 0.2);
		color: #94a3b8;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.btn--small {
		padding: 0.35rem 0.6rem;
		font-size: 0.8rem;
	}

	/* Icon picker overlay */
	.reward-icon-picker-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.reward-icon-picker {
		background: #1e293b;
		border-radius: 12px;
		padding: 1.25rem;
		max-width: 90vw;
		max-height: 80vh;
		overflow-y: auto;
		width: 600px;
	}

	.reward-icon-picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.reward-icon-picker-header h4 {
		margin: 0;
		color: #e2e8f0;
	}

	.monster-card__right {
		position: relative;
		background-size: auto 100%;
		background-position: center;
		background-repeat: no-repeat;
		background-color: rgba(15, 23, 42, 0.9);
		display: grid;
		place-items: center;
		filter: grayscale(1);
	}

	.monster-card__right .placeholder {
		color: #94a3b8;
		font-weight: 600;
	}

	.btn {
		background: #1d4ed8;
		color: #f8fafc;
		border: none;
		padding: 0.6rem 1rem;
		border-radius: 10px;
		font-weight: 700;
		cursor: pointer;
		transition: transform 120ms ease, filter 120ms ease;
	}

	.btn:hover:enabled { filter: brightness(1.05); transform: translateY(-1px); }
	.btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn.danger { background: #dc2626; }
	.btn.btn--primary { background: #16a34a; }

	.monster-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.monster-form label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 600;
		color: #cbd5f5;
	}

	.monster-form input,
	.monster-form select {
		padding: 0.55rem 0.65rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
	}

	.icon-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.upload-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(148, 163, 184, 0.15);
		color: #e2e8f0;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		cursor: pointer;
		border: 1px dashed rgba(148, 163, 184, 0.4);
	}

	.upload-button input { display: none; }

	.modal-footer-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.reward-picker {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}
	.reward-picker__header h3 {
		margin: 0;
		color: #e5e7eb;
	}
	.reward-picker__header p {
		margin: 0;
		color: #9ca3af;
		font-size: 0.9rem;
	}
	.reward-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}
	.reward-tile {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		padding: 0.6rem;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.5rem;
		align-items: center;
	}
	.reward-thumb {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.04);
		display: grid;
		place-items: center;
		border: 1px solid rgba(168, 85, 247, 0.35);
	}
	.reward-thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.reward-thumb .placeholder {
		font-size: 0.75rem;
		color: #94a3b8;
	}
	.reward-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		overflow: hidden;
	}
	.reward-name {
		color: #e5e7eb;
		font-weight: 700;
		font-size: 0.95rem;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}
	.reward-id {
		color: #9ca3af;
		font-size: 0.75rem;
		word-break: break-all;
	}
	.reward-qty input {
		width: 70px;
		padding: 0.45rem 0.55rem;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.35);
		border-radius: 8px;
		color: #f8fafc;
	}

	/* Card counts and event button */
	.card-counts {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.count-badge {
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.count-badge--monster {
		background: rgba(168, 85, 247, 0.2);
		color: #d8b4fe;
		border: 1px solid rgba(168, 85, 247, 0.35);
	}

	.count-badge--event {
		background: rgba(59, 130, 246, 0.2);
		color: #93c5fd;
		border: 1px solid rgba(59, 130, 246, 0.35);
	}

	.btn--event {
		background: #2563eb;
	}

	.badge--order {
		background: rgba(100, 116, 139, 0.4) !important;
		color: #e2e8f0 !important;
		font-size: 0.65rem;
	}

	/* Mixed card grid */
	.card-grid--mixed {
		align-items: start;
	}

	.event-card {
		position: relative;
		width: 600px;
		height: 400px;
		flex: 0 0 auto;
		border-radius: 12px;
		border: 2px solid rgba(59, 130, 246, 0.35);
		overflow: hidden;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
	}

	.event-card__bg {
		position: absolute;
		inset: 0;
		background-size: 130%;
		background-position: center right;
		background-repeat: no-repeat;
		background-color: rgba(15, 23, 42, 0.9);
		display: grid;
		place-items: center;
		filter: grayscale(1);
	}

	.event-card__bg .placeholder {
		color: #94a3b8;
		font-weight: 600;
		margin-left: 40%;
	}

	.event-card__overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, 
			rgba(12, 11, 19, 0.98) 0%,
			rgba(12, 11, 19, 0.95) 35%,
			rgba(12, 11, 19, 0.85) 45%,
			rgba(12, 11, 19, 0.4) 55%,
			transparent 65%
		);
		clip-path: polygon(0 0, 75% 0, 45% 100%, 0 100%);
	}

	.event-card__content {
		position: relative;
		height: 100%;
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 55%;
	}

	.event-card__actions {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 10;
	}

	.event-card__order {
		display: inline-block;
		width: fit-content;
		background: rgba(59, 130, 246, 0.3);
		color: #93c5fd;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border: 1px solid rgba(59, 130, 246, 0.4);
	}

	.event-card__title {
		margin: 0;
		font-size: 1.5rem;
		color: #f8fafc;
		font-weight: 800;
		line-height: 1.2;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.event-card__description {
		margin: 0;
		font-size: 0.9rem;
		color: #cbd5e1;
		line-height: 1.5;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}

	.event-card__footer {
		margin-top: auto;
		color: #64748b;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Event form */
	.event-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.event-form label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 600;
		color: #cbd5f5;
	}

	.event-form label.full-width {
		grid-column: 1 / -1;
	}

	.event-form input,
	.event-form textarea {
		padding: 0.55rem 0.65rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-family: inherit;
		resize: vertical;
	}

	/* Special Effects Styles */
	.btn--effects {
		background: linear-gradient(135deg, #7c3aed, #a855f7);
	}

	.special-effects-picker {
		grid-column: 1 / -1;
		background: rgba(124, 58, 237, 0.1);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid rgba(124, 58, 237, 0.3);
	}

	.special-effects-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.special-effects-header h3 {
		margin: 0;
		font-size: 1rem;
		color: #e2e8f0;
	}

	.effects-count {
		font-size: 0.75rem;
		color: #a78bfa;
		background: rgba(124, 58, 237, 0.2);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.effects-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.effect-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		border-radius: 20px;
		border: 2px solid var(--effect-color, #a78bfa);
		background: rgba(15, 23, 42, 0.6);
		color: var(--effect-color, #a78bfa);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.effect-chip:hover {
		background: rgba(124, 58, 237, 0.15);
	}

	.effect-chip.selected {
		background: var(--effect-color, #a78bfa);
		color: #0f172a;
	}

	.effect-chip .add-icon {
		margin-left: 0.25rem;
		opacity: 0.6;
	}

	.effect-icon {
		font-size: 1rem;
	}

	/* Selected effects list with ordering */
	.selected-effects-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(124, 58, 237, 0.2);
	}

	.selected-effect-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: rgba(30, 41, 59, 0.6);
		border-radius: 8px;
		border-left: 3px solid var(--effect-color, #a78bfa);
	}

	.effect-order-controls {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.order-btn {
		padding: 0;
		width: 20px;
		height: 16px;
		font-size: 10px;
		line-height: 1;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.6);
		color: #94a3b8;
		border-radius: 3px;
		cursor: pointer;
	}

	.order-btn:hover:not(:disabled) {
		background: rgba(124, 58, 237, 0.3);
		color: #e2e8f0;
	}

	.order-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.effect-order-num {
		font-size: 0.7rem;
		color: #64748b;
		font-weight: 700;
		min-width: 1rem;
		text-align: center;
	}

	.selected-effect-item .effect-name {
		flex: 1;
		color: var(--effect-color, #a78bfa);
		font-weight: 600;
		font-size: 0.85rem;
	}

	.remove-effect-btn {
		padding: 0.1rem 0.4rem;
		font-size: 1rem;
		line-height: 1;
		border: none;
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		border-radius: 4px;
		cursor: pointer;
	}

	.remove-effect-btn:hover {
		background: rgba(239, 68, 68, 0.4);
	}

	/* Effects Manager Modal */
	.effects-manager {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.effects-form {
		background: rgba(15, 23, 42, 0.4);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.effects-form h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.95rem;
		color: #e2e8f0;
	}

	.effects-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 80px;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.effects-form-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 600;
		color: #cbd5f5;
		font-size: 0.85rem;
	}

	.effects-form-grid label.full-width {
		grid-column: 1 / -1;
	}

	.effects-form-grid input,
	.effects-form-grid textarea {
		padding: 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-family: inherit;
	}

	.effects-form-grid input[type="color"] {
		padding: 0.25rem;
		height: 38px;
	}

	.effects-form-actions {
		display: flex;
		gap: 0.5rem;
	}

	.effects-list h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.95rem;
		color: #e2e8f0;
	}

	.effects-list-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(30, 41, 59, 0.6);
		border-radius: 8px;
		border-left: 3px solid var(--effect-color, #a78bfa);
	}

	.effect-item-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.effect-item-info .effect-icon {
		font-size: 1.25rem;
	}

	.effect-item-info .effect-name {
		font-weight: 600;
		color: #f8fafc;
	}

	.effect-item-info .effect-description {
		font-size: 0.8rem;
		color: #94a3b8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.effect-item-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

</style>
