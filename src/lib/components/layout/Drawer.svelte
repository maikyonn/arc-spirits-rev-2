<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	type DrawerWidth = 'sm' | 'md' | 'lg';

	interface Props {
		open?: boolean;
		title?: string;
		width?: DrawerWidth;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		width = 'md',
		closeOnBackdrop = true,
		closeOnEscape = true,
		children
	}: Props = $props();

	function getWidth(w: DrawerWidth): string {
		switch (w) {
			case 'sm':
				return 'min(320px, 85vw)';
			case 'lg':
				return 'min(640px, 85vw)';
			case 'md':
			default:
				return 'min(480px, 85vw)';
		}
	}

	function close() {
		open = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (!closeOnBackdrop) return;
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (closeOnEscape && event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('keydown', handleKeydown);
			return () => {
				document.removeEventListener('keydown', handleKeydown);
			};
		}
	});
</script>

{#if open}
	<div
		class="drawer-backdrop"
		role="presentation"
		tabindex="-1"
		onclick={handleBackdropClick}
		transition:fade={{ duration: 200 }}
	>
		<aside
			class="drawer"
			aria-label={title}
			style={`--drawer-width: ${getWidth(width)};`}
			transition:fly={{ x: 300, duration: 300 }}
		>
			<header class="drawer__header">
				<h2>{title}</h2>
				<button class="drawer__close" type="button" onclick={close} aria-label="Close">
					✕
				</button>
			</header>
			<div class="drawer__content">
				{#if children}
					{@render children()}
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.6);
		z-index: 1100;
		display: flex;
		justify-content: flex-end;
	}

	.drawer {
		width: var(--drawer-width);
		height: 100vh;
		background: rgba(8, 14, 32, 0.98);
		border-left: 1px solid rgba(94, 114, 228, 0.28);
		box-shadow: -4px 0 24px rgba(2, 6, 23, 0.5);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.drawer__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(94, 114, 228, 0.18);
		background: rgba(8, 14, 32, 0.95);
		flex-shrink: 0;
	}

	.drawer__header h2 {
		margin: 0;
		font-size: 1.15rem;
		color: #f8fafc;
		letter-spacing: 0.01em;
	}

	.drawer__close {
		border: none;
		background: rgba(30, 41, 59, 0.88);
		color: #94a3b8;
		border-radius: 999px;
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		flex-shrink: 0;
	}

	.drawer__close:hover {
		background: rgba(59, 130, 246, 0.35);
		color: #f8fafc;
	}

	.drawer__content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		scrollbar-width: thin;
		background: linear-gradient(180deg, rgba(12, 20, 38, 0.92), rgba(12, 20, 38, 0.78));
	}

	@media (max-width: 768px) {
		.drawer {
			width: 100vw;
			max-width: 100%;
		}

		.drawer__content {
			padding: 1rem;
		}

		.drawer__header {
			padding: 1rem 1.25rem;
		}
	}
</style>
