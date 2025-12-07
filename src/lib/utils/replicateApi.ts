/**
 * Replicate API Client for Image Generation
 * Uses the Replicate API to generate images using Seedream-4 model
 * Calls a SvelteKit API route that handles the Replicate API call server-side
 */

export interface ReplicateOptions {
	prompt: string;
	aspectRatio?: '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | '9:21';
	negativePrompt?: string;
}

export interface ReplicateOutput {
	url: string;
	index: number;
}

/**
 * Generate images using Replicate API via a server-side API route
 * This calls a SvelteKit API route that handles the Replicate API call
 */
export async function generateReplicateImages(
	options: ReplicateOptions
): Promise<ReplicateOutput[]> {
	const { prompt, aspectRatio = '4:3', negativePrompt } = options;

	try {
		// Call our API route that handles Replicate
		const response = await fetch('/api/replicate/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				prompt,
				aspect_ratio: aspectRatio,
				negative_prompt: negativePrompt
			})
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Unknown error' }));
			throw new Error(error.error || error.message || `API request failed: ${response.statusText}`);
		}

		const result = await response.json();

		if (result.error) {
			throw new Error(result.error);
		}

		const outputs = result.outputs || [];

		if (outputs.length === 0) {
			throw new Error('No images were generated');
		}

		return outputs.map((url: string, index: number) => ({
			url,
			index: index + 1
		}));
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Failed to generate images with Replicate');
	}
}

/**
 * Generate a prompt based on spirit details for Replicate
 */
export function generateSpiritPromptForReplicate(
	spiritName: string,
	originName: string,
	className: string
): string {
	if (className.toLowerCase() === 'animal') {
		return `a cute graphic anime illustration of ${spiritName}, ${originName} origin, cute animal creature, painterly`;
	}
	return `a cute graphic anime illustration of an anime girl or boy of a ${className} class. the theme should be ${originName}.`;
}

