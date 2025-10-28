<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
import type { ArtifactRecipeEntry, ArtifactRow, OriginRow, RuneRow } from '$lib/types/gameData';

type Artifact = ArtifactRow;
type OriginOption = Pick<OriginRow, 'id' | 'name'>;
type RuneOption = Pick<RuneRow, 'id' | 'name' | 'origin_id'>;

let artifacts: Artifact[] = [];
let origins: OriginOption[] = [];
let runes: RuneOption[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';
	let originFilter = 'all';

	let showArtifactForm = false;
	let editingArtifact: Artifact | null = null;
	let artifactForm: Partial<Artifact> & { recipe_box: ArtifactRecipeEntry[] } = {
		name: '',
		benefit: '',
		origin_id: '',
		recipe_box: []
	};

	onMount(async () => {
		await Promise.all([loadOrigins(), loadRunes()]);
		await loadArtifacts();
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
		const { data, error: fetchError } = await supabase
			.from('runes')
			.select('id, name, origin_id')
			.order('name', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		runes = data ?? [];
	}

	async function loadArtifacts() {
		loading = true;
		error = null;
		const { data, error: fetchError } = await supabase
			.from('artifacts')
			.select('*')
			.order('created_at', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			loading = false;
			return;
		}
		artifacts =
			data?.map((artifact) => ({
				...artifact,
				recipe_box: Array.isArray(artifact.recipe_box) ? artifact.recipe_box : []
			})) ?? [];
		loading = false;
	}

	function openArtifactForm(artifact?: Artifact) {
		if (artifact) {
			editingArtifact = artifact;
			artifactForm = {
				...artifact,
				recipe_box: artifact.recipe_box ? artifact.recipe_box.map((entry) => ({ ...entry })) : []
			};
		} else {
			editingArtifact = null;
			artifactForm = {
				name: '',
				benefit: '',
				origin_id: origins[0]?.id ?? '',
				recipe_box: []
			};
		}
		showArtifactForm = true;
	}

	function closeArtifactForm() {
		showArtifactForm = false;
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
			closeArtifactForm();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeArtifactForm();
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		await saveArtifact();
	}

	function addRecipeEntry() {
		if (!runes.length) {
			alert('Create at least one rune before adding recipes.');
			return;
		}
		const defaultRune = artifactForm.origin_id
			? runes.find((rune) => rune.origin_id === artifactForm.origin_id) ?? runes[0]
			: runes[0];
		artifactForm.recipe_box = [
			...artifactForm.recipe_box,
			{ rune_id: defaultRune.id, quantity: 1 }
		];
	}

	function updateRecipeRune(index: number, runeId: string) {
		artifactForm.recipe_box = artifactForm.recipe_box.map((entry, i) =>
			i === index ? { ...entry, rune_id: runeId } : entry
		);
	}

	function updateRecipeQuantity(index: number, quantity: number) {
		artifactForm.recipe_box = artifactForm.recipe_box.map((entry, i) =>
			i === index ? { ...entry, quantity: Math.max(1, quantity) } : entry
		);
	}

	function removeRecipeEntry(index: number) {
		artifactForm.recipe_box = artifactForm.recipe_box.filter((_, i) => i !== index);
	}

	async function saveArtifact() {
		if (!artifactForm.name?.trim()) {
			alert('Artifact name is required.');
			return;
		}
		if (!artifactForm.origin_id) {
			alert('Select an origin for the artifact.');
			return;
		}

		const payload = {
			name: artifactForm.name.trim(),
			benefit: artifactForm.benefit?.trim() ?? '',
			origin_id: artifactForm.origin_id,
			recipe_box: artifactForm.recipe_box.map((entry) => ({
				rune_id: entry.rune_id,
				quantity: Number(entry.quantity ?? 1)
			}))
		};

		let saveError: string | null = null;
		if (editingArtifact) {
			const { error: updateError } = await supabase
				.from('artifacts')
				.update({ ...payload, updated_at: new Date().toISOString() })
				.eq('id', editingArtifact.id);
			saveError = updateError?.message ?? null;
		} else {
			const { error: insertError } = await supabase.from('artifacts').insert(payload);
			saveError = insertError?.message ?? null;
		}

		if (saveError) {
			alert(`Failed to save artifact: ${saveError}`);
			return;
		}

		closeArtifactForm();
		await loadArtifacts();
	}

	async function deleteArtifact(artifact: Artifact) {
		if (!confirm(`Delete artifact "${artifact.name}"?`)) return;
		const { error: deleteError } = await supabase.from('artifacts').delete().eq('id', artifact.id);
		if (deleteError) {
			alert(`Failed to delete artifact: ${deleteError.message}`);
			return;
		}
		await loadArtifacts();
	}

	const originName = (originId: string) => origins.find((origin) => origin.id === originId)?.name ?? '';
	const runeName = (runeId: string) => runes.find((rune) => rune.id === runeId)?.name ?? 'Unknown rune';

	$: filteredArtifacts = artifacts.filter((artifact) => {
		if (originFilter !== 'all' && artifact.origin_id !== originFilter) return false;
		if (search.trim()) {
			const term = search.trim().toLowerCase();
			if (
				!artifact.name.toLowerCase().includes(term) &&
				!artifact.benefit.toLowerCase().includes(term) &&
				!originName(artifact.origin_id).toLowerCase().includes(term)
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
			<h1>Artifacts</h1>
			<p>Craft high-impact relics using rune recipes tied to origins.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openArtifactForm()}>Create Artifact</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search artifacts" bind:value={search} />
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
		<div class="card">Loading artifacts…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredArtifacts as artifact (artifact.id)}
				<article class="card artifact-card">
					<header>
						<div>
							<h2>{artifact.name}</h2>
							<small>{originName(artifact.origin_id)}</small>
						</div>
						<div class="card-actions">
							<button class="btn" onclick={() => openArtifactForm(artifact)}>Edit</button>
							<button class="btn danger" onclick={() => deleteArtifact(artifact)}>Delete</button>
						</div>
					</header>
					<p class="benefit">{artifact.benefit || 'No benefit description.'}</p>
					<div class="recipe">
						<h3>Recipe</h3>
						{#if artifact.recipe_box.length}
							<ul>
								{#each artifact.recipe_box as entry, index (index)}
									<li>
										<span>{runeName(entry.rune_id)}</span>
										<span class="quantity">×{entry.quantity}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="muted">No rune requirements configured.</p>
						{/if}
					</div>
				</article>
			{:else}
				<div class="card empty">No artifacts match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showArtifactForm}
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			onclick={handleBackdropClick}
			onkeydown={handleBackdropKey}
		>
			<form class="modal" onsubmit={handleSubmit}>
				<h2>{editingArtifact ? 'Edit Artifact' : 'Create Artifact'}</h2>
				<label>
					Name
					<input type="text" bind:value={artifactForm.name} required />
				</label>
				<label>
					Origin
					<select bind:value={artifactForm.origin_id} required>
						<option value="">Select origin</option>
						{#each origins as origin}
							<option value={origin.id}>{origin.name}</option>
						{/each}
					</select>
				</label>
				<label>
					Benefit
					<textarea rows="3" bind:value={artifactForm.benefit} placeholder="Describe the artifact impact"></textarea>
				</label>
				<div class="recipe-editor">
					<div class="recipe-editor__header">
						<h3>Rune Recipe</h3>
						<button class="btn" type="button" onclick={addRecipeEntry}>Add Rune</button>
					</div>
					{#if artifactForm.recipe_box.length === 0}
						<p class="muted">No runes selected. Add runes to craft this artifact.</p>
					{/if}
					{#each artifactForm.recipe_box as entry, index (index)}
						<div class="recipe-row">
							<select
								value={entry.rune_id}
								onchange={(event) =>
									updateRecipeRune(index, (event.currentTarget as HTMLSelectElement).value)}
							>
								{#each runes as rune}
									<option value={rune.id}>{rune.name}</option>
								{/each}
							</select>
							<input
								type="number"
								min="1"
								value={entry.quantity}
								oninput={(event) =>
									updateRecipeQuantity(
										index,
										Number((event.currentTarget as HTMLInputElement).value)
									)}
							/>
							<button
								class="btn danger"
								type="button"
								onclick={() => removeRecipeEntry(index)}
							>
								Remove
							</button>
						</div>
					{/each}
				</div>
				<div class="modal__actions">
					<button class="btn" type="submit">Save</button>
					<button class="btn" type="button" onclick={closeArtifactForm}>Cancel</button>
				</div>
			</form>
		</div>
	{/if}
</section>

<style>
	.artifact-card header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.artifact-card h2 {
		margin: 0;
	}

	.artifact-card small {
		display: block;
		color: #a5b4fc;
	}

	.benefit {
		margin: 0.5rem 0 0;
		color: #cbd5f5;
		white-space: pre-wrap;
	}

	.recipe {
		margin-top: 0.75rem;
		background: rgba(30, 41, 59, 0.45);
		border-radius: 10px;
		padding: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.recipe h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
	}

	.recipe ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.3rem;
	}

	.quantity {
		color: #f8fafc;
		font-weight: 600;
		margin-left: 0.35rem;
	}

	.recipe-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 10px;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.55);
	}

	.recipe-editor__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.recipe-editor__header h3 {
		margin: 0;
		font-size: 0.95rem;
		color: #cbd5f5;
	}

	.recipe-row {
		display: grid;
		grid-template-columns: 1fr 100px auto;
		gap: 0.5rem;
	}

	.recipe-row select,
	.recipe-row input {
		padding: 0.35rem 0.45rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
	}

	.muted {
		color: #94a3b8;
		margin: 0;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
