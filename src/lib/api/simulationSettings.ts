import { supabase } from '$lib/api/supabaseClient';
import type { Json, SimulationSettingsInsert, SimulationSettingsRow } from '$lib/types/gameData';
import { setRarityCopiesOverride } from '$lib/utils/gameLogic';
import {
  DEFAULT_MONSTER_COUNTS,
  DEFAULT_MONSTER_LIMITS,
  DEFAULT_STAGE_PURCHASES,
  DEFAULT_TOTAL_STAGES,
  MONSTER_ORDER,
  normalizeMonsterCounts,
  normalizeMonsterTakeLimits,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type MonsterKey,
  type StagePurchaseConfig,
  type StagePurchasePlan
} from '$lib/utils/shop-config';
import { DEFAULT_PURCHASE_SUCCESS_RATE } from '$lib/utils/shopSimulation';

export type MonsterCounts = Record<MonsterKey, number>;
export type MonsterTakeLimits = Record<MonsterKey, number>;
export type RarityOverrides = Record<string, number>;
export type StagePurchaseSettings = StagePurchaseConfig[];

export interface SimulationSettingsData {
  name: string;
  shopSize: number;
  drawsPerPlayer: number;
  playerCount: number;
  purchaseSuccessRate: number;
  monsterCounts: MonsterCounts;
  monsterTakeLimits: MonsterTakeLimits;
  rarityOverrides: RarityOverrides;
  stagePurchasePlan: StagePurchaseSettings;
  totalStages: number;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_SETTINGS_NAME = 'default';

function parseJson<T>(value: Json | null, fallback: T): T {
  if (!value) return fallback;
  try {
    if (typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    return value as unknown as T;
  } catch (err) {
    console.warn('Failed to parse simulation settings json', err);
    return fallback;
  }
}

function serialiseJson(value: unknown): Json {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object') return value as Json;
  try {
    return JSON.parse(String(value)) as Json;
  } catch (err) {
    return {};
  }
}

function sanitizePurchaseValue(value: unknown): number {
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function cloneDefaultStagePlans(): Map<number, StagePurchasePlan> {
  const map = new Map<number, StagePurchasePlan>();
  DEFAULT_STAGE_PURCHASES.forEach((plan) => {
    const perPlayer: StagePurchasePlan = {};
    MONSTER_ORDER.forEach((rarity) => {
      const qty = plan.perPlayer[rarity];
      if (qty !== undefined) {
        perPlayer[rarity] = sanitizePurchaseValue(qty);
      }
    });
    map.set(plan.stage, perPlayer);
  });
  return map;
}

function normalizeStagePurchasePlan(input: unknown, totalStages: number): StagePurchaseSettings {
  const defaults = cloneDefaultStagePlans();

  // ensure stages up to totalStages exist
  for (let stage = 1; stage <= totalStages; stage += 1) {
    if (!defaults.has(stage)) {
      defaults.set(stage, {});
    }
  }

  if (Array.isArray(input)) {
    input.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const stageValue = Number((entry as Record<string, unknown>).stage);
      if (!Number.isInteger(stageValue)) return;
      if (stageValue < 1 || stageValue > totalStages) return;

      const perPlayerRaw = (entry as Record<string, unknown>).perPlayer;
      if (!perPlayerRaw || typeof perPlayerRaw !== 'object') return;

      const current = { ...(defaults.get(stageValue) ?? {}) };
      MONSTER_ORDER.forEach((rarity) => {
        const rawValue = (perPlayerRaw as Record<string, unknown>)[rarity];
        if (rawValue !== undefined) {
          current[rarity] = sanitizePurchaseValue(rawValue);
        }
      });
      defaults.set(stageValue, current);
    });
  }

  const plans: StagePurchaseSettings = [];
  defaults.forEach((perPlayer, stage) => {
    plans.push({ stage, perPlayer });
  });

  plans.sort((a, b) => a.stage - b.stage);
  return plans;
}

export function mapRowToSettings(row: SimulationSettingsRow): SimulationSettingsData {
  const monsterCountsRaw = parseJson<Record<string, number>>(row.monster_counts, DEFAULT_MONSTER_COUNTS);
  const monsterTakeLimitsRaw = parseJson<Record<string, number>>(
    row.monster_take_limits,
    DEFAULT_MONSTER_LIMITS
  );
  const metadataRaw = parseJson<Record<string, unknown>>(row.metadata, {});
  const totalStagesRaw = metadataRaw?.totalStages;
  let totalStages = DEFAULT_TOTAL_STAGES;
  if (typeof totalStagesRaw === 'number' && Number.isFinite(totalStagesRaw)) {
    totalStages = Math.max(1, Math.trunc(totalStagesRaw));
  }

  const stagePurchasePlan = normalizeStagePurchasePlan(metadataRaw?.stagePurchasePlan, totalStages);
  const playerCountRaw = metadataRaw?.playerCount;
  let playerCount = MIN_PLAYERS;
  if (typeof playerCountRaw === 'number' && Number.isFinite(playerCountRaw)) {
    playerCount = playerCountRaw;
  } else if (typeof playerCountRaw === 'string' && playerCountRaw.trim().length > 0) {
    const parsed = Number(playerCountRaw);
    if (Number.isFinite(parsed)) {
      playerCount = parsed;
    }
  }
  playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(playerCount || MIN_PLAYERS)));

  const purchaseSuccessRateRaw = metadataRaw?.purchaseSuccessRate;
  let purchaseSuccessRate = DEFAULT_PURCHASE_SUCCESS_RATE;
  if (typeof purchaseSuccessRateRaw === 'number' && Number.isFinite(purchaseSuccessRateRaw)) {
    purchaseSuccessRate = purchaseSuccessRateRaw;
  } else if (typeof purchaseSuccessRateRaw === 'string' && purchaseSuccessRateRaw.trim().length > 0) {
    const parsed = Number(purchaseSuccessRateRaw);
    if (Number.isFinite(parsed)) {
      purchaseSuccessRate = parsed;
    }
  }
  purchaseSuccessRate = Math.min(1, Math.max(0, purchaseSuccessRate));

  const {
    stagePurchasePlan: _ignored,
    playerCount: _ignoredPlayerCount,
    purchaseSuccessRate: _ignoredPurchaseSuccessRate,
    ...metadata
  } = metadataRaw;

  return {
    name: row.name,
    shopSize: row.shop_size,
    drawsPerPlayer: row.draws_per_player,
    playerCount,
    purchaseSuccessRate,
    totalStages,
    monsterCounts: normalizeMonsterCounts(monsterCountsRaw),
    monsterTakeLimits: normalizeMonsterTakeLimits(monsterTakeLimitsRaw),
    rarityOverrides: parseJson<RarityOverrides>(row.rarity_overrides, {}),
    stagePurchasePlan,
    metadata
  };
}

