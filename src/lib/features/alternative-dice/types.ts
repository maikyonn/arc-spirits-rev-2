/**
 * Alternative Dice System Types
 *
 * Concept: A single 6-sided die where faces progressively unlock based on trait level.
 * This replaces multiple dice types (Basic, Critical, Exalted, Arcane) with one unified die.
 */

export interface DieFace {
	index: number;        // 0-5 for a 6-sided die
	value: number;        // Damage value when this face is rolled
	unlockAt: number;     // Minimum trait required to use this face (0 = always available)
	label?: string;       // Optional display label
}

export interface AlternativeDie {
	name: string;
	faces: DieFace[];
	numSides: number;
}

export interface TraitTarget {
	trait: number;
	targetEV: number;       // Target expected value (from old system)
	diceCount: number;      // Number of dice rolled at this trait
	color: 'bronze' | 'silver' | 'gold' | 'prismatic';
}

export interface OptimizationResult {
	die: AlternativeDie;
	traitResults: TraitComparison[];
	totalError: number;
	meanSquaredError: number;
}

export interface TraitComparison {
	trait: number;
	color: 'bronze' | 'silver' | 'gold' | 'prismatic';
	diceCount: number;
	unlockedFaces: number;
	oldSystemEV: number;      // EV from the original multi-dice system
	newSystemEV: number;      // EV from the alternative unified die
	error: number;
	percentError: number;
}

export interface ClassTargets {
	key: string;
	name: string;
	color: string;
	traitRange: [number, number];
	targets: TraitTarget[];
}

// Configuration for the optimization
export interface OptimizationConfig {
	numFaces: number;              // Usually 6
	unlockThresholds: number[];    // Which trait unlocks each face
	minFaceValue: number;          // Minimum allowed face value
	maxFaceValue: number;          // Maximum allowed face value
	forceNonNegative: boolean;     // Whether all face values must be >= 0
}
