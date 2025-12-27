<script lang="ts">
	type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';
	type ButtonType = 'button' | 'submit';

	interface Props {
		variant?: Variant;
		size?: Size;
		disabled?: boolean;
		loading?: boolean;
		type?: ButtonType;
		form?: string;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children?: import('svelte').Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		disabled = false,
		loading = false,
		type = 'button',
		form,
		class: extraClass = '',
		onclick,
		children
	}: Props = $props();

	const variantClasses = {
		primary: 'btn--primary',
		secondary: 'btn--secondary',
		danger: 'btn--danger',
		ghost: 'btn--ghost'
	};

	const sizeClasses = {
		sm: 'btn--sm',
		md: 'btn--md',
		lg: 'btn--lg'
	};

	const className = $derived(
		`btn ${variantClasses[variant]} ${sizeClasses[size]} ${loading ? 'btn--loading' : ''} ${extraClass}`.trim()
	);
</script>

<button
	{type}
	{form}
	class={className}
	disabled={disabled || loading}
	{onclick}
	aria-busy={loading}
>
	{#if loading}
		<span class="btn__spinner" aria-hidden="true">⏳</span>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			border-color 0.15s ease;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.7);
		color: inherit;
	}

	.btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 16px rgba(15, 23, 42, 0.35);
	}

	.btn:focus-visible {
		outline: none;
		border-color: rgba(96, 165, 250, 0.75);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Variants */
	.btn--primary {
		background: linear-gradient(135deg, #4f46e5, #7c3aed);
		border: none;
		color: #f8fafc;
	}

	.btn--secondary {
		background: rgba(30, 41, 59, 0.7);
		border-color: rgba(148, 163, 184, 0.25);
		color: inherit;
	}

	.btn--danger {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fca5a5;
		background: rgba(30, 41, 59, 0.7);
	}

	.btn--danger:hover:not(:disabled) {
		background: rgba(248, 113, 113, 0.15);
	}

	.btn--ghost {
		background: transparent;
		border-color: transparent;
		color: inherit;
	}

	.btn--ghost:hover:not(:disabled) {
		background: rgba(30, 41, 59, 0.5);
		border-color: rgba(148, 163, 184, 0.2);
	}

	/* Sizes */
	.btn--sm {
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
	}

	.btn--md {
		padding: 0.4rem 0.7rem;
		font-size: 0.95rem;
	}

	.btn--lg {
		padding: 0.55rem 0.9rem;
		font-size: 1.05rem;
	}

	/* Loading */
	.btn--loading {
		opacity: 0.7;
		cursor: wait;
	}

	.btn__spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
