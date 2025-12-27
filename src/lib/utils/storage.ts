import { supabase } from '$lib/api/supabaseClient';
import { cropTransparentArea } from './imageCrop';

/**
 * Build a cache-busted public URL for a file in Supabase storage.
 * - `path` should be relative to the bucket (e.g. "origin_icons/123/icon.png").
 * - `bucket` defaults to "game_assets".
 * - `updatedAt` (string | number) is used as the version; if omitted, `Date.now()` is used to ensure a fresh URL.
 */
export function publicAssetUrl(
	path: string | null | undefined,
	options?: { bucket?: string; updatedAt?: string | number }
): string | null {
	if (!path) return null;
	const bucket = options?.bucket ?? 'game_assets';
	const normalized = path.startsWith('/') ? path.slice(1) : path;
	const relative = normalized.startsWith(`${bucket}/`)
		? normalized.slice(bucket.length + 1)
		: normalized;

	const { data } = supabase.storage.from(bucket).getPublicUrl(relative);
	if (!data?.publicUrl) return null;

	const version =
		options?.updatedAt !== undefined
			? new Date(options.updatedAt).getTime()
			: Date.now();
	const sep = data.publicUrl.includes('?') ? '&' : '?';
	return `${data.publicUrl}${sep}v=${version}`;
}

/** Convenience wrapper when you already have a publicUrl string. */
export function bustUrl(publicUrl: string | null | undefined, version?: string | number): string | null {
	if (!publicUrl) return null;
	const v = version !== undefined ? new Date(version).getTime() : Date.now();
	const sep = publicUrl.includes('?') ? '&' : '?';
	return `${publicUrl}${sep}v=${v}`;
}

/**
 * Normalize storage path - remove leading slashes and bucket prefix
 */
export function normalizeStoragePath(path: string | null | undefined, bucketPrefix?: string): string {
	if (!path) return '';
	let normalized = path.replace(/^\/+/, '');
	if (bucketPrefix && normalized.startsWith(bucketPrefix + '/')) {
		normalized = normalized.slice(bucketPrefix.length + 1);
	}
	return normalized;
}

/**
 * Get public URL for a storage object with cache busting
 */
export function getPublicUrl(bucket: string, path: string | null | undefined, cacheBust = false): string | null {
	if (!path) return null;
	const normalized = normalizeStoragePath(path, bucket);
	if (!normalized) return null;

	const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
	if (!data?.publicUrl) return null;

	return cacheBust ? `${data.publicUrl}?t=${Date.now()}` : data.publicUrl;
}

/**
 * Sanitize filename for storage - remove special chars, spaces to underscores
 */
export function sanitizeFilename(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9._-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

/**
 * Delete a file from storage
 */
export async function deleteStorageFile(bucket: string, path: string): Promise<{ error: Error | null }> {
	const normalized = normalizeStoragePath(path, bucket);
	if (!normalized) return { error: null };

	const { error } = await supabase.storage.from(bucket).remove([normalized]);
	return { error: error ? new Error(error.message) : null };
}

/**
 * Upload a file to storage
 */
export async function uploadStorageFile(
	bucket: string,
	path: string,
	file: File | Blob,
	options?: { upsert?: boolean; contentType?: string }
): Promise<{ data: { path: string } | null; error: Error | null }> {
	const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
		upsert: options?.upsert ?? true,
		contentType: options?.contentType
	});

	return {
		data: data ? { path: data.path } : null,
		error: error ? new Error(error.message) : null
	};
}

export interface ProcessAndUploadOptions {
	/** Storage bucket name (default: 'game_assets') */
	bucket?: string;
	/** Folder path within bucket */
	folder: string;
	/** Custom filename (without extension). If not provided, uses timestamp */
	filename?: string;
	/** Whether to crop transparent areas (default: true) */
	cropTransparent?: boolean;
	/** Whether to upsert existing file (default: true) */
	upsert?: boolean;
}

/**
 * Process an image (crop transparent areas) and upload to storage.
 * This is the unified upload function that should be used for all image uploads.
 *
 * @param input - File or Blob to upload
 * @param options - Upload options
 * @returns Object with path on success, or error on failure
 */
export async function processAndUploadImage(
	input: File | Blob,
	options: ProcessAndUploadOptions
): Promise<{ data: { path: string } | null; error: Error | null }> {
	const {
		bucket = 'game_assets',
		folder,
		filename,
		cropTransparent = true,
		upsert = true
	} = options;

	try {
		// Determine content type
		const contentType = input.type || 'image/png';

		// Process image - crop transparent areas if enabled
		let processedBlob: Blob = input;
		if (cropTransparent && contentType.startsWith('image/')) {
			try {
				processedBlob = await cropTransparentArea(input, contentType);
			} catch (cropError) {
				console.warn('Failed to crop transparent area, using original:', cropError);
				// Fall back to original if cropping fails
			}
		}

		// Generate filename
		const extension = contentType.split('/')[1] || 'png';
		const finalFilename = filename ?? `${Date.now()}`;
		const path = `${folder}/${finalFilename}.${extension}`;

		// Upload to storage
		return await uploadStorageFile(bucket, path, processedBlob, {
			upsert,
			contentType
		});
	} catch (err) {
		return {
			data: null,
			error: err instanceof Error ? err : new Error(String(err))
		};
	}
}
