<script lang="ts">
	import { onMount } from 'svelte';
	import { rarityColors, type Rarity, type RarityColors } from '$lib/stores/rarityColors';

	let colors: RarityColors = {
		Rare: '#60a5fa',
		Epic: '#a78bfa',
		Legendary: '#fbbf24'
	};

let previewRarity: Rarity = 'Rare';

const rarities: Rarity[] = ['Rare', 'Epic', 'Legendary'];

	onMount(() => {
		const unsubscribe = rarityColors.subscribe((value) => {
			colors = { ...value };
		});
		return unsubscribe;
	});

	function updateColor(rarity: Rarity, color: string) {
		colors = { ...colors, [rarity]: color };
		rarityColors.set(colors);
	}

	function resetColors() {
		rarityColors.reset();
		colors = {
			Rare: '#60a5fa',
			Epic: '#a78bfa',
			Legendary: '#fbbf24'
		};
	}

function hexToRgba(hex: string, alpha = 0.25) {
	const sanitized = /^#([A-Fa-f0-9]{6})$/.test(hex) ? hex : '#60a5fa';
	const r = parseInt(sanitized.slice(1, 3), 16);
	const g = parseInt(sanitized.slice(3, 5), 16);
	const b = parseInt(sanitized.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRarityColor(rarity: Rarity) {
	return colors[rarity] || '#60a5fa';
}

$: previewColor = getRarityColor(previewRarity);
$: previewGlow = hexToRgba(previewColor, 0.25);
$: previewBackground = hexToRgba(previewColor, 0.15);
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Settings</h1>
			<p>Customize card appearance by rarity</p>
		</div>
	</header>

	<div class="settings-content">
		<section class="settings-section">
			<h2>Rarity Colors</h2>
			<p class="section-description">
				Choose colors for each rarity tier. Cards will use these colors for borders and accents.
			</p>

			<div class="color-controls">
				{#each rarities as rarity}
					<div class="color-control">
						<label>
							<span class="color-label">{rarity}</span>
							<div class="color-input-wrapper">
								<input
									type="color"
									value={colors[rarity]}
									oninput={(e) => updateColor(rarity, e.currentTarget.value)}
									class="color-input"
								/>
								<input
									type="text"
									value={colors[rarity]}
									oninput={(e) => updateColor(rarity, e.currentTarget.value)}
									class="color-text-input"
									pattern="#[0-9A-Fa-f]{6}"
									placeholder="#000000"
								/>
							</div>
						</label>
					</div>
				{/each}
			</div>

			<div class="settings-actions">
				<button class="btn" onclick={resetColors}>Reset to Defaults</button>
			</div>
		</section>

		<section class="settings-section">
			<h2>Preview</h2>
			<p class="section-description">See how cards look with your color choices.</p>

			<div class="preview-controls">
				<label>
					Preview Rarity:
					<select bind:value={previewRarity}>
						<option value="Rare">Rare</option>
						<option value="Epic">Epic</option>
						<option value="Legendary">Legendary</option>
					</select>
				</label>
			</div>

			<div class="preview-grid">
				<article
					class="card artifact-card preview-card"
					style:--rarity-color={previewColor}
					style:--rarity-border={previewColor}
					style:--rarity-glow={previewGlow}
					style:--rarity-background={previewBackground}
				>
					<header>
						<div>
							<h2>Sample Artifact</h2>
							<small>Origin Name</small>
						</div>
					</header>
					<div class="artifact-card__body">
						<p class="benefit">
							This is a preview of how an artifact card will look with the {previewRarity} rarity color
							scheme. The border and accents will use your selected color.
						</p>
						<div class="recipe-icons">
							<div class="rune-icon-container" title="Sample Rune">
								<div class="rune-icon-placeholder">🔮</div>
							</div>
							<div class="rune-icon-container" title="Sample Rune">
								<div class="rune-icon-placeholder">🔮</div>
							</div>
						</div>
					</div>
				</article>
			</div>
		</section>
	</div>
</section>

<style>
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.settings-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.settings-section h2 {
		margin: 0 0 0.5rem 0;
		color: #f8fafc;
	}

	.section-description {
		margin: 0 0 1.5rem 0;
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.color-controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.color-control {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.color-label {
		font-weight: 600;
		color: #f8fafc;
		font-size: 0.95rem;
	}

	.color-input-wrapper {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.color-input {
		width: 60px;
		height: 40px;
		padding: 0;
		border: 2px solid rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		cursor: pointer;
		background: none;
	}

	.color-text-input {
		flex: 1;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.3);
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		color: #f8fafc;
	}

	.settings-actions {
		display: flex;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
	}

	.preview-controls {
		margin-bottom: 1.5rem;
	}

	.preview-controls label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #cbd5f5;
	}

	.preview-controls select {
		padding: 0.4rem 0.7rem;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.preview-card {
		border: 1px solid rgba(148, 163, 184, 0.18) !important;
		border-left: 4px solid var(--rarity-color, #60a5fa) !important;
		box-shadow: 0 0 20px var(--rarity-glow, rgba(96, 165, 250, 0.25)) !important;
		transition: box-shadow 0.3s ease, border-left-color 0.3s ease;
	}

	.preview-card:hover {
		box-shadow: 0 0 30px var(--rarity-glow, rgba(96, 165, 250, 0.4)) !important;
	}

	.rune-icon-placeholder {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		background: rgba(148, 163, 184, 0.1);
		border-radius: 6px;
	}

	.artifact-card__body {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		margin-top: 0.5rem;
	}

	.benefit {
		margin: 0;
		color: #cbd5f5;
		white-space: pre-wrap;
		flex: 1;
	}

	.recipe-icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: auto;
		justify-content: flex-end;
		align-items: center;
		padding-top: 0.5rem;
	}

	.rune-icon-container {
		position: relative;
		display: inline-block;
	}
</style>

