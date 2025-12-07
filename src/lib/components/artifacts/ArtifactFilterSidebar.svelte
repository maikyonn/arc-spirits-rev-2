<script lang="ts">
	import type { ArtifactTagRow } from '$lib/types/gameData';
	import { createEventDispatcher } from 'svelte';

	export let search = '';
	export let tagFilter: string[] = [];
	export let sortBy: 'name' | 'created' = 'name';
	export let groupByTags = false;
	export let tags: ArtifactTagRow[] = [];

	const dispatch = createEventDispatcher();

	function toggleTag(tagId: string) {
		if (tagFilter.includes(tagId)) {
			tagFilter = tagFilter.filter((t) => t !== tagId);
		} else {
			tagFilter = [...tagFilter, tagId];
		}
	}
</script>

<div class="filters-sidebar">
	<div class="filter-group">
		<label for="search">Search</label>
		<input
			type="text"
			id="search"
			bind:value={search}
			placeholder="Name, benefit, origin..."
			class="search-input"
		/>
	</div>

	<div class="filter-group">
		<label for="sort">Sort By</label>
		<select id="sort" bind:value={sortBy}>
			<option value="name">Name (A-Z)</option>
			<option value="created">Newest First</option>
		</select>
	</div>

	<div class="filter-checkbox">
		<input type="checkbox" id="group-by-tags" bind:checked={groupByTags} />
		<label for="group-by-tags">Group by Tags</label>
	</div>

	<div class="filter-group">
		<div class="tags-header">
			<label for="tags-filter">Tags</label>
			<button class="manage-btn" on:click={() => dispatch('openTagManager')}>Manage</button>
		</div>
		<div id="tags-filter" class="tags-list">
			{#each tags as tag}
				<button
					class="tag-btn"
					class:active={tagFilter.includes(tag.id)}
					style="--tag-color: {tag.color}"
					on:click={() => toggleTag(tag.id)}
				>
					{tag.name}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.filters-sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.3);
		border-right: 1px solid rgba(148, 163, 184, 0.1);
		height: 100%;
		overflow-y: auto;
	}

	.tags-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.manage-btn {
		background: none;
		border: none;
		color: #3b82f6;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
	}

	.manage-btn:hover {
		text-decoration: underline;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	input[type='text'],
	select {
		width: 100%;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #f8fafc;
		padding: 0.5rem;
		border-radius: 6px;
	}

	.filter-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-checkbox label {
		text-transform: none;
		color: #cbd5f5;
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag-btn {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid var(--tag-color);
		color: #cbd5f5;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
		opacity: 0.7;
	}

	.tag-btn:hover {
		opacity: 1;
		transform: translateY(-1px);
	}

	.tag-btn.active {
		background: var(--tag-color);
		color: #0f172a;
		font-weight: 600;
		opacity: 1;
		box-shadow: 0 0 10px var(--tag-color);
	}
</style>
