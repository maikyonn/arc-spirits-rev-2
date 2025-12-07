/**
 * Alternative Dice Optimizer
 *
 * Finds optimal face values for a progressive-unlock die that matches
 * target EVs from the traditional multi-dice system.
 */

import type {
	DieFace,
	AlternativeDie,
	TraitTarget,
	OptimizationResult,
	TraitComparison,
	OptimizationConfig
} from './types';

/**
 * Calculate the expected value for a die at a given trait level
 */
export function calculateEV(die: AlternativeDie, trait: number, diceCount: number): number {
	const unlockedValues = die.faces
		.filter((f) => f.unlockAt <= trait)
		.map((f) => f.value);

	if (unlockedValues.length === 0) return 0;

	// EV per die = (sum of unlocked values) / total sides
	// Even locked faces count as 0, so we divide by total sides
	const sumUnlocked = unlockedValues.reduce((a, b) => a + b, 0);
	const evPerDie = sumUnlocked / die.numSides;

	return evPerDie * diceCount;
}

/**
 * Count how many faces are unlocked at a given trait
 */
export function countUnlockedFaces(die: AlternativeDie, trait: number): number {
	return die.faces.filter((f) => f.unlockAt <= trait).length;
}

/**
 * Solve for optimal face values using least squares
 *
 * The problem: For each trait T with dice count D,
 *   EV(T) = D × (Σ v_i for unlocked faces) / numSides
 *   Target(T) = oldSystemEV
 *
 * We want to minimize Σ (EV(T) - Target(T))²
 *
 * This is a linear least squares problem: Ax = b
 * where x = face values, b = targets, A = coefficient matrix
 */
export function optimizeFaceValues(
	targets: TraitTarget[],
	config: OptimizationConfig
): AlternativeDie {
	const { numFaces, unlockThresholds } = config;

	// Build the linear system Ax = b
	// Each row corresponds to a trait level
	// Each column corresponds to a face value
	// A[t][f] = diceCount[t] / numFaces if face f is unlocked at trait t, else 0
	// b[t] = targetEV[t]

	const A: number[][] = [];
	const b: number[] = [];

	for (const target of targets) {
		const row: number[] = [];
		for (let f = 0; f < numFaces; f++) {
			const isUnlocked = unlockThresholds[f] <= target.trait;
			row.push(isUnlocked ? target.diceCount / numFaces : 0);
		}
		A.push(row);
		b.push(target.targetEV);
	}

	// Solve using normal equations: A^T A x = A^T b
	const solution = solveNormalEquations(A, b, numFaces);

	// Apply constraints
	const constrainedValues = solution.map((v) => {
		if (config.forceNonNegative && v < 0) return config.minFaceValue;
		if (v < config.minFaceValue) return config.minFaceValue;
		if (v > config.maxFaceValue) return config.maxFaceValue;
		return Math.round(v * 100) / 100; // Round to 2 decimal places
	});

	// Build the die
	const faces: DieFace[] = constrainedValues.map((value, i) => ({
		index: i,
		value,
		unlockAt: unlockThresholds[i],
		label: `Face ${i + 1}`
	}));

	return {
		name: 'Unified Attack Die',
		faces,
		numSides: numFaces
	};
}

/**
 * Solve the normal equations A^T A x = A^T b
 * Using Gaussian elimination with partial pivoting
 */
function solveNormalEquations(A: number[][], b: number[], n: number): number[] {
	// Compute A^T A (n x n matrix)
	const ATA: number[][] = [];
	for (let i = 0; i < n; i++) {
		ATA[i] = [];
		for (let j = 0; j < n; j++) {
			let sum = 0;
			for (let k = 0; k < A.length; k++) {
				sum += A[k][i] * A[k][j];
			}
			ATA[i][j] = sum;
		}
	}

	// Compute A^T b (n x 1 vector)
	const ATb: number[] = [];
	for (let i = 0; i < n; i++) {
		let sum = 0;
		for (let k = 0; k < A.length; k++) {
			sum += A[k][i] * b[k];
		}
		ATb[i] = sum;
	}

	// Solve ATA x = ATb using Gaussian elimination
	return gaussianElimination(ATA, ATb);
}

