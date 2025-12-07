<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { OriginRow, ClassRow, RuneRow } from '$lib/types/gameData';
	import { generateRuneIcon } from '$lib/utils/runeIconGenerator';
import CardActionMenu from '$lib/components/CardActionMenu.svelte';

	type Rune = RuneRow & { iconUrl?: string };
	type OriginOption = OriginRow;
	type ClassOption = ClassRow;

	let runes: Rune[] = [];
	let origins: OriginOption[] = [];
	let classes: ClassOption[] = [];
	let loading = true;
	let error: string | null = null;
	const gameAssetsStorage = supabase.storage.from('game_assets');

	let search = '';
	let originFilter = 'all';
	let classFilter = 'all';
	let runeBackgroundUrl: string | null = null;
	let classRuneBackgroundUrl: string | null = null;
	let uploadingBackground = false;
	let uploadingClassBackground = false;
	let generatingRuneIcons = false;
	let generationProgress = { current: 0, total: 0 };

	let showRuneForm = false;
let editingRune: Rune | null = null;
let runeForm: Partial<Rune> & { runeType: 'origin' | 'class' } = {
	name: '',
	origin_id: null,
	class_id: null,
	runeType: 'origin'
};

	onMount(async () => {
		await Promise.all([loadOrigins(), loadClasses(), loadRuneBackground(), loadClassRuneBackground()]);
		await loadRunes();
	});

	function getOriginIconUrl(iconPng: string | null | undefined): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('origin_icons/') ? iconPng : `origin_icons/${iconPng}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

	async function loadOrigins() {
		const { data, error: fetchError } = await supabase
			.from('origins')
			.select('*')
			.order('position', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		origins = data ?? [];
	}

	async function loadClasses() {
		const { data, error: fetchError } = await supabase
			.from('classes')
			.select('*')
			.order('position', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		classes = data ?? [];
	}

	function getClassIconUrl(iconPng: string | null | undefined): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('class_icons/') ? iconPng : `class_icons/${iconPng}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

	async function loadRuneBackground() {
		try {
			// Try to load the background image from storage
			const { data } = gameAssetsStorage.getPublicUrl('rune_backgrounds/background.png');
			if (data?.publicUrl) {
				// Verify the file exists by checking if we can fetch it
				const response = await fetch(data.publicUrl, { method: 'HEAD' });
				if (response.ok) {
					runeBackgroundUrl = data.publicUrl;
				}
			}
		} catch (err) {
			console.warn('Failed to load rune background:', err);
		}
	}

	async function loadClassRuneBackground() {
		try {
			const { data } = gameAssetsStorage.getPublicUrl('rune_backgrounds/class_background.png');
			if (data?.publicUrl) {
				const response = await fetch(data.publicUrl, { method: 'HEAD' });
				if (response.ok) {
					classRuneBackgroundUrl = data.publicUrl;
				}
			}
		} catch (err) {
			console.warn('Failed to load class rune background:', err);
		}
	}

	async function handleBackgroundUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be smaller than 5MB.');
			return;
		}

		uploadingBackground = true;
		try {
			// Remove old background if it exists
			try {
				await gameAssetsStorage.remove(['rune_backgrounds/background.png']);
			} catch (err) {
				// Ignore if file doesn't exist
			}

			// Upload new background
			const { error: uploadError } = await gameAssetsStorage.upload(
				'rune_backgrounds/background.png',
				file,
				{
					cacheControl: '3600',
					upsert: true,
					contentType: file.type
				}
			);

			if (uploadError) {
				throw uploadError;
			}

			// Reload background URL
			await loadRuneBackground();
			// Regenerate all rune icons
			await loadRunes();
		} catch (err) {
			console.error(err);
			alert('Failed to upload background. Please try again.');
		} finally {
			uploadingBackground = false;
			// Reset input
			input.value = '';
		}
	}

	async function removeBackground() {
		if (!confirm('Remove the origin rune background? Runes will use the default hexagon shape.')) {
			return;
		}

		try {
			const { error } = await gameAssetsStorage.remove(['rune_backgrounds/background.png']);
			if (error) throw error;
			runeBackgroundUrl = null;
			await loadRunes();
		} catch (err) {
			console.error(err);
			alert('Failed to remove background. Please try again.');
		}
	}

	async function handleClassBackgroundUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be smaller than 5MB.');
			return;
		}

		uploadingClassBackground = true;
		try {
			try {
				await gameAssetsStorage.remove(['rune_backgrounds/class_background.png']);
			} catch (err) {
				// Ignore if file doesn't exist
			}

			const { error: uploadError } = await gameAssetsStorage.upload(
				'rune_backgrounds/class_background.png',
				file,
				{
					cacheControl: '3600',
					upsert: true,
					contentType: file.type
				}
			);

			if (uploadError) {
				throw uploadError;
			}

			await loadClassRuneBackground();
			await loadRunes();
		} catch (err) {
			console.error(err);
			alert('Failed to upload class background. Please try again.');
		} finally {
			uploadingClassBackground = false;
			input.value = '';
		}
	}

	async function removeClassBackground() {
		if (!confirm('Remove the class rune background? Class runes will use the default hexagon shape.')) {
			return;
		}

		try {
			const { error } = await gameAssetsStorage.remove(['rune_backgrounds/class_background.png']);
			if (error) throw error;
			classRuneBackgroundUrl = null;
			await loadRunes();
		} catch (err) {
			console.error(err);
			alert('Failed to remove class background. Please try again.');
		}
	}

	async function loadRunes() {
		loading = true;
		error = null;
		const { data, error: fetchError } = await supabase
			.from('runes')
			.select('*')
			.order('created_at', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			loading = false;
			return;
		}

		// Generate icon URLs for each rune based on its origin or class
		const runesWithIcons = await Promise.all(
			(data ?? []).map(async (rune) => {
				// If rune has a saved icon_path, use that
				if (rune.icon_path) {
					const { data: urlData } = gameAssetsStorage.getPublicUrl(rune.icon_path);
					if (urlData?.publicUrl) {
						return { ...rune, iconUrl: urlData.publicUrl };
					}
				}

				// Otherwise, generate icon dynamically based on origin or class
				let iconUrl: string | null = null;
				let iconEmoji: string | null = null;

				if (rune.origin_id) {
					const origin = origins.find((o) => o.id === rune.origin_id);
					if (origin) {
						iconUrl = getOriginIconUrl(origin.icon_png);
						iconEmoji = iconUrl ? null : (origin.icon_emoji || null);
					}
				} else if (rune.class_id) {
					const cls = classes.find((c) => c.id === rune.class_id);
					if (cls) {
						iconUrl = getClassIconUrl(cls.icon_png);
						iconEmoji = iconUrl ? null : (cls.icon_emoji || null);
					}
				}

				if (!iconUrl && !iconEmoji) {
					return { ...rune, iconUrl: undefined };
				}

				// Use appropriate background based on rune type
				const bgUrl = rune.class_id ? classRuneBackgroundUrl : runeBackgroundUrl;

				try {
					const generatedIconUrl = await generateRuneIcon({
						originIconUrl: iconUrl,
						originIconEmoji: iconEmoji,
						backgroundUrl: bgUrl,
						size: 800
					});
					return { ...rune, iconUrl: generatedIconUrl };
				} catch (err) {
					console.warn(`Failed to generate icon for rune ${rune.name}:`, err);
					return { ...rune, iconUrl: undefined };
				}
			})
		);

		runes = runesWithIcons;
		loading = false;
	}

	function openRuneForm(rune?: Rune) {
		if (rune) {
			editingRune = rune;
			runeForm = {
				...rune,
				runeType: rune.class_id ? 'class' : 'origin'
			};
		} else {
			editingRune = null;
			runeForm = {
				name: '',
				origin_id: origins[0]?.id ?? null,
				class_id: null,
				runeType: 'origin'
			};
		}
		showRuneForm = true;
	}

