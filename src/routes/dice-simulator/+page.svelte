<script lang="ts">
	import { onMount } from 'svelte';
import type { DiceSideRow } from '$lib/types/gameData';
import { EditorModal } from '$lib';
	import {
		DICE_TYPE_ICONS,
		DICE_TYPE_LABELS,
		createInitialForm,
		deleteDiceRecord,
		fetchDiceRecords,
		normalizeSides,
		saveDiceRecord,
		toFormData,
		type CustomDiceWithSides,
		type DiceFormData,
		type DiceType
	} from '$lib/features/dice/dice';

	let diceList: CustomDiceWithSides[] = [];
	let selectedDiceId: string | null = null;
	let numberOfDice = 1;
	let isRolling = false;
	let results: DiceSideRow[] = [];
	let error: string | null = null;
	let loading = true;

let showEditor = false;
let editingDice: CustomDiceWithSides | null = null;

let formData: DiceFormData = createInitialForm();

type AttackStats = { mean: number; sd: number } | null;

	onMount(async () => {
		await loadDice();
	});

	async function loadDice() {
		loading = true;
		error = null;
		try {
			diceList = await fetchDiceRecords();
			if (diceList.length && !selectedDiceId) {
				selectedDiceId = diceList[0].id;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	function currentDice(): CustomDiceWithSides | null {
		return diceList.find((dice) => dice.id === selectedDiceId) ?? null;
	}

	async function rollDice() {
		const dice = currentDice();
		if (!dice || dice.dice_sides.length === 0) return;
		if (isRolling) return;

		isRolling = true;
		const rolled: DiceSideRow[] = [];
		for (let i = 0; i < numberOfDice; i += 1) {
			const idx = Math.floor(Math.random() * dice.dice_sides.length);
			rolled.push(dice.dice_sides[idx]);
		}

		await new Promise((resolve) => setTimeout(resolve, 400));
		results = rolled;
		isRolling = false;
	}

function openCreate() {
	editingDice = null;
	formData = createInitialForm();
	showEditor = true;
}

function openEdit(dice: CustomDiceWithSides) {
	editingDice = dice;
	formData = toFormData(dice);
	showEditor = true;
}

function setDiceType(type: DiceType) {
	formData = {
		...formData,
		dice_type: type,
		dice_sides: normalizeSides(type, formData.dice_sides)
	};
}

function updateSideValue(index: number, value: string) {
	if (!formData.dice_sides) return;
	const updated = [...formData.dice_sides];
	updated[index] = { ...updated[index], reward_value: value };
	formData = { ...formData, dice_sides: updated };
}

function updateSideIcon(index: number, value: string) {
	if (!formData.dice_sides) return;
	const updated = [...formData.dice_sides];
	updated[index] = { ...updated[index], icon: value };
	formData = { ...formData, dice_sides: updated };
}

function formatSideValue(diceType: DiceType, side: DiceSideRow): string {
	return diceType === 'attack' ? `${side.reward_value} ATK` : side.reward_value;
}

function getSideIcon(diceType: DiceType, side: DiceSideRow): string {
	return side.icon ?? DICE_TYPE_ICONS[diceType];
}

function computeAttackStats(dice: CustomDiceWithSides): AttackStats {
    if ((dice.dice_type ?? 'attack') !== 'attack') return null;
    const values = dice.dice_sides
        .map((side) => Number(side.reward_value))
        .filter((value) => Number.isFinite(value) && value !== 100) as number[];
    if (!values.length) return null;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanSquares = values.reduce((sum, value) => sum + value * value, 0) / values.length;
    const variance = meanSquares - mean * mean;
    const sd = Math.sqrt(Math.max(variance, 0));
    return {
        mean,
        sd
    };
}

function formatStat(value: number): string {
	return Number.isFinite(value) ? value.toFixed(2) : '—';
}

async function saveDice() {
	if (!formData.name?.trim()) {
		alert('Dice name is required');
		return;
	}

	try {
		const saved = await saveDiceRecord(formData);
		showEditor = false;
		await loadDice();
		selectedDiceId = saved.id;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to save dice: ${message}`);
	}
}

async function deleteDice(dice: CustomDiceWithSides) {
	if (!confirm(`Delete custom dice "${dice.name}"?`)) return;
	try {
		await deleteDiceRecord(dice.id);
		if (selectedDiceId === dice.id) {
			selectedDiceId = null;
			results = [];
		}
		await loadDice();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to delete dice: ${message}`);
	}
}

function submitDiceForm(event: Event) {
	event.preventDefault();
	void saveDice();
}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Custom Dice Simulator</h1>
			<p>Design dice, preview sides, and simulate rolls for rev2 mechanics.</p>
		</div>
		<button class="btn" type="button" onclick={openCreate}>Create Dice</button>
	</header>

	{#if loading}
		<div class="card loading">Loading dice…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="simulator">
			<div class="dice-row">
				{#each diceList as dice}
					{@const stats = computeAttackStats(dice)}
					<div
						class={`dice-panel ${selectedDiceId === dice.id ? 'dice-panel--selected' : ''}`}
						style={`border-color: ${dice.color ?? '#4a9eff'}`}
						role="button"
						tabindex="0"
						onclick={() => (selectedDiceId = dice.id)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								selectedDiceId = dice.id;
							}
						}}
					>
						<div class="dice-panel__icon">{dice.icon ?? '🎲'}</div>
						<div class="dice-panel__content">
							<h3>{dice.name}</h3>
							{#if dice.description}
								<p>{dice.description}</p>
							{/if}
							<div class="dice-panel__sides">
								{dice.dice_sides.length} sides
								{#if stats}
                               <span class="dice-panel__stats">EV {formatStat(stats.mean)} • SD {formatStat(stats.sd)}</span>
								{/if}
							</div>
							<div class="dice-panel__type">{DICE_TYPE_LABELS[dice.dice_type ?? 'attack']}</div>
						</div>
						<div class="dice-panel__actions">
							<button
								class="icon-btn"
								type="button"
								onclick={(event) => {
									event.stopPropagation();
									openEdit(dice);
								}}
								title="Edit dice"
							>
								✏️
							</button>
							<button
								class="icon-btn danger"
								type="button"
								onclick={(event) => {
									event.stopPropagation();
									deleteDice(dice);
								}}
								title="Delete dice"
							>
								🗑️
							</button>
						</div>
					</div>
				{:else}
					<div class="card empty">Create your first dice to begin.</div>
				{/each}
			</div>

			{#if selectedDiceId}
				{@const activeDice = currentDice()}
				<div class="roll-controls">
					<label>
						<span>Number of dice</span>
						<div class="range-input">
							<input type="range" min="1" max="10" bind:value={numberOfDice} />
							<span class="range-value">{numberOfDice}</span>
						</div>
					</label>
					<button class="btn btn--primary" type="button" disabled={isRolling} onclick={rollDice}>
						{isRolling ? 'Rolling…' : `Roll ${numberOfDice}d${activeDice?.dice_sides.length ?? 6}`}
					</button>
				</div>

			{#if results.length}
				<div class="results">
					<h2>Results</h2>
					<div class="results-grid">
						{#each results as side, index}
							<div class="result-card">
								<span class="result-icon"
									>{getSideIcon(activeDice?.dice_type ?? 'attack', side)}</span
								>
								<div class="result-content">
									<strong>Die {index + 1}</strong>
									<p>{formatSideValue(activeDice?.dice_type ?? 'attack', side)}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if activeDice}
					<div class="dice-details">
						<h2>Dice Sides</h2>
						<div class="sides-display">
							{#each activeDice.dice_sides
								.slice()
								.sort(
									(a: DiceSideRow, b: DiceSideRow) => a.side_number - b.side_number
								) as side}
								<div class="side-card">
									<span class="side-icon"
										>{getSideIcon(activeDice.dice_type ?? 'attack', side)}</span
									>
									<div class="side-content">
										<strong>Side {side.side_number}</strong>
										<p>{formatSideValue(activeDice.dice_type ?? 'attack', side)}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
			{/if}
			{:else}
				<div class="card empty">Select a dice set to begin rolling.</div>
			{/if}
		</section>
	{/if}

	{#if showEditor}
		<EditorModal
			title={editingDice ? 'Edit Dice' : 'Create Dice'}
			description="Update core dice metadata, configure sides, and preview results."
			size="lg"
			on:close={() => (showEditor = false)}
		>
			<form id="dice-editor-form" class="dice-editor" onsubmit={submitDiceForm}>
				<section class="dice-editor__grid">
					<label>
						Name
						<input type="text" bind:value={formData.name} required />
					</label>
					<label>
						Icon
						<input type="text" bind:value={formData.icon} />
					</label>
					<label>
						Color
						<input type="color" bind:value={formData.color} />
					</label>
					<label>
						Dice type
						<select
							bind:value={formData.dice_type}
							onchange={(event) => setDiceType((event.currentTarget.value as DiceType) ?? 'attack')}
						>
							<option value="attack">Attack Dice</option>
							<option value="special">Special Dice</option>
						</select>
					</label>
				</section>

				<label>
					Description
					<textarea rows="2" bind:value={formData.description}></textarea>
				</label>
				<h3>Sides</h3>
				<div class="sides-grid">
					{#if formData.dice_sides}
						{#each formData.dice_sides as side, index}
							<div class="side-editor">
								<strong>Side {index + 1}</strong>
								{#if formData.dice_type === 'attack'}
									<label>
										<span>Attack value</span>
										<input
											type="number"
											min="0"
											value={side.reward_value ?? String(index + 1)}
											oninput={(event) => updateSideValue(index, (event.currentTarget.value ?? '').trim())}
										/>
									</label>
								{:else}
									<label>
										<span>Effect text</span>
										<textarea
											rows="2"
											value={side.reward_value ?? ''}
											oninput={(event) => updateSideValue(index, event.currentTarget.value)}
										></textarea>
									</label>
								{/if}
								<label>
									<span>Icon</span>
									<input
										type="text"
										value={side.icon ?? DICE_TYPE_ICONS[formData.dice_type ?? 'attack']}
										oninput={(event) => updateSideIcon(index, event.currentTarget.value)}
									/>
								</label>
							</div>
						{/each}
					{/if}
				</div>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="dice-editor-form">Save</button>
				<button class="btn" type="button" onclick={() => (showEditor = false)}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.simulator {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.dice-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.dice-panel {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.65);
		border: 2px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.dice-panel:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 16px rgba(15, 23, 42, 0.35);
	}

	.dice-panel--selected {
		border-width: 2px;
		box-shadow: 0 12px 20px rgba(59, 130, 246, 0.35);
	}

	.dice-panel__icon {
		font-size: 1.8rem;
	}

	.dice-panel__content h3 {
		margin: 0;
		color: #f8fafc;
		font-size: 1rem;
	}

	.dice-panel__content p {
		margin: 0.2rem 0 0;
		color: #cbd5f5;
		font-size: 0.85rem;
	}

	.dice-panel__sides {
		margin-top: 0.4rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
	}

	.dice-panel__stats {
		margin-left: 0.4rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0.02em;
		color: #f8fafc;
	}

	.dice-panel__type {
		margin-top: 0.25rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: #fde68a;
	}

	.dice-panel__actions {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.icon-btn {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 8px;
		color: inherit;
		cursor: pointer;
		padding: 0.25rem 0.45rem;
		transition: background 0.15s ease;
	}

	.icon-btn:hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.icon-btn.danger:hover {
		background: rgba(248, 113, 113, 0.2);
	}

	.roll-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.85rem;
	}

	.roll-controls label {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: #cbd5f5;
	}

	.range-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.range-input input[type='range'] {
		width: 160px;
	}

	.range-value {
		min-width: 24px;
		text-align: right;
		font-weight: 600;
		color: #f8fafc;
	}

	.btn--primary {
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		border: none;
		color: #f8fafc;
	}

	.dice-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.dice-editor__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}

	.results {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.9rem;
		display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.results-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	gap: 0.6rem;
}

.result-card {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	padding: 0.6rem;
	border-radius: 10px;
	background: rgba(30, 41, 59, 0.6);
	border: 1px solid rgba(148, 163, 184, 0.18);
}

.result-icon {
	font-size: 1.6rem;
}

.dice-details {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.sides-display {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: 0.6rem;
}

.side-card {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	padding: 0.6rem;
	border-radius: 10px;
	background: rgba(30, 41, 59, 0.55);
	border: 1px solid rgba(148, 163, 184, 0.18);
}

.side-icon {
	font-size: 1.4rem;
}

.side-content {
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
}

	.sides-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.6rem;
	}

.side-editor {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	padding: 0.6rem;
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 10px;
	background: rgba(30, 41, 59, 0.55);
}

.side-editor label {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	color: #cbd5f5;
}

	.side-editor textarea,
	.side-editor input[type='text'],
	.side-editor input[type='number'] {
		font: inherit;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
	}

	.side-editor textarea {
		resize: vertical;
		min-height: 72px;
	}
</style>
