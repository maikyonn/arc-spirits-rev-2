<script lang="ts" generics="T">
	import { fly, fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		items?: T[];
		columns?: 2 | 3 | 4 | 5 | 6;
		emptyMessage?: string;
		emptyHint?: string;
		children: Snippet<[T]>;
	}

	let {
		open = $bindable(false),
		title = 'Gallery',
		items = [],
		columns = 4,
		emptyMessage = 'No items to display',
		emptyHint = '',
		children
	}: Props = $props();

	function close() {
		open = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		} else if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
			handleBackdropClick(event as any);
		}
	}

	function getColumnWidth(cols: number): string {
		return `repeat(auto-fill, minmax(${Math.floor(800 / cols)}px, 1fr))`;
	}
</script>

{#if open}
	<div
		class="gallery-backdrop"
		role="button"
		tabindex="0"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		transition:fade={{ duration: 200 }}
	>
		<div class="gallery-panel" transition:fly={{ y: 20, duration: 300 }}>
			<div class="gallery-header">
				<h2>{title}</h2>
				<button class="close-btn" onclick={close} aria-label="Close">&times;</button>
			</div>
			<div class="gallery-content">
				{#if items.length === 0}
					<div class="empty-state">
						<p>{emptyMessage}</p>
						{#if emptyHint}
							<p class="hint">{emptyHint}</p>
						{/if}
					</div>
				{:else}
					<div class="gallery-grid" style={`--gallery-columns: ${getColumnWidth(columns)};`}>
						{#each items as item}
							{@render children(item)}
						{/each}
					</div>
				{/if}
			</div>
			<div class="gallery-footer">
				<span class="count"
					>{items.length} item{items.length !== 1 ? 's' : ''}</span
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.gallery-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.gallery-panel {
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		width: 100%;
		max-width: 1200px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
	}

	.gallery-header {
		padding: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	.gallery-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #f8fafc;
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #f8fafc;
	}

	.gallery-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		min-height: 0;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #94a3b8;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.empty-state .hint {
		font-size: 0.9rem;
		color: #64748b;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: var(--gallery-columns);
		gap: 1.5rem;
	}

	.count {
		color: #94a3b8;
		font-size: 0.9rem;
	}

	.gallery-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.gallery-panel {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.gallery-grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			gap: 1rem;
		}

		.gallery-backdrop {
			padding: 0;
		}
	}
</style>
