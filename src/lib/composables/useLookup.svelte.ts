/**
 * ID to value mapping composable
 *
 * Provides efficient lookup operations using a derived Map for O(1) access.
 * Automatically updates when source items change.
 *
 * @example
 * ```ts
 * const originLookup = useLookup(() => origins, 'name');
 *
 * const origin = originLookup.get('origin-id-123');
 * const name = originLookup.getLabel('origin-id-123', 'Unknown Origin');
 * const exists = originLookup.exists('origin-id-123');
 * ```
 */
export function useLookup<T extends { id: string }>(
	items: () => T[],
	labelField: keyof T = 'name' as keyof T
) {
	const map = $derived(new Map(items().map((item) => [item.id, item])));

	/**
	 * Get an item by ID
	 * @param id - The item ID to lookup
	 * @returns The item or undefined if not found
	 */
	function get(id: string | null | undefined): T | undefined {
		if (!id) return undefined;
		return map.get(id);
	}

	/**
	 * Get a label for an item by ID
	 * @param id - The item ID to lookup
	 * @param fallback - Fallback value if item not found (default: 'Unknown')
	 * @returns The label or fallback value
	 */
	function getLabel(id: string | null | undefined, fallback = 'Unknown'): string {
		const item = get(id);
		return item ? String(item[labelField]) : fallback;
	}

	/**
	 * Check if an item exists by ID
	 * @param id - The item ID to check
	 * @returns True if item exists, false otherwise
	 */
	function exists(id: string | null | undefined): boolean {
		if (!id) return false;
		return map.has(id);
	}

	return {
		get,
		getLabel,
		exists,
		get map() {
			return map;
		}
	};
}
