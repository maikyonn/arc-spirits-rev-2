<script lang="ts">
	import type { RuneRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
	};

	type Props = {
		runes: RuneRow[];
		originLookup: LookupService;
		classLookup: LookupService;
		onEdit: (rune: RuneRow) => void;
		onDelete: (rune: RuneRow) => void;
		onDeleteMultiple: (runes: RuneRow[]) => void;
	};

	let { runes, originLookup, classLookup, onEdit, onDelete, onDeleteMultiple }: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());

	function getRuneCategory(rune: RuneRow): string {
		if (rune.origin_id) return originLookup.getLabel(rune.origin_id, 'Unknown Origin');
		if (rune.class_id) return classLookup.getLabel(rune.class_id, 'Unknown Class');
		return 'Unassigned';
	}

	function getRuneCategoryType(rune: RuneRow): 'origin' | 'class' | 'unassigned' {
		if (rune.origin_id) return 'origin';
		if (rune.class_id) return 'class';
		return 'unassigned';
	}

	function toggleSelect(runeId: string) {
		const newSelectedIds = new Set(selectedIds);
		if (newSelectedIds.has(runeId)) {
			newSelectedIds.delete(runeId);
		} else {
			newSelectedIds.add(runeId);
		}
		selectedIds = newSelectedIds;
	}

	function selectAll() {
		selectedIds = new Set(runes.map((r) => r.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		const runesToDelete = runes.filter((r) => selectedIds.has(r.id));
		onDeleteMultiple(runesToDelete);
		selectedIds = new Set();
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={runes.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

{#if runes.length === 0}
	<div class="empty-state">No runes match the current filters.</div>
{:else}
	<div class="rune-list">
		{#each runes as rune (rune.id)}
			<article class="rune-card" class:selected={selectedIds.has(rune.id)}>
				<header>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selectedIds.has(rune.id)}
							onchange={() => toggleSelect(rune.id)}
							aria-label="Select {rune.name}"
						/>
					</div>
					<div class="header-content">
						<div class="rune-card__identity">
							<h2>{rune.name}</h2>
						</div>
						<CardActionMenu
							onEdit={() => onEdit(rune)}
							onDelete={() => onDelete(rune)}
							onGenerate={null}
						/>
					</div>
				</header>
				<p class="meta">
					<span class="category-type {getRuneCategoryType(rune)}">
						{getRuneCategoryType(rune) === 'origin'
							? 'Origin'
							: getRuneCategoryType(rune) === 'class'
								? 'Class'
								: ''}
					</span>
					{getRuneCategory(rune)}
				</p>
			</article>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.rune-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.5rem;
	}

	.rune-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
		padding: 0.5rem;
		transition: all 0.2s;
	}

	.rune-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		background: rgba(30, 41, 59, 0.6);
	}

	.rune-card header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		padding-top: 0.1rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		flex: 1;
		gap: 0.5rem;
	}

	.rune-card__identity {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.rune-card.selected {
		border-color: rgba(59, 130, 246, 0.5);
		background: rgba(59, 130, 246, 0.1);
	}

	.rune-card h2 {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.rune-card .meta {
		margin: 0.4rem 0 0 0;
		color: #a5b4fc;
		font-weight: 500;
		font-size: 0.7rem;
	}

	.category-type {
		display: inline-block;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		margin-right: 0.3rem;
	}

	.category-type.origin {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.category-type.class {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}
</style>
