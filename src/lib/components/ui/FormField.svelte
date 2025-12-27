<script lang="ts">
	interface Props {
		label: string;
		error?: string;
		required?: boolean;
		helperText?: string;
		children?: import('svelte').Snippet;
	}

	let { label, error, required = false, helperText, children }: Props = $props();

	const id = $derived(`field-${Math.random().toString(36).slice(2, 11)}`);
</script>

<div class="form-field">
	<label for={id} class="form-field__label">
		{label}
		{#if required}
			<span class="form-field__required" aria-label="required">*</span>
		{/if}
	</label>

	<div class="form-field__input">
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if error}
		<p class="form-field__error" role="alert">{error}</p>
	{:else if helperText}
		<p class="form-field__helper">{helperText}</p>
	{/if}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-field__label {
		color: #cbd5f5;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.form-field__required {
		color: #fca5a5;
		margin-left: 0.2rem;
	}

	.form-field__input {
		display: flex;
		flex-direction: column;
	}

	.form-field__error {
		margin: 0;
		color: #fca5a5;
		font-size: 0.85rem;
	}

	.form-field__helper {
		margin: 0;
		color: rgba(148, 163, 184, 0.7);
		font-size: 0.85rem;
	}
</style>
