import type { UnitRarityKey } from '$lib/utils/gameLogic';
import {
  CHEAP_MONSTER_KEYS,
  DEFAULT_MONSTER_LIMITS,
  DEFAULT_STAGE_PURCHASES,
  DEFAULT_TOTAL_STAGES,
  MONSTER_DEFINITIONS,
  MONSTER_ORDER,
  type MonsterKey,
  type StagePurchaseConfig,
  type StagePurchasePlan
} from '$lib/utils/shop-config';

export type RngFn = () => number;

export interface StageExpectedCounts {
  stage: number;
  counts: Record<UnitRarityKey, number>;
  playerCounts: Record<UnitRarityKey, number>;
  monsterCounts: Record<UnitRarityKey, number>;
  poolCounts: Record<UnitRarityKey, number>;
  poolRemaining: number;
}

export interface StageSimulationParams {
  copiesByKey: Map<UnitRarityKey, number>;
  players: number;
  shopSize: number;
  drawsPerPlayer: number;
  monsterCounts: Record<MonsterKey, number>;
  monsterLimits: Record<MonsterKey, number>;
  stagePlans?: StagePurchaseConfig[];
  iterations: number;
  rng?: RngFn;
  purchaseSuccessRate?: number;
  totalStages?: number;
}

export interface StageSimulationResult {
  totalCopies: number;
  remainingCopiesAfterSetup: number;
  drawsConsumed: number;
  drawsShortfall: number;
  monsterConfig: Record<MonsterKey, number>;
  monsterLimitConfig: Record<MonsterKey, number>;
  stageSnapshots: StageExpectedCounts[];
  iterations: number;
}

const ALL_RARITIES: UnitRarityKey[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'unknown'];
export const DEFAULT_PURCHASE_SUCCESS_RATE = 0.5;

function createEmptyCounts(): Record<UnitRarityKey, number> {
  return ALL_RARITIES.reduce<Record<UnitRarityKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<UnitRarityKey, number>);
}

function buildPoolTemplate(copiesByKey: Map<UnitRarityKey, number>): UnitRarityKey[] {
  const pool: UnitRarityKey[] = [];
  copiesByKey.forEach((count, key) => {
    for (let i = 0; i < count; i += 1) {
      pool.push(key);
    }
  });
  return pool;
}

function drawFromPool(
  pool: UnitRarityKey[],
  allowed?: Set<UnitRarityKey>,
  fallbackToAny = true,
  rng: RngFn = Math.random
): UnitRarityKey | null {
  if (pool.length === 0) return null;

  const eligibleIndices: number[] = [];
  if (allowed) {
    for (let i = 0; i < pool.length; i += 1) {
      if (allowed.has(pool[i])) {
        eligibleIndices.push(i);
      }
    }
  }

  let index: number | null = null;
  if (eligibleIndices.length > 0) {
    index = eligibleIndices[Math.floor(rng() * eligibleIndices.length)];
  } else if (fallbackToAny) {
    index = Math.floor(rng() * pool.length);
  } else {
    return null;
  }

  const [rarity] = pool.splice(index, 1);
  return rarity;
}

function fillShop(
  shop: Array<UnitRarityKey | null>,
  pool: UnitRarityKey[],
  slots: number[] | null,
  rng: RngFn
) {
  const targets =
    slots ??
    shop.map((card, index) => (card === null ? index : -1)).filter((slot) => slot !== -1);

  for (const slot of targets) {
    const drawn = drawFromPool(pool, undefined, true, rng);
    if (!drawn) break;
    shop[slot] = drawn;
  }
}

type MonsterUsageTracker = Record<MonsterKey, number[]>;

function ensureMonsterUsageArray(
  usage: MonsterUsageTracker,
  key: MonsterKey,
  count: number
): number[] {
  const existing = usage[key] ?? [];
  if (existing.length < count) {
    existing.push(...Array(count - existing.length).fill(0));
  } else if (existing.length > count) {
    existing.length = count;
  }
  usage[key] = existing;
  return existing;
}

function createMonsterUsage(monsterCounts: Record<MonsterKey, number>): MonsterUsageTracker {
  const usage: MonsterUsageTracker = {
    common: [],
    rare: [],
    epic: [],
    legendary: [],
    mythic: []
  };
  MONSTER_ORDER.forEach((key) => {
    const count = Math.max(0, monsterCounts[key] ?? 0);
    usage[key] = Array(count).fill(0);
  });
  return usage;
}

