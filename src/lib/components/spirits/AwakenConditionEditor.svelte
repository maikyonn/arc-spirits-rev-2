<script lang="ts">
	import { supabase } from '$lib/api/supabaseClient';
	import type { AwakenCondition, AwakenRuneToken, MatItemRow } from '$lib/types/gameData';
	import {
		awakenRuneTokensSlotsUsed,
		isAwakenOrRuneToken
	} from '$lib/utils/awakenRuneTokens';

	interface Props {
		value?: AwakenCondition | null;
		runes: MatItemRow[];
		compact?: boolean;
		disabled?: boolean;
	}

	let {
		value = $bindable<AwakenCondition | null>(null),
		runes,
		compact = false,
		disabled = false
	}: Props = $props();

	const MAX_SLOTS = 5;
	const gameAssetsStorage = supabase.storage.from('game_assets');

	function conditionType(): 'none' | 'rune_cost' | 'text' {
		return value?.type ?? 'none';
	}

	function runeTokens(): AwakenRuneToken[] {
		return value?.type === 'rune_cost' ? value.rune_ids ?? [] : [];
	}

	function slotsUsed(): number {
		return awakenRuneTokensSlotsUsed(runeTokens());
	}

	function runeCount(runeId: string): number {
		return runeTokens().filter((token): token is string => token === runeId).length;
	}

	function runeIconUrl(path: string | null): string | null {
		if (!path) return null;
		const normalized = path.startsWith('runes/') ? path : `runes/${path}`;
		return gameAssetsStorage.getPublicUrl(normalized).data.publicUrl ?? null;
	}

	function setConditionType(type: 'none' | 'rune_cost' | 'text') {
		if (type === 'none') value = null;
		else if (type === 'rune_cost') value = { type: 'rune_cost', rune_ids: [] };
		else value = { type: 'text', text: '' };
	}

	function updateRuneQuantity(runeId: string, requested: number) {
		const tokens = runeTokens();
		const otherTokens = tokens.filter((token) => token !== runeId);
		const available = Math.max(0, MAX_SLOTS - awakenRuneTokensSlotsUsed(otherTokens));
		const quantity = Math.min(available, Math.max(0, Math.floor(Number.isFinite(requested) ? requested : 0)));
		value = {
			type: 'rune_cost',
			rune_ids: [...otherTokens.filter((token) => isAwakenOrRuneToken(token)), ...otherTokens.filter((token): token is string => typeof token === 'string'), ...Array(quantity).fill(runeId)]
		};
	}

	function addOrSlot() {
		const tokens = runeTokens();
		if (awakenRuneTokensSlotsUsed(tokens) >= MAX_SLOTS) return;
		value = { type: 'rune_cost', rune_ids: [...tokens, { kind: 'or', rune_ids: [] }] };
	}

	function removeToken(tokenIndex: number) {
		value = {
			type: 'rune_cost',
			rune_ids: runeTokens().filter((_, index) => index !== tokenIndex)
		};
	}

	function updateOrRune(tokenIndex: number, runeId: string, checked: boolean) {
		const tokens = [...runeTokens()];
		const token = tokens[tokenIndex];
		if (!token || !isAwakenOrRuneToken(token)) return;
		const ids = new Set(token.rune_ids ?? []);
		if (checked) ids.add(runeId);
		else ids.delete(runeId);
		tokens[tokenIndex] = { kind: 'or', rune_ids: [...ids] };
		value = { type: 'rune_cost', rune_ids: tokens };
	}
</script>

