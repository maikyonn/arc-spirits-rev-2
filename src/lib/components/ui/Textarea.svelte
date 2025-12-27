<script lang="ts">
	interface Props {
		placeholder?: string;
		value?: string | null;
		rows?: number;
		disabled?: boolean;
		error?: boolean;
		oninput?: (e: Event) => void;
		onblur?: (e: FocusEvent) => void;
		onfocus?: (e: FocusEvent) => void;
	}

	let {
		placeholder,
		value = $bindable<string | null>(''),
		rows = 4,
		disabled = false,
		error = false,
		oninput,
		onblur,
		onfocus
	}: Props = $props();

	const className = $derived(`textarea ${error ? 'textarea--error' : ''}`);
</script>

<textarea
	{placeholder}
	{rows}
	{disabled}
	bind:value
	class={className}
	{oninput}
	{onblur}
	{onfocus}
	aria-invalid={error}
></textarea>

<style>
	.textarea {
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font: inherit;
		resize: vertical;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.textarea:focus {
		outline: none;
		border-color: rgba(96, 165, 250, 0.75);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.textarea--error {
		border-color: rgba(248, 113, 113, 0.6);
	}

	.textarea--error:focus {
		border-color: rgba(248, 113, 113, 0.8);
		box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.2);
	}

	.textarea::placeholder {
		color: rgba(148, 163, 184, 0.5);
	}
</style>