/**
 * Gaussian elimination with partial pivoting
 */
function gaussianElimination(A: number[][], b: number[]): number[] {
	const n = b.length;

	// Create augmented matrix
	const aug: number[][] = A.map((row, i) => [...row, b[i]]);

	// Forward elimination with partial pivoting
	for (let col = 0; col < n; col++) {
		// Find pivot
		let maxRow = col;
		for (let row = col + 1; row < n; row++) {
			if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
				maxRow = row;
			}
		}

		// Swap rows
		[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

		// Check for singular matrix
		if (Math.abs(aug[col][col]) < 1e-10) {
			// Use regularization for near-singular case
			aug[col][col] = 1e-10;
		}

		// Eliminate column
		for (let row = col + 1; row < n; row++) {
			const factor = aug[row][col] / aug[col][col];
			for (let j = col; j <= n; j++) {
				aug[row][j] -= factor * aug[col][j];
			}
		}
	}

	// Back substitution
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
 * Compare the alternative die results with original targets
 */
export function compareResults(
	die: AlternativeDie,
	targets: TraitTarget[]
): TraitComparison[] {
	return targets.map((target) => {
		const newEV = calculateEV(die, target.trait, target.diceCount);
		const error = Math.abs(newEV - target.targetEV);
		const percentError =
			target.targetEV > 0 ? (error / target.targetEV) * 100 : 0;

		return {
			trait: target.trait,
			color: target.color,
			diceCount: target.diceCount,
			unlockedFaces: countUnlockedFaces(die, target.trait),
			oldSystemEV: target.targetEV,
			newSystemEV: Math.round(newEV * 100) / 100,
			error: Math.round(error * 1000) / 1000,
			percentError: Math.round(percentError * 10) / 10
		};
	});
}

/**
 * Run the full optimization and return results
 */
export function optimizeAlternativeDie(
	targets: TraitTarget[],
	config: OptimizationConfig
): OptimizationResult {
	const die = optimizeFaceValues(targets, config);
	const traitResults = compareResults(die, targets);

	const totalError = traitResults.reduce((sum, r) => sum + r.error, 0);
	const meanSquaredError =
		traitResults.reduce((sum, r) => sum + r.error * r.error, 0) /
		traitResults.length;

	return {
		die,
		traitResults,
		totalError: Math.round(totalError * 1000) / 1000,
		meanSquaredError: Math.round(meanSquaredError * 1000) / 1000
	};
}

/**
 * Generate default unlock thresholds for a given trait range
 * Distributes unlock points evenly across the trait range
 */
export function generateDefaultThresholds(
	numFaces: number,
	traitRange: [number, number]
): number[] {
	const [minTrait, maxTrait] = traitRange;
	const thresholds: number[] = [];

	// First 2 faces always available
	thresholds.push(0, 0);

	// Remaining faces unlock progressively
	const remainingFaces = numFaces - 2;
	const step = (maxTrait - minTrait) / (remainingFaces + 1);

	for (let i = 0; i < remainingFaces; i++) {
		const unlockTrait = Math.round(minTrait + step * (i + 1));
		thresholds.push(unlockTrait);
	}

	return thresholds;
}

/**
 * Alternative: Re-roll locked faces instead of counting as 0
 * This gives higher EVs when faces are locked
 */
export function calculateEVWithReroll(
	die: AlternativeDie,
	trait: number,
	diceCount: number
): number {
	const unlockedFaces = die.faces.filter((f) => f.unlockAt <= trait);
	if (unlockedFaces.length === 0) return 0;

	// With re-roll mechanic, EV = average of unlocked face values
	const avgValue =
		unlockedFaces.reduce((sum, f) => sum + f.value, 0) / unlockedFaces.length;

	return avgValue * diceCount;
}
