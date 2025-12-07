<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { OriginRow, RuneRow, ArtifactTagRow, ArtifactRecipeEntry, ArtifactTemplateRow } from '$lib/types/gameData';
	import { artifactService, type ArtifactTemplateConfig, type GeneratedArtifactPreview } from '$lib/services/artifactService';

let origins: OriginRow[] = [];
let runes: RuneRow[] = [];
	let tags: ArtifactTagRow[] = [];
	let templates: ArtifactTemplateRow[] = [];
	let loading = true;
	let error: string | null = null;

	let currentTemplateId: string | null = null;
	let templateName = 'New Template';
	let isActive = false;

	let config: ArtifactTemplateConfig = {
	namePattern: '{origin} Memory',
	benefit: 'Gain {quantity} {origin} runes',
	recipeType: 'origin-runes',
	originRuneQuantity: 2,
	specificRunes: [],
	tagIds: [],
	selectedOriginIds: [],
	quantity: 1
};

	let previewArtifacts: GeneratedArtifactPreview[] = [];

	let saving = false;

	onMount(async () => {
		try {
			await Promise.all([loadOrigins(), loadRunes(), loadTags(), loadTemplates()]);
			// Initialize selected IDs with all available IDs if empty
			if (config.selectedOriginIds?.length === 0) config.selectedOriginIds = origins.map(o => o.id);
						updatePreview();
		} catch (err) {
			console.error('Failed to load data:', err);
			error = err instanceof Error ? err.message : 'Failed to load data';
		} finally {
			loading = false;
		}
	});

	async function loadOrigins() {
		const { data, error: fetchError } = await supabase
			.from('origins')
			.select('*')
			.order('position', { ascending: true });
		if (fetchError) throw fetchError;
		origins = data ?? [];
	}

		async function loadRunes() {
		const { data, error: fetchError } = await supabase
			.from('runes')
			.select('*')
			.order('name', { ascending: true });
		if (fetchError) throw fetchError;
		runes = data ?? [];
	}

	async function loadTags() {
		const { data, error: fetchError } = await supabase
			.from('artifact_tags')
			.select('*')
			.order('name', { ascending: true });
		if (fetchError) {
			if (fetchError.code === '42P01') {
				tags = [];
				return;
			}
			throw fetchError;
		}
		tags = data ?? [];
	}

	async function loadTemplates() {
		const { data, error: fetchError } = await supabase
			.from('artifact_templates')
			.select('*')
			.order('name', { ascending: true });
		if (fetchError) {
			if (fetchError.code === '42P01') {
				templates = [];
				return;
			}
			throw fetchError;
		}
		templates = data ?? [];
	}

	function updatePreview() {
		previewArtifacts = artifactService.generateFromTemplate(config, origins, runes);
	}

	// ... Toggle functions ...
	function toggleOrigin(originId: string) {
		const currentIds = config.selectedOriginIds || [];
		const index = currentIds.indexOf(originId);
		if (index > -1) {
			config.selectedOriginIds = currentIds.filter((id) => id !== originId);
		} else {
			config.selectedOriginIds = [...currentIds, originId];
		}
		updatePreview();
	}

	function toggleAllOrigins() {
		const currentIds = config.selectedOriginIds || [];
		config.selectedOriginIds = currentIds.length === origins.length ? [] : origins.map((o) => o.id);
		updatePreview();
	}

	function toggleTag(tagId: string) {
		const index = config.tagIds.indexOf(tagId);
		if (index > -1) {
			config.tagIds = config.tagIds.filter((t) => t !== tagId);
		} else {
			config.tagIds = [...config.tagIds, tagId];
		}
		updatePreview();
	}

	function addSpecificRune() {
		if (runes.length === 0) {
			alert('No runes available.');
			return;
		}
		config.specificRunes = [...config.specificRunes, { rune_id: runes[0].id, quantity: 1 }];
		updatePreview();
	}

	function updateSpecificRune(index: number, runeId: string) {
		config.specificRunes = config.specificRunes.map((e, i) => (i === index ? { ...e, rune_id: runeId } : e));
		updatePreview();
	}

	function updateSpecificRuneQuantity(index: number, quantity: number) {
		config.specificRunes = config.specificRunes.map((e, i) => (i === index ? { ...e, quantity: Math.max(1, quantity) } : e));
		updatePreview();
	}

	function removeSpecificRune(index: number) {
		config.specificRunes = config.specificRunes.filter((_, i) => i !== index);
		updatePreview();
	}

	async function syncTemplateArtifacts(templateId: string, artifactsToCreate: typeof previewArtifacts) {
		// 1. Delete all artifacts linked to this template
		const { error: deleteError } = await supabase
			.from('artifacts')
			.delete()
			.eq('template_id', templateId);
		
		if (deleteError) {
			console.error('Error clearing template artifacts:', deleteError);
			throw deleteError;
		}

		// 2. If there are artifacts to create, insert them
		if (artifactsToCreate.length > 0) {
			const payload = artifactsToCreate.map(a => ({
				name: a.name,
				benefit: a.benefit,
				guardian_id: null,
				recipe_box: a.recipe_box,
				tag_ids: a.tag_ids ?? [],
				template_id: templateId,
				quantity: config.quantity ?? 1
			}));

			const { error: insertError } = await supabase
				.from('artifacts')
				.insert(payload);
			
			if (insertError) {
				console.error('Error creating template artifacts:', insertError);
				throw insertError;
			}
		}
	}

	async function toggleTemplateActive(template: ArtifactTemplateRow, event: Event) {
		event.stopPropagation();
		const newStatus = !template.is_active;
		
		try {
			// Load template if not already loaded
			if (currentTemplateId !== template.id) {
				await loadTemplate(template);
			}
			
			// Update active status
			isActive = newStatus;
			
			// Save without prompt (silent update)
			const payload = {
				name: templateName,
				config: config as any,
				is_active: newStatus,
				updated_at: new Date().toISOString()
			};

			const { error } = await supabase
				.from('artifact_templates')
				.update(payload)
				.eq('id', template.id);
			if (error) throw error;

			// Sync artifacts based on new active status
			if (newStatus) {
				await syncTemplateArtifacts(template.id, previewArtifacts);
			} else {
				await syncTemplateArtifacts(template.id, []);
			}

			await loadTemplates();
		} catch (err) {
			console.error('Error toggling template:', err);
			alert('Failed to toggle template.');
		}
	}

	async function loadTemplate(template: ArtifactTemplateRow) {
		currentTemplateId = template.id;
		templateName = template.name;
		isActive = template.is_active ?? false;
		
		const loadedConfig = template.config as any;
		config = {
			namePattern: loadedConfig.namePattern ?? '{origin} Memory',
			benefit: loadedConfig.benefit ?? 'Gain {quantity} {origin} runes',
			recipeType: loadedConfig.recipeType ?? 'origin-runes',
			originRuneQuantity: loadedConfig.originRuneQuantity ?? 2,
			specificRunes: Array.isArray(loadedConfig.specificRunes) ? loadedConfig.specificRunes : [],
			tagIds: Array.isArray(loadedConfig.tagIds) ? loadedConfig.tagIds : [],
			selectedOriginIds: Array.isArray(loadedConfig.selectedOriginIds) ? loadedConfig.selectedOriginIds : origins.map(o => o.id),
						quantity: loadedConfig.quantity ?? 1
		};
		
		updatePreview();
	}

	async function deleteTemplate(id: string, event: Event) {
		event.stopPropagation();
		if (!confirm('Delete this template? This will also delete all artifacts generated by it.')) return;
		try {
			await syncTemplateArtifacts(id, []);

			const { error } = await supabase
				.from('artifact_templates')
				.delete()
				.eq('id', id);
			if (error) throw error;
			
			if (currentTemplateId === id) {
				createNewTemplate();
			}
			await loadTemplates();
		} catch (err) {
			console.error('Error deleting template:', err);
			alert('Failed to delete template.');
		}
	}

	function createNewTemplate() {
		currentTemplateId = null;
		templateName = 'New Template';
		isActive = false;
		config = {
			namePattern: '{origin} Memory',
			benefit: 'Gain {quantity} {origin} runes',
			recipeType: 'origin-runes',
			originRuneQuantity: 2,
			specificRunes: [],
			tagIds: [],
			selectedOriginIds: origins.map(o => o.id),
					quantity: 1
		};
		updatePreview();
	}
	
	async function saveTemplateWithIds() {
		const name = prompt('Enter template name:', templateName);
		if (!name) return;

		saving = true;
		try {
			const payload = {
				name,
				config: config as any,
				is_active: isActive,
				updated_at: new Date().toISOString()
			};

			let savedId = currentTemplateId;

			if (currentTemplateId) {
				const { error } = await supabase
					.from('artifact_templates')
					.update(payload)
					.eq('id', currentTemplateId);
				if (error) throw error;
			} else {
				const { data, error } = await supabase
					.from('artifact_templates')
					.insert(payload)
					.select()
					.single();
				if (error) throw error;
				if (data) savedId = data.id;
			}

			currentTemplateId = savedId;
			templateName = name;

			if (savedId) {
				// Sync artifacts based on Active state
				if (isActive) {
					await syncTemplateArtifacts(savedId, previewArtifacts);
				} else {
					await syncTemplateArtifacts(savedId, []);
				}
			}

			await loadTemplates();
		} catch (err) {
			console.error('Error saving template:', err);
			alert('Failed to save template.');
		} finally {
			saving = false;
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Artifact Generator</h1>
			<p>Active templates automatically maintain artifacts in the database.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={createNewTemplate}>New Template</button>
			<button class="btn btn--primary" onclick={saveTemplateWithIds} disabled={saving}>
				{saving ? 'Saving...' : 'Save & Sync'}
			</button>
		</div>
	</header>

	{#if loading}
		<div class="card">Loading...</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="generator-layout">
			<!-- Sidebar: Saved Templates -->
			<aside class="sidebar-panel">
				<h3>Templates</h3>
				{#if templates.length === 0}
					<p class="muted">No templates saved.</p>
				{:else}
					<div class="template-list">
						{#each templates as t}
							<div class="template-item {currentTemplateId === t.id ? 'active' : ''}">
								<button class="template-btn" onclick={() => loadTemplate(t)}>
									<span class="status-dot {t.is_active ? 'on' : 'off'}"></span>
									{t.name}
								</button>
								<!-- Small toggle for quick active/inactive (triggers load & save) -->
								<button 
									class="icon-btn" 
									title={t.is_active ? 'Deactivate' : 'Activate'}
									onclick={(e) => toggleTemplateActive(t, e)}
								>
									{t.is_active ? '⏸️' : '▶️'}
								</button>
								<button class="delete-btn" onclick={(e) => deleteTemplate(t.id, e)} title="Delete">×</button>
							</div>
						{/each}
					</div>
				{/if}
			</aside>

			<!-- Main Area: Config & Preview -->
			<div class="main-panel">
				<!-- Configuration Section -->
				<div class="config-panel">
					<div class="panel-header">
						<h2>{templateName}</h2>
						<label class="active-toggle">
							<input type="checkbox" bind:checked={isActive} />
							<span>Active (Syncs to Database)</span>
						</label>
					</div>
					
					<div class="config-grid">
						<!-- Left Column: Basic Settings -->
						<div class="config-col">
							<label>
								Link Type
								<select bind:value={config.namePattern} onchange={updatePreview}>
									<option value="origin">Origin</option>
									<option value="class">Class</option>
									<option value="avatar">Avatar</option>
									<option value="lost">Lost</option>
								</select>
							</label>

							{#if true}
								<label>
									Name Pattern
									<input
										type="text"
										bind:value={config.namePattern}
										placeholder={"origin" === 'origin' ? "{`{origin}`} Memory" : "{`{class}`} Memory"}
										oninput={updatePreview}
									/>
								</label>

								<label>
									Benefit
									<textarea
										rows="2"
										bind:value={config.benefit}
										placeholder={"origin" === 'origin' ? "Gain {`{quantity}`} {`{origin}`} runes" : "Gain {`{quantity}`} {`{class}`} runes"}
										oninput={updatePreview}
									></textarea>
								</label>
							{/if}
						</div>

						<!-- Right Column: Recipe & Tags -->
						<div class="config-col">
							{#if true}
								<label>
									Recipe Type
									<select bind:value={config.recipeType} onchange={updatePreview}>
										{#if "origin" === 'origin'}
											<option value="origin-runes">Origin Runes</option>
										{/if}
										<option value="specific-runes">Specific Runes</option>
										<option value="custom">Custom (None)</option>
									</select>
								</label>

								{#if config.recipeType === 'origin-runes' && "origin" === 'origin'}
									<label>
										Quantity
										<input
											type="number"
											min="1"
											bind:value={config.originRuneQuantity}
											oninput={updatePreview}
										/>
									</label>
								{:else if config.recipeType === 'specific-runes'}
									<div class="mini-recipe-editor">
										<div class="mini-header">
											<small>Runes</small>
											<button class="btn btn--tiny" onclick={addSpecificRune}>+</button>
										</div>
										{#each config.specificRunes as entry, index (index)}
											<div class="mini-row">
												<select
													value={entry.rune_id}
													onchange={(e) => updateSpecificRune(index, e.currentTarget.value)}
												>
													{#each runes as rune}
														<option value={rune.id}>{rune.name}</option>
													{/each}
												</select>
												<input
													type="number"
													min="1"
													value={entry.quantity}
													oninput={(e) => updateSpecificRuneQuantity(index, Number(e.currentTarget.value))}
												/>
												<button class="delete-btn" onclick={() => removeSpecificRune(index)}>×</button>
											</div>
										{/each}
									</div>
								{/if}

								<label>
									Tags
									<div class="compact-tags">
										{#each tags as tag}
											<button 
												class="compact-tag {config.tagIds.includes(tag.id) ? 'active' : ''}"
												style="--tag-color: {tag.color}"
												onclick={() => toggleTag(tag.id)}
											>
												{tag.name}
											</button>
										{/each}
									</div>
								</label>
							{/if}
							
							<label>
								Quantity
								<input
									type="number"
									min="1"
									bind:value={config.quantity}
									oninput={updatePreview}
								/>
								<small style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
									Number of copies to export per artifact (default: 1)
								</small>
							</label>
						</div>
					</div>

					<!-- Origin/Class Selector (Full Width) -->
					{#if "origin" === 'origin'}
						<div class="origin-bar">
							<div class="origin-bar-header">
								<small>Origins ({config.selectedOriginIds?.length ?? 0})</small>
								<button class="btn btn--tiny" onclick={toggleAllOrigins}>
									{config.selectedOriginIds?.length === origins.length ? 'None' : 'All'}
								</button>
							</div>
							<div class="origin-chips">
								{#each origins as origin}
									<button
										class="origin-chip {config.selectedOriginIds?.includes(origin.id) ? 'active' : ''}"
										onclick={() => toggleOrigin(origin.id)}
									>
										{origin.name}
									</button>
								{/each}
							</div>
						</div>
						{/if}
				</div>

				<!-- Preview Section -->
				<div class="preview-panel">
					<div class="preview-header">
						<h2>Generated Artifacts ({previewArtifacts.length})</h2>
						{#if isActive}
							<span class="status-badge live">● Live Syncing</span>
						{:else}
							<span class="status-badge draft">○ Draft (Not saved to Artifacts)</span>
						{/if}
					</div>

					<div class="preview-grid">
						{#each previewArtifacts as artifact}
							
								<article class="card artifact-preview">
								<div class="preview-top">
									<h3>{artifact.name}</h3>
									<small>{origins.find((o)=> config.selectedOriginIds?.includes(o.id))?.name ?? "Any Origin"}</small>
								</div>
								<p class="benefit">{artifact.benefit}</p>
								<div class="preview-meta">
									{#if artifact.recipe_box.length > 0}
										<div class="mini-recipe">
											{#each artifact.recipe_box as entry}
												{@const rune = runes.find((r) => r.id === entry.rune_id)}
												<span title="{rune?.name}">{entry.quantity}x {rune?.name?.substring(0, 2) ?? '?'}</span>
											{/each}
										</div>
									{/if}
										<div class="mini-tags">
											{#each artifact.tag_ids as tagId}
												{@const tag = tags.find((t) => t.id === tagId)}
												{#if tag}
													<span class="dot" style="background: {tag.color ?? '#666'}" title={tag.name}></span>
												{/if}
											{/each}
										</div>
								</div>
							</article>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.page__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.generator-layout {
		display: grid;
		grid-template-columns: 250px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 1024px) {
		.generator-layout {
			grid-template-columns: 1fr;
		}
	}

	/* Sidebar */
	.sidebar-panel {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
	}

	.sidebar-panel h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #cbd5f5;
	}

	.template-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.template-item {
		display: flex;
		align-items: center;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 6px;
		overflow: hidden;
		transition: background 0.2s;
	}

	.template-item:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.template-item.active {
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.4);
	}

	.template-btn {
		flex: 1;
		border: none;
		background: none;
		color: #f8fafc;
		padding: 0.5rem 0.75rem;
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #475569;
	}
	
	.status-dot.on {
		background: #4ade80;
		box-shadow: 0 0 5px #4ade80;
	}

	.icon-btn {
		border: none;
		background: none;
		color: #cbd5f5;
		padding: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
	}
	
	.icon-btn:hover {
		color: white;
	}

	.delete-btn {
		border: none;
		background: none;
		color: #94a3b8;
		padding: 0.5rem;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
	}

	.delete-btn:hover {
		color: #f87171;
	}

	/* Main Panel */
	.main-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.config-panel {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1.25rem;
	}
	
	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}
	
	.panel-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}
	
	.active-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		color: #cbd5f5;
		font-size: 0.9rem;
		background: rgba(30, 41, 59, 0.5);
		padding: 0.4rem 0.8rem;
		border-radius: 20px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}
	
	.active-toggle input {
		width: auto;
		margin: 0;
	}

	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.config-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: block;
		font-size: 0.85rem;
		color: #94a3b8;
		margin-bottom: 0.25rem;
	}

	input, select, textarea {
		width: 100%;
		padding: 0.5rem;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #f8fafc;
		font-size: 0.9rem;
	}

	/* Compact Tags */
	.compact-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.compact-tag {
		border: 1px solid var(--tag-color);
		color: var(--tag-color);
		background: transparent;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.6;
	}

	.compact-tag.active {
		background: var(--tag-color);
		color: #0f172a;
		opacity: 1;
	}

	/* Mini Recipe Editor */
	.mini-recipe-editor {
		background: rgba(0, 0, 0, 0.2);
		padding: 0.5rem;
		border-radius: 6px;
	}

	.mini-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.mini-row {
		display: grid;
		grid-template-columns: 1fr 50px 20px;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.btn--tiny {
		padding: 1px 6px;
		font-size: 0.7rem;
		background: rgba(148, 163, 184, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: #f8fafc;
		border-radius: 4px;
		cursor: pointer;
	}

	/* Origin Bar */
	.origin-bar {
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		padding-top: 1rem;
	}

	.origin-bar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		color: #94a3b8;
	}

	.origin-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		max-height: 120px;
		overflow-y: auto;
	}

	.origin-chip {
		background: rgba(148, 163, 184, 0.1);
		border: 1px solid transparent;
		color: #cbd5f5;
		padding: 0.25rem 0.6rem;
		border-radius: 99px;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.origin-chip:hover {
		background: rgba(148, 163, 184, 0.2);
	}

	.origin-chip.active {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.5);
		color: #60a5fa;
	}

	/* Preview */
	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.status-badge {
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		border-radius: 12px;
		font-weight: 500;
	}
	
	.status-badge.live {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.3);
	}
	
	.status-badge.draft {
		background: rgba(148, 163, 184, 0.15);
		color: #cbd5f5;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.artifact-preview {
		padding: 0.75rem;
		min-height: 100px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.preview-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.preview-top h3 {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
	}

	.preview-top small {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.benefit {
		margin: 0;
		font-size: 0.85rem;
		color: #cbd5f5;
		flex: 1;
	}

	.preview-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding-top: 0.5rem;
		margin-top: auto;
	}

	.mini-recipe span {
		display: inline-block;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		padding: 1px 4px;
		border-radius: 3px;
		margin-right: 2px;
		color: #a5b4fc;
	}

	.mini-tags {
		display: flex;
		gap: 2px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.muted { color: #64748b; font-size: 0.9rem; text-align: center; padding: 1rem 0; }
</style>
