<script lang="ts">
	interface FilterOption {
		label: string;
		value: string | number | boolean;
	}

	interface Filter {
		key: string;
		label: string;
		options: FilterOption[];
		value?: string | number | boolean | null;
	}

	interface Props {
		searchValue?: string;
		searchPlaceholder?: string;
		filters?: Filter[];
		onfilterchange?: (key: string, value: string | number | boolean | null) => void;
	}

	let {
		searchValue = $bindable(''),
		searchPlaceholder = 'Search...',
		filters = [],
		onfilterchange
	}: Props = $props();

	function handleFilterChange(key: string, event: Event) {
		const target = event.target as HTMLSelectElement;
		const value = target.value === '' ? null : target.value;
		onfilterchange?.(key, value);
	}
</script>

<div class="filter-bar">
	<div class="filter-bar__search">
		<label class="filter-bar__label">
			<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<circle cx="11" cy="11" r="8"></circle>
				<path d="m21 21-4.35-4.35"></path>
			</svg>
			<input
				type="search"
				class="filter-bar__input"
				placeholder={searchPlaceholder}
				bind:value={searchValue}
			/>
		</label>
	</div>

	{#if filters.length > 0}
		<div class="filter-bar__filters">
			{#each filters as filter (filter.key)}
				<label class="filter-bar__label">
					<span class="filter-bar__label-text">{filter.label}</span>
					<select
						class="filter-bar__select"
						value={filter.value ?? ''}
						onchange={(e) => handleFilterChange(filter.key, e)}
					>
						<option value="">All</option>
						{#each filter.options as option (option.value)}
							<option value={option.value}>
								{option.label}
							</option>
						{/each}
					</select>
				</label>
			{/each}
		</div>
	{/if}
</div>

<style>
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		align-items: flex-end;
	}

	.filter-bar__search {
		flex: 1;
		min-width: 200px;
	}

	.filter-bar__filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.filter-bar__label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		position: relative;
	}

	.filter-bar__search .filter-bar__label {
		width: 100%;
	}

	.filter-bar__label-text {
		font-size: 0.8rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.filter-bar__input,
	.filter-bar__select {
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: #cbd5f5;
		font-size: 0.9rem;
		transition: all 0.15s ease;
	}

	.filter-bar__input {
		padding-left: 2.25rem;
		width: 100%;
	}

	.filter-bar__select {
		min-width: 150px;
		cursor: pointer;
	}

	.filter-bar__input:focus,
	.filter-bar__select:focus {
		outline: none;
		border-color: rgba(59, 130, 246, 0.5);
		background: rgba(30, 41, 59, 0.9);
	}

	.filter-bar__input::placeholder {
		color: #64748b;
	}

	.search-icon {
		position: absolute;
		left: 0.65rem;
		bottom: 0.65rem;
		color: #94a3b8;
		pointer-events: none;
	}

	@media (max-width: 640px) {
		.filter-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-bar__search,
		.filter-bar__filters {
			width: 100%;
		}

		.filter-bar__filters {
			flex-direction: column;
		}

		.filter-bar__select {
			width: 100%;
		}
	}
</style>
