import {GenModuleMeta} from './genModule.js';
import {
	GenResults,
	GenModuleResult,
	GenContext,
	toGenResult,
	GenModuleResultSuccess,
	GenModuleResultFailure,
} from './gen.js';
import {fmtPath} from '../utils/fmt.js';
import {Timings} from '../utils/time.js';
import {red} from '../colors/terminal.js';

export const runGen = async (
	genModules: GenModuleMeta[],
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
				let rawGenResult;
				try {
					rawGenResult = await mod.gen(genCtx);
				} catch (err) {
					const reason = red(`Error generating ${fmtPath(id)}`);
					return {
						ok: false,
						id,
						error: err,
						reason,
						elapsed: timings.stop(id),
					};
				}
				const {files} = toGenResult(id, rawGenResult);
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
		successes: results.filter(r => r.ok) as GenModuleResultSuccess[],
		failures: results.filter(r => !r.ok) as GenModuleResultFailure[],
		inputCount,
		outputCount,
		elapsed: timings.stop('total'),
	};
};