function closeRuneForm() {
	showRuneForm = false;
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
		closeRuneForm();
	}
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		closeRuneForm();
	}
}

async function handleSubmit(event: Event) {
	event.preventDefault();
	await saveRune();
}

	async function saveRune() {
		if (!runeForm.name?.trim()) {
			alert('Rune name is required.');
			return;
		}
		if (runeForm.runeType === 'origin' && !runeForm.origin_id) {
			alert('Select an origin for the rune.');
			return;
		}
		if (runeForm.runeType === 'class' && !runeForm.class_id) {
			alert('Select a class for the rune.');
			return;
		}

		const payload = {
			name: runeForm.name.trim(),
			origin_id: runeForm.runeType === 'origin' ? runeForm.origin_id : null,
			class_id: runeForm.runeType === 'class' ? runeForm.class_id : null
		};

		let saveError: string | null = null;
		if (editingRune) {
			const { error: updateError } = await supabase
				.from('runes')
				.update({ ...payload, updated_at: new Date().toISOString() })
				.eq('id', editingRune.id);
			saveError = updateError?.message ?? null;
		} else {
			const { error: insertError } = await supabase.from('runes').insert(payload);
			saveError = insertError?.message ?? null;
		}

		if (saveError) {
			alert(`Failed to save rune: ${saveError}`);
			return;
		}

		closeRuneForm();
		await loadRunes();
	}

	async function deleteRune(rune: Rune) {
		if (!confirm(`Delete rune "${rune.name}"? Artifacts referencing it will break.`)) return;
		const { error: deleteError } = await supabase.from('runes').delete().eq('id', rune.id);
		if (deleteError) {
			alert(`Failed to delete rune: ${deleteError.message}`);
			return;
		}
		await loadRunes();
	}

	// Generate and save PNG for a single rune
	async function generateRunePNG(rune: Rune) {
		if (!rune.id || !rune.name) {
			alert('Rune missing ID or name');
			return;
		}

		let iconUrl: string | null = null;
		let iconEmoji: string | null = null;

		if (rune.origin_id) {
			const origin = origins.find((o) => o.id === rune.origin_id);
			if (origin) {
				iconUrl = getOriginIconUrl(origin.icon_png);
				iconEmoji = iconUrl ? null : (origin.icon_emoji || null);
			}
		} else if (rune.class_id) {
			const cls = classes.find((c) => c.id === rune.class_id);
			if (cls) {
				iconUrl = getClassIconUrl(cls.icon_png);
				iconEmoji = iconUrl ? null : (cls.icon_emoji || null);
			}
		}

		if (!iconUrl && !iconEmoji) {
			alert('Rune must have an origin or class to generate icon');
			return;
		}

		// Use appropriate background based on rune type
		const bgUrl = rune.class_id ? classRuneBackgroundUrl : runeBackgroundUrl;

		try {
			// Generate rune icon as PNG data URL
			const iconDataUrl = await generateRuneIcon({
				originIconUrl: iconUrl,
				originIconEmoji: iconEmoji,
				backgroundUrl: bgUrl,
				size: 800
			});

			// Convert data URL to blob
			const response = await fetch(iconDataUrl);
			const blob = await response.blob();

			// Convert blob to File
			const fileName = `runes/${rune.id}/icon.png`;
			const file = new File([blob], 'icon.png', { type: 'image/png' });

			// Upload to Supabase storage
			const { error: uploadError } = await gameAssetsStorage.upload(fileName, file, {
				contentType: 'image/png',
				upsert: true,
			});

			if (uploadError) {
				throw new Error(`Failed to upload icon: ${uploadError.message}`);
			}

			// Update rune with icon_path
			const { error: updateError } = await supabase
				.from('runes')
				.update({
					icon_path: fileName,
					updated_at: new Date().toISOString(),
				})
				.eq('id', rune.id);

			if (updateError) {
				throw new Error(`Failed to update rune: ${updateError.message}`);
			}

			alert('Rune icon generated successfully!');
			await loadRunes();
		} catch (error) {
			console.error('Error generating rune icon:', error);
			alert(`Failed to generate icon: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// Generate PNGs for all runes
	async function generateAllRunePNGs() {
		if (!confirm(`Generate icon images for all ${runes.length} runes? This may take a while.`)) {
			return;
		}

		generatingRuneIcons = true;
		generationProgress = { current: 0, total: runes.length };

		const errors: string[] = [];
		const successes: string[] = [];

		for (let i = 0; i < runes.length; i++) {
			const rune = runes[i];
			generationProgress.current = i + 1;

			if (!rune.id || !rune.name) {
				errors.push(`${rune.name || 'Unknown'}: Missing ID or name`);
				continue;
			}

			let iconUrl: string | null = null;
			let iconEmoji: string | null = null;

			if (rune.origin_id) {
				const origin = origins.find((o) => o.id === rune.origin_id);
				if (origin) {
					iconUrl = getOriginIconUrl(origin.icon_png);
					iconEmoji = iconUrl ? null : (origin.icon_emoji || null);
				}
			} else if (rune.class_id) {
				const cls = classes.find((c) => c.id === rune.class_id);
				if (cls) {
					iconUrl = getClassIconUrl(cls.icon_png);
					iconEmoji = iconUrl ? null : (cls.icon_emoji || null);
				}
			}

			if (!iconUrl && !iconEmoji) {
				errors.push(`${rune.name}: Missing origin or class`);
				continue;
			}

			// Use appropriate background based on rune type
			const bgUrl = rune.class_id ? classRuneBackgroundUrl : runeBackgroundUrl;

			try {
				// Generate rune icon as PNG data URL
				const iconDataUrl = await generateRuneIcon({
					originIconUrl: iconUrl,
					originIconEmoji: iconEmoji,
					backgroundUrl: bgUrl,
					size: 800
				});

				// Convert data URL to blob
				const response = await fetch(iconDataUrl);
				const blob = await response.blob();

				// Convert blob to File
				const fileName = `runes/${rune.id}/icon.png`;
				const file = new File([blob], 'icon.png', { type: 'image/png' });

				// Upload to Supabase storage
				const { error: uploadError } = await gameAssetsStorage.upload(fileName, file, {
					contentType: 'image/png',
					upsert: true,
				});

				if (uploadError) {
					errors.push(`${rune.name}: ${uploadError.message}`);
					continue;
				}

				// Update rune with icon_path
				const { error: updateError } = await supabase
					.from('runes')
					.update({
						icon_path: fileName,
						updated_at: new Date().toISOString(),
					})
					.eq('id', rune.id);

				if (updateError) {
					errors.push(`${rune.name}: ${updateError.message}`);
				} else {
					successes.push(rune.name);
				}
			} catch (error) {
				errors.push(`${rune.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}

			// Small delay to prevent browser from freezing
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		generatingRuneIcons = false;
		generationProgress = { current: 0, total: 0 };

		// Reload data to get updated icon_path values
		await loadRunes();

		// Show results
		const message = `Generated ${successes.length} rune icons successfully.\n${errors.length > 0 ? `\n${errors.length} errors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` : ''}`;
		alert(message);
	}

	const originName = (originId: string | null) =>
		origins.find((o) => o.id === originId)?.name ?? null;

	const className = (classId: string | null) =>
		classes.find((c) => c.id === classId)?.name ?? null;

	const getRuneCategory = (rune: Rune): string => {
		if (rune.origin_id) return originName(rune.origin_id) ?? 'Unknown Origin';
		if (rune.class_id) return className(rune.class_id) ?? 'Unknown Class';
		return 'Unassigned';
	};

	const getRuneCategoryType = (rune: Rune): 'origin' | 'class' | 'unassigned' => {
		if (rune.origin_id) return 'origin';
		if (rune.class_id) return 'class';
		return 'unassigned';
	};

	$: filteredRunes = runes.filter((rune) => {
		// Origin filter
		if (originFilter !== 'all' && rune.origin_id !== originFilter) {
			if (originFilter !== 'all') return false;
		}
		// Class filter
		if (classFilter !== 'all' && rune.class_id !== classFilter) {
			if (classFilter !== 'all') return false;
		}
		// If both filters are set, show runes matching either
		if (originFilter !== 'all' && classFilter !== 'all') {
			if (rune.origin_id !== originFilter && rune.class_id !== classFilter) return false;
		} else if (originFilter !== 'all') {
			if (rune.origin_id !== originFilter) return false;
		} else if (classFilter !== 'all') {
			if (rune.class_id !== classFilter) return false;
		}

		if (search.trim()) {
			const term = search.trim().toLowerCase();
			const category = getRuneCategory(rune).toLowerCase();
			if (
				!rune.name.toLowerCase().includes(term) &&
				!category.includes(term)
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
			<h1>Runes</h1>
			<p>Runes are the crafting components consumed by artifacts.</p>
		</div>
		<div class="actions">
			<button class="btn btn--secondary" onclick={generateAllRunePNGs} disabled={generatingRuneIcons || runes.length === 0}>
				{generatingRuneIcons ? `Generating... (${generationProgress.current}/${generationProgress.total})` : 'Generate All Icons'}
			</button>
			<button class="btn" onclick={() => openRuneForm()}>Create Rune</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search runes" bind:value={search} />
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

	<section class="rune-background-section">
		<div class="rune-backgrounds-grid">
			<!-- Origin Rune Background -->
			<div class="rune-background-card">
				<div class="rune-background-header">
					<h3>Origin Rune Background</h3>
					<p>Background for origin-based runes.</p>
				</div>
				<div class="rune-background-controls">
					{#if runeBackgroundUrl}
						<div class="rune-background-preview">
							<img src={runeBackgroundUrl} alt="Origin rune background" />
							<button class="btn btn--small" onclick={removeBackground} disabled={uploadingBackground}>
								Remove
							</button>
						</div>
					{/if}
					<label class="btn btn--small">
						{uploadingBackground ? 'Uploading...' : runeBackgroundUrl ? 'Replace' : 'Upload'}
						<input
							type="file"
							accept="image/*"
							onchange={handleBackgroundUpload}
							disabled={uploadingBackground}
							style="display: none;"
						/>
					</label>
				</div>
			</div>

			<!-- Class Rune Background -->
			<div class="rune-background-card">
				<div class="rune-background-header">
					<h3>Class Rune Background</h3>
					<p>Background for class-based runes.</p>
				</div>
				<div class="rune-background-controls">
					{#if classRuneBackgroundUrl}
						<div class="rune-background-preview">
							<img src={classRuneBackgroundUrl} alt="Class rune background" />
							<button class="btn btn--small" onclick={removeClassBackground} disabled={uploadingClassBackground}>
								Remove
							</button>
						</div>
					{/if}
					<label class="btn btn--small">
						{uploadingClassBackground ? 'Uploading...' : classRuneBackgroundUrl ? 'Replace' : 'Upload'}
						<input
							type="file"
							accept="image/*"
							onchange={handleClassBackgroundUpload}
							disabled={uploadingClassBackground}
							style="display: none;"
						/>
					</label>
				</div>
			</div>
		</div>
	</section>

	{#if loading}
		<div class="card">Loading runes…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredRunes as rune (rune.id)}
				<article class="card rune-card">
					<header>
						<div class="rune-card__identity">
							{#if rune.iconUrl}
								<img class="rune-card__icon" src={rune.iconUrl} alt={`${rune.name} icon`} />
							{/if}
							<h2>{rune.name}</h2>
						</div>
					<CardActionMenu
							onEdit={() => openRuneForm(rune)}
							onDelete={() => deleteRune(rune)}
							onGenerate={null}
						/>
						<button
							class="btn btn--small btn--icon-only"
							onclick={() => generateRunePNG(rune)}
							title="Generate PNG Icon"
							style="margin-top: 0.5rem;"
						>
							📷
						</button>
					</header>
					<p class="meta">
						<span class="category-type {getRuneCategoryType(rune)}">{getRuneCategoryType(rune) === 'origin' ? 'Origin' : getRuneCategoryType(rune) === 'class' ? 'Class' : ''}</span>
						{getRuneCategory(rune)}
					</p>
				</article>
			{:else}
				<div class="card empty">No runes match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showRuneForm}
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			onclick={handleBackdropClick}
			onkeydown={handleBackdropKey}
		>
			<form class="modal" onsubmit={handleSubmit}>
				<h2>{editingRune ? 'Edit Rune' : 'Create Rune'}</h2>
				<label>
					Name
					<input type="text" bind:value={runeForm.name} required />
				</label>
				<fieldset class="rune-type-fieldset">
					<legend>Rune Type</legend>
					<div class="rune-type-options">
						<label class="rune-type-option">
							<input type="radio" bind:group={runeForm.runeType} value="origin" />
							Origin
						</label>
						<label class="rune-type-option">
							<input type="radio" bind:group={runeForm.runeType} value="class" />
							Class
						</label>
					</div>
				</fieldset>
				{#if runeForm.runeType === 'origin'}
					<label>
						Origin
						<select bind:value={runeForm.origin_id} required>
							<option value="">Select an origin</option>
							{#each origins as origin}
								<option value={origin.id}>{origin.name}</option>
							{/each}
						</select>
					</label>
				{:else}
					<label>
						Class
						<select bind:value={runeForm.class_id} required>
							<option value="">Select a class</option>
							{#each classes as cls}
								<option value={cls.id}>{cls.name}</option>
							{/each}
						</select>
					</label>
				{/if}
				<div class="modal__actions">
					<button class="btn" type="submit">Save</button>
					<button class="btn" type="button" onclick={closeRuneForm}>Cancel</button>
				</div>
			</form>
		</div>
	{/if}
</section>

<style>
	.rune-card header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.rune-card__identity {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.rune-card__icon {
		width: 32px;
		height: 32px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.rune-card h2 {
		margin: 0;
	}

	.rune-card .meta {
		margin: 0.4rem 0;
		color: #a5b4fc;
		font-weight: 500;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	.rune-background-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.rune-backgrounds-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.rune-background-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 8px;
		padding: 1rem;
	}

	.rune-background-header h3 {
		margin: 0 0 0.35rem 0;
		color: #f8fafc;
		font-size: 1rem;
	}

	.rune-background-header p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.rune-background-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.rune-background-preview {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
	}

	.rune-background-preview img {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: 4px;
	}

	.btn--small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn--secondary {
		background: rgba(100, 116, 139, 0.2);
		border-color: rgba(100, 116, 139, 0.3);
	}

	.btn--secondary:hover:not(:disabled) {
		background: rgba(100, 116, 139, 0.3);
	}

	.btn--icon-only {
		padding: 0.25rem 0.5rem;
		font-size: 1rem;
		line-height: 1;
	}

	.category-type {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		margin-right: 0.4rem;
	}

	.category-type.origin {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.category-type.class {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.rune-type-fieldset {
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		margin: 0.5rem 0;
	}

	.rune-type-fieldset legend {
		padding: 0 0.5rem;
		font-weight: 500;
		color: #e2e8f0;
	}

	.rune-type-options {
		display: flex;
		gap: 1.5rem;
	}

	.rune-type-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.rune-type-option input[type="radio"] {
		margin: 0;
	}
</style>
