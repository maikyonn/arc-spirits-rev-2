<script lang="ts">
	interface Props {
		selectedCount: number;
		totalCount: number;
		onSelectAll: () => void;
		onDeselectAll: () => void;
		onDeleteSelected: () => void;
	}

	let { selectedCount, totalCount, onSelectAll, onDeselectAll, onDeleteSelected }: Props = $props();

	const allSelected = $derived(selectedCount === totalCount && totalCount > 0);
</script>

{#if selectedCount > 0}
	<div class="multi-select-bar">
		<div class="selection-info">
			<span class="count">{selectedCount}</span> of {totalCount} selected
		</div>
		<div class="actions">
			{#if !allSelected}
				<button type="button" class="action-btn select-all" onclick={onSelectAll}>
					Select All
				</button>
			{/if}
			<button type="button" class="action-btn deselect" onclick={onDeselectAll}>
				Deselect All
			</button>
			<button type="button" class="action-btn delete" onclick={onDeleteSelected}>
				Delete Selected ({selectedCount})
			</button>
		</div>
	</div>
{/if}

<style>
	.multi-select-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.selection-info {
		font-size: 0.875rem;
		color: #93c5fd;
	}

	.selection-info .count {
		font-weight: 600;
		color: #60a5fa;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		padding: 0.4rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		border: 1px solid transparent;
	}

	.action-btn.select-all {
		background: rgba(59, 130, 246, 0.2);
		color: #93c5fd;
		border-color: rgba(59, 130, 246, 0.3);
	}

	.action-btn.select-all:hover {
		background: rgba(59, 130, 246, 0.3);
	}

	.action-btn.deselect {
		background: rgba(148, 163, 184, 0.15);
		color: #94a3b8;
		border-color: rgba(148, 163, 184, 0.2);
	}

	.action-btn.deselect:hover {
		background: rgba(148, 163, 184, 0.25);
	}

	.action-btn.delete {
		background: rgba(239, 68, 68, 0.2);
		color: #fca5a5;
		border-color: rgba(239, 68, 68, 0.3);
	}

	.action-btn.delete:hover {
		background: rgba(239, 68, 68, 0.35);
	}
</style>
