<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
import type { OriginRow, RuneRow, HexSpiritRow } from '$lib/types/gameData';
	import { generateRuneIcon } from '$lib/utils/runeIconGenerator';
	import { generateDiceSide } from '$lib/utils/diceSideGenerator';
	import { fetchDiceRecords, type CustomDiceWithSides } from '$lib/features/dice/dice';
	import JSZip from 'jszip';

	type AssetImage = {
		name: string;
		url: string;
		type: 'origin' | 'rune' | 'hex-spirit' | 'dice-face' | 'misc';
		filename: string;
	};

	type MiscAsset = {
		id: string;
		name: string;
		description: string | null;
		file_path: string;
		file_type: string | null;
		file_size: number | null;
		category: string | null;
		created_at: string;
		url: string;
	};

	let origins: OriginRow[] = [];
	let runes: RuneRow[] = [];
	let hexSpirits: HexSpiritRow[] = [];
	let dice: CustomDiceWithSides[] = [];
let miscAssets: MiscAsset[] = [];
	let loading = true;
	let error: string | null = null;
	let exporting = false;
	let exportingDiceFaces = false;

	const gameAssetsStorage = supabase.storage.from('game_assets');

	let originImages: AssetImage[] = [];
	let runeImages: AssetImage[] = [];
	let hexSpiritImages: AssetImage[] = [];
	let diceFaceImages: AssetImage[] = [];
