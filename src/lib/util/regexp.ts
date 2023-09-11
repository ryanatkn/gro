/**
 * Borrowing SvelteKit's homework.
 */
export const escape_for_regexp = (str: string): string =>
	str.replace(/[.*+?^${}()|[\]\\]/gu, (match) => '\\' + match);
