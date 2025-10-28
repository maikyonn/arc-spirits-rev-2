<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ClassRow } from '$lib/types/gameData';
	import { parseEffectSchema } from '$lib/features/classes/classes';
	import { fetchDiceRecords } from '$lib/features/dice/dice';
	import { simulateClassBreakpoints, type BreakpointSimulationResult } from '$lib/features/classes/simulation';
	import type { CustomDiceWithSides } from '$lib/features/dice/dice';
	import Chart from 'chart.js/auto';
	import type { ChartDataset } from 'chart.js';
	Chart.defaults.color = '#e2e8f0';
	Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.15)';
	Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

	const TARGET_CLASSES = ['Swordsman', 'Archer', 'Sorcerer'];

	let loading = true;
	let error: string | null = null;
	let classes: ClassRow[] = [];
let diceRecords: CustomDiceWithSides[] = [];
	let classStats = new Map<string, BreakpointSimulationResult[]>();

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(async () => {
		await loadData();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [{ data: classData, error: classError }, diceData] = await Promise.all([
				supabase
					.from('classes')
					.select('*')
					.in('name', TARGET_CLASSES)
					.order('position', { ascending: true }),
				fetchDiceRecords()
			]);

			if (classError) throw classError;
			classes = (classData ?? []).filter((entry) => TARGET_CLASSES.includes(entry.name));
			diceRecords = diceData;
			computeStats();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	$: if (!loading && !error && chartCanvas && classStats.size > 0) {
		renderChart();
	}

	function computeStats() {
		const stats = new Map<string, BreakpointSimulationResult[]>();
		classes.forEach((entry) => {
			const breakpoints = parseEffectSchema(entry.effect_schema);
			const results = simulateClassBreakpoints(breakpoints, diceRecords, 1000).sort((a, b) => {
				if (a.numericCount === null && b.numericCount === null) return 0;
				if (a.numericCount === null) return 1;
				if (b.numericCount === null) return -1;
				return (a.numericCount as number) - (b.numericCount as number);
			});
			stats.set(entry.id, results);
		});
		classStats = stats;
	}

	function renderChart() {
		if (!chartCanvas) {
			console.warn('Chart canvas not available');
			return;
		}
		if (chart) chart.destroy();

		const colors = ['#ef4444', '#3b82f6', '#f97316'];
		const datasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];

		classes.forEach((entry, index) => {
			const stats = classStats.get(entry.id) ?? [];
			const numericStats = stats
				.filter((stat) => stat.numericCount !== null)
				.map((stat) => ({ ...stat, numericCount: Number(stat.numericCount) }));
			console.debug(`${entry.name}: ${numericStats.length} data points`, numericStats);
			if (!numericStats.length) return;

			datasets.push({
				label: entry.name,
				data: numericStats.map((stat) => ({ x: Number(stat.numericCount), y: stat.mean })),
				borderColor: colors[index % colors.length],
				backgroundColor: colors[index % colors.length] + '33',
				borderWidth: 2,
				tension: 0.25,
				fill: false,
				parsing: false,
				pointRadius: 3,
				pointBackgroundColor: colors[index % colors.length]
			});
		});

		if (datasets.length === 0) {
			console.warn('No chart datasets available - no data to display');
			chart = null;
			return;
		}

		const context = chartCanvas.getContext('2d');
		if (!context) {
			console.error('Failed to get 2D context from canvas');
			return;
		}
		console.debug('Rendering class analysis chart with', datasets.length, 'datasets');
		chart = new Chart(context, {
			type: 'line',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'linear',
						title: { display: true, text: 'Breakpoint Count' },
						ticks: { stepSize: 1, color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' }
					},
					y: {
						title: { display: true, text: 'Average Attack (EV)' },
						beginAtZero: true,
						ticks: { color: '#e2e8f0' },
						grid: { color: 'rgba(148, 163, 184, 0.15)' }
					}
				},
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#f1f5f9' }
					},
					title: {
						display: true,
						text: 'Class Damage Simulation (1000 trials)',
						color: '#f8fafc'
					}
				}
			}
		});
	}

	function formatNumber(value: number): string {
		return value.toFixed(2);
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Class Analysis</h1>
			<p>Monte Carlo damage simulation for core classes across breakpoint counts.</p>
		</div>
	</header>

	{#if loading}
		<div class="card loading">Simulating class damage…</div>
	{:else if error}
		<div class="card error">{error}</div>
	{:else}
		<section class="card chart-card">
			<canvas bind:this={chartCanvas}></canvas>
		</section>

		<section class="card-grid stats-grid">
			{#each classes as entry (entry.id)}
				{@const stats = classStats.get(entry.id) ?? []}
				<article class="card stats-card">
					<h2>{entry.name}</h2>
					{#if stats.length === 0}
						<p class="muted">No breakpoint data available.</p>
					{:else}
						<table>
							<thead>
								<tr>
									<th>Count</th>
									<th>Mean</th>
									<th>SD</th>
								</tr>
							</thead>
							<tbody>
								{#each stats as stat, index}
									<tr>
										<td>{stat.countLabel || (stat.numericCount ?? index + 1)}</td>
										<td>{formatNumber(stat.mean)}</td>
										<td>{formatNumber(stat.sd)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</article>
			{/each}
		</section>
	{/if}
</section>

<style>
	.chart-card {
		height: 420px;
		padding: 1rem;
	}

	.chart-card canvas {
		width: 100%;
		height: 100%;
	}

	.stats-grid {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.stats-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.stats-card h2 {
		margin: 0;
	}

	.stats-card table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.stats-card th,
	.stats-card td {
		text-align: left;
		padding: 0.35rem 0;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.stats-card th {
		font-weight: 600;
		color: #cbd5f5;
	}

	.stats-card td {
		color: #e2e8f0;
	}
</style>
