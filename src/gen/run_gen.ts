import {red} from '@feltcoop/felt/utils/terminal.js';
import {print_error} from '@feltcoop/felt/utils/print.js';
import {Timings} from '@feltcoop/felt/utils/time.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';

import type {GenModule_Meta} from './gen_module.js';
import {
	GenResults,
	GenModuleResult,
	Gen_Context,
	toGenResult,
	GenModuleResultSuccess,
	GenModuleResultFailure,
} from './gen.js';
import type {Filesystem} from '../fs/filesystem.js';
import {print_path} from '../paths.js';

export const runGen = async (
	fs: Filesystem,
	gen_modules: GenModule_Meta[],
	formatFile?: (fs: Filesystem, id: string, contents: string) => Promise<string>,
	log?: Logger,
): Promise<GenResults> => {
	let inputCount = 0;
	let outputCount = 0;
	const timings = new Timings();
	const timingForTotal = timings.start('total');
	const results = await Promise.all(
		gen_modules.map(
			async ({id, mod}): Promise<GenModuleResult> => {
				inputCount++;
				const genCtx: Gen_Context = {fs, originId: id};
				const timingForModule = timings.start(id);

				// Perform code generation by calling `gen` on the module.
				let rawGenResult;
				try {
					rawGenResult = await mod.gen(genCtx);
				} catch (err) {
					return {
						ok: false,
						id,
						error: err,
						reason: red(`Error generating ${print_path(id)}`),
						elapsed: timingForModule(),
					};
				}

				// Convert the module's return value to a normalized form.
				const genResult = toGenResult(id, rawGenResult);

				// Format the files if needed.
				let files;
				if (formatFile) {
					files = [];
					for (const file of genResult.files) {
						let contents: string;
						try {
							contents = await formatFile(fs, file.id, file.contents);
						} catch (err) {
							contents = file.contents;
							log?.error(
								red(`Error formatting ${print_path(file.id)} via ${print_path(id)}`),
								print_error(err),
							);
						}
						files.push({...file, contents});
					}
				} else {
					files = genResult.files;
				}

				outputCount += files.length;
				return {
					ok: true,
					id,
					files,
					elapsed: timingForModule(),
				};
			},
		),
	);
	return {
		results,
		successes: results.filter((r) => r.ok) as GenModuleResultSuccess[],
		failures: results.filter((r) => !r.ok) as GenModuleResultFailure[],
		inputCount,
		outputCount,
		elapsed: timingForTotal(),
	};
};
