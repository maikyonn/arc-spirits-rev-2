<script lang="ts">
	import type { IconPoolRow } from '$lib/types/gameData';
	import { supabase } from '$lib/api/supabaseClient';
	import IconCard from './IconCard.svelte';

	interface Props {
		icons: IconPoolRow[];
		publicUrl: (path: string) => string;
		onUpdate: () => void;
		onEditIcon?: (icon: IconPoolRow) => void;
	}

	let { icons, publicUrl, onUpdate, onEditIcon }: Props = $props();

	let saving = $state(false);
	let showPreview = $state(true);

	// Sort icons alphabetically
	const sortedIcons = $derived([...icons].sort((a, b) => a.name.localeCompare(b.name)));

	const selectedIcons = $derived(sortedIcons.filter((icon) => icon.export_as_token));
	const selectedCount = $derived(selectedIcons.length);
	const totalCount = $derived(sortedIcons.length);

	// Generate JSON preview matching the edge function output format
	const jsonPreview = $derived(() => {
		const tokens = selectedIcons.map((icon) => ({
			id: icon.id,
			name: icon.name,
			source_type: icon.source_type,
			image_url: icon.file_path ? `https://[project].supabase.co/storage/v1/render/image/public/game_assets/${icon.file_path}?quality=30` : null
		}));
		return JSON.stringify({ tokens }, null, 2);
	});

	function copyToClipboard() {
		navigator.clipboard.writeText(jsonPreview());
		alert('JSON copied to clipboard!');
	}

	async function toggleToken(icon: IconPoolRow) {
		saving = true;
		try {
			const newValue = !icon.export_as_token;
			const { error } = await supabase
				.from('icon_pool')
				.update({ export_as_token: newValue })
				.eq('id', icon.id);

			if (error) throw error;
			icon.export_as_token = newValue;
			onUpdate();
		} catch (err) {
			console.error('Failed to toggle token:', err);
			alert('Failed to update token status');
		} finally {
			saving = false;
		}
	}

	async function selectAll() {
		saving = true;
		try {
			const iconIds = icons.map((i) => i.id);
			if (iconIds.length > 0) {
				const { error } = await supabase
					.from('icon_pool')
					.update({ export_as_token: true })
					.in('id', iconIds);

				if (error) throw error;
				icons.forEach((i) => (i.export_as_token = true));
			}
			onUpdate();
		} catch (err) {
			console.error('Failed to select all:', err);
			alert('Failed to select all tokens');
		} finally {
			saving = false;
		}
	}

	async function deselectAll() {
		saving = true;
		try {
			const iconIds = icons.map((i) => i.id);
			if (iconIds.length > 0) {
				const { error } = await supabase
					.from('icon_pool')
					.update({ export_as_token: false })
					.in('id', iconIds);

				if (error) throw error;
				icons.forEach((i) => (i.export_as_token = false));
			}
			onUpdate();
		} catch (err) {
			console.error('Failed to deselect all:', err);
			alert('Failed to deselect all tokens');
		} finally {
			saving = false;
		}
	}

	function handleCardClick(icon: IconPoolRow) {
		if (onEditIcon) {
			onEditIcon(icon);
		} else {
			toggleToken(icon);
		}
	}
</script>

<div class="token-export-view">
	<div class="toolbar">
		<div class="info">
			<span class="count">{selectedCount} / {totalCount} icons selected for export</span>
		</div>
		<div class="actions">
			<button class="btn btn-sm" onclick={selectAll} disabled={saving}>Select All</button>
			<button class="btn btn-sm" onclick={deselectAll} disabled={saving}>Deselect All</button>
			<button class="btn btn-sm" class:active={showPreview} onclick={() => (showPreview = !showPreview)}>
				{showPreview ? 'Hide' : 'Show'} JSON
			</button>
		</div>
	</div>

	<div class="main-content" class:with-preview={showPreview}>
		<section class="grid-view">
			{#each sortedIcons as icon (icon.id)}
				<IconCard
					name={icon.name}
					imageUrl={publicUrl(icon.file_path)}
					badge={icon.source_type}
					selected={icon.export_as_token ?? false}
					showCheckbox={true}
					checked={icon.export_as_token ?? false}
					clickable={true}
					onClick={() => handleCardClick(icon)}
					onCheckChange={() => toggleToken(icon)}
				/>
			{:else}
				<div class="empty">No icons available.</div>
			{/each}
		</section>

		{#if showPreview}
			<aside class="json-preview-panel">
				<div class="panel-header">
					<h3>JSON Export Preview</h3>
					<button class="btn btn-sm" onclick={copyToClipboard}>Copy</button>
				</div>
				<pre class="json-content">{jsonPreview()}</pre>
			</aside>
		{/if}
	</div>
</div>

<style>
	.token-export-view {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
	}

	.toolbar .info .count {
		font-size: 0.75rem;
		color: #cbd5e1;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.35rem 0.6rem;
		font-size: 0.7rem;
		background: rgba(148, 163, 184, 0.15);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: #f1f5f9;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:hover:not(:disabled) {
		background: rgba(148, 163, 184, 0.25);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.active {
		background: rgba(74, 222, 128, 0.2);
		border-color: rgba(74, 222, 128, 0.4);
		color: #4ade80;
	}

	.main-content {
		display: flex;
		gap: 0.75rem;
	}

	.main-content.with-preview .grid-view {
		flex: 1;
		min-width: 0;
	}

	.grid-view {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		flex: 1;
	}

	.json-preview-panel {
		width: 350px;
		min-width: 300px;
		max-width: 400px;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 300px);
		position: sticky;
		top: 1rem;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		flex-shrink: 0;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 0.75rem;
		color: #f1f5f9;
		font-weight: 600;
	}

	.json-content {
		flex: 1;
		overflow: auto;
		margin: 0;
		padding: 0.75rem;
		font-size: 0.65rem;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: #a5b4fc;
		white-space: pre;
		line-height: 1.5;
		background: transparent;
	}

	@media (max-width: 900px) {
		.main-content {
			flex-direction: column;
		}

		.json-preview-panel {
			width: 100%;
			max-width: none;
			min-width: 0;
			max-height: 300px;
			position: static;
		}
	}

	.empty {
		grid-column: 1 / -1;
		padding: 1.5rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}
</style>
