import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Server-side proxy to download images and convert to blob
 * This bypasses CORS restrictions by downloading on the server
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url } = await request.json();

		if (!url || typeof url !== 'string') {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// Validate URL
		try {
			new URL(url);
		} catch {
			return json({ error: 'Invalid URL' }, { status: 400 });
		}

		// Download image on server side
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0'
			}
		});

		if (!response.ok) {
			return json(
				{ error: `Failed to download image: ${response.status} ${response.statusText}` },
				{ status: response.status }
			);
		}

		// Get image as array buffer
		const arrayBuffer = await response.arrayBuffer();
		const contentType = response.headers.get('content-type') || 'image/png';

		// Convert to base64 for transfer
		const base64 = Buffer.from(arrayBuffer).toString('base64');

		return json({
			data: base64,
			contentType,
			url
		});
	} catch (error) {
		console.error('Image download error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to download image' },
			{ status: 500 }
		);
	}
};

