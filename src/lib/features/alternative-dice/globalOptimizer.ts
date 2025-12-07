/**
 * Global Optimizer for Alternative Dice System
 *
 * Jointly optimizes face values, unlock thresholds, and dice counts
 * across all three classes (Swordsman, Archer, Sorcerer) simultaneously.
 */

import type { ClassTargets, TraitTarget } from './types';

export interface UnifiedDie {
	faces: {
		index: number;
		value: number;
	}[];
}

export interface TraitConfig {
	trait: number;
	color: 'bronze' | 'silver' | 'gold' | 'prismatic';
	diceCount: number;
	unlockedFaces: number; // How many faces are unlocked (2-6)
	targetEV: number;
	actualEV: number;
	error: number;
}

export interface ClassOptimizedResult {
	key: string;
	name: string;
	color: string;
	traits: TraitConfig[];
	totalError: number;
}

export interface GlobalOptimizationResult {
	die: UnifiedDie;
	classes: ClassOptimizedResult[];
	totalError: number;
	meanSquaredError: number;
}

/**
 * Calculate EV given face values, number of unlocked faces, and dice count
 * Locked faces (beyond unlockedFaces) count as 0
 */
function calculateEV(faceValues: number[], unlockedFaces: number, diceCount: number): number {
	const totalSides = faceValues.length;
	// Sum of unlocked face values (faces 0 to unlockedFaces-1)
	const unlockedSum = faceValues.slice(0, unlockedFaces).reduce((a, b) => a + b, 0);
	// EV per die = unlockedSum / totalSides (locked faces = 0)
	const evPerDie = unlockedSum / totalSides;
	return evPerDie * diceCount;
}

/**
 * For a given configuration of (diceCount, unlockedFaces) per trait,
 * solve least squares to find optimal face values
 */
function solveFaceValues(
	configs: { diceCount: number; unlockedFaces: number; targetEV: number }[],
	numFaces: number
): number[] {
	// Build linear system Ax = b
	// Each config gives us: (diceCount / numFaces) * sum(v[0..unlockedFaces-1]) = targetEV
	// Rewrite as: sum(a_i * v_i) = targetEV where a_i = diceCount/numFaces if i < unlockedFaces, else 0

	const A: number[][] = [];
	const b: number[] = [];

	for (const cfg of configs) {
		const row: number[] = [];
		for (let f = 0; f < numFaces; f++) {
			row.push(f < cfg.unlockedFaces ? cfg.diceCount / numFaces : 0);
		}
		A.push(row);
		b.push(cfg.targetEV);
	}

	// Solve using normal equations with regularization
	return solveWithRegularization(A, b, numFaces);
}

function solveWithRegularization(A: number[][], b: number[], n: number): number[] {
	const lambda = 0.001; // Small regularization to handle underdetermined systems

	// Compute A^T A + lambda * I
	const ATA: number[][] = [];
	for (let i = 0; i < n; i++) {
		ATA[i] = [];
		for (let j = 0; j < n; j++) {
			let sum = i === j ? lambda : 0;
			for (let k = 0; k < A.length; k++) {
				sum += A[k][i] * A[k][j];
			}
			ATA[i][j] = sum;
		}
	}

	// Compute A^T b
	const ATb: number[] = [];
	for (let i = 0; i < n; i++) {
		let sum = 0;
		for (let k = 0; k < A.length; k++) {
			sum += A[k][i] * b[k];
		}
		ATb[i] = sum;
	}

	return gaussianElimination(ATA, ATb);
}

function gaussianElimination(A: number[][], b: number[]): number[] {
	const n = b.length;
	const aug: number[][] = A.map((row, i) => [...row, b[i]]);

	for (let col = 0; col < n; col++) {
		let maxRow = col;
		for (let row = col + 1; row < n; row++) {
			if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
				maxRow = row;
			}
		}
		[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

		if (Math.abs(aug[col][col]) < 1e-10) {
			aug[col][col] = 1e-10;
		}

		for (let row = col + 1; row < n; row++) {
			const factor = aug[row][col] / aug[col][col];
			for (let j = col; j <= n; j++) {
				aug[row][j] -= factor * aug[col][j];
			}
		}
	}

	const x: number[] = new Array(n).fill(0);
	for (let i = n - 1; i >= 0; i--) {
		let sum = aug[i][n];
		for (let j = i + 1; j < n; j++) {
			sum -= aug[i][j] * x[j];
		}
		x[i] = sum / aug[i][i];
	}

	return x;
}

/**
 * Generate all reasonable configurations for a single trait
 * Returns array of {diceCount, unlockedFaces} options
 */
function generateTraitOptions(
	targetEV: number,
	maxDice: number = 10,
	numFaces: number = 6
): { diceCount: number; unlockedFaces: number }[] {
	const options: { diceCount: number; unlockedFaces: number }[] = [];

	for (let dice = 1; dice <= maxDice; dice++) {
		for (let unlocked = 2; unlocked <= numFaces; unlocked++) {
			options.push({ diceCount: dice, unlockedFaces: unlocked });
		}
	}

	return options;
}

