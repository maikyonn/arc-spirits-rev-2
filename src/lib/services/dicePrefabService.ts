/**
 * Automatic Dice Prefab Generation Service
 *
 * Handles automatic dice prefab generation and storage for custom dice.
 * Generates individual dice side images and combines them into a composite
 * prefab image with template overlay.
 */

import { createCanvas, getContext, loadImage, canvasToBlob } from '$lib/generators/shared/canvas';
import { generateDiceSide } from '$lib/generators/dice/diceSideGenerator';
import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { CustomDiceRow, DiceSideRow } from '$lib/types/gameData';
import { uploadStorageFile, publicAssetUrl } from '$lib/utils/storage';
import type { CustomDiceWithSides } from '$lib/features/dice/dice';

// Global template data loaded from database
export interface GlobalTemplateData {
	templateImageUrl: string | null;
	templatePositions: Record<number, { x: number; y: number }>;
	templateScale: number;
	templateId: string | null;
}

/**
 * Load the global template from the database
 */
export async function loadGlobalTemplate(
	client: Rev2Client = supabase
): Promise<GlobalTemplateData | null> {
	try {
		const { data, error } = await client
			.from('dice_templates')
			.select('*')
			.limit(1)
			.single();

		if (error && error.code !== 'PGRST116') {
			console.error('Error loading global template:', error);
			return null;
		}

		if (!data) {
			return null;
		}

		// Get template image URL
		let templateImageUrl: string | null = null;
		if (data.template_image_path) {
			const path = data.template_image_path.startsWith('dice_templates/')
				? data.template_image_path
				: `dice_templates/${data.template_image_path}`;
			templateImageUrl = publicAssetUrl(path, { bucket: 'game_assets' });
			console.log('[dicePrefabService] Loaded template:', {
				path,
				url: templateImageUrl,
				positions: Object.keys(data.template_positions || {}),
				scale: data.template_scale
			});
		}

		// Parse template positions from JSONB
		const templatePositions: Record<number, { x: number; y: number }> = {};
		if (data.template_positions && typeof data.template_positions === 'object') {
			for (const [sideNum, pos] of Object.entries(data.template_positions)) {
				if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
					templatePositions[parseInt(sideNum)] = {
						x: (pos as { x: number; y: number }).x,
						y: (pos as { x: number; y: number }).y
					};
				}
			}
		}

		// Get template scale (default to 100 if not set)
		const templateScale = data.template_scale ?? 100;

		return {
			templateImageUrl,
			templatePositions,
			templateScale,
			templateId: data.id
		};
	} catch (err) {
		console.error('Failed to load global template:', err);
		return null;
	}
}

/**
 * Create composite prefab image with all dice sides in template layout
 */
