import type { EffectBreakpoint, Effect, DiceEffect, FlatStatEffect, MultiplierEffect } from '$lib/types/effects';
import type { CustomDiceWithSides } from '$lib/features/dice/dice';

export interface BreakpointSimulationResult {
	countLabel: string;
	numericCount: number | null;
	mean: number;
	variance: number;
	sd: number;
}

type DiceLookup = {
	byId: Map<string, CustomDiceWithSides>;
	byName: Map<string, CustomDiceWithSides>;
};

const DEFAULT_TRIALS = 1000;

function buildDiceLookup(records: CustomDiceWithSides[]): DiceLookup {
	const byId = new Map<string, CustomDiceWithSides>();
	const byName = new Map<string, CustomDiceWithSides>();
	records.forEach((record) => {
		byId.set(record.id, record);
		if (record.name) {
			byName.set(record.name.toLowerCase(), record);
		}
	});
	return { byId, byName };
}

function normalizeNumericCount(value: EffectBreakpoint['count']): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const numeric = Number(value.trim());
		return Number.isFinite(numeric) ? numeric : null;
	}
	return null;
}

function sampleDie(dice: CustomDiceWithSides): number {
	if (!dice.dice_sides.length) return 0;
	const index = Math.floor(Math.random() * dice.dice_sides.length);
	const side = dice.dice_sides[index];
	const value = Number(side.reward_value);
	if (!Number.isFinite(value) || value === 100) {
		return 0; // Ignore special cases and non-numeric values
	}
	return value;
}

function resolveDice(effect: DiceEffect, lookup: DiceLookup): CustomDiceWithSides | undefined {
	if (effect.dice_id && lookup.byId.has(effect.dice_id)) {
		return lookup.byId.get(effect.dice_id);
	}
	if (effect.dice_name) {
		const byName = lookup.byName.get(effect.dice_name.toLowerCase());
		if (byName) return byName;
	}
	return undefined;
}

export function simulateClassBreakpoints(
	breakpoints: EffectBreakpoint[],
	diceRecords: CustomDiceWithSides[],
	trials: number = DEFAULT_TRIALS
): BreakpointSimulationResult[] {
	const lookup = buildDiceLookup(diceRecords);
	return breakpoints.map((bp) => simulateBreakpoint(bp, lookup, trials));
}

function simulateBreakpoint(
	breakpoint: EffectBreakpoint,
	lookup: DiceLookup,
	trials: number
): BreakpointSimulationResult {
	const results = new Array<number>(trials);
	for (let trial = 0; trial < trials; trial += 1) {
		let total = 0;
		let multiplier = 1;

		breakpoint.effects.forEach((effect) => {
			switch (effect.type) {
				case 'dice': {
					const diceEffect = effect as DiceEffect;
					const dice = resolveDice(diceEffect, lookup);
					if (!dice) return;
					const quantity = Math.max(0, Math.floor(diceEffect.quantity ?? 0));
					for (let i = 0; i < quantity; i += 1) {
						total += sampleDie(dice);
					}
					break;
				}
				case 'flat_stat': {
					const flat = effect as FlatStatEffect;
					if (flat.stat === 'attack') {
						total += Number(flat.value) || 0;
					}
					break;
				}
				case 'multiplier': {
					const multi = effect as MultiplierEffect;
					if (multi.stat === 'attack') {
						multiplier *= Number(multi.value) || 1;
					}
					break;
				}
				default:
					break;
			}
		});

		results[trial] = total * multiplier;
	}

	const mean = results.reduce((sum, value) => sum + value, 0) / trials;
	const variance =
		results.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / trials;
	const sd = Math.sqrt(Math.max(variance, 0));
	const numericCount = normalizeNumericCount(breakpoint.count);
	const countLabel =
		typeof breakpoint.count === 'string'
			? breakpoint.count
			: numericCount !== null
				? numericCount.toString()
				: '';

	return {
		countLabel,
		numericCount,
		mean,
		variance,
		sd
	};
}
