/**
 * Borrowing SvelteKit's homework.
 * @see https://github.com/sveltejs/kit/blob/master/LICENSE
 * @license MIT
 */
export const escape_for_regexp = (str: string): string =>
	str.replace(/[.*+?^${}()|[\]\\]/gu, (match) => '\\' + match);
