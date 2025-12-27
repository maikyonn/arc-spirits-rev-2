<script lang="ts">
	import type { IconPoolRow, IconPoolSourceType } from '$lib/types/gameData';
	import IconCard from './IconCard.svelte';

	interface Props {
		allIcons: IconPoolRow[];
		publicUrl: (path: string) => string;
		onEditIcon?: (icon: IconPoolRow) => void;
	}

	let { allIcons, publicUrl, onEditIcon }: Props = $props();

	// Source type display config (excluding 'uploaded' which is handled specially)
	const sourceConfig: Record<Exclude<IconPoolSourceType, 'uploaded'>, { label: string; order: number }> = {
		origin: { label: 'Origins', order: 1 },
		class: { label: 'Classes', order: 2 },
		rune: { label: 'Runes', order: 3 },
		dice_side: { label: 'Dice Sides', order: 4 }
	};

	type GroupEntry = {
		key: string;
		label: string;
		order: number;
		icons: IconPoolRow[];
	};

	// Group icons by source type, with uploaded icons split by tags
	const groupedIcons = $derived.by(() => {
		const groups: GroupEntry[] = [];

		// Standard source type groups
		const sourceGroups: Record<string, IconPoolRow[]> = {
			origin: [],
			class: [],
			rune: [],
			dice_side: []
		};

		// Tag-based groups for uploaded icons
		const tagGroups: Map<string, IconPoolRow[]> = new Map();
		const untaggedUploaded: IconPoolRow[] = [];

		// Sort icons into groups
		for (const icon of allIcons) {
			if (icon.source_type === 'uploaded') {
				if (icon.tags && icon.tags.length > 0) {
					// Add to each tag group
					for (const tag of icon.tags) {
						if (!tagGroups.has(tag)) {
							tagGroups.set(tag, []);
						}
						tagGroups.get(tag)!.push(icon);
					}
				} else {
					untaggedUploaded.push(icon);
				}
			} else if (sourceGroups[icon.source_type]) {
				sourceGroups[icon.source_type].push(icon);
			}
		}

		// Add standard source groups
		for (const [sourceType, config] of Object.entries(sourceConfig)) {
			const icons = sourceGroups[sourceType];
			if (icons.length > 0) {
				icons.sort((a, b) => a.name.localeCompare(b.name));
				groups.push({
					key: sourceType,
					label: config.label,
					order: config.order,
					icons
				});
			}
		}

		// Add tag-based uploaded groups (sorted alphabetically by tag)
		const sortedTags = Array.from(tagGroups.keys()).sort();
		for (const tag of sortedTags) {
			const icons = tagGroups.get(tag)!;
			icons.sort((a, b) => a.name.localeCompare(b.name));
			groups.push({
				key: `uploaded:${tag}`,
				label: `Uploaded: ${tag}`,
				order: 100 + sortedTags.indexOf(tag),
				icons
			});
		}

		// Add untagged uploaded group at the end
		if (untaggedUploaded.length > 0) {
			untaggedUploaded.sort((a, b) => a.name.localeCompare(b.name));
			groups.push({
				key: 'uploaded:untagged',
				label: 'Uploaded (Untagged)',
				order: 999,
				icons: untaggedUploaded
			});
		}

		// Sort groups by order
		return groups.sort((a, b) => a.order - b.order);
	});

	function handleClick(icon: IconPoolRow) {
		if (onEditIcon) {
			onEditIcon(icon);
		}
	}
</script>

<div class="grouped-view">
	{#each groupedIcons as group (group.key)}
		<section class="source-group">
			<header class="group-header">
				<h3 class="group-title">{group.label}</h3>
				<span class="group-count">{group.icons.length}</span>
			</header>
			<div class="grid-view">
				{#each group.icons as icon (icon.id)}
					<IconCard
						name={icon.name}
						imageUrl={publicUrl(icon.file_path)}
						badge={icon.source_type}
						clickable={!!onEditIcon}
						onClick={onEditIcon ? () => handleClick(icon) : undefined}
					/>
				{/each}
			</div>
		</section>
	{:else}
		<div class="empty">No icons available.</div>
	{/each}
</div>

<style>
	.grouped-view {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.source-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 6px;
	}

	.group-title {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: #e2e8f0;
		letter-spacing: 0.02em;
	}

	.group-count {
		font-size: 0.7rem;
		color: #64748b;
		background: rgba(148, 163, 184, 0.15);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
	}

	.grid-view {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	}

	.empty {
		padding: 1.5rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}
</style>