function runMonsterPhase(
  shop: Array<UnitRarityKey | null>,
  pool: UnitRarityKey[],
  monsterCounts: Record<MonsterKey, number>,
  monsterLimits: Record<MonsterKey, number>,
  monsterUsage: MonsterUsageTracker,
  rng: RngFn
): Record<MonsterKey, number> {
  const removals: Record<MonsterKey, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0
  };
  for (const monster of MONSTER_DEFINITIONS) {
    const count = Math.max(0, monsterCounts[monster.key] ?? 0);
    const rawLimit = monsterLimits[monster.key];
    const limit =
      rawLimit === -1
        ? Number.POSITIVE_INFINITY
        : Math.max(0, rawLimit ?? DEFAULT_MONSTER_LIMITS[monster.key] ?? 0);
    const usageForRarity = ensureMonsterUsageArray(monsterUsage, monster.key, count);

    const targetRarity = monster.key;

    for (let occurrence = 0; occurrence < count; occurrence += 1) {
      if (limit === 0) continue;

      let takenByMonster = usageForRarity[occurrence] ?? 0;
      let remainingAllowance = Math.max(0, limit - takenByMonster);
      if (remainingAllowance === 0) continue;

      // Remove exactly one card per stage per monster occurrence (if available and under limit)
      const availableIndices = shop
        .map((card, index) => (card === targetRarity ? index : -1))
        .filter((index) => index !== -1);

      if (availableIndices.length === 0) continue;

      const chosenIndex = availableIndices[Math.floor(rng() * availableIndices.length)];
      shop[chosenIndex] = null;
      removals[monster.key] += 1;
      takenByMonster += 1;
      usageForRarity[occurrence] = takenByMonster;

      const replacement = drawFromPool(pool, undefined, true, rng);
      shop[chosenIndex] = replacement;
    }
  }
  return removals;
}

function applyStagePurchases(
  shop: Array<UnitRarityKey | null>,
  pool: UnitRarityKey[],
  plan: StagePurchasePlan,
  players: number,
  purchaseSuccessRate: number,
  rng: RngFn
): Record<MonsterKey, number> {
  const purchases: Record<MonsterKey, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0
  };

  for (let playerIndex = 0; playerIndex < players; playerIndex += 1) {
    for (const rarity of MONSTER_ORDER) {
      const target = Math.max(0, Math.floor(plan[rarity] ?? 0));
      if (target === 0) continue;

      let remaining = target;
      while (remaining > 0) {
        remaining -= 1;
        if (rng() > purchaseSuccessRate) {
          continue;
        }

        const availableSlots = shop
          .map((card, index) => (card === rarity ? index : -1))
          .filter((index) => index !== -1);

        if (availableSlots.length === 0) break;

        const chosenIndex = availableSlots[Math.floor(rng() * availableSlots.length)];
        shop[chosenIndex] = null;
        purchases[rarity] += 1;
        fillShop(shop, pool, [chosenIndex], rng);
      }
    }
  }

  return purchases;
}

function countShopRarities(shop: Array<UnitRarityKey | null>): Record<UnitRarityKey, number> {
  const counts = createEmptyCounts();
  shop.forEach((rarity) => {
    if (!rarity) return;
    if (!(rarity in counts)) {
      counts.unknown += 1;
    } else {
      counts[rarity] += 1;
    }
  });
  return counts;
}

function countPoolRarities(pool: UnitRarityKey[]): Record<UnitRarityKey, number> {
  const counts = createEmptyCounts();
  pool.forEach((rarity) => {
    if (!(rarity in counts)) {
      counts.unknown += 1;
    } else {
      counts[rarity] += 1;
    }
  });
  return counts;
}

function prepareStagePlanLookup(stagePlans: StagePurchaseConfig[]): Map<number, StagePurchasePlan> {
  const map = new Map<number, StagePurchasePlan>();
  stagePlans.forEach((plan) => {
    map.set(plan.stage, plan.perPlayer);
  });
  return map;
}

