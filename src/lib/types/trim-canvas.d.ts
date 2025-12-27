declare module 'trim-canvas' {
	/**
	 * Trims transparent pixels from all sides of a canvas
	 * @param canvas - The canvas element to trim
	 * @returns A new canvas with transparent pixels removed
	 */
	export default function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement;
}
