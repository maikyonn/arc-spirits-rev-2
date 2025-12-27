<script lang="ts">
	import type { Snippet } from 'svelte';

	type GridColumns = 1 | 2 | 3 | 4 | 5 | 6;

	interface Props<T = any> {
		items?: T[];
		columns?: GridColumns;
		emptyMessage?: string;
		emptyIcon?: string;
		item?: Snippet<[{ item: T; index: number }]>;
	}

	let {
		items = [],
		columns = 3,
		emptyMessage = 'No items to display',
		emptyIcon = '📭',
		item
	}: Props = $props();

	const isEmpty = $derived(items.length === 0);

	const gridTemplateColumns = $derived.by(() => {
		switch (columns) {
			case 1:
				return '1fr';
			case 2:
				return 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))';
			case 3:
				return 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';
			case 4:
				return 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))';
			case 5:
				return 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))';
			case 6:
				return 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))';
			default:
				return 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';
		}
	});
</script>

{#if isEmpty}
	<div class="data-grid__empty">
		<div class="data-grid__empty-icon">{emptyIcon}</div>
		<p class="data-grid__empty-message">{emptyMessage}</p>
	</div>
{:else}
	<div class="data-grid" style="grid-template-columns: {gridTemplateColumns};">
		{#each items as itemData, index (index)}
			<div class="data-grid__item">
				{#if item}
					{@render item({ item: itemData, index })}
				{:else}
					<div class="data-grid__fallback">Item {index + 1}</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.data-grid {
		display: grid;
		gap: 1rem;
		width: 100%;
	}

	.data-grid__item {
		display: flex;
		flex-direction: column;
	}

	.data-grid__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		min-height: 300px;
	}

	.data-grid__empty-icon {
		font-size: 4rem;
		line-height: 1;
		margin-bottom: 1rem;
		opacity: 0.6;
	}

	.data-grid__empty-message {
		margin: 0;
		color: #94a3b8;
		font-size: 1.05rem;
		max-width: 400px;
	}

	.data-grid__fallback {
		padding: 1rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		color: #cbd5f5;
		text-align: center;
	}

	@media (max-width: 640px) {
		.data-grid {
			grid-template-columns: 1fr !important;
		}
	}
</style>