export function simulateStagePurchases(params: StageSimulationParams): StageSimulationResult {
  const {
    copiesByKey,
    players,
    shopSize,
    drawsPerPlayer,
    monsterCounts,
    monsterLimits,
    stagePlans = DEFAULT_STAGE_PURCHASES,
    iterations,
    rng = Math.random,
    purchaseSuccessRate = DEFAULT_PURCHASE_SUCCESS_RATE,
    totalStages = DEFAULT_TOTAL_STAGES
  } = params;

  const totalCopies = Array.from(copiesByKey.values()).reduce((sum, value) => sum + value, 0);
  const poolTemplate = buildPoolTemplate(copiesByKey);
  const stagePlanLookup = prepareStagePlanLookup(stagePlans);
  const stageTotals = new Map<number, Record<UnitRarityKey, number>>();
  const stagePlayerTotals = new Map<number, Record<UnitRarityKey, number>>();
  const stageMonsterTotals = new Map<number, Record<UnitRarityKey, number>>();
  const stagePoolTotals = new Map<number, Record<UnitRarityKey, number>>();
  const maxConfiguredStage = stagePlans.reduce((max, plan) => Math.max(max, plan.stage), 0);
  const targetStages = Math.max(1, Math.trunc(totalStages ?? DEFAULT_TOTAL_STAGES));
  const maxStage = Math.max(targetStages, maxConfiguredStage || targetStages);

  for (let stage = 0; stage <= maxStage; stage += 1) {
    stageTotals.set(stage, createEmptyCounts());
    stagePlayerTotals.set(stage, createEmptyCounts());
    stageMonsterTotals.set(stage, createEmptyCounts());
    stagePoolTotals.set(stage, createEmptyCounts());
  }

  let aggregateRemainingCopies = 0;
  let aggregateDrawsConsumed = 0;
  let aggregateDrawsShortfall = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const pool = [...poolTemplate];
    const shop: Array<UnitRarityKey | null> = new Array(shopSize).fill(null);
    const monsterUsage = createMonsterUsage(monsterCounts);
    const playerHoldings = createEmptyCounts();

    // Stage 0: cheap draws (players pick common/rare if available)
    let drawsNeeded = players * drawsPerPlayer;
    let drawsConsumed = 0;
    while (drawsNeeded > 0 && pool.length > 0) {
      const drawn = drawFromPool(pool, CHEAP_MONSTER_KEYS, false, rng);
      if (!drawn) break;
      drawsNeeded -= 1;
      drawsConsumed += 1;
      playerHoldings[drawn] = (playerHoldings[drawn] ?? 0) + 1;
    }
    const drawsShortfall = Math.max(0, drawsNeeded);

    aggregateRemainingCopies += pool.length;
    aggregateDrawsConsumed += drawsConsumed;
    aggregateDrawsShortfall += drawsShortfall;

    const stageZeroPlayers = stagePlayerTotals.get(0);
    if (stageZeroPlayers) {
      ALL_RARITIES.forEach((rarity) => {
        stageZeroPlayers[rarity] += playerHoldings[rarity] ?? 0;
      });
    }

    // Initial shop fill
    fillShop(shop, pool, null, rng);

    // Record Stage 0 snapshot (initial shop before monsters)
    const stageZeroShop = countShopRarities(shop);
    const stageZeroAggregate = stageTotals.get(0);
    if (stageZeroAggregate) {
      ALL_RARITIES.forEach((rarity) => {
        stageZeroAggregate[rarity] += stageZeroShop[rarity] ?? 0;
      });
    }
    const stageZeroPool = countPoolRarities(pool);
    const stageZeroPoolAggregate = stagePoolTotals.get(0);
    if (stageZeroPoolAggregate) {
      ALL_RARITIES.forEach((rarity) => {
        stageZeroPoolAggregate[rarity] += stageZeroPool[rarity] ?? 0;
      });
    }

    const recordedStages = new Set<number>();
    for (let stageNumber = 1; stageNumber <= maxStage; stageNumber += 1) {
      const monsterRemovals = runMonsterPhase(
        shop,
        pool,
        monsterCounts,
        monsterLimits,
        monsterUsage,
        rng
      );
      const monsterAggregate = stageMonsterTotals.get(stageNumber);
      if (monsterAggregate) {
        MONSTER_ORDER.forEach((rarity) => {
          monsterAggregate[rarity] += monsterRemovals[rarity] ?? 0;
        });
      }

      if (stageTotals.has(stageNumber) && !recordedStages.has(stageNumber)) {
        const snapshot = countShopRarities(shop);
        const stageAggregate = stageTotals.get(stageNumber);
        if (stageAggregate) {
          ALL_RARITIES.forEach((rarity) => {
            stageAggregate[rarity] += snapshot[rarity] ?? 0;
          });
        }
        const poolSnapshot = countPoolRarities(pool);
        const poolAggregate = stagePoolTotals.get(stageNumber);
        if (poolAggregate) {
          ALL_RARITIES.forEach((rarity) => {
            poolAggregate[rarity] += poolSnapshot[rarity] ?? 0;
          });
        }
        recordedStages.add(stageNumber);
      }

      const plan = stagePlanLookup.get(stageNumber);
      if (plan) {
        const playerPurchases = applyStagePurchases(
          shop,
          pool,
          plan,
          players,
          purchaseSuccessRate,
          rng
        );
        const playerAggregate = stagePlayerTotals.get(stageNumber);
        if (playerAggregate) {
          MONSTER_ORDER.forEach((rarity) => {
            const gained = playerPurchases[rarity] ?? 0;
            if (gained > 0) {
              playerHoldings[rarity] += gained;
            }
            playerAggregate[rarity] += playerHoldings[rarity] ?? 0;
          });
        } else {
          MONSTER_ORDER.forEach((rarity) => {
            const gained = playerPurchases[rarity] ?? 0;
            if (gained > 0) {
              playerHoldings[rarity] += gained;
            }
          });
        }
      } else {
        const playerAggregate = stagePlayerTotals.get(stageNumber);
        if (playerAggregate) {
          MONSTER_ORDER.forEach((rarity) => {
            playerAggregate[rarity] += playerHoldings[rarity] ?? 0;
          });
        }
      }
    }
  }

  const stageSnapshots: StageExpectedCounts[] = [];
  const stageNumbers = Array.from(stageTotals.keys()).sort((a, b) => a - b);
  const cumulativeMonsterExpected = createEmptyCounts();

  for (const stage of stageNumbers) {
    const totals = stageTotals.get(stage) ?? createEmptyCounts();
    const expected = createEmptyCounts();
    ALL_RARITIES.forEach((rarity) => {
      expected[rarity] = totals[rarity] / iterations;
    });

    const playerAggregate = stagePlayerTotals.get(stage) ?? createEmptyCounts();
    const playerExpected = createEmptyCounts();
    ALL_RARITIES.forEach((rarity) => {
      playerExpected[rarity] = (playerAggregate[rarity] ?? 0) / iterations;
    });

    const monsterAggregate = stageMonsterTotals.get(stage) ?? createEmptyCounts();
    const monsterExpected = createEmptyCounts();
    ALL_RARITIES.forEach((rarity) => {
      const stageValue = (monsterAggregate[rarity] ?? 0) / iterations;
      cumulativeMonsterExpected[rarity] += stageValue;
      monsterExpected[rarity] = cumulativeMonsterExpected[rarity]; // cumulative holdings so far
    });

    const poolAggregate = stagePoolTotals.get(stage) ?? createEmptyCounts();
    const poolExpected = createEmptyCounts();
    ALL_RARITIES.forEach((rarity) => {
      poolExpected[rarity] = (poolAggregate[rarity] ?? 0) / iterations;
    });
    const poolRemaining = ALL_RARITIES.reduce(
      (sum, rarity) => sum + (poolExpected[rarity] ?? 0),
      0
    );
    stageSnapshots.push({
      stage,
      counts: expected,
      playerCounts: playerExpected,
      monsterCounts: monsterExpected,
      poolCounts: poolExpected,
      poolRemaining
    });
  }

  stageSnapshots.sort((a, b) => a.stage - b.stage);

  return {
    totalCopies,
    remainingCopiesAfterSetup: aggregateRemainingCopies / iterations,
    drawsConsumed: aggregateDrawsConsumed / iterations,
    drawsShortfall: aggregateDrawsShortfall / iterations,
    monsterConfig: { ...monsterCounts },
    monsterLimitConfig: { ...monsterLimits },
    stageSnapshots,
    iterations
  };
}
