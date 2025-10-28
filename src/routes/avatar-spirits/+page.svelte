<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
import type { AvatarSpiritRow, OriginRow } from '$lib/types/gameData';

type AvatarSpirit = AvatarSpiritRow;
type OriginOption = Pick<OriginRow, 'id' | 'name'>;

let spirits: AvatarSpirit[] = [];
let origins: OriginOption[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';
	let originFilter = 'all';

	let showSpiritForm = false;
	let editingSpirit: AvatarSpirit | null = null;
let spiritForm: { name: string; origin_id: string | null } = {
	name: '',
	origin_id: null
};

	onMount(async () => {
		await loadOrigins();
		await loadSpirits();
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

	async function loadSpirits() {
		loading = true;
		error = null;
		const { data, error: fetchError } = await supabase
			.from('avatar_spirits')
			.select('*')
			.order('created_at', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			loading = false;
			return;
		}
		spirits = data ?? [];
		loading = false;
	}

	function openSpiritForm(spirit?: AvatarSpirit) {
		if (spirit) {
			editingSpirit = spirit;
			spiritForm = { ...spirit };
		} else {
			editingSpirit = null;
			spiritForm = {
				name: '',
				origin_id: origins[0]?.id ?? null
			};
		}
		showSpiritForm = true;
	}

function closeSpiritForm() {
	showSpiritForm = false;
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
		closeSpiritForm();
	}
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		closeSpiritForm();
	}
}

async function handleSubmit(event: Event) {
	event.preventDefault();
	await saveSpirit();
}

	async function saveSpirit() {
		if (!spiritForm.name?.trim()) {
			alert('Avatar Spirit name is required.');
			return;
		}
		if (!spiritForm.origin_id) {
			alert('Select an origin for the spirit.');
			return;
		}

		const payload = {
			name: spiritForm.name.trim(),
			origin_id: spiritForm.origin_id
		};

		let saveError: string | null = null;
		if (editingSpirit) {
			const { error: updateError } = await supabase
				.from('avatar_spirits')
				.update({ ...payload, updated_at: new Date().toISOString() })
				.eq('id', editingSpirit.id);
			saveError = updateError?.message ?? null;
		} else {
			const { error: insertError } = await supabase.from('avatar_spirits').insert(payload);
			saveError = insertError?.message ?? null;
		}

		if (saveError) {
			alert(`Failed to save avatar spirit: ${saveError}`);
			return;
		}

		closeSpiritForm();
		await loadSpirits();
	}

	async function deleteSpirit(spirit: AvatarSpirit) {
		if (!confirm(`Delete avatar spirit "${spirit.name}"?`)) return;
		const { error: deleteError } = await supabase
			.from('avatar_spirits')
			.delete()
			.eq('id', spirit.id);
		if (deleteError) {
			alert(`Failed to delete spirit: ${deleteError.message}`);
			return;
		}
		await loadSpirits();
	}

	const originName = (originId: string) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unknown Origin';

	$: filteredSpirits = spirits.filter((spirit) => {
		if (originFilter !== 'all' && spirit.origin_id !== originFilter) return false;
		if (search.trim()) {
			const term = search.trim().toLowerCase();
			return (
				spirit.name.toLowerCase().includes(term) ||
				originName(spirit.origin_id).toLowerCase().includes(term)
			);
		}
		return true;
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Avatar Spirits</h1>
			<p>Track the exceptional spirits tied to each origin.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openSpiritForm()}>Create Avatar Spirit</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search spirits" bind:value={search} />
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
		<div class="card">Loading avatar spirits…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredSpirits as spirit (spirit.id)}
				<article class="card spirit-card">
					<header>
						<h2>{spirit.name}</h2>
						<div class="card-actions">
							<button class="btn" onclick={() => openSpiritForm(spirit)}>Edit</button>
							<button class="btn danger" onclick={() => deleteSpirit(spirit)}>Delete</button>
						</div>
					</header>
					<p class="meta">{originName(spirit.origin_id)}</p>
				</article>
			{:else}
				<div class="card empty">No avatar spirits match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showSpiritForm}
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			onclick={handleBackdropClick}
			onkeydown={handleBackdropKey}
		>
			<form
				class="modal"
				onsubmit={handleSubmit}
			>
				<h2>{editingSpirit ? 'Edit Avatar Spirit' : 'Create Avatar Spirit'}</h2>
				<label>
					Name
					<input type="text" bind:value={spiritForm.name} required />
				</label>
				<label>
					Origin
					<select bind:value={spiritForm.origin_id} required>
						<option value="">Select origin</option>
						{#each origins as origin}
							<option value={origin.id}>{origin.name}</option>
						{/each}
					</select>
				</label>
				<div class="modal__actions">
					<button class="btn" type="submit">Save</button>
					<button class="btn" type="button" onclick={closeSpiritForm}>Cancel</button>
				</div>
			</form>
		</div>
	{/if}
</section>

<style>
	.spirit-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.spirit-card h2 {
		margin: 0;
	}

	.spirit-card .meta {
		margin-top: 0.35rem;
		color: #a5b4fc;
		font-weight: 500;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
