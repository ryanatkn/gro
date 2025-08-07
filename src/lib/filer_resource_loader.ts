import type {Disknode} from './disknode.ts';

export interface Resource_Load_Options {
	contents?: boolean;
	imports?: boolean;
	stats?: boolean;
}

/**
 * Efficiently load resources for multiple disknodes in parallel.
 * This is used by Filer to pre-warm observer data based on hints.
 */
export const load_resources_batch = async (
	disknodes: Array<Disknode>,
	options: Resource_Load_Options,
): Promise<void> => {
	const load_promises: Array<Promise<void>> = [];

	for (const disknode of disknodes) {
		if (options.stats) {
			load_promises.push(disknode.load_stats());
		}
		if (options.contents) {
			load_promises.push(disknode.load_contents());
		}
		if (options.imports && disknode.is_importable) {
			load_promises.push(disknode.load_imports());
		}
	}

	if (load_promises.length > 0) {
		await Promise.all(load_promises);
	}
};