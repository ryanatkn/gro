import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {
	CompilationSource,
	Compiler,
	createCompiler,
	InitialOptions as CompilerInitialOptions,
} from './compiler.js';
import {createSwcCompiler, InitialOptions as SwcCompilerInitialOptions} from './swcCompiler.js';
import {
	createSvelteCompiler,
	InitialOptions as SvelteCompilerInitialOptions,
} from './svelteCompiler.js';
import {cyan} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';

export const createDefaultCompiler = (
	swcCompilerOptions?: SwcCompilerInitialOptions,
	svelteCompilerOptions?: SvelteCompilerInitialOptions,
	compilerOptions: CompilerInitialOptions = {},
): Compiler => {
	let log: SystemLogger | undefined;
	const getLogger = () => log || (log = new SystemLogger([cyan('[compiler]')]));

	if (!swcCompilerOptions) {
		swcCompilerOptions = {dev: true, log: getLogger()};
	}
	const swcCompiler = createSwcCompiler(swcCompilerOptions);

	if (!svelteCompilerOptions) {
		svelteCompilerOptions = {dev: true, log: getLogger()};
	}
	const svelteCompiler = createSvelteCompiler(svelteCompilerOptions);

	if (!compilerOptions.getCompiler) {
		compilerOptions = {
			...compilerOptions,
			getCompiler: (source: CompilationSource) => {
				switch (source.extension) {
					case TS_EXTENSION:
						return swcCompiler;
					case SVELTE_EXTENSION:
						return svelteCompiler;
					default:
						return null;
				}
			},
		};
	}

	return createCompiler(compilerOptions);
};
