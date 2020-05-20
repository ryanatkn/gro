import {GenModuleMeta} from './genModule.js';
import {
	GenResults,
	GenModuleResult,
	GenContext,
	toGenResult,
	GenModuleResultSuccess,
	GenModuleResultFailure,
} from './gen.js';
import {printPath} from '../utils/print.js';
import {Timings} from '../utils/time.js';
import {red} from '../colors/terminal.js';

export const runGen = async (
	genModules: GenModuleMeta[],
	formatFile?: (id: string, contents: string) => string,
): Promise<GenResults> => {
	let inputCount = 0;
	let outputCount = 0;
	const timings = new Timings();
	timings.start('total');
	const results = await Promise.all(
		genModules.map(
			async ({id, mod}): Promise<GenModuleResult> => {
				inputCount++;
				const genCtx: GenContext = {originId: id};
				timings.start(id);

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
						elapsed: timings.stop(id),
					};
				}

				// Convert the module's return value to a normalized form.
				const genResult = toGenResult(id, rawGenResult);

				// Format the files if needed.
				let files;
				if (formatFile) {
					files = [];
					for (const file of genResult.files) {
						try {
							files.push({...file, contents: formatFile(file.id, file.contents)});
						} catch (err) {
							return {
								ok: false,
								id,
								error: err,
								reason: red(`Error formatting ${printPath(file.id)} via ${printPath(id)}`),
								elapsed: timings.stop(id),
							};
						}
					}
				} else {
					files = genResult.files;
				}

				outputCount += files.length;
				return {
					ok: true,
					id,
					files,
					elapsed: timings.stop(id),
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
		elapsed: timings.stop('total'),
	};
};
