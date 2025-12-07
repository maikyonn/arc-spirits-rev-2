<script lang="ts">
	import type { ArtifactRow, OriginRow, GuardianRow, RuneRow, ArtifactTagRow } from '$lib/types/gameData';
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { generateRuneIconSVG } from '$lib/utils/runeIconGenerator';

	export let artifacts: ArtifactRow[] = [];
	export let origins: OriginRow[] = [];
	export let guardians: Pick<GuardianRow, 'id' | 'name'>[] = [];
	export let runes: RuneRow[] = [];
	export let tags: ArtifactTagRow[] = [];

	const dispatch = createEventDispatcher();

	function hexToRgba(hex: string, alpha = 0.25) {
		const sanitized = /^#([A-Fa-f0-9]{6})$/.test(hex) ? hex : '#ffffff';
		const r = parseInt(sanitized.slice(1, 3), 16);
		const g = parseInt(sanitized.slice(3, 5), 16);
		const b = parseInt(sanitized.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function getArtifactStyleVars(artifact: ArtifactRow) {
		// Guardian artifacts get red color
		if (artifact.guardian_id) {
			const guardianColor = '#ef4444'; // Red
			return {
				color: guardianColor
			};
		}
		
		// Use the color from the first tag if available
		if (artifact.tag_ids && artifact.tag_ids.length > 0 && artifact.tag_ids[0]) {
			const firstTag = tags.find((t) => t.id === artifact.tag_ids![0]);
			if (firstTag && firstTag.color) {
				return {
					color: firstTag.color
				};
			}
		}
		
		// Default to white if no tags
		return { color: '#ffffff' };
	}

	function getRuneDetails(runeId: string) {
		const rune = runes.find((r) => r.id === runeId);
		if (!rune) return null;
		const origin = origins.find((o) => o.id === rune.origin_id);
		
		let iconUrl = null;
		if (origin?.icon_png) {
			const path = origin.icon_png.startsWith('origin_icons/') ? origin.icon_png : `origin_icons/${origin.icon_png}`;
			const { data } = supabase.storage.from('game_assets').getPublicUrl(path);
			iconUrl = data?.publicUrl;
		}

		return {
			name: rune.name,
			originName: origin?.name,
			originIcon: origin?.icon_emoji,
			iconUrl
		};
	}

	const guardianName = (guardianId: string | null) =>
		guardianId ? guardians.find((guardian) => guardian.id === guardianId)?.name ?? 'Unknown Guardian' : '';

	const artifactLinkLabel = (artifact: ArtifactRow) => {
		if (artifact.guardian_id) {
			return guardianName(artifact.guardian_id) || 'Unknown Guardian';
		}
		return 'Artifact';
	};

	function handleCardClick(artifact: ArtifactRow) {
		dispatch('edit', artifact);
	}

	function handleKeydown(event: KeyboardEvent, artifact: ArtifactRow) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleCardClick(artifact);
		}
	}

	function handleDeleteClick(event: MouseEvent, artifact: ArtifactRow) {
		event.stopPropagation();
		dispatch('delete', artifact);
	}

</script>

