<script lang="ts">
	import type { AssetImage } from './types';

	type Props = {
		originImages: AssetImage[];
		runeImages: AssetImage[];
		hexSpiritImages: AssetImage[];
		diceFaceImages: AssetImage[];
		miscAssetImages: AssetImage[];
	};

	let { originImages, runeImages, hexSpiritImages, diceFaceImages, miscAssetImages }: Props =
		$props();
</script>

<div class="grid-view">
	<section class="asset-section">
		<h2>Origin Icons ({originImages.length})</h2>
		<div class="asset-grid">
			{#each originImages as asset}
				<div class="asset-item">
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No origin icons found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Rune Icons ({runeImages.length})</h2>
		<div class="asset-grid">
			{#each runeImages as asset}
				<div class="asset-item">
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No rune icons found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Hex Spirit Images ({hexSpiritImages.length})</h2>
		<div class="asset-grid">
			{#each hexSpiritImages as asset}
				<div class="asset-item">
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No hex spirit images found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Dice Faces ({diceFaceImages.length})</h2>
		<div class="asset-grid">
			{#each diceFaceImages as asset}
				<div class="asset-item">
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No dice faces found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Misc Assets ({miscAssetImages.length})</h2>
		<div class="asset-grid">
			{#each miscAssetImages as asset}
				<div class="asset-item">
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No misc assets found</p>
			{/each}
		</div>
	</section>
</div>

<style>
	.grid-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.asset-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.75rem;
	}

	.asset-section h2 {
		margin: 0 0 0.5rem 0;
		color: #f8fafc;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.asset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
		gap: 0.5rem;
	}

	.asset-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		transition: transform 0.15s ease;
	}

	.asset-item:hover {
		transform: translateY(-2px);
	}

	.asset-item img {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	.asset-name {
		font-size: 0.7rem;
		color: #cbd5e1;
		text-align: center;
		word-break: break-word;
	}

	.empty-message {
		color: #94a3b8;
		font-size: 0.7rem;
		font-style: italic;
		margin: 0.5rem 0;
	}
</style>
