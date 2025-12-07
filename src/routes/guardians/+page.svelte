<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
import { cropEmptySpace } from '$lib/utils/imageCrop';
	import type { ArtifactRow, GuardianRow, OriginRow } from '$lib/types/gameData';

type Guardian = GuardianRow;
type OriginOption = Pick<OriginRow, 'id' | 'name'>;
type Artifact = Pick<ArtifactRow, 'id' | 'name' | 'benefit' | 'recipe_box' | 'guardian_id'>;

let guardians: Guardian[] = [];
let origins: OriginOption[] = [];
let artifactsByGuardian: Record<string, Artifact[]> = {};
let loading = true;
	let error: string | null = null;

	let search = '';
	let originFilter = 'all';

	let showGuardianForm = false;
	let editingGuardian: Guardian | null = null;
	let guardianForm: { name: string; origin_id: string | null } = {
		name: '',
		origin_id: null
	};

	const gameAssetsStorage = supabase.storage.from('game_assets');
	let uploadingId: string | null = null;
let uploadInput: HTMLInputElement | null = null;
let chibiUploadInput: HTMLInputElement | null = null;
let iconUploadInput: HTMLInputElement | null = null;
let uploadTarget: Guardian | null = null;
let uploadType: 'image_mat' | 'chibi' | 'icon' = 'image_mat';

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50);
	}

	function getImageMatUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		const fullPath = path.startsWith('guardians/') ? path : `guardians/${path}`;
		const { data } = gameAssetsStorage.getPublicUrl(fullPath);
		return data?.publicUrl ?? null;
	}

function getChibiImageUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	const fullPath = path.startsWith('guardians/') ? path : `guardians/${path}`;
	const { data } = gameAssetsStorage.getPublicUrl(fullPath);
	return data?.publicUrl ?? null;
}

function getIconImageUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	const fullPath = path.startsWith('guardians/') ? path : `guardians/${path}`;
	const { data } = gameAssetsStorage.getPublicUrl(fullPath);
	return data?.publicUrl ?? null;
}

async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
	const arrayBuffer = await file.arrayBuffer();
	return await createImageBitmap(new Blob([arrayBuffer]));
}

async function cropAndResizeToSquare(blob: Blob): Promise<{ blob: Blob; ext: string; contentType: string }> {
	const image = await loadImageBitmap(blob);
	const size = 800;
	const side = Math.min(image.width, image.height);
	const sx = (image.width - side) / 2;
	const sy = (image.height - side) / 2;

	const canvas = new OffscreenCanvas(size, size);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas context unavailable');
	ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);

	const outBlob = await canvas.convertToBlob({ type: 'image/png', quality: 0.92 });
	return { blob: outBlob, ext: 'png', contentType: 'image/png' };
}

