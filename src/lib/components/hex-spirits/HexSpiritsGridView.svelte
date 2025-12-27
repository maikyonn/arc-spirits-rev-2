<script lang="ts">
	import type { HexSpiritRow, OriginRow, ClassRow } from '$lib/types/gameData';

	type HexSpirit = HexSpiritRow & {
		game_print_image_url?: string | null;
		art_raw_image_url?: string | null;
	};

	interface Props {
		spirits: HexSpirit[];
		originLookup: {
			getLabel: (id: string | null | undefined, fallback?: string) => string;
		};
		classLookup: {
			getLabel: (id: string | null | undefined, fallback?: string) => string;
		};
	}

	let { spirits, originLookup, classLookup }: Props = $props();

	// Filter spirits with game print images
	const spiritsWithImages = $derived(
		spirits.filter((spirit) => spirit.game_print_image_url)
	);

	// Helper to get primary origin and class
	function primaryOriginId(spirit: HexSpiritRow): string | undefined {
		return spirit.traits?.origin_ids?.[0];
	}

	function primaryClassId(spirit: HexSpiritRow): string | undefined {
		return spirit.traits?.class_ids?.[0];
	}
</script>

{#if spiritsWithImages.length === 0}
	<div class="empty-state">
		<p>No spirits have game print images yet.</p>
	</div>
{:else}
	<div class="header">
		<p class="count-text">
			Showing {spiritsWithImages.length} of {spirits.length} spirits with game prints
		</p>
	</div>

	<div class="grid">
		{#each spiritsWithImages as spirit (spirit.id)}
			<div class="card">
				<div class="image-container">
					<img
						src={spirit.game_print_image_url}
						alt={spirit.name}
						loading="lazy"
					/>
				</div>
				<div class="card-content">
					<h3 class="spirit-name">{spirit.name}</h3>
					<div class="tags">
						<span class="tag tag-origin">
							{originLookup.getLabel(primaryOriginId(spirit), 'Unknown')}
						</span>
						<span class="tag tag-class">
							{classLookup.getLabel(primaryClassId(spirit), 'Unknown')}
						</span>
					</div>
					<div class="cost-badge">
						<span class="cost-label">Cost:</span>
						<span class="cost-value">{spirit.cost}</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		padding: 3rem;
		text-align: center;
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.5rem;
	}

	.empty-state p {
		color: #94a3b8;
		font-size: 1rem;
	}

	.header {
		margin-bottom: 1rem;
	}

	.count-text {
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.card {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.25rem;
		overflow: hidden;
		transition: border-color 0.2s ease;
	}

	.card:hover {
		border-color: rgba(148, 163, 184, 0.5);
	}

	.image-container {
		position: relative;
		width: 100%;
		aspect-ratio: 1.1 / 1;
		overflow: hidden;
	}

	.image-container img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.card-content {
		padding: 0.35rem;
	}

	.spirit-name {
		color: #f8fafc;
		font-size: 0.7rem;
		font-weight: 600;
		margin: 0 0 0.3rem 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tags {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
		margin-bottom: 0.3rem;
	}

	.tag {
		font-size: 0.55rem;
		font-weight: 500;
		padding: 0.1rem 0.25rem;
		border-radius: 0.15rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.tag-origin {
		background: rgba(59, 130, 246, 0.15);
		color: #93c5fd;
	}

	.tag-class {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}

	.cost-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
		padding: 0.15rem 0.3rem;
		border-radius: 0.15rem;
		font-size: 0.6rem;
		font-weight: 600;
	}

	.cost-label {
		opacity: 0.8;
	}

	.cost-value {
		font-weight: 700;
	}
</style>
