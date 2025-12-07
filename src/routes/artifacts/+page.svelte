<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type {
		ArtifactRow,
		OriginRow,
		RuneRow,
		GuardianRow,
		ArtifactTagRow
	} from '$lib/types/gameData';
	import ArtifactFilterSidebar from '$lib/components/artifacts/ArtifactFilterSidebar.svelte';
	import ArtifactGrid from '$lib/components/artifacts/ArtifactGrid.svelte';
	import ArtifactEditorDrawer from '$lib/components/artifacts/ArtifactEditorDrawer.svelte';
	import TagManager from '$lib/components/artifacts/TagManager.svelte';
	import ArtifactCardGallery from '$lib/components/artifacts/ArtifactCardGallery.svelte';
	import { generateArtifactCardPNG } from '$lib/utils/artifactCardGenerator';

	// Data
	let artifacts: ArtifactRow[] = [];
	let origins: OriginRow[] = [];
	let runes: RuneRow[] = [];
	let guardians: Pick<GuardianRow, 'id' | 'name'>[] = [];
	let tags: ArtifactTagRow[] = [];

	// UI State
	let isEditorOpen = false;
	let isTagManagerOpen = false;
	let isGalleryOpen = false;
	let editingArtifact: Partial<ArtifactRow> = {};
	let loading = true;
	let generatingAllCards = false;
	let generationProgress = { current: 0, total: 0 };

	// Filters
let search = '';
let tagFilter: string[] = [];
let sortBy: 'name' | 'created' = 'name';
let groupByTags = true;

