import {red} from 'kleur/colors';
import {printError} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';
import {type Logger} from '@feltcoop/felt/util/log.js';

import {type GenModuleMeta} from './genModule.js';
import {
	type GenResults,
	type GenModuleResult,
	type GenContext,
	type GenModuleResultSuccess,
	type GenModuleResultFailure,
	toGenResult,
} from './gen.js';
import {type Filesystem} from '../fs/filesystem.js';
import {printPath} from '../paths.js';

export const runGen = async (
	fs: Filesystem,
	genModules: GenModuleMeta[],
	log: Logger,
	formatFile?: (fs: Filesystem, id: string, content: string) => Promise<string>,
): Promise<GenResults> => {
	let inputCount = 0;
	let outputCount = 0;
	const timings = new Timings();
	const timingForTotal = timings.start('total');
	const results = await Promise.all(
		genModules.map(async ({id, mod}): Promise<GenModuleResult> => {
			inputCount++;
			const genCtx: GenContext = {fs, originId: id, log};
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
					reason: red(`Error generating ${printPath(id)}`),
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
					let content: string;
					try {
						content = await formatFile(fs, file.id, file.content);
					} catch (err) {
						content = file.content;
						log?.error(
							red(`Error formatting ${printPath(file.id)} via ${printPath(id)}`),
							printError(err),
						);
					}
					files.push({...file, content});
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
		}),
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