async function createCompositeImage(
	diceSides: DiceSideRow[],
	diceType: 'attack' | 'special',
	backgroundUrl: string,
	templateImageUrl: string,
	templatePositions: Record<number, { x: number; y: number }>,
	templateScale: number
): Promise<Blob> {
	console.log('[dicePrefabService] Creating composite:', {
		templateUrl: templateImageUrl,
		positions: templatePositions,
		scale: templateScale,
		sideCount: diceSides.length
	});

	// Load template image to get dimensions
	const templateImg = await loadImage(templateImageUrl);
	console.log('[dicePrefabService] Template image loaded:', {
		width: templateImg.width,
		height: templateImg.height
	});

	// Since we're working directly with the full template image (not a scaled preview),
	// scaleX and scaleY are both 1.0
	const scaleX = 1;
	const scaleY = 1;

	const canvas = createCanvas(templateImg.width, templateImg.height);
	const ctx = getContext(canvas);

	// Draw template image first
	ctx.drawImage(templateImg, 0, 0);
	console.log('[dicePrefabService] Template image drawn on canvas');

	// Generate and draw each dice face
	for (const side of diceSides) {
		const position = templatePositions[side.side_number];
		if (!position) {
			console.warn(`No position defined for side ${side.side_number}, skipping`);
			continue;
		}

		try {
			const text = diceType === 'attack'
				? side.reward_value
				: (side.reward_value || String(side.side_number));

			const diceFaceDataUrl = await generateDiceSide({
				backgroundUrl: backgroundUrl,
				text: text,
				size: 800
			});

			const diceFaceImg = await loadImage(diceFaceDataUrl);

			// Mirror the exact logic from the template editor:
			// Scale positions by scaleX/scaleY
			const scaledX = position.x * scaleX;
			const scaledY = position.y * scaleY;

			// Calculate face size: (templateScale% / 100) * baseSize * scaleX
			const baseSize = 100;
			const scaledFaceSize = (templateScale / 100) * baseSize * scaleX;

			console.log(`[dicePrefabService] Drawing side ${side.side_number} at (${scaledX}, ${scaledY}) with size ${scaledFaceSize}px (scale: ${templateScale}%)`);

			// Draw dice face at scaled position with scaled size
			ctx.drawImage(diceFaceImg, scaledX, scaledY, scaledFaceSize, scaledFaceSize);
		} catch (err) {
			console.warn(`[dicePrefabService] Failed to draw dice face for side ${side.side_number}:`, err);
		}
	}

	// Convert canvas to blob
	return await canvasToBlob(canvas, 'image/png');
}

/**
 * Upload prefab image to storage
 */
async function uploadPrefabImage(
	diceId: string,
	blob: Blob,
	client: Rev2Client = supabase
): Promise<string> {
	const path = `dice_templates/${diceId}/prefab_composite.png`;

	const { data, error } = await uploadStorageFile('game_assets', path, blob, {
		upsert: true,
		contentType: 'image/png'
	});

	if (error) {
		throw new Error(`Failed to upload prefab image: ${error.message}`);
	}

	if (!data) {
		throw new Error('Upload succeeded but no data returned');
	}

	return data.path;
}

/**
 * Update dice record with exported template path
 */
async function updateDiceRecord(
	diceId: string,
	exportedPath: string,
	client: Rev2Client = supabase
): Promise<void> {
	const { error } = await client
		.from('custom_dice')
		.update({
			exported_template_path: exportedPath,
			updated_at: new Date().toISOString()
		})
		.eq('id', diceId);

	if (error) {
		throw new Error(`Failed to update dice record: ${error.message}`);
	}
}

/**
 * Generate and save prefab for a single dice
 *
 * @param dice - Dice record with sides
 * @param globalTemplate - Global template data (if not provided, will be loaded)
 * @param client - Supabase client instance
 * @returns Storage path of the generated prefab, or null on error
 */
