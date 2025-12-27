<script lang="ts">
	import type { Monster } from './types';
	import CardActionMenu from '../CardActionMenu.svelte';
	import MonsterCardPreview from '../monsters/MonsterCardPreview.svelte';

	interface Props {
		monsters: Monster[];
		onEdit: (monster: Monster) => void;
	}

	let { monsters, onEdit }: Props = $props();
</script>

<div class="monsters-view">
	<div class="monsters-grid">
		{#each monsters as monster (monster.id)}
			<div class="monster-card-wrapper">
				<MonsterCardPreview {monster} />
				<div class="card-actions">
					<CardActionMenu
						onEdit={() => onEdit(monster)}
						onDelete={null}
						onGenerate={null}
					/>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.monsters-view {
		padding: 0.5rem 0;
	}

	.monsters-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.monster-card-wrapper {
		position: relative;
		width: 600px;
	}

	.card-actions {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 10;
	}
</style>
