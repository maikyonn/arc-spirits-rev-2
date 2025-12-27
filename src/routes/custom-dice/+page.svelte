<script lang="ts">
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import { ImageUploader } from '$lib/components/shared';
	import { Modal } from '$lib/components/layout';
	import { useFormModal, useFileUpload } from '$lib/composables';
	import { getErrorMessage } from '$lib/utils';
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
	let error: string | null = null;
	let loading = true;

	const modal = useFormModal<DiceFormData>(createInitialForm());
	const backgroundUpload = useFileUpload('game_assets', 'dice_backgrounds');

	let editingDice: CustomDiceWithSides | null = null;

	type AttackStats = { mean: number; sd: number } | null;

	onMount(async () => {
		await loadDice();
	});

	async function loadDice() {
		loading = true;
		error = null;
		try {
			diceList = await fetchDiceRecords();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		editingDice = null;
		modal.open();
	}

	function openEdit(dice: CustomDiceWithSides) {
		editingDice = dice;
		modal.open(toFormData(dice));
	}

	function setDiceType(type: DiceType) {
		modal.formData = {
			...modal.formData,
			dice_type: type,
			dice_sides: normalizeSides(type, modal.formData.dice_sides)
		};
	}

	function updateSideValue(index: number, value: string) {
		if (!modal.formData.dice_sides) return;
		const updated = [...modal.formData.dice_sides];
		updated[index] = { ...updated[index], reward_value: value };
		modal.formData = { ...modal.formData, dice_sides: updated };
	}

	function updateSideIcon(index: number, value: string) {
		if (!modal.formData.dice_sides) return;
		const updated = [...modal.formData.dice_sides];
		updated[index] = { ...updated[index], icon: value };
		modal.formData = { ...modal.formData, dice_sides: updated };
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
		if (!modal.formData.name?.trim()) {
			alert('Dice name is required');
			return;
		}

		try {
			await saveDiceRecord(modal.formData);
			modal.close();
			await loadDice();
		} catch (err) {
			alert(`Failed to save dice: ${getErrorMessage(err)}`);
		}
	}

	async function deleteDice(dice: CustomDiceWithSides) {
		if (!confirm(`Delete custom dice "${dice.name}"?`)) return;
		try {
			await deleteDiceRecord(dice.id);
			await loadDice();
		} catch (err) {
			alert(`Failed to delete dice: ${getErrorMessage(err)}`);
		}
	}

	function handleBackgroundUpload(path: string) {
		modal.formData = { ...modal.formData, background_image_path: path };
	}

	function handleBackgroundError(message: string) {
		alert(message);
	}

	function submitDiceForm(event: Event) {
		event.preventDefault();
		void saveDice();
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Custom Dice</h1>
			<p>Create and manage custom dice definitions with sides and values.</p>
		</div>
		<div style="display: flex; gap: 0.5rem;">
			<Button onclick={openCreate}>Create Dice</Button>
		</div>
	</header>

	{#if loading}
		<div class="card loading">Loading dice…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="dice-row">
			{#each diceList as dice}
				{@const stats = computeAttackStats(dice)}
				<div
					class="dice-panel"
					style={`border-color: ${dice.color ?? '#4a9eff'}`}
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
							onclick={() => openEdit(dice)}
							title="Edit dice"
						>
							✏️
						</button>
						<button
							class="icon-btn danger"
							type="button"
							onclick={() => deleteDice(dice)}
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
	{/if}

	<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Dice' : 'Create Dice'} size="lg">
		<form id="dice-editor-form" class="dice-editor" onsubmit={submitDiceForm}>
			<section class="dice-editor__grid">
				<FormField label="Name" required>
					<Input bind:value={modal.formData.name} required />
				</FormField>

				<FormField label="Icon">
					<Input bind:value={modal.formData.icon} />
				</FormField>

				<FormField label="Color">
					<Input type="color" bind:value={modal.formData.color} />
				</FormField>

				<FormField label="Dice type">
					<Select
						bind:value={modal.formData.dice_type}
						options={[
							{ value: 'attack', label: 'Attack Dice' },
							{ value: 'special', label: 'Special Dice' }
						]}
						onchange={(event) => setDiceType((event.currentTarget.value as DiceType) ?? 'attack')}
					/>
				</FormField>
			</section>

			<FormField label="Description">
				<Textarea rows={2} bind:value={modal.formData.description} />
			</FormField>

			<h3>Dice Background</h3>
			<ImageUploader
				bind:value={modal.formData.background_image_path}
				bucket="game_assets"
				folder="dice_backgrounds"
				maxSizeMB={10}
				onupload={handleBackgroundUpload}
				onerror={handleBackgroundError}
			>
				<p>Upload a background image that will be used for all dice sides.</p>
			</ImageUploader>

			<h3>Sides</h3>
			<div class="sides-grid">
				{#if modal.formData.dice_sides}
					{#each modal.formData.dice_sides as side, index}
						<div class="side-editor">
							<strong>Side {index + 1}</strong>
							{#if modal.formData.dice_type === 'attack'}
								<FormField label="Attack value">
									<Input
										type="number"
										value={side.reward_value ?? String(index + 1)}
										oninput={(event) => updateSideValue(index, (event.currentTarget.value ?? '').trim())}
									/>
								</FormField>
							{:else}
								<FormField label="Effect text">
									<Textarea
										rows={2}
										value={side.reward_value ?? ''}
										oninput={(event) => updateSideValue(index, event.currentTarget.value)}
									/>
								</FormField>
							{/if}
							<FormField label="Icon">
								<Input
									value={side.icon ?? DICE_TYPE_ICONS[modal.formData.dice_type ?? 'attack']}
									oninput={(event) => updateSideIcon(index, event.currentTarget.value)}
								/>
							</FormField>
						</div>
					{/each}
				{/if}
			</div>
		</form>

		{#snippet footer()}
			<Button variant="primary" type="submit" form="dice-editor-form">Save</Button>
			<Button onclick={() => modal.close()}>Cancel</Button>
		{/snippet}
	</Modal>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.dice-panel:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 16px rgba(15, 23, 42, 0.35);
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

	.side-editor strong {
		color: #cbd5f5;
	}
</style>
