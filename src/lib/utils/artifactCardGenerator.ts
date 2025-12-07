import type { ArtifactRow, OriginRow, RuneRow, ArtifactTagRow, GuardianRow } from '$lib/types/gameData';
import { generateRuneIconCanvas } from './runeIconGenerator';
import { supabase } from '$lib/api/supabaseClient';

export async function generateArtifactCardPNG(
	artifact: ArtifactRow,
	origins: OriginRow[],
	runes: RuneRow[],
	tags: ArtifactTagRow[] = [],
	guardians: Pick<GuardianRow, 'id' | 'name'>[] = []
): Promise<Blob> {
	if (!artifact.id || !artifact.name) {
		throw new Error('Artifact missing ID or name');
	}

	// Match frontend dimensions: 300px × 225px
	const width = 300;
	const height = 225;

	// Create canvas
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not get canvas context');
	}

	// Get card border color (matching frontend logic)
	let borderColor = '#ffffff'; // Default white
	if (artifact.guardian_id) {
		borderColor = '#ef4444'; // Red for guardian artifacts
	} else if (artifact.tag_ids && artifact.tag_ids.length > 0 && artifact.tag_ids[0]) {
		const firstTag = tags.find((t) => t.id === artifact.tag_ids![0]);
		if (firstTag?.color) borderColor = firstTag.color;
	}

	// Get guardian name for tag
	const guardian = guardians.find((g) => g.id === artifact.guardian_id);
	
	let originTagText = 'Artifact';
	if (artifact.guardian_id) {
		originTagText = guardian?.name || 'Unknown Guardian';
	}

	// Helper to get rune details (matching frontend logic)
	const getRuneDetails = (runeId: string) => {
		const rune = runes.find((r) => r.id === runeId);
		if (!rune) return null;
		const origin = origins.find((o) => o.id === rune.origin_id);
		if (!origin) return null;
		
		// If rune has a saved icon_path, use that first
		if (rune.icon_path) {
			const { data } = supabase.storage.from('game_assets').getPublicUrl(rune.icon_path);
			if (data?.publicUrl) {
				return {
					name: rune.name,
					originName: origin.name,
					savedIconUrl: data.publicUrl, // Use saved PNG
					iconUrl: null,
					iconEmoji: null
				};
			}
		}
		
		// Otherwise, generate from origin icon (fallback)
		let iconUrl = null;
		let iconEmoji = null;
		
		if (origin.icon_png) {
			const path = origin.icon_png.startsWith('origin_icons/') ? origin.icon_png : `origin_icons/${origin.icon_png}`;
			const { data } = supabase.storage.from('game_assets').getPublicUrl(path);
			iconUrl = data?.publicUrl || null;
		} else if (origin.icon_emoji) {
			iconEmoji = origin.icon_emoji;
		}

		return {
			name: rune.name,
			originName: origin.name,
			savedIconUrl: null,
			iconUrl,
			iconEmoji
		};
	};

	// Load rune background URL (if available)
	let runeBackgroundUrl: string | null = null;
	try {
		const { data } = supabase.storage.from('game_assets').getPublicUrl('rune_backgrounds/background.png');
		if (data?.publicUrl) {
			// Verify the file exists by checking if we can fetch it
			const response = await fetch(data.publicUrl, { method: 'HEAD' });
			if (response.ok) {
				runeBackgroundUrl = data.publicUrl;
			}
		}
	} catch (err) {
		// Background not available, will use hexagon fallback
		console.warn('Rune background not available, using hexagon fallback');
	}

	// Draw card background with gradient
	const bgGradient = ctx.createLinearGradient(0, 0, width, height);
	bgGradient.addColorStop(0, 'rgba(30, 41, 59, 0.95)');
	bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
	
	// Draw rounded rectangle background
	ctx.fillStyle = bgGradient;
	roundRect(ctx, 0, 0, width, height, 16);
	ctx.fill();

	// Draw border (3px solid)
	ctx.strokeStyle = borderColor;
	ctx.lineWidth = 3;
	roundRect(ctx, 0, 0, width, height, 16);
	ctx.stroke();

	// Draw header gradient (padding: 1rem 1rem 0rem 1rem = 16px top/sides, 0 bottom)
	const headerGradient = ctx.createLinearGradient(0, 0, 0, 60);
	headerGradient.addColorStop(0, 'rgba(255,255,255,0.05)');
	headerGradient.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = headerGradient;
	ctx.fillRect(0, 0, width, 60);

	// Draw artifact name (font-size: 1.25rem = 20px, margin: 0 0 0.25rem 0 = 4px bottom)
	// Name color should be #fff, not borderColor
	ctx.fillStyle = '#fff';
	ctx.font = '800 20px Arial, sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.shadowColor = 'rgba(0,0,0,0.8)';
	ctx.shadowBlur = 0;
	ctx.shadowOffsetX = 2;
	ctx.shadowOffsetY = 2;
	ctx.fillText(artifact.name, 16, 16); // padding-left: 1rem = 16px, padding-top: 1rem = 16px
	ctx.shadowBlur = 0;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 0;

	// Draw benefit text (padding: 0rem 1rem = 0 top/bottom, 16px sides, font-size: 1.1rem = 17.6px)
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.font = '500 17.6px Arial, sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.shadowColor = 'rgba(0,0,0,0.5)';
	ctx.shadowBlur = 0;
	ctx.shadowOffsetX = 1;
	ctx.shadowOffsetY = 1;
	
	// Word wrap benefit text (max-width accounts for padding: 1rem = 16px on each side)
	const benefitText = artifact.benefit || '';
	const maxWidth = width - 32; // 16px padding on each side
	const words = benefitText.split(' ');
	const lines: string[] = [];
	let currentLine = '';
	
	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	
	const lineHeight = 24.64; // 17.6px * 1.4 (line-height)
	const startY = 60; // After header (which has padding-top: 1rem = 16px, but no padding-bottom)
	lines.forEach((line, i) => {
		ctx.fillText(line, 16, startY + i * lineHeight); // padding-left: 1rem = 16px
	});
	ctx.shadowBlur = 0;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 0;

	// Draw footer gradient
	const footerGradient = ctx.createLinearGradient(0, height - 60, 0, height);
	footerGradient.addColorStop(0, 'rgba(0,0,0,0.2)');
	footerGradient.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = footerGradient;
	ctx.fillRect(0, height - 60, width, 60);

	// Draw tags (left side) - footer padding: 0.75rem 1rem = 12px top, 16px sides
	// Tags container: left: 1rem (16px), bottom: 0.75rem (12px)
	// Tag gap: 0.35rem = 5.6px
	const tagGap = 5.6; // 0.35rem
	let tagX = 16; // left: 1rem = 16px
	const tagY = height - 12 - 18; // bottom: 0.75rem = 12px, tag height ~18px (font-size 10.4px + padding)

	// Origin tag (font-size: 0.65rem = 10.4px, padding: 0.15rem 0.5rem = 2.4px top/bottom, 8px left/right)
	ctx.fillStyle = '#334155';
	ctx.strokeStyle = 'rgba(255,255,255,0.5)';
	ctx.lineWidth = 2;
	
	// Measure text to calculate tag width
	ctx.font = '700 10.4px Arial, sans-serif';
	ctx.textAlign = 'left';
	const originTagTextMetrics = ctx.measureText(originTagText.toUpperCase());
	const originTagWidth = originTagTextMetrics.width + 16; // padding: 0.5rem = 8px on each side
	const originTagHeight = 10.4 + 4.8; // font-size + padding top/bottom (0.15rem * 2 = 2.4px * 2)
	
	// Draw box shadow for origin tag (2px 2px 0px rgba(0,0,0,0.3)) - draw shadow first
	ctx.fillStyle = 'rgba(0,0,0,0.3)';
	roundRect(ctx, tagX + 2, tagY + 2, originTagWidth, originTagHeight, 6);
	ctx.fill();
	
	// Draw the tag on top
	ctx.fillStyle = '#334155';
	roundRect(ctx, tagX, tagY, originTagWidth, originTagHeight, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255,255,255,0.5)';
	ctx.lineWidth = 2;
	roundRect(ctx, tagX, tagY, originTagWidth, originTagHeight, 6);
	ctx.stroke();
	
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(originTagText.toUpperCase(), tagX + 8, tagY + 2.4); // padding-left: 0.5rem = 8px, padding-top: 0.15rem = 2.4px
	tagX += originTagWidth + tagGap;

	// Guardian tag (if applicable) - same styling as other tags
	if (artifact.guardian_id) {
		ctx.font = '600 10.4px Arial, sans-serif';
		const guardianTextMetrics = ctx.measureText('Guardian');
		const guardianTagWidth = guardianTextMetrics.width + 12.8; // padding: 0.4rem = 6.4px on each side
		const guardianTagHeight = 10.4 + 3.2; // font-size + padding top/bottom (0.1rem * 2 = 1.6px * 2)
		
		ctx.fillStyle = 'rgba(255,255,255,0.1)';
		ctx.strokeStyle = 'rgba(255,255,255,0.2)';
		ctx.lineWidth = 1;
		roundRect(ctx, tagX, tagY, guardianTagWidth, guardianTagHeight, 4);
		ctx.fill();
		ctx.stroke();
		
		ctx.fillStyle = 'rgba(255,255,255,0.8)';
		ctx.fillText('Guardian', tagX + 6.4, tagY + 1.6); // padding-left: 0.4rem = 6.4px, padding-top: 0.1rem = 1.6px
		tagX += guardianTagWidth + tagGap;
	}

	// Other tags (font-size: 0.65rem = 10.4px, padding: 0.1rem 0.4rem = 1.6px top/bottom, 6.4px left/right)
	if (artifact.tags && artifact.tags.length > 0) {
		ctx.font = '600 10.4px Arial, sans-serif';
		for (const tag of artifact.tags) {
			const tagTextMetrics = ctx.measureText(tag);
			const tagWidth = tagTextMetrics.width + 12.8; // padding: 0.4rem = 6.4px on each side
			const tagHeight = 10.4 + 3.2; // font-size + padding top/bottom
			
			ctx.fillStyle = 'rgba(255,255,255,0.1)';
			ctx.strokeStyle = 'rgba(255,255,255,0.2)';
			ctx.lineWidth = 1;
			roundRect(ctx, tagX, tagY, tagWidth, tagHeight, 4);
			ctx.fill();
			ctx.stroke();
			
			ctx.fillStyle = 'rgba(255,255,255,0.8)';
			ctx.fillText(tag, tagX + 6.4, tagY + 1.6); // padding-left: 0.4rem = 6.4px, padding-top: 0.1rem = 1.6px
			tagX += tagWidth + tagGap;
		}
	}

	// Draw recipe box (right side)
	if (artifact.recipe_box && artifact.recipe_box.length > 0) {
		const runeIcons: string[] = [];
		for (const item of artifact.recipe_box) {
			const rune = getRuneDetails(item.rune_id);
			if (rune) {
				try {
					let iconDataUrl: string;
					
					// If rune has a saved PNG, use it directly
					if (rune.savedIconUrl) {
						iconDataUrl = rune.savedIconUrl;
					} else {
						// Otherwise, generate icon dynamically (fallback)
						iconDataUrl = await generateRuneIconCanvas({
							originIconUrl: rune.iconUrl || null,
							originIconEmoji: rune.iconEmoji || null,
							backgroundUrl: runeBackgroundUrl,
							size: 30
						});
					}
					
					for (let i = 0; i < item.quantity; i++) {
						runeIcons.push(iconDataUrl);
					}
				} catch (error) {
					console.warn(`Failed to load/generate rune icon for ${rune.name}:`, error);
					// Fallback: create a simple circle placeholder
					const fallbackCanvas = document.createElement('canvas');
					fallbackCanvas.width = 30;
					fallbackCanvas.height = 30;
					const fallbackCtx = fallbackCanvas.getContext('2d');
					if (fallbackCtx) {
						fallbackCtx.fillStyle = '#94a3b8';
						fallbackCtx.beginPath();
						fallbackCtx.arc(15, 15, 12, 0, Math.PI * 2);
						fallbackCtx.fill();
						runeIcons.push(fallbackCanvas.toDataURL('image/png'));
					}
				}
			}
		}

		if (runeIcons.length > 0) {
			// Recipe box: padding: 0.4rem = 6.4px, gap: 0.5rem = 8px, right: 1rem = 16px, bottom: 0.75rem = 12px
			// Rune icons: 30px each, gap 8px between them
			const runeIconSize = 30;
			const runeGap = 8; // 0.5rem
			const recipeBoxPadding = 6.4; // 0.4rem
			const recipeBoxWidth = runeIcons.length * runeIconSize + (runeIcons.length - 1) * runeGap + recipeBoxPadding * 2;
			const recipeBoxHeight = runeIconSize + recipeBoxPadding * 2;
			const recipeBoxX = width - 16 - recipeBoxWidth; // right: 1rem = 16px
			const recipeBoxY = height - 12 - recipeBoxHeight; // bottom: 0.75rem = 12px

			// Draw recipe box background with box shadow (3px 3px 0px rgba(0,0,0,0.3))
			ctx.fillStyle = 'rgba(0,0,0,0.3)';
			roundRect(ctx, recipeBoxX + 3, recipeBoxY + 3, recipeBoxWidth, recipeBoxHeight, 10);
			ctx.fill();
			
			// Draw recipe box background
			ctx.fillStyle = 'rgba(0,0,0,0.6)';
			ctx.strokeStyle = 'rgba(255,255,255,0.3)';
			ctx.lineWidth = 2;
			roundRect(ctx, recipeBoxX, recipeBoxY, recipeBoxWidth, recipeBoxHeight, 10);
			ctx.fill();
			ctx.stroke();

			// Draw rune icons (works with both data URLs and regular URLs)
			for (let i = 0; i < runeIcons.length; i++) {
				const img = new Image();
				img.crossOrigin = 'anonymous'; // Important for CORS when loading from storage
				await new Promise<void>((resolve, reject) => {
					img.onload = () => {
						ctx.drawImage(img, recipeBoxX + recipeBoxPadding + i * (runeIconSize + runeGap), recipeBoxY + recipeBoxPadding, runeIconSize, runeIconSize);
						resolve();
					};
					img.onerror = (err) => {
						console.warn(`Failed to load rune icon ${i}:`, err);
						reject(err);
					};
					img.src = runeIcons[i];
				});
			}
		}
	}

	// Convert canvas to blob
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob);
			} else {
				reject(new Error('Failed to convert canvas to blob'));
			}
		}, 'image/png');
	});
}

// Helper function to draw rounded rectangles
function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

// Legacy function name for backwards compatibility
export async function generateArtifactCardSVG(
	artifact: ArtifactRow,
	origins: OriginRow[],
	runes: RuneRow[],
	tags: ArtifactTagRow[] = [],
	guardians: Pick<GuardianRow, 'id' | 'name'>[] = [],
	
): Promise<string> {
	// Just return empty string - we're using PNG generation directly now
	return '';
}

// Convert SVG to PNG using Canvas API (legacy - not used anymore)
export async function convertSVGtoPNG(svg: string): Promise<Blob> {
	throw new Error('convertSVGtoPNG is deprecated. Use generateArtifactCardPNG instead.');
}
