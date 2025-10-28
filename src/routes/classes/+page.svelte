<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClassRow } from '$lib/types/gameData';
	import type {
		BackupTrimEffect,
		BenefitEffect,
		DiceEffect,
		Effect,
		EffectBreakpoint,
		FlatStatEffect,
		MultiplierEffect
	} from '$lib/types/effects';
	import html2canvas from 'html2canvas';
	import jsPDF from 'jspdf';
	import { EditorModal } from '$lib';
	import {
		classRowToForm,
		createEffect,
		deleteClassRecord,
		effectTypes,
		emptyClassForm,
		fetchClassRecords,
		formatEffectSummary,
		parseEffectSchema,
		parsePrismaticJson,
		saveClassRecord,
		EMPTY_PRISMATIC,
		type ClassFormData,
		type PrismaticForm
	} from '$lib/features/classes/classes';
	import { fetchDiceRecords } from '$lib/features/dice/dice';

	let classes: ClassRow[] = [];
	let loading = true;
	let error: string | null = null;

	let search = '';

	let showClassForm = false;
	let editingClass: ClassRow | null = null;
	let formData: ClassFormData = emptyClassForm();
	let tagsInput = '';
	let prismaticEnabled = false;
	let prismaticCache: PrismaticForm = { ...EMPTY_PRISMATIC };
	const getPrismatic = parsePrismaticJson;
	let diceOptions: { id: string; name: string }[] = [];
	const diceNameById = new Map<string, string>();
	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom dice';
		return fallback ?? (id ?? 'Custom dice');
	};
	const summarizeEffect = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel);

	function resolveDiceIdsInSchema(schema: EffectBreakpoint[]): EffectBreakpoint[] {
		if (!diceOptions.length) return schema;
		return schema.map((bp) => ({
			...bp,
			effects: bp.effects.map((effect) => {
				if (effect.type !== 'dice') return effect;
				const typed = effect as DiceEffect;
				if (typed.dice_id && diceNameById.has(typed.dice_id)) {
					return { ...typed, dice_name: diceNameById.get(typed.dice_id) ?? typed.dice_name };
				}
				if (typed.dice_name) {
					const match = diceOptions.find(
						(option) => option.name.toLowerCase() === typed.dice_name?.toLowerCase()
					);
					if (match) {
						return { ...typed, dice_id: match.id, dice_name: match.name };
					}
				}
				return typed;
			})
		}));
	}

	onMount(async () => {
		await Promise.all([loadDiceOptions(), loadClasses()]);
	});

	async function loadClasses() {
		try {
			loading = true;
			error = null;
			classes = await fetchClassRecords();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	async function loadDiceOptions() {
		try {
			const records = await fetchDiceRecords();
			diceOptions = records.map(({ id, name }) => ({ id, name }));
			diceNameById.clear();
			diceOptions.forEach((option) => diceNameById.set(option.id, option.name));
			if (showClassForm) {
				formData = {
					...formData,
					effect_schema: resolveDiceIdsInSchema(formData.effect_schema)
				};
			}
		} catch (err) {
			console.error('Failed to load dice options', err);
		}
	}

	function openClassForm(entry?: ClassRow) {
		if (entry) {
			editingClass = entry;
			formData = classRowToForm(entry);
			formData = {
				...formData,
				effect_schema: resolveDiceIdsInSchema(formData.effect_schema)
			};
			prismaticEnabled = Boolean(formData.prismatic);
			prismaticCache = formData.prismatic ? { ...formData.prismatic } : { ...EMPTY_PRISMATIC };
			tagsInput = formData.tags.join(', ');
		} else {
			editingClass = null;
			const nextPosition = (classes.at(-1)?.position ?? classes.length) + 1;
			formData = emptyClassForm(nextPosition);
			prismaticEnabled = false;
			prismaticCache = { ...EMPTY_PRISMATIC };
			tagsInput = '';
		}
		showClassForm = true;
	}

	function closeClassForm() {
		showClassForm = false;
	}

	function handleTagsInput(value: string) {
		tagsInput = value;
		const parsed = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
		formData = { ...formData, tags: parsed };
	}

	function togglePrismatic(enabled: boolean) {
		prismaticEnabled = enabled;
		if (enabled) {
			const next = formData.prismatic ?? prismaticCache ?? { ...EMPTY_PRISMATIC };
			prismaticCache = { ...next };
			formData = { ...formData, prismatic: { ...next } };
		} else {
			prismaticCache = formData.prismatic ? { ...formData.prismatic } : prismaticCache;
			formData = { ...formData, prismatic: null };
		}
	}

	function addBreakpoint() {
		const lastCount = formData.effect_schema.at(-1)?.count ?? 2;
		const nextCount =
			typeof lastCount === 'number'
				? lastCount + 1
				: Number.parseInt(String(lastCount), 10) + 1 || formData.effect_schema.length + 2;
		const nextBreakpoint: EffectBreakpoint = {
			count: nextCount,
			color: undefined,
			description: '',
			effects: [createEffect('dice')]
		};
		formData = {
			...formData,
			effect_schema: [...formData.effect_schema, nextBreakpoint]
		};
	}

	function removeBreakpoint(index: number) {
		const updated = formData.effect_schema.filter((_, idx) => idx !== index);
		formData = { ...formData, effect_schema: updated };
	}

	function updateBreakpointCount(index: number, value: string) {
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, count: value } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function updateBreakpointColor(index: number, color: EffectBreakpoint['color'] | undefined) {
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, color: color || undefined } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function updateBreakpointDescription(index: number, value: string) {
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, description: value } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function addEffectToBreakpoint(index: number, type: Effect['type'] = 'dice') {
		const newEffect = createEffect(type);
		const updated = formData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, effects: [...bp.effects, newEffect] } : bp
		);
		formData = { ...formData, effect_schema: updated };
	}

	function removeEffectFromBreakpoint(index: number, effectIndex: number) {
		const updated = formData.effect_schema.map((bp, idx) => {
			if (idx !== index) return bp;
			return {
				...bp,
				effects: bp.effects.filter((_, effIdx) => effIdx !== effectIndex)
			};
		});
		formData = { ...formData, effect_schema: updated };
	}

	function updateEffectAt(
		breakpointIndex: number,
		effectIndex: number,
		transformer: (effect: Effect) => Effect
	) {
		const updated = formData.effect_schema.map((bp, idx) => {
			if (idx !== breakpointIndex) return bp;
			return {
				...bp,
				effects: bp.effects.map((effect, effIdx) =>
					effIdx === effectIndex ? transformer(effect) : effect
				)
			};
		});
		formData = { ...formData, effect_schema: updated };
	}

	function setEffectType(breakpointIndex: number, effectIndex: number, type: Effect['type']) {
		updateEffectAt(breakpointIndex, effectIndex, () => createEffect(type));
	}

	function updateDiceEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: DiceEffect) => DiceEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'dice' ? updater(effect) : effect
		);
	}

	function updateFlatStatEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: FlatStatEffect) => FlatStatEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'flat_stat' ? updater(effect) : effect
		);
	}

	function updateMultiplierEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: MultiplierEffect) => MultiplierEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'multiplier' ? updater(effect) : effect
		);
	}

	function updateBenefitEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: BenefitEffect) => BenefitEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'benefit'
				? updater(effect)
				: effect
		);
	}

	function updateBackupTrimEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: BackupTrimEffect) => BackupTrimEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'backup_trim' ? updater(effect) : effect
		);
	}

	async function saveClass() {
		if (!formData.name.trim()) {
			alert('Class name is required.');
			return;
		}

		const payload: ClassFormData = {
			...formData,
			tags: [...formData.tags],
			prismatic: prismaticEnabled
				? formData.prismatic ?? { ...prismaticCache }
				: null
		};

		try {
			const saved = await saveClassRecord(payload);
			await loadClasses();
			editingClass = saved;
			closeClassForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save class: ${message}`);
		}
	}

	async function deleteClass(entry: ClassRow) {
		if (!confirm(`Delete class "${entry.name}"? Units referencing it will be orphaned.`)) return;
		try {
			await deleteClassRecord(entry.id);
			await loadClasses();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete class: ${message}`);
		}
	}

	function renderMultiline(value?: string | null): string {
		return (value ?? '').replace(/\r\n/g, '\n').trim();
	}

	function submitClassForm(event: Event) {
		event.preventDefault();
		void saveClass();
	}

	async function exportToPDF() {
	if (!classes.length) {
		alert('No classes to export.');
		return;
	}

	const sorted = [...classes].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
	const chunkSize = 9; // 3 columns × 3 rows per page
	const chunks: ClassRow[][] = [];
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
	tempContainer.style.backgroundColor = '#ffffff';
	tempContainer.style.padding = '0.5in';
	tempContainer.style.colorScheme = 'light';
	tempContainer.style.boxSizing = 'border-box';
	tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
	document.body.appendChild(tempContainer);

	try {
		for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
			const group = chunks[pageIndex];

			tempContainer.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
          <h1 style="margin: 0 0 16px 0; font-size: 22px; color: #1e293b; text-align: center;">
            Arc Spirits Classes
          </h1>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; grid-auto-rows: min-content;">
            ${group
							.map((entry) => {
								const effectSchema = parseEffectSchema(entry.effect_schema);
								const description = renderMultiline(entry.description);
								const footer = renderMultiline(entry.footer);
								const prismatic = getPrismatic(entry.prismatic);
								const tags =
									Array.isArray(entry.tags) && entry.tags.length
										? entry.tags
												.map(
													(tag) =>
														`<span style="display:inline-block; padding:2px 6px; border-radius:999px; background:#e2e8f0; color:#0f172a; font-size:8px; margin-right:4px; margin-bottom:4px;">${tag}</span>`
												)
												.join('')
										: '';

								return `
                  <div style="padding: 10px; border: 3px solid ${entry.color ?? '#8b5cf6'}; background: #ffffff; border-radius: 8px; display: flex; flex-direction: column;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                      <span style="font-size:18px; line-height:1;">${entry.icon ?? '🛡️'}</span>
                      <div>
                        <h3 style="margin:0; font-size:14px; font-weight:700; color:#1e293b; line-height:1.2;">${entry.name}</h3>
                        <small style="font-size:9px; color:#475569;">Position ${entry.position}</small>
                      </div>
                    </div>
                    ${description ? `<p style="margin:4px 0; font-size:9px; color:#475569; line-height:1.3; white-space:pre-line;">${description}</p>` : ''}
                    ${tags ? `<div style="margin:4px 0;">${tags}</div>` : ''}
                    ${
											effectSchema.length
												? effectSchema
														.map(
															(bp) => `
                          <div style="margin:3px 0; font-size:8px; line-height:1.3;">
                            <strong style="color:#0f172a;">${bp.count}:</strong>
                            <span style="color:#64748b;">
                              ${bp.effects.map((effect) => summarizeEffect(effect)).join(', ')}
                            </span>
                          </div>
                        `
														)
														.join('')
												: '<p style="margin:4px 0; font-size:8px; font-style:italic; color:#94a3b8;">No effects configured.</p>'
										}
                    ${
											prismatic
												? `
                      <div style="margin:4px 0; padding:6px; background:linear-gradient(135deg, #ede9fe, #ddd6fe, #c7d2fe); border-radius:4px; font-size:8px; line-height:1.3;">
                        <strong style="color:#7c3aed; font-size:9px;">${prismatic.count || ''} ${prismatic.name}</strong>
                        ${prismatic.description ? `<div style="margin-top:3px; color:#6b21a8;">${prismatic.description}</div>` : ''}
                      </div>
                    `
												: ''
										}
                    ${footer ? `<div style="margin-top:6px; padding-top:4px; border-top:1px solid #e2e8f0; font-size:7px; color:#94a3b8; white-space:pre-line;">${footer}</div>` : ''}
                  </div>
                `;
							})
							.join('')}
          </div>
        </div>
      `;

			const canvas = await html2canvas(tempContainer, {
				scale: 2,
				backgroundColor: '#ffffff'
			});
			const imgData = canvas.toDataURL('image/png');
			if (pageIndex > 0) {
				pdf.addPage();
			}
			pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
		}

		pdf.save('arc-spirits-classes.pdf');
	} catch (err) {
		console.error(err);
		alert('Failed to export classes. Please try again.');
	} finally {
		document.body.removeChild(tempContainer);
	}
}

	$: filteredClasses = classes.filter((entry) => {
		if (!search.trim()) return true;
		const term = search.trim().toLowerCase();
		return (
			entry.name.toLowerCase().includes(term) ||
			(entry.description ?? '').toLowerCase().includes(term) ||
			(entry.footer ?? '').toLowerCase().includes(term)
		);
	});
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Classes</h1>
			<p>Combat archetypes with structured effect breakpoints.</p>
		</div>
		<div class="actions">
			<button class="btn" onclick={exportToPDF}>Export PDF</button>
			<button class="btn" onclick={() => openClassForm()}>Create Class</button>
		</div>
	</header>

	<section class="filters">
		<label>
			Search
			<input type="search" placeholder="Search classes" bind:value={search} />
		</label>
	</section>

	{#if loading}
		<div class="card loading">Loading classes…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		{#if filteredClasses.length === 0}
			<div class="card empty">No classes match the current search.</div>
		{:else}
			<section class="class-grid">
				{#each filteredClasses as entry (entry.id)}
					{@const description = renderMultiline(entry.description)}
					{@const footer = renderMultiline(entry.footer)}
					{@const prismatic = getPrismatic(entry.prismatic)}
					{@const effectSchema = parseEffectSchema(entry.effect_schema)}
					<article class="class-card" style={`border-left-color: ${entry.color ?? '#8b5cf6'}`}>
						<header class="class-card__header">
							<div class="class-card__identity">
								<span class="class-card__icon">{entry.icon ?? '🛡️'}</span>
								<div>
									<h2>{entry.name}</h2>
									<small>Position {entry.position}</small>
								</div>
							</div>
							<div class="class-card__actions">
								<button class="btn" type="button" onclick={() => openClassForm(entry)}>Edit</button>
								<button class="btn danger" type="button" onclick={() => deleteClass(entry)}>
									Delete
								</button>
							</div>
						</header>

						{#if description}
							<p class="class-card__description">{description}</p>
						{:else}
							<p class="class-card__description class-card__description--empty">
								No description provided.
							</p>
						{/if}

						{#if Array.isArray(entry.tags) && entry.tags.length}
							<div class="trait-tag-list">
								{#each entry.tags as tag (tag)}
									<span class="trait-tag">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if effectSchema.length}
							<ul class="breakpoints">
								{#each effectSchema as bp, index (`${entry.id}-bp-${index}`)}
									<li class="breakpoints__item">
										<div class="breakpoints__line">
											<span
												class="breakpoints__count"
												class:bronze={bp.color === 'bronze'}
												class:silver={bp.color === 'silver'}
												class:gold={bp.color === 'gold'}
												class:prismatic={bp.color === 'prismatic'}
											>
												({bp.count})
											</span>
											<div class="breakpoints__effects">
								{#each bp.effects as effect, effectIndex (`${entry.id}-bp-${index}-effect-${effectIndex}`)}
									<span class="effect-tag">{summarizeEffect(effect)}</span>
												{/each}
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="class-card__description class-card__description--empty">
								No effects configured.
							</p>
						{/if}

						{#if prismatic}
							<section class="prismatic">
								<header class="prismatic__header">
									<span class="prismatic__lead">
										{#if prismatic.count}
											<span class="prismatic__count">({prismatic.count})</span>
										{/if}
										<span class="prismatic__title">{prismatic.name || 'Prismatic Bonus'}</span>
									</span>
								</header>
								{#if prismatic.description}
									<p class="prismatic__description">{prismatic.description}</p>
								{/if}
							</section>
						{/if}

						{#if footer}
							<footer class="class-card__footer">{footer}</footer>
						{/if}
					</article>
				{/each}
			</section>
		{/if}
	{/if}

	{#if showClassForm}
		<EditorModal
			title={editingClass ? 'Edit Class' : 'Create Class'}
			description="Update core class info, tags, prismatic bonus, and breakpoint effects."
			size="lg"
			on:close={closeClassForm}
		>
			<form id="class-editor-form" class="class-form" onsubmit={submitClassForm}>
				<section class="class-form__grid">
					<label>
						Name
						<input type="text" bind:value={formData.name} required />
					</label>
					<label>
						Position
						<input type="number" min="1" bind:value={formData.position} />
					</label>
					<label>
						Icon
						<input type="text" bind:value={formData.icon} placeholder="Emoji or icon" />
					</label>
					<label>
						Color
						<input type="color" bind:value={formData.color} />
					</label>
				</section>

				<label class="span-full">
					Description
					<textarea rows="3" bind:value={formData.description}></textarea>
				</label>

				<label class="span-full">
					Footer
					<textarea rows="2" bind:value={formData.footer}></textarea>
				</label>

				<label class="span-full">
					Tags
					<input
						type="text"
						placeholder="comma separated tags"
						bind:value={tagsInput}
						oninput={(event) => handleTagsInput(event.currentTarget.value)}
					/>
				</label>

				<section class="prismatic-editor">
					<header>
						<h3>Prismatic Bonus</h3>
						<label class="switch">
							<input
								type="checkbox"
								checked={prismaticEnabled}
								onchange={(event) => togglePrismatic(event.currentTarget.checked)}
							/>
							<span>Enable</span>
						</label>
					</header>

					{#if prismaticEnabled}
						<div class="prismatic-fields">
							<label>
								Name
								<input
									type="text"
									value={formData.prismatic?.name ?? ''}
									oninput={(event) => {
										const next = formData.prismatic ?? { ...EMPTY_PRISMATIC };
										next.name = event.currentTarget.value;
										prismaticCache = { ...next };
										formData = { ...formData, prismatic: { ...next } };
									}}
								/>
							</label>
							<label>
								Count
								<input
									type="text"
									value={formData.prismatic?.count ?? ''}
									oninput={(event) => {
										const next = formData.prismatic ?? { ...EMPTY_PRISMATIC };
										next.count = event.currentTarget.value;
										prismaticCache = { ...next };
										formData = { ...formData, prismatic: { ...next } };
									}}
								/>
							</label>
							<label class="prismatic-description">
								Description
								<textarea
									rows="3"
									value={formData.prismatic?.description ?? ''}
									oninput={(event) => {
										const next = formData.prismatic ?? { ...EMPTY_PRISMATIC };
										next.description = event.currentTarget.value;
										prismaticCache = { ...next };
										formData = { ...formData, prismatic: { ...next } };
									}}
								></textarea>
							</label>
						</div>
					{:else}
						<p class="prismatic-disabled">Enable to configure prismatic bonuses.</p>
					{/if}
				</section>

				<section class="breakpoint-editor">
					<header class="breakpoint-editor__header">
						<h3>Breakpoints</h3>
						<button class="btn" type="button" onclick={addBreakpoint}>
							Add Breakpoint
						</button>
					</header>

					{#if formData.effect_schema.length === 0}
						<p class="muted">No breakpoints defined yet.</p>
					{:else}
						{#each formData.effect_schema as breakpoint, index (index)}
							<article class="breakpoint-card">
								<header class="breakpoint-card__header">
									<label>
										Count
										<input
											type="text"
											value={breakpoint.count}
											oninput={(event) => updateBreakpointCount(index, event.currentTarget.value)}
										/>
									</label>
									<label>
										Color
										<select
											value={breakpoint.color ?? ''}
											onchange={(event) =>
												updateBreakpointColor(
													index,
													(event.currentTarget.value || undefined) as EffectBreakpoint['color']
												)}
										>
											<option value="">Default</option>
											<option value="bronze">Bronze</option>
											<option value="silver">Silver</option>
											<option value="gold">Gold</option>
											<option value="prismatic">Prismatic</option>
										</select>
									</label>
									<button class="icon-btn danger" type="button" onclick={() => removeBreakpoint(index)}>
										🗑️
									</button>
								</header>

								<label>
									Description
									<textarea
										rows="2"
										value={breakpoint.description ?? ''}
										oninput={(event) => updateBreakpointDescription(index, event.currentTarget.value)}
									></textarea>
								</label>

								<section class="effects">
									<header class="effects__header">
										<h4>Effects</h4>
										<div class="effect-buttons">
											{#each effectTypes as type (type)}
												<button
													type="button"
													class="btn"
													onclick={() => addEffectToBreakpoint(index, type)}
												>
													Add {type.replace('_', ' ')}
												</button>
											{/each}
										</div>
									</header>

									{#if breakpoint.effects.length === 0}
										<p class="muted">No effects yet.</p>
									{:else}
										<ul class="effects__list">
											{#each breakpoint.effects as effect, effectIndex (`${index}-${effectIndex}`)}
												<li class="effect-row">
													<header class="effect-row__header">
														<select
															value={effect.type}
															onchange={(event) =>
																setEffectType(index, effectIndex, event.currentTarget.value as Effect['type'])}
														>
															{#each effectTypes as type (type)}
																<option value={type}>{type.replace('_', ' ')}</option>
															{/each}
														</select>
														<button
															type="button"
															class="icon-btn danger"
															onclick={() => removeEffectFromBreakpoint(index, effectIndex)}
														>
															🗑️
														</button>
													</header>

							{#if effect.type === 'dice'}
								<section class="effect-body effect-body--dice">
									<label>
										Custom Dice
										<select
											value={effect.dice_id ?? ''}
											onchange={(event) =>
												updateDiceEffect(index, effectIndex, (current) => ({
													...current,
													dice_id: event.currentTarget.value ? event.currentTarget.value : null,
													dice_name:
														event.currentTarget.value
															? diceNameById.get(event.currentTarget.value) ?? current.dice_name ?? ''
															: current.dice_name ?? ''
												}))}
										>
											<option value="">Select dice</option>
											{#each diceOptions as option}
												<option value={option.id}>{option.name}</option>
											{/each}
										</select>
									</label>
									{#if !diceOptions.length}
										<p class="muted span-full">Create custom dice to reference them here.</p>
									{/if}
									<label>
										Quantity
										<input
											type="number"
											min="1"
											value={effect.quantity}
											oninput={(event) =>
												updateDiceEffect(index, effectIndex, (current) => ({
													...current,
													quantity: Number(event.currentTarget.value)
												}))}
										/>
									</label>
									{#if !effect.dice_id}
										<label class="span-full">
											Legacy label
											<input
												type="text"
												value={effect.dice_name ?? ''}
												oninput={(event) =>
													updateDiceEffect(index, effectIndex, (current) => ({
														...current,
														dice_name: event.currentTarget.value
													}))}
											/>
										</label>
									{/if}
								</section>
							{:else if effect.type === 'flat_stat'}
														<section class="effect-body">
															<label>
																Stat
																<select
																	value={effect.stat}
																	onchange={(event) =>
																		updateFlatStatEffect(index, effectIndex, (current) => ({
																			...current,
																			stat: event.currentTarget.value as FlatStatEffect['stat']
																		}))}
																>
																	<option value="attack">Attack</option>
																	<option value="defense">Defense</option>
																</select>
															</label>
															<label>
																Value
																<input
																	type="number"
																	value={effect.value}
																	oninput={(event) =>
																		updateFlatStatEffect(index, effectIndex, (current) => ({
																			...current,
																			value: Number(event.currentTarget.value)
																		}))}
																/>
															</label>
															<label>
																Condition
																<input
																	type="text"
																	value={effect.condition ?? ''}
																	oninput={(event) =>
																		updateFlatStatEffect(index, effectIndex, (current) => ({
																			...current,
																			condition: event.currentTarget.value
																		}))}
																/>
															</label>
														</section>
													{:else if effect.type === 'multiplier'}
														<section class="effect-body">
															<label>
																Stat
																<select
																	value={effect.stat}
																	onchange={(event) =>
																		updateMultiplierEffect(index, effectIndex, (current) => ({
																			...current,
																			stat: event.currentTarget.value as MultiplierEffect['stat']
																		}))}
																>
																	<option value="attack">Attack</option>
																	<option value="defense">Defense</option>
																</select>
															</label>
															<label>
																Multiplier
																<input
																	type="number"
																	min="0"
																	step="0.1"
																	value={effect.value}
																	oninput={(event) =>
																		updateMultiplierEffect(index, effectIndex, (current) => ({
																			...current,
																			value: Number(event.currentTarget.value)
																		}))}
																/>
															</label>
														</section>
													{:else if effect.type === 'benefit'}
														<section class="effect-body">
															<label>
																Description
																<textarea
																	rows="2"
																	value={effect.description}
																	oninput={(event) =>
																		updateBenefitEffect(index, effectIndex, (current) => ({
																			...current,
																			description: event.currentTarget.value
																		}))}
																></textarea>
															</label>
															<label>
																Value
																<input
																	type="number"
																	step="0.1"
																	value={effect.value ?? ''}
																	oninput={(event) =>
																		updateBenefitEffect(index, effectIndex, (current) => ({
																			...current,
																			value: event.currentTarget.value
																				? Number(event.currentTarget.value)
																				: undefined
																		}))}
																/>
															</label>
															<label>
																Type
																<input
																	type="text"
																	value={effect.benefit_type ?? ''}
																	oninput={(event) =>
																		updateBenefitEffect(index, effectIndex, (current) => ({
																			...current,
																			benefit_type: event.currentTarget.value || undefined
																		}))}
																/>
															</label>
														</section>
													{:else if effect.type === 'backup_trim'}
														<section class="effect-body">
															<label>
																Remove Dice
																<input
																	type="number"
																	min="0"
																	value={effect.value}
																	oninput={(event) =>
																		updateBackupTrimEffect(index, effectIndex, (current) => ({
																			...current,
																			value: Number(event.currentTarget.value)
																		}))}
																/>
															</label>
														</section>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
								</section>
							</article>
						{/each}
					{/if}
				</section>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="class-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeClassForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}
</section>

<style>
	.class-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.class-form__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.6rem;
	}

	.class-form .span-full {
		grid-column: 1 / -1;
		width: 100%;
	}

	.prismatic-editor {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border: 1px solid rgba(124, 58, 237, 0.35);
		background: rgba(19, 26, 46, 0.82);
		border-radius: 10px;
		padding: 0.65rem;
	}

	.prismatic-editor header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.switch input {
		transform: scale(1.05);
	}

	.prismatic-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.6rem;
	}

	.prismatic-description {
		grid-column: 1 / -1;
	}

	.prismatic-disabled {
		margin: 0;
		color: #9ca3c9;
		font-style: italic;
	}

	.breakpoint-editor {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.breakpoint-editor__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.breakpoint-editor__header h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.breakpoint-editor__header .btn {
		padding: 0.32rem 0.6rem;
		font-size: 0.85rem;
	}

	.breakpoint-card {
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(18, 24, 42, 0.85);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.65rem;
	}

	.breakpoint-card__header {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.5rem;
		align-items: end;
	}

	.effects {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effects__header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.45rem;
	}

	.effects__header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.effect-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.effect-buttons .btn {
		padding: 0.28rem 0.55rem;
		font-size: 0.8rem;
	}

	.effects__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-row {
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		background: rgba(27, 35, 56, 0.82);
		padding: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-row__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.effect-row__header select {
		min-width: 140px;
	}

	.effect-row__header .icon-btn {
		padding: 0.22rem 0.45rem;
	}

	.effect-body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.effect-body--dice {
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}

	.effect-body--dice .span-full {
		grid-column: 1 / -1;
	}

	.class-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
	}

	.class-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border-left: 4px solid rgba(139, 92, 246, 0.6);
		background: rgba(15, 23, 42, 0.7);
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.class-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.class-card__identity {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.class-card__icon {
		font-size: 1.75rem;
	}

	.class-card__actions {
		display: flex;
		gap: 0.4rem;
	}

	.class-card__description {
		margin: 0;
		color: #d1d5f9;
		white-space: pre-wrap;
	}

	.class-card__description--empty {
		color: #94a3b8;
		font-style: italic;
	}

	.class-card__footer {
		margin: 0;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.breakpoints {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
	}

	.breakpoints__item {
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 10px;
		padding: 0.6rem 0.7rem;
	}

	.breakpoints__line {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.breakpoints__count {
		font-weight: 600;
		color: #cbd5f5;
	}

	.breakpoints__count.bronze {
		color: #fbbf24;
	}

	.breakpoints__count.silver {
		color: #cbd5f5;
	}

	.breakpoints__count.gold {
		color: #facc15;
	}

	.breakpoints__count.prismatic {
		background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
		color: #0f172a;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
	}

	.breakpoints__effects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.effect-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.18);
		color: #e0e7ff;
		font-size: 0.75rem;
		letter-spacing: 0.02em;
	}

	.trait-tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.2rem 0 0.4rem;
	}

	.trait-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.18rem 0.45rem;
		border-radius: 999px;
		background: rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
		font-size: 0.72rem;
		letter-spacing: 0.03em;
	}

	.prismatic {
		border-radius: 10px;
		border: 1px solid rgba(129, 140, 248, 0.35);
		background: rgba(30, 41, 59, 0.65);
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.prismatic__header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.prismatic__lead {
		display: inline-flex;
		gap: 0.4rem;
		align-items: baseline;
	}

	.prismatic__count {
		font-weight: 600;
		color: #a855f7;
	}

	.prismatic__title {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		color: #ede9fe;
	}

	.prismatic__description {
		margin: 0;
		color: #d8b4fe;
		white-space: pre-wrap;
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}
</style>