let miscAssetImages: AssetImage[] = [];
	let runeBackgroundUrl: string | null = null;

	// Upload form state
	let showUploadForm = false;
	let editingAsset: MiscAsset | null = null;
	let uploading = false;
	let uploadFormData = {
		name: '',
		description: '',
		category: '',
		file: null as File | null
	};
	let uploadInput: HTMLInputElement | null = null;
	let deletingId: string | null = null;

	onMount(async () => {
		await Promise.all([loadOrigins(), loadRunes(), loadHexSpirits(), loadDice(), loadMiscAssets(), loadRuneBackground()]);
		await loadAssets();
	});

	async function loadOrigins() {
		const { data, error: fetchError } = await supabase
			.from('origins')
			.select('*')
			.order('position', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		origins = data ?? [];
	}

	async function loadRunes() {
		const { data, error: fetchError } = await supabase
			.from('runes')
			.select('*')
			.order('name', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		runes = data ?? [];
	}

	async function loadHexSpirits() {
		const { data, error: fetchError } = await supabase
			.from('hex_spirits')
			.select('*')
			.order('name', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		hexSpirits = data ?? [];
	}

	async function loadDice() {
		try {
			dice = await fetchDiceRecords();
		} catch (err) {
			console.warn('Failed to load dice:', err);
			dice = [];
		}
	}

async function loadMiscAssets() {
		const { data, error: fetchError } = await supabase
			.from('misc_assets')
			.select('*')
			.order('created_at', { ascending: false });
		if (fetchError) {
			console.warn('Failed to load misc assets:', fetchError);
			miscAssets = [];
			return;
		}
		miscAssets = (data ?? []).map(asset => {
			// Ensure id is preserved
			if (!asset.id) {
				console.warn('Asset missing ID:', asset);
			}
			return {
				...asset,
				id: asset.id, // Explicitly preserve id
				url: getMiscAssetUrl(asset.file_path)
			};
		});
	}

function getMiscAssetUrl(path: string): string {
	const fullPath = path.startsWith('misc_assets/') ? path : `misc_assets/${path}`;
	const { data } = gameAssetsStorage.getPublicUrl(fullPath);
	return data?.publicUrl ?? '';
}

	function getOriginIconUrl(icon: string | null | undefined): string | null {
		if (!icon) return null;
		if (icon.includes('/')) {
			const fullPath = icon.startsWith('origin_icons/') ? icon : `origin_icons/${icon}`;
			const { data } = gameAssetsStorage.getPublicUrl(fullPath);
			return data?.publicUrl ?? null;
		}
		return null;
	}

	function getHexSpiritImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		const fullPath = path.startsWith('hex_spirits/') ? path : `hex_spirits/${path}`;
		const { data } = gameAssetsStorage.getPublicUrl(fullPath);
		return data?.publicUrl ?? null;
	}

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50);
	}

	async function loadRuneBackground() {
		try {
			const { data } = gameAssetsStorage.getPublicUrl('rune_backgrounds/background.png');
			if (data?.publicUrl) {
				const response = await fetch(data.publicUrl, { method: 'HEAD' });
				if (response.ok) {
					runeBackgroundUrl = data.publicUrl;
				}
			}
		} catch (err) {
			console.warn('Failed to load rune background:', err);
		}
	}

	async function loadAssets() {
	loading = true;
	originImages = [];
	runeImages = [];
	hexSpiritImages = [];
	diceFaceImages = [];
	miscAssetImages = [];

		// Load origin icons
		for (const origin of origins) {
			const iconUrl = getOriginIconUrl(origin.icon_png);
			if (iconUrl) {
				originImages.push({
					name: origin.name,
					url: iconUrl,
					type: 'origin',
					filename: `origins/${sanitizeFileName(origin.name)}_icon.png`
				});
			}
		}

		// Generate rune icons
		for (const rune of runes) {
			const origin = origins.find((o) => o.id === rune.origin_id);
			if (!origin) continue;

			const originIconUrl = getOriginIconUrl(origin.icon_png);
			const originIconEmoji = originIconUrl ? null : (origin.icon_png || null);

			try {
				const runeIconUrl = await generateRuneIcon({
					originIconUrl,
					originIconEmoji,
					backgroundUrl: runeBackgroundUrl,
					size: 800
				});
				runeImages.push({
					name: rune.name,
					url: runeIconUrl,
					type: 'rune',
					filename: `runes/${sanitizeFileName(rune.name)}_icon.png`
				});
			} catch (err) {
				console.warn(`Failed to generate icon for rune ${rune.name}:`, err);
			}
		}

		// Load hex spirit images
		for (const spirit of hexSpirits) {
			const gamePrintUrl = getHexSpiritImageUrl(spirit.game_print_image_path);
			if (gamePrintUrl) {
				hexSpiritImages.push({
					name: `${spirit.name} (Game Print)`,
					url: gamePrintUrl,
					type: 'hex-spirit',
					filename: `hex_spirits/${sanitizeFileName(spirit.name)}_game_print.png`
				});
			}

			const artRawUrl = getHexSpiritImageUrl(spirit.art_raw_image_path);
			if (artRawUrl) {
				hexSpiritImages.push({
					name: `${spirit.name} (Art Raw)`,
					url: artRawUrl,
					type: 'hex-spirit',
					filename: `hex_spirits/${sanitizeFileName(spirit.name)}_art_raw.png`
				});
			}
		}

		// Generate dice face images
		for (const diceItem of dice) {
			if (!diceItem.background_image_path) continue;

			try {
				// Get background URL
				const path = diceItem.background_image_path.startsWith('dice_backgrounds/')
					? diceItem.background_image_path
					: `dice_backgrounds/${diceItem.background_image_path}`;
				const { data } = gameAssetsStorage.getPublicUrl(path);
				if (!data?.publicUrl) continue;

				// Generate faces for each side
				for (const side of diceItem.dice_sides) {
					// For attack dice, use the numeric value; for special dice, use the text
					const text = diceItem.dice_type === 'attack' 
						? side.reward_value 
						: (side.reward_value || String(side.side_number));

					try {
						const diceFaceUrl = await generateDiceSide({
							backgroundUrl: data.publicUrl,
							text: text,
							size: 800
						});
						diceFaceImages.push({
							name: `${diceItem.name} - Side ${side.side_number}`,
							url: diceFaceUrl,
							type: 'dice-face',
							filename: `dice_faces/${sanitizeFileName(diceItem.name)}_side_${side.side_number}.png`
						});
					} catch (err) {
						console.warn(`Failed to generate dice face for ${diceItem.name} side ${side.side_number}:`, err);
					}
				}
			} catch (err) {
				console.warn(`Failed to load background for dice ${diceItem.name}:`, err);
			}
		}

		// Load misc assets
		for (const asset of miscAssets) {
			if (asset.url && asset.file_type?.startsWith('image/')) {
				miscAssetImages.push({
					name: asset.name,
					url: asset.url,
					type: 'misc',
					filename: asset.file_path
				});
			}
		}

		loading = false;
	}

	async function exportAllDiceFaces() {
		if (exportingDiceFaces) return;
		exportingDiceFaces = true;
		error = null;

		try {
			let successCount = 0;
			let errorCount = 0;

			for (const diceItem of dice) {
				if (!diceItem.background_image_path) continue;

				try {
					// Get background URL
					const path = diceItem.background_image_path.startsWith('dice_backgrounds/')
						? diceItem.background_image_path
						: `dice_backgrounds/${diceItem.background_image_path}`;
					const { data } = gameAssetsStorage.getPublicUrl(path);
					if (!data?.publicUrl) continue;

					// Generate and upload faces for each side
					for (const side of diceItem.dice_sides) {
						try {
							// For attack dice, use the numeric value; for special dice, use the text
							const text = diceItem.dice_type === 'attack' 
								? side.reward_value 
								: (side.reward_value || String(side.side_number));

							// Generate dice face image
							const diceFaceDataUrl = await generateDiceSide({
								backgroundUrl: data.publicUrl,
								text: text,
								size: 800
							});

							// Convert data URL to blob
							const response = await fetch(diceFaceDataUrl);
							const blob = await response.blob();

							// Create file path
							const sanitizedName = sanitizeFileName(diceItem.name);
							const fileName = `dice_faces/${sanitizedName}_side_${side.side_number}.png`;
							const fullPath = fileName;

							// Upload to storage
							const { error: uploadError } = await gameAssetsStorage.upload(fullPath, blob, {
								cacheControl: '3600',
								upsert: true,
								contentType: 'image/png'
							});

							if (uploadError) {
								console.error(`Failed to upload dice face for ${diceItem.name} side ${side.side_number}:`, uploadError);
								errorCount++;
							} else {
								// Update database with image path
								const { error: updateError } = await supabase
									.from('dice_sides')
									.update({ image_path: fullPath })
									.eq('id', side.id);

								if (updateError) {
									console.error(`Failed to update dice side ${side.id}:`, updateError);
									errorCount++;
								} else {
									successCount++;
								}
							}
						} catch (err) {
							console.error(`Error exporting dice face for ${diceItem.name} side ${side.side_number}:`, err);
							errorCount++;
						}
					}
				} catch (err) {
					console.error(`Error processing dice ${diceItem.name}:`, err);
					errorCount++;
				}
			}

			if (errorCount > 0) {
				error = `Exported ${successCount} dice faces, ${errorCount} errors occurred.`;
			} else {
				error = null;
				alert(`Successfully exported ${successCount} dice faces!`);
			}

			// Reload dice to get updated image paths
			await loadDice();
			await loadAssets();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to export dice faces';
			console.error('Error exporting dice faces:', err);
		} finally {
			exportingDiceFaces = false;
		}
	}

	async function fetchImageAsBlob(url: string): Promise<Blob | null> {
		try {
			// Handle data URLs (for rune icons)
			if (url.startsWith('data:')) {
				const response = await fetch(url);
				return await response.blob();
			}
			// Handle regular URLs
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.statusText}`);
			}
			return await response.blob();
		} catch (err) {
			console.error('Error fetching image:', err);
			return null;
		}
	}

	async function addPaddingToImage(blob: Blob, padding: number = 200): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					return reject(new Error('Could not get canvas context'));
				}

				// New canvas size: original size + padding on all sides
				canvas.width = img.width + padding * 2;
				canvas.height = img.height + padding * 2;

				// Fill with transparent background (or white if you prefer)
				ctx.fillStyle = 'transparent';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Draw the original image centered with padding
				ctx.drawImage(img, padding, padding, img.width, img.height);

				// Convert to blob
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				}, blob.type || 'image/png');
			};
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = URL.createObjectURL(blob);
		});
	}

	async function resizeAndAddPadding(blob: Blob, targetSize: number = 800, padding: number = 175): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					return reject(new Error('Could not get canvas context'));
				}

				// New canvas size: target size + padding on all sides
				canvas.width = targetSize + padding * 2;
				canvas.height = targetSize + padding * 2;

				// Fill with transparent background
				ctx.fillStyle = 'transparent';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Draw the image resized to exactly targetSize x targetSize (may stretch if not square)
				ctx.drawImage(img, padding, padding, targetSize, targetSize);

				// Convert to blob
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				}, blob.type || 'image/png');
			};
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = URL.createObjectURL(blob);
		});
	}

	function openUploadForm(asset?: MiscAsset) {
		// Check if asset is actually a MiscAsset (has required properties)
		if (asset && typeof asset === 'object' && 'id' in asset && 'name' in asset) {
			// Ensure we have a valid asset with an ID
			if (!asset.id) {
				console.error('Asset missing ID:', asset);
				alert('Error: Asset is missing an ID. Please refresh the page.');
				return;
			}
			editingAsset = { ...asset }; // Create a copy to avoid reference issues
			uploadFormData = {
				name: asset.name,
				description: asset.description || '',
				category: asset.category || '',
				file: null
			};
		} else {
			// No asset provided, creating new one
			editingAsset = null;
			uploadFormData = {
				name: '',
				description: '',
				category: '',
				file: null
			};
		}
		showUploadForm = true;
	}

	function closeUploadForm() {
		showUploadForm = false;
		editingAsset = null;
		uploadFormData = {
			name: '',
			description: '',
			category: '',
			file: null
		};
		if (uploadInput) {
			uploadInput.value = '';
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			uploadFormData.file = file;
			if (!uploadFormData.name) {
				uploadFormData.name = file.name.replace(/\.[^/.]+$/, '');
			}
		}
	}

	async function handleUpload() {
		if (!uploadFormData.name?.trim()) {
			alert('Please provide a name.');
			return;
		}

		// Validate editingAsset has an ID if we're editing
		if (editingAsset && !editingAsset.id) {
			alert('Error: Asset ID is missing. Please try refreshing the page.');
			console.error('editingAsset:', editingAsset);
			return;
		}

		// If editing and no new file selected, just update metadata
		if (editingAsset && editingAsset.id && !uploadFormData.file) {
			uploading = true;
			try {
				const { error: dbError } = await supabase
					.from('misc_assets')
					.update({
						name: uploadFormData.name?.trim() || '',
						description: uploadFormData.description?.trim() || null,
						category: uploadFormData.category?.trim() || null,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingAsset.id);

				if (dbError) {
					throw dbError;
				}

				await loadMiscAssets();
				await loadAssets();
				closeUploadForm();
			} catch (err) {
				console.error('Error updating asset:', err);
				alert(`Failed to update asset: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				uploading = false;
			}
			return;
		}

		// If no file selected for new upload, show error
		if (!uploadFormData.file) {
			alert('Please select a file.');
			return;
		}

		if (uploadFormData.file.size > 50 * 1024 * 1024) {
			alert('File must be smaller than 50MB.');
			return;
		}

		uploading = true;
		try {
			const extension = uploadFormData.file.name.split('.').pop()?.toLowerCase() ?? 'bin';
			const sanitizedName = sanitizeFileName(uploadFormData.name);
			const timestamp = Date.now();
			const fileName = `${sanitizedName}_${timestamp}.${extension}`;
			const categoryFolder = uploadFormData.category ? `${uploadFormData.category}/` : '';
			const fullPath = `misc_assets/${categoryFolder}${fileName}`;

			// If editing, remove old file first
			if (editingAsset) {
				const { error: removeError } = await gameAssetsStorage.remove([editingAsset.file_path]);
				if (removeError) {
					console.warn('Failed to remove old file:', removeError);
				}
			}

			// Upload file
			const { error: uploadError } = await gameAssetsStorage.upload(fullPath, uploadFormData.file, {
				cacheControl: '3600',
				upsert: false,
				contentType: uploadFormData.file.type
			});

			if (uploadError) {
				throw uploadError;
			}

			// Save to database
			if (editingAsset && editingAsset.id) {
				// Update existing asset
				const { error: dbError } = await supabase
					.from('misc_assets')
					.update({
						name: uploadFormData.name?.trim() || '',
						description: uploadFormData.description?.trim() || null,
						file_path: fullPath,
						file_type: uploadFormData.file.type,
						file_size: uploadFormData.file.size,
						category: uploadFormData.category?.trim() || null,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingAsset.id);

				if (dbError) {
					throw dbError;
				}
			} else if (editingAsset && !editingAsset.id) {
				throw new Error('Cannot update asset: missing ID. Please refresh the page and try again.');
			} else {
				// Insert new asset
				const { error: dbError } = await supabase
					.from('misc_assets')
					.insert({
						name: uploadFormData.name?.trim() || '',
						description: uploadFormData.description?.trim() || null,
						file_path: fullPath,
						file_type: uploadFormData.file.type,
						file_size: uploadFormData.file.size,
						category: uploadFormData.category?.trim() || null
					});

				if (dbError) {
					throw dbError;
				}
			}

			await loadMiscAssets();
			await loadAssets();
			closeUploadForm();
		} catch (err) {
			console.error('Error uploading file:', err);
			alert(`Failed to ${editingAsset ? 'update' : 'upload'} file: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			uploading = false;
		}
	}

	async function deleteMiscAsset(asset: MiscAsset) {
		if (!confirm(`Delete "${asset.name}"?`)) {
			return;
		}

		deletingId = asset.id;
		try {
			// Delete from storage
			const { error: storageError } = await gameAssetsStorage.remove([asset.file_path]);
			if (storageError) {
				console.warn('Failed to delete file from storage:', storageError);
			}

			// Delete from database
			const { error: dbError } = await supabase
				.from('misc_assets')
				.delete()
				.eq('id', asset.id);

			if (dbError) {
				throw dbError;
			}

			await loadMiscAssets();
			await loadAssets();
		} catch (err) {
			console.error('Error deleting asset:', err);
			alert(`Failed to delete asset: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			deletingId = null;
		}
	}

	async function exportAssets() {
		if (originImages.length === 0 && runeImages.length === 0 && hexSpiritImages.length === 0 && diceFaceImages.length === 0 && miscAssetImages.length === 0) {
			alert('No assets to export.');
			return;
		}

		exporting = true;
		try {
			const zip = new JSZip();

			// Add origin icons
			if (originImages.length > 0) {
				const originsFolder = zip.folder('origins');
				for (const asset of originImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						originsFolder?.file(
							`${sanitizeFileName(asset.name)}_icon.png`,
							paddedBlob
						);
					}
				}
			}

			// Add rune icons
			if (runeImages.length > 0) {
				const runesFolder = zip.folder('runes');
				for (const asset of runeImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						runesFolder?.file(
							`${sanitizeFileName(asset.name)}_icon.png`,
							paddedBlob
						);
					}
				}
			}

			// Add hex spirit images
			if (hexSpiritImages.length > 0) {
				const hexSpiritsFolder = zip.folder('hex_spirits');
				for (const asset of hexSpiritImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						hexSpiritsFolder?.file(
							`${sanitizeFileName(asset.name)}.png`,
							paddedBlob
						);
					}
				}
			}

			// Add dice face images
			if (diceFaceImages.length > 0) {
				const diceFacesFolder = zip.folder('dice_faces');
				for (const asset of diceFaceImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						const filename = asset.filename.replace('dice_faces/', '');
						diceFacesFolder?.file(filename, paddedBlob);
					}
				}
			}

			// Add misc assets
			if (miscAssetImages.length > 0) {
				const miscFolder = zip.folder('misc_assets');
				for (const asset of miscAssetImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const filename = asset.filename.replace('misc_assets/', '');
						miscFolder?.file(filename, blob);
					}
				}
			}

			// Generate ZIP file
			const zipBlob = await zip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: {
					level: 9
				}
			});

			// Download ZIP
			const timestamp = new Date().toISOString().split('T')[0];
			const filename = `arc-spirits-assets_${timestamp}.zip`;
			const url = URL.createObjectURL(zipBlob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Error exporting assets:', err);
			alert(`Failed to export assets: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			exporting = false;
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Assets</h1>
			<p>View and export all game assets</p>
		</div>
		<div class="actions">
			<button class="btn btn--secondary" onclick={() => openUploadForm()}>
				📤 Upload Misc Asset
			</button>
			<button class="btn btn--primary" onclick={exportAssets} disabled={exporting || loading}>
				{exporting ? 'Exporting...' : '📦 Export All as ZIP'}
			</button>
		</div>
	</header>

	{#if loading}
		<div class="card">Loading assets…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="assets-sections">
			<section class="asset-section">
				<h2>Origin Icons ({originImages.length})</h2>
				<div class="asset-grid">
					{#each originImages as asset}
						<div class="asset-item">
							<img src={asset.url} alt={asset.name} />
							<span class="asset-name">{asset.name}</span>
						</div>
					{:else}
						<p class="empty-message">No origin icons found</p>
					{/each}
				</div>
			</section>

			<section class="asset-section">
				<h2>Rune Icons ({runeImages.length})</h2>
				<div class="asset-grid">
					{#each runeImages as asset}
						<div class="asset-item">
							<img src={asset.url} alt={asset.name} />
							<span class="asset-name">{asset.name}</span>
						</div>
					{:else}
						<p class="empty-message">No rune icons found</p>
					{/each}
				</div>
			</section>

			<section class="asset-section">
				<h2>Hex Spirit Images ({hexSpiritImages.length})</h2>
				<div class="asset-grid">
					{#each hexSpiritImages as asset}
						<div class="asset-item">
							<img src={asset.url} alt={asset.name} />
							<span class="asset-name">{asset.name}</span>
						</div>
					{:else}
						<p class="empty-message">No hex spirit images found</p>
					{/each}
				</div>
			</section>

			<section class="asset-section">
				<h2>Dice Faces ({diceFaceImages.length})</h2>
				<div class="asset-grid">
					{#each diceFaceImages as asset}
						<div class="asset-item">
							<img src={asset.url} alt={asset.name} />
							<span class="asset-name">{asset.name}</span>
						</div>
					{:else}
						<p class="empty-message">No dice faces found</p>
					{/each}
				</div>
			</section>

			<section class="asset-section">
				<h2>Misc Assets ({miscAssets.length})</h2>
				<div class="asset-grid">
					{#each miscAssets as asset}
						<div class="asset-item misc-asset-item">
							{#if asset.file_type?.startsWith('image/')}
								<img src={asset.url} alt={asset.name} />
							{:else}
								<div class="file-icon">📄</div>
							{/if}
							<span class="asset-name">{asset.name}</span>
							{#if asset.category}
								<span class="asset-category">{asset.category}</span>
							{/if}
							<div class="asset-actions">
								<button 
									class="btn-edit" 
									onclick={() => openUploadForm(asset)}
									title="Edit"
								>
									✏️
								</button>
								<button 
									class="btn-delete" 
									onclick={() => deleteMiscAsset(asset)}
									disabled={deletingId === asset.id}
									title="Delete"
								>
									{deletingId === asset.id ? '...' : '🗑️'}
								</button>
							</div>
						</div>
					{:else}
						<p class="empty-message">No misc assets found</p>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</section>


{#if showUploadForm}
	<div class="modal-layer">
		<button
			type="button"
			class="modal-overlay"
			aria-label="Close asset uploader"
			onclick={closeUploadForm}
		></button>
		<div class="modal">
			<div class="modal-header">
				<h2>{editingAsset ? 'Edit Misc Asset' : 'Upload Misc Asset'}</h2>
				<button class="btn-close" onclick={closeUploadForm}>×</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label for="upload-name">Name *</label>
					<input
						id="upload-name"
						type="text"
						bind:value={uploadFormData.name}
						placeholder="Asset name"
						disabled={uploading}
					/>
				</div>
				<div class="form-group">
					<label for="upload-category">Category (optional)</label>
					<input
						id="upload-category"
						type="text"
						bind:value={uploadFormData.category}
						placeholder="e.g., game-boards, tokens, etc."
						disabled={uploading}
					/>
				</div>
				<div class="form-group">
					<label for="upload-description">Description (optional)</label>
					<textarea
						id="upload-description"
						bind:value={uploadFormData.description}
						placeholder="Asset description"
						disabled={uploading}
						rows="3"
					></textarea>
				</div>
				<div class="form-group">
					<label for="upload-file">File {editingAsset ? '(optional - leave empty to keep current file)' : '*'}</label>
					<input
						id="upload-file"
						bind:this={uploadInput}
						type="file"
						onchange={handleFileSelect}
						disabled={uploading}
					/>
					{#if uploadFormData.file}
						<p class="file-info">
							Selected: {uploadFormData.file.name} ({(uploadFormData.file.size / 1024 / 1024).toFixed(2)} MB)
						</p>
					{:else if editingAsset && editingAsset.file_path}
						<p class="file-info">
							Current: {editingAsset.file_path.split('/').pop()} 
							{#if editingAsset.file_size}
								({(editingAsset.file_size / 1024 / 1024).toFixed(2)} MB)
							{/if}
						</p>
					{/if}
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn--secondary" onclick={closeUploadForm} disabled={uploading}>
					Cancel
				</button>
				<button class="btn btn--primary" onclick={handleUpload} disabled={uploading || (!editingAsset && !uploadFormData.file) || !uploadFormData.name?.trim()}>
					{uploading ? (editingAsset ? 'Updating...' : 'Uploading...') : (editingAsset ? 'Update' : 'Upload')}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.assets-sections {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.asset-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.asset-section h2 {
		margin: 0 0 1rem 0;
		color: #f8fafc;
		font-size: 1.2rem;
	}

	.asset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 1rem;
	}

	.asset-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.asset-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
	}

	.asset-item img {
		width: 64px;
		height: 64px;
		object-fit: contain;
		image-rendering: crisp-edges;
	}

	.asset-name {
		font-size: 0.85rem;
		color: #cbd5f5;
		text-align: center;
		word-break: break-word;
		max-width: 100%;
	}

	.empty-message {
		color: #94a3b8;
		font-style: italic;
		margin: 1rem 0;
	}

	.btn--primary {
		background: linear-gradient(135deg, #4f46e5, #7c3aed);
		border: none;
		color: #f8fafc;
		font-weight: 600;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn--secondary {
		background: rgba(148, 163, 184, 0.1);
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: #cbd5f5;
		margin-right: 0.5rem;
	}

	.btn--secondary:hover {
		background: rgba(148, 163, 184, 0.2);
	}

	.misc-asset-item {
		position: relative;
	}

	.asset-category {
		font-size: 0.75rem;
		color: #94a3b8;
		margin-top: 0.25rem;
	}

	.file-icon {
		font-size: 2rem;
		width: 64px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.asset-actions {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		display: flex;
		gap: 0.25rem;
	}

	.btn-edit,
	.btn-delete {
		background: rgba(148, 163, 184, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.4);
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		color: #cbd5f5;
		transition: all 0.15s ease;
	}

	.btn-edit:hover {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.6);
		color: #a5b4fc;
	}

	.btn-delete {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.4);
		color: #fca5a5;
	}

	.btn-delete:hover {
		background: rgba(239, 68, 68, 0.3);
		border-color: rgba(239, 68, 68, 0.6);
	}

	.btn-edit:disabled,
	.btn-delete:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-layer {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}

	.modal {
		position: relative;
		z-index: 1;
		background: rgba(15, 23, 42, 0.95);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.modal-header h2 {
		margin: 0;
		color: #f8fafc;
		font-size: 1.25rem;
	}

	.btn-close {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.btn-close:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #cbd5f5;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-footer {
		padding: 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		color: #cbd5f5;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.875rem;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.form-group input:disabled,
	.form-group textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.file-info {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #94a3b8;
	}
</style>
