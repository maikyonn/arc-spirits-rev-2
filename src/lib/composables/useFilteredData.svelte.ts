/**
 * Filtering and search logic composable
 *
 * Provides reactive filtering with search and custom filter support.
 * Automatically updates when source data, search query, or filters change.
 *
 * @example
 * ```ts
 * const filtered = useFilteredData(
 *   () => items,
 *   {
 *     searchFields: ['name', 'description'],
 *     filters: [
 *       { key: 'origin_id', value: () => selectedOriginId },
 *       { key: 'class_id', value: () => selectedClassId }
 *     ]
 *   }
 * );
 *
 * filtered.searchQuery = 'fire';
 * console.log(filtered.count); // Number of filtered items
 * ```
 */
export function useFilteredData<T extends Record<string, any>>(
	items: () => T[],
	options: {
		searchFields: (keyof T)[];
		filters?: { key: keyof T; value: () => string | null }[];
	}
) {
	let searchQuery = $state('');

	const filtered = $derived.by(() => {
		let result = items();

		// Apply search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((item) =>
				options.searchFields.some((field) =>
					String(item[field] ?? '')
						.toLowerCase()
						.includes(query)
				)
			);
		}

		// Apply filters
		if (options.filters) {
			for (const filter of options.filters) {
				const filterValue = filter.value();
				if (filterValue && filterValue !== 'all') {
					result = result.filter((item) => String(item[filter.key]) === filterValue);
				}
			}
		}

		return result;
	});

	return {
		get searchQuery() {
			return searchQuery;
		},
		set searchQuery(v) {
			searchQuery = v;
		},
		get filtered() {
			return filtered;
		},
		get count() {
			return filtered.length;
		},
		get total() {
			return items().length;
		}
	};
}
