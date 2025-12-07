import type { CurveParams } from './types';

/**
 * Generate a sigmoid (S-curve) value for a given trait
 * Formula: min + (max - min) / (1 + e^(-steepness * (t - inflection)))
 */
export function sigmoid(trait: number, params: CurveParams): number {
	const { min, max, inflection, steepness } = params;
	const exponent = -steepness * (trait - inflection);
	return min + (max - min) / (1 + Math.exp(exponent));
}

/**
 * Generate a linear interpolation value for a given trait
 */
export function linear(trait: number, params: CurveParams, traitRange: [number, number]): number {
	const { min, max } = params;
	const [minTrait, maxTrait] = traitRange;
	const t = (trait - minTrait) / (maxTrait - minTrait);
	return min + t * (max - min);
}

/**
 * Generate a custom curve value by interpolating between defined points
 */
export function custom(trait: number, params: CurveParams): number {
	const points = params.customPoints ?? [];
	if (points.length === 0) return params.min;
	if (points.length === 1) return points[0].value;

	// Sort points by trait
	const sorted = [...points].sort((a, b) => a.trait - b.trait);

	// Find surrounding points for interpolation
	const lower = sorted.filter((p) => p.trait <= trait).pop();
	const upper = sorted.find((p) => p.trait > trait);

	if (!lower) return sorted[0].value;
	if (!upper) return sorted[sorted.length - 1].value;

	// Linear interpolation between points
	const t = (trait - lower.trait) / (upper.trait - lower.trait);
	return lower.value + t * (upper.value - lower.value);
}

/**
 * Generate curve values for all traits in range
 */
export function generateCurveValues(
	params: CurveParams,
	traitRange: [number, number]
): { trait: number; value: number }[] {
	const [minTrait, maxTrait] = traitRange;
	const result: { trait: number; value: number }[] = [];

	for (let trait = minTrait; trait <= maxTrait; trait++) {
		let value: number;
		switch (params.type) {
			case 'sigmoid':
				value = sigmoid(trait, params);
				break;
			case 'linear':
				value = linear(trait, params, traitRange);
				break;
			case 'custom':
				value = custom(trait, params);
				break;
			default:
				value = params.min;
		}
		result.push({ trait, value });
	}

	return result;
}

/**
 * Default S-curve parameters for different class types
 */
export const DEFAULT_CURVE_PARAMS: Record<string, CurveParams> = {
	standard: {
		type: 'sigmoid',
		min: 0.5,
		max: 6.0,
		inflection: 5,
		steepness: 1.0
	},
	sorcerer: {
		type: 'sigmoid',
		min: 0.5,
		max: 2.5,
		inflection: 5,
		steepness: 0.8
	}
};
