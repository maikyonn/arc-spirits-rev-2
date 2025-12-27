<script lang="ts">
	import type { HexSpiritRow } from '$lib/types/gameData';

	type HexSpirit = HexSpiritRow & {
		game_print_image_url?: string | null;
		game_print_no_icons_url?: string | null;
		art_raw_image_url?: string | null;
	};

	interface Props {
		spirit: HexSpirit;
	}

	let { spirit }: Props = $props();

	type ImageVariant = 'raw' | 'base' | 'final';

	let selectedVariant: ImageVariant = $state('final');

	const variants = $derived([
		{
			id: 'raw' as const,
			label: 'Raw Art',
			url: spirit.art_raw_image_url
		},
		{
			id: 'base' as const,
			label: 'Game Print (Base)',
			url: spirit.game_print_no_icons_url
		},
		{
			id: 'final' as const,
			label: 'Game Print (Final)',
			url: spirit.game_print_image_url
		}
	]);

	const currentVariant = $derived(variants.find((v) => v.id === selectedVariant));
	const currentUrl = $derived(currentVariant?.url);
</script>

<div class="image-viewer">
	<div class="tabs">
		{#each variants as variant}
			<button
				class="tab"
				class:active={selectedVariant === variant.id}
				class:disabled={!variant.url}
				onclick={() => {
					if (variant.url) {
						selectedVariant = variant.id;
					}
				}}
				disabled={!variant.url}
			>
				{variant.label}
			</button>
		{/each}
	</div>

	<div class="image-container">
		{#if currentUrl}
			<img src={currentUrl} alt="{currentVariant?.label} - {spirit.name}" />
		{:else}
			<div class="placeholder">
				<div class="placeholder-icon">🖼️</div>
				<p class="placeholder-text">No image available</p>
				<p class="placeholder-hint">
					{currentVariant?.label || 'This variant'} has not been uploaded yet
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.image-viewer {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		padding-bottom: 0.5rem;
	}

	.tab {
		padding: 0.5rem 1rem;
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.375rem;
		color: #94a3b8;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab:hover:not(.disabled) {
		border-color: rgba(148, 163, 184, 0.4);
		color: #e2e8f0;
	}

	.tab.active {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.5);
		color: #93c5fd;
	}

	.tab.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.image-container {
		position: relative;
		width: 100%;
		min-height: 400px;
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.5rem;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.image-container img {
		width: 100%;
		height: auto;
		display: block;
		object-fit: contain;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		text-align: center;
	}

	.placeholder-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		opacity: 0.3;
	}

	.placeholder-text {
		color: #e2e8f0;
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
	}

	.placeholder-hint {
		color: #94a3b8;
		font-size: 0.875rem;
		margin: 0;
	}
</style>
