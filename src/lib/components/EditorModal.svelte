<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	type ModalSize = 'sm' | 'md' | 'lg';

	const KEY_ESCAPE = 'Escape';

	export let title = '';
	export let description: string | null = null;
	export let size: ModalSize = 'md';
	export let closeOnBackdrop = true;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let previousActive: Element | null = null;
	let container: HTMLElement | null = null;

	function widthFor(value: ModalSize): string {
		switch (value) {
			case 'sm':
				return 'min(420px, 92vw)';
			case 'lg':
				return 'min(960px, 92vw)';
			case 'md':
			default:
				return 'min(720px, 92vw)';
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (!closeOnBackdrop) return;
		if (event.target === event.currentTarget) {
			dispatch('close');
		}
	}

	function handleKey(event: KeyboardEvent) {
		if (event.key === KEY_ESCAPE) {
			event.preventDefault();
			dispatch('close');
		}
	}

	function focusContainer() {
		if (container && typeof container.focus === 'function') {
			container.focus({ preventScroll: true });
		}
	}

	onMount(() => {
		previousActive = document.activeElement;
		setTimeout(focusContainer, 0);
		document.addEventListener('keydown', handleKey);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKey);
		if (previousActive instanceof HTMLElement) {
			previousActive.focus({ preventScroll: true });
		}
	});
</script>

<div
	class="editor-modal-backdrop"
	role="presentation"
	tabindex="-1"
	on:click={handleBackdropClick}
	bind:this={container}
	style={`--editor-modal-width: ${widthFor(size)};`}
>
	<div class="editor-modal" role="dialog" aria-modal="true" aria-label={title}>
		<header class="editor-modal__header">
			<div>
				{#if title}
					<h2>{title}</h2>
				{/if}
				{#if description}
					<p class="editor-modal__description">{description}</p>
				{/if}
				<slot name="header" />
			</div>
			<button class="editor-modal__close" type="button" on:click={() => dispatch('close')} aria-label="Close">
				✕
			</button>
		</header>
		<section class="editor-modal__body">
			<slot />
		</section>
		<footer class="editor-modal__footer">
			<slot name="footer" />
		</footer>
	</div>
</div>

<style>
	.editor-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.72);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 2rem 1.25rem;
		z-index: 1200;
		overflow-y: auto;
	}

	.editor-modal {
		width: var(--editor-modal-width);
		background: rgba(8, 14, 32, 0.95);
		border: 1px solid rgba(94, 114, 228, 0.28);
		border-radius: 14px;
		box-shadow: 0 18px 48px rgba(2, 6, 23, 0.6);
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 3rem);
		overflow: hidden;
	}

	.editor-modal__header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.25rem 0.75rem;
		align-items: flex-start;
	}

	.editor-modal__header h2 {
		margin: 0;
		font-size: 1.12rem;
		color: #f8fafc;
		letter-spacing: 0.01em;
	}

	.editor-modal__description {
		margin: 0.3rem 0 0;
		color: #bfc6f9;
		font-size: 0.9rem;
		line-height: 1.35;
	}

	.editor-modal__close {
		border: none;
		background: rgba(30, 41, 59, 0.88);
		color: inherit;
		border-radius: 999px;
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.editor-modal__close:hover {
		background: rgba(59, 130, 246, 0.35);
	}

	.editor-modal__body {
		padding: 0 1.25rem 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		scrollbar-width: thin;
		background: linear-gradient(180deg, rgba(12, 20, 38, 0.92), rgba(12, 20, 38, 0.78));
	}

	.editor-modal__footer {
		padding: 0.75rem 1.25rem 1.25rem;
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
		border-top: 1px solid rgba(94, 114, 228, 0.18);
		background: rgba(8, 14, 32, 0.94);
	}

	@media (max-width: 600px) {
		.editor-modal {
			border-radius: 12px;
			max-height: calc(100vh - 2rem);
		}

		.editor-modal__body {
			padding: 0 1rem 1rem;
		}

		.editor-modal__header {
			padding: 0.85rem 1rem 0.65rem;
		}

		.editor-modal__footer {
			padding: 0.7rem 1rem 1rem;
		}
	}
</style>
