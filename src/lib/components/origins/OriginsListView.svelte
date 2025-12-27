<script lang="ts">
	import type { OriginRow, CallingCard } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils';
	import { Button } from '$lib/components/ui';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';

	type Props = {
		origins: OriginRow[];
		onEdit: (origin: OriginRow) => void;
		onDelete: (origin: OriginRow) => void;
		onDeleteMultiple: (ids: string[]) => void;
	};

	let { origins, onEdit, onDelete, onDeleteMultiple }: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());

	function getIconUrl(path: string | null | undefined, updatedAt?: string | number | null): string | null {
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function toggleSelect(id: string, event: Event) {
		event.stopPropagation();
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function selectAll() {
		selectedIds = new Set(origins.map((o) => o.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		onDeleteMultiple(Array.from(selectedIds));
		selectedIds = new Set();
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={origins.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<div class="list-view">
	{#each origins as origin (origin.id)}
		<article class="origin-card" class:selected={selectedIds.has(origin.id)}>
			<header>
				<div class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={selectedIds.has(origin.id)}
						onclick={(e) => toggleSelect(origin.id, e)}
						aria-label="Select {origin.name}"
					/>
				</div>
				<div class="header-content">
					<div class="origin-card__identity">
						{#if getIconUrl(origin.icon_png, origin.updated_at)}
							<img
								class="origin-card__icon-image"
								src={getIconUrl(origin.icon_png, origin.updated_at)}
								alt={`${origin.name} icon`}
							/>
						{:else if origin.icon_emoji}
							<span class="origin-card__icon">{origin.icon_emoji}</span>
						{/if}
						<div>
							<h2>{origin.name}</h2>
							<small>Position {origin.position}</small>
						</div>
					</div>
					<CardActionMenu
						onEdit={() => onEdit(origin)}
						onDelete={() => onDelete(origin)}
						onGenerate={null}
					/>
				</div>
			</header>
			{#if origin.description}
				<p class="muted">{origin.description}</p>
			{/if}
			{#if (origin.calling_card as CallingCard | null)?.enabled && (origin.calling_card as CallingCard)?.breakpoints?.length}
				{@const callingCard = origin.calling_card as CallingCard}
				<ul class="calling-card-breakpoints">
					{#each callingCard.breakpoints as bp, index (`${origin.id}-cc-bp-${index}`)}
						<li class="calling-card-breakpoints__item">
							<div class="calling-card-breakpoints__line">
								<span class="calling-card-breakpoints__count">
									({bp.count} {bp.label || 'Unique'})
								</span>
								<div class="calling-card-breakpoints__effects">
									<span class="effect-tag">
										{bp.icon_ids?.length || 0} icon{bp.icon_ids?.length !== 1 ? 's' : ''}
									</span>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="meta">
				{#if origin.color}
					<span class="tag">
						Color:
						<span class="swatch" style={`background:${origin.color}`}></span>
						{origin.color}
					</span>
				{/if}
			</div>
		</article>
	{:else}
		<div class="empty">No origins found</div>
	{/each}
</div>

<style>
	.list-view {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.5rem;
	}

	.origin-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		transition: all 0.15s ease;
	}

	.origin-card.selected {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.3);
	}

	.origin-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		flex: 1;
	}

	.origin-card__identity {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.origin-card__icon {
		font-size: 1.4rem;
	}

	.origin-card__icon-image {
		width: 24px;
		height: 24px;
		object-fit: contain;
		border-radius: 4px;
	}

	.origin-card h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.origin-card small {
		display: block;
		color: #94a3b8;
		font-size: 0.65rem;
	}

	.muted {
		color: #cbd5e1;
		margin: 0;
		font-size: 0.7rem;
		white-space: pre-line;
		line-height: 1.4;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.2rem;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.4rem;
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 4px;
		font-size: 0.65rem;
		color: #cbd5e1;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.4);
	}

	.empty {
		grid-column: 1 / -1;
		padding: 1.5rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.calling-card-breakpoints {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.3rem;
	}

	.calling-card-breakpoints__item {
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 6px;
		padding: 0.3rem 0.4rem;
	}

	.calling-card-breakpoints__line {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.calling-card-breakpoints__count {
		font-weight: 600;
		color: #cbd5f5;
		font-size: 0.75rem;
	}

	.calling-card-breakpoints__effects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.effect-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.35rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.18);
		color: #e0e7ff;
		font-size: 0.7rem;
		letter-spacing: 0.02em;
	}
</style>
