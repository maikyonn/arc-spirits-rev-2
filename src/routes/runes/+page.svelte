<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
import type { OriginRow, RuneRow } from '$lib/types/gameData';

type Rune = RuneRow;
type OriginOption = Pick<OriginRow, 'id' | 'name'>;

let runes: Rune[] = [];
let origins: OriginOption[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';
	let originFilter = 'all';

	let showRuneForm = false;
	let editingRune: Rune | null = null;
	let runeForm: Partial<Rune> = {
		name: '',
		benefit: '',
		origin_id: null
	};

	onMount(async () => {
		await Promise.all([loadOrigins(), loadRunes()]);
	});

	async function loadOrigins() {
		const { data, error: fetchError } = await supabase
			.from('origins')
			.select('id, name')
			.order('position', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		origins = data ?? [];
	}

	async function loadRunes() {
		loading = true;
		error = null;
		const { data, error: fetchError } = await supabase
			.from('runes')
			.select('*')
			.order('created_at', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			loading = false;
			return;
		}
		runes = data ?? [];
		loading = false;
	}

	function openRuneForm(rune?: Rune) {
		if (rune) {
			editingRune = rune;
			runeForm = { ...rune };
		} else {
			editingRune = null;
			runeForm = {
				name: '',
				benefit: '',
				origin_id: origins[0]?.id ?? null
			};
		}
		showRuneForm = true;
	}

function closeRuneForm() {
	showRuneForm = false;
}

function handleBackdropKey(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	const isInput =
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement;
	if (isInput) return;
	if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		closeRuneForm();
	}
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		closeRuneForm();
	}
}

async function handleSubmit(event: Event) {
	event.preventDefault();
	await saveRune();
}

	async function saveRune() {
		if (!runeForm.name?.trim()) {
			alert('Rune name is required.');
			return;
		}
		if (!runeForm.origin_id) {
			alert('Select an origin for the rune.');
			return;
		}
		const payload = {
			name: runeForm.name.trim(),
			benefit: runeForm.benefit?.trim() ?? '',
			origin_id: runeForm.origin_id
		};

		let saveError: string | null = null;
		if (editingRune) {
			const { error: updateError } = await supabase
				.from('runes')
				.update({ ...payload, updated_at: new Date().toISOString() })
				.eq('id', editingRune.id);
			saveError = updateError?.message ?? null;
		} else {
			const { error: insertError } = await supabase.from('runes').insert(payload);
			saveError = insertError?.message ?? null;
		}

		if (saveError) {
			alert(`Failed to save rune: ${saveError}`);
			return;
		}

		closeRuneForm();
		await loadRunes();
	}

	async function deleteRune(rune: Rune) {
		if (!confirm(`Delete rune "${rune.name}"? Artifacts referencing it will break.`)) return;
		const { error: deleteError } = await supabase.from('runes').delete().eq('id', rune.id);
		if (deleteError) {
			alert(`Failed to delete rune: ${deleteError.message}`);
			return;
		}
		await loadRunes();
	}

	const originName = (originId: string | null) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unassigned';

	$: filteredRunes = runes.filter((rune) => {
		if (originFilter !== 'all' && rune.origin_id !== originFilter) return false;
		if (search.trim()) {
			const term = search.trim().toLowerCase();
			if (
				!rune.name.toLowerCase().includes(term) &&
				!rune.benefit.toLowerCase().includes(term) &&
				!originName(rune.origin_id).toLowerCase().includes(term)
			) {
				return false;
			}
		}
		return true;
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Runes</h1>
			<p>Runes are the crafting components consumed by artifacts.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openRuneForm()}>Create Rune</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search runes" bind:value={search} />
		</label>
		<label>
			Origin
			<select bind:value={originFilter}>
				<option value="all">All origins</option>
				{#each origins as origin}
					<option value={origin.id}>{origin.name}</option>
				{/each}
			</select>
		</label>
	</section>

	{#if loading}
		<div class="card">Loading runes…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredRunes as rune (rune.id)}
				<article class="card rune-card">
					<header>
						<h2>{rune.name}</h2>
						<div class="card-actions">
							<button class="btn" onclick={() => openRuneForm(rune)}>Edit</button>
							<button class="btn danger" onclick={() => deleteRune(rune)}>Delete</button>
						</div>
					</header>
					<p class="meta">{originName(rune.origin_id)}</p>
					{#if rune.benefit}
						<p class="muted">{rune.benefit}</p>
					{/if}
				</article>
			{:else}
				<div class="card empty">No runes match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showRuneForm}
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			onclick={handleBackdropClick}
			onkeydown={handleBackdropKey}
		>
			<form class="modal" onsubmit={handleSubmit}>
				<h2>{editingRune ? 'Edit Rune' : 'Create Rune'}</h2>
				<label>
					Name
					<input type="text" bind:value={runeForm.name} required />
				</label>
				<label>
					Origin
					<select bind:value={runeForm.origin_id} required>
						<option value="">Select an origin</option>
						{#each origins as origin}
							<option value={origin.id}>{origin.name}</option>
						{/each}
					</select>
				</label>
				<label>
					Benefit (optional)
					<textarea rows="3" bind:value={runeForm.benefit} placeholder="Describe rune effects"></textarea>
				</label>
				<div class="modal__actions">
					<button class="btn" type="submit">Save</button>
					<button class="btn" type="button" onclick={closeRuneForm}>Cancel</button>
				</div>
			</form>
		</div>
	{/if}
</section>

<style>
	.rune-card header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.rune-card h2 {
		margin: 0;
	}

	.rune-card .meta {
		margin: 0.4rem 0;
		color: #a5b4fc;
		font-weight: 500;
	}

	.rune-card .muted {
		margin: 0.4rem 0 0;
		color: #cbd5f5;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
