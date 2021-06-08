// TODO refactor, move where? hacky because `path`, should reuse existing code
// TODO maybe cache these values on the domain objects instead of this?
const to_base_path_cache: Record<string, string> = {};

export const to_base_path = (id: string, build_dir: string): string => {
	if (id[0] !== '/') return id;
	const cache_key = id + build_dir;
	const cached = to_base_path_cache[cache_key];
	if (cached !== undefined) return cached;
	let slash_count = 0;
	for (let i = build_dir.length; i < id.length; i++) {
		if (id[i] === '/') {
			slash_count++;
			if (slash_count === 2) {
				return (to_base_path_cache[cache_key] = id.substring(i));
			}
		}
	}
	return (to_base_path_cache[cache_key] = id);
};

const to_root_path_cache: Record<string, string> = {};

export const to_root_path = (id: string, build_dir: string): string => {
	const cache_key = id + build_dir;
	const cached = to_root_path_cache[cache_key];
	if (cached !== undefined) return cached;
	let start = build_dir.length - 1;
	for (let i = build_dir.length - 2; i >= 0; i--) {
		const char = build_dir[i];
		if (char === '/') break;
		start--;
	}
	return (to_root_path_cache[cache_key] = id.substring(start - 1));
};
