<script lang="ts">
	import type { Event } from './types';
	import CardActionMenu from '../CardActionMenu.svelte';
	import EventCardPreview from './EventCardPreview.svelte';

	interface Props {
		events: Event[];
		onEdit: (event: Event) => void;
	}

	let { events, onEdit }: Props = $props();
</script>

<div class="events-view">
	<div class="events-grid">
		{#each events as event (event.id)}
			<div class="event-card-wrapper">
				<EventCardPreview {event} />
				<div class="card-actions">
					<CardActionMenu
						onEdit={() => onEdit(event)}
						onDelete={null}
						onGenerate={null}
					/>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.events-view {
		padding: 0.5rem 0;
	}

	.events-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.event-card-wrapper {
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
