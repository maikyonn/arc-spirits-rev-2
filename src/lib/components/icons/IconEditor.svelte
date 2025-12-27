<script lang="ts">
	import type { IconPoolRow, IconPoolSourceType } from '$lib/types/gameData';
	import { supabase } from '$lib/api/supabaseClient';
	import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';

	interface Props {
		icon: IconPoolRow;
		publicUrl: (path: string) => string;
		onClose: () => void;
		onSave: (updated: IconPoolRow) => void;
		onDelete?: (icon: IconPoolRow) => void;
	}

	let { icon, publicUrl, onClose, onSave, onDelete }: Props = $props();

	let name = $state(icon.name);
	let sourceType = $state<IconPoolSourceType>(icon.source_type);
	let exportAsToken = $state(icon.export_as_token ?? false);
	let tags = $state<string[]>(icon.tags ?? []);
	let tagInput = $state('');
	let saving = $state(false);
	let deleting = $state(false);
	let uploading = $state(false);
	let error: string | null = $state(null);
	let newFilePath = $state<string | null>(null);
	let previewUrl = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	const sourceTypes: { value: IconPoolSourceType; label: string }[] = [
		{ value: 'origin', label: 'Origin' },
		{ value: 'class', label: 'Class' },
		{ value: 'dice_side', label: 'Dice Side' },
		{ value: 'uploaded', label: 'Uploaded' },
		{ value: 'rune', label: 'Rune' }
	];

	// Only show tags editor and image replacement for uploaded icons
	const showTagsEditor = $derived(sourceType === 'uploaded');
	const canReplaceImage = $derived(icon.source_type === 'uploaded');

	const hasChanges = $derived(
		name !== icon.name ||
		sourceType !== icon.source_type ||
		exportAsToken !== (icon.export_as_token ?? false) ||
		JSON.stringify(tags) !== JSON.stringify(icon.tags ?? []) ||
		newFilePath !== null
	);

	// Display URL - use local preview blob if we have a new file, otherwise the current icon
	// For uploaded images we use the local blob URL for instant preview before save
	const displayImageUrl = $derived(previewUrl ?? publicUrl(icon.file_path));

	function addTag() {
		const newTag = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
		if (newTag && !tags.includes(newTag)) {
			tags = [...tags, newTag];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter(t => t !== tag);
	}

	function handleTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag();
		}
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			error = 'Please select an image file';
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be less than 5MB';
			return;
		}

		uploading = true;
		error = null;

		try {
			// Use unified upload function with transparent cropping
			const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'icon';
			const { data, error: uploadError } = await processAndUploadImage(file, {
				bucket: 'game_assets',
				folder: 'icons/uploaded',
				filename: `${safeName}_${Date.now()}`,
				cropTransparent: true,
				upsert: false
			});

			if (uploadError) throw uploadError;
			if (!data?.path) throw new Error('Upload failed - no path returned');

			// Set the new file path for saving
			newFilePath = data.path;

			// Create a preview URL
			previewUrl = URL.createObjectURL(file);
		} catch (err) {
			console.error('Failed to upload image:', err);
			error = err instanceof Error ? err.message : 'Failed to upload image';
		} finally {
			uploading = false;
		}
	}

	function clearNewImage() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = null;
		newFilePath = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	async function handleSave() {
		if (!name.trim()) {
			error = 'Name is required';
			return;
		}

		saving = true;
		error = null;

		try {
			const updatePayload: Record<string, unknown> = {
				name: name.trim(),
				source_type: sourceType,
				export_as_token: exportAsToken,
				tags: tags.length > 0 ? tags : null
			};

			// Include new file path if image was replaced
			if (newFilePath) {
				updatePayload.file_path = newFilePath;
			}

			const { error: updateError } = await supabase
				.from('icon_pool')
				.update(updatePayload)
				.eq('id', icon.id);

			if (updateError) throw updateError;

			const updated: IconPoolRow = {
				...icon,
				name: name.trim(),
				source_type: sourceType,
				export_as_token: exportAsToken,
				tags: tags.length > 0 ? tags : undefined,
				file_path: newFilePath ?? icon.file_path
			};

			// Clean up preview URL
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}

			onSave(updated);
		} catch (err) {
			console.error('Failed to save icon:', err);
			error = err instanceof Error ? err.message : 'Failed to save icon';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete) return;
		if (!confirm(`Delete icon "${icon.name}"? This action cannot be undone.`)) return;

		deleting = true;
		error = null;

		try {
			const { error: deleteError } = await supabase
				.from('icon_pool')
				.delete()
				.eq('id', icon.id);

			if (deleteError) throw deleteError;

			onDelete(icon);
		} catch (err) {
			console.error('Failed to delete icon:', err);
			error = err instanceof Error ? err.message : 'Failed to delete icon';
		} finally {
			deleting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			handleSave();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="modal-backdrop"
	role="presentation"
	tabindex="-1"
	onclick={handleBackdropClick}
>
	<div class="modal" role="dialog" aria-modal="true" aria-label="Edit Icon">
		<header class="modal-header">
			<h2>Edit Icon</h2>
			<button class="close-btn" type="button" onclick={onClose} aria-label="Close">
				&times;
			</button>
		</header>

		<div class="modal-body">
			{#if error}
				<div class="error-banner">{error}</div>
			{/if}

			<div class="preview-section">
				<div class="icon-preview" class:has-new-image={newFilePath}>
					<img src={displayImageUrl} alt={icon.name} />
					{#if newFilePath}
						<span class="new-badge">NEW</span>
					{/if}
				</div>
				<div class="file-info">
					<span class="file-path" title={newFilePath ?? icon.file_path}>
						{newFilePath ?? icon.file_path}
					</span>
					{#if icon.source_id}
						<span class="source-id">Source ID: {icon.source_id}</span>
					{/if}
				</div>
				{#if canReplaceImage}
					<div class="replace-image-section">
						<input
							type="file"
							accept="image/*"
							bind:this={fileInput}
							onchange={handleFileSelect}
							disabled={saving || uploading}
							style="display: none"
						/>
						{#if newFilePath}
							<button
								type="button"
								class="btn btn-sm btn-secondary"
								onclick={clearNewImage}
								disabled={saving || uploading}
							>
								Cancel Replace
							</button>
						{:else}
							<button
								type="button"
								class="btn btn-sm btn-secondary"
								onclick={() => fileInput?.click()}
								disabled={saving || uploading}
							>
								{uploading ? 'Uploading...' : 'Replace Image'}
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<div class="form-group">
				<label for="icon-name">Name</label>
				<input
					id="icon-name"
					type="text"
					bind:value={name}
					placeholder="Icon name"
					disabled={saving}
				/>
			</div>

			<div class="form-group">
				<label for="icon-source-type">Source Type</label>
				<select
					id="icon-source-type"
					bind:value={sourceType}
					disabled={saving}
				>
					{#each sourceTypes as st (st.value)}
						<option value={st.value}>{st.label}</option>
					{/each}
				</select>
			</div>

			{#if showTagsEditor}
				<div class="form-group">
					<label for="icon-tags">Tags</label>
					<div class="tags-editor">
						<div class="tags-list">
							{#each tags as tag (tag)}
								<span class="tag">
									{tag}
									<button
										type="button"
										class="tag-remove"
										onclick={() => removeTag(tag)}
										disabled={saving}
									>
										&times;
									</button>
								</span>
							{:else}
								<span class="no-tags">No tags</span>
							{/each}
						</div>
						<div class="tag-input-row">
							<input
								id="icon-tags"
								type="text"
								bind:value={tagInput}
								placeholder="Add tag..."
								disabled={saving}
								onkeydown={handleTagKeydown}
							/>
							<button
								type="button"
								class="btn btn-add-tag"
								onclick={addTag}
								disabled={saving || !tagInput.trim()}
							>
								Add
							</button>
						</div>
					</div>
					<p class="help-text">Tags help organize uploaded icons into groups</p>
				</div>
			{/if}

			<div class="form-group checkbox-group">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={exportAsToken}
						disabled={saving}
					/>
					<span>Export as Token</span>
				</label>
				<p class="help-text">Include this icon in the TTS export tokens list</p>
			</div>
		</div>

		<footer class="modal-footer">
			{#if onDelete}
				<button
					class="btn btn-danger"
					onclick={handleDelete}
					disabled={saving || deleting}
				>
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			{/if}
			<div class="spacer"></div>
			<button class="btn btn-secondary" onclick={onClose} disabled={saving}>
				Cancel
			</button>
			<button
				class="btn btn-primary"
				onclick={handleSave}
				disabled={saving || !hasChanges}
			>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</footer>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.75);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 2rem 1rem;
		z-index: 1200;
		overflow-y: auto;
	}

	.modal {
		width: min(480px, 95vw);
		background: rgba(8, 14, 32, 0.98);
		border: 1px solid rgba(94, 114, 228, 0.28);
		border-radius: 12px;
		box-shadow: 0 16px 48px rgba(2, 6, 23, 0.6);
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 4rem);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid rgba(94, 114, 228, 0.15);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
		font-weight: 600;
	}

	.close-btn {
		border: none;
		background: rgba(30, 41, 59, 0.7);
		color: #94a3b8;
		border-radius: 6px;
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		transition: all 0.15s;
	}

	.close-btn:hover {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.modal-body {
		padding: 1rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.error-banner {
		padding: 0.5rem 0.75rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 6px;
		color: #f87171;
		font-size: 0.75rem;
	}

	.preview-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.icon-preview {
		position: relative;
		width: 120px;
		height: 120px;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.6));
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.icon-preview.has-new-image {
		border-color: rgba(34, 197, 94, 0.5);
		box-shadow: 0 0 12px rgba(34, 197, 94, 0.2);
	}

	.icon-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 0.5rem;
	}

	.new-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		padding: 2px 6px;
		background: rgba(34, 197, 94, 0.9);
		border-radius: 4px;
		font-size: 0.55rem;
		font-weight: 600;
		color: white;
		text-transform: uppercase;
	}

	.replace-image-section {
		margin-top: 0.5rem;
	}

	.btn-sm {
		padding: 0.3rem 0.6rem;
		font-size: 0.7rem;
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: center;
	}

	.file-path {
		font-size: 0.65rem;
		color: #64748b;
		font-family: 'JetBrains Mono', monospace;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-id {
		font-size: 0.6rem;
		color: #475569;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-group label {
		font-size: 0.7rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.form-group input[type='text'],
	.form-group select {
		padding: 0.5rem 0.65rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f1f5f9;
		font-size: 0.8rem;
		transition: border-color 0.2s;
	}

	.form-group input[type='text']:focus,
	.form-group select:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
	}

	.form-group input:disabled,
	.form-group select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tags-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		min-height: 28px;
		padding: 0.4rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.4rem;
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-radius: 4px;
		font-size: 0.7rem;
		color: #a5b4fc;
	}

	.tag-remove {
		border: none;
		background: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0;
		font-size: 0.9rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 2px;
		transition: all 0.15s;
	}

	.tag-remove:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.3);
		color: #f87171;
	}

	.tag-remove:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.no-tags {
		font-size: 0.7rem;
		color: #64748b;
		font-style: italic;
	}

	.tag-input-row {
		display: flex;
		gap: 0.35rem;
	}

	.tag-input-row input {
		flex: 1;
	}

	.btn-add-tag {
		padding: 0.4rem 0.6rem;
		background: rgba(99, 102, 241, 0.3);
		border: 1px solid rgba(99, 102, 241, 0.4);
		border-radius: 6px;
		color: #a5b4fc;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-add-tag:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.5);
	}

	.btn-add-tag:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-group {
		padding: 0.5rem 0.65rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.8rem;
		color: #f1f5f9;
	}

	.checkbox-label input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: #4ade80;
		cursor: pointer;
	}

	.help-text {
		margin: 0.35rem 0 0;
		font-size: 0.65rem;
		color: #64748b;
	}

	.modal-footer {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid rgba(94, 114, 228, 0.15);
		background: rgba(8, 14, 32, 0.6);
	}

	.spacer {
		flex: 1;
	}

	.btn {
		padding: 0.45rem 0.85rem;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: 1px solid transparent;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: rgba(99, 102, 241, 0.8);
		color: white;
		border-color: rgba(99, 102, 241, 0.6);
	}

	.btn-primary:hover:not(:disabled) {
		background: rgba(99, 102, 241, 1);
	}

	.btn-secondary {
		background: rgba(71, 85, 105, 0.5);
		color: #e2e8f0;
		border-color: rgba(71, 85, 105, 0.4);
	}

	.btn-secondary:hover:not(:disabled) {
		background: rgba(71, 85, 105, 0.7);
	}

	.btn-danger {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
		border-color: rgba(239, 68, 68, 0.3);
	}

	.btn-danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.25);
	}
</style>