/**
 * Group targets by class and sort by trait within each class
 */
function groupByClass(
	allTargets: { classKey: string; trait: number; targetEV: number; color: string }[]
): Map<string, { classKey: string; trait: number; targetEV: number; color: string }[]> {
	const groups = new Map<string, { classKey: string; trait: number; targetEV: number; color: string }[]>();

	for (const t of allTargets) {
		if (!groups.has(t.classKey)) {
			groups.set(t.classKey, []);
		}
		groups.get(t.classKey)!.push(t);
	}

	// Sort each group by trait value
	for (const [, targets] of groups) {
		targets.sort((a, b) => a.trait - b.trait);
	}

	return groups;
}

/**
 * Enforce monotonicity constraint: within each class, unlockedFaces must be non-decreasing as trait increases
 */
function enforceUnlockedFacesMonotonicity(
	configs: Map<string, { diceCount: number; unlockedFaces: number }>,
	classSortedTargets: Map<string, { classKey: string; trait: number; targetEV: number; color: string }[]>
): void {
	for (const [classKey, targets] of classSortedTargets) {
		// targets are already sorted by trait
		let minUnlocked = 2; // Minimum unlocked faces allowed for next trait

		for (const t of targets) {
			const key = `${classKey}-${t.trait}`;
			const cfg = configs.get(key)!;

			// Ensure unlocked faces is at least as much as previous trait
			if (cfg.unlockedFaces < minUnlocked) {
				cfg.unlockedFaces = minUnlocked;
				configs.set(key, cfg);
			}

			// Update minimum for next trait
			minUnlocked = cfg.unlockedFaces;
		}
	}
}

/**
 * Calculate adjusted error with variance penalty
 * Penalizes low dice counts to reduce variance
 */
function calculateAdjustedError(
	baseError: number,
	diceCount: number,
	variancePenalty: number
): number {
	// Penalty decreases as dice count increases
	// With 1 die: penalty = variancePenalty
	// With 2 dice: penalty = variancePenalty / 2
	// With 3 dice: penalty = variancePenalty / 3, etc.
	const penalty = variancePenalty / diceCount;
	return baseError + penalty;
}

/**
 * Greedy optimization: for each trait, pick the best (diceCount, unlockedFaces)
 * given current face values, then re-solve for face values
 * Enforces constraint that unlocked faces only increase as trait increases within each class
 */
function greedyOptimize(
	allTargets: { classKey: string; trait: number; targetEV: number; color: string }[],
	numFaces: number = 6,
	maxDice: number = 4,
	iterations: number = 10,
	variancePenalty: number = 1.0
): { configs: Map<string, { diceCount: number; unlockedFaces: number }>; faceValues: number[] } {
	// Group targets by class for monotonicity enforcement
	const classSortedTargets = groupByClass(allTargets);

	// Initialize with reasonable defaults
	const configs = new Map<string, { diceCount: number; unlockedFaces: number }>();

	for (const t of allTargets) {
		const key = `${t.classKey}-${t.trait}`;
		// Start with a heuristic based on target EV
		const estDice = Math.max(1, Math.min(maxDice, Math.round(t.targetEV / 1.5)));
		const estUnlocked = Math.min(numFaces, 2 + Math.floor((t.trait - 2) * 0.6));
		configs.set(key, { diceCount: estDice, unlockedFaces: estUnlocked });
	}

	// Enforce initial monotonicity
	enforceUnlockedFacesMonotonicity(configs, classSortedTargets);

	let faceValues = new Array(numFaces).fill(1);

	for (let iter = 0; iter < iterations; iter++) {
		// Step 1: Given current configs, solve for optimal face values
		const configArray = allTargets.map((t) => {
			const key = `${t.classKey}-${t.trait}`;
			const cfg = configs.get(key)!;
			return { ...cfg, targetEV: t.targetEV };
		});

		faceValues = solveFaceValues(configArray, numFaces);

		// Enforce non-negative, integer, and reasonable bounds
		faceValues = faceValues.map((v) => Math.max(0, Math.min(20, Math.round(v))));

		// Enforce monotonicity: face values should be non-decreasing
		for (let i = 1; i < faceValues.length; i++) {
			if (faceValues[i] < faceValues[i - 1]) {
				faceValues[i] = faceValues[i - 1];
			}
		}

		// Step 2: Given current face values, optimize each trait's config
		// Process class by class to enforce monotonicity constraint
		for (const [classKey, targets] of classSortedTargets) {
			let minUnlocked = 2; // Minimum unlocked faces for this class

			for (const t of targets) {
				const key = `${classKey}-${t.trait}`;
				// Only consider options that satisfy monotonicity constraint
				const options = generateTraitOptions(t.targetEV, maxDice, numFaces).filter(
					(opt) => opt.unlockedFaces >= minUnlocked
				);

				let bestOption = configs.get(key)!;
				// Ensure current best satisfies constraint
				if (bestOption.unlockedFaces < minUnlocked) {
					bestOption = { ...bestOption, unlockedFaces: minUnlocked };
				}
				const bestBaseError = Math.abs(
					calculateEV(faceValues, bestOption.unlockedFaces, bestOption.diceCount) - t.targetEV
				);
				let bestAdjustedError = calculateAdjustedError(
					bestBaseError,
					bestOption.diceCount,
					variancePenalty
				);

				for (const opt of options) {
					const ev = calculateEV(faceValues, opt.unlockedFaces, opt.diceCount);
					const baseError = Math.abs(ev - t.targetEV);
					const adjustedError = calculateAdjustedError(baseError, opt.diceCount, variancePenalty);
					if (adjustedError < bestAdjustedError) {
						bestAdjustedError = adjustedError;
						bestOption = opt;
					}
				}

				configs.set(key, bestOption);
				// Update minimum for next trait in this class
				minUnlocked = bestOption.unlockedFaces;
			}
		}
	}

	// Final solve for face values
	const finalConfigArray = allTargets.map((t) => {
		const key = `${t.classKey}-${t.trait}`;
		const cfg = configs.get(key)!;
		return { ...cfg, targetEV: t.targetEV };
	});
	faceValues = solveFaceValues(finalConfigArray, numFaces);

	// Enforce integers
	faceValues = faceValues.map((v) => Math.max(0, Math.min(20, Math.round(v))));

	// Final monotonicity enforcement
	for (let i = 1; i < faceValues.length; i++) {
		if (faceValues[i] < faceValues[i - 1]) {
			faceValues[i] = faceValues[i - 1];
		}
	}

	return { configs, faceValues };
}

