<script lang="ts">
	import { onMount } from 'svelte';
	import type { OriginRow } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
	import {
		deleteOriginRecord,
		emptyOriginForm,
		fetchOriginRecords,
		originRowToForm,
		saveOriginRecord,
		type OriginFormData
	} from '$lib/features/origins/origins';

	let origins: OriginRow[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';

	let showOriginForm = false;
	let editingOrigin: OriginRow | null = null;
	let formData: OriginFormData = emptyOriginForm();

	onMount(loadOrigins);

	async function loadOrigins() {
		try {
			loading = true;
			error = null;
			origins = await fetchOriginRecords();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	function openOriginForm(origin?: OriginRow) {
		if (origin) {
			editingOrigin = origin;
			formData = originRowToForm(origin);
		} else {
			editingOrigin = null;
			const nextPosition = (origins.at(-1)?.position ?? origins.length) + 1;
			formData = emptyOriginForm(nextPosition);
		}
		showOriginForm = true;
	}

	function closeOriginForm() {
		showOriginForm = false;
	}

	async function saveOrigin() {
		if (!formData.name.trim()) {
			alert('Origin name is required.');
			return;
		}

		try {
			const saved = await saveOriginRecord(formData);
			await loadOrigins();
			editingOrigin = saved;
			closeOriginForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save origin: ${message}`);
		}
	}

	async function deleteOrigin(origin: OriginRow) {
		if (!confirm(`Delete origin "${origin.name}"? This cannot be undone.`)) return;
		try {
			await deleteOriginRecord(origin.id);
			await loadOrigins();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete origin: ${message}`);
		}
	}

	function submitOriginForm(event: Event) {
		event.preventDefault();
		void saveOrigin();
	}

	function renderMultiline(value?: string | null): string {
		return (value ?? '').replace(/\r\n/g, '\n').trim();
	}

	$: filteredOrigins = origins.filter((origin) => {
		if (!search.trim()) return true;
		const term = search.trim().toLowerCase();
		return (
			origin.name.toLowerCase().includes(term) ||
			(origin.description ?? '').toLowerCase().includes(term) ||
			(origin.footer ?? '').toLowerCase().includes(term)
		);
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Origins</h1>
			<p>Define the origins that bind spirits, runes, and artifacts.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openOriginForm()}>Create Origin</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search origins" bind:value={search} />
		</label>
	</section>

	{#if loading}
		<div class="card">Loading origins…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredOrigins as origin (origin.id)}
				<article class="card origin-card">
					<header>
						<div>
							<h2>{origin.name}</h2>
							<small>Position {origin.position}</small>
						</div>
						<div class="card-actions">
							<button class="btn" onclick={() => openOriginForm(origin)}>Edit</button>
							<button class="btn danger" onclick={() => deleteOrigin(origin)}>Delete</button>
						</div>
					</header>
					{#if origin.description}
						<p class="muted">{renderMultiline(origin.description)}</p>
					{/if}
					<div class="meta">
						{#if origin.icon}
							<span class="tag">Icon: {origin.icon}</span>
						{/if}
						{#if origin.color}
							<span class="tag">
								Color:
								<span class="swatch" style={`background:${origin.color}`}></span>
								{origin.color}
							</span>
						{/if}
					</div>
					{#if origin.footer}
						<p class="footer">{renderMultiline(origin.footer)}</p>
					{/if}
				</article>
			{:else}
				<div class="card empty">No origins match the current search.</div>
			{/each}
		</section>
	{/if}

	{#if showOriginForm}
		<EditorModal
			title={editingOrigin ? 'Edit Origin' : 'Create Origin'}
			description="Maintain origin metadata including ordering, iconography, and flavor text."
			size="sm"
			on:close={closeOriginForm}
		>
			<form id="origin-editor-form" class="origin-form" onsubmit={submitOriginForm}>
				<label>
					Name
					<input type="text" bind:value={formData.name} required />
				</label>
				<label>
					Position
					<input type="number" min="1" bind:value={formData.position} />
				</label>
				<label>
					Icon
					<input type="text" bind:value={formData.icon} placeholder="emoji or path" />
				</label>
				<label>
					Color
					<input type="color" bind:value={formData.color} />
				</label>
				<label>
					Description
					<textarea rows="3" bind:value={formData.description}></textarea>
				</label>
				<label>
					Footer
					<textarea rows="2" bind:value={formData.footer}></textarea>
				</label>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="origin-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeOriginForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.origin-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.65rem;
	}

	.origin-form textarea {
		min-height: 68px;
		resize: vertical;
	}

	.origin-form label:nth-child(n + 5) {
		grid-column: 1 / -1;
	}

	.origin-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.origin-card h2 {
		margin: 0;
	}

	.origin-card small {
		display: block;
		color: #a5b4fc;
	}

	.origin-card .muted {
		color: #cbd5f5;
		margin: 0.5rem 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.4);
	}

	.footer {
		margin-top: 0.5rem;
		font-style: italic;
		color: #94a3b8;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
