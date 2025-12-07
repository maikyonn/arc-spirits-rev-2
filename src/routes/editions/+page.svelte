<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { EditionRow, OriginRow, HexSpiritRow, CostDuplicates } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import {
		deleteEditionRecord,
		emptyEditionForm,
		fetchEditionRecords,
		editionRowToForm,
		saveEditionRecord,
		DEFAULT_COST_DUPLICATES,
		type EditionFormData
	} from '$lib/features/editions/editions';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchHexSpiritRecords } from '$lib/features/hex-spirits/hexSpirits';
	import { publicAssetUrl } from '$lib/utils/storage';

	let editions: EditionRow[] = [];
	let origins: OriginRow[] = [];
	let hexSpirits: HexSpiritRow[] = [];
	let loading = true;
	let error: string | null = null;

	let selectedEditionId: string | null = null;

	let showEditionForm = false;
	let editingEdition: EditionRow | null = null;
	let formData: EditionFormData = emptyEditionForm();

	// All possible costs in the game (odd numbers only)
	const ALL_COSTS = ['1', '3', '5', '7', '9', '11', '13', '15', '17'];

	$: selectedEdition = editions.find((e) => e.id === selectedEditionId) ?? null;

	// Filter spirits based on selected edition's origins
	$: filteredSpirits = selectedEdition
		? hexSpirits.filter((spirit) => {
				const spiritOriginIds = spirit.traits?.origin_ids ?? [];
				return spiritOriginIds.some((oid) => selectedEdition.origin_ids.includes(oid));
			})
		: [];

	// Group spirits by cost
	$: spiritsByCost = filteredSpirits.reduce(
		(acc, spirit) => {
			const cost = String(spirit.cost);
			if (!acc[cost]) acc[cost] = [];
			acc[cost].push(spirit);
			return acc;
		},
		{} as Record<string, HexSpiritRow[]>
	);

	// Calculate statistics
	$: stats = calculateStats(selectedEdition, filteredSpirits, spiritsByCost);

	function calculateStats(
		edition: EditionRow | null,
		spirits: HexSpiritRow[],
		byCost: Record<string, HexSpiritRow[]>
	) {
		if (!edition) return null;

		const costDuplicates = edition.cost_duplicates ?? DEFAULT_COST_DUPLICATES;
		let totalUnique = spirits.length;
		let totalWithDuplicates = 0;

		const costBreakdown: { cost: string; unique: number; duplicates: number; total: number }[] = [];

		for (const cost of ALL_COSTS) {
			const uniqueCount = byCost[cost]?.length ?? 0;
			const duplicateCount = costDuplicates[cost] ?? 1;
			const total = uniqueCount * duplicateCount;
			totalWithDuplicates += total;
			if (uniqueCount > 0) {
				costBreakdown.push({ cost, unique: uniqueCount, duplicates: duplicateCount, total });
			}
		}

		return {
			totalUnique,
			totalWithDuplicates,
			costBreakdown,
			originCount: edition.origin_ids.length
		};
	}

	function getOriginIconUrl(origin: OriginRow): string | null {
		return publicAssetUrl(origin.icon_png, { updatedAt: origin.updated_at ?? undefined });
	}

	function getOriginById(id: string): OriginRow | undefined {
		return origins.find((o) => o.id === id);
	}

	onMount(loadData);

	async function loadData() {
		try {
			loading = true;
			error = null;
			const [editionsData, originsData, spiritsData] = await Promise.all([
				fetchEditionRecords(),
				fetchOriginRecords(),
				fetchHexSpiritRecords()
			]);
			editions = editionsData;
			origins = originsData;
			hexSpirits = spiritsData;

			// Select first edition by default
			if (editions.length > 0 && !selectedEditionId) {
				selectedEditionId = editions[0].id;
			}
		} catch (err) {
			error =
				err instanceof Error
					? err.message
					: err && typeof err === 'object' && 'message' in err
						? String(err.message)
						: String(err);
		} finally {
			loading = false;
		}
	}

	function openEditionForm(edition?: EditionRow) {
		if (edition) {
			editingEdition = edition;
			formData = editionRowToForm(edition);
		} else {
			editingEdition = null;
			formData = emptyEditionForm();
		}
		showEditionForm = true;
	}

	function closeEditionForm() {
		showEditionForm = false;
	}

	async function saveEdition() {
		if (!formData.name.trim()) {
			alert('Edition name is required.');
			return;
		}

		try {
			const saved = await saveEditionRecord(formData);
			await loadData();
			selectedEditionId = saved.id;
			closeEditionForm();
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: err && typeof err === 'object' && 'message' in err
						? String(err.message)
						: String(err);
			alert(`Failed to save edition: ${message}`);
		}
	}

	async function deleteEdition(edition: EditionRow) {
		if (!confirm(`Delete edition "${edition.name}"? This cannot be undone.`)) return;
		try {
			await deleteEditionRecord(edition.id);
			if (selectedEditionId === edition.id) {
				selectedEditionId = null;
			}
			await loadData();
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: err && typeof err === 'object' && 'message' in err
						? String(err.message)
						: String(err);
			alert(`Failed to delete edition: ${message}`);
		}
	}

	function submitEditionForm(event: Event) {
		event.preventDefault();
		void saveEdition();
	}

	function toggleOriginInForm(originId: string) {
		if (formData.origin_ids.includes(originId)) {
			formData.origin_ids = formData.origin_ids.filter((id) => id !== originId);
		} else {
			formData.origin_ids = [...formData.origin_ids, originId];
		}
	}

	function updateCostDuplicate(cost: string, value: number) {
		formData.cost_duplicates = {
			...formData.cost_duplicates,
			[cost]: Math.max(0, value)
		};
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Editions</h1>
			<p>Create custom sets of hex spirits by selecting origins and configuring duplicates per cost.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openEditionForm()}>Create Edition</button>
		</div>
	</header>

	{#if loading}
		<div class="card">Loading editions...</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="editions-layout">
			<!-- Edition Selector -->
			<aside class="editions-sidebar">
				<h3>Editions</h3>
				{#if editions.length === 0}
					<p class="muted">No editions yet. Create one to get started.</p>
				{:else}
					<ul class="edition-list">
						{#each editions as edition (edition.id)}
							<li>
								<button
									class="edition-item"
									class:selected={selectedEditionId === edition.id}
									onclick={() => (selectedEditionId = edition.id)}
								>
									<span class="edition-name">{edition.name}</span>
									{#if edition.is_default}
										<span class="tag default">Default</span>
									{/if}
								</button>
								<CardActionMenu
									onEdit={() => openEditionForm(edition)}
									onDelete={() => deleteEdition(edition)}
									onGenerate={null}
								/>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>

			<!-- Edition Details -->
			<main class="edition-details">
				{#if selectedEdition}
					<div class="edition-header">
						<h2>{selectedEdition.name}</h2>
						{#if selectedEdition.description}
							<p class="muted">{selectedEdition.description}</p>
						{/if}
					</div>

					<!-- Origins in this edition -->
					<section class="card">
						<h3>Origins ({selectedEdition.origin_ids.length})</h3>
						<div class="origin-chips">
							{#each selectedEdition.origin_ids as originId}
								{@const origin = getOriginById(originId)}
								{#if origin}
									<span class="origin-chip" style="border-color: {origin.color}">
										{#if getOriginIconUrl(origin)}
											<img src={getOriginIconUrl(origin)} alt="" class="origin-chip__icon" />
										{:else if origin.icon_emoji}
											<span class="origin-chip__emoji">{origin.icon_emoji}</span>
										{/if}
										{origin.name}
									</span>
								{/if}
							{/each}
							{#if selectedEdition.origin_ids.length === 0}
								<span class="muted">No origins selected</span>
							{/if}
						</div>
					</section>

					<!-- Statistics -->
					{#if stats}
						<section class="card stats-card">
							<h3>Statistics</h3>
							<div class="stats-grid">
								<div class="stat">
									<span class="stat__value">{stats.originCount}</span>
									<span class="stat__label">Origins</span>
								</div>
								<div class="stat">
									<span class="stat__value">{stats.totalUnique}</span>
									<span class="stat__label">Unique Spirits</span>
								</div>
								<div class="stat">
									<span class="stat__value">{stats.totalWithDuplicates}</span>
									<span class="stat__label">Total Cards</span>
								</div>
							</div>

							<h4>Cards by Cost</h4>
							<table class="cost-table">
								<thead>
									<tr>
										<th>Cost</th>
										<th>Unique</th>
										<th>× Duplicates</th>
										<th>Total</th>
									</tr>
								</thead>
								<tbody>
									{#each stats.costBreakdown as row}
										<tr>
											<td class="cost-cell">{row.cost}</td>
											<td>{row.unique}</td>
											<td>× {row.duplicates}</td>
											<td class="total-cell">{row.total}</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr>
										<td colspan="3"><strong>Total</strong></td>
										<td class="total-cell"><strong>{stats.totalWithDuplicates}</strong></td>
									</tr>
								</tfoot>
							</table>
						</section>
					{/if}

					<!-- Spirits List -->
					<section class="card">
						<h3>Spirits in Edition ({filteredSpirits.length})</h3>
						{#each ALL_COSTS as cost}
							{@const spirits = spiritsByCost[cost] ?? []}
							{#if spirits.length > 0}
								<div class="cost-group">
									<h4>
										Cost {cost}
										<span class="count">({spirits.length} unique × {selectedEdition.cost_duplicates[cost] ?? 1} = {spirits.length * (selectedEdition.cost_duplicates[cost] ?? 1)})</span>
									</h4>
									<div class="spirit-chips">
										{#each spirits as spirit}
											<span class="spirit-chip">{spirit.name}</span>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</section>
				{:else}
					<div class="card empty">
						<p>Select an edition from the sidebar or create a new one.</p>
					</div>
				{/if}
			</main>
		</div>
	{/if}

	{#if showEditionForm}
		<EditorModal
			title={editingEdition ? 'Edit Edition' : 'Create Edition'}
			description="Configure which origins and cost duplicates to include in this edition."
			size="lg"
			on:close={closeEditionForm}
		>
			<form id="edition-editor-form" class="edition-form" onsubmit={submitEditionForm}>
				<div class="form-row">
					<label class="form-field">
						Name
						<input type="text" bind:value={formData.name} required />
					</label>
					<label class="form-field">
						<span>
							<input type="checkbox" bind:checked={formData.is_default} />
							Set as Default
						</span>
					</label>
				</div>

				<label class="form-field full-width">
					Description
					<textarea rows="2" bind:value={formData.description}></textarea>
				</label>

				<fieldset class="origins-fieldset">
					<legend>Select Origins</legend>
					<div class="origins-grid">
						{#each origins as origin}
							<label class="origin-checkbox">
								<input
									type="checkbox"
									checked={formData.origin_ids.includes(origin.id)}
									onchange={() => toggleOriginInForm(origin.id)}
								/>
								<span class="origin-label" style="border-color: {origin.color}">
									{#if getOriginIconUrl(origin)}
										<img src={getOriginIconUrl(origin)} alt="" class="origin-label__icon" />
									{:else if origin.icon_emoji}
										<span>{origin.icon_emoji}</span>
									{/if}
									{origin.name}
								</span>
							</label>
						{/each}
					</div>
				</fieldset>

				<fieldset class="duplicates-fieldset">
					<legend>Duplicates per Cost</legend>
					<div class="duplicates-grid">
						{#each ALL_COSTS as cost}
							<label class="duplicate-input">
								<span class="cost-label">Cost {cost}</span>
								<input
									type="number"
									min="0"
									max="10"
									value={formData.cost_duplicates[cost] ?? 1}
									onchange={(e) => updateCostDuplicate(cost, parseInt(e.currentTarget.value) || 0)}
								/>
							</label>
						{/each}
					</div>
				</fieldset>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="edition-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeEditionForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.editions-layout {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	.editions-sidebar {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
		padding: 1rem;
	}

	.editions-sidebar h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		color: #e2e8f0;
	}

	.edition-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.edition-list li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.edition-item {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		color: #cbd5e1;
		transition: all 0.15s ease;
	}

	.edition-item:hover {
		background: rgba(51, 65, 85, 0.6);
	}

	.edition-item.selected {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.5);
		color: #93c5fd;
	}

	.edition-name {
		flex: 1;
	}

	.tag.default {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: rgba(34, 197, 94, 0.2);
		border: 1px solid rgba(34, 197, 94, 0.4);
		border-radius: 4px;
		color: #86efac;
	}

	.edition-details {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.edition-header h2 {
		margin: 0;
	}

	.origin-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.origin-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.6rem;
		background: rgba(51, 65, 85, 0.5);
		border: 1px solid;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.origin-chip__icon {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}

	.origin-chip__emoji {
		font-size: 1rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.stat {
		text-align: center;
		padding: 0.75rem;
		background: rgba(51, 65, 85, 0.4);
		border-radius: 8px;
	}

	.stat__value {
		display: block;
		font-size: 1.75rem;
		font-weight: 600;
		color: #93c5fd;
	}

	.stat__label {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.cost-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.cost-table th,
	.cost-table td {
		padding: 0.5rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.cost-table th {
		color: #94a3b8;
		font-weight: 500;
	}

	.cost-cell {
		font-weight: 600;
		color: #fbbf24;
	}

	.total-cell {
		font-weight: 600;
		color: #4ade80;
	}

	.cost-group {
		margin-bottom: 1rem;
	}

	.cost-group h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
		color: #e2e8f0;
	}

	.cost-group h4 .count {
		font-weight: 400;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.spirit-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.spirit-chip {
		padding: 0.25rem 0.5rem;
		background: rgba(71, 85, 105, 0.5);
		border-radius: 4px;
		font-size: 0.8rem;
		color: #cbd5e1;
	}

	.edition-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-row {
		display: flex;
		gap: 1rem;
		align-items: end;
	}

	.form-field {
		flex: 1;
	}

	.form-field.full-width {
		width: 100%;
	}

	.origins-fieldset,
	.duplicates-fieldset {
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 1rem;
	}

	.origins-fieldset legend,
	.duplicates-fieldset legend {
		padding: 0 0.5rem;
		font-weight: 500;
		color: #e2e8f0;
	}

	.origins-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.5rem;
	}

	.origin-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.origin-checkbox input {
		margin: 0;
	}

	.origin-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.5rem;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid;
		border-radius: 5px;
		font-size: 0.85rem;
	}

	.origin-label__icon {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}

	.duplicates-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.duplicate-input {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.duplicate-input .cost-label {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.duplicate-input input {
		width: 100%;
		padding: 0.4rem;
		text-align: center;
	}

	.empty {
		text-align: center;
		padding: 2rem;
		color: #94a3b8;
	}

	.muted {
		color: #94a3b8;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	@media (max-width: 768px) {
		.editions-layout {
			grid-template-columns: 1fr;
		}

		.editions-sidebar {
			order: -1;
		}
	}
</style>
