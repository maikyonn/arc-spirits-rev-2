/**
 * Form modal state management composable
 *
 * Provides reactive state for controlling form modals with edit/create modes.
 * Auto-detects edit mode based on item ID and manages form data lifecycle.
 *
 * @example
 * ```ts
 * const modal = useFormModal({ name: '', position: 1 });
 *
 * // Open for creating new item
 * modal.open();
 *
 * // Open for editing existing item
 * modal.open({ id: '123', name: 'Existing', position: 5 });
 *
 * if (modal.isEditing) {
 *   console.log('Editing item:', modal.editingId);
 * }
 * ```
 */
export function useFormModal<T extends Record<string, any>>(defaultData: T) {
	let isOpen = $state(false);
	let editingId = $state<string | null>(null);
	let formData = $state<T>({ ...defaultData });

	/**
	 * Open the modal for creating or editing an item
	 * @param item - Optional item to edit. If provided, switches to edit mode.
	 */
	function open(item?: T & { id?: string }) {
		if (item) {
			editingId = item.id ?? null;
			formData = { ...item };
		} else {
			editingId = null;
			formData = { ...defaultData };
		}
		isOpen = true;
	}

	/**
	 * Close the modal and reset state
	 */
	function close() {
		isOpen = false;
		editingId = null;
		formData = { ...defaultData };
	}

	return {
		get isOpen() {
			return isOpen;
		},
		set isOpen(v) {
			isOpen = v;
		},
		get editingId() {
			return editingId;
		},
		get formData() {
			return formData;
		},
		set formData(v) {
			formData = v;
		},
		get isEditing() {
			return editingId !== null;
		},
		open,
		close
	};
}
