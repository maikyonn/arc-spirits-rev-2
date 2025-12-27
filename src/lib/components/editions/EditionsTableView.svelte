<script lang="ts">
	import type { EditionRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
		get: (id: string | null) => any;
	};

	type Props = {
		editions: EditionRow[];
		originLookup: LookupService;
		stats: Map<string, { totalUnique: number; totalWithDuplicates: number }>;
		onEdit: (edition: EditionRow) => void;
		onSelect: (edition: EditionRow) => void;
		selectedEditionId: string | null;
	};

	let { editions, originLookup, stats, onEdit, onSelect, selectedEditionId }: Props = $props();
</script>

<div class="table-container">
	<table class="data-table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Origins</th>
				<th>Unique Spirits</th>
				<th>Total Cards</th>
				<th>Default</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each editions as edition (edition.id)}
				{@const editionStats = stats.get(edition.id)}
				<tr
					class:selected={selectedEditionId === edition.id}
					onclick={() => onSelect(edition)}
					onkeydown={(e) => e.key === 'Enter' && onSelect(edition)}
					tabindex="0"
				>
					<td class="name-cell">
						<div class="name-content">
							{edition.name}
							{#if edition.description}
								<small>{edition.description}</small>
							{/if}
						</div>
					</td>
					<td>
						<div class="origins-cell">
							{#each edition.origin_ids.slice(0, 3) as originId}
								{@const origin = originLookup.get(originId)}
								{#if origin}
									<span class="origin-tag" style="border-color: {origin.color}">
										{origin.name}
									</span>
								{/if}
							{/each}
							{#if edition.origin_ids.length > 3}
								<span class="more-tag">+{edition.origin_ids.length - 3}</span>
							{/if}
						</div>
					</td>
					<td class="number-cell">{editionStats?.totalUnique ?? 0}</td>
					<td class="number-cell">{editionStats?.totalWithDuplicates ?? 0}</td>
					<td>
						{#if edition.is_default}
							<span class="tag default">Yes</span>
						{:else}
							<span class="tag">No</span>
						{/if}
					</td>
					<td class="action-cell">
						<CardActionMenu
							onEdit={() => onEdit(edition)}
							onDelete={null}
							onGenerate={null}
						/>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="empty-cell">No editions yet. Create one to get started.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		overflow-x: auto;
		background: rgba(30, 41, 59, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 4px;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.data-table thead {
		background: rgba(15, 23, 42, 0.5);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.data-table th {
		padding: 0.5rem;
		text-align: left;
		font-weight: 600;
		color: #94a3b8;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.data-table td {
		padding: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		color: #e2e8f0;
	}

	.data-table tbody tr {
		transition: background-color 0.15s ease;
		cursor: pointer;
	}

	.data-table tbody tr:hover {
		background: rgba(30, 41, 59, 0.4);
	}

	.data-table tbody tr.selected {
		background: rgba(59, 130, 246, 0.15);
	}

	.name-cell {
		font-weight: 500;
	}

	.name-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.name-content small {
		color: #94a3b8;
		font-size: 0.7rem;
		font-weight: 400;
	}

	.origins-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.origin-tag {
		font-size: 0.65rem;
		padding: 0.15rem 0.3rem;
		background: rgba(51, 65, 85, 0.5);
		border: 1px solid;
		border-radius: 2px;
		line-height: 1.2;
		white-space: nowrap;
	}

	.more-tag {
		font-size: 0.65rem;
		padding: 0.15rem 0.3rem;
		background: rgba(100, 116, 139, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 2px;
		color: #cbd5e1;
	}

	.number-cell {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		color: #93c5fd;
	}

	.tag {
		font-size: 0.6rem;
		padding: 0.15rem 0.3rem;
		background: rgba(100, 116, 139, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 2px;
		color: #cbd5e1;
		font-weight: 500;
	}

	.tag.default {
		background: rgba(34, 197, 94, 0.2);
		border-color: rgba(34, 197, 94, 0.4);
		color: #86efac;
	}

	.action-cell {
		width: 40px;
		text-align: center;
	}

	.empty-cell {
		text-align: center;
		color: #94a3b8;
		padding: 1.5rem;
		font-style: italic;
	}
</style>