<div class="artifact-grid">
	{#each artifacts as artifact (artifact.id)}
		{@const styleVars = getArtifactStyleVars(artifact)}
		<div 
			class="artifact-card"
			role="button"
			tabindex="0"
			on:click={() => handleCardClick(artifact)}
			on:keydown={(e) => handleKeydown(e, artifact)}
			style="--card-color: {styleVars.color || '#ffffff'};"
		>
			<div class="card-header">
				<div class="header-content">
					<h3 style="color: var(--card-color);">{artifact.name}</h3>
				</div>
				<button 
					class="delete-btn" 
					on:click={(e) => handleDeleteClick(e, artifact)}
					aria-label="Delete artifact"
					title="Delete artifact"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
						<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
					</svg>
				</button>
			</div>
			<div class="card-body">
				<p class="benefit">{artifact.benefit}</p>
			</div>
			<div class="card-footer">
				<div class="tags-container">
					<span class="tag origin-tag">{artifactLinkLabel(artifact)}</span>
					{#if artifact.guardian_id}
						<span class="tag guardian-tag">Guardian</span>
					{/if}
					{#if artifact.tag_ids && artifact.tag_ids.length > 0}
						{#each artifact.tag_ids as tagId}
							{@const tag = tags.find((t) => t.id === tagId)}
							{#if tag}
								<span class="tag" style={`background:${hexToRgba(tag.color ?? '#6b7280',0.15)};border-color:${tag.color ?? '#6b7280'};color:${tag.color ?? '#e5e7eb'}`}>
									{tag.name}
								</span>
							{/if}
						{/each}
					{/if}
				</div>
				{#if artifact.recipe_box && artifact.recipe_box.length > 0}
					<div class="recipe-list">
						{#each artifact.recipe_box as item}
							{@const rune = getRuneDetails(item.rune_id)}
							{#if rune}
								{#each Array(item.quantity) as _}
									<div class="rune-icon-wrapper">
										<div class="rune-icon" title={rune.name}>
											{#if rune.iconUrl}
												<img src={rune.iconUrl} alt={rune.originName || 'Rune'} />
											{:else if rune.originIcon}
												<span>{rune.originIcon}</span>
											{:else}
												<span class="rune-fallback">R</span>
											{/if}
										</div>
									</div>
								{/each}
							{:else}
								<div class="rune-fallback">?</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.artifact-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, 300px);
		grid-auto-rows: 225px;
		gap: 1rem;
		align-items: start;
		justify-content: start;
	}

	.artifact-card {
		/* Use CSS variables for dynamic coloring */
		background: linear-gradient(145deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
		border: 3px solid var(--card-color);
		border-radius: 16px;
		padding: 0;
		display: flex;
		flex-direction: column;
		position: relative;
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s;
		width: 300px;
		height: 225px;
	}

	.artifact-card:hover {
		transform: translateY(-4px);
		border-color: #fff;
		z-index: 10;
	}
	
	.artifact-card:focus-visible {
		border-color: #fff;
		outline: 2px solid rgba(255, 255, 255, 0.5);
		outline-offset: 2px;
	}

	.card-header {
		padding: 1rem 1rem 0rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: linear-gradient(to bottom, rgba(255,255,255,0.05), transparent);
	}

	.header-content {
		flex: 1;
		min-width: 0; /* Allow truncation */
	}

	.header-content h3 {
		font-size: 1.25rem;
		font-weight: 800;
		margin: 0 0 0.25rem 0;
		color: #fff;
		text-shadow: 2px 2px 0px rgba(0,0,0,0.8);
		letter-spacing: 0.02em;
		line-height: 1.1;
	}

	.delete-btn {
		background: transparent;
		border: none;
		color: #64748b;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0; /* Hidden by default */
	}

	.artifact-card:hover .delete-btn,
	.delete-btn:focus-visible {
		opacity: 1; /* Show on hover */
	}

	.delete-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}
	
	.delete-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.card-body {
		padding: 0rem 1rem;
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}
	
	.benefit {
		font-size: 1.1rem;
		color: rgba(255, 255, 255, 0.9);
		line-height: 1.4;
		font-weight: 500;
		text-shadow: 1px 1px 0px rgba(0,0,0,0.5);
	}

	.benefit::-webkit-scrollbar {
		width: 4px;
	}
	
	.benefit::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.benefit::-webkit-scrollbar-thumb {
		background-color: rgba(148, 163, 184, 0.3);
		border-radius: 4px;
	}

	.card-footer {
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: flex-end;
		align-items: flex-end;
		gap: 0.75rem;
		background: linear-gradient(to top, rgba(0,0,0,0.2), transparent);
		position: relative;
		min-height: 60px;
	}

	.tags-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: flex-end;
		position: absolute;
		left: 1rem;
		bottom: 0.75rem;
		right: auto;
		max-width: calc(100% - 200px);
	}

	.recipe-list {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		justify-content: flex-end;
		flex-shrink: 0;
		position: absolute;
		right: 1rem;
		bottom: 0.75rem;
		
		/* Recipe Box Styling - Comic Style */
		background: rgba(0, 0, 0, 0.6);
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 10px;
		padding: 0.4rem;
		box-shadow: 3px 3px 0px rgba(0,0,0,0.3);
	}

	.rune-icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.rune-icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
	}

	.rune-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
	}

	.rune-fallback {
		font-size: 1rem;
		color: #94a3b8;
	}

	.origin-tag {
		background: #334155;
		border: 2px solid rgba(255, 255, 255, 0.5);
		color: #fff;
		white-space: normal;
		text-align: left;
		word-break: break-word;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		box-shadow: 2px 2px 0px rgba(0,0,0,0.3);
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		line-height: 1.2;
	}

	.tag {
		/* General tag styling update */
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
		line-height: 1.2;
	}
	
</style>
