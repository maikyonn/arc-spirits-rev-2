import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Replicate from 'replicate';

// Initialize Replicate client
// You should set REPLICATE_API_TOKEN as an environment variable
const replicate = new Replicate({
	auth: process.env.REPLICATE_API_TOKEN || ''
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { prompt, aspect_ratio = '4:3', negative_prompt } = await request.json();

		if (!prompt) {
			return json({ error: 'Prompt is required' }, { status: 400 });
		}

		const input: Record<string, unknown> = {
			prompt,
			aspect_ratio
		};

		if (negative_prompt) {
			input.negative_prompt = negative_prompt;
		}

		// Run the Seedream-4 model
		const output = await replicate.run('bytedance/seedream-4', { input });

		// Extract URLs from the output
		// The output is an array of file-like objects with a url() method
		const urls: string[] = [];
		
		if (Array.isArray(output)) {
			for (const item of output) {
				if (item && typeof item.url === 'function') {
					urls.push(item.url());
				} else if (typeof item === 'string') {
					urls.push(item);
				} else if (item && typeof item === 'object' && 'url' in item) {
					urls.push(String(item.url));
				}
			}
		}

		return json({ outputs: urls });
	} catch (error) {
		console.error('Replicate API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to generate images' },
			{ status: 500 }
		);
	}
};

