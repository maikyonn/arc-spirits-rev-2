<script lang="ts">
	import type { Snippet } from 'svelte';

	export interface Tab {
		id: string;
		label: string;
		icon?: string;
	}

	interface Props {
		tabs: Tab[];
		activeTab: string;
		onTabChange?: (tabId: string) => void;
		actions?: Snippet;
	}

	let { tabs, activeTab, onTabChange, actions }: Props = $props();

	function handleTabClick(tabId: string) {
		if (onTabChange) {
			onTabChange(tabId);
		}
	}
</script>

<div class="tab-bar">
	<div class="tab-bar__tabs" role="tablist">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				class="tab-bar__tab"
				class:is-active={activeTab === tab.id}
				aria-selected={activeTab === tab.id}
				tabindex={activeTab === tab.id ? 0 : -1}
				onclick={() => handleTabClick(tab.id)}
			>
				{#if tab.icon}
					<span class="tab-bar__icon">{tab.icon}</span>
				{/if}
				<span class="tab-bar__label">{tab.label}</span>
			</button>
		{/each}
	</div>

	{#if actions}
		<div class="tab-bar__actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.tab-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0 0.5rem;
		background: rgba(15, 23, 42, 0.4);
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		flex-shrink: 0;
		min-height: 32px;
	}

	.tab-bar__tabs {
		display: flex;
		gap: 2px;
	}

	.tab-bar__tab {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		border: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: #64748b;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
	}

	.tab-bar__tab:hover:not(.is-active) {
		background: rgba(51, 65, 85, 0.4);
		color: #94a3b8;
	}

	.tab-bar__tab.is-active {
		background: rgba(51, 65, 85, 0.6);
		color: #f1f5f9;
	}

	.tab-bar__icon {
		font-size: 0.85rem;
		line-height: 1;
	}

	.tab-bar__label {
		letter-spacing: 0.01em;
	}

	.tab-bar__actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	@media (max-width: 640px) {
		.tab-bar {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.tab-bar__tabs {
			flex-shrink: 0;
		}

		.tab-bar__label {
			display: none;
		}

		.tab-bar__tab {
			padding: 0.35rem 0.5rem;
		}

		.tab-bar__icon {
			font-size: 1rem;
		}
	}
</style>
