import type { MonsterRow, RewardRow, RewardRowType, SpecialEffectRow } from '$lib/types/gameData';
import { REWARD_ROW_CONFIG } from '$lib/types/gameData';
import { createCanvas, getContext, loadImage, canvasToBlob, roundRect, wrapText, computeTrimRect } from '../shared/canvas';

/**
 * Strip HTML tags and decode HTML entities for plain text rendering
 */
function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	// Remove HTML tags
	let text = html.replace(/<[^>]*>/g, '');
	// Decode common HTML entities
	text = text
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
	return text;
}

// Resolved reward row with icon URLs
type ResolvedRewardRow = RewardRow & {
	icon_urls: (string | null)[];
};

export async function generateMonsterCardPNG(
	monster: MonsterRow & { effects?: SpecialEffectRow[] },
	artUrl?: string | null,
	iconUrl?: string | null,
	rewardRows?: ResolvedRewardRow[]
): Promise<Blob> {
	if (!monster.id || !monster.name) {
		throw new Error('Monster missing ID or name');
	}

	// Target output size 600x400 with 1:1 split (300 data, 300 art)
	const width = 600;
	const height = 400;
	const dataWidth = 300;
	const artWidth = width - dataWidth;

	// Create canvas
	const canvas = createCanvas(width, height);
	const ctx = getContext(canvas);

	const stateColors: Record<string, string> = {
		tainted: '#c084fc', // light purple
		corrupt: '#6b21a8', // dark purple
		fallen: '#065f46', // dark green
		boss: '#ef4444' // red
	};

	const accentColor = '#a855f7';
	const cardBgColor = '#0c0b13';
	const textColor = '#f5f3ff';
	const secondaryTextColor = '#d8b4fe';

	// Draw card background with rounded corners
	ctx.fillStyle = cardBgColor;
	roundRect(ctx, 0, 0, width, height, 12);
	ctx.fill();

	// Accent border on the left
	ctx.fillStyle = accentColor;
	ctx.fillRect(0, 0, 6, height);

	// Divider between data and art
	ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
	ctx.fillRect(dataWidth - 1, 12, 2, height - 24);

	// Art panel background
	ctx.fillStyle = 'rgba(12, 10, 19, 0.9)';
	roundRect(ctx, dataWidth, 12, artWidth - 12, height - 24, 10);
	ctx.fill();

	// Render art (cover)
	if (artUrl) {
		try {
			const artImg = await loadImage(artUrl);
			ctx.filter = 'grayscale(100%)';

			const destX = dataWidth + 8;
			const destY = 20;
			const destW = artWidth - 16;
			const destH = height - 40;

			// Fill by height
			const ratio = destH / artImg.height;
			const drawW = artImg.width * ratio;
			const drawH = destH;
			const drawX = destX + (destW - drawW) / 2;
			const drawY = destY;

			ctx.save();
			roundRect(ctx, destX, destY, destW, destH, 10);
			ctx.clip();
			ctx.drawImage(artImg, drawX, drawY, drawW, drawH);
			ctx.restore();
			ctx.filter = 'none';
		} catch (err) {
			console.warn('Failed to load monster art:', err);
			ctx.filter = 'none';
		}
	} else {
		ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
		ctx.fillRect(dataWidth + 8, 20, artWidth - 16, height - 40);
		ctx.fillStyle = secondaryTextColor;
		ctx.font = '600 18px system-ui';
		ctx.fillText('Add artwork', dataWidth + 24, height / 2);
	}

	// Data panel content
	const padding = 24;
	let yPos = padding;

	// Header
	if (iconUrl) {
		try {
			const iconImg = await loadImage(iconUrl);
			const iconSize = 56;
			ctx.drawImage(iconImg, padding, yPos, iconSize, iconSize);
		} catch (err) {
			console.warn('Failed to load icon image:', err);
		}
	} else if (monster.icon) {
		ctx.font = 'bold 40px system-ui';
		ctx.fillStyle = textColor;
		ctx.fillText(monster.icon, padding, yPos + 44);
	}

	ctx.font = '700 26px "Inter", system-ui, -apple-system, sans-serif';
	ctx.fillStyle = textColor;
	const nameX = iconUrl || monster.icon ? padding + 68 : padding;
	ctx.fillText(monster.name, nameX, yPos + 26);

	ctx.font = '600 15px system-ui';
	ctx.fillStyle = accentColor;
	const stateLabel = ((monster as any).state ?? 'normal').toString();
	ctx.fillText(stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1), nameX, yPos + 48);

	// Level + state badges
	const badgeY = yPos + 68;
	const stateTextUpper = (monster.state ?? 'normal').toUpperCase();

	ctx.font = '700 13px "Inter", system-ui';
	const stateWidth = ctx.measureText(stateTextUpper).width + 20;
	const stateColor = stateColors[monster.state ?? 'tainted'] ?? '#94a3b8';
	ctx.fillStyle = stateColor;
	roundRect(ctx, nameX, badgeY, stateWidth, 22, 8);
	ctx.fill();
	ctx.fillStyle = '#0f172a';
	ctx.fillText(stateTextUpper, nameX + 10, badgeY + 15);

	yPos += 96;

	// Damage + Barrier box (match HTML look)
	const statBoxWidth = dataWidth - padding * 2;
	const effects = monster.effects ?? [];
	const lineHeight = 12;
	const maxEffectWidth = statBoxWidth - 16;
	
	// Pre-calculate effect lines to determine box height
	const effectLines: { name: string; color: string; descLines: string[] }[] = [];
	let totalEffectLines = 0;
	
	if (effects.length > 0) {
		ctx.font = '400 9px "Inter", system-ui';
		for (const effect of effects.slice(0, 4)) { // max 4 effects
			const nameText = `${effect.name}:`;
			ctx.font = '700 9px "Inter", system-ui';
			const nameWidth = ctx.measureText(nameText).width;
			ctx.font = '400 9px "Inter", system-ui';
			const descMaxWidth = maxEffectWidth - nameWidth - 6;
			const descLines = effect.description ? wrapText(ctx, stripHtml(effect.description), descMaxWidth) : [];
			effectLines.push({ name: nameText, color: effect.color || '#a78bfa', descLines });
			totalEffectLines += Math.max(1, descLines.length);
		}
	}
	
	const effectGapTotal = Math.max(0, effectLines.length - 1) * 6; // 6px gap between effects
	const statBoxHeight = effects.length > 0 ? 68 + totalEffectLines * lineHeight + effectGapTotal + 8 : 68;
	
	ctx.fillStyle = 'rgba(91, 33, 182, 0.35)';
	roundRect(ctx, padding, yPos, statBoxWidth, statBoxHeight, 14);
	ctx.fill();
	ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
	ctx.lineWidth = 2;
	roundRect(ctx, padding, yPos, statBoxWidth, statBoxHeight, 14);
	ctx.stroke();

	ctx.font = '700 12px "Inter", system-ui';
	ctx.fillStyle = secondaryTextColor;
	ctx.fillText('DAMAGE', padding + 12, yPos + 22);
	ctx.fillText('BARRIER', padding + statBoxWidth / 2 + 12, yPos + 22);

	ctx.font = '800 24px "Inter", system-ui';
	ctx.fillStyle = textColor;
	ctx.fillText(String(monster.damage ?? 0), padding + 12, yPos + 52);
	ctx.fillText(String((monster as any).barrier ?? 0), padding + statBoxWidth / 2 + 12, yPos + 52);

	// Special effects (if present)
	if (effectLines.length > 0) {
		ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(padding + 8, yPos + 60);
		ctx.lineTo(padding + statBoxWidth - 8, yPos + 60);
		ctx.stroke();

		let effectY = yPos + 72;
		
		const effectGap = 6; // Gap between effects
		for (let idx = 0; idx < effectLines.length; idx++) {
			const effectLine = effectLines[idx];
			// Effect name in color
			ctx.font = '700 9px "Inter", system-ui';
			ctx.fillStyle = effectLine.color;
			ctx.textAlign = 'left';
			const nameWidth = ctx.measureText(effectLine.name).width;
			ctx.fillText(effectLine.name, padding + 8, effectY);

			// Effect description lines
			if (effectLine.descLines.length > 0) {
				ctx.font = '400 9px "Inter", system-ui';
				ctx.fillStyle = '#cbd5e1';
				// First line next to name
				ctx.fillText(effectLine.descLines[0], padding + 8 + nameWidth + 3, effectY);
				effectY += lineHeight;

				// Additional lines indented
				for (let i = 1; i < effectLine.descLines.length; i++) {
					ctx.fillText(effectLine.descLines[i], padding + 12, effectY);
					effectY += lineHeight;
				}
			} else {
				effectY += lineHeight;
			}

			// Add gap between effects (but not after the last one)
			if (idx < effectLines.length - 1) {
				effectY += effectGap;
			}
		}
		ctx.textAlign = 'left';
	}
	
	yPos += statBoxHeight + 8; // Move yPos past the stat box

	// Render reward rows
	const validRows = (rewardRows ?? []).filter(row => row.icon_urls.some(Boolean));
	if (validRows.length > 0) {
		const dataPanelCenter = dataWidth / 2;
		const rowGap = 12; // Gap between rows
		let rewardsY = yPos + 4; // Start right after stat box

		for (const row of validRows) {
			const config = REWARD_ROW_CONFIG[row.type] || REWARD_ROW_CONFIG.all_in_combat;
			const validUrls = row.icon_urls.filter(Boolean) as string[];
			
			// Load images for this row
			const rowImages: { img: HTMLImageElement; crop: { sx: number; sy: number; sw: number; sh: number } }[] = [];
			for (const url of validUrls.slice(0, 5)) {
				try {
					const img = await loadImage(url);
					rowImages.push({ img, crop: computeTrimRect(img) });
				} catch (err) {
					console.warn('Failed to load reward icon', err);
				}
			}

			if (rowImages.length === 0) continue;

			if (row.type === 'tournament') {
				// Tournament style with title and placement headers
				const iconSize = 38;
				const iconGap = 5;
				
				// Title - left aligned
				ctx.font = '700 10px "Inter", system-ui';
				ctx.fillStyle = config.color;
				ctx.textAlign = 'left';
				ctx.fillText('THOSE THAT KILL, RANK DAMAGE', padding, rewardsY + 10);
				
				const placementLabels = ['1ST', '2ND', '3RD+'];
				const chooseLabels = ['CHOOSE 3', 'CHOOSE 2', 'CHOOSE 1'];
				const numHeaders = 3;
				const numIcons = Math.min(rowImages.length, 5);
				const slotWidth = iconSize + 8;
				const totalWidth = slotWidth * numIcons + 16;
				const headerSlotWidth = totalWidth / numHeaders;
				const startX = dataPanelCenter - totalWidth / 2;
				
				// Draw header labels
				for (let i = 0; i < numHeaders; i++) {
					const slotCenterX = startX + i * headerSlotWidth + headerSlotWidth / 2;
					ctx.font = '700 10px "Inter", system-ui';
					ctx.fillStyle = config.color;
					ctx.textAlign = 'center';
					ctx.fillText(placementLabels[i], slotCenterX, rewardsY + 24);
					ctx.font = '600 8px "Inter", system-ui';
					ctx.fillStyle = '#d97706';
					ctx.fillText(chooseLabels[i], slotCenterX, rewardsY + 34);
					
					if (i < numHeaders - 1) {
						const dividerX = startX + (i + 1) * headerSlotWidth;
						ctx.strokeStyle = config.borderColor;
						ctx.lineWidth = 1;
						ctx.beginPath();
						ctx.moveTo(dividerX, rewardsY + 14);
						ctx.lineTo(dividerX, rewardsY + 36);
						ctx.stroke();
					}
				}
				ctx.textAlign = 'left';
				
				// Draw icons panel
				const panelY = rewardsY + 38;
				const panelPadding = 6;
				const iconsWidth = numIcons * iconSize + (numIcons - 1) * iconGap;
				const panelWidth = iconsWidth + panelPadding * 2;
				const panelX = dataPanelCenter - panelWidth / 2;
				
				ctx.fillStyle = config.bgColor;
				roundRect(ctx, panelX, panelY, panelWidth, iconSize + 8, 6);
				ctx.fill();
				ctx.strokeStyle = config.borderColor;
				ctx.lineWidth = 1;
				roundRect(ctx, panelX, panelY, panelWidth, iconSize + 8, 6);
				ctx.stroke();
				
				let iconX = panelX + panelPadding;
				for (const entry of rowImages) {
					ctx.drawImage(entry.img, entry.crop.sx, entry.crop.sy, entry.crop.sw, entry.crop.sh, iconX, panelY + 4, iconSize, iconSize);
					iconX += iconSize + iconGap;
				}
				
				rewardsY += 38 + iconSize + 8 + rowGap; // title + headers + panel + gap
			} else {
				// Standard row style (all_in_combat, all_losers, all_winners, one_winner)
				const iconSize = 34;
				const iconGap = 5;
				const numIcons = Math.min(rowImages.length, 5);
				const panelPadding = 6;
				const iconsWidth = numIcons * iconSize + (numIcons - 1) * iconGap;
				const panelWidth = iconsWidth + panelPadding * 2;
				const panelX = dataPanelCenter - panelWidth / 2;
				const label = row.label || config.label;
				
				// Draw header label - left aligned
				ctx.font = '700 10px "Inter", system-ui';
				ctx.fillStyle = config.color;
				ctx.textAlign = 'left';
				ctx.fillText(label, padding, rewardsY + 10);
				
				// Draw icons panel
				const panelY = rewardsY + 14;
				
				ctx.fillStyle = config.bgColor;
				roundRect(ctx, panelX, panelY, panelWidth, iconSize + 8, 6);
				ctx.fill();
				ctx.strokeStyle = config.borderColor;
				ctx.lineWidth = 1;
				roundRect(ctx, panelX, panelY, panelWidth, iconSize + 8, 6);
				ctx.stroke();
				
				let iconX = panelX + panelPadding;
				for (const entry of rowImages) {
					ctx.drawImage(entry.img, entry.crop.sx, entry.crop.sy, entry.crop.sw, entry.crop.sh, iconX, panelY + 4, iconSize, iconSize);
					iconX += iconSize + iconGap;
				}
				
				rewardsY += 14 + iconSize + 8 + rowGap; // label + panel + gap
			}
		}
	}

	// Convert canvas to blob
	return canvasToBlob(canvas);
}
