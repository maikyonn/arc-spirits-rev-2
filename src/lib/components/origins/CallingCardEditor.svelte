<script lang="ts">
	import type { CallingCard, CallingCardBreakpoint, HexSpiritRow, IconPoolRow } from '$lib/types/gameData';
	import { Button, Input } from '$lib/components/ui';
	import { publicAssetUrl } from '$lib/utils/storage';

	interface Props {
		callingCard: CallingCard | null;
		hexSpirits: HexSpiritRow[];
		iconPool: IconPoolRow[];
		onChange?: (card: CallingCard | null) => void;
	}

	let { callingCard = $bindable(), hexSpirits, iconPool, onChange }: Props = $props();

	let enabled = $state(callingCard?.enabled ?? false);
	let hexSpiritId = $state<string | null>(callingCard?.hex_spirit_id ?? null);
	let breakpoints = $state<CallingCardBreakpoint[]>(callingCard?.breakpoints ?? []);

	// Get public URL for icon pool icons
	function getIconUrl(iconPath: string): string {
		return publicAssetUrl(iconPath, { bucket: 'game_assets' }) || '';
	}

	function emptyBreakpoint(): CallingCardBreakpoint {
		return { count: 3, label: 'Unique', icon_ids: [] };
	}

	function toggleEnabled() {
		enabled = !enabled;
		if (enabled && breakpoints.length === 0) {
			breakpoints = [emptyBreakpoint()];
		}
		syncCallingCard();
	}

	function addBreakpoint() {
		breakpoints = [...breakpoints, emptyBreakpoint()];
		syncCallingCard();
	}

	function removeBreakpoint(index: number) {
		breakpoints = breakpoints.filter((_, i) => i !== index);
		syncCallingCard();
	}

	function addIcon(breakpointIndex: number, iconId: string) {
		// Add icon (allows duplicates)
		breakpoints[breakpointIndex].icon_ids = [...breakpoints[breakpointIndex].icon_ids, iconId];
		breakpoints = [...breakpoints];
		syncCallingCard();
	}

	function removeIconAtIndex(breakpointIndex: number, iconIndex: number) {
		// Remove icon at specific index
		breakpoints[breakpointIndex].icon_ids = breakpoints[breakpointIndex].icon_ids.filter(
			(_, i) => i !== iconIndex
		);
		breakpoints = [...breakpoints];
		syncCallingCard();
	}

	function updateBreakpointCount(index: number, value: string) {
		const num = parseInt(value) || 0;
		breakpoints[index].count = num;
		breakpoints = [...breakpoints];
		syncCallingCard();
	}

	function updateBreakpointLabel(index: number, value: string) {
		breakpoints[index].label = value;
		breakpoints = [...breakpoints];
		syncCallingCard();
	}

	function updateHexSpiritId(value: string) {
		hexSpiritId = value || null;
		syncCallingCard();
	}

	function syncCallingCard() {
		if (!enabled) {
			callingCard = null;
		} else {
			callingCard = {
				enabled: true,
				hex_spirit_id: hexSpiritId,
				breakpoints
			};
		}
		onChange?.(callingCard);
	}

	// Helper to get icon from pool
	function getIcon(iconId: string): IconPoolRow | undefined {
		return iconPool.find((icon) => icon.id === iconId);
	}

	// Helper to get hex spirit name
	function getHexSpiritName(spiritId: string | null): string {
		if (!spiritId) return 'None';
		const spirit = hexSpirits.find((s) => s.id === spiritId);
		return spirit?.name ?? 'Unknown';
	}
</script>

