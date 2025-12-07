<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ArtifactRow } from '$lib/types/gameData';

	export let isOpen = false;
	export let artifacts: ArtifactRow[] = [];

	// Filter artifacts that have card images
	$: artifactsWithCards = artifacts.filter((a) => a.card_image_path);

	// Get public URL for card image
	function getCardImageUrl(artifact: ArtifactRow): string | null {
		if (!artifact.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(artifact.card_image_path);
		return data?.publicUrl || null;
	}

	function close() {
		isOpen = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}
</script>

{#if isOpen}
	<div class="gallery-backdrop" role="button" tabindex="0" on:click={handleBackdropClick} on:keydown={(e)=> (e.key==="Enter"||e.key===" ") && handleBackdropClick(e as any)} transition:fade={{ duration: 200 }}>
		<div class="gallery-panel" transition:fly={{ y: 20, duration: 300 }}>
			<div class="gallery-header">
				<h2>Artifact Card Gallery</h2>
				<button class="close-btn" on:click={close}>&times;</button>
			</div>
			<div class="gallery-content">
				{#if artifactsWithCards.length === 0}
					<div class="empty-state">
						<p>No card images generated yet.</p>
						<p class="hint">Use "Generate All Cards" to create card images for artifacts.</p>
					</div>
				{:else}
					<div class="gallery-grid">
						{#each artifactsWithCards as artifact}
							{@const imageUrl = getCardImageUrl(artifact)}
							{#if imageUrl}
								<div class="card-item">
									<div class="card-image-wrapper">
										<img src={imageUrl} alt={artifact.name || 'Artifact card'} loading="lazy" />
									</div>
									<div class="card-name">{artifact.name || 'Unnamed Artifact'}</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
			<div class="gallery-footer">
				<span class="count">{artifactsWithCards.length} card{artifactsWithCards.length !== 1 ? 's' : ''} generated</span>
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
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	.card-item {
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.card-item:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.card-image-wrapper {
		width: 100%;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		background: #1e293b;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-image-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.card-name {
		padding: 0.75rem;
		text-align: center;
		font-size: 0.9rem;
		color: #f8fafc;
		font-weight: 500;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
	}

	.gallery-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	.count {
		color: #94a3b8;
		font-size: 0.9rem;
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
	}
</style>

