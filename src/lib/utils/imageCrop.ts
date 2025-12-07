/**
 * Crops empty space (transparent or white) from an image
 * @param file The image file to crop
 * @returns A Promise that resolves to a cropped Blob
 */
export async function cropEmptySpace(file: File): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Could not get canvas context'));
					return;
				}

				// Create a temporary canvas to analyze pixels
				const tempCanvas = document.createElement('canvas');
				tempCanvas.width = img.width;
				tempCanvas.height = img.height;
				const tempCtx = tempCanvas.getContext('2d');
				if (!tempCtx) {
					reject(new Error('Could not get temp canvas context'));
					return;
				}

				tempCtx.drawImage(img, 0, 0);
				const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
				const data = imageData.data;

				// Find bounding box of non-empty pixels
				let minX = img.width;
				let minY = img.height;
				let maxX = 0;
				let maxY = 0;

				for (let y = 0; y < img.height; y++) {
					for (let x = 0; x < img.width; x++) {
						const idx = (y * img.width + x) * 4;
						const r = data[idx];
						const g = data[idx + 1];
						const b = data[idx + 2];
						const a = data[idx + 3];

						// Check if pixel is not empty (not transparent and not white)
						const isTransparent = a < 10; // Almost transparent
						const isWhite = r > 245 && g > 245 && b > 245 && a > 245; // Almost white

						if (!isTransparent && !isWhite) {
							minX = Math.min(minX, x);
							minY = Math.min(minY, y);
							maxX = Math.max(maxX, x);
							maxY = Math.max(maxY, y);
						}
					}
				}

				// If no content found, return original image
				if (minX >= maxX || minY >= maxY) {
					file.arrayBuffer().then((buffer) => resolve(new Blob([buffer], { type: file.type })));
					return;
				}

				// Add a small padding (1px) to avoid edge clipping
				const padding = 1;
				minX = Math.max(0, minX - padding);
				minY = Math.max(0, minY - padding);
				maxX = Math.min(img.width, maxX + padding + 1);
				maxY = Math.min(img.height, maxY + padding + 1);

				const width = maxX - minX;
				const height = maxY - minY;

				// Create cropped canvas
				canvas.width = width;
				canvas.height = height;
				ctx.drawImage(img, minX, minY, width, height, 0, 0, width, height);

				// Convert to blob
				canvas.toBlob(
					(blob) => {
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('Failed to create blob from canvas'));
						}
					},
					file.type || 'image/png',
					0.95 // Quality for JPEG, ignored for PNG
				);
			} catch (err) {
				reject(err);
			}
		};

		img.onerror = () => {
			reject(new Error('Failed to load image'));
		};

		// Load image from file
		const reader = new FileReader();
		reader.onload = (e) => {
			if (e.target?.result) {
				img.src = e.target.result as string;
			}
		};
		reader.onerror = () => {
			reject(new Error('Failed to read file'));
		};
		reader.readAsDataURL(file);
	});
}