<div class="calling-card-editor">
	<div class="calling-card-editor__header">
		<label class="calling-card-editor__toggle">
			<input type="checkbox" checked={enabled} onchange={toggleEnabled} />
			<span>Enable Calling Card System</span>
		</label>
	</div>

	{#if enabled}
		<div class="calling-card-editor__content">
			<!-- Hex Spirit Selection -->
			<div class="hex-spirit-section">
				<label class="field-label">Summons Hex Spirit</label>
				<select
					class="hex-spirit-select"
					value={hexSpiritId ?? ''}
					onchange={(e) => updateHexSpiritId((e.target as HTMLSelectElement).value)}
				>
					<option value="">-- Select Hex Spirit --</option>
					{#each hexSpirits as spirit}
						<option value={spirit.id}>{spirit.name} (Cost: {spirit.cost})</option>
					{/each}
				</select>
				{#if hexSpiritId}
					<p class="selected-spirit">Selected: {getHexSpiritName(hexSpiritId)}</p>
				{/if}
			</div>

			{#if breakpoints.length === 0}
				<div class="calling-card-editor__empty">
					<p>No breakpoints yet. Add one to get started.</p>
					<Button onclick={addBreakpoint}>Add Breakpoint</Button>
				</div>
			{:else}
				<div class="calling-card-editor__breakpoints">
					{#each breakpoints as breakpoint, bpIndex (bpIndex)}
						<div class="breakpoint">
							<div class="breakpoint__header">
								<div class="breakpoint__inputs">
									<div class="breakpoint__field">
										<span class="field-label">Count</span>
										<Input
											type="number"
											min={1}
											value={breakpoint.count}
											oninput={(e) =>
												updateBreakpointCount(bpIndex, (e.target as HTMLInputElement).value)}
										/>
									</div>
									<div class="breakpoint__field">
										<span class="field-label">Label</span>
										<Input
											type="text"
											placeholder="Unique"
											value={breakpoint.label || ''}
											oninput={(e) =>
												updateBreakpointLabel(bpIndex, (e.target as HTMLInputElement).value)}
										/>
									</div>
								</div>
								<Button variant="danger" size="sm" onclick={() => removeBreakpoint(bpIndex)}>
									Remove
								</Button>
							</div>

							<div class="breakpoint__icons">
								<div class="breakpoint__icons-header">
									<h4>Benefit Icons ({breakpoint.icon_ids.length} selected)</h4>
								</div>

								<!-- Selected Icons Display -->
								{#if breakpoint.icon_ids.length > 0}
									<div class="selected-icons">
										{#each breakpoint.icon_ids as iconId, iconIndex (iconIndex)}
											{@const icon = getIcon(iconId)}
											{#if icon}
												<button type="button"
													class="selected-icon"
													onclick={() => removeIconAtIndex(bpIndex, iconIndex)}
													title="Click to remove {icon.name}"
												>
													<img src={getIconUrl(icon.file_path)} alt={icon.name} />
													<span class="icon-remove">✕</span>
												</button>
											{/if}
										{/each}
									</div>
								{/if}

								<!-- Icon Pool Selection Grid -->
								<div class="icon-pool-grid">
									{#each iconPool as icon (icon.id)}
										{@const count = breakpoint.icon_ids.filter((id) => id === icon.id).length}
										<button type="button"
											class="icon-pool-item"
											class:selected={count > 0}
											onclick={() => addIcon(bpIndex, icon.id)}
											title="Click to add {icon.name}"
										>
											<img src={getIconUrl(icon.file_path)} alt={icon.name} />
											<span class="icon-name">{icon.name}</span>
											{#if count > 0}
												<span class="icon-count">{count}</span>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<div class="calling-card-editor__actions">
					<Button variant="secondary" onclick={addBreakpoint}>+ Add Breakpoint</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.calling-card-editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.calling-card-editor__header {
		padding: 0.75rem;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.calling-card-editor__toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-weight: 500;
		user-select: none;
	}

	.calling-card-editor__toggle input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
		accent-color: #4f46e5;
	}

	.calling-card-editor__content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.calling-card-editor__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.3);
	}

	.calling-card-editor__empty p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.95rem;
	}

	.calling-card-editor__breakpoints {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.breakpoint {
		padding: 1rem;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.25);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.breakpoint__header {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		justify-content: space-between;
	}

	.breakpoint__inputs {
		display: flex;
		gap: 1rem;
		flex: 1;
	}

	.breakpoint__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.breakpoint__field .field-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: #94a3b8;
	}

	.hex-spirit-section {
		padding: 1rem;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.2);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.hex-spirit-select {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		padding: 0.5rem;
		color: #e2e8f0;
		font-size: 0.9rem;
	}

	.hex-spirit-select:focus {
		outline: none;
		border-color: #6366f1;
	}

	.selected-spirit {
		margin: 0;
		color: #94a3b8;
		font-size: 0.85rem;
		font-style: italic;
	}

	.breakpoint__icons {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.breakpoint__icons-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.breakpoint__icons-header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.selected-icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.selected-icon {
		position: relative;
		width: 48px;
		height: 48px;
		padding: 0;
		background: rgba(30, 41, 59, 0.6);
		border: 2px solid #6366f1;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.selected-icon:hover {
		transform: scale(1.1);
		border-color: #f87171;
	}

	.selected-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 4px;
	}

	.icon-remove {
		position: absolute;
		top: -6px;
		right: -6px;
		background: #ef4444;
		color: white;
		border-radius: 50%;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: bold;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.selected-icon:hover .icon-remove {
		opacity: 1;
	}

	.icon-pool-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
		gap: 0.5rem;
		max-height: 300px;
		overflow-y: auto;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.3);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.icon-pool-item {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		border: 2px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.icon-pool-item:hover {
		background: rgba(30, 41, 59, 0.8);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.icon-pool-item.selected {
		background: rgba(79, 70, 229, 0.2);
		border-color: #6366f1;
	}

	.icon-pool-item img {
		width: 40px;
		height: 40px;
		object-fit: contain;
	}

	.icon-name {
		font-size: 0.65rem;
		color: #cbd5e1;
		text-align: center;
		word-break: break-word;
		line-height: 1.2;
	}

	.icon-count {
		position: absolute;
		top: 4px;
		right: 4px;
		background: #6366f1;
		color: white;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: bold;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.calling-card-editor__actions {
		display: flex;
		justify-content: flex-start;
		padding-top: 0.5rem;
	}
</style>
