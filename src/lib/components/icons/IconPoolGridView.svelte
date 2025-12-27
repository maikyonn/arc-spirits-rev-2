<script lang="ts">
	import type { IconPoolRow, IconPoolSourceType } from '$lib/types/gameData';
	import IconCard from './IconCard.svelte';

	interface Props {
		icons: IconPoolRow[];
		publicUrl: (path: string) => string;
		filter?: IconPoolSourceType | 'all';
		onEdit?: (icon: IconPoolRow) => void;
	}

	let { icons, publicUrl, filter = 'all', onEdit }: Props = $props();

	const filteredIcons = $derived(
		filter === 'all' ? icons : icons.filter((icon) => icon.source_type === filter)
	);

	function handleClick(icon: IconPoolRow) {
		if (onEdit) {
			onEdit(icon);
		}
	}
</script>

<section class="grid-view">
	{#each filteredIcons as icon (icon.id)}
		<IconCard
			name={icon.name}
			imageUrl={publicUrl(icon.file_path)}
			badge={icon.source_type}
			clickable={!!onEdit}
			onClick={onEdit ? () => handleClick(icon) : undefined}
		/>
	{:else}
		<div class="empty">No icons in this category.</div>
	{/each}
</section>

<style>
	.grid-view {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	}

	.empty {
		grid-column: 1 / -1;
		padding: 1.5rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}
</style>
