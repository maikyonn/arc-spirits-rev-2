<script lang="ts">
	import type { CallingOrbImageRow, OriginRow } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { Button } from '$lib/components/ui';

	type Props = {
		origins: OriginRow[];
		orbImages: CallingOrbImageRow[];
		onDelete: (imageId: string) => Promise<void>;
		onRefresh: () => Promise<void>;
	};

	let { origins, orbImages, onDelete, onRefresh }: Props = $props();

	// Map for efficient origin name lookup
	const originMap = $derived(new Map(origins.map((o) => [o.id, o])));

	// Track loading state for individual images
	let loadingStates = $state<Map<string, boolean>>(new Map());
	let deletingId = $state<string | null>(null);

	function getOriginName(originId: string): string {
		return originMap.get(originId)?.name ?? 'Unknown Origin';
	}

	function getImageUrl(imagePath: string | null, updatedAt?: string | null): string | null {
		return publicAssetUrl(imagePath, { updatedAt: updatedAt ?? undefined });
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Unknown date';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	async function handleDelete(imageId: string) {
		const confirmed = confirm('Are you sure you want to delete this calling orb image?');
		if (!confirmed) return;

		deletingId = imageId;
		try {
			await onDelete(imageId);
			await onRefresh();
		} catch (err) {
			console.error('Failed to delete calling orb:', err);
			alert('Failed to delete calling orb. Please try again.');
		} finally {
			deletingId = null;
		}
	}

	async function handleDownload(image: CallingOrbImageRow) {
		const imageUrl = getImageUrl(image.image_path, image.updated_at);
		if (!imageUrl) {
			alert('Image URL not available');
			return;
		}

		try {
			const originName = getOriginName(image.origin_id);
			const filename = `calling_orb_${originName.toLowerCase().replace(/\s+/g, '_')}.png`;

			// Fetch the image
			const response = await fetch(imageUrl);
			if (!response.ok) throw new Error('Failed to fetch image');

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);

			// Create download link
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			// Cleanup
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download image:', err);
			alert('Failed to download image. Please try again.');
		}
	}

	function handleImageLoad(imageId: string) {
		loadingStates = new Map(loadingStates.set(imageId, false));
	}

	function handleImageLoadStart(imageId: string) {
		loadingStates = new Map(loadingStates.set(imageId, true));
	}
</script>

{#if orbImages.length === 0}
	<div class="empty-state">
		<p>No calling orbs generated yet</p>
		<small>Generate calling orb images to see them here</small>
	</div>
{:else}
	<div class="orb-grid">
		{#each orbImages as image (image.id)}
			{@const imageUrl = getImageUrl(image.image_path, image.updated_at)}
			{@const originName = getOriginName(image.origin_id)}
			{@const isLoading = loadingStates.get(image.id) ?? true}
			{@const isDeleting = deletingId === image.id}

			<article class="orb-card" class:deleting={isDeleting}>
				<div class="orb-card__image-container">
					{#if imageUrl}
						{#if isLoading}
							<div class="orb-card__loading">Loading...</div>
						{/if}
						<img
							class="orb-card__image"
							class:loading={isLoading}
							src={imageUrl}
							alt={`Calling orb for ${originName}`}
							onload={() => handleImageLoad(image.id)}
							onloadstart={() => handleImageLoadStart(image.id)}
						/>
					{:else}
						<div class="orb-card__no-image">Image not available</div>
					{/if}
				</div>

				<div class="orb-card__content">
					<h3 class="orb-card__title">{originName}</h3>
					<p class="orb-card__date">{formatDate(image.created_at)}</p>

					<div class="orb-card__actions">
						<Button
							variant="secondary"
							size="sm"
							onclick={() => handleDownload(image)}
							disabled={isDeleting}
						>
							Download
						</Button>
						<Button
							variant="danger"
							size="sm"
							onclick={() => handleDelete(image.id)}
							disabled={isDeleting}
						>
							{isDeleting ? 'Deleting...' : 'Delete'}
						</Button>
					</div>
				</div>
			</article>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1.5rem;
		text-align: center;
		color: #64748b;
		background: rgba(30, 41, 59, 0.2);
		border: 1px dashed rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		min-height: 200px;
	}

	.empty-state p {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #94a3b8;
	}

	.empty-state small {
		font-size: 0.75rem;
		color: #64748b;
	}

	.orb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1rem;
	}

	.orb-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		overflow: hidden;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	.orb-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transform: translateY(-2px);
	}

	.orb-card.deleting {
		opacity: 0.5;
		pointer-events: none;
	}

	.orb-card__image-container {
		position: relative;
		width: 100%;
		height: 200px;
		background: rgba(15, 23, 42, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.orb-card__image {
		width: 100%;
		height: 100%;
		object-fit: contain;
		transition: opacity 0.2s ease;
	}

	.orb-card__image.loading {
		opacity: 0;
	}

	.orb-card__loading,
	.orb-card__no-image {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #64748b;
		font-size: 0.75rem;
	}

	.orb-card__content {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.orb-card__title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.orb-card__date {
		margin: 0;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.orb-card__actions {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
	}

	.orb-card__actions :global(button) {
		flex: 1;
	}
</style>
