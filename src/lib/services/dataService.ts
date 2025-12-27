import { supabase } from '$lib/api/supabaseClient';
import { processAndUploadImage, type ProcessAndUploadOptions } from '$lib/utils/storage';

export type OrderSpec = { column: string; ascending?: boolean };

export async function fetchAll<T>(
	table: string,
	select = '*',
	order?: OrderSpec
): Promise<T[]> {
	let query = supabase.from(table).select(select);
	if (order) {
		query = query.order(order.column, { ascending: order.ascending ?? true });
	}
	const { data, error } = await query;
	if (error) throw error;
	return (data ?? []) as T[];
}

export async function upsertById<T extends { id?: string | null }>(
	table: string,
	payload: T
): Promise<T> {
	const { data, error } = await supabase.from(table).upsert(payload).select('*').single();
	if (error) throw error;
	return data as T;
}

export async function deleteById(table: string, id: string): Promise<void> {
	const { error } = await supabase.from(table).delete().eq('id', id);
	if (error) throw error;
}

export function publicUrl(bucket: string, path: string | null | undefined): string | null {
	if (!path) return null;
	const { data } = supabase.storage.from(bucket).getPublicUrl(path);
	return data?.publicUrl ?? null;
}

/**
 * Upload a file with transparent area cropping (for images)
 * @deprecated Use processAndUploadImage directly for new code
 */
export async function uploadFile(
	bucket: string,
	path: string,
	file: Blob | File,
	options?: { contentType?: string; upsert?: boolean; cacheControl?: string }
): Promise<string> {
	// Parse path into folder and filename
	const lastSlash = path.lastIndexOf('/');
	const folder = lastSlash > 0 ? path.substring(0, lastSlash) : '';
	const fullFilename = lastSlash > 0 ? path.substring(lastSlash + 1) : path;
	// Remove extension from filename
	const filename = fullFilename.replace(/\.[^.]+$/, '');

	const { data, error } = await processAndUploadImage(file, {
		bucket,
		folder,
		filename,
		cropTransparent: options?.contentType?.startsWith('image/') ?? true,
		upsert: options?.upsert ?? true
	});
	if (error) throw error;
	return data?.path ?? '';
}

export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
	const { error } = await supabase.storage.from(bucket).remove(paths);
	if (error) throw error;
}
