<script lang="ts">
	import type { RuneRow } from '$lib/types/gameData';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
		get: (id: string | null) => { color?: string | null } | undefined;
	};

	type Props = {
		runes: RuneRow[];
		originLookup: LookupService;
		classLookup: LookupService;
		publicUrl: (path: string) => string;
		onEdit?: (rune: RuneRow) => void;
		onDelete?: (rune: RuneRow) => void;
	};

	let { runes, originLookup, classLookup, publicUrl, onEdit, onDelete }: Props = $props();

	function getRuneCategory(rune: RuneRow): string {
		if (rune.origin_id) return originLookup.getLabel(rune.origin_id, 'Unknown Origin');
		if (rune.class_id) return classLookup.getLabel(rune.class_id, 'Unknown Class');
		return 'Unassigned';
	}

	function getRuneCategoryType(rune: RuneRow): 'origin' | 'class' | 'unassigned' {
		if (rune.origin_id) return 'origin';
		if (rune.class_id) return 'class';
		return 'unassigned';
	}

	function getRuneColor(rune: RuneRow): string {
		if (rune.origin_id) {
			const origin = originLookup.get(rune.origin_id);
			return origin?.color ?? '#a5b4fc';
		}
		if (rune.class_id) {
			const cls = classLookup.get(rune.class_id);
			return cls?.color ?? '#fbbf24';
		}
		return '#64748b';
	}
</script>

{#if runes.length === 0}
	<div class="empty-state">No runes available.</div>
{:else}
	<div class="gallery-grid">
		{#each runes as rune (rune.id)}
			{@const categoryType = getRuneCategoryType(rune)}
			{@const color = getRuneColor(rune)}
			<article class="rune-card" style="--accent-color: {color}">
				<div class="image-container">
					{#if rune.icon_path}
						<img src={publicUrl(rune.icon_path)} alt={rune.name} />
					{:else}
						<div class="no-image">No Icon</div>
					{/if}
				</div>
				<div class="info">
					<h3 class="name">{rune.name}</h3>
					<div class="category">
						<span class="category-badge {categoryType}">
							{categoryType === 'origin' ? 'Origin' : categoryType === 'class' ? 'Class' : ''}
						</span>
						<span class="category-name" style="color: {color}">{getRuneCategory(rune)}</span>
					</div>
				</div>
				{#if onEdit || onDelete}
					<div class="actions">
						{#if onEdit}
							<button class="btn-action" onclick={() => onEdit(rune)} title="Edit">
								✏️
							</button>
						{/if}
						{#if onDelete}
							<button class="btn-action btn-delete" onclick={() => onDelete(rune)} title="Delete">
								🗑️
							</button>
						{/if}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
	}

	.gallery-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	}

	.rune-card {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 10px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.2s;
		position: relative;
	}

	.rune-card:hover {
		border-color: var(--accent-color, rgba(148, 163, 184, 0.3));
		background: rgba(15, 23, 42, 0.7);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.image-container {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6));
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.1);
		overflow: hidden;
	}

	.image-container img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 0.25rem;
	}

	.no-image {
		color: #475569;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.name {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.category {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.category-badge {
		display: inline-block;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.55rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.category-badge.origin {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.category-badge.class {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.category-badge.unassigned {
		background: rgba(100, 116, 139, 0.2);
		color: #94a3b8;
	}

	.category-name {
		font-size: 0.6rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		gap: 0.25rem;
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.rune-card:hover .actions {
		opacity: 1;
	}

	.btn-action {
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		padding: 0.2rem 0.35rem;
		cursor: pointer;
		font-size: 0.65rem;
		transition: all 0.15s;
	}

	.btn-action:hover {
		background: rgba(30, 41, 59, 0.95);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.btn-delete:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.4);
	}
</style>
