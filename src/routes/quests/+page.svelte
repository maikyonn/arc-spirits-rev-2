<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { QuestRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import html2canvas from 'html2canvas';
	import jsPDF from 'jspdf';

	type Quest = QuestRow;

	let quests: Quest[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';

	let showQuestForm = false;
	let editingQuest: Quest | null = null;
	let questForm: Partial<Quest> = {
		name: '',
		description: '',
		victory_points: 0
	};

	onMount(async () => {
		await loadQuests();
	});

	async function loadQuests() {
		loading = true;
		error = null;
		const { data, error: fetchError } = await supabase
			.from('quests')
			.select('*')
			.order('created_at', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			loading = false;
			return;
		}
		quests = data ?? [];
		loading = false;
	}

	function openQuestForm(quest?: Quest) {
		if (quest) {
			editingQuest = quest;
			questForm = {
				name: quest.name,
				description: quest.description,
				victory_points: quest.victory_points
			};
		} else {
			editingQuest = null;
			questForm = {
				name: '',
				description: '',
				victory_points: 0
			};
		}
		showQuestForm = true;
	}

	function closeQuestForm() {
		showQuestForm = false;
	}

	async function saveQuest() {
		const trimmedName = questForm.name?.trim() ?? '';
		if (!trimmedName) {
			alert('Quest name is required.');
			return;
		}

		const payload = {
			name: trimmedName,
			description: questForm.description?.trim() ?? '',
			victory_points: Number(questForm.victory_points) || 0
		};

		let saveError: string | null = null;
		if (editingQuest) {
			const { error: updateError } = await supabase
				.from('quests')
				.update({ ...payload, updated_at: new Date().toISOString() })
				.eq('id', editingQuest.id);
			saveError = updateError?.message ?? null;
		} else {
			const { error: insertError } = await supabase.from('quests').insert(payload);
			saveError = insertError?.message ?? null;
		}

		if (saveError) {
			alert(`Failed to save quest: ${saveError}`);
			return;
		}

		closeQuestForm();
		await loadQuests();
	}

	async function deleteQuest(quest: Quest) {
		if (!confirm(`Delete quest "${quest.name}"?`)) return;
		const { error: deleteError } = await supabase.from('quests').delete().eq('id', quest.id);
		if (deleteError) {
			alert(`Failed to delete quest: ${deleteError.message}`);
			return;
		}
		await loadQuests();
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		saveQuest();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeQuestForm();
		}
	}

	function handleBackdropKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeQuestForm();
		}
	}

	$: filteredQuests = quests.filter((quest) => {
		if (!search.trim()) return true;
		const searchLower = search.toLowerCase();
		return (
			quest.name.toLowerCase().includes(searchLower) ||
			quest.description.toLowerCase().includes(searchLower)
		);
	});

	async function exportToPDF() {
		if (!filteredQuests.length) {
			alert('No quests to export.');
			return;
		}

		// Sort by victory points (highest first), then by name
		const sorted = [...filteredQuests].sort((a, b) => {
			if (a.victory_points !== b.victory_points) {
				return b.victory_points - a.victory_points;
			}
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		const chunkSize = 6; // 2 columns × 3 rows per page
		const chunks: Quest[][] = [];
		for (let i = 0; i < sorted.length; i += chunkSize) {
			chunks.push(sorted.slice(i, i + chunkSize));
		}

		const pdf = new jsPDF({
			orientation: 'portrait',
			unit: 'in',
			format: 'letter'
		});

		const tempContainer = document.createElement('div');
		tempContainer.style.position = 'absolute';
		tempContainer.style.left = '-9999px';
		tempContainer.style.width = '8.5in';
		tempContainer.style.height = '11in';
		tempContainer.style.backgroundColor = '#0f172a';
		tempContainer.style.padding = '1.5in';
		tempContainer.style.colorScheme = 'dark';
		tempContainer.style.boxSizing = 'border-box';
		tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
		document.body.appendChild(tempContainer);

		try {
			for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
				const group = chunks[pageIndex];

				// Generate HTML for quest cards
				const questCardsHtml = group.map((quest) => {
					return `
						<div style="padding: 12px; background: rgba(15, 23, 42, 0.65); border-radius: 8px; display: flex; flex-direction: column; height: 100%;">
							<header style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem;">
								<div>
									<h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #f8fafc; line-height: 1.2;">${quest.name}</h2>
									<small style="display: block; color: #a5b4fc; font-weight: 600; font-size: 14px; margin-top: 4px;">Victory Points: ${quest.victory_points}</small>
								</div>
							</header>
							<div style="flex: 1; margin-top: 0.5rem;">
								<p style="margin: 0; color: #cbd5f5; white-space: pre-wrap; font-size: 14px; line-height: 1.4;">${quest.description || 'No description.'}</p>
							</div>
						</div>
					`;
				});

				tempContainer.innerHTML = `
					<div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #0f172a;">
						<div style="display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, 1fr); gap: 12px; flex: 1;">
							${questCardsHtml.join('')}
						</div>
					</div>
				`;

				// Calculate optimal card height
				// Page height: 11in = 1056px (at 96 DPI), padding: 1.5in top + 1.5in bottom = 288px
				// Available height: 1056px - 288px = 768px
				// Grid gaps: 2 gaps × 12px = 24px
				// Available for cards: 768px - 24px = 744px
				// Height per card: 744px / 3 rows = 248px
				const optimalCardHeight = '248px';
				
				// Apply fixed height to all cards
				const gridContainer = tempContainer.querySelector('div[style*="grid-template-columns"]');
				if (gridContainer) {
					const cards = gridContainer.children;
					Array.from(cards).forEach((card) => {
						if (card instanceof HTMLElement) {
							card.style.height = optimalCardHeight;
							card.style.minHeight = optimalCardHeight;
							card.style.maxHeight = optimalCardHeight;
						}
					});
				}

				// Small delay to ensure layout is stable
				await new Promise((resolve) => setTimeout(resolve, 100));

				const canvas = await html2canvas(tempContainer, {
					scale: 2,
					backgroundColor: '#0f172a',
					useCORS: true,
					allowTaint: true
				});
				const imgData = canvas.toDataURL('image/png');
				if (pageIndex > 0) {
					pdf.addPage();
				}
				pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
			}

			pdf.save('arc-spirits-quests.pdf');
		} catch (err) {
			console.error(err);
			alert('Failed to export quests. Please try again.');
		} finally {
			document.body.removeChild(tempContainer);
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Quests</h1>
			<p>Manage hidden quests and their victory point values</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={exportToPDF}>Export PDF</button>
			<button class="btn" onclick={() => openQuestForm()}>➕ Add Quest</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="text" bind:value={search} placeholder="Search quests..." />
		</label>
	</section>

	{#if loading}
		<div class="card">Loading quests…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="card-grid">
			{#each filteredQuests as quest (quest.id)}
				<article class="card quest-card">
					<header>
						<div>
							<h2>{quest.name}</h2>
							<small>Victory Points: {quest.victory_points}</small>
						</div>
					<CardActionMenu
							onEdit={() => openQuestForm(quest)}
							onDelete={() => deleteQuest(quest)}
							onGenerate={null}
						/>
					</header>
					<div class="quest-card__body">
						<p class="description">{quest.description || 'No description.'}</p>
					</div>
				</article>
			{:else}
				<div class="card empty">No quests match the current filters.</div>
			{/each}
		</section>
	{/if}

	{#if showQuestForm}
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			onclick={handleBackdropClick}
			onkeydown={handleBackdropKey}
		>
			<form class="modal" onsubmit={handleSubmit}>
				<h2>{editingQuest ? 'Edit Quest' : 'Create Quest'}</h2>
				<label>
					Name
					<input type="text" bind:value={questForm.name} required />
				</label>
				<label>
					Description
					<textarea bind:value={questForm.description} rows="4"></textarea>
				</label>
				<label>
					Victory Points
					<input
						type="number"
						bind:value={questForm.victory_points}
						min="0"
						step="1"
						required
					/>
				</label>
				<div class="modal-footer-actions">
					<button type="button" class="btn" onclick={closeQuestForm}>Cancel</button>
					<button type="submit" class="btn btn--primary">
						{editingQuest ? 'Update Quest' : 'Create Quest'}
					</button>
				</div>
			</form>
		</div>
	{/if}
</section>

<style>
	.quest-card {
		display: flex;
		flex-direction: column;
		min-height: 120px;
	}

	.quest-card header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.quest-card h2 {
		margin: 0;
	}

	.quest-card small {
		display: block;
		color: #a5b4fc;
		font-weight: 600;
	}

	.quest-card__body {
		flex: 1;
		margin-top: 0.5rem;
	}

	.description {
		margin: 0;
		color: #cbd5f5;
		white-space: pre-wrap;
	}
</style>