<div class:compact class="awaken-editor">
	<div class="type-row">
		<label>
			<span>Cost type</span>
			<select
				value={conditionType()}
				disabled={disabled}
				onchange={(event) =>
					setConditionType(event.currentTarget.value as 'none' | 'rune_cost' | 'text')}
			>
				<option value="none">None</option>
				<option value="rune_cost">Rune Cost</option>
				<option value="text">Text</option>
			</select>
		</label>
		{#if value?.type === 'rune_cost'}
			<span class="slot-count">{slotsUsed()} / {MAX_SLOTS} slots</span>
		{/if}
	</div>

	{#if value?.type === 'rune_cost'}
		<div class="rune-grid">
			{#each runes as rune (rune.id)}
				<label class="rune-option" title={rune.name}>
					{#if runeIconUrl(rune.icon_path)}
						<img src={runeIconUrl(rune.icon_path) ?? ''} alt="" />
					{:else}
						<span class="rune-fallback" aria-hidden="true">◆</span>
					{/if}
					<input
						type="number"
						min="0"
						max={MAX_SLOTS}
						aria-label={`${rune.name} quantity`}
						value={runeCount(rune.id)}
						disabled={disabled}
						oninput={(event) => updateRuneQuantity(rune.id, Number(event.currentTarget.value))}
					/>
				</label>
			{/each}
		</div>

		<div class="or-section">
			<div class="or-header">
				<strong>OR slots</strong>
				<button type="button" class="small-button" disabled={disabled || slotsUsed() >= MAX_SLOTS} onclick={addOrSlot}>
					+ OR slot
				</button>
			</div>
			{#each runeTokens() as token, tokenIndex (`${tokenIndex}-${typeof token === 'string' ? token : 'or'}`)}
				{#if isAwakenOrRuneToken(token)}
					<div class="or-card">
						<div class="or-card__header">
							<span>Choose one rune</span>
							<button type="button" class="remove-button" disabled={disabled} onclick={() => removeToken(tokenIndex)}>
								Remove
							</button>
						</div>
						<div class="or-options">
							{#each runes as rune (rune.id)}
								<label title={rune.name}>
									<input
										type="checkbox"
										aria-label={rune.name}
										checked={token.rune_ids?.includes(rune.id) ?? false}
										disabled={disabled}
										onchange={(event) => updateOrRune(tokenIndex, rune.id, event.currentTarget.checked)}
									/>
									{#if runeIconUrl(rune.icon_path)}
										<img src={runeIconUrl(rune.icon_path) ?? ''} alt="" />
									{:else}
										<span class="rune-fallback" aria-hidden="true">◆</span>
									{/if}
								</label>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{:else if value?.type === 'text'}
		<label class="text-cost">
			<span>Awaken requirement</span>
			<textarea
				rows={compact ? 2 : 3}
				value={value.text}
				disabled={disabled}
				oninput={(event) => (value = { type: 'text', text: event.currentTarget.value })}
			></textarea>
		</label>
	{/if}
</div>

<style>
	.awaken-editor {
		display: grid;
		gap: 0.75rem;
	}

	.type-row,
	.or-header,
	.or-card__header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.type-row label,
	.text-cost {
		display: grid;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: #cbd5e1;
	}

	.slot-count {
		color: #94a3b8;
		font-size: 0.72rem;
	}

	.rune-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
		gap: 0.45rem;
	}

	.rune-option {
		display: grid;
		grid-template-columns: 28px minmax(2.8rem, 1fr);
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.6);
	}

	.rune-option img,
	.or-options img {
		width: 26px;
		height: 26px;
		object-fit: contain;
	}

	.rune-fallback {
		text-align: center;
		color: #a78bfa;
	}

	.rune-option input[type='number'] {
		width: 100%;
		padding-inline: 0.35rem;
	}

	.or-section,
	.or-card {
		display: grid;
		gap: 0.45rem;
	}

	.or-card {
		padding: 0.55rem;
		border: 1px solid rgba(167, 139, 250, 0.3);
		border-radius: 8px;
		background: rgba(76, 29, 149, 0.12);
	}

	.or-card__header {
		align-items: center;
		font-size: 0.75rem;
	}

	.or-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.65rem;
	}

	.or-options label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
	}

	.or-options img {
		width: 20px;
		height: 20px;
	}

	.small-button,
	.remove-button {
		padding: 0.25rem 0.5rem;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.remove-button {
		color: #fca5a5;
	}

	.text-cost textarea {
		width: 100%;
		resize: vertical;
	}

	.compact .rune-grid {
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
	}

	@media (max-width: 640px) {
		.rune-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
