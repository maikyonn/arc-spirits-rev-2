import type { UnitRarityKey } from '$lib/utils/gameLogic';

export const DEFAULT_SHOP_SIZE = 8;
export const DEFAULT_DRAWS_PER_PLAYER = 2;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DEFAULT_TOTAL_STAGES = 5;
export const TOTAL_STAGES = DEFAULT_TOTAL_STAGES; // backwards compatibility

export const MONSTER_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;

export type MonsterKey = (typeof MONSTER_ORDER)[number];

export type StagePurchasePlan = Partial<Record<UnitRarityKey, number>>;

export type StagePurchaseConfig = {
  stage: number;
  perPlayer: StagePurchasePlan;
};

export type MonsterDefinition = {
  key: MonsterKey;
  label: string;
  costs: number[];
};

export const MONSTER_DEFINITIONS: MonsterDefinition[] = [
  { key: 'common', label: 'Common Monster', costs: [1] },
  { key: 'rare', label: 'Rare Monster', costs: [2, 3] },
  { key: 'epic', label: 'Epic Monster', costs: [4, 5, 6] },
  { key: 'legendary', label: 'Legendary Monster', costs: [7, 8] },
  { key: 'mythic', label: 'Mythic Monster', costs: [9] }
];

export const DEFAULT_MONSTER_COUNTS: Record<MonsterKey, number> = {
  common: 0,
  rare: 0,
  epic: 1,
  legendary: 2,
  mythic: 2
};

export const DEFAULT_MONSTER_LIMITS: Record<MonsterKey, number> = {
  common: 1,
  rare: 1,
  epic: 1,
  legendary: 1,
  mythic: 1
};

// Rarities eligible for initial setup draws (Stage 0). Players can pull these before monsters act.
export const CHEAP_MONSTER_KEYS = new Set<UnitRarityKey>(['common', 'rare', 'epic']);

export const DEFAULT_STAGE_PURCHASES: StagePurchaseConfig[] = [
  { stage: 1, perPlayer: { common: 2, rare: 2, epic: 1, legendary: 0, mythic: 0 } },
  { stage: 2, perPlayer: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 } },
  { stage: 3, perPlayer: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 } },
  { stage: 4, perPlayer: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 } },
  { stage: 5, perPlayer: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 } }
];

function coerceMonsterMap(
  input: Record<string, number | null | undefined> | null | undefined,
  defaults: Record<MonsterKey, number>
): Record<MonsterKey, number> {
  const result: Record<MonsterKey, number> = { ...defaults };
  if (!input) return result;

  Object.entries(input).forEach(([key, value]) => {
    if (!isMonsterKey(key)) return;
    if (value === -1) {
      result[key] = -1; // -1 represents no limit / unlimited
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = Math.max(0, Math.trunc(value));
    }
  });

  return result;
}

export function normalizeMonsterCounts(
  counts?: Record<string, number | null | undefined> | null
): Record<MonsterKey, number> {
  return coerceMonsterMap(counts, DEFAULT_MONSTER_COUNTS);
}

export function normalizeMonsterTakeLimits(
  limits?: Record<string, number | null | undefined> | null
): Record<MonsterKey, number> {
  return coerceMonsterMap(limits, DEFAULT_MONSTER_LIMITS);
}

export function isMonsterKey(value: string): value is MonsterKey {
  return (MONSTER_ORDER as readonly string[]).includes(value);
}

export function rarityToMonsterKey(rarity: UnitRarityKey): MonsterKey | null {
  if (rarity === 'unknown') return null;
  return isMonsterKey(rarity) ? rarity : null;
}
