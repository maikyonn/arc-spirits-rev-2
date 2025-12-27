/**
 * Format a number with optional decimal places
 */
export function formatNumber(value: number, decimals = 2): string {
	return value.toFixed(decimals);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
	return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
	return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + '...';
}

/**
 * Convert multiline text to HTML with <br> tags
 */
export function multilineToHtml(text: string | null | undefined): string {
	if (!text) return '';
	return text.split('\n').join('<br>');
}
