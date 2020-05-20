export const truncate = (str: string, maxLength: number, suffix = '...'): string => {
	if (maxLength <= 0 || maxLength < suffix.length) return '';
	if (str.length > maxLength) {
		return str.slice(0, maxLength - suffix.length) + suffix;
	}
	return str;
};

// removes characters inclusive of `stripped`
export const stripStart = (source: string, stripped: string): string => {
	if (!stripped || !source.startsWith(stripped)) return source;
	return source.slice(stripped.length);
};

// removes characters inclusive of `stripped`
export const stripEnd = (source: string, stripped: string): string => {
	if (!stripped || !source.endsWith(stripped)) return source;
	return source.slice(0, -stripped.length);
};

// removes characters inclusive of `stripped`
export const stripAfter = (source: string, stripped: string): string => {
	if (!stripped) return source;
	const idx = source.indexOf(stripped);
	if (idx === -1) return source;
	return source.slice(0, idx);
};

// removes characters inclusive of `stripped`
export const stripBefore = (source: string, stripped: string): string => {
	if (!stripped) return source;
	const idx = source.indexOf(stripped);
	if (idx === -1) return source;
	return source.slice(idx + stripped.length);
};

export const ensureStart = (source: string, ensured: string): string => {
	if (source.startsWith(ensured)) return source;
	return ensured + source;
};

export const ensureEnd = (source: string, ensured: string): string => {
	if (source.endsWith(ensured)) return source;
	return source + ensured;
};

// also trims trailing space
export const deindent = (str: string): string =>
	str
		.split('\n')
		.filter(Boolean)
		.map((s) => s.trim())
		.join('\n');

export const plural = (count: number | undefined | null, suffix = 's'): string =>
	count === 1 ? '' : suffix;
