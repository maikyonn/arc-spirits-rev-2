<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ClassRow, HexSpiritRow, OriginRow } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
	import {
		deleteHexSpiritRecord,
		emptyHexSpiritForm,
		fetchHexSpiritRecords,
		hexSpiritRowToForm,
		saveHexSpiritRecord,
		type HexSpiritFormData
	} from '$lib/features/hex-spirits/hexSpirits';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchClassRecords } from '$lib/features/classes/classes';

	type HexSpirit = HexSpiritRow & { image_url: string | null };
	type OriginOption = Pick<OriginRow, 'id' | 'name'>;
	type ClassOption = Pick<ClassRow, 'id' | 'name'>;

	let spirits: HexSpirit[] = [];
	let origins: OriginOption[] = [];
	let classes: ClassOption[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';
	let originFilter = 'all';
	let classFilter = 'all';

let showSpiritForm = false;
let editingSpirit: HexSpirit | null = null;
let formData: HexSpiritFormData = emptyHexSpiritForm();

	let uploadingId: string | null = null;
	let removingId: string | null = null;

	const storage = supabase.storage.from('hex_spirit_images');

	onMount(async () => {
		await Promise.all([loadOrigins(), loadClasses()]);
		await loadSpirits();
	});

	function getPublicImage(path: string | null): string | null {
		if (!path) return null;
		const { data } = storage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

async function loadOrigins() {
	try {
		const records = await fetchOriginRecords();
	origins = records.map(({ id, name }) => ({ id, name }));
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	}
}

async function loadClasses() {
	try {
		const records = await fetchClassRecords();
		classes = records.map(({ id, name }) => ({ id, name }));
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	}
}

async function loadSpirits() {
	loading = true;
	error = null;
	try {
		const data = await fetchHexSpiritRecords();
		spirits = data.map((spirit) => ({
			...spirit,
			image_url: getPublicImage(spirit.image_path)
		}));
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		loading = false;
	}
}

function openSpiritForm(spirit?: HexSpirit) {
	if (spirit) {
		editingSpirit = spirit;
		formData = hexSpiritRowToForm(spirit);
	} else {
		editingSpirit = null;
		const defaults = emptyHexSpiritForm();
		defaults.origin_id = origins[0]?.id ?? null;
		defaults.class_id = classes[0]?.id ?? null;
		formData = defaults;
	}
	showSpiritForm = true;
}

function closeSpiritForm() {
	showSpiritForm = false;
}

function submitSpiritForm(event: Event) {
	event.preventDefault();
	void saveSpirit();
}

async function saveSpirit() {
	if (!formData.name.trim()) {
		alert('Spirit name is required.');
		return;
	}
	if (!formData.origin_id) {
		alert('Select an origin for the spirit.');
		return;
	}

	try {
		const payload: HexSpiritFormData = {
			...formData,
			origin_id: formData.origin_id,
			class_id: formData.class_id ?? null,
			image_path: formData.image_path ?? null
		};
		if (editingSpirit) {
			payload.id = editingSpirit.id;
		}
		await saveHexSpiritRecord(payload);
		await loadSpirits();
		closeSpiritForm();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to save spirit: ${message}`);
	}
}

async function deleteSpirit(spirit: HexSpirit) {
	if (!confirm(`Delete hex spirit "${spirit.name}"?`)) return;
	try {
		await deleteHexSpiritRecord(spirit.id);
		await loadSpirits();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to delete spirit: ${message}`);
	}
}

	const originName = (originId: string | null) =>
		origins.find((origin) => origin.id === originId)?.name ?? 'Unassigned';

	const className = (classId: string | null) =>
		classes.find((cls) => cls.id === classId)?.name ?? 'None';

	async function handleImageUpload(spirit: HexSpirit, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			alert('Image must be smaller than 10MB.');
			return;
		}

		uploadingId = spirit.id;
		try {
			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const fileName = `${Date.now()}.${extension}`;
			const path = `${spirit.id}/${fileName}`;

			const { error: uploadError } = await storage.upload(path, file, {
				cacheControl: '3600',
				upsert: true,
				contentType: file.type
			});
			if (uploadError) {
				throw uploadError;
			}

			const { error: updateError } = await supabase
				.from('hex_spirits')
				.update({ image_path: path, updated_at: new Date().toISOString() })
				.eq('id', spirit.id);
			if (updateError) {
				throw updateError;
			}

			await loadSpirits();
		} catch (err) {
			console.error(err);
			alert('Failed to upload image. Please try again.');
		} finally {
			uploadingId = null;
		}
	}

	async function removeImage(spirit: HexSpirit) {
		if (!spirit.image_path) return;
		removingId = spirit.id;
		try {
			await storage.remove([spirit.image_path]);
			const { error: updateError } = await supabase
				.from('hex_spirits')
				.update({ image_path: null, updated_at: new Date().toISOString() })
				.eq('id', spirit.id);
			if (updateError) {
				throw updateError;
			}
			await loadSpirits();
		} catch (err) {
			console.error(err);
			alert('Failed to remove image.');
		} finally {
			removingId = null;
		}
	}

	function handleFileChange(spirit: HexSpirit, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) {
			handleImageUpload(spirit, file);
		}
	}

	$: filteredSpirits = spirits.filter((spirit) => {
		if (originFilter !== 'all' && spirit.origin_id !== originFilter) return false;
		if (classFilter !== 'all' && spirit.class_id !== classFilter) return false;
		if (search.trim()) {
			const term = search.trim().toLowerCase();
			if (
				!spirit.name.toLowerCase().includes(term) &&
				!originName(spirit.origin_id).toLowerCase().includes(term) &&
				!className(spirit.class_id).toLowerCase().includes(term)
			) {
				return false;
			}
		}
		return true;
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Hex Spirits</h1>
			<p>Manage the roster of spirits, their classes, origins, and imagery.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={() => openSpiritForm()}>Create Hex Spirit</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search spirits" bind:value={search} />
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
		<label>
			Class
			<select bind:value={classFilter}>
				<option value="all">All classes</option>
				{#each classes as cls}
					<option value={cls.id}>{cls.name}</option>
				{/each}
			</select>
		</label>
	</section>

	{#if loading}
		<div class="card">Loading hex spirits…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredSpirits as spirit (spirit.id)}
				<article class="card spirit-card">
					<header>
						<div>
							<h2>{spirit.name}</h2>
							<small>
								Origin: {originName(spirit.origin_id)} • Class: {className(spirit.class_id)} • Cost:
								{spirit.cost}
							</small>
						</div>
						<div class="card-actions">
							<button class="btn" type="button" onclick={() => openSpiritForm(spirit)}>Edit</button>
							<button class="btn danger" type="button" onclick={() => deleteSpirit(spirit)}>Delete</button>
						</div>
					</header>
					<div class="spirit-card__body">
						{#if spirit.image_url}
							<img class="spirit-card__image" src={spirit.image_url} alt={`Image of ${spirit.name}`} />
						{:else}
							<div class="spirit-card__placeholder">No Image</div>
						{/if}
						<div class="spirit-card__actions">
							<label class="upload-button">
								<input
									type="file"
									accept="image/*"
									onchange={(event) => handleFileChange(spirit, event)}
									aria-label={`Upload image for ${spirit.name}`}
								/>
								<span>{uploadingId === spirit.id ? 'Uploading…' : 'Upload Image'}</span>
							</label>
							<button
								class="btn danger"
								type="button"
								onclick={() => removeImage(spirit)}
								disabled={removingId === spirit.id || !spirit.image_path}
							>
								{removingId === spirit.id ? 'Removing…' : 'Remove Image'}
							</button>
						</div>
					</div>
				</article>
			{:else}
				<div class="card empty">No hex spirits match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showSpiritForm}
		<EditorModal
			title={editingSpirit ? 'Edit Hex Spirit' : 'Create Hex Spirit'}
			description="Manage core stats and metadata before uploading imagery."
			size="md"
			on:close={closeSpiritForm}
		>
			<form id="hex-spirit-editor-form" class="spirit-form" onsubmit={submitSpiritForm}>
				<label>
					Name
					<input type="text" bind:value={formData.name} required />
				</label>
				<label>
					Cost
					<input type="number" min="0" bind:value={formData.cost} />
				</label>
				<label>
					Origin
					<select bind:value={formData.origin_id} required>
						<option value="">Select origin</option>
						{#each origins as origin}
							<option value={origin.id}>{origin.name}</option>
						{/each}
					</select>
				</label>
				<label>
					Class
					<select bind:value={formData.class_id}>
						<option value="">No class</option>
						{#each classes as cls}
							<option value={cls.id}>{cls.name}</option>
						{/each}
					</select>
				</label>
				<label class="span-full">
					Image storage path (optional)
					<input
						type="text"
						bind:value={formData.image_path}
						placeholder="hex_spirit_images/.../image.png"
					/>
				</label>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="hex-spirit-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeSpiritForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.spirit-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.65rem;
	}

	.spirit-form .span-full {
		grid-column: 1 / -1;
	}

	.spirit-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.spirit-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.spirit-card h2 {
		margin: 0;
	}

	.spirit-card small {
		display: block;
		color: #a5b4fc;
		margin-top: 0.15rem;
	}

	.spirit-card__body {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 0.75rem;
		align-items: center;
	}

	.spirit-card__image {
		width: 120px;
		height: 120px;
		object-fit: cover;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
	}

	.spirit-card__placeholder {
		width: 120px;
		height: 120px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		border: 1px dashed rgba(148, 163, 184, 0.35);
		color: #94a3b8;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.spirit-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.upload-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.upload-button input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.upload-button span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.7);
		color: inherit;
		min-width: 120px;
	}

	.card-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
