<script lang="ts">
	import Modal from '../layout/Modal.svelte';
	import type { Snippet } from 'svelte';

	type Variant = 'danger' | 'warning' | 'info';

	interface Props {
		open?: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: Variant;
		onconfirm?: () => void;
		oncancel?: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title = 'Confirm Action',
		message = 'Are you sure you want to proceed?',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'info',
		onconfirm,
		oncancel,
		children
	}: Props = $props();

	function handleConfirm() {
		open = false;
		onconfirm?.();
	}

	function handleCancel() {
		open = false;
		oncancel?.();
	}

	function handleClose() {
		handleCancel();
	}

	const variantStyles = $derived.by(() => {
		switch (variant) {
			case 'danger':
				return {
					buttonClass: 'btn--danger',
					iconColor: '#fecaca'
				};
			case 'warning':
				return {
					buttonClass: 'btn--warning',
					iconColor: '#fbbf24'
				};
			case 'info':
			default:
				return {
					buttonClass: 'btn--primary',
					iconColor: '#93c5fd'
				};
		}
	});
</script>

<Modal bind:open size="sm" {title} closeOnBackdrop={false} closeOnEscape={true}>
	{#snippet children()}
		<div class="confirm-dialog">
			<div class="confirm-dialog__icon" style="color: {variantStyles.iconColor}">
				{#if variant === 'danger'}
					⚠️
				{:else if variant === 'warning'}
					⚡
				{:else}
					ℹ️
				{/if}
			</div>
			<div class="confirm-dialog__content">
				<p class="confirm-dialog__message">{message}</p>
				{#if children}
					{@render children()}
				{/if}
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<div class="confirm-dialog__actions">
			<button class="btn" type="button" onclick={handleCancel}>
				{cancelLabel}
			</button>
			<button class="btn {variantStyles.buttonClass}" type="button" onclick={handleConfirm}>
				{confirmLabel}
			</button>
		</div>
	{/snippet}
</Modal>

<style>
	.confirm-dialog {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem 0;
	}

	.confirm-dialog__icon {
		font-size: 3rem;
		line-height: 1;
	}

	.confirm-dialog__content {
		text-align: center;
		width: 100%;
	}

	.confirm-dialog__message {
		margin: 0;
		color: #cbd5f5;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.confirm-dialog__actions {
		display: flex;
		gap: 0.6rem;
		width: 100%;
		justify-content: flex-end;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.7);
		color: #cbd5f5;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.btn:hover {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.35);
	}

	.btn--primary {
		background: rgba(59, 130, 246, 0.35);
		border-color: rgba(96, 165, 250, 0.45);
		color: #93c5fd;
	}

	.btn--primary:hover {
		background: rgba(59, 130, 246, 0.5);
	}

	.btn--warning {
		background: rgba(251, 191, 36, 0.25);
		border-color: rgba(251, 191, 36, 0.45);
		color: #fbbf24;
	}

	.btn--warning:hover {
		background: rgba(251, 191, 36, 0.35);
	}

	.btn--danger {
		background: rgba(248, 113, 113, 0.25);
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	.btn--danger:hover {
		background: rgba(248, 113, 113, 0.35);
	}
</style>
