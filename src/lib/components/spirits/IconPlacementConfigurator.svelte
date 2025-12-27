<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FOLDER_TYPES,
		type FolderType,
		type IconPlacementConfig,
		type IconSlot,
		loadIconPlacementConfig,
		saveIconPlacementConfig,
		createDefaultConfig
	} from '$lib/generators/spirits/spiritIconPlacer';
	import { loadImage } from '$lib/generators/shared/canvas';

	interface Props {
		isOpen: boolean;
		sampleImageUrls: Record<FolderType, string | null>;
		onClose: () => void;
		onSave: (config: IconPlacementConfig) => void;
		onGenerateAll: () => void;
	}

	let { isOpen, sampleImageUrls, onClose, onSave, onGenerateAll }: Props = $props();

	let config: IconPlacementConfig = $state(createDefaultConfig());
	let currentFolder: FolderType = $state('Human');
	let currentSlotType: 'icon_slots' | 'rune_slots' = $state('icon_slots');
	let selectedSlotIndex: number | null = $state(null);

	let jsonEditorOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let sampleImage: HTMLImageElement | null = $state(null);
	let displayScale = $state(1);
	let draggingSlot: number | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });

	// Computed slots
	let currentSlots = $derived.by(() => {
		const folderConfig = config[currentFolder];
		if (typeof folderConfig === 'number') return [];
		return folderConfig?.[currentSlotType] ?? [];
	});

	let currentSize = $derived(
		currentSlotType === 'icon_slots' ? config._icon_size : config._rune_size
	);

	onMount(() => {
		config = loadIconPlacementConfig();
	});

	$effect(() => {
		if (isOpen && currentFolder) {
			loadSampleImage(currentFolder);
		}
	});

	$effect(() => {
		if (sampleImage && canvasEl) {
			drawCanvas();
		}
	});

	async function loadSampleImage(folder: FolderType) {
		const url = sampleImageUrls[folder];
		if (!url) {
			sampleImage = null;
			return;
		}
		try {
			sampleImage = await loadImage(url);
			calculateDisplayScale();
			drawCanvas();
		} catch (err) {
			console.warn('Failed to load sample image:', err);
			sampleImage = null;
		}
	}

	function calculateDisplayScale() {
		if (!sampleImage) return;
		// Fit to 600px width max
		const maxWidth = 600;
		displayScale = Math.min(1, maxWidth / sampleImage.width);
	}

	function drawCanvas() {
		if (!canvasEl || !sampleImage) return;

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const scaledWidth = Math.floor(sampleImage.width * displayScale);
		const scaledHeight = Math.floor(sampleImage.height * displayScale);

		canvasEl.width = scaledWidth;
		canvasEl.height = scaledHeight;

		// Draw sample image
		ctx.drawImage(sampleImage, 0, 0, scaledWidth, scaledHeight);

		// Draw slot rectangles
		const size = currentSize * displayScale;
		const colors =
			currentSlotType === 'icon_slots'
				? ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
				: ['#FFD93D', '#FF8C42'];

		currentSlots.forEach((slot, i) => {
			const color = colors[i % colors.length];
			const x = slot.x * displayScale;
			const y = slot.y * displayScale;

			// Draw rectangle
			ctx.strokeStyle = color;
			ctx.lineWidth = selectedSlotIndex === i ? 4 : 2;
			ctx.strokeRect(x, y, size, size);

			// Draw slot number
			ctx.fillStyle = color;
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(i + 1), x + size / 2, y + size / 2);
		});
	}

	function handleCanvasClick(event: MouseEvent) {
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;
		const size = currentSize;

		// Check if clicking on a slot
		for (let i = 0; i < currentSlots.length; i++) {
			const slot = currentSlots[i];
			if (
				realX >= slot.x &&
				realX <= slot.x + size &&
				realY >= slot.y &&
				realY <= slot.y + size
			) {
				selectedSlotIndex = i;
				draggingSlot = i;
				dragOffset = { x: realX - slot.x, y: realY - slot.y };
				drawCanvas();
				return;
			}
		}

		selectedSlotIndex = null;
		draggingSlot = null;
		drawCanvas();
	}

	function handleCanvasDrag(event: MouseEvent) {
		if (draggingSlot === null || !sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		updateSlotPosition(draggingSlot, {
			x: Math.max(0, Math.round(realX - dragOffset.x)),
			y: Math.max(0, Math.round(realY - dragOffset.y))
		});
	}

	function handleCanvasRelease() {
		draggingSlot = null;
	}

	function handleCanvasRightClick(event: MouseEvent) {
		event.preventDefault();
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = Math.round((event.clientX - rect.left) / displayScale);
		const realY = Math.round((event.clientY - rect.top) / displayScale);

		addSlot({ x: realX, y: realY });
	}

	function addSlot(position?: { x: number; y: number }) {
		const folderConfig = config[currentFolder];
		if (typeof folderConfig === 'number') return;

		const offset = currentSlots.length * 30;
		const newSlot: IconSlot = position ?? { x: 50 + offset, y: 50 + offset };

		config = {
			...config,
			[currentFolder]: {
				...folderConfig,
				[currentSlotType]: [...(folderConfig[currentSlotType] ?? []), newSlot]
			}
		};

		selectedSlotIndex = currentSlots.length;
		drawCanvas();
	}

	function removeSelectedSlot() {
		if (selectedSlotIndex === null) return;

		const folderConfig = config[currentFolder];
		if (typeof folderConfig === 'number') return;

		const newSlots = [...(folderConfig[currentSlotType] ?? [])];
		newSlots.splice(selectedSlotIndex, 1);

		config = {
			...config,
			[currentFolder]: {
				...folderConfig,
				[currentSlotType]: newSlots
			}
		};

		selectedSlotIndex = null;
		drawCanvas();
	}

	function updateSlotPosition(index: number, pos: { x: number; y: number }) {
		const folderConfig = config[currentFolder];
		if (typeof folderConfig === 'number') return;

		const newSlots = [...(folderConfig[currentSlotType] ?? [])];
		newSlots[index] = { ...newSlots[index], ...pos };

		config = {
			...config,
			[currentFolder]: {
				...folderConfig,
				[currentSlotType]: newSlots
			}
		};

		drawCanvas();
	}

	function handleSizeChange(type: 'icon' | 'rune', value: number) {
		if (type === 'icon') {
			config = { ...config, _icon_size: value };
		} else {
			config = { ...config, _rune_size: value };
		}
		drawCanvas();
	}

	function copyFromFolder(sourceFolder: FolderType) {
		const sourceConfig = config[sourceFolder];
		if (typeof sourceConfig === 'number') return;

		config = {
			...config,
			[currentFolder]: {
				...sourceConfig
			}
		};
		drawCanvas();
	}

	function handleSave() {
		saveIconPlacementConfig(config);
		onSave(config);
	}

	function handleGenerate() {
		saveIconPlacementConfig(config);
		onGenerateAll();
	}

	function handleSlotTypeChange(type: 'icon_slots' | 'rune_slots') {
		currentSlotType = type;
		selectedSlotIndex = null;
		drawCanvas();
	}

	function handleFolderChange(folder: FolderType) {
		currentFolder = folder;
		selectedSlotIndex = null;
		loadSampleImage(folder);
	}

	function openJsonEditor() {
		jsonText = JSON.stringify(config, null, 2);
		jsonError = '';
		jsonEditorOpen = true;
	}

	function closeJsonEditor() {
		jsonEditorOpen = false;
		jsonError = '';
	}

	function applyJsonConfig() {
		try {
			const parsed = JSON.parse(jsonText) as IconPlacementConfig;
			// Validate structure
			if (typeof parsed._icon_size !== 'number' || typeof parsed._rune_size !== 'number') {
				throw new Error('Missing _icon_size or _rune_size');
			}
			config = parsed;
			jsonError = '';
			jsonEditorOpen = false;
			drawCanvas();
		} catch (err) {
			jsonError = err instanceof Error ? err.message : 'Invalid JSON';
		}
	}

	async function copyJsonToClipboard() {
		const text = JSON.stringify(config, null, 2);
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}
	}

	function resetToDefaults() {
		config = createDefaultConfig();
		jsonText = JSON.stringify(config, null, 2);
		jsonError = '';
		drawCanvas();
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" role="button" tabindex="0" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<header class="modal__header">
				<h2>Icon Placement Configuration</h2>
				<button type="button" class="modal__close" onclick={onClose}>✕</button>
			</header>

			<div class="modal__body">
				<div class="config-layout">
					<!-- Left Panel: Controls -->
					<div class="controls-panel">
						<!-- Folder Type Selector -->
						<div class="control-group">
							<label class="control-label">Folder Type</label>
							<select
								class="control-select"
								value={currentFolder}
								onchange={(e) => handleFolderChange(e.currentTarget.value as FolderType)}
							>
								{#each FOLDER_TYPES as folder}
									<option value={folder}>{folder}</option>
								{/each}
							</select>
						</div>

						<!-- Slot Type Selector -->
						<div class="control-group">
							<label class="control-label">Slot Type</label>
							<div class="slot-type-buttons">
								<button
									type="button"
									class={`slot-type-btn ${currentSlotType === 'icon_slots' ? 'active' : ''}`}
									onclick={() => handleSlotTypeChange('icon_slots')}
								>
									Icons (Origin/Class)
								</button>
								<button
									type="button"
									class={`slot-type-btn ${currentSlotType === 'rune_slots' ? 'active' : ''}`}
									onclick={() => handleSlotTypeChange('rune_slots')}
								>
									Runes
								</button>
							</div>
						</div>

						<!-- Slot Controls -->
						<div class="control-group">
							<label class="control-label">Slots ({currentSlots.length})</label>
							<div class="slot-buttons">
								<button type="button" class="btn btn--sm" onclick={() => addSlot()}>
									Add Slot
								</button>
								<button
									type="button"
									class="btn btn--sm btn--danger"
									onclick={removeSelectedSlot}
									disabled={selectedSlotIndex === null}
								>
									Remove Selected
								</button>
							</div>
						</div>

						<!-- Slot List -->
						<div class="slot-list">
							{#each currentSlots as slot, i}
								<button
									type="button"
									class={`slot-item ${selectedSlotIndex === i ? 'selected' : ''}`}
									onclick={() => { selectedSlotIndex = i; drawCanvas(); }}
								>
									{currentSlotType === 'icon_slots' ? 'Icon' : 'Rune'} {i + 1}: ({slot.x}, {slot.y})
								</button>
							{/each}
						</div>

						<!-- Size Controls -->
						<div class="control-group">
							<label class="control-label">Sizes</label>
							<div class="size-inputs">
								<label class="size-input">
									<span>Icon:</span>
									<input
										type="number"
										value={config._icon_size}
										onchange={(e) => handleSizeChange('icon', Number(e.currentTarget.value))}
									/>
								</label>
								<label class="size-input">
									<span>Rune:</span>
									<input
										type="number"
										value={config._rune_size}
										onchange={(e) => handleSizeChange('rune', Number(e.currentTarget.value))}
									/>
								</label>
							</div>
						</div>

						<!-- Selected Slot Position -->
						{#if selectedSlotIndex !== null && currentSlots[selectedSlotIndex]}
							<div class="control-group">
								<label class="control-label">Selected Position</label>
								<div class="position-inputs">
									<label class="position-input">
										<span>X:</span>
										<input
											type="number"
											value={currentSlots[selectedSlotIndex].x}
											onchange={(e) => updateSlotPosition(selectedSlotIndex!, { x: Number(e.currentTarget.value), y: currentSlots[selectedSlotIndex!].y })}
										/>
									</label>
									<label class="position-input">
										<span>Y:</span>
										<input
											type="number"
											value={currentSlots[selectedSlotIndex].y}
											onchange={(e) => updateSlotPosition(selectedSlotIndex!, { x: currentSlots[selectedSlotIndex!].x, y: Number(e.currentTarget.value) })}
										/>
									</label>
								</div>
							</div>
						{/if}

						<!-- Copy From Folder -->
						<div class="control-group">
							<label class="control-label">Copy From</label>
							<div class="copy-controls">
								<select class="control-select" id="copy-source">
									{#each FOLDER_TYPES as folder}
										<option value={folder}>{folder}</option>
									{/each}
								</select>
								<button
									type="button"
									class="btn btn--sm"
									onclick={() => {
										const select = document.getElementById('copy-source') as HTMLSelectElement;
										copyFromFolder(select.value as FolderType);
									}}
								>
									Copy Here
								</button>
							</div>
						</div>

						<!-- JSON Editor -->
						<div class="control-group">
							<button
								type="button"
								class="json-toggle-btn"
								onclick={() => jsonEditorOpen ? closeJsonEditor() : openJsonEditor()}
							>
								<span class="json-toggle-icon">{jsonEditorOpen ? '▼' : '▶'}</span>
								JSON Config Editor
							</button>

							{#if jsonEditorOpen}
								<div class="json-editor">
									<div class="json-actions">
										<button type="button" class="btn btn--sm" onclick={copyJsonToClipboard}>
											Copy JSON
										</button>
										<button type="button" class="btn btn--sm btn--danger" onclick={resetToDefaults}>
											Reset to Defaults
										</button>
									</div>
									<textarea
										class="json-textarea"
										bind:value={jsonText}
										spellcheck="false"
										placeholder="Paste JSON config here..."
									></textarea>
									{#if jsonError}
										<p class="json-error">{jsonError}</p>
									{/if}
									<button type="button" class="btn btn--sm btn--primary" onclick={applyJsonConfig}>
										Apply JSON Config
									</button>
								</div>
							{/if}
						</div>
					</div>

					<!-- Right Panel: Canvas Preview -->
					<div class="preview-panel">
						{#if sampleImage}
							<canvas
								bind:this={canvasEl}
								class="preview-canvas"
								onmousedown={handleCanvasClick}
								onmousemove={handleCanvasDrag}
								onmouseup={handleCanvasRelease}
								onmouseleave={handleCanvasRelease}
								oncontextmenu={handleCanvasRightClick}
							></canvas>
							<p class="preview-hint">
								Left-click to select/drag slots. Right-click to add new slot.
							</p>
						{:else}
							<div class="preview-placeholder">
								<p>No sample image available for "{currentFolder}"</p>
								<p class="preview-hint">Upload a game print image to a spirit with cost matching this folder to see a preview.</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<footer class="modal__footer">
				<button type="button" class="btn btn--secondary" onclick={handleSave}>
					Save Configuration
				</button>
				<button type="button" class="btn btn--primary" onclick={handleGenerate}>
					Generate All Game Prints with Icons
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.85);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal {
		background: rgba(15, 23, 42, 0.98);
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		width: 100%;
		max-width: 1100px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
	}

	.modal__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.modal__header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.modal__close {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.modal__close:hover {
		background: rgba(248, 113, 113, 0.2);
		color: #f87171;
	}

	.modal__body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.config-layout {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 1.5rem;
	}

	.controls-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(148, 163, 184, 0.8);
	}

	.control-select {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.slot-type-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.slot-type-btn {
		flex: 1;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #94a3b8;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.slot-type-btn:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.slot-type-btn.active {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.5);
		color: #f8fafc;
	}

	.slot-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 150px;
		overflow-y: auto;
	}

	.slot-item {
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		color: #e2e8f0;
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.slot-item:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.slot-item.selected {
		background: rgba(99, 102, 241, 0.25);
		border-color: rgba(99, 102, 241, 0.5);
	}

	.size-inputs,
	.position-inputs {
		display: flex;
		gap: 0.75rem;
	}

	.size-input,
	.position-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.size-input span,
	.position-input span {
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.size-input input,
	.position-input input {
		width: 70px;
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.copy-controls {
		display: flex;
		gap: 0.5rem;
	}

	.copy-controls select {
		flex: 1;
	}

	.preview-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.preview-canvas {
		background: #333;
		border-radius: 8px;
		cursor: crosshair;
		max-width: 100%;
	}

	.preview-hint {
		color: #94a3b8;
		font-size: 0.8rem;
		margin: 0;
	}

	.preview-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.2);
		color: #94a3b8;
		text-align: center;
		padding: 2rem;
	}

	.modal__footer {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	.btn {
		padding: 0.6rem 1.25rem;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.15s ease;
		border: none;
	}

	.btn--sm {
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
	}

	.btn--primary {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(139, 92, 246, 0.8));
		color: white;
	}

	.btn--primary:hover {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9));
	}

	.btn--secondary {
		background: rgba(30, 41, 59, 0.8);
		color: #e2e8f0;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.btn--secondary:hover {
		background: rgba(30, 41, 59, 1);
	}

	.btn--danger {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.btn--danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.3);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* JSON Editor Styles */
	.json-toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.6rem 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #e2e8f0;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.json-toggle-btn:hover {
		background: rgba(30, 41, 59, 0.8);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.json-toggle-icon {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.json-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.json-actions {
		display: flex;
		gap: 0.5rem;
	}

	.json-textarea {
		width: 100%;
		min-height: 200px;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #a5f3fc;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		resize: vertical;
	}

	.json-textarea:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
	}

	.json-error {
		margin: 0;
		padding: 0.5rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 4px;
		color: #f87171;
		font-size: 0.8rem;
	}

	@media (max-width: 768px) {
		.config-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
