/**
 * Convert an emoji string to Noto Emoji code points format.
 * Handles multi-codepoint emojis (skin tones, ZWJ sequences, etc.)
 */
function emojiToNotoCodepoints(emoji: string): string {
	const codepoints: string[] = [];
	for (const char of emoji) {
		const cp = char.codePointAt(0);
		if (cp !== undefined) {
			// Skip variation selectors (FE0E, FE0F)
			if (cp !== 0xfe0e && cp !== 0xfe0f) {
				codepoints.push(cp.toString(16).toLowerCase());
			}
		}
	}
	// Noto uses underscore separator with "emoji_u" prefix
	return codepoints.join('_');
}

/**
 * Get the Noto Color Emoji SVG URL for an emoji.
 */
function getNotoEmojiUrl(emoji: string): string {
	const codepoints = emojiToNotoCodepoints(emoji);
	return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u${codepoints}.svg`;
}

/**
 * Render an emoji to a PNG blob using Noto Color Emoji (Google's style).
 * Falls back to system emoji if Noto fails.
 * Renders with a fully transparent background.
 */
export async function emojiToPngBlob(emoji: string, size = 512): Promise<Blob | null> {
	if (typeof document === 'undefined') return null;
	
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d', { alpha: true });
	if (!ctx) return null;

	// Clear to fully transparent
	ctx.clearRect(0, 0, size, size);

	// Try to load Noto Color Emoji SVG
	const notoUrl = getNotoEmojiUrl(emoji);
	
	try {
		const img = await loadImage(notoUrl);
		// Draw centered with padding
		const padding = size * 0.05;
		const drawSize = size - padding * 2;
		ctx.drawImage(img, padding, padding, drawSize, drawSize);
	} catch {
		// Fallback to system emoji if Noto fails
		console.warn(`Noto Color Emoji not found for "${emoji}", falling back to system font`);
		const fontSize = Math.floor(size * 0.75);
		ctx.font = `${fontSize}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(emoji, size / 2, size * 0.52);
	}

	return await new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), 'image/png');
	});
}

/**
 * Load an image from a URL and return it as an HTMLImageElement.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
		img.src = url;
	});
}

/** Convert a blob to an ArrayBuffer for Supabase upload. */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	return await blob.arrayBuffer();
}
