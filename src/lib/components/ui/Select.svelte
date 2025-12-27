<script lang="ts">
	type Option = { value: string | number; label: string } | string | number;

	interface Props {
		options: Option[];
		value?: string | number | null;
		placeholder?: string;
		disabled?: boolean;
		error?: boolean;
		required?: boolean;
		onchange?: (e: Event) => void;
	}

	let {
		options,
		value = $bindable<string | number | null>(''),
		placeholder,
		disabled = false,
		error = false,
		required = false,
		onchange
	}: Props = $props();

	const className = $derived(`select ${error ? 'select--error' : ''}`);

	function normalizeOption(opt: Option): { value: string | number; label: string } {
		if (typeof opt === 'object' && 'value' in opt && 'label' in opt) {
			return opt;
		}
		return { value: opt, label: String(opt) };
	}

	const normalizedOptions = $derived(options.map(normalizeOption));
</script>

<select bind:value class={className} {disabled} {required} {onchange} aria-invalid={error}>
	{#if placeholder}
		<option value="" disabled>{placeholder}</option>
	{/if}
	{#each normalizedOptions as option}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>

<style>
	.select {
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font: inherit;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
		cursor: pointer;
	}

	.select:focus {
		outline: none;
		border-color: rgba(96, 165, 250, 0.75);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.select--error {
		border-color: rgba(248, 113, 113, 0.6);
	}

	.select--error:focus {
		border-color: rgba(248, 113, 113, 0.8);
		box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.2);
	}
</style>
