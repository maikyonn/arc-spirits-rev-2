/**
 * Game logic utilities and central rarity configuration for Arc Spirits.
 */

export type UnitRarityKey = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'unknown';

export type UnitRarityConfig = {
  key: UnitRarityKey;
  label: string;
  costs: number[];
  copies: number;
  cssClass: string;
};

export const UNIT_RARITY_CONFIG: UnitRarityConfig[] = [
  { key: 'common', label: 'Common', costs: [1], copies: 2, cssClass: 'common' },
  { key: 'rare', label: 'Rare', costs: [2, 3], copies: 2, cssClass: 'rare' },
  { key: 'epic', label: 'Epic', costs: [4, 5], copies: 1, cssClass: 'epic' },
  { key: 'legendary', label: 'Legendary', costs: [7], copies: 1, cssClass: 'legendary' },
  { key: 'mythic', label: 'Mythic', costs: [9], copies: 1, cssClass: 'mythic' }
];

const COST_TO_RARITY = new Map<number, UnitRarityConfig>();
for (const rarity of UNIT_RARITY_CONFIG) {
  rarity.costs.forEach((cost) => COST_TO_RARITY.set(cost, rarity));
}

let rarityCopiesOverride: Partial<Record<UnitRarityKey, number>> = {};

export function setRarityCopiesOverride(overrides: Partial<Record<UnitRarityKey, number | null | undefined>>) {
  const cleaned: Partial<Record<UnitRarityKey, number>> = {};
  Object.entries(overrides).forEach(([key, value]) => {
    if (value !== null && value !== undefined && !Number.isNaN(value)) {
      cleaned[key as UnitRarityKey] = Math.max(0, Number(value));
    }
  });
  rarityCopiesOverride = cleaned;
}

export function getRarityCopiesOverride(): Partial<Record<UnitRarityKey, number>> {
  return { ...rarityCopiesOverride };
}

function getRarityConfig(cost: number): UnitRarityConfig | undefined {
  return COST_TO_RARITY.get(cost);
}

/**
 * Get the role trait multiplier for a unit based on cost
 * - 7-cost (Legendary): 2x role count
 * - 9-cost (Mythic): 3x role count
 * - Others: 1x role count
 */
export function getRoleMultiplier(cost: number): number {
  if (cost === 7) return 2;
  if (cost === 9) return 3;
  return 1;
}

/**
 * Get the origin trait multiplier for a unit based on cost
 * - 9-cost (Mythic): 2x origin count
 * - Others: 1x origin count
 */
export function getOriginMultiplier(cost: number): number {
  if (cost === 9) return 2;
  return 1;
}

/**
 * Get the deck multiplier (number of copies in the pool) for a unit based on cost
 */
export function getDeckMultiplier(cost: number): number {
  const config = getRarityConfig(cost);
  if (!config) return 1;
  const override = rarityCopiesOverride[config.key];
  if (override !== undefined) {
    return override;
  }
  return config.copies;
}

/**
 * Get the rarity name for a unit based on cost
 */
export function getCardRarity(cost: number): string {
  return getRarityConfig(cost)?.label ?? 'Unknown';
}

/**
 * Get the rarity CSS class for a unit based on cost
 */
export function getRarityClass(cost: number): string {
  return getRarityConfig(cost)?.cssClass ?? 'common';
}