export async function generateAndSavePrefab(
	dice: CustomDiceWithSides,
	globalTemplate?: GlobalTemplateData | null,
	client: Rev2Client = supabase
): Promise<string | null> {
	console.log(`[dicePrefabService] generateAndSavePrefab called for dice: ${dice.name}`);

	try {
		// Validate dice has sides
		if (!dice.dice_sides || dice.dice_sides.length === 0) {
			console.warn(`[dicePrefabService] Dice ${dice.name} has no sides, skipping prefab generation`);
			return null;
		}

		// Load global template if not provided
		const template = globalTemplate ?? await loadGlobalTemplate(client);
		console.log('[dicePrefabService] Template loaded:', !!template);

		if (!template) {
			console.error(`Cannot generate prefab for ${dice.name}: Failed to load global template`);
			return null;
		}

		// Extract and validate template image URL
		const templateImageUrl = template.templateImageUrl;
		if (!templateImageUrl) {
			console.error(`Cannot generate prefab for ${dice.name}: No template image configured`);
			return null;
		}

		if (Object.keys(template.templatePositions).length === 0) {
			console.error(`Cannot generate prefab for ${dice.name}: No template positions configured`);
			return null;
		}

		// Get background image URL (required)
		if (!dice.background_image_path) {
			console.error(`Cannot generate prefab for ${dice.name}: No background image configured`);
			return null;
		}

		const bgPath = dice.background_image_path.startsWith('dice_backgrounds/')
			? dice.background_image_path
			: `dice_backgrounds/${dice.background_image_path}`;
		const backgroundUrl = publicAssetUrl(bgPath, { bucket: 'game_assets' });

		if (!backgroundUrl) {
			console.error(`Cannot generate prefab for ${dice.name}: Failed to get background image URL`);
			return null;
		}

		// Step 1: Create composite prefab image
		console.log(`Creating composite image for ${dice.name}...`);
		const compositeBlob = await createCompositeImage(
			dice.dice_sides,
			dice.dice_type,
			backgroundUrl, // TypeScript now knows this is string, not string | null
			templateImageUrl, // TypeScript now knows this is string, not string | null
			template.templatePositions,
			template.templateScale
		);

		// Step 2: Upload prefab to storage
		console.log(`Uploading prefab for ${dice.name}...`);
		const storagePath = await uploadPrefabImage(dice.id, compositeBlob, client);

		// Step 3: Update database with new path
		console.log(`Updating database for ${dice.name}...`);
		await updateDiceRecord(dice.id, storagePath, client);

		console.log(`✓ Successfully generated prefab for ${dice.name}`);
		return storagePath;
	} catch (error) {
		console.error(`Failed to generate prefab for dice ${dice.name}:`, error);
		return null;
	}
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult {
	success: string[];
	failed: string[];
	total: number;
	successCount: number;
	failureCount: number;
}

/**
 * Generate prefabs for all dice in the list
 *
 * @param diceList - Array of dice records to generate prefabs for
 * @param onProgress - Optional callback for progress updates
 * @param client - Supabase client instance
 * @returns Object containing arrays of successful and failed dice IDs with counts
 */
export async function generateAllPrefabs(
	diceList: CustomDiceWithSides[],
	onProgress?: (current: number, total: number, diceName: string) => void,
	client: Rev2Client = supabase
): Promise<BatchGenerationResult> {
	const success: string[] = [];
	const failed: string[] = [];
	const total = diceList.length;

	console.log(`Starting batch prefab generation for ${total} dice...`);

	// Load global template once for all dice
	const globalTemplate = await loadGlobalTemplate(client);
	if (!globalTemplate || !globalTemplate.templateImageUrl) {
		console.error('Cannot generate prefabs: No global template configured');
		return {
			success: [],
			failed: diceList.map(d => d.id),
			total,
			successCount: 0,
			failureCount: total
		};
	}

	for (let i = 0; i < diceList.length; i++) {
		const dice = diceList[i];

		// Call progress callback
		if (onProgress) {
			onProgress(i + 1, total, dice.name);
		}

		try {
			const result = await generateAndSavePrefab(dice, globalTemplate, client);

			if (result) {
				success.push(dice.id);
			} else {
				failed.push(dice.id);
			}
		} catch (error) {
			console.error(`Error generating prefab for ${dice.name}:`, error);
			failed.push(dice.id);
		}
	}

	const result: BatchGenerationResult = {
		success,
		failed,
		total,
		successCount: success.length,
		failureCount: failed.length
	};

	console.log(`Batch generation complete: ${result.successCount}/${total} successful, ${result.failureCount} failed`);

	return result;
}

/**
 * Regenerate prefab for a single dice (convenience function)
 */
export async function regeneratePrefab(
	diceId: string,
	client: Rev2Client = supabase
): Promise<string | null> {
	// Fetch the dice with its sides
	const { data, error } = await client
		.from('custom_dice')
		.select('*, dice_sides(*)')
		.eq('id', diceId)
		.single();

	if (error || !data) {
		console.error(`Failed to fetch dice ${diceId}:`, error);
		return null;
	}

	const dice: CustomDiceWithSides = {
		...data,
		dice_sides: data.dice_sides ?? []
	};

	return await generateAndSavePrefab(dice, undefined, client);
}