/**
 * Main global optimization function
 */
export function optimizeGlobally(
	classTargets: ClassTargets[],
	options: {
		numFaces?: number;
		maxDice?: number;
		iterations?: number;
		variancePenalty?: number;
	} = {}
): GlobalOptimizationResult {
	const { numFaces = 6, maxDice = 4, iterations = 15, variancePenalty = 1.5 } = options;

	// Flatten all targets
	const allTargets: { classKey: string; className: string; classColor: string; trait: number; targetEV: number; color: 'bronze' | 'silver' | 'gold' | 'prismatic' }[] = [];

	for (const cls of classTargets) {
		for (const t of cls.targets) {
			allTargets.push({
				classKey: cls.key,
				className: cls.name,
				classColor: cls.color,
				trait: t.trait,
				targetEV: t.targetEV,
				color: t.color
			});
		}
	}

	// Run optimization
	const { configs, faceValues } = greedyOptimize(
		allTargets.map((t) => ({ classKey: t.classKey, trait: t.trait, targetEV: t.targetEV, color: t.color })),
		numFaces,
		maxDice,
		iterations,
		variancePenalty
	);

	// Build results (face values are already integers)
	const die: UnifiedDie = {
		faces: faceValues.map((value, index) => ({
			index,
			value: Math.round(value) // Ensure integer
		}))
	};

	const classResults: ClassOptimizedResult[] = [];
	let totalError = 0;
	let sumSquaredError = 0;

	for (const cls of classTargets) {
		const traits: TraitConfig[] = [];

		for (const t of cls.targets) {
			const key = `${cls.key}-${t.trait}`;
			const cfg = configs.get(key)!;
			const actualEV = calculateEV(faceValues, cfg.unlockedFaces, cfg.diceCount);
			const error = Math.abs(actualEV - t.targetEV);

			traits.push({
				trait: t.trait,
				color: t.color,
				diceCount: cfg.diceCount,
				unlockedFaces: cfg.unlockedFaces,
				targetEV: t.targetEV,
				actualEV: Math.round(actualEV * 100) / 100,
				error: Math.round(error * 1000) / 1000
			});

			totalError += error;
			sumSquaredError += error * error;
		}

		classResults.push({
			key: cls.key,
			name: cls.name,
			color: cls.color,
			traits,
			totalError: Math.round(traits.reduce((sum, t) => sum + t.error, 0) * 1000) / 1000
		});
	}

	return {
		die,
		classes: classResults,
		totalError: Math.round(totalError * 1000) / 1000,
		meanSquaredError: Math.round((sumSquaredError / allTargets.length) * 10000) / 10000
	};
}

/**
 * Format the unlock level as a human-readable string
 */
export function formatUnlockLevel(unlockedFaces: number, numFaces: number = 6): string {
	if (unlockedFaces >= numFaces) return 'All';
	return `${unlockedFaces}/${numFaces}`;
}
