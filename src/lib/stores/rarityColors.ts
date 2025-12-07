import { writable } from 'svelte/store';

export type Rarity = 'Rare' | 'Epic' | 'Legendary';

export interface RarityColors {
	Rare: string;
	Epic: string;
	Legendary: string;
}

const defaultColors: RarityColors = {
	Rare: '#60a5fa', // Blue
	Epic: '#a78bfa', // Purple
	Legendary: '#fbbf24' // Gold
};

function getStoredColors(): RarityColors {
	if (typeof window === 'undefined') return defaultColors;
	
	try {
		const stored = localStorage.getItem('rarity-colors');
		if (stored) {
			const parsed = JSON.parse(stored);
			// Validate that all required keys exist
			if (parsed.Rare && parsed.Epic && parsed.Legendary) {
				return parsed;
			}
		}
	} catch (e) {
		console.warn('Failed to load rarity colors from localStorage:', e);
	}
	
	return defaultColors;
}

function createRarityColorsStore() {
	const { subscribe, set, update } = writable<RarityColors>(getStoredColors());

	return {
		subscribe,
		set: (colors: RarityColors) => {
			set(colors);
			if (typeof window !== 'undefined') {
				try {
					localStorage.setItem('rarity-colors', JSON.stringify(colors));
				} catch (e) {
					console.warn('Failed to save rarity colors to localStorage:', e);
				}
			}
		},
		update: (updater: (colors: RarityColors) => RarityColors) => {
			update((colors) => {
				const updated = updater(colors);
				if (typeof window !== 'undefined') {
					try {
						localStorage.setItem('rarity-colors', JSON.stringify(updated));
					} catch (e) {
						console.warn('Failed to save rarity colors to localStorage:', e);
					}
				}
				return updated;
			});
		},
		reset: () => {
			set(defaultColors);
			if (typeof window !== 'undefined') {
				try {
					localStorage.setItem('rarity-colors', JSON.stringify(defaultColors));
				} catch (e) {
					console.warn('Failed to save rarity colors to localStorage:', e);
				}
			}
		}
	};
}

export const rarityColors = createRarityColorsStore();

