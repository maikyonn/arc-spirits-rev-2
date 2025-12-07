<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { OriginRow } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
import CardActionMenu from '$lib/components/CardActionMenu.svelte';
import {
		deleteOriginRecord,
		emptyOriginForm,
		fetchOriginRecords,
		originRowToForm,
	saveOriginRecord,
	type OriginFormData
} from '$lib/features/origins/origins';
	import { emojiToPngBlob } from '$lib/utils/emojiToPng';
	import { publicAssetUrl } from '$lib/utils/storage';

	let origins: OriginRow[] = [];
	let loading = true;
	let error: string | null = null;
	let backfillingIcons = false;

	let search = '';

	let showOriginForm = false;
	let editingOrigin: OriginRow | null = null;
let formData: OriginFormData = emptyOriginForm();
let formIconPreview: string | null = null;

let uploadingIconId: string | null = null;
let removingIconId: string | null = null;
const gameAssetsStorage = supabase.storage.from('game_assets');

$: formIconPreview = getIconUrl(formData.icon_png);

function getIconUrl(path: string | null | undefined, updatedAt?: string | number | null): string | null {
	return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
}

	function isIconImage(iconPng: string | null | undefined): boolean {
		return !!iconPng;
	}

	function sanitizeFileName(name: string): string {
		// Convert to lowercase, replace spaces and special chars with underscores
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50); // Limit length
	}

	async function handleIconUpload(origin: OriginRow, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be smaller than 5MB.');
			return;
		}

		uploadingIconId = origin.id;
		try {
			// Remove old icon if it exists
			if (isIconImage(origin.icon_png)) {
				const oldPath = origin.icon_png!.startsWith('origin_icons/') ? origin.icon_png! : `origin_icons/${origin.icon_png!}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const sanitizedName = sanitizeFileName(origin.name);
			const fileName = `origin_${sanitizedName}_icon.${extension}`;
			const path = `origin_icons/${origin.id}/${fileName}`;

			const { error: uploadError } = await gameAssetsStorage.upload(path, file, {
				cacheControl: '3600',
				upsert: false,
				contentType: file.type
			});
			if (uploadError) {
				throw uploadError;
			}

			const { error: updateError } = await supabase
				.from('origins')
				.update({ icon_png: path, updated_at: new Date().toISOString() })
				.eq('id', origin.id);
			if (updateError) {
				throw updateError;
			}

			await loadOrigins();
		} catch (err) {
			console.error(err);
			alert('Failed to upload icon. Please try again.');
		} finally {
			uploadingIconId = null;
		}
	}

	async function removeIcon(origin: OriginRow) {
		if (!isIconImage(origin.icon_png)) return;
		removingIconId = origin.id;
		try {
			const path = origin.icon_png!.startsWith('origin_icons/') ? origin.icon_png! : `origin_icons/${origin.icon_png!}`;
			await gameAssetsStorage.remove([path]);
			const { error: updateError } = await supabase
				.from('origins')
				.update({ icon_png: null, updated_at: new Date().toISOString() })
				.eq('id', origin.id);
			if (updateError) {
				throw updateError;
			}
			await loadOrigins();
		} catch (err) {
			console.error(err);
			alert('Failed to remove icon.');
		} finally {
			removingIconId = null;
		}
	}

	function handleIconFileChange(origin: OriginRow, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) {
			handleIconUpload(origin, file);
		}
	}

onMount(loadOrigins);

	async function loadOrigins() {
		try {
			loading = true;
			error = null;
			origins = await fetchOriginRecords();
			void backfillMissingIcons();
			formIconPreview = getIconUrl(formData.icon_png, formData.id ? origins.find((o) => o.id === formData.id)?.updated_at ?? null : null);
		} catch (err) {
			error = err instanceof Error 
				? err.message 
				: (err && typeof err === 'object' && 'message' in err)
					? String(err.message)
					: String(err);
		} finally {
			loading = false;
		}
	}

async function backfillMissingIcons(force = false) {
	if (backfillingIcons) return;
	const targets = origins.filter((o) => (force || !o.icon_png) && o.icon_emoji);
	if (!targets.length) return;
	backfillingIcons = true;
	for (const origin of targets) {
		try {
			const blob = await emojiToPngBlob(origin.icon_emoji ?? '', 512);
			if (!blob) continue;
			const path = `origin_icons/${origin.id}/icon.png`;
			const { error: uploadError } = await gameAssetsStorage.upload(path, blob, {
				cacheControl: '3600',
				upsert: true,
				contentType: 'image/png'
			});
			if (uploadError) throw uploadError;
			const { error: updateError } = await supabase
				.from('origins')
				.update({ icon_png: path, icon_token_png: path, updated_at: new Date().toISOString() })
				.eq('id', origin.id);
			if (updateError) throw updateError;
		} catch (err) {
			console.warn('Backfill origin icon failed for', origin.name, err);
		}
	}
		backfillingIcons = false;
		void loadOrigins();
	}

	function openOriginForm(origin?: OriginRow) {
		if (origin) {
			editingOrigin = origin;
			formData = originRowToForm(origin);
		} else {
			editingOrigin = null;
			const nextPosition = (origins.at(-1)?.position ?? origins.length) + 1;
			formData = emptyOriginForm(nextPosition);
		}
		showOriginForm = true;
	}

	function closeOriginForm() {
		showOriginForm = false;
	}

	async function saveOrigin() {
		if (!formData.name.trim()) {
			alert('Origin name is required.');
			return;
		}

		try {
			const saved = await saveOriginRecord(formData);
			await loadOrigins();
			editingOrigin = saved;
			closeOriginForm();
		} catch (err) {
			const message = err instanceof Error 
				? err.message 
				: (err && typeof err === 'object' && 'message' in err)
					? String(err.message)
					: String(err);
			alert(`Failed to save origin: ${message}`);
		}
	}

	async function deleteOrigin(origin: OriginRow) {
		if (!confirm(`Delete origin "${origin.name}"? This cannot be undone.`)) return;
		try {
			await deleteOriginRecord(origin.id);
			await loadOrigins();
		} catch (err) {
			const message = err instanceof Error 
				? err.message 
				: (err && typeof err === 'object' && 'message' in err)
					? String(err.message)
					: String(err);
			alert(`Failed to delete origin: ${message}`);
		}
	}

	function submitOriginForm(event: Event) {
		event.preventDefault();
		void saveOrigin();
	}

	function renderMultiline(value?: string | null): string {
		return (value ?? '').replace(/\r\n/g, '\n').trim();
	}

	$: filteredOrigins = origins.filter((origin) => {
		if (!search.trim()) return true;
		const term = search.trim().toLowerCase();
		return (
			origin.name.toLowerCase().includes(term) ||
			(origin.description ?? '').toLowerCase().includes(term)
		);
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Origins</h1>
			<p>Define the origins that bind spirits, runes, and artifacts.</p>
		</div>
		<div class="actions">
	<button class="btn" onclick={() => backfillMissingIcons(true)} aria-busy={backfillingIcons}>
				{backfillingIcons ? 'Resetting PNGs…' : 'Reset PNGs'}
			</button>
			<button class="btn" onclick={() => openOriginForm()}>Create Origin</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search origins" bind:value={search} />
		</label>
	</section>

	{#if loading}
		<div class="card">Loading origins…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredOrigins as origin (origin.id)}
				<article class="card origin-card">
					<header>
						<div class="origin-card__identity">
		{#if getIconUrl(origin.icon_png, origin.updated_at)}
			<img class="origin-card__icon-image" src={getIconUrl(origin.icon_png, origin.updated_at)} alt={`${origin.name} icon`} />
							{:else if origin.icon_emoji}
								<span class="origin-card__icon">{origin.icon_emoji}</span>
							{/if}
							<div>
								<h2>{origin.name}</h2>
								<small>Position {origin.position}</small>
							</div>
						</div>
				<CardActionMenu
							onEdit={() => openOriginForm(origin)}
							onDelete={() => deleteOrigin(origin)}
							onGenerate={null}
						/>
					</header>
					<div class="origin-card__icon-actions">
						<label class="upload-button">
							<input
								type="file"
								accept="image/*"
								onchange={(event) => handleIconFileChange(origin, event)}
								aria-label={`Upload icon for ${origin.name}`}
							/>
							<span>{uploadingIconId === origin.id ? 'Uploading…' : 'Upload Icon'}</span>
						</label>
						<button
							class="btn danger"
							type="button"
							onclick={() => removeIcon(origin)}
							disabled={removingIconId === origin.id || !isIconImage(origin.icon_png)}
						>
							{removingIconId === origin.id ? 'Removing…' : 'Remove Icon'}
						</button>
					</div>
					{#if origin.description}
						<p class="muted">{renderMultiline(origin.description)}</p>
					{/if}
					<div class="meta">
						{#if origin.color}
							<span class="tag">
								Color:
								<span class="swatch" style={`background:${origin.color}`}></span>
								{origin.color}
							</span>
						{/if}
					</div>
				</article>
			{:else}
				<div class="card empty">No origins match the current search.</div>
			{/each}
		</section>
	{/if}

	{#if showOriginForm}
		<EditorModal
			title={editingOrigin ? 'Edit Origin' : 'Create Origin'}
			description="Maintain origin metadata including ordering, iconography, and flavor text."
			size="sm"
			on:close={closeOriginForm}
		>
			<form id="origin-editor-form" class="origin-form" onsubmit={submitOriginForm}>
				<label>
					Name
					<input type="text" bind:value={formData.name} required />
				</label>
				<label>
					Position
					<input type="number" min="1" bind:value={formData.position} />
				</label>
				<label>
					Icon Emoji
					<input type="text" bind:value={formData.icon_emoji} placeholder="e.g. 🌊" />
				</label>
		<label>
			Icon PNG (uploads to storage)
			<div class="icon-preview-row">
				{#if formIconPreview}
					<img class="origin-form__icon-image" src={formIconPreview} alt="Origin icon preview" />
				{:else if formData.icon_emoji}
					<span class="origin-form__icon-emoji">{formData.icon_emoji}</span>
				{:else}
					<span class="origin-form__icon-placeholder">No icon yet</span>
				{/if}
			</div>
			<input
				type="file"
				accept="image/*"
						onchange={(event) =>
							handleIconFileChange(
								(editingOrigin as any) ?? { id: formData.id ?? crypto.randomUUID(), ...(formData as any) },
								event
							)}
					/>
			{#if formData.icon_png}
				<small>Current path: {formData.icon_png}</small>
			{/if}
		</label>
				<label>
					Color
					<input type="color" bind:value={formData.color} />
				</label>
				<label>
					Description
					<textarea rows="3" bind:value={formData.description}></textarea>
				</label>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="origin-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeOriginForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.origin-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.65rem;
	}

	.origin-form textarea {
		min-height: 68px;
		resize: vertical;
	}

	.origin-form label:nth-child(n + 5) {
		grid-column: 1 / -1;
	}

	.origin-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.origin-card__identity {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.origin-card__icon {
		font-size: 1.75rem;
	}

	.origin-card__icon-image {
		width: 28px;
		height: 28px;
		object-fit: contain;
		border-radius: 4px;
	}

	.origin-form__icon-image {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: 6px;
		background: rgba(148, 163, 184, 0.12);
		padding: 4px;
	}

	.origin-form__icon-emoji {
		font-size: 2.4rem;
	}

	.origin-form__icon-placeholder {
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.icon-preview-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.35rem 0;
	}

	.origin-card__icon-actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		margin: 0.5rem 0;
	}

	.upload-button {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}

	.upload-button input[type="file"] {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.upload-button span {
		display: inline-block;
		padding: 0.4rem 0.7rem;
		background: rgba(59, 130, 246, 0.3);
		border: 1px solid rgba(59, 130, 246, 0.5);
		border-radius: 6px;
		color: #93c5fd;
		font-size: 0.875rem;
		transition: opacity 0.15s ease;
	}

	.upload-button:hover span {
		background: rgba(59, 130, 246, 0.4);
		border-color: rgba(59, 130, 246, 0.7);
	}

	.origin-card h2 {
		margin: 0;
	}

	.origin-card small {
		display: block;
		color: #a5b4fc;
	}

	.origin-card .muted {
		color: #cbd5f5;
		margin: 0.5rem 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.4);
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
