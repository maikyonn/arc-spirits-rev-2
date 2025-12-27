/**
 * Extract error message from unknown error types
 * Handles Error objects, Supabase PostgrestError, and plain objects
 */
export function getErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (err && typeof err === 'object' && 'message' in err) {
		return String((err as { message: unknown }).message);
	}
	return String(err);
}
