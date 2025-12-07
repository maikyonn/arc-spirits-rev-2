/**
 * SinkIn AI Image Generator API Client
 * TypeScript implementation of the SinkIn image generation API
 */

const API_ENDPOINT = 'https://sinkin.ai/api/inference';
const ACCESS_TOKEN = 'd55da0e8f8ce4d389dfc62847ccca356';
const QUALITY_SUFFIX =
	'male, solo, one character, splash art, masterpiece, best quality, extremely detailed CG unity 8k wallpaper';

export interface SinkInOptions {
	modelId?: string;
	numImages?: number;
	width?: number;
	height?: number;
	negativePrompt?: string;
	steps?: number;
	scale?: number;
	seed?: number;
}

export interface SinkInResponse {
	error_code: number;
	message?: string;
	images?: string[];
	credit_cost?: number;
	inf_id?: string;
}

export interface GeneratedImage {
	url: string;
	index: number;
}

/**
 * Generate images using SinkIn API
 */
export async function generateImages(
	prompt: string,
	options: SinkInOptions = {}
): Promise<GeneratedImage[]> {
	const {
		modelId = 'xylZzvg',
		numImages = 4,
		width = 768,
		height = 512,
		negativePrompt,
		steps = 30,
		scale = 7.5,
		seed = -1
	} = options;

	// Validate dimensions
	if (width % 8 !== 0 || height % 8 !== 0) {
		throw new Error('Width and height must be multiples of 8');
	}

	if (width < 128 || width > 896 || height < 128 || height > 896) {
		throw new Error('Width and height must be between 128 and 896');
	}

	if (steps < 1 || steps > 50) {
		throw new Error('Steps must be between 1 and 50');
	}

	if (scale < 1 || scale > 20) {
		throw new Error('Scale must be between 1 and 20');
	}

	// Append quality suffix to prompt
	const enhancedPrompt = `${prompt} ${QUALITY_SUFFIX}`;

	// Prepare API request payload according to SinkIn API documentation
	const payload: Record<string, unknown> = {
		access_token: ACCESS_TOKEN,
		model_id: modelId,
		prompt: enhancedPrompt,
		width,
		height,
		steps,
		scale,
		num_images: numImages,
		seed,
		use_default_neg: 'true'
		// Note: version is optional and defaults to latest - only include if model supports it
		// version: 'Hard' // Removed as it may not be supported by all models
	};

	if (negativePrompt) {
		payload.negative_prompt = negativePrompt;
	}

	try {
		const response = await fetch(API_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed: ${response.statusText}. Response: ${errorText}`);
		}

		const result: SinkInResponse = await response.json();

		// Check for API errors
		if (result.error_code !== 0) {
			const errorMessage = result.message || 'Unknown API error';
			throw new Error(`SinkIn API error (code ${result.error_code}): ${errorMessage}`);
		}

		// Validate that images array exists and has content
		if (!result.images || !Array.isArray(result.images)) {
			throw new Error('Invalid API response: images array is missing or invalid');
		}

		const imageUrls = result.images;

		if (imageUrls.length === 0) {
			throw new Error('No images were generated. The API returned an empty image array.');
		}

		// Filter out any null/undefined URLs and validate they're strings
		const validUrls = imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0);

		if (validUrls.length === 0) {
			throw new Error('No valid image URLs were returned from the API');
		}

		return validUrls.map((url, index) => ({
			url,
			index: index + 1
		}));
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Failed to generate images');
	}
}

/**
 * Download an image from URL and convert to Blob
 * Uses server-side proxy to bypass CORS restrictions
 */
export async function downloadImageAsBlob(url: string): Promise<Blob> {
	try {
		// First try direct fetch (in case CORS is allowed)
		try {
			const directResponse = await fetch(url, {
				mode: 'cors',
				credentials: 'omit',
				cache: 'no-cache'
			});
			
			if (directResponse.ok) {
				const blob = await directResponse.blob();
				if (blob.type.startsWith('image/')) {
					return blob;
				}
			}
		} catch {
			// If direct fetch fails, use server proxy
		}

		// Use server-side proxy to bypass CORS
		const proxyResponse = await fetch('/api/download-image', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url })
		});

		if (!proxyResponse.ok) {
			const error = await proxyResponse.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `Failed to download image via proxy: ${proxyResponse.statusText}`);
		}

		const result = await proxyResponse.json();
		
		if (result.error) {
			throw new Error(result.error);
		}

		// Convert base64 back to blob
		const binaryString = atob(result.data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		
		return new Blob([bytes], { type: result.contentType || 'image/png' });
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Failed to download image');
	}
}

/**
 * Generate a prompt based on spirit details
 */
export function generateSpiritPrompt(
	spiritName: string,
	originName: string,
	className: string
): string {
	if (className.toLowerCase() === 'animal') {
		return `a graphic anime illustration of ${spiritName}, ${originName} origin, cute animal creature, painterly`;
	}
	return `a graphic anime illustration of an anime girl or boy of a ${className} class. the theme should be ${originName}.`;
}

