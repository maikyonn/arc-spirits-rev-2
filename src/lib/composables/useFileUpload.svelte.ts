import { processAndUploadImage, deleteStorageFile, getPublicUrl } from '$lib/utils/storage';

/**
 * File upload state management composable
 *
 * Provides reactive state and methods for file upload operations with progress tracking.
 * Integrates with Supabase storage utilities for consistent error handling.
 * All image uploads automatically crop transparent areas.
 *
 * @example
 * ```ts
 * const upload = useFileUpload('game_assets', 'origin_icons');
 *
 * const file = event.target.files[0];
 * const path = await upload.upload(file, 'custom-name');
 *
 * if (upload.error) {
 *   console.error(upload.error);
 * }
 *
 * const url = upload.getUrl(path, true); // with cache bust
 * ```
 */
export function useFileUpload(bucket: string, folder: string) {
	let isUploading = $state(false);
	let error = $state<string | null>(null);
	let progress = $state(0);

	/**
	 * Upload a file or blob to storage (automatically crops transparent areas for images)
	 * @param file - The file or blob to upload
	 * @param filename - Custom filename without extension (required for Blob, optional for File)
	 * @returns The storage path or null if upload failed
	 */
	async function upload(file: File | Blob, filename?: string): Promise<string | null> {
		isUploading = true;
		error = null;
		progress = 0;

		try {
			// Extract filename without extension
			const rawName = filename ?? (file instanceof File ? file.name.replace(/\.[^.]+$/, '') : 'blob');

			const { data, error: uploadError } = await processAndUploadImage(file, {
				bucket,
				folder,
				filename: rawName,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) {
				error = uploadError.message;
				return null;
			}

			progress = 100;
			return data?.path ?? null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			return null;
		} finally {
			isUploading = false;
		}
	}

	/**
	 * Remove a file from storage
	 * @param path - The storage path to remove
	 * @returns True if successful, false otherwise
	 */
	async function remove(path: string): Promise<boolean> {
		error = null;
		const { error: deleteError } = await deleteStorageFile(bucket, path);
		if (deleteError) {
			error = deleteError.message;
			return false;
		}
		return true;
	}

	/**
	 * Get public URL for a storage path
	 * @param path - The storage path
	 * @param cacheBust - Whether to add cache busting parameter
	 * @returns The public URL or null if path is invalid
	 */
	function getUrl(path: string | null, cacheBust = false): string | null {
		return getPublicUrl(bucket, path, cacheBust);
	}

	return {
		get isUploading() {
			return isUploading;
		},
		get error() {
			return error;
		},
		get progress() {
			return progress;
		},
		upload,
		remove,
		getUrl
	};
}
