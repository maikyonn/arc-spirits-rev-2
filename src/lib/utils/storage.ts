import { supabase } from '$lib/api/supabaseClient';

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
