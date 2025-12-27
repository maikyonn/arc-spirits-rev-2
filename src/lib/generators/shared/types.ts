/**
 * Shared types for image generators
 */

/**
 * Common options for card generation
 */
export interface CardGenerationOptions {
	width?: number;
	height?: number;
}

/**
 * Common options for icon generation
 */
export interface IconGenerationOptions {
	size?: number;
	backgroundColor?: string;
}

/**
 * Trimmed bounding box for images
 */
export interface TrimRect {
	sx: number;
	sy: number;
	sw: number;
	sh: number;
}

/**
 * Color definitions for card styling
 */
export interface CardColors {
	cardBg: string;
	text: string;
	secondaryText: string;
	accent: string;
	border?: string;
}

/**
 * Position for template overlays
 */
export interface Position {
	x: number;
	y: number;
}