// Filtered Artifacts
$: filteredArtifacts = artifacts
		.filter((artifact) => {
			// Search
			if (search) {
				const q = search.toLowerCase();
				const matchesName = artifact.name?.toLowerCase().includes(q);
				const matchesBenefit = artifact.benefit?.toLowerCase().includes(q);
				if (!matchesName && !matchesBenefit) {
					return false;
				}
			}

			// Tag Filter
			if (tagFilter.length > 0) {
				const tagSet = new Set(artifact.tag_ids ?? []);
				if (!tagFilter.every((t) => tagSet.has(t))) return false;
			}

			return true;
		})
		.sort((a, b) => {
			if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
			if (sortBy === 'created')
				return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
			return 0;
		});

	// Group artifacts by tags
	$: groupedByTags = (() => {
		if (!groupByTags) return null;
		
		const groups = new Map<string, typeof filteredArtifacts>();
		const noTagsGroup: typeof filteredArtifacts = [];

		filteredArtifacts.forEach((artifact) => {
			if (!artifact.tag_ids || artifact.tag_ids.length === 0) {
				noTagsGroup.push(artifact);
			} else {
				artifact.tag_ids.forEach((tagId) => {
					const tagName = tags.find((t) => t.id === tagId)?.name ?? 'Tag';
					if (!groups.has(tagName)) groups.set(tagName, []);
					groups.get(tagName)!.push(artifact);
				});
			}
		});

		const result: Array<{ tag: string; artifacts: typeof filteredArtifacts }> = [];
		if (noTagsGroup.length > 0) result.push({ tag: 'No Tags', artifacts: noTagsGroup });

		Array.from(groups.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.forEach(([tag, artifacts]) => {
				const uniqueArtifacts = Array.from(new Map(artifacts.map((a) => [a.id, a])).values());
				result.push({ tag, artifacts: uniqueArtifacts });
			});

		return result;
	})();


	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		const [aRes, oRes, rRes, avRes, tRes] = await Promise.all([
			supabase.from('artifacts').select('*'),
			supabase.from('origins').select('*').order('name'),
			supabase.from('runes').select('*'),
			supabase.from('guardians').select('id, name').order('name'),
			supabase.from('artifact_tags').select('*').order('name')
		]);

		if (aRes.data) artifacts = aRes.data;
		if (oRes.data) origins = oRes.data;
		if (rRes.data) runes = rRes.data;
		if (avRes.data) guardians = avRes.data;
		if (tRes.data) tags = tRes.data;
		loading = false;
	}

	function openCreate() {
		editingArtifact = {
			name: '',
			benefit: '',
			tag_ids: [],
			recipe_box: [],
			quantity: 1
		};
		isEditorOpen = true;
	}

	function openEdit(artifact: ArtifactRow) {
		editingArtifact = {
			...JSON.parse(JSON.stringify(artifact)),
			recipe_box: artifact.recipe_box || [],
			quantity: artifact.quantity ?? 1
		};
		isEditorOpen = true;
	}

	async function handleDelete(artifact: ArtifactRow) {
		if (!confirm(`Delete "${artifact.name}"?`)) return;

		const { error } = await supabase.from('artifacts').delete().eq('id', artifact.id);
		if (error) {
			console.error('Error deleting artifact:', error);
			alert('Failed to delete artifact');
		} else {
			artifacts = artifacts.filter((a) => a.id !== artifact.id);
		}
	}

	async function handleSave(event: CustomEvent<Partial<ArtifactRow>>) {
		const toSave = event.detail;
		// Validation?
		if (!toSave.name) return alert('Name is required');

		const payload = {
			name: toSave.name,
			benefit: toSave.benefit,
		guardian_id: toSave.guardian_id,
		tag_ids: toSave.tag_ids ?? [],
			recipe_box: toSave.recipe_box,
			quantity: toSave.quantity ?? 1
		};

		if (toSave.id) {
			// Update
			const { error } = await supabase
				.from('artifacts')
				.update(payload)
				.eq('id', toSave.id);

			if (error) {
				console.error('Error updating:', error);
				alert('Failed to update artifact');
			} else {
				await loadData(); // Reload to get fresh state
				isEditorOpen = false;
			}
		} else {
			// Create
			const { error } = await supabase.from('artifacts').insert([payload]);

			if (error) {
				console.error('Error creating:', error);
				alert('Failed to create artifact');
			} else {
				await loadData();
				isEditorOpen = false;
			}
		}
	}

	async function handleSaveTag(event: CustomEvent<Partial<ArtifactTagRow>>) {
		const tag = event.detail;
		if (tag.id) {
			const { error } = await supabase
				.from('artifact_tags')
				.update({ name: tag.name, color: tag.color })
				.eq('id', tag.id);
			if (error) alert('Failed to update tag');
		} else {
			const { error } = await supabase
				.from('artifact_tags')
				.insert({ name: tag.name, color: tag.color });
			if (error) alert('Failed to create tag');
		}
		await loadData();
	}

	async function handleDeleteTag(event: CustomEvent<ArtifactTagRow>) {
		const tag = event.detail;
		if (!confirm(`Delete tag "${tag.name}"?`)) return;
		const { error } = await supabase.from('artifact_tags').delete().eq('id', tag.id);
		if (error) alert('Failed to delete tag');
		await loadData();
	}

	// Generate PNG cards for all artifacts
	async function generateAllCards() {
		if (!confirm(`Generate card images for all ${artifacts.length} artifacts? This may take a while.`)) {
			return;
		}

		generatingAllCards = true;
		generationProgress = { current: 0, total: artifacts.length };

		const errors: string[] = [];
		const successes: string[] = [];

		for (let i = 0; i < artifacts.length; i++) {
			const artifact = artifacts[i];
			generationProgress.current = i + 1;

			if (!artifact.id || !artifact.name) {
				errors.push(`${artifact.name || 'Unknown'}: Missing ID or name`);
				continue;
			}

			try {
			// Generate PNG directly using Canvas API
			const pngBlob = await generateArtifactCardPNG(artifact, origins, runes, tags, guardians);

				// Convert blob to File
				const fileName = `artifacts/${artifact.id}/card.png`;
				const file = new File([pngBlob], 'card.png', { type: 'image/png' });

				// Upload to Supabase storage
				const { error: uploadError } = await supabase.storage
					.from('game_assets')
					.upload(fileName, file, {
						contentType: 'image/png',
						upsert: true,
					});

				if (uploadError) {
					errors.push(`${artifact.name}: ${uploadError.message}`);
					continue;
				}

				// Update artifact with card_image_path
				const { error: updateError } = await supabase
					.from('artifacts')
					.update({
						card_image_path: fileName,
						updated_at: new Date().toISOString(),
					})
					.eq('id', artifact.id);

				if (updateError) {
					errors.push(`${artifact.name}: ${updateError.message}`);
				} else {
					successes.push(artifact.name);
				}
			} catch (error) {
				errors.push(`${artifact.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}

			// Small delay to prevent browser from freezing
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		generatingAllCards = false;
		generationProgress = { current: 0, total: 0 };

		// Reload data to get updated card_image_path values
		await loadData();

		// Show results
		const message = `Generated ${successes.length} card images successfully.\n${errors.length > 0 ? `\n${errors.length} errors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` : ''}`;
		alert(message);
	}
</script>

<div class="artifacts-dashboard">
	<aside class="sidebar-area">
		<div class="sidebar-header">
			<h2>Artifacts</h2>
			<div class="header-actions">
				<button class="btn-secondary" on:click={() => (isGalleryOpen = true)}>
					View Gallery ({artifacts.filter((a) => a.card_image_path).length})
				</button>
				<button class="btn-secondary" on:click={generateAllCards} disabled={generatingAllCards || artifacts.length === 0}>
					{generatingAllCards ? `Generating... (${generationProgress.current}/${generationProgress.total})` : 'Generate All Cards'}
				</button>
				<button class="btn-primary" on:click={openCreate}>+ New</button>
			</div>
		</div>
		<ArtifactFilterSidebar
			bind:search
			bind:tagFilter
			bind:sortBy
			bind:groupByTags
			{tags}
			on:openTagManager={() => (isTagManagerOpen = true)}
		/>
	</aside>

	<main class="grid-area">
		{#if loading}
			<div class="loading">Loading artifacts...</div>
		{:else}
			<div class="grid-header">
				<span>{filteredArtifacts.length} Artifacts found</span>
			</div>
			<div class="grid-content">
			{#if groupByTags && groupedByTags}
				{#each groupedByTags as { tag, artifacts }}
					<div class="tag-group">
						<div class="tag-group-header">
							<h3>{tag}</h3>
							<span class="tag-group-count">{artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}</span>
						</div>
						<ArtifactGrid
							artifacts={artifacts}
							{origins}
							guardians={guardians}
							{runes}
							{tags}
							on:edit={(e) => openEdit(e.detail)}
							on:delete={(e) => handleDelete(e.detail)}
						/>
					</div>
				{/each}
			{:else}
				<ArtifactGrid
					artifacts={filteredArtifacts}
					{origins}
					guardians={guardians}
					{runes}
					{tags}
					on:edit={(e) => openEdit(e.detail)}
					on:delete={(e) => handleDelete(e.detail)}
				/>
			{/if}
			</div>
		{/if}
	</main>

	<ArtifactEditorDrawer
		bind:isOpen={isEditorOpen}
		artifact={editingArtifact}
		{origins}
		guardians={guardians}
		{runes}
		{tags}
		on:save={handleSave}
		on:close={() => (isEditorOpen = false)}
	/>

	<TagManager
		bind:isOpen={isTagManagerOpen}
		{tags}
		on:save={handleSaveTag}
		on:delete={handleDeleteTag}
		on:close={() => (isTagManagerOpen = false)}
	/>

	<ArtifactCardGallery bind:isOpen={isGalleryOpen} {artifacts} />
</div>


<style>
	/* Break out of the parent container constraints if possible, 
       but since we are inside a padded main, we just fill it. */
	.artifacts-dashboard {
		display: flex;
		height: calc(100vh - 6rem); /* Approximate height minus header/padding */
		gap: 1rem;
		margin: -1rem; /* Negative margin to counteract some parent padding if needed */
		width: calc(100% + 2rem); /* Counteract negative margin to fill width */
	}

	.sidebar-area {
		width: 280px;
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.1);
		overflow: hidden;
		flex-shrink: 0;
	}

	.sidebar-header {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		background: rgba(15, 23, 42, 0.6);
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn-secondary {
		background: #64748b;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #475569;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.grid-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.2);
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.1);
		overflow: hidden;
		min-height: 0;
	}

	.grid-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		color: #94a3b8;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.grid-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: 1rem;
	}

	.loading {
		padding: 2rem;
		text-align: center;
		color: #94a3b8;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	.tag-group {
		margin-bottom: 2rem;
	}

	.tag-group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid rgba(148, 163, 184, 0.2);
	}

	.tag-group-header h3 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
		font-weight: 700;
	}

	.tag-group-count {
		font-size: 0.9rem;
		color: #94a3b8;
	}

	@media (max-width: 768px) {
		.artifacts-dashboard {
			flex-direction: column;
			height: auto;
		}
		.sidebar-area {
			width: 100%;
			height: auto;
		}
	}
</style>
