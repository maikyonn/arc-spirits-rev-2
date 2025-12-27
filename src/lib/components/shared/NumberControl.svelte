<script lang="ts">
	interface Props {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		label?: string;
		disabled?: boolean;
	}

	let {
		value = $bindable(0),
		min = -Infinity,
		max = Infinity,
		step = 1,
		label,
		disabled = false
	}: Props = $props();

	let holdInterval = $state<number | null>(null);
	let holdTimeout = $state<number | null>(null);

	function clamp(num: number): number {
		return Math.max(min, Math.min(max, num));
	}

	function increment() {
		if (disabled) return;
		value = clamp(value + step);
	}

	function decrement() {
		if (disabled) return;
		value = clamp(value - step);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const parsed = parseFloat(target.value);
		if (!isNaN(parsed)) {
			value = clamp(parsed);
		}
	}

	function startHold(action: () => void) {
		if (disabled) return;
		action();
		holdTimeout = window.setTimeout(() => {
			holdInterval = window.setInterval(action, 100);
		}, 500);
	}

	function stopHold() {
		if (holdTimeout !== null) {
			clearTimeout(holdTimeout);
			holdTimeout = null;
		}
		if (holdInterval !== null) {
			clearInterval(holdInterval);
			holdInterval = null;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			increment();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			decrement();
		}
	}
</script>

<div class="number-control" class:disabled>
	{#if label}
		<span class="number-control__label" id="number-control-label">
			{label}
		</span>
	{/if}
	<div class="number-control__controls">
		<button
			type="button"
			class="number-control__button"
			{disabled}
			onclick={decrement}
			onmousedown={() => startHold(decrement)}
			onmouseup={stopHold}
			onmouseleave={stopHold}
			ontouchstart={() => startHold(decrement)}
			ontouchend={stopHold}
			aria-label="Decrease"
		>
			−
		</button>
		<input
			type="number"
			class="number-control__input"
			{value}
			{min}
			{max}
			{step}
			{disabled}
			oninput={handleInput}
			onkeydown={handleKeydown}
			aria-label={label || 'Number input'}
			aria-labelledby={label ? 'number-control-label' : undefined}
		/>
		<button
			type="button"
			class="number-control__button"
			{disabled}
			onclick={increment}
			onmousedown={() => startHold(increment)}
			onmouseup={stopHold}
			onmouseleave={stopHold}
			ontouchstart={() => startHold(increment)}
			ontouchend={stopHold}
			aria-label="Increase"
		>
			+
		</button>
	</div>
</div>

<style>
	.number-control {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.number-control__label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.number-control__controls {
		display: flex;
		align-items: stretch;
		gap: 0;
	}

	.number-control__button {
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5f5;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
		transition: all 0.15s ease;
		user-select: none;
		min-width: 36px;
	}

	.number-control__button:first-child {
		border-radius: 6px 0 0 6px;
		border-right: none;
	}

	.number-control__button:last-child {
		border-radius: 0 6px 6px 0;
		border-left: none;
	}

	.number-control__button:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.35);
	}

	.number-control__button:active:not(:disabled) {
		background: rgba(59, 130, 246, 0.3);
	}

	.number-control__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.number-control__input {
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-left: none;
		border-right: none;
		color: #cbd5f5;
		font-size: 0.95rem;
		text-align: center;
		min-width: 60px;
		transition: all 0.15s ease;
		-moz-appearance: textfield;
	}

	.number-control__input::-webkit-outer-spin-button,
	.number-control__input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.number-control__input:focus {
		outline: none;
		background: rgba(30, 41, 59, 1);
		border-color: rgba(59, 130, 246, 0.5);
		position: relative;
		z-index: 1;
	}

	.number-control__input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.number-control.disabled {
		opacity: 0.6;
	}
</style>