export async function fetchSimulationSettings(name = DEFAULT_SETTINGS_NAME) {
  const { data, error } = await supabase
    .from('simulation_settings')
    .select('*')
    .eq('name', name)
    .maybeSingle<SimulationSettingsRow>();

  if (error) throw error;
  if (!data) return null;
  return mapRowToSettings(data);
}

export async function upsertSimulationSettings(settings: SimulationSettingsData) {
  const metadataPayload = {
    ...(settings.metadata ?? {}),
    stagePurchasePlan: settings.stagePurchasePlan ?? DEFAULT_STAGE_PURCHASES,
    playerCount: settings.playerCount,
    purchaseSuccessRate: settings.purchaseSuccessRate,
    totalStages: settings.totalStages
  };

  const payload: SimulationSettingsInsert = {
    name: settings.name,
    shop_size: settings.shopSize,
    draws_per_player: settings.drawsPerPlayer,
    monster_counts: serialiseJson(settings.monsterCounts),
    monster_take_limits: serialiseJson(settings.monsterTakeLimits),
    rarity_overrides: serialiseJson(settings.rarityOverrides),
    metadata: serialiseJson(metadataPayload)
  };

  const { data, error } = await supabase
    .from('simulation_settings')
    .upsert(payload, { onConflict: 'name', ignoreDuplicates: false })
    .select()
    .maybeSingle<SimulationSettingsRow>();

  if (error) throw error;
  if (!data) return mapRowToSettings(payload as SimulationSettingsRow);
  return mapRowToSettings(data);
}

export function applyRarityOverrides(overrides: RarityOverrides) {
  setRarityCopiesOverride(overrides);
}
