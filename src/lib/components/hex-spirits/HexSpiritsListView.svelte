<script lang="ts">
	import type { HexSpiritRow, RuneRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';

	type HexSpirit = HexSpiritRow & {
		game_print_image_url: string | null;
		art_raw_image_url: string | null;
	};

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
	};

	type Props = {
		spirits: HexSpirit[];
		originLookup: LookupService;
		classLookup: LookupService;
		runes: RuneRow[];
		onEdit: (spirit: HexSpirit) => void;
		onDelete: (spirit: HexSpirit) => void;
		onDeleteMultiple?: (ids: string[]) => void;
	};

	let { spirits, originLookup, classLookup, runes, onEdit, onDelete, onDeleteMultiple }: Props = $props();

	// Multi-select state
	let selectedIds = $state<Set<string>>(new Set());

	function toggleSelect(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function selectAll() {
		selectedIds = new Set(spirits.map(s => s.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if (!confirm(`Delete ${selectedIds.size} selected item(s)?`)) return;

		if (onDeleteMultiple) {
			onDeleteMultiple(Array.from(selectedIds));
		} else {
			// Fallback: delete one by one
			for (const id of selectedIds) {
				const spirit = spirits.find(s => s.id === id);
				if (spirit) onDelete(spirit);
			}
		}
		selectedIds = new Set();
	}

	function primaryOriginId(spirit: HexSpirit): string | null {
		return spirit.traits?.origin_ids?.[0] ?? null;
	}

	function primaryClassId(spirit: HexSpirit): string | null {
		return spirit.traits?.class_ids?.[0] ?? null;
	}

	function calculateOriginCounts(spirit: HexSpirit): Record<string, number> {
		return (
			spirit.traits?.origin_ids?.reduce(
				(acc, id) => {
					acc[id] = (acc[id] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			) ?? {}
		);
	}

	function calculateClassCounts(spirit: HexSpirit): Record<string, number> {
		return (
			spirit.traits?.class_ids?.reduce(
				(acc, id) => {
					acc[id] = (acc[id] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			) ?? {}
		);
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={spirits.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<section class="card-grid">
	{#each spirits as spirit (spirit.id)}
		{@const spiritOriginId = primaryOriginId(spirit)}
		{@const spiritClassId = primaryClassId(spirit)}
		{@const originCounts = calculateOriginCounts(spirit)}
		{@const classCounts = calculateClassCounts(spirit)}
		{@const isSelected = selectedIds.has(spirit.id)}

		<article class="card spirit-card" class:selected={isSelected}>
			<header>
				<label class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={isSelected}
						onchange={() => toggleSelect(spirit.id)}
					/>
				</label>
				<div class="header-content">
					<h2>{spirit.name}</h2>
					<small>
						Primary Origin: {originLookup.getLabel(spiritOriginId, 'Unassigned')} • Primary Class: {classLookup.getLabel(
							spiritClassId,
							'None'
						)} • Cost: {spirit.cost}
					</small>
				</div>
				<CardActionMenu onEdit={() => onEdit(spirit)} onDelete={() => onDelete(spirit)} />
			</header>

			<div class="spirit-details">
				<div class="detail-section">
					<h3>Origins</h3>
					{#if Object.keys(originCounts).length > 0}
						<div class="trait-list">
							{#each Object.entries(originCounts) as [originId, count]}
								<div class="trait-badge trait-badge--origin">
									{originLookup.getLabel(originId, 'Unknown')} ×{count}
								</div>
							{/each}
						</div>
					{:else}
						<p class="empty-text">No origins assigned</p>
					{/if}
				</div>

				<div class="detail-section">
					<h3>Classes</h3>
					{#if Object.keys(classCounts).length > 0}
						<div class="trait-list">
							{#each Object.entries(classCounts) as [classId, count]}
								<div class="trait-badge trait-badge--class">
									{classLookup.getLabel(classId, 'Unknown')} ×{count}
								</div>
							{/each}
						</div>
					{:else}
						<p class="empty-text">No classes assigned</p>
					{/if}
				</div>

				{#if spirit.rune_cost && spirit.rune_cost.length > 0}
					<div class="detail-section">
						<h3>Rune Cost</h3>
						<div class="trait-list">
							{#each spirit.rune_cost as runeId}
								{@const rune = runes.find((r) => r.id === runeId)}
								{#if rune}
									<div class="trait-badge trait-badge--rune">
										{rune.name}
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</article>
	{:else}
		<div class="card empty">No hex spirits match the current filters.</div>
	{/each}
</section>

<style>
	.card-grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.card {
		background: rgba(30, 41, 59, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		padding: 0.5rem;
	}

	.card.empty {
		text-align: center;
		color: #94a3b8;
		padding: 1rem;
		font-style: italic;
		font-size: 0.75rem;
	}

	.spirit-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.spirit-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		cursor: pointer;
		padding: 0.2rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #6366f1;
		border-radius: 2px;
	}

	.header-content {
		flex: 1;
		min-width: 0;
	}

	.card.selected {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.5);
		box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
	}

	.spirit-card h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #f8fafc;
		line-height: 1.2;
	}

	.spirit-card small {
		display: block;
		color: #a5b4fc;
		margin-top: 0.1rem;
		font-size: 0.7rem;
		line-height: 1.3;
	}

	.spirit-details {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.detail-section {
		background: rgba(15, 23, 42, 0.5);
		border-radius: 2px;
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.detail-section h3 {
		margin: 0 0 0.3rem 0;
		font-size: 0.7rem;
		color: #c7d2fe;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.trait-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.trait-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 500;
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		line-height: 1.2;
	}

	.trait-badge--origin {
		background: rgba(236, 72, 153, 0.2);
		color: #f9a8d4;
		border: 1px solid rgba(236, 72, 153, 0.3);
	}

	.trait-badge--class {
		background: rgba(59, 130, 246, 0.2);
		color: #93c5fd;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.trait-badge--rune {
		background: rgba(168, 85, 247, 0.2);
		color: #d8b4fe;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.empty-text {
		color: #94a3b8;
		font-size: 0.7rem;
		font-style: italic;
		margin: 0;
	}
</style>
