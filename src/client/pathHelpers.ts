// TODO refactor, move where? hacky because `path`, should reuse existing code
// TODO maybe cache these values on the domain objects instead of this?
const toBasePathCache: Record<string, string> = {};

export const toBasePath = (id: string, build_dir: string): string => {
	if (id[0] !== '/') return id;
	const cacheKey = id + build_dir;
	const cached = toBasePathCache[cacheKey];
	if (cached !== undefined) return cached;
	let slashCount = 0;
	for (let i = build_dir.length; i < id.length; i++) {
		if (id[i] === '/') {
			slashCount++;
			if (slashCount === 2) {
				return (toBasePathCache[cacheKey] = id.substring(i));
			}
		}
	}
	return (toBasePathCache[cacheKey] = id);
};

const to_root_pathCache: Record<string, string> = {};

export const to_root_path = (id: string, build_dir: string): string => {
	const cacheKey = id + build_dir;
	const cached = to_root_pathCache[cacheKey];
	if (cached !== undefined) return cached;
	let start = build_dir.length - 1;
	for (let i = build_dir.length - 2; i >= 0; i--) {
		const char = build_dir[i];
		if (char === '/') break;
		start--;
	}
	return (to_root_pathCache[cacheKey] = id.substring(start - 1));
};
