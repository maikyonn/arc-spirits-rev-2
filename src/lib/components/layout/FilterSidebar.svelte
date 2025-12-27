<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		collapsed?: boolean;
		children?: Snippet;
		header?: Snippet;
		footer?: Snippet;
	}

	let {
		collapsed = $bindable(false),
		children,
		header,
		footer
	}: Props = $props();

	function toggleCollapse() {
		collapsed = !collapsed;
	}
</script>

<aside class="filter-sidebar" class:collapsed aria-label="Filters">
	{#if header}
		<div class="filter-sidebar__header">
			{@render header()}
			<button class="filter-sidebar__toggle" onclick={toggleCollapse} aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}>
				{#if collapsed}
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
				{/if}
			</button>
		</div>
	{/if}

	{#if !collapsed}
		<div class="filter-sidebar__content">
			{#if children}
				{@render children()}
			{/if}
		</div>

		{#if footer}
			<div class="filter-sidebar__footer">
				{@render footer()}
			</div>
		{/if}
	{/if}
</aside>

<style>
	.filter-sidebar {
		position: sticky;
		top: 0;
		width: 280px;
		height: fit-content;
		max-height: 100vh;
		background: rgba(8, 14, 32, 0.95);
		border: 1px solid rgba(94, 114, 228, 0.28);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: width 0.3s ease, border-color 0.3s ease;
	}

	.filter-sidebar.collapsed {
		width: 48px;
		border-color: rgba(94, 114, 228, 0.15);
	}

	.filter-sidebar__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid rgba(94, 114, 228, 0.18);
		background: rgba(8, 14, 32, 0.98);
		flex-shrink: 0;
		gap: 0.75rem;
	}

	.filter-sidebar.collapsed .filter-sidebar__header {
		padding: 1rem 0.5rem;
		justify-content: center;
	}

	.filter-sidebar__toggle {
		background: rgba(30, 41, 59, 0.88);
		border: none;
		color: #94a3b8;
		border-radius: 6px;
		padding: 0.4rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: background 0.15s ease, color 0.15s ease;
		flex-shrink: 0;
	}

	.filter-sidebar__toggle:hover {
		background: rgba(59, 130, 246, 0.35);
		color: #f8fafc;
	}

	.filter-sidebar__content {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		scrollbar-width: thin;
		background: linear-gradient(180deg, rgba(12, 20, 38, 0.92), rgba(12, 20, 38, 0.78));
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.filter-sidebar__footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid rgba(94, 114, 228, 0.18);
		background: rgba(8, 14, 32, 0.98);
		flex-shrink: 0;
	}

	@media (max-width: 1024px) {
		.filter-sidebar {
			position: fixed;
			left: 0;
			top: 0;
			bottom: 0;
			z-index: 900;
			width: 280px;
			max-height: 100vh;
			border-radius: 0;
			border-left: none;
		}

		.filter-sidebar.collapsed {
			width: 48px;
		}
	}

	@media (max-width: 768px) {
		.filter-sidebar {
			width: 100%;
			max-width: 320px;
		}

		.filter-sidebar.collapsed {
			width: 48px;
		}

		.filter-sidebar__content {
			padding: 1rem;
		}
	}
</style>