function promptImageUpload(guardian: Guardian, type: 'image_mat' | 'chibi' | 'icon' = 'image_mat') {
	const input = type === 'chibi' ? chibiUploadInput : type === 'icon' ? iconUploadInput : uploadInput;
	if (!input) return;
	uploadTarget = guardian;
	uploadType = type;
	input.value = '';
	input.click();
}

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !uploadTarget) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			input.value = '';
			uploadTarget = null;
			return;
		}

		if (file.size > 50 * 1024 * 1024) {
			alert('Image must be smaller than 50MB.');
			input.value = '';
			uploadTarget = null;
			return;
		}

		const guardian = uploadTarget;
		const type = uploadType;
		uploadTarget = null;
		uploadingId = guardian.id;

		try {
			// Remove old image if it exists
		const oldPathField =
			type === 'chibi'
				? guardian.chibi_image_path
				: type === 'icon'
					? guardian.icon_image_path
					: guardian.image_mat_path;
			if (oldPathField) {
				const oldPath = oldPathField.startsWith('guardians/')
					? oldPathField
					: `guardians/${oldPathField}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			// For chibi and icon: crop empty space then center-crop & resize to 800x800
			// For image_mat: only crop empty space, preserve aspect ratio
			const croppedBlob = await cropEmptySpace(file);
			
			let finalBlob: Blob;
			let extension: string;
			let contentType: string;
			
			if (type === 'image_mat') {
				// Keep original aspect ratio for image mat
				finalBlob = croppedBlob;
				extension = file.name.split('.').pop()?.toLowerCase() || 'png';
				contentType = file.type || 'image/png';
			} else {
				// Square crop for chibi and icon
				const result = await cropAndResizeToSquare(croppedBlob);
				finalBlob = result.blob;
				extension = result.ext;
				contentType = result.contentType;
			}

			const sanitizedName = sanitizeFileName(guardian.name);
			const fileName =
				type === 'chibi'
					? `guardian_${sanitizedName}_chibi.${extension}`
					: type === 'icon'
						? `guardian_${sanitizedName}_icon.${extension}`
						: `guardian_${sanitizedName}_image_mat.${extension}`;
			const fullPath = `guardians/${guardian.id}/${fileName}`;

			const { error: uploadError } = await gameAssetsStorage.upload(fullPath, finalBlob, {
				cacheControl: '3600',
				upsert: true,
				contentType
			});

			if (uploadError) {
				throw uploadError;
			}

			const updateData: Record<string, any> = {
				updated_at: new Date().toISOString()
			};
			if (type === 'chibi') {
				updateData.chibi_image_path = fullPath;
			} else if (type === 'icon') {
				updateData.icon_image_path = fullPath;
			} else {
				updateData.image_mat_path = fullPath;
			}

			const { error: updateError } = await supabase
				.from('guardians')
				.update(updateData)
				.eq('id', guardian.id);

			if (updateError) {
				throw updateError;
			}

			await loadGuardians();
		} catch (err) {
			console.error('Error uploading image:', err);
			alert('Failed to upload image. Please try again.');
		} finally {
			uploadingId = null;
		}
	}

	async function removeImageMat(guardian: Guardian) {
		if (!guardian.image_mat_path) return;
		if (!confirm(`Remove image mat for "${guardian.name}"?`)) return;

		uploadingId = guardian.id;
		try {
			const path = guardian.image_mat_path.startsWith('guardians/')
				? guardian.image_mat_path
				: `guardians/${guardian.image_mat_path}`;
			await gameAssetsStorage.remove([path]);

			const { error: updateError } = await supabase
				.from('guardians')
				.update({
					image_mat_path: null,
					updated_at: new Date().toISOString()
				})
				.eq('id', guardian.id);

			if (updateError) {
				throw updateError;
			}

			await loadGuardians();
		} catch (err) {
			console.error('Error removing image:', err);
			alert('Failed to remove image. Please try again.');
		} finally {
			uploadingId = null;
		}
	}

async function removeChibiImage(guardian: Guardian) {
	if (!guardian.chibi_image_path) return;
	if (!confirm(`Remove chibi image for "${guardian.name}"?`)) return;

		uploadingId = guardian.id;
		try {
			const path = guardian.chibi_image_path.startsWith('guardians/')
				? guardian.chibi_image_path
				: `guardians/${guardian.chibi_image_path}`;
			await gameAssetsStorage.remove([path]);

			const { error: updateError } = await supabase
				.from('guardians')
				.update({
					chibi_image_path: null,
					updated_at: new Date().toISOString()
				})
				.eq('id', guardian.id);

			if (updateError) {
				throw updateError;
			}

			await loadGuardians();
		} catch (err) {
			console.error('Error removing image:', err);
			alert('Failed to remove image. Please try again.');
		} finally {
			uploadingId = null;
		}
	}

	onMount(async () => {
		await loadOrigins();
		await loadGuardians();
	});

	async function loadOrigins() {
		const { data, error: fetchError } = await supabase
			.from('origins')
			.select('id, name')
			.order('position', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		origins = data ?? [];
	}

	async function loadGuardians() {
		loading = true;
		error = null;
		try {
			const [guardianResult, artifactResult] = await Promise.all([
				supabase.from('guardians').select('*').order('created_at', { ascending: true }),
				supabase
					.from('artifacts')
				.select('id, name, benefit, recipe_box, guardian_id')
				.order('name', { ascending: true })
			]);
			if (guardianResult.error) throw guardianResult.error;
			if (artifactResult.error) throw artifactResult.error;
			guardians = guardianResult.data ?? [];
			const artifactList =
				(artifactResult.data ?? []).map((artifact) => ({
					...artifact,
					recipe_box: Array.isArray(artifact.recipe_box) ? artifact.recipe_box : []
				})) as Artifact[];
			const grouped: Record<string, Artifact[]> = {};
			for (const artifact of artifactList) {
				if (!artifact.guardian_id) continue;
				if (!grouped[artifact.guardian_id]) grouped[artifact.guardian_id] = [];
				grouped[artifact.guardian_id].push(artifact);
			}
			artifactsByGuardian = grouped;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			artifactsByGuardian = {};
		} finally {
			loading = false;
		}
	}

	function openGuardianForm(guardian?: Guardian) {
		if (guardian) {
			editingGuardian = guardian;
			guardianForm = { ...guardian };
		} else {
			editingGuardian = null;
			guardianForm = {
				name: '',
				origin_id: origins[0]?.id ?? null
			};
		}
		showGuardianForm = true;
	}

function closeGuardianForm() {
	showGuardianForm = false;
}

function handleBackdropKey(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	const isInput =
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement;
	if (isInput) return;
	if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		closeGuardianForm();
	}
}

async function removeIconImage(guardian: Guardian) {
	if (!guardian.icon_image_path) return;
	if (!confirm(`Remove icon image for "${guardian.name}"?`)) return;

	uploadingId = guardian.id;
	try {
		const path = guardian.icon_image_path.startsWith('guardians/')
			? guardian.icon_image_path
			: `guardians/${guardian.icon_image_path}`;
		await gameAssetsStorage.remove([path]);

		const { error: updateError } = await supabase
			.from('guardians')
			.update({
				icon_image_path: null,
				updated_at: new Date().toISOString()
			})
			.eq('id', guardian.id);

		if (updateError) {
			throw updateError;
		}

		await loadGuardians();
	} catch (err) {
		console.error('Error removing image:', err);
		alert('Failed to remove image. Please try again.');
	} finally {
		uploadingId = null;
	}
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		closeGuardianForm();
	}
}

async function handleSubmit(event: Event) {
	event.preventDefault();
	await saveGuardian();
}

	async function saveGuardian() {
		if (!guardianForm.name?.trim()) {
			alert('Guardian name is required.');
			return;
		}
		if (!guardianForm.origin_id) {
			alert('Select an origin for the guardian.');
			return;
		}

		const payload = {
			name: guardianForm.name.trim(),
			origin_id: guardianForm.origin_id
		};

		let saveError: string | null = null;
		if (editingGuardian) {
			const { error: updateError } = await supabase
				.from('guardians')
				.update({ ...payload, updated_at: new Date().toISOString() })
				.eq('id', editingGuardian.id);
			saveError = updateError?.message ?? null;
		} else {
			const { error: insertError } = await supabase.from('guardians').insert(payload);
			saveError = insertError?.message ?? null;
		}

		if (saveError) {
			alert(`Failed to save guardian: ${saveError}`);
			return;
		}

		closeGuardianForm();
		await loadGuardians();
	}

	async function deleteGuardian(guardian: Guardian) {
		if (!confirm(`Delete guardian "${guardian.name}"?`)) return;
		const { error: deleteError } = await supabase
			.from('guardians')
			.delete()
			.eq('id', guardian.id);
		if (deleteError) {
			alert(`Failed to delete guardian: ${deleteError.message}`);
			return;
		}
		await loadGuardians();
	}

	const originName = (originId: string) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unknown Origin';
	const artifactsFor = (guardianId: string) => artifactsByGuardian[guardianId] ?? [];
	const recipeSummary = (artifact: Artifact) => {
		const count = artifact.recipe_box?.length ?? 0;
		if (!count) return 'No recipe configured';
		return `${count} rune${count === 1 ? '' : 's'} in recipe`;
	};

	$: filteredGuardians = guardians.filter((guardian) => {
		if (originFilter !== 'all' && guardian.origin_id !== originFilter) return false;
		if (search.trim()) {
			const term = search.trim().toLowerCase();
			return (
				guardian.name.toLowerCase().includes(term) ||
				originName(guardian.origin_id).toLowerCase().includes(term)
			);
		}
		return true;
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Guardians</h1>
			<p>Track the exceptional spirits tied to each origin.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openGuardianForm()}>Create Guardian</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search guardians" bind:value={search} />
		</label>
		<label>
			Origin
			<select bind:value={originFilter}>
				<option value="all">All origins</option>
				{#each origins as origin}
					<option value={origin.id}>{origin.name}</option>
				{/each}
			</select>
		</label>
	</section>

	{#if loading}
		<div class="card">Loading guardians…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredGuardians as guardian (guardian.id)}
				<article class="card guardian-card">
					<header>
						<h2>{guardian.name}</h2>
						<CardActionMenu
							onEdit={() => openGuardianForm(guardian)}
							onDelete={() => deleteGuardian(guardian)}
							onGenerate={null}
						/>
					</header>
					<p class="meta">{originName(guardian.origin_id)}</p>
					<div class="image-mat-section">
						<h3>Image Mat</h3>
						{#if getImageMatUrl(guardian.image_mat_path)}
							<div class="image-mat-preview">
								<img src={getImageMatUrl(guardian.image_mat_path)} alt="{guardian.name} image mat" />
								<button 
									class="btn-remove-image" 
									onclick={() => removeImageMat(guardian)}
									disabled={uploadingId === guardian.id}
									title="Remove image mat"
								>
									{uploadingId === guardian.id ? '...' : '🗑️'}
								</button>
							</div>
						{:else}
							<div class="image-mat-upload">
								<button 
									class="btn-upload-image" 
									onclick={() => promptImageUpload(guardian, 'image_mat')}
									disabled={uploadingId === guardian.id}
								>
									{uploadingId === guardian.id ? 'Uploading...' : '📤 Upload Image Mat'}
								</button>
							</div>
						{/if}
			</div>
			<div class="chibi-image-section">
				<h3>Chibi Image</h3>
				{#if getChibiImageUrl(guardian.chibi_image_path)}
					<div class="image-mat-preview">
						<img src={getChibiImageUrl(guardian.chibi_image_path)} alt="{guardian.name} chibi" />
						<button 
							class="btn-remove-image" 
							onclick={() => removeChibiImage(guardian)}
							disabled={uploadingId === guardian.id}
							title="Remove chibi image"
						>
							{uploadingId === guardian.id ? '...' : '🗑️'}
						</button>
					</div>
				{:else}
					<div class="image-mat-upload">
						<button 
							class="btn-upload-image" 
							onclick={() => promptImageUpload(guardian, 'chibi')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? 'Uploading...' : '📤 Upload Chibi Image'}
						</button>
					</div>
				{/if}
			</div>
			<div class="icon-image-section">
				<h3>Icon Image</h3>
				{#if getIconImageUrl(guardian.icon_image_path)}
					<div class="image-mat-preview">
						<img src={getIconImageUrl(guardian.icon_image_path)} alt="{guardian.name} icon" />
						<button 
							class="btn-remove-image" 
							onclick={() => removeIconImage(guardian)}
							disabled={uploadingId === guardian.id}
							title="Remove icon image"
						>
							{uploadingId === guardian.id ? '...' : '🗑️'}
						</button>
					</div>
				{:else}
					<div class="image-mat-upload">
						<button 
							class="btn-upload-image" 
							onclick={() => promptImageUpload(guardian, 'icon')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? 'Uploading...' : '📤 Upload Icon Image'}
						</button>
					</div>
				{/if}
			</div>
				<div class="artifact-section">
					<h3>Artifacts</h3>
					{#if artifactsFor(guardian.id).length}
						<ul class="artifact-list">
							{#each artifactsFor(guardian.id) as artifact (artifact.id)}
								<li class="artifact-item">
									<div class="artifact-name">{artifact.name}</div>
									{#if artifact.benefit}
										<p class="artifact-benefit">{artifact.benefit}</p>
									{/if}
									<small class="artifact-recipe">{recipeSummary(artifact)}</small>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">No artifacts linked to this guardian.</p>
					{/if}
				</div>
				</article>
				{:else}
				<div class="card empty">No guardians match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showGuardianForm}
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			onclick={handleBackdropClick}
			onkeydown={handleBackdropKey}
		>
			<form
				class="modal"
				onsubmit={handleSubmit}
			>
				<h2>{editingGuardian ? 'Edit Guardian' : 'Create Guardian'}</h2>
				<label>
					Name
					<input type="text" bind:value={guardianForm.name} required />
				</label>
				<label>
					Origin
					<select bind:value={guardianForm.origin_id} required>
						<option value="">Select origin</option>
						{#each origins as origin}
							<option value={origin.id}>{origin.name}</option>
						{/each}
					</select>
				</label>
				<div class="modal__actions">
					<button class="btn" type="submit">Save</button>
					<button class="btn" type="button" onclick={closeGuardianForm}>Cancel</button>
				</div>
			</form>
			</div>
	{/if}

	<input
		type="file"
		accept="image/*"
		bind:this={uploadInput}
		onchange={handleImageUpload}
		style="display: none;"
	/>
	<input
		type="file"
		accept="image/*"
		bind:this={chibiUploadInput}
		onchange={handleImageUpload}
		style="display: none;"
	/>
	<input
		type="file"
		accept="image/*"
		bind:this={iconUploadInput}
		onchange={handleImageUpload}
		style="display: none;"
	/>
</section>

<style>
	.guardian-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.guardian-card h2 {
		margin: 0;
	}

	.guardian-card .meta {
		margin-top: 0.35rem;
		color: #a5b4fc;
		font-weight: 500;
	}

	.artifact-section {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.artifact-section h3 {
		margin: 0;
		font-size: 0.9rem;
		color: #cbd5f5;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.artifact-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.5rem;
	}

	.artifact-item {
		background: rgba(30, 41, 59, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.14);
		border-radius: 10px;
		padding: 0.55rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.artifact-name {
		font-weight: 600;
		color: #f8fafc;
	}

	.artifact-benefit {
		margin: 0;
		color: #cbd5f5;
		font-size: 0.9rem;
		white-space: pre-wrap;
	}

	.artifact-recipe {
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	.image-mat-section,
	.chibi-image-section {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
	}

	.image-mat-section h3,
	.chibi-image-section h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.85rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.image-mat-preview {
		position: relative;
		width: 100%;
		max-width: 300px;
		margin: 0 auto;
	}

	.image-mat-preview img {
		width: 100%;
		height: auto;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.btn-remove-image {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: rgba(239, 68, 68, 0.8);
		border: 1px solid rgba(239, 68, 68, 0.9);
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: #fee2e2;
		transition: all 0.15s ease;
	}

	.btn-remove-image:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.95);
	}

	.btn-remove-image:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.image-mat-upload {
		display: flex;
		justify-content: center;
	}

	.btn-upload-image {
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.4);
		border-radius: 6px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		color: #a5b4fc;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.btn-upload-image:hover:not(:disabled) {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.6);
	}

	.btn-upload-image:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
