<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { ChartOptions } from 'chart.js';

  type StageChartDataset = {
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    hoverBackgroundColor?: string | string[];
    borderColor?: string | string[];
  };

  export let labels: string[] = [];
  export let values: number[] = [];
  export let colors: string[] | null = null;
  export let title = '';
  export let max = 0;
  export let height = 200;
  export let datasets: StageChartDataset[] | null = null;
  export let stacked = false;
  export let showLegend = false;

  let canvas: HTMLCanvasElement | null = null;
  let chart: any = null;
  let containerStyle = '';
  let previousHeight = height;

  $: if (height !== previousHeight) {
    previousHeight = height;
  }

  $: containerStyle = `height: ${Math.max(80, previousHeight)}px;`;

  function mergeDatasetConfig(dataset: StageChartDataset) {
    const fallbackColor = colors ?? 'rgba(148, 163, 184, 0.7)';
    const fallbackHover = colors ?? 'rgba(148, 163, 184, 0.85)';

    return {
      barPercentage: 0.8,
      categoryPercentage: 0.7,
      borderRadius: stacked ? 0 : 6,
      borderWidth: 0,
      backgroundColor: fallbackColor,
      hoverBackgroundColor: fallbackHover,
      ...dataset
    };
  }

  function buildDataset() {
    if (datasets && datasets.length > 0) {
      return {
        labels,
        datasets: datasets.map((dataset) => mergeDatasetConfig(dataset))
      };
    }

    return {
      labels,
      datasets: [
        mergeDatasetConfig({
          label: title,
          data: values,
          backgroundColor: colors ?? 'rgba(148, 163, 184, 0.7)',
          hoverBackgroundColor: colors ?? 'rgba(148, 163, 184, 0.85)'
        })
      ]
    };
  }

  function buildOptions(): ChartOptions<'bar'> {
    const options: ChartOptions<'bar'> = {
      plugins: {
        legend: {
          display: showLegend
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked,
          grid: {
            display: false
          },
          ticks: {
            color: '#cbd5f5'
          }
        },
        y: {
          stacked,
          beginAtZero: true,
          suggestedMax: max > 0 ? (stacked ? max : max * 1.1) : undefined,
          grid: {
            color: 'rgba(148, 163, 184, 0.15)'
          },
          ticks: {
            precision: 0,
            color: '#cbd5f5'
          }
        }
      }
    };

    return options;
  }

  onMount(async () => {
    const { Chart } = await import('chart.js/auto');
    if (!canvas) return;
    chart = new Chart(canvas, {
      type: 'bar',
      data: buildDataset(),
      options: buildOptions()
    });
  });

  $: if (chart) {
    chart.data = buildDataset();
    chart.options = buildOptions();
    chart.update('none');
  }

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });
</script>

<div class="chart-container" style={containerStyle}>
  <canvas bind:this={canvas} aria-label={title}></canvas>
</div>

<style>
  .chart-container {
    width: 100%;
    position: relative;
  }

  canvas {
    width: 100%;
    height: 100%;
  }
</style>
