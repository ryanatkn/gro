// TODO refactor, move where? hacky because `path`, should reuse existing code
// TODO maybe cache these values on the domain objects instead of this?
const toBasePathCache: Record<string, string> = {};

export const toBasePath = (id: string, buildDir: string): string => {
	if (id[0] !== '/') return id;
	const cacheKey = id + buildDir;
	const cached = toBasePathCache[cacheKey];
	if (cached !== undefined) return cached;
	let slashCount = 0;
	for (let i = buildDir.length; i < id.length; i++) {
		if (id[i] === '/') {
			slashCount++;
			if (slashCount === 2) {
				return (toBasePathCache[cacheKey] = id.substring(i));
			}
		}
	}
	return (toBasePathCache[cacheKey] = id);
};

const toRootPathCache: Record<string, string> = {};

export const toRootPath = (id: string, buildDir: string): string => {
	const cacheKey = id + buildDir;
	const cached = toRootPathCache[cacheKey];
	if (cached !== undefined) return cached;
	let start = buildDir.length - 1;
	for (let i = buildDir.length - 2; i >= 0; i--) {
		const char = buildDir[i];
		if (char === '/') break;
		start--;
	}
	return (toRootPathCache[cacheKey] = id.substring(start - 1));
};
