import type { EventRow } from '$lib/types/gameData';

export async function generateEventCardPNG(
	event: EventRow,
	artUrl?: string | null
): Promise<Blob> {
	if (!event.id || !event.name) {
		throw new Error('Event missing ID or name');
	}

	// Same dimensions as monster cards: 600x400
	const width = 600;
	const height = 400;

	// Create canvas
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not get canvas context');
	}

	const accentColor = '#3b82f6'; // blue for events
	const cardBgColor = '#0c0b13';
	const textColor = '#f8fafc';
	const secondaryTextColor = '#93c5fd';

	// Draw card background
	ctx.fillStyle = cardBgColor;
	roundRect(ctx, 0, 0, width, height, 12);
	ctx.fill();

	// Render art (full background, grayscale, zoomed 130%)
	if (artUrl) {
		try {
			const artImg = new Image();
			artImg.crossOrigin = 'anonymous';
			await new Promise((resolve, reject) => {
				artImg.onload = resolve;
				artImg.onerror = reject;
				artImg.src = artUrl;
			});

			ctx.save();
			roundRect(ctx, 0, 0, width, height, 12);
			ctx.clip();
			
			// Apply grayscale
			ctx.filter = 'grayscale(100%)';
			
			// Draw zoomed (130%) and centered
			const scale = 1.3;
			const imgRatio = artImg.width / artImg.height;
			const canvasRatio = width / height;
			
			let drawW, drawH;
			if (imgRatio > canvasRatio) {
				drawH = height * scale;
				drawW = drawH * imgRatio;
			} else {
				drawW = width * scale;
				drawH = drawW / imgRatio;
			}
			
			const drawX = (width - drawW) / 2;
			const drawY = (height - drawH) / 2;
			
			ctx.drawImage(artImg, drawX, drawY, drawW, drawH);
			ctx.filter = 'none';
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load event art:', err);
			ctx.filter = 'none';
		}
	}

	// Draw diagonal overlay (matching CSS clip-path)
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(width * 0.75, 0);
	ctx.lineTo(width * 0.45, height);
	ctx.lineTo(0, height);
	ctx.closePath();
	ctx.clip();
	
	// Gradient overlay
	const gradient = ctx.createLinearGradient(0, 0, width * 0.6, height);
	gradient.addColorStop(0, 'rgba(12, 11, 19, 0.98)');
	gradient.addColorStop(0.5, 'rgba(12, 11, 19, 0.95)');
	gradient.addColorStop(0.7, 'rgba(12, 11, 19, 0.85)');
	gradient.addColorStop(1, 'rgba(12, 11, 19, 0.6)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();

	// Content area
	const padding = 28;
	let yPos = padding;

	// Order badge
	ctx.font = '700 11px "Inter", system-ui';
	const orderText = `#${event.order_num}`;
	const orderWidth = ctx.measureText(orderText).width + 16;
	ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
	roundRect(ctx, padding, yPos, orderWidth, 24, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
	ctx.lineWidth = 1;
	roundRect(ctx, padding, yPos, orderWidth, 24, 6);
	ctx.stroke();
	ctx.fillStyle = secondaryTextColor;
	ctx.fillText(orderText, padding + 8, yPos + 16);
	
	yPos += 40;

	// Title
	ctx.font = '800 32px "Inter", system-ui, -apple-system, sans-serif';
	ctx.fillStyle = textColor;
	ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
	ctx.shadowBlur = 8;
	ctx.shadowOffsetY = 2;
	
	// Word wrap title
	const maxTitleWidth = width * 0.5;
	const titleLines = wrapText(ctx, event.title, maxTitleWidth);
	for (const line of titleLines) {
		ctx.fillText(line, padding, yPos);
		yPos += 38;
	}
	
	ctx.shadowColor = 'transparent';
	ctx.shadowBlur = 0;
	ctx.shadowOffsetY = 0;
	
	yPos += 8;

	// Description
	if (event.description) {
		ctx.font = '400 16px "Inter", system-ui';
		ctx.fillStyle = '#cbd5e1';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetY = 1;
		
		const maxDescWidth = width * 0.48;
		const descLines = wrapText(ctx, event.description, maxDescWidth);
		for (const line of descLines.slice(0, 6)) { // max 6 lines
			ctx.fillText(line, padding, yPos);
			yPos += 24;
		}
		
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
	}

	// Footer
	ctx.font = '600 11px "Inter", system-ui';
	ctx.fillStyle = '#64748b';
	ctx.fillText('ARC SPIRITS // EVENT', padding, height - 20);

	// Accent border on left
	ctx.fillStyle = accentColor;
	ctx.fillRect(0, 0, 4, height);

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

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): void {
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(' ');
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
	return lines;
}

