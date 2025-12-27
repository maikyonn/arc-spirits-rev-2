<script lang="ts">
	import type { RuneRow } from '$lib/types/gameData';
	import Button from '$lib/components/ui/Button.svelte';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
	};

	type Props = {
		runes: RuneRow[];
		originLookup: LookupService;
		classLookup: LookupService;
		onEdit: (rune: RuneRow) => void;
	};

	let { runes, originLookup, classLookup, onEdit }: Props = $props();

	type SortKey = 'name' | 'type' | 'category';
	let sortKey = $state<SortKey>('name');
	let sortAsc = $state(true);

	function getRuneCategory(rune: RuneRow): string {
		if (rune.origin_id) return originLookup.getLabel(rune.origin_id, 'Unknown Origin');
		if (rune.class_id) return classLookup.getLabel(rune.class_id, 'Unknown Class');
		return 'Unassigned';
	}

	function getRuneCategoryType(rune: RuneRow): string {
		if (rune.origin_id) return 'Origin';
		if (rune.class_id) return 'Class';
		return 'Unassigned';
	}

	const sortedRunes = $derived(() => {
		const sorted = [...runes];
		sorted.sort((a, b) => {
			let aVal: string;
			let bVal: string;

			if (sortKey === 'name') {
				aVal = a.name.toLowerCase();
				bVal = b.name.toLowerCase();
			} else if (sortKey === 'type') {
				aVal = getRuneCategoryType(a);
				bVal = getRuneCategoryType(b);
			} else {
				aVal = getRuneCategory(a).toLowerCase();
				bVal = getRuneCategory(b).toLowerCase();
			}

			if (aVal < bVal) return sortAsc ? -1 : 1;
			if (aVal > bVal) return sortAsc ? 1 : -1;
			return 0;
		});
		return sorted;
	});

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	}

	function getSortIcon(key: SortKey): string {
		if (sortKey !== key) return '⇅';
		return sortAsc ? '↑' : '↓';
	}
</script>

{#if runes.length === 0}
	<div class="empty-state">No runes match the current filters.</div>
{:else}
	<div class="table-container">
		<table class="rune-table">
			<thead>
				<tr>
					<th>
						<button class="sort-btn" onclick={() => toggleSort('name')}>
							Name {getSortIcon('name')}
						</button>
					</th>
					<th>
						<button class="sort-btn" onclick={() => toggleSort('type')}>
							Type {getSortIcon('type')}
						</button>
					</th>
					<th>
						<button class="sort-btn" onclick={() => toggleSort('category')}>
							Category {getSortIcon('category')}
						</button>
					</th>
					<th class="actions-col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedRunes() as rune (rune.id)}
					<tr>
						<td class="name-col">{rune.name}</td>
						<td class="type-col">
							<span class="type-badge {getRuneCategoryType(rune).toLowerCase()}">
								{getRuneCategoryType(rune)}
							</span>
						</td>
						<td class="category-col">{getRuneCategory(rune)}</td>
						<td class="actions-col">
							<Button variant="ghost" size="sm" onclick={() => onEdit(rune)}>Edit</Button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.table-container {
		overflow-x: auto;
		background: rgba(30, 41, 59, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
	}

	.rune-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.rune-table thead {
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.rune-table th {
		padding: 0.4rem 0.5rem;
		text-align: left;
		font-weight: 600;
		color: #94a3b8;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.rune-table td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.05);
		color: #cbd5e1;
	}

	.rune-table tbody tr:hover {
		background: rgba(30, 41, 59, 0.4);
	}

	.sort-btn {
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		transition: color 0.2s;
	}

	.sort-btn:hover {
		color: #e2e8f0;
	}

	.name-col {
		font-weight: 500;
		color: #e2e8f0;
	}

	.type-col,
	.category-col {
		font-size: 0.7rem;
	}

	.type-badge {
		display: inline-block;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.type-badge.origin {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.type-badge.class {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.type-badge.unassigned {
		background: rgba(148, 163, 184, 0.15);
		color: #64748b;
	}

	.actions-col {
		width: 80px;
		text-align: right;
	}
</style>
